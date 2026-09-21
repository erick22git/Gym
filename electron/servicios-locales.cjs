'use strict'
// ─── Servicios locales de IA (Ollama + servicio OCR) ─────────────────────────
// La app instalada no puede depender de que alguien corra nada a mano ni de
// nada instalado en el sistema: todo viaja en resources/ y se lanza desde acá,
// al arrancar la app, como procesos hijos. Nada sale a internet.
//
//   resources/ollama/ollama.exe (+ lib/ollama/*)   ← "ollama serve" sin instalador
//   resources/ollama-models/                        ← qwen2.5:3b ya descargado
//   resources/ocr-service/ocr-service.exe           ← ocr_service.py con PyInstaller
//   resources/paddlex-models/                       ← modelos de PaddleOCR ya descargados
//
// Puertos propios (no pisan un Ollama que el usuario tenga por su cuenta):
//   Ollama 11439, servicio OCR 8420 (el front ya apunta ahí).

const { app } = require('electron')
const { spawn, spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const http = require('http')

const PUERTO_OCR = 8420
const PUERTO_OLLAMA = 11439
const MODELO_LLM = 'qwen2.5:3b'
const ESPERA_MAX_MS = 6 * 60 * 1000 // arranque en frío: cargar PaddleOCR puede tardar

const hijos = { ollama: null, ocr: null }
let propios = { ollama: false, ocr: false } // ¿lo lanzamos nosotros? (si ya había uno, no lo matamos)
let cerrando = false
let alCambiar = () => {}
const estado = {
  ollama: { estado: 'apagado', detalle: '' },
  ocr: { estado: 'apagado', detalle: '' },
  listo: false,
}

function recursos() {
  return app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', 'resources-build')
}
function rutas() {
  const r = recursos()
  return {
    ollamaExe: path.join(r, 'ollama', 'ollama.exe'),
    ollamaModelos: path.join(r, 'ollama-models'),
    ocrExe: path.join(r, 'ocr-service', 'ocr-service.exe'),
    paddleModelos: path.join(r, 'paddlex-models'),
    whisperModelo: path.join(r, 'whisper-model'), // faster-whisper "small" (model.bin + tokenizer); lo usa el servicio OCR
  }
}

// En desarrollo (npm run dev) los servicios se corren a mano como siempre;
// se lanzan desde acá solo instalada la app, o si se pide con GYM_LAUNCH_SERVICES=1.
function debeLanzar() {
  return app.isPackaged || process.env.GYM_LAUNCH_SERVICES === '1'
}

function publicar(parcial) {
  Object.assign(estado, parcial)
  estado.listo = estado.ollama.estado === 'listo' && estado.ocr.estado === 'listo'
  try { alCambiar(JSON.parse(JSON.stringify(estado))) } catch (_) { /* la ventana pudo cerrarse */ }
}

function getJson(url, timeoutMs = 2000) {
  return new Promise(resolve => {
    const req = http.get(url, { timeout: timeoutMs }, res => {
      let d = ''
      res.on('data', c => { d += c })
      res.on('end', () => { try { resolve({ ok: res.statusCode === 200, json: JSON.parse(d) }) } catch { resolve({ ok: false }) } })
    })
    req.on('timeout', () => { req.destroy(); resolve({ ok: false }) })
    req.on('error', () => resolve({ ok: false }))
  })
}

async function ollamaListo() {
  const r = await getJson(`http://127.0.0.1:${PUERTO_OLLAMA}/api/tags`)
  return !!(r.ok && (r.json.models || []).some(m => m.name === MODELO_LLM || (m.name || '').startsWith(MODELO_LLM)))
}
async function ocrListo() {
  const r = await getJson(`http://127.0.0.1:${PUERTO_OCR}/health`)
  return !!(r.ok && r.json.status === 'ok')
}

function logStream(nombre) {
  const dir = path.join(app.getPath('userData'), 'logs')
  fs.mkdirSync(dir, { recursive: true })
  const ruta = path.join(dir, `${nombre}.log`)
  try { if (fs.statSync(ruta).size > 5 * 1024 * 1024) fs.renameSync(ruta, ruta + '.old') } catch (_) { /* no existía */ }
  return fs.openSync(ruta, 'a')
}

function matarArbol(pid) {
  if (!pid) return
  try { spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, timeout: 8000 }) } catch (_) { /* ya no existe */ }
}

