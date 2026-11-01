// E2E del flujo de importación por IA (npm run test:e2e-ia). Electron REAL por CDP sobre una COPIA descartable de la BD (nunca dev_data).
// Recorre por la capa de datos real (IPC → electron/database.cjs): importar (sumar y reemplazar) → antes/después → auditoría →
// deshacer (se rechaza si el stock cambió) → deshacer ok → restaurar de la papelera → no se puede deshacer dos veces.
// Duplicados dentro del archivo: lee excel_03 con el parser real y aplica «sumar» y «dejar uno».
// NO maneja el asistente visual de Importar (esa pantalla se cubre con test:ui); sí prueba las reglas que protegen el stock.
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
const PUERTO_CDP = 9334
const esp = ms => new Promise(r => setTimeout(r, ms))
const resultados = []
const registrar = (area, detalle, ok, nota = '') => resultados.push({ area, detalle, ok, nota })
const NL = String.fromCharCode(10)

// ── Preparación: copia de la BD (mismo mecanismo que ui-auto.mjs; no se toca dev_data) ──
function preparar() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-e2e-'))
  const datos = path.join(dir, 'datos'); fs.mkdirSync(datos)
  for (const f of ['urbanfitness.db', 'urbanfitness.db.hash', 'urbanfitness.db.sha256']) {
    const o = path.join(RAIZ, 'dev_data', f); if (fs.existsSync(o)) fs.copyFileSync(o, path.join(datos, f))
  }
  return { dir, datos }
}
const vivo = url => new Promise(r => http.get(url, res => { res.resume(); r(true) }).on('error', () => r(false)))

// ── Duplicados del archivo: parser real de producción sobre el Excel sintético con duplicados ──
function leerDuplicados() {
  const py = path.join(RAIZ, 'venv-ocr/Scripts/python.exe')
  const codigo = ['import sys,json', "sys.path.insert(0,'scripts')", 'import ocr_service as s',
    "r=s.procesar_excel_archivo(r'datos-evaluacion/sinteticos/excel_03.xlsx')", "print('@@'+json.dumps(r,ensure_ascii=False))"].join(NL)
  const salida = execFileSync(py, ['-c', codigo], { cwd: RAIZ, env: { ...process.env, PYTHONIOENCODING: 'utf-8', GYM_OLLAMA_URL: 'http://127.0.0.1:1' }, encoding: 'utf-8', timeout: 240000, stdio: ['ignore', 'pipe', 'ignore'] })
  return JSON.parse(salida.split(NL).find(l => l.startsWith('@@')).slice(2))
}

