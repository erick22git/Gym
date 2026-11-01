// Verificación MANUAL del recorte de la fila en la tarjeta de revisión (Sprint 3, 0.4). Requiere el servicio de análisis (puerto 8420) y Ollama en marcha;
// sube una foto del set a Importar en la app real y comprueba que aparezca el canvas de recorte. Uso: FOTO=ruta SALIDA=captura.png node scripts/pruebas/verificar-recorte.mjs
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)
const esp = ms => new Promise(r => setTimeout(r, ms))
// ── Preparación: copia de la BD + usuario temporal ──────────────────────────────────────────────
function preparar() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-ui-'))
  const datos = path.join(dir, 'datos'); fs.mkdirSync(datos)
  for (const f of ['urbanfitness.db', 'urbanfitness.db.hash', 'urbanfitness.db.sha256']) {
    const o = path.join(RAIZ, 'dev_data', f); if (fs.existsSync(o)) fs.copyFileSync(o, path.join(datos, f))
  }
  const clave = 'Qa-' + Math.random().toString(16).slice(2, 12)
  const script = path.join(dir, 'crear-usuario.cjs')
  fs.writeFileSync(script, `
const Module=require('module');const orig=Module._load
Module._load=function(r,...a){if(r==='electron')return{app:{isPackaged:false,getPath:()=>process.env.TEMP,getVersion:()=>'1.0.0',on(){},whenReady:()=>new Promise(()=>{})},ipcMain:{handle(){},on(){}},safeStorage:{isEncryptionAvailable:()=>false},BrowserWindow:class{},dialog:{},shell:{},session:{},Menu:{}};return orig.call(this,r,...a)}
process.chdir(${JSON.stringify(RAIZ)})
const bcrypt=require(${JSON.stringify(path.join(RAIZ, 'node_modules/bcryptjs'))});const dbm=require(${JSON.stringify(path.join(RAIZ, 'electron/database.cjs'))})
;(async()=>{await dbm.initDB();const {run}=dbm.getQueryHelpers()
run("INSERT INTO usuarios (username,nombre_completo,password_hash,rol_id,activo,primer_login) VALUES ('qa_ui','QA UI (temporal)',?,1,1,0)",[bcrypt.hashSync(${JSON.stringify(clave)},10)]);dbm.saveDB();process.exit(0)})()`)
  execFileSync(process.execPath, [script], { env: { ...process.env, GYM_DATA_DIR: datos }, stdio: 'ignore' })
  return { dir, datos, clave }
}
const vivo = url => new Promise(r => http.get(url, res => { res.resume(); r(true) }).on('error', () => r(false)))


