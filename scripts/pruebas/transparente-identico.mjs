// «Transparente idéntico»: compara numéricamente (% de píxeles distintos) la apariencia Transparente de la app actual contra la
// base anterior al sprint (worktree en BASE_DIR, p. ej. D:\Erick\GymBase). Mismas páginas, mismos datos (copia descartable), 1366x768.
// RUIDO=1 compara la base contra SÍ MISMA (dos corridas): mide el ruido de captura (animaciones, brillos) para no atribuirlo a cambios.
// Uso: BASE_DIR=D:\Erick\GymBase node scripts/pruebas/transparente-identico.mjs   (GUARDAR=1 guarda las capturas A/B)
import { chromium } from 'playwright-core'
import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ACTUAL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const BASE = process.env.BASE_DIR || 'C:\\Erick\\GymBase'
const esp = ms => new Promise(r => setTimeout(r, ms))
const vivo = url => new Promise(r => http.get(url, res => { res.resume(); r(true) }).on('error', () => r(false)))
const PAGINAS = [['control-acceso', 'shield-check'], ['caja', 'wallet'], ['dashboard', 'layout-dashboard'], ['clientes', 'users'], ['membresias', 'credit-card'], ['inventario', 'warehouse'], ['ventas', 'shopping-bag'], ['casilleros', 'key-round'], ['reportes', 'chart-no-axes-column'], ['auditoria', 'book-open'], ['ia', 'sparkles'], ['configuracion', 'settings-2']]

function preparar() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-id-'))
  const datos = path.join(dir, 'datos'); fs.mkdirSync(datos)
  for (const f of ['urbanfitness.db', 'urbanfitness.db.hash', 'urbanfitness.db.sha256']) {
    const o = path.join(ACTUAL, 'dev_data', f); if (fs.existsSync(o)) fs.copyFileSync(o, path.join(datos, f))
  }
  const clave = 'Qa-' + Math.random().toString(16).slice(2, 12), script = path.join(dir, 'crear.cjs')
  const codigo = [
    "const Module=require('module');const o=Module._load;",
    "Module._load=function(r,...a){if(r==='electron')return{app:{isPackaged:false,getPath:()=>process.env.TEMP,getVersion:()=>'1.0.0',on(){},whenReady:()=>new Promise(()=>{})},ipcMain:{handle(){},on(){}},safeStorage:{isEncryptionAvailable:()=>false},BrowserWindow:class{},dialog:{},shell:{},session:{},Menu:{}};return o.call(this,r,...a)}",
    `process.chdir(${JSON.stringify(ACTUAL)});`,
    `const b=require(${JSON.stringify(path.join(ACTUAL, 'node_modules/bcryptjs'))});`,
    `const d=require(${JSON.stringify(path.join(ACTUAL, 'electron/database.cjs'))});`,
    "(async()=>{await d.initDB();",
    `d.getQueryHelpers().run("INSERT INTO usuarios (username,nombre_completo,password_hash,rol_id,activo,primer_login) VALUES ('qa_ui','QA UI (temporal)',?,1,1,0)",[b.hashSync(${JSON.stringify(clave)},10)]);`,
    "d.saveDB();process.exit(0)})()",
  ].join('\n')
  fs.writeFileSync(script, codigo)
  execFileSync(process.execPath, [script], { env: { ...process.env, GYM_DATA_DIR: datos }, stdio: 'ignore' })
  return { dir, datos, clave }
}