async function principal() {
  const { dir, datos } = preparar()
  const electronBin = require(path.join(RAIZ, 'node_modules/electron'))
  let vite = null
  if (!(await vivo('http://localhost:5173/'))) {
    vite = spawn(process.execPath, [path.join(RAIZ, 'node_modules/vite/bin/vite.js')], { cwd: RAIZ, stdio: 'ignore' })
    for (let i = 0; i < 60 && !(await vivo('http://localhost:5173/')); i++) await esp(1000)
  }
  const app = spawn(electronBin, ['.', `--remote-debugging-port=${PUERTO_CDP}`, `--user-data-dir=${path.join(dir, 'userdata')}`],
    { cwd: RAIZ, env: { ...process.env, GYM_DATA_DIR: datos, NODE_ENV: 'development' }, stdio: 'ignore' })
  let browser
  try {
    for (let i = 0; i < 60 && !browser; i++) { try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${PUERTO_CDP}`) } catch { await esp(1000) } }
    if (!browser) throw new Error('No se pudo conectar a la app por CDP')
    const ctx = browser.contexts()[0]
    let page = null
    for (let i = 0; i < 30 && !page; i++) { page = ctx.pages().find(p => p.url().startsWith('http://localhost:5173')); if (!page) await esp(1000) }
    await page.waitForFunction(() => !!(window.api && window.api.inventario && window.api.inventario.importarLote), null, { timeout: 90000 })
    const api = (ruta, ...args) => page.evaluate(([r, a]) => r.split('.').reduce((o, k) => o[k], window.api)(...a), [ruta, args])
    const stock = async id => (await api('inventario.getById', id))?.stock
    const U = { usuario_id: null, usuario_nombre: 'QA E2E' }

    // Productos de prueba
    const A = (await api('inventario.create', { nombre: 'E2E Arroz', stock: 10 })).id
    const B = (await api('inventario.create', { nombre: 'E2E Aceite', stock: 5 })).id
    const aud = (await api('iaAuditoria.crear', { ...U, archivos: ['e2e.xlsx'], crudo: {}, resultado: 'pendiente' })).id

    // 1) SUMAR + producto nuevo: antes/después coherente con la vista previa (anterior + archivo)
    const prevA = 10 + 4
    const r1 = await api('inventario.importarLote', { ...U, modo: 'sumar', items: [
      { accion: 'actualizar', producto_id: A, nombre: 'E2E Arroz', cantidad: 4 }, { accion: 'crear', nombre: 'E2E Nuevo', cantidad: 7 }] })
    registrar('importar', 'sumar: la importación se aplica', r1.ok === true, r1.error || '')
    const rA = r1.resultados?.find(x => x.producto_id === A), rN = r1.resultados?.find(x => x.accion === 'crear')
    registrar('importar', 'sumar: antes 10 → después 14 (igual a la vista previa)', rA?.stock_anterior === 10 && rA?.stock_nuevo === prevA && (await stock(A)) === prevA)
    registrar('importar', 'producto nuevo creado con stock 7', !!rN && (await stock(rN.producto_id)) === 7)
    // 2) REEMPLAZAR
    const r2 = await api('inventario.importarLote', { ...U, modo: 'reemplazar', items: [{ accion: 'actualizar', producto_id: B, nombre: 'E2E Aceite', cantidad: 3 }] })
    const rB = r2.resultados?.[0]
    registrar('importar', 'reemplazar: antes 5 → después 3', r2.ok && rB?.stock_anterior === 5 && rB?.stock_nuevo === 3 && (await stock(B)) === 3)
    // 3) Validaciones que no deben tocar nada
    const antesA = await stock(A)
    const rMalo = await api('inventario.importarLote', { ...U, modo: 'sumar', items: [{ accion: 'actualizar', producto_id: A, nombre: 'E2E Arroz', cantidad: 2 }, { accion: 'crear', nombre: 'X', cantidad: 2.5 }] })
    registrar('importar', 'una cantidad decimal rechaza TODO el lote (todo o nada)', rMalo.ok === false && (await stock(A)) === antesA, rMalo.error || '')
    const rSinModo = await api('inventario.importarLote', { ...U, items: [{ accion: 'actualizar', producto_id: A, nombre: 'E2E Arroz', cantidad: 2 }] })
    registrar('importar', 'actualizar sin elegir sumar/reemplazar se rechaza', rSinModo.ok === false && (await stock(A)) === antesA)
    // 4) Auditoría
    await api('iaAuditoria.actualizar', aud, { resultado: 'agregado', final: r1.resultados })
    // 5) Deshacer se rechaza si el stock cambió después
    await api('inventario.ajustarStock', { producto_id: A, tipo: 'entrada', cantidad: 1, motivo: 'venta simulada', ...U })
    const dRech = await api('inventario.deshacerLote', { ...U, items: r1.resultados, auditoria_id: aud })
    registrar('deshacer', 'se rechaza si el stock cambió después de importar', dRech.ok === false && /cambió/.test(dRech.error || ''), dRech.error || '')
    registrar('deshacer', 'el rechazo no toca ningún producto (todo o nada)', (await stock(A)) === prevA + 1 && (await stock(rN.producto_id)) === 7)
    await api('inventario.ajustarStock', { producto_id: A, tipo: 'salida', cantidad: 1, motivo: 'corrección', ...U })
    // 6) Deshacer ok
    const dOk = await api('inventario.deshacerLote', { ...U, items: r1.resultados, auditoria_id: aud })
    registrar('deshacer', 'deshacer funciona cuando el stock no cambió', dOk.ok === true, dOk.error || '')
    registrar('deshacer', 'el producto existente vuelve a su stock anterior (10)', (await stock(A)) === 10)
    const enPapelera = (await api('papelera.getProductos')).some(p => p.id === rN.producto_id)
    registrar('deshacer', 'el producto creado por la importación va a la papelera', enPapelera)
    const filaAud = (await api('iaAuditoria.getAll', {})).find(f => f.id === aud)
    registrar('auditoria', 'la fila de auditoría queda «deshecho»', filaAud?.resultado === 'deshecho', String(filaAud?.resultado))
    const movs = await api('inventario.getAllMovimientos')
    registrar('auditoria', 'hay movimientos «Importación IA» y «Deshacer importación IA»', movs.some(m => /^Importación IA/.test(m.motivo || '')) && movs.some(m => /^Deshacer importación IA/.test(m.motivo || '')))
    // 7) No se puede deshacer dos veces
    const d2 = await api('inventario.deshacerLote', { ...U, items: r1.resultados, auditoria_id: aud })
    registrar('deshacer', 'un lote ya restaurado no se puede deshacer dos veces', d2.ok === false && /ya fue restaurado/.test(d2.error || ''), d2.error || '')
    // 8) Restaurar de la papelera
    const rest = await api('papelera.restaurarProducto', rN.producto_id)
    registrar('restaurar', 'restaurar el producto desde la papelera', rest.ok === true && (await api('inventario.getById', rN.producto_id))?.eliminado !== 1)

    // ── Duplicados dentro del archivo (excel_03) ──
    const doc = leerDuplicados()
    const dup = (doc.requiere_revision || []).filter(r => r.motivo === 'duplicado_en_archivo')
    registrar('duplicados', 'el parser marca los duplicados del archivo para revisión (no los fusiona ni los deja pasar)', dup.length >= 1, `${dup.length} grupo(s)`)
    const nombres = dup.map(d => String(d.nombre_sugerido).toLowerCase())
    registrar('duplicados', 'ningún duplicado queda además en «listos»', (doc.resueltos || []).every(r => !nombres.includes(String(r.nombre).toLowerCase())))
    registrar('duplicados', 'cada grupo ofrece las opciones sumar y dejar uno', dup.length > 0 && dup.every(d => d.opciones && 'sumar' in d.opciones && 'dejar_uno' in d.opciones))
    if (dup.length) {
      const d = dup[0]
      const C = (await api('inventario.create', { nombre: 'E2E Dup Sumar', stock: 2 })).id
      const D = (await api('inventario.create', { nombre: 'E2E Dup Uno', stock: 2 })).id
      const rs = await api('inventario.importarLote', { ...U, modo: 'sumar', items: [{ accion: 'actualizar', producto_id: C, nombre: 'E2E Dup Sumar', cantidad: d.opciones.sumar }] })
      registrar('duplicados', `opción «sumar» (${d.opciones.sumar}) suma las dos cantidades al stock`, rs.ok && (await stock(C)) === 2 + d.opciones.sumar)
      const ru = await api('inventario.importarLote', { ...U, modo: 'sumar', items: [{ accion: 'actualizar', producto_id: D, nombre: 'E2E Dup Uno', cantidad: d.opciones.dejar_uno }] })
      registrar('duplicados', `opción «dejar uno» (${d.opciones.dejar_uno}) suma solo una cantidad`, ru.ok && (await stock(D)) === 2 + d.opciones.dejar_uno)
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

try { await principal() } catch (e) { registrar('e2e', 'ejecución', false, String(e.message || e).slice(0, 400)) }
const fallos = resultados.filter(r => !r.ok)
const porArea = {}
for (const r of resultados) { porArea[r.area] ||= [0, 0]; porArea[r.area][r.ok ? 0 : 1]++ }
console.log('=== npm run test:e2e-ia — resumen ===')
console.log('| área | correctas | fallos |' + NL + '|---|---|---|')
for (const [a, [ok, ko]] of Object.entries(porArea)) console.log(`| ${a} | ${ok} | ${ko} |`)
if (fallos.length) { console.log(`--- ${fallos.length} fallo(s) ---`); for (const f of fallos) console.log(`✗ [${f.area}] ${f.detalle}${f.nota ? ' → ' + f.nota : ''}`) } else console.log('Todo correcto')
process.exit(fallos.length ? 1 : 0)