// Verificación puntual (Sprint 3, 0.4): sube una foto del set a Importar, espera la revisión y comprueba que la tarjeta dibuje el recorte de la fila.
const FOTO = process.env.FOTO || path.join(RAIZ, 'datos-evaluacion/sinteticos/tabla_compleja_01.png')
async function principal() {
  const { dir, datos, clave } = preparar()
  const electronBin = require(path.join(RAIZ, 'node_modules/electron'))
  let vite = null
  if (!(await vivo('http://localhost:5173/'))) {
    vite = spawn(process.execPath, [path.join(RAIZ, 'node_modules/vite/bin/vite.js')], { cwd: RAIZ, stdio: 'ignore' })
    for (let i = 0; i < 60 && !(await vivo('http://localhost:5173/')); i++) await esp(1000)
  }
  const app = spawn(electronBin, ['.', `--remote-debugging-port=9335`, `--user-data-dir=${path.join(dir, 'userdata')}`],
    { cwd: RAIZ, env: { ...process.env, GYM_DATA_DIR: datos, NODE_ENV: 'development' }, stdio: 'ignore' })
  let browser
  try {
    for (let i = 0; i < 60 && !browser; i++) { try { browser = await chromium.connectOverCDP('http://127.0.0.1:9335') } catch { await esp(1000) } }
    const ctx = browser.contexts()[0]
    let page = null
    for (let i = 0; i < 30 && !page; i++) { page = ctx.pages().find(p => p.url().startsWith('http://localhost:5173')); if (!page) await esp(1000) }
    await page.setViewportSize({ width: 1366, height: 900 }).catch(() => {})
    for (let i = 0; i < 4; i++) {
      const ok = await page.waitForSelector('input[type=password]', { timeout: 50000 }).then(() => true).catch(async () => { await page.reload().catch(() => {}); return false })
      if (ok) break
    }
    let llego = false
    for (let i = 0; i < 12 && !llego; i++) { await page.keyboard.press('Tab'); llego = await page.evaluate(() => document.activeElement && document.activeElement.type === 'text') }
    await page.keyboard.type('qa_ui'); await page.keyboard.press('Tab'); await page.keyboard.type(clave); await page.keyboard.press('Enter')
    await page.waitForSelector('.topnav', { timeout: 30000 })
    await esp(1500)
    // Importar vive en el icono sparkles (IA) → entrada «Importar»; si no hay input de archivo, se imprime el texto visible para ubicarla
    await page.evaluate(() => {
      const s = Array.from(document.querySelectorAll('.topnav svg.lucide-sparkles')).find(e => e.getBoundingClientRect().width > 0)
      ;(s.closest('button,a,[role=button]') || s.parentElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await esp(1500)
    let input = await page.$('input[type=file]')
    if (!input) console.log('SIN input[type=file]; texto visible: ' + (await page.evaluate(() => document.body.innerText.slice(0, 300))).replace(/\s+/g, ' '))
    if (input) {
      await input.setInputFiles(FOTO)
      await esp(1000)
      const textos = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean).slice(0, 20))
      console.log('botones: ' + textos.join(' | '))
      await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /^actuar$/i.test(x.innerText.trim())); if (b) b.click() })
      await esp(500)
      const caja = await page.$('textarea, input[placeholder*="Escribe"]')
      await caja.click()
      await page.keyboard.type('Carga este inventario')
      await page.keyboard.press('Enter')
      // espera hasta 10 min a que aparezca la revisión
      const hallado = await page.waitForSelector('[data-testid=recorte-fila]', { timeout: 600000 }).then(() => true).catch(() => false)
      console.log('canvas de recorte presente: ' + hallado)
      if (hallado) {
        const info = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid=recorte-fila]')).map(c => ({ w: c.width, h: c.height, pintado: (() => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 700) n++; return n })() })))
        console.log('recortes: ' + JSON.stringify(info))
        const op = await page.$('[data-testid=opciones-duplicado]')
        console.log('opciones de duplicado presentes: ' + !!op)
        if (op) {
          await op.scrollIntoViewIfNeeded()
          const antes = await page.evaluate(() => { const b = document.querySelector('[data-testid=opciones-duplicado]'); return b.closest('div[style]').parentElement.querySelector('input[type=number]')?.value })
          await (await op.$('button')).click()
          await esp(400)
          const despues = await page.evaluate(() => { const b = document.querySelector('[data-testid=opciones-duplicado]'); return b.parentElement.querySelector('input[type=number]')?.value })
          console.log('cantidad antes de elegir: [' + antes + '] · tras «Sumar»: [' + despues + ']')
          await page.screenshot({ path: (process.env.SALIDA || 'recorte-fila.png').replace('.png', '-duplicado.png') })
        }
        const el = await page.$('[data-testid=recorte-fila]')
        await el.scrollIntoViewIfNeeded()
        await page.screenshot({ path: process.env.SALIDA || 'recorte-fila.png' })
      } else {
        await page.screenshot({ path: process.env.SALIDA || 'recorte-fila-fallo.png' })
      }
    }
  } finally {
    try { await browser?.close() } catch {}
    try { app.kill() } catch {}
    try { execFileSync('taskkill', ['/F', '/T', '/PID', String(app.pid)], { stdio: 'ignore' }) } catch {}
    if (vite) { try { vite.kill() } catch {} }
    await esp(1500)
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
  }
}
await principal()
process.exit(0)
