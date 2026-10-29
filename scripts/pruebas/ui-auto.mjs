// Pruebas automáticas de interfaz (npm run test:ui). playwright-core por CDP sobre la app Electron real.
//   · Usa SIEMPRE una copia descartable de la BD (GYM_DATA_DIR + --user-data-dir en un directorio temporal): nunca toca dev_data
//     ni los ajustes de dispositivo reales. El usuario de prueba vive solo en esa copia.
//   · Recorre apariencia × zoom × página y comprueba con aserciones; imprime un resumen compacto y solo los fallos.
// Requisitos: Vite en :5173 (se levanta solo si no está). Variables: UI_RAPIDO=1 (menos combinaciones), UI_SOLO=menu,contraste,…
import { chromium } from 'playwright-core'
import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const PUERTO_CDP = 9333
const RAPIDO = process.env.UI_RAPIDO === '1'
const SOLO = process.env.UI_SOLO ? process.env.UI_SOLO.split(',') : null
const quiere = k => !SOLO || SOLO.includes(k)
const esp = ms => new Promise(r => setTimeout(r, ms))

const APARIENCIAS = (process.env.UI_APS ? process.env.UI_APS.split(',') : ['transparente', 'oscuro', 'claro'])
const ZOOMS = RAPIDO ? [100, 200] : [100, 125, 150, 175, 200]
const PAGINAS = [
  ['control-acceso', 'shield-check'], ['caja', 'wallet'], ['dashboard', 'layout-dashboard'], ['clientes', 'users'], ['membresias', 'credit-card'],
  ['inventario', 'warehouse'], ['ventas', 'shopping-bag'], ['casilleros', 'key-round'], ['reportes', 'chart-no-axes-column'],
  ['auditoria', 'book-open'], ['ia', 'sparkles'], ['configuracion', 'settings-2'],
]

const otrosAxe = {}   // violaciones de axe de impacto moderado/leve (se reportan, no fallan)
let falsosAxe = 0   // violaciones de axe que el color realmente pintado desmiente (conversión oklch)
const hojas = {}      // apariencia → [{nombre, buf}] (UI_HOJAS=1: una hoja de contactos por apariencia)
const resultados = []   // { area, detalle, ok, nota }
const registrar = (area, detalle, ok, nota = '') => resultados.push({ area, detalle, ok, nota })

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