// Mata TODO proceso cuyo ejecutable esté dentro de `carpeta` (la del paquete, nunca otra). Hace falta porque
// el "runner" del modelo de Ollama (llama-server.exe, ~2 GB de RAM) puede sobrevivir a `taskkill /T`
// y quedar huérfano (visto en la prueba de PC limpia). Por ruta no se toca un Ollama ajeno del usuario.
// powershell.exe NO está en System32 sino en System32\WindowsPowerShell\v1.0: por nombre solo, una PC con un
// PATH mínimo no lo encuentra y la limpieza fallaba en silencio (probado en la "PC limpia"). Ruta absoluta.
const POWERSHELL = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')

function matarPorRuta(carpeta) {
  if (!carpeta) return
  const ps = "Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($env:GYM_RUTA_MATAR + '\\', [StringComparison]::OrdinalIgnoreCase) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
  try {
    spawnSync(POWERSHELL, ['-NoProfile', '-NonInteractive', '-Command', ps], {
      windowsHide: true, timeout: 15000, env: { ...process.env, GYM_RUTA_MATAR: carpeta },
    })
  } catch (_) { /* nada que limpiar */ }
}

async function esperarHasta(comprobar, ms) {
  const fin = Date.now() + ms
  while (Date.now() < fin && !cerrando) {
    if (await comprobar()) return true
    await new Promise(r => setTimeout(r, 1000))
  }
  return false
}

async function lanzarOllama(R) {
  publicar({ ollama: { estado: 'iniciando', detalle: 'Iniciando el modelo de lenguaje…' } })
  if (await ollamaListo()) { propios.ollama = false; publicar({ ollama: { estado: 'listo', detalle: 'Ya estaba en marcha' } }); return }
  if (!fs.existsSync(R.ollamaExe)) { publicar({ ollama: { estado: 'error', detalle: 'Falta ollama.exe en el paquete de la app.' } }); return }
  const salida = logStream('ollama')
  const env = {
    ...process.env,
    OLLAMA_HOST: `127.0.0.1:${PUERTO_OLLAMA}`,
    OLLAMA_MODELS: R.ollamaModelos, // los modelos viajan con la app; nunca ~/.ollama
    OLLAMA_KEEP_ALIVE: '30m',
    OLLAMA_NOHISTORY: '1',
    OLLAMA_NO_CLOUD: '1', // sin funciones cloud: Ollama intentaba llegar a ollama.com por su cuenta
    OLLAMA_NOPRUNE: '1', // nunca borrar blobs de la carpeta de modelos empaquetada (solo lectura)
  }
  const hijo = spawn(R.ollamaExe, ['serve'], { env, cwd: path.dirname(R.ollamaExe), windowsHide: true, stdio: ['ignore', salida, salida] })
  hijos.ollama = hijo; propios.ollama = true
  hijo.on('exit', code => { if (!cerrando) publicar({ ollama: { estado: 'error', detalle: `Ollama se detuvo (código ${code}).` } }) })
  hijo.on('error', e => publicar({ ollama: { estado: 'error', detalle: `No se pudo lanzar Ollama: ${e.message}` } }))
  const ok = await esperarHasta(ollamaListo, ESPERA_MAX_MS)
  if (ok) {
    publicar({ ollama: { estado: 'listo', detalle: '' } })
    // Precarga el modelo en memoria para que la primera consulta no espere a cargarlo.
    const body = JSON.stringify({ model: MODELO_LLM, prompt: '', keep_alive: '30m' })
    const rq = http.request({ host: '127.0.0.1', port: PUERTO_OLLAMA, path: '/api/generate', method: 'POST', headers: { 'Content-Type': 'application/json' } })
    rq.on('error', () => {}); rq.end(body)
  } else if (!cerrando) {
    publicar({ ollama: { estado: 'error', detalle: 'Ollama no respondió a tiempo o falta el modelo empaquetado.' } })
  }
}