async function capturar(raiz, puerto, cdp, datos, clave) {
  let vite = null
  if (!(await vivo(`http://localhost:${puerto}/`))) {
    vite = spawn(process.execPath, [path.join(raiz, 'node_modules/vite/bin/vite.js'), '--port', String(puerto), '--strictPort'], { cwd: raiz, stdio: 'ignore' })
    for (let i = 0; i < 60 && !(await vivo(`http://localhost:${puerto}/`)); i++) await esp(1000)
  }
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-ud-'))
  const app = spawn(require(path.join(raiz, 'node_modules/electron')), ['.', `--remote-debugging-port=${cdp}`, `--user-data-dir=${ud}`],
    { cwd: raiz, env: { ...process.env, GYM_DATA_DIR: datos, GYM_PORT: String(puerto) }, stdio: 'ignore' })
  const fotos = {}, doms = {}
  let browser
  try {
    for (let i = 0; i < 60 && !browser; i++) { try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdp}`) } catch { await esp(1000) } }
    let page = null
    for (let i = 0; i < 40 && !page; i++) { page = browser.contexts()[0].pages().find(p => p.url().startsWith(`http://localhost:${puerto}`)); if (!page) await esp(1000) }
    await page.setViewportSize({ width: 1366, height: 768 }).catch(() => {})
    await page.waitForSelector('input[type=password]', { timeout: 20000 }).catch(async () => {
      await page.reload().catch(() => {})
      await page.waitForSelector('input[type=password]', { timeout: 30000 })
    }).catch(async e => {
      console.error('Sin login en', raiz, '→', page.url(), (await page.evaluate(() => document.body.innerText.slice(0, 300)).catch(() => '?')))
      fs.writeFileSync(path.join(os.tmpdir(), 'gym-id-fallo.png'), await page.screenshot().catch(() => Buffer.alloc(0))); throw e
    })
    await page.fill('input[type=text]', 'qa_ui'); await page.fill('input[type=password]', clave)
    await page.getByRole('button', { name: /iniciar sesi/i }).click()
    await page.waitForSelector('.topnav', { timeout: 40000 }); await esp(1500)
    await page.setViewportSize({ width: 1366, height: 768 }).catch(() => {})
    // el video de fondo (canvas fijo) está en otra fase en cada corrida: se oculta en ambas apps para medir solo la interfaz
    await page.addStyleTag({ content: '*{caret-color:transparent!important}canvas[style*="position: fixed"]{visibility:hidden!important}' })
    for (const [nombre, icono] of PAGINAS) {
      await page.evaluate(i => {
        const s = [...document.querySelectorAll('.topnav svg.lucide-' + i)].find(e => e.getBoundingClientRect().width > 0)
        if (s) (s.closest('button,a') || s.parentElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
      }, icono)
      await esp(3200)   // el fondo (frames) termina de animarse y queda en el último cuadro
      await page.mouse.move(5, 5)
      fotos[nombre] = await page.screenshot()
      // mapa del DOM visible (para atribuir cada región distinta al elemento que la contiene)
      doms[nombre] = await page.evaluate(() => [...document.querySelectorAll('body *')].map(e => {
        const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return null
        const c = typeof e.className === 'string' ? e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''
        return [e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (c ? '.' + c : '') + (e.getAttribute('data-testid') ? '[' + e.getAttribute('data-testid') + ']' : ''),
          Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height), (e.children.length ? '' : (e.textContent || '').trim().slice(0, 24))]
      }).filter(Boolean))
    }
  } finally {
    try { await browser?.close() } catch {}
    try { execFileSync('taskkill', ['/F', '/T', '/PID', String(app.pid)], { stdio: 'ignore' }) } catch {}
    if (vite) { try { execFileSync('taskkill', ['/F', '/T', '/PID', String(vite.pid)], { stdio: 'ignore' }) } catch {} }
    await esp(1500)
  }
  return { fotos, doms }
}