// ── Principal ────────────────────────────────────────────────────────────────────────────────────
async function main() {
  let vite = null
  if (!(await vivo('http://localhost:5173/'))) {
    vite = spawn(process.execPath, [path.join(RAIZ, 'node_modules/vite/bin/vite.js')], { cwd: RAIZ, stdio: 'ignore' })
    for (let i = 0; i < 60 && !(await vivo('http://localhost:5173/')); i++) await esp(1000)
  }
  const { dir, datos, clave } = preparar()
  const electronBin = require(path.join(RAIZ, 'node_modules/electron'))
  const app = spawn(electronBin, ['.', `--remote-debugging-port=${PUERTO_CDP}`, `--user-data-dir=${path.join(dir, 'userdata')}`],
    { cwd: RAIZ, env: { ...process.env, GYM_DATA_DIR: datos, NODE_ENV: 'development' }, stdio: 'ignore' })
  let browser
  try {
    for (let i = 0; i < 60 && !browser; i++) { try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${PUERTO_CDP}`) } catch { await esp(1000) } }
    if (!browser) throw new Error('No se pudo conectar a la app por CDP')
    const ctx = browser.contexts()[0]
    let page = null
    for (let i = 0; i < 30 && !page; i++) { page = ctx.pages().find(p => p.url().startsWith('http://localhost:5173')); if (!page) await esp(1000) }
    await page.setViewportSize({ width: 1366, height: 768 }).catch(() => {})
    await page.waitForSelector('input[type=password]', { timeout: 30000 })
    await ejecutar(page, clave)
  } finally {
    try { await browser?.close() } catch {}
    try { app.kill() } catch {}
    try { execFileSync('taskkill', ['/F', '/T', '/PID', String(app.pid)], { stdio: 'ignore' }) } catch {}
    if (vite) { try { vite.kill() } catch {} }
    await esp(1500)
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
  }
}

const fijarDispositivo = (page, p) => page.evaluate(x => window.api.dispositivo.fijar(x), p)
async function poner(page, apariencia, zoom, altoContraste = false) {
  await fijarDispositivo(page, { apariencia, tamano: zoom, altoContraste })
  await page.evaluate(a => window.__gym.setApariencia(a), apariencia)
  await page.evaluate(ac => window.__gym.fijarAltoContraste(ac), altoContraste)
  await esp(700)
}
async function irA(page, icono) {
  const ok = await page.evaluate(i => {
    const s = Array.from(document.querySelectorAll('.topnav svg.lucide-' + i)).find(e => e.getBoundingClientRect().width > 0)
    if (!s) return false
    ;(s.closest('button,a,[role=button]') || s.parentElement).dispatchEvent(new MouseEvent('click', { bubbles: true })); return true
  }, icono)
  await esp(900)
  return ok
}
const hayLusion = page => page.evaluate(() => {
  const re = /lusion/i, hallazgos = []
  const t = document.body.innerText; if (re.test(t)) hallazgos.push('texto visible')
  for (const e of document.querySelectorAll('[aria-label],[title],[placeholder],[alt],[data-testid],input,textarea')) {
    for (const a of ['aria-label', 'title', 'placeholder', 'alt', 'value']) { const v = e.getAttribute(a) ?? (a === 'value' ? e.value : null); if (v && re.test(v)) hallazgos.push(a + ':' + String(v).slice(0, 30)) }
  }
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (re.test(k) || re.test(localStorage.getItem(k) || '')) hallazgos.push('localStorage:' + k) } } catch {}
  return hallazgos
})

async function ejecutar(page, clave) {
  // 0) LOGIN (antes de iniciar sesión): axe completo, «Aa» visible y teclado
  if (quiere('login')) {
    const axeLogin = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
    for (const ap of APARIENCIAS) {
      await poner(page, ap, 100); await page.addScriptTag({ content: axeLogin }).catch(() => {})
      const r = await page.evaluate(async () => { const o = await axe.run(document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] }); return o.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => v.id + '×' + v.nodes.length + ' ' + v.nodes[0].html.slice(0, 90)) })
      registrar('login', `axe ${ap}`, r.length === 0, r.join(' | '))
      const aa = await page.evaluate(() => { const b = document.querySelector('[data-testid=boton-aa]'); const r = b && b.getBoundingClientRect(); return !!r && r.width > 0 && r.height > 0 && r.right <= innerWidth && r.left >= 0 })
      registrar('login', `botón «Aa» visible ${ap}`, aa)
      for (const z of [150, 200]) {
        await fijarDispositivo(page, { tamano: z }); await esp(500)
        const m = await page.evaluate(() => { const w = document.querySelector('.login-outer').parentElement; const b = [...document.querySelectorAll('button')].find(e => /iniciar sesi/i.test(e.textContent)); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { alcanzable: r.top >= 0 && r.bottom <= innerHeight, scrollY: getComputedStyle(w).overflowY } })
        registrar('login', `a ${z}% el botón Iniciar sesión es alcanzable (${ap})`, m.alcanzable, JSON.stringify(m))
      }
      await fijarDispositivo(page, { tamano: 100 }); await esp(300)
    }
    // solo teclado: Tab hasta el usuario, escribir, Tab, clave, Enter
    await page.keyboard.press('Tab'); const foco = await page.evaluate(() => document.activeElement && document.activeElement.tagName)
    registrar('login', 'Tab mueve el foco dentro de la pantalla', !!foco && foco !== 'BODY', String(foco))
    await poner(page, 'transparente', 100)
  }

  // login (usuario de prueba de la copia descartable)
  // el inicio de sesión se hace SOLO con teclado (Tab hasta el usuario, escribir, Tab, clave, Enter)
  let llegoUsuario = false
  for (let i = 0; i < 12 && !llegoUsuario; i++) { await page.keyboard.press('Tab'); llegoUsuario = await page.evaluate(() => document.activeElement && document.activeElement.type === 'text') }
  await page.keyboard.type('qa_ui'); await page.keyboard.press('Tab'); await page.keyboard.type(clave); await page.keyboard.press('Enter')
  registrar('teclado', 'login completo solo con teclado', llegoUsuario)
  await page.waitForSelector('.topnav', { timeout: 30000 })
  await esp(1500)
  await page.setViewportSize({ width: 1366, height: 768 }).catch(() => {})
  const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')

  // 1) MENÚ: todos los módulos con icono visible y alcanzables en cada zoom
  if (quiere('menu')) {
    for (const ap of APARIENCIAS) for (const z of ZOOMS) {
      await poner(page, ap, z)
      const m = await page.evaluate(() => {
        const nav = document.querySelector('.topnav'), items = [...nav.querySelectorAll('.menu-item')]
        const sinIcono = items.filter(i => { const s = i.querySelector('svg'); const r = s && s.getBoundingClientRect(); return !r || r.width <= 0 || r.height <= 0 }).length
        const ocultos = getComputedStyle(nav.closest('.topnav-caja') || nav).display === 'none'
        return { n: items.length, sinIcono, ocultos, scrollable: nav.scrollWidth > nav.clientWidth + 1, anchoDoc: document.documentElement.scrollWidth, ventana: innerWidth, barra: !!document.querySelector('[data-testid=topnav-barra]') }
      })
      let alcanza = true, nota = ''
      if (m.scrollable) {
        const caja = await page.locator('.topnav').boundingBox(); await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2); await page.mouse.wheel(0, 3000); await esp(400)
        const fin = await page.evaluate(() => { const n = document.querySelector('.topnav'); return n.scrollLeft >= n.scrollWidth - n.clientWidth - 2 })
        alcanza = fin && m.barra; nota = fin ? '' : 'la rueda no llega al final'
        await page.mouse.wheel(0, -5000); await esp(200)
      }
      const ok = m.n >= 10 && m.sinIcono === 0 && !m.ocultos && alcanza && m.anchoDoc <= m.ventana + 1
      registrar('menu', `${ap} ${z}%`, ok, ok ? '' : `${JSON.stringify(m)} ${nota}`)
    }
    await poner(page, 'transparente', 100)
  }

  // 2) PÁGINAS: contraste (axe), tipografía, foco, «lusion», desborde
  const tipos = {}
  if (quiere('contraste') || quiere('axe') || quiere('tipografia') || quiere('foco') || quiere('lusion')) {
    for (const ac of [false, true]) for (const ap of APARIENCIAS) {
      if (RAPIDO && ac && ap !== 'claro') continue
      await poner(page, ap, 100, ac)
      for (const [nombre, icono] of PAGINAS) {
        if (process.env.UI_PAGINAS && !process.env.UI_PAGINAS.split(',').includes(nombre)) continue
        if (!(await irA(page, icono))) { registrar('navegacion', `${ap}${ac ? '+AC' : ''} ${nombre}`, false, 'icono no encontrado'); continue }
        await esp(500)
        await page.addScriptTag({ content: axeSrc }).catch(() => {})
        const r = await page.evaluate(async enh => {
          const out = await axe.run(document.body, { runOnly: { type: 'rule', values: [enh ? 'color-contrast-enhanced' : 'color-contrast'] }, resultTypes: ['violations', 'passes'] })
          const v = out.violations[0]
          // axe 4.14 convierte mal los oklch fuera de sRGB (p. ej. oklch(0.66 0.22 25) → #cf383a cuando se pinta (253,68,71)).
          // Cada fallo se reconfirma con el color REALMENTE pintado (canvas = mismo resultado que el compositor).
          const cv = document.createElement('canvas'); cv.width = cv.height = 1; const x = cv.getContext('2d', { willReadFrequently: true })
          const px = c => { x.clearRect(0, 0, 1, 1); x.fillStyle = '#000'; x.fillStyle = c; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255] }
          const mez = (f, b) => [f[0] * f[3] + b[0] * (1 - f[3]), f[1] * f[3] + b[1] * (1 - f[3]), f[2] * f[3] + b[2] * (1 - f[3]), 1]
          const lin = q => { q /= 255; return q <= 0.03928 ? q / 12.92 : Math.pow((q + 0.055) / 1.055, 2.4) }
          const L = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])
          const ratio = (a, b) => { const p = L(a), q = L(b); return (Math.max(p, q) + 0.05) / (Math.min(p, q) + 0.05) }
          const fondoReal = el => { const cadena = []; for (let e = el; e; e = e.parentElement) cadena.push(e); let base = px(getComputedStyle(document.documentElement).backgroundColor === 'rgba(0, 0, 0, 0)' ? '#000' : getComputedStyle(document.documentElement).backgroundColor); base = [base[0], base[1], base[2], 1]
            for (const e of cadena.reverse()) { const c = px(getComputedStyle(e).backgroundColor); if (c[3] > 0) base = mez(c, base) } return base }
          const real = []
          for (const n of (v ? v.nodes : [])) {
            let ok = false
            try { const el = document.querySelector(n.target[0]); if (el) { const bg = fondoReal(el), cs = getComputedStyle(el), fg = mez(px(cs.color), bg); const pxs = parseFloat(cs.fontSize), b = parseInt(cs.fontWeight) >= 700, g = pxs >= 24 || (pxs >= 18.66 && b); ok = ratio(fg, bg) >= (enh ? (g ? 4.5 : 7) : (g ? 3 : 4.5)) } } catch {}
            if (!ok) real.push({ sel: n.target.join(' ').slice(0, 70), msg: ((n.any[0] && n.any[0].message) || '').slice(0, 160), html: n.html.slice(0, 140) })
          }
          return { fallos: real.length, falsosAxe: (v ? v.nodes.length : 0) - real.length, pasan: out.passes[0] ? out.passes[0].nodes.length : 0, ej: real.slice(0, 3) }
        }, ac)
        falsosAxe += r.falsosAxe
        registrar(ac ? 'contraste-AAA' : 'contraste-AA', `${ap} ${nombre}`, r.fallos === 0, r.fallos ? `${r.fallos}/${r.fallos + r.pasan} · ${JSON.stringify(r.ej)}` : '')
        // tipografía: (texto,etiqueta)→fuente; se compara entre apariencias
        if (!ac) {
          const t = await page.evaluate(() => { const o = {}; for (const e of document.querySelectorAll('body *')) { const r = e.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) continue
            const tx = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim().slice(0, 24); if (!tx) continue
            const s = getComputedStyle(e); const k = e.tagName + '|' + tx; if (!(k in o)) o[k] = [s.fontFamily.split(',')[0], s.fontWeight, s.fontSize, s.lineHeight, s.letterSpacing].join('/') } return o })
          ;(tipos[nombre] ||= {})[ap] = t
        }
        if (process.env.UI_HOJAS && !ac) (hojas[ap] ||= []).push({ nombre, buf: await page.screenshot() })
        if (!ac && quiere('axe')) {
          const ax = await page.evaluate(async () => { const o = await axe.run(document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, rules: { 'color-contrast': { enabled: false } }, resultTypes: ['violations'] })
            return o.violations.map(v => ({ id: v.id, impacto: v.impact, n: v.nodes.length, ej: v.nodes[0] ? v.nodes[0].html.slice(0, 110) : '', todos: v.nodes.slice(0, 12).map(n => n.html.slice(0, 190)) })) })
          const graves = ax.filter(v => v.impacto === 'critical' || v.impacto === 'serious')
          registrar('axe-grave', `${ap} ${nombre}`, graves.length === 0, graves.map(v => `${v.id}×${v.n} ${v.ej}`).join(' | '))
          if (process.env.UI_DETALLE) for (const v of graves) if (v.id !== 'button-name') for (const h of v.todos) console.log(`DET ${nombre} ${v.id}: ${h}`)
          for (const v of ax.filter(v => !graves.includes(v))) (otrosAxe[v.id] ||= { impacto: v.impacto, n: 0, ej: v.ej }).n += v.n
        }
        const ll = await hayLusion(page); registrar('sin-lusion', `${ap}${ac ? '+AC' : ''} ${nombre}`, ll.length === 0, ll.join(', '))
        // foco visible al tabular
        if (!ac && ap !== 'transparente') {
          await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await esp(450) // las transiciones del botón terminan antes de medir
          const f = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const s = getComputedStyle(e); return { w: parseFloat(s.outlineWidth), st: s.outlineStyle, sombra: s.boxShadow !== 'none', el: e.tagName.toLowerCase() + '.' + String(e.className).slice(0, 30) + '[' + (e.getAttribute('type') || e.getAttribute('role') || '') + ']' } })
          registrar('foco-visible', `${ap} ${nombre}`, !f || (f.st !== 'none' && f.w >= 2) || f.sombra, f ? JSON.stringify(f) : '')
        }
      }
    }
    // tipografía: Transparente vs Oscuro/Claro, por página
    for (const [nombre] of PAGINAS) {
      const base = tipos[nombre]?.transparente; if (!base) continue
      for (const ap of ['oscuro', 'claro']) {
        const o = tipos[nombre][ap] || {}; let comp = 0, dif = 0, ej = ''
        for (const k of Object.keys(base)) if (k in o) { comp++; if (base[k] !== o[k]) { dif++; if (!ej) ej = `${k}: ${base[k]} → ${o[k]}` } }
        registrar('tipografia', `${ap} ${nombre} (${comp} textos)`, dif === 0, ej)
      }
    }
    await poner(page, 'transparente', 100, false)
  }

  // 2b) Modal: rol, foco inicial, trampa de Tab, Escape y retorno del foco
  if (quiere('modal')) {
    await irA(page, 'warehouse'); await esp(800)
    const abrir = page.getByRole('button', { name: /nuevo producto/i }).first()
    await abrir.focus(); await abrir.press('Enter'); await esp(900)
    const m = await page.evaluate(() => { const d = document.querySelector('[role=dialog][data-modal-a11y]'); return { hay: !!d, modal: d && d.getAttribute('aria-modal'), nombre: d && d.getAttribute('aria-label'), dentro: !!d && d.contains(document.activeElement) } })
    registrar('modal', 'rol dialog, aria-modal, nombre y foco inicial dentro', m.hay && m.modal === 'true' && !!m.nombre && m.dentro, JSON.stringify(m))
    let siempreDentro = true
    for (let i = 0; i < 40 && siempreDentro; i++) { await page.keyboard.press(i % 7 === 6 ? 'Shift+Tab' : 'Tab'); siempreDentro = await page.evaluate(() => { const d = document.querySelector('[role=dialog][data-modal-a11y]'); return !!d && d.contains(document.activeElement) }) }
    registrar('modal', 'Tab / Shift+Tab no salen del modal (40 pulsaciones)', siempreDentro)
    await page.keyboard.press('Escape'); await esp(900)
    const f = await page.evaluate(() => ({ abierto: !!document.querySelector('[role=dialog][data-modal-a11y]'), foco: document.activeElement && (document.activeElement.textContent || '').trim().slice(0, 20) }))
    registrar('modal', 'Escape cierra y devuelve el foco a «Nuevo producto»', !f.abierto && /nuevo producto/i.test(f.foco || ''), JSON.stringify(f))
  }

  // 2c) Barra de scroll del menú (B2): visible, crece al pasar el mouse, contraste ≥ 3:1 pulgar/pista; movimiento reducido
  if (quiere('barra')) {
    const sharp = require('sharp')
    for (const ap of APARIENCIAS) {
      await poner(page, ap, 200); await esp(500)
      const caja = await page.locator('.topnav').boundingBox()
      await page.mouse.move(5, 400); await esp(450)
      const reposo = await page.evaluate(() => { const b = document.querySelector('[data-testid=topnav-barra]'); return b ? b.getBoundingClientRect().height : 0 })
      await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2); await esp(500)
      const hover = await page.evaluate(() => { const b = document.querySelector('[data-testid=topnav-barra]'); return b ? b.getBoundingClientRect().height : 0 })
      // contraste entre pulgar y pista leído de los píxeles reales
      const g = await page.evaluate(() => { const b = document.querySelector('[data-testid=topnav-barra]').getBoundingClientRect(), p = document.querySelector('[data-testid=topnav-pulgar]').getBoundingClientRect(); const d = devicePixelRatio; return { y: (b.top + b.height / 2) * d, xp: (p.left + p.width / 2) * d, xt: (p.right + Math.min(12, (b.right - p.right) / 2)) * d } })
      const png = await page.screenshot(), im = await sharp(png).raw().toBuffer({ resolveWithObject: true }), w = im.info.width, ch = im.info.channels
      const pix = (x, y) => { const i = (Math.round(y) * w + Math.round(x)) * ch; return [im.data[i], im.data[i + 1], im.data[i + 2]] }
      const L = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) }
      const a = pix(g.xp, g.y), b = pix(g.xt, g.y), cr = (Math.max(L(a), L(b)) + 0.05) / (Math.min(L(a), L(b)) + 0.05)
      registrar('barra-menu', `${ap}: reposo ${reposo}px → hover ${hover}px, contraste pulgar/pista ${cr.toFixed(1)}:1`, reposo >= 5 && reposo <= 8 && hover >= 13 && cr >= 3, '')
    }
    await poner(page, 'transparente', 100)
    await page.emulateMedia({ reducedMotion: 'reduce' }); await esp(300)
    const rm = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.menu-item')).transitionDuration) <= 0.001)
    registrar('movimiento-reducido', 'prefers-reduced-motion elimina las transiciones', rm)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
  }

  // 3) Comandos de apariencia por el chat real (sin LLM) y «lusion» en respuestas
  if (quiere('comandos')) {
    await irA(page, 'sparkles'); await esp(1200)
    const frases = [
      ['cambia a claro', 'claro'], ['modo claro', 'claro'], ['blanco', 'claro'], ['luz', 'claro'], ['oscuro', 'oscuro'], ['modo oscuro', 'oscuro'],
      ['negro', 'oscuro'], ['dark', 'oscuro'], ['transparente', 'transparente'], ['glass', 'transparente'], ['cristal', 'transparente'], ['vidrio', 'transparente'],
      ['lusion claro', 'claro'], ['lusion oscuro', 'oscuro'], ['/tema claro', 'claro'], ['/tema oscuro', 'oscuro'], ['/tema transparente', 'transparente'],
    ]
    const etiqueta = { claro: 'Claro', oscuro: 'Oscuro', transparente: 'Transparente' }
    for (const [frase, esperado] of frases) {
      await page.evaluate(previo => window.__gym.setApariencia(previo), esperado === 'transparente' ? 'claro' : 'transparente')
      await esp(300)
      const ta = page.locator('textarea').last(); await ta.fill(frase); await ta.press('Enter'); await esp(900)
      const r = await page.evaluate(() => ({ ap: document.documentElement.getAttribute('data-apariencia'), ultimo: (document.querySelector('.ia-fila-ia:last-of-type, [class*=ia-fila-ia]:last-of-type') || {}).innerText || '', todo: document.body.innerText }))
      const ult = [...r.todo.split('\n')].filter(l => /Listo, apariencia/.test(l)).pop() || ''
      const ok = r.ap === esperado && ult.includes(`Listo, apariencia ${etiqueta[esperado]}.`) && !/lusion/i.test(ult)
      registrar('comandos', `«${frase}» → ${esperado}`, ok, ok ? '' : `attr=${r.ap} resp="${ult}"`)
    }
    const r2 = await page.locator('textarea').last().fill('/tema').then(() => page.locator('textarea').last().press('Enter')).then(() => esp(800)).then(() => page.evaluate(() => document.body.innerText))
    registrar('comandos', '/tema sin argumento muestra 3 opciones sin «lusion»', /Transparente/.test(r2) && /Oscuro/.test(r2) && /Claro/.test(r2) && !/lusion/i.test(r2.split('Apariencias:')[1] || ''))
    await poner(page, 'transparente', 100)
  }

  // 4) Persistencia a nivel de dispositivo (migración y archivo)
  if (quiere('dispositivo')) {
    await poner(page, 'oscuro', 125)
    const d = await page.evaluate(() => window.api.dispositivo.obtener())
    registrar('dispositivo', 'apariencia y tamaño guardados en el dispositivo', d.apariencia === 'oscuro' && d.tamano === 125, JSON.stringify(d))
    const mig = await page.evaluate(() => ['lusion-oscuro', 'lusion-claro', 'clasico'].map(v => window.__gym.normalizarApariencia(v)))
    registrar('dispositivo', 'migra valores anteriores (lusion-*)', mig.join() === 'oscuro,claro,transparente', mig.join())
    await poner(page, 'transparente', 100)
  }
}

// ── Informe ──────────────────────────────────────────────────────────────────────────────────────
async function escribirHojas() {
  if (!process.env.UI_HOJAS) return
  const sharp = require('sharp'); const dir = path.join(RAIZ, 'docs', 'capturas-sprint1'); fs.mkdirSync(dir, { recursive: true })
  for (const [ap, lista] of Object.entries(hojas)) {
    const W = 480, H = 270, C = 4, F = Math.ceil(lista.length / C)
    const celdas = await Promise.all(lista.map(async (x, i) => ({ input: await sharp(x.buf).resize(W, H, { fit: 'fill' }).toBuffer(), left: (i % C) * W, top: Math.floor(i / C) * H })))
    await sharp({ create: { width: W * C, height: H * F, channels: 3, background: '#808080' } }).composite(celdas).png().toFile(path.join(dir, 'hoja-' + ap + '.png'))
  }
}
function informe() {
  const por = {}
  for (const r of resultados) { const a = (por[r.area] ||= { ok: 0, mal: 0 }); r.ok ? a.ok++ : a.mal++ }
  console.log('\n=== npm run test:ui — resumen ===')
  console.log('| área | correctas | fallos |\n|---|---|---|')
  for (const [k, v] of Object.entries(por)) console.log(`| ${k} | ${v.ok} | ${v.mal} |`)
  if (Object.keys(otrosAxe).length) { console.log('\naxe, impacto moderado/leve (no bloquea):'); for (const [id, v] of Object.entries(otrosAxe)) console.log(`  - ${id} [${v.impacto}] ×${v.n} ej: ${v.ej}`) }
  const fallos = resultados.filter(r => !r.ok)
  if (fallos.length) { console.log(`\n--- ${fallos.length} fallo(s) ---`); for (const f of fallos.slice(0, 60)) console.log(`✗ [${f.area}] ${f.detalle} ${f.nota}`.slice(0, 900)); if (fallos.length > 60) console.log(`… y ${fallos.length - 60} más`) }
  else console.log('\nTodo correcto')
  fs.writeFileSync(path.join(RAIZ, 'docs', 'resultados-test-ui.json'), JSON.stringify({ fecha: new Date().toISOString(), por, fallos }, null, 1))
  return fallos.length
}

main().then(async () => { await escribirHojas(); process.exit(informe() ? 1 : 0) }).catch(e => { console.error('ERROR en test:ui:', e.message); informe(); process.exit(2) })
