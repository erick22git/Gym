// Prueba del cierre de caja (dinero). Uso: GYM_DATA_DIR=<copia descartable> node scripts/pruebas/caja-cierre.cjs
// Se niega a correr sobre dev_data. Verifica: esperado solo en efectivo, diferencia guardada, entrada de Auditoría.
const Module = require('module'); const path = require('path')
if (!process.env.GYM_DATA_DIR || /dev_data/i.test(process.env.GYM_DATA_DIR)) { console.error('Define GYM_DATA_DIR con una COPIA de la BD (nunca dev_data).'); process.exit(2) }
const orig = Module._load
Module._load = function (req, ...r) { if (req === 'electron') return { app: { isPackaged: false, getPath: () => process.env.TEMP, getVersion: () => '1.0.0', on() {}, whenReady: () => new Promise(() => {}) }, ipcMain: { handle() {}, on() {} }, safeStorage: { isEncryptionAvailable: () => false }, BrowserWindow: class {}, dialog: {}, shell: {}, session: {}, Menu: {} }; return orig.call(this, req, ...r) }
const dbm = require(path.join(__dirname, '../../electron/database.cjs'))
let fallos = 0
const ok = (c, m) => { console.log((c ? 'OK    ' : 'FALLO ') + m); if (!c) fallos++ }
const u = { usuario_id: 1, usuario_nombre: 'Prueba caja' }
function turno({ apertura, movs, contado }) {
  const c = dbm.caja
  if (c.getSesionActual()) throw new Error('hay una caja abierta en la copia')
  c.abrir({ monto_inicial: apertura, ...u })
  for (const m of movs) c.addMovimiento({ tipo: m[0], concepto: 'TEST ' + m[0], monto: m[1], metodo_pago: m[2], ...u })
  const id = c.getSesionActual().id
  const res = c.getResumen(id)
  const r = c.cerrar({ monto_cierre: contado, ...u })
  return { id, res, r }
}
;(async () => {
  await dbm.initDB(); const { queryAll } = dbm.getQueryHelpers()
  const aud = id => queryAll("SELECT detalle FROM auditoria WHERE accion='CIERRE_CAJA' AND registro_afectado_id=?", [id]).map(x => JSON.parse(x.detalle))
  // 1) apertura 100, efectivo 50, QR 30, contado 140 -> esperado 150, diferencia -10
  let t = turno({ apertura: 100, movs: [['ingreso', 50, 'efectivo'], ['ingreso', 30, 'qr']], contado: 140 })
  ok(t.res.efectivo_esperado === 150, `resumen: efectivo esperado 150 (=${t.res.efectivo_esperado})`)
  ok(t.r.monto_calculado === 150 && t.r.diferencia === -10, `cierre: esperado 150 y diferencia -10 (=${t.r.monto_calculado}, ${t.r.diferencia})`)
  let s = queryAll('SELECT monto_calculado,monto_cierre,diferencia FROM caja_sesiones WHERE id=?', [t.id])[0]
  ok(s.monto_calculado === 150 && s.monto_cierre === 140 && s.diferencia === -10, 'guardado en caja_sesiones: 150 / 140 / -10')
  let a = aud(t.id)[0]
  ok(a && a.esperado === 150 && a.contado === 140 && a.diferencia === -10 && a.por_metodo.qr === 30 && a.por_metodo.efectivo === 50, 'Auditoría CIERRE_CAJA con esperado, contado, diferencia y desglose por método')
  // 2) con egreso en efectivo: 100 + 50 + QR 30 - egreso 20 = 130; contado 130 -> 0
  t = turno({ apertura: 100, movs: [['ingreso', 50, 'efectivo'], ['ingreso', 30, 'qr'], ['egreso', 20, 'efectivo']], contado: 130 })
  ok(t.r.monto_calculado === 130 && t.r.diferencia === 0, `egreso en efectivo: esperado 130, diferencia 0 (=${t.r.monto_calculado}, ${t.r.diferencia})`)
  a = aud(t.id)[0]; ok(a && a.egresos_efectivo === 20, 'Auditoría registra el egreso en efectivo')
  // 3) sobrante: contado 205 con esperado 200 -> +5 ; tarjeta no suma
  t = turno({ apertura: 50, movs: [['ingreso', 150, 'efectivo'], ['ingreso', 99, 'tarjeta'], ['ingreso', 10, 'transferencia']], contado: 205 })
  ok(t.r.monto_calculado === 200 && t.r.diferencia === 5, `tarjeta y transferencia no suman: esperado 200, diferencia +5 (=${t.r.monto_calculado}, ${t.r.diferencia})`)
  // limpieza de las sesiones de prueba en la copia
  queryAll('SELECT 1')
  console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo correcto'); process.exit(fallos ? 1 : 0)
})().catch(e => { console.error('ERR', e); process.exit(1) })