const { dir, datos, clave } = preparar()
const baseDB = path.join(BASE, 'dev_data'); fs.mkdirSync(baseDB, { recursive: true })
const respaldoBase = path.join(dir, 'base-db-orig'); fs.mkdirSync(respaldoBase)
for (const f of fs.readdirSync(baseDB)) fs.copyFileSync(path.join(baseDB, f), path.join(respaldoBase, f))
for (const f of fs.readdirSync(datos)) fs.copyFileSync(path.join(datos, f), path.join(baseDB, f))   // la base usa los MISMOS datos
let A, B, DOMA
try {
  // la base (02fea01) no conoce GYM_PORT: se prepara su worktree (solo local; se borra al terminar la Fase 3)
  const mainBase = path.join(BASE, 'electron/main.cjs'); let m = fs.readFileSync(mainBase, 'utf8')
  if (!m.includes('GYM_PORT')) { m = m.replace("mainWindow.loadURL('http://localhost:5173')", "mainWindow.loadURL('http://localhost:' + (process.env.GYM_PORT || 5173))"); fs.writeFileSync(mainBase, m) }
  const cb = await capturar(BASE, 5174, 9334, datos, clave); B = cb.fotos
  const ca = process.env.RUIDO === '1' ? await capturar(BASE, 5174, 9336, datos, clave) : await capturar(ACTUAL, 5173, 9335, datos, clave); A = ca.fotos; DOMA = ca.doms
} finally {
  for (const f of fs.readdirSync(baseDB)) fs.rmSync(path.join(baseDB, f), { force: true })
  for (const f of fs.readdirSync(respaldoBase)) fs.copyFileSync(path.join(respaldoBase, f), path.join(baseDB, f))
}
const sharp = require('sharp'); const filas = []
for (const [n] of PAGINAS) {
  const a = await sharp(A[n]).raw().ensureAlpha().toBuffer({ resolveWithObject: true })
  const b = await sharp(B[n]).raw().ensureAlpha().toBuffer({ resolveWithObject: true })
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) { filas.push([n, 'tamaño distinto', '']); continue }
  let d = 0
  const W = a.info.width, H = a.info.height, C = 24, gw = Math.ceil(W / C), gh = Math.ceil(H / C), celdas = new Uint8Array(gw * gh)
  for (let i = 0; i < a.data.length; i += 4) if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 24) { d++; const p = i / 4; celdas[Math.floor(p / W / C) * gw + Math.floor((p % W) / C)] = 1 }
  // regiones = componentes conexos de celdas (8 vecinos) → caja delimitadora + elemento más pequeño del DOM que la contiene
  const vis = new Uint8Array(gw * gh), regiones = []
  for (let s0 = 0; s0 < celdas.length; s0++) {
    if (!celdas[s0] || vis[s0]) continue
    const pila = [s0]; vis[s0] = 1; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, nc = 0
    while (pila.length) {
      const c = pila.pop(), cx = c % gw, cy = Math.floor(c / gw); nc++
      x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy)
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue
        const k = ny * gw + nx; if (celdas[k] && !vis[k]) { vis[k] = 1; pila.push(k) }
      }
    }
    const bx = x0 * C, by = y0 * C, bw = Math.min(W, (x1 + 1) * C) - bx, bh = Math.min(H, (y1 + 1) * C) - by
    let mejor = null
    for (const e of DOMA[n]) { if (e[1] <= bx + 2 && e[2] <= by + 2 && e[1] + e[3] >= bx + bw - 2 && e[2] + e[4] >= by + bh - 2 && (!mejor || e[3] * e[4] < mejor[3] * mejor[4])) mejor = e }
    regiones.push({ caja: [bx, by, bw, bh], celdas: nc, contenedor: mejor ? mejor[0] + (mejor[5] ? ' «' + mejor[5] + '»' : '') : '(fondo/ninguno)' })
  }
  regiones.sort((p, q) => q.celdas - p.celdas)
  filas.push([n, (100 * d / (W * H)).toFixed(2) + ' %', d, regiones])
  if (process.env.GUARDAR) {
    const dirAB = path.join(ACTUAL, process.env.RUIDO === '1' ? 'docs/capturas-sprint1/ruido' : 'docs/capturas-sprint1/ab'); fs.mkdirSync(dirAB, { recursive: true })
    fs.writeFileSync(path.join(dirAB, `dom-${n}.json`), JSON.stringify(DOMA[n])); fs.writeFileSync(path.join(dirAB, `${n}-base.png`), B[n]); fs.writeFileSync(path.join(dirAB, `${n}-actual.png`), A[n])
  }
}
console.log('| página | píxeles distintos (Transparente actual vs base 02fea01) |\n|---|---|')
for (const f of filas) {
  console.log(`| ${f[0]} | ${f[1]} |`)
  for (const r of (f[3] || []).slice(0, 6)) console.log(`|   ↳ caja ${r.caja.join(',')} (${r.celdas} celdas) | ${r.contenedor} |`)
}
fs.writeFileSync(path.join(ACTUAL, 'docs', process.env.RUIDO === '1' ? 'resultados-transparente-ruido.json' : 'resultados-transparente-identico.json'), JSON.stringify({ fecha: new Date().toISOString(), filas }, null, 1))
try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
process.exit(0)
