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
  const salida = execFileSync(py, ['-c', codigo], { cwd: RAIZ, env: { ...process.env, PYTHONIOENCODING: 'utf-8', GYM_OLLAMA_URL: 'http://127.0.0.1:1' }, encoding: 'utf-8', timeout: 900000, stdio: ["ignore", "pipe", "ignore"] })
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

    // Sprint 4B · Fase 1: los canales sensibles exigen la sesión del proceso principal → se inicia sesión de verdad.
    // Usuarios de la COPIA descartable: uno Cajero (para comprobar el rechazo por IPC real) y uno Administrador.
    const CLAVE_QA = 'qa-e2e-' + Math.random().toString(16).slice(2, 8)
    await api('usuarios.create', { username: 'qa_cajero', nombre_completo: 'QA Cajero', password: CLAVE_QA, rol_id: 3 })
    await api('usuarios.create', { username: 'qa_e2e', nombre_completo: 'QA E2E', password: CLAVE_QA, rol_id: 1 })
    const loginQA = async u => (await api('authUsuarios.login', u, CLAVE_QA)).ok === true
    registrar('seguridad', 'sin sesión, el proceso principal rechaza crear productos', (await api('inventario.create', { nombre: 'SinSesionE2E', stock: 1 })).sin_permiso === true)
    await loginQA('qa_cajero')
    const rc = await api('inventario.ajustarStock', { producto_id: 1, tipo: 'entrada', cantidad: 1 })
    registrar('seguridad', 'Cajero: ajustar stock por IPC real → rechazado', rc.ok === false && rc.sin_permiso === true, JSON.stringify(rc))
    registrar('seguridad', 'Cajero: anular venta por IPC real → rechazado', (await api('ventas.anular', 1, { motivo: 'x' })).sin_permiso === true)
    registrar('seguridad', 'Cajero: borrado permanente por IPC real → rechazado', (await api('papelera.eliminarPermanenteProducto', 1)).sin_permiso === true)
    registrar('seguridad', 'Administrador inicia sesión', await loginQA('qa_e2e'))

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
    // Sprint 4B · Fase 2: lo creado por la importación queda «por completar» (no se vende hasta tener precio)
    registrar('importar', 'el producto nuevo queda «por completar» y no aparece en el punto de venta', (await api('inventario.getById', rN.producto_id))?.pendiente_completar === 1 && (await api('inventario.buscarPOS', 'E2E Nuevo')).length === 0)
    registrar('importar', 'el contador «por completar» lo incluye', (await api('inventario.contarPendientes')) >= 1)
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
    await api('inventario.ajustarStock', { producto_id: A, tipo: 'salida', cantidad: 1, motivo: 'corrección', motivo_codigo: 'consumo_interno', ...U })
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

    // ── Sprint 4 · C.1: ventas que descuentan stock y ajuste manual (sin cambiar esquema ni lógica) ──
    const movsDe = async id => await api('inventario.getMovimientos', id)
    const V1 = (await api('inventario.create', { nombre: 'E2E Venta Agua', stock: 20, precio_venta: 5 })).id
    const V2 = (await api('inventario.create', { nombre: 'E2E Venta Barra', stock: 6, precio_venta: 15 })).id
    const v = await api('inventario.venderProductos', [
      { producto_id: V1, nombre_producto: 'E2E Venta Agua', cantidad: 3, precio_unitario: 5 },
      { producto_id: V2, nombre_producto: 'E2E Venta Barra', cantidad: 2, precio_unitario: 15 }], { ...U, metodo_pago: 'efectivo' })
    registrar('ventas', 'la venta se registra con el total correcto (3×5 + 2×15 = 45)', v.ok === true && v.total === 45, JSON.stringify(v))
    registrar('ventas', 'la venta descuenta el stock de cada producto (20→17 y 6→4)', (await stock(V1)) === 17 && (await stock(V2)) === 4)
    const mv = (await movsDe(V1)).find(m => m.tipo === 'venta')
    registrar('ventas', 'queda un movimiento «venta» con anterior/nuevo, venta_id y usuario', !!mv && mv.stock_anterior === 20 && mv.stock_nuevo === 17 && mv.venta_id === v.venta_id && mv.usuario_nombre === 'QA E2E', JSON.stringify(mv || {}))
    // Ajuste manual
    const a1 = await api('inventario.ajustarStock', { producto_id: V1, tipo: 'entrada', cantidad: 10, motivo: 'compra al proveedor', ...U })
    registrar('ajuste', 'entrada: 17 → 27', a1.ok && a1.stock_anterior === 17 && a1.stock_nuevo === 27 && (await stock(V1)) === 27)
    const a2 = await api('inventario.ajustarStock', { producto_id: V1, tipo: 'salida', cantidad: 4, motivo: 'merma: botellas rotas', motivo_codigo: 'merma', ...U })
    registrar('ajuste', 'salida: 27 → 23', a2.ok && a2.stock_nuevo === 23 && (await stock(V1)) === 23)
    const a3 = await api('inventario.ajustarStock', { producto_id: V1, tipo: 'ajuste', cantidad: 21, motivo: 'conteo físico', motivo_codigo: 'conteo_fisico', ...U })
    registrar('ajuste', 'ajuste (conteo): el stock pasa a 21 exacto', a3.ok && a3.stock_nuevo === 21 && (await stock(V1)) === 21)
    const m3 = await movsDe(V1)
    registrar('ajuste', 'cada ajuste queda en el kardex con motivo y usuario', ['compra al proveedor', 'merma: botellas rotas', 'conteo físico'].every(t => m3.some(m => m.motivo === t && m.usuario_nombre === 'QA E2E')))
    const sc = await api('inventario.ajustarStock', { producto_id: V1, tipo: 'salida', cantidad: 1, motivo: 'sin código', ...U })
    registrar('ajuste', 'salida sin motivo de la lista → rechazada por el canal real (Fase 8)', sc.ok === false && /motivo/i.test(sc.error || '') && (await stock(V1)) === 21, JSON.stringify(sc))
    registrar('ajuste', 'el kardex guarda el código del motivo', (await movsDe(V1)).some(m => m.motivo_codigo === 'merma'))
    const exI = await api('intercambio.exportarInventario')
    registrar('importar', 'exportar inventario por el canal real devuelve CSV con BOM', exI.ok === true && exI.texto.charCodeAt(0) === 0xFEFF, JSON.stringify(exI).slice(0, 150))
    const pvI = await api('intercambio.previsualizar', exI.texto)
    registrar('importar', 'exportar → importar = 0 cambios por el canal real', pvI.ok === true && pvI.resumen.crear === 0 && pvI.resumen.actualizar === 0, JSON.stringify(pvI.resumen) + JSON.stringify((pvI.filas || []).filter(f => f.accion === 'actualizar')))
    const malI = await api('intercambio.aplicar', ['nombre;precio_venta', 'Producto E2E inexistente;abc', ''].join(String.fromCharCode(13, 10)), { archivo: 'mal.csv' })
    registrar('importar', 'un CSV con error se rechaza completo por el canal real', malI.ok === false && (malI.resumen?.errores || 0) >= 1)
    const rv = await api('reportes.valorInventario')
    registrar('reportes', 'valor del inventario por el canal real', rv.ok === true && Number.isFinite(rv.resumen.valor_total), JSON.stringify(rv.resumen))
    const rm = await api('reportes.masVendidos', { dias: 30 })
    registrar('reportes', 'más vendidos por el canal real', rm.ok === true && Array.isArray(rm.filas))
    const rx = await api('reportes.exportar', 'abc', { dias: 30 })
    registrar('reportes', 'exportar un reporte a CSV por el canal real', rx.ok === true && rx.texto.charCodeAt(0) === 0xFEFF)
    const cb = await api('codigos.svg', 'E2E-COD-1')
    registrar('codigos', 'SVG de código de barras por el canal real', cb.ok === true && /^<svg/.test(cb.svg), JSON.stringify(cb).slice(0, 100))
    const ec = await api('inventario.create', { nombre: 'E2E Escaner', codigo: 'E2E-COD-1', stock: 3, precio_venta: 7, ...U })
    registrar('codigos', 'crear con código nuevo', ec.id > 0, JSON.stringify(ec).slice(0, 120))
    const ed = await api('inventario.create', { nombre: 'E2E Escaner 2', codigo: ' e2e-cod-1 ', stock: 1, ...U })
    registrar('codigos', 'un código repetido se rechaza por el canal real', ed.ok === false && /ya lo usa/.test(ed.error || ''), JSON.stringify(ed).slice(0, 160))
    const bc = await api('inventario.buscarPorCodigo', ' E2E-COD-1 ')
    registrar('codigos', 'el escáner encuentra el producto exacto', bc && bc.id === ec.id)
    const et = await api('etiquetas.generarPdf', { items: [{ producto_id: ec.id, copias: 2 }] })
    registrar('codigos', 'hoja de etiquetas PDF por el canal real', et.ok === true && et.etiquetas === 2 && et.base64.startsWith('JVBER'), JSON.stringify(et).slice(0, 100))
    registrar('ajuste', 'producto inexistente se rechaza sin tocar nada', (await api('inventario.ajustarStock', { producto_id: 999999, tipo: 'entrada', cantidad: 1, ...U })).ok === false)
    // Antes «hallazgos» confirmados (Sprint 4): ahora se comprueba que están corregidos (Sprint 4B · Fase 1)
    const H = (await api('inventario.create', { nombre: 'E2E Sobreventa', stock: 2, precio_venta: 10 })).id
    const nVentas0 = (await api('ventas.getAll', {})).length
    const vs = await api('inventario.venderProductos', [{ producto_id: H, nombre_producto: 'E2E Sobreventa', cantidad: 5, precio_unitario: 10 }], { ...U, metodo_pago: 'efectivo' })
    registrar('integridad', 'vender más que el stock → rechazado, sin venta ni cambio de stock', vs.ok === false && (await stock(H)) === 2 && (await api('ventas.getAll', {})).length === nVentas0, JSON.stringify(vs))
    const H2 = (await api('inventario.create', { nombre: 'E2E Anular', stock: 8, precio_venta: 10 })).id
    const vh = await api('inventario.venderProductos', [{ producto_id: H2, nombre_producto: 'E2E Anular', cantidad: 3, precio_unitario: 10 }], { ...U, metodo_pago: 'efectivo' })
    const det = (await api('ventas.getById', vh.venta_id)).detalle
    const sinMotivo = await api('ventas.anular', vh.venta_id, { lineas: [{ detalle_id: det[0].id, vuelve_a_stock: true }] })
    registrar('integridad', 'anular exige motivo', sinMotivo.ok === false && (await stock(H2)) === 5, JSON.stringify(sinMotivo))
    const an = await api('ventas.anular', vh.venta_id, { motivo: 'error de cobro', lineas: [{ detalle_id: det[0].id, vuelve_a_stock: true }] })
    registrar('integridad', 'anular una venta de productos devuelve el stock cuando se indica (5 → 8)', an.ok === true && (await stock(H2)) === 8, JSON.stringify(an))
    registrar('integridad', 'anular dos veces se rechaza', (await api('ventas.anular', vh.venta_id, { motivo: 'otra vez', lineas: [] })).ok === false)
    const as = await api('inventario.ajustarStock', { producto_id: H2, tipo: 'salida', cantidad: 50, motivo_codigo: 'merma', ...U })
    registrar('integridad', 'salida mayor que el stock → rechazada (no se corta a 0)', as.ok === false && (await stock(H2)) === 8, JSON.stringify(as))
    const mH = await movsDe(H2)
    registrar('integridad', 'el kardex de anulación cuadra (entrada «Anulación venta #N», 5→8)', mH.some(m => m.tipo === 'entrada' && m.stock_anterior === 5 && m.stock_nuevo === 8 && /Anulación venta/.test(m.motivo || '')))
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
