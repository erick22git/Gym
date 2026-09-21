'use strict'
// ─── Dictado por voz 100% local (faster-whisper) ────────────────────────────────
// El renderer graba el micrófono, lo convierte a WAV 16 kHz mono y lo manda por IPC.
// Se manda al servicio local (faster-whisper + modelo "small" empaquetado) y se devuelve el texto.
// No hay red de por medio: todo es 127.0.0.1.

const { ipcMain } = require('electron')
const http = require('http')
const path = require('path')
const fs = require('fs')
const { rutas, PUERTO_OCR } = require('./servicios-locales.cjs')

const MAX_BYTES = 40 * 1024 * 1024 // ~20 min de audio 16 kHz PCM16: de sobra para un dictado
let ocupado = false

// El motor (faster-whisper) vive en el servicio local que la app ya lanza (ocr-service.exe, puerto 8420):
// se le manda el WAV y devuelve el texto. Todo en 127.0.0.1, sin internet.
function transcribirLocal(buf, segundosAudio) {
  // Tiempo permitido proporcional al audio: en un equipo lento no se debe cortar a mitad de un dictado.
  const timeoutMs = Math.min(10 * 60 * 1000, Math.max(2 * 60 * 1000, segundosAudio * 30 * 1000))
  return new Promise(resolve => {
    const req = http.request({
      host: '127.0.0.1', port: PUERTO_OCR, path: '/transcribir', method: 'POST', timeout: timeoutMs,
      headers: { 'Content-Type': 'audio/wav', 'Content-Length': buf.length },
    }, res => {
      let cuerpo = ''
      res.on('data', d => { cuerpo += d.toString('utf8') })
      res.on('end', () => {
        try {
          const r = JSON.parse(cuerpo)
          if (res.statusCode !== 200 || r.error) { resolve({ ok: false, error: `El motor de dictado falló: ${r.error || res.statusCode}` }); return }
          // Por si el motor devuelve marcas como [BLANK_AUDIO] o (música) cuando no oye voz: eso no es texto.
          resolve({ ok: true, texto: String(r.texto || '').replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim() })
        } catch (_) { resolve({ ok: false, error: 'Respuesta inválida del motor de dictado.' }) }
      })
    })
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'El dictado tardó demasiado y se canceló.' }) })
    req.on('error', () => resolve({ ok: false, error: 'El motor de dictado no está disponible todavía; espera a que la IA termine de iniciar.' }))
    req.end(buf)
  })
}

function registrar() {
  // Interruptores del control por voz por módulo (ventas / caja / ia), persistidos en la BD.
  ipcMain.handle('voz:getConfig', () => require('./database.cjs').vozConfig.getAll())
  ipcMain.handle('voz:setConfig', (_e, modulo, activo) => require('./database.cjs').vozConfig.set(modulo, !!activo))

  ipcMain.handle('voz:disponible', () => {
    const R = rutas()
    return fs.existsSync(path.join(R.whisperModelo, 'model.bin'))
  })

  ipcMain.handle('voz:transcribir', async (_e, bytes) => {
    const R = rutas()
    if (!fs.existsSync(path.join(R.whisperModelo, 'model.bin'))) {
      return { ok: false, error: 'Falta el modelo de dictado (whisper) en el paquete de la app.' }
    }
    if (ocupado) return { ok: false, error: 'Ya hay un dictado en proceso; espera a que termine.' }
    const buf = Buffer.from(bytes)
    if (buf.length < 1000) return { ok: false, error: 'La grabación quedó vacía.' }
    if (buf.length > MAX_BYTES) return { ok: false, error: 'La grabación es demasiado larga.' }

    ocupado = true
    try {
      return await transcribirLocal(buf, (buf.length - 44) / 32000) // PCM16 mono 16 kHz = 32 000 B/s
    } finally {
      ocupado = false
    }
  })
}

module.exports = { registrar }