async function lanzarOcr(R) {
  publicar({ ocr: { estado: 'iniciando', detalle: 'Cargando el lector de documentos (puede tardar un minuto)…' } })
  if (await ocrListo()) { propios.ocr = false; publicar({ ocr: { estado: 'listo', detalle: 'Ya estaba en marcha' } }); return }
  if (!fs.existsSync(R.ocrExe)) { publicar({ ocr: { estado: 'error', detalle: 'Falta ocr-service.exe en el paquete de la app.' } }); return }
  const tmp = path.join(app.getPath('userData'), 'ia-tmp')
  fs.mkdirSync(tmp, { recursive: true })
  const salida = logStream('ocr-service')
  const env = {
    ...process.env,
    GYM_OCR_PORT: String(PUERTO_OCR),
    GYM_OLLAMA_URL: `http://127.0.0.1:${PUERTO_OLLAMA}`,
    GYM_OCR_TMP: tmp, // temporales en userData, nunca en Program Files
    GYM_PARENT_PID: String(process.pid),
    GYM_OLLAMA_PID: hijos.ollama ? String(hijos.ollama.pid) : '',
    GYM_OLLAMA_DIR: propios.ollama ? path.dirname(R.ollamaExe) : '', // para que su vigilante limpie por ruta
    GYM_WHISPER_DIR: R.whisperModelo,
    PYTHONIOENCODING: 'utf-8',
    // Modelos de PaddleOCR ya descargados y empaquetados: nada de descargas.
    PADDLE_PDX_CACHE_HOME: R.paddleModelos,
    PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: 'True',
    HF_HUB_OFFLINE: '1',
    TRANSFORMERS_OFFLINE: '1',
  }
  // detached: libuv mete a los hijos normales en un Job Object que Windows cierra junto con este proceso, asi que
  // si la app muere de golpe el servicio moriria al instante SIN poder limpiar. Fuera de ese job, su vigilante
  // (GYM_PARENT_PID) sobrevive unos segundos, apaga Ollama y el runner llama-server.exe (que escapa al job) y sale.
  const hijo = spawn(R.ocrExe, [], { env, cwd: path.dirname(R.ocrExe), windowsHide: true, detached: true, stdio: ['ignore', salida, salida] })
  hijos.ocr = hijo; propios.ocr = true
  hijo.on('exit', code => { if (!cerrando) publicar({ ocr: { estado: 'error', detalle: `El servicio de lectura se detuvo (código ${code}).` } }) })
  hijo.on('error', e => publicar({ ocr: { estado: 'error', detalle: `No se pudo lanzar el servicio de lectura: ${e.message}` } }))
  const ok = await esperarHasta(ocrListo, ESPERA_MAX_MS)
  if (ok) publicar({ ocr: { estado: 'listo', detalle: '' } })
  else if (!cerrando) publicar({ ocr: { estado: 'error', detalle: 'El servicio de lectura no respondió a tiempo.' } })
}

// Arranca todo al iniciar la app (no bajo demanda). Ollama primero (el servicio
// OCR le pasa su PID al vigilante de huérfanos) y en paralelo el resto no bloquea la UI.
async function iniciar(callback) {
  if (callback) alCambiar = callback
  if (!debeLanzar()) {
    publicar({ ollama: { estado: 'externo', detalle: 'Modo desarrollo: servicios manuales' }, ocr: { estado: 'externo', detalle: 'Modo desarrollo: servicios manuales' } })
    estado.listo = true
    return
  }
  const R = rutas()
  // Si la app anterior murió de golpe pudo dejar el runner del modelo huérfano: se limpia antes de arrancar.
  matarPorRuta(path.dirname(R.ollamaExe))
  // En paralelo: PaddleOCR tarda en cargar y no tiene por qué esperar a Ollama.
  // El OCR solo necesita el PID de Ollama ya creado (vigilante de huérfanos).
  const pOllama = lanzarOllama(R)
  await esperarHasta(async () => !!hijos.ollama || estado.ollama.estado !== 'iniciando', 8000)
  await Promise.all([pOllama, lanzarOcr(R)])
}

// Cierre limpio: mata el árbol de procesos de cada hijo que lanzamos nosotros.
function detener() {
  cerrando = true
  for (const k of ['ocr', 'ollama']) {
    if (propios[k] && hijos[k] && !hijos[k].killed) matarArbol(hijos[k].pid)
    hijos[k] = null
  }
  if (propios.ollama) matarPorRuta(path.dirname(rutas().ollamaExe)) // el runner llama-server.exe también
}

function getEstado() { return JSON.parse(JSON.stringify(estado)) }

module.exports = { iniciar, detener, getEstado, rutas, PUERTO_OCR, PUERTO_OLLAMA }
