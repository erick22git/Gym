// Herramienta de SOLO LECTURA: mide las diferencias históricas del kardex sobre una COPIA de dev_data (nunca la original).
// Uso: node scripts/pruebas/inv/medir-conciliacion.cjs
const L = require('./lib.cjs')
;(async () => {
  const antes = L.hashesOrigen()
  const { mod, dir } = await L.abrir({ etiqueta: 'medir' })
  const r = mod.inventario.conciliacion()
  const porTipo = {}
  for (const d of r.diferencias) { const k = d.tipos.join('+'); porTipo[k] = (porTipo[k] || 0) + 1 }
  console.log(JSON.stringify({ total_productos: r.total_productos, con_diferencias: r.con_diferencias, por_tipo: porTipo,
    eliminados: r.diferencias.filter(d => d.eliminado).length }, null, 2))
  console.log('ejemplos:', JSON.stringify(r.diferencias.slice(0, 5).map(d => ({ n: d.nombre, real: d.stock_real, kardex: d.stock_kardex, tipos: d.tipos })), null, 0))
  const { queryAll } = L.helpers(mod)
  console.log('motivos de «sin saldo inicial» (primer movimiento):', JSON.stringify(queryAll("SELECT m.motivo, COUNT(*) n FROM movimientos_stock m WHERE m.id IN (SELECT MIN(id) FROM movimientos_stock GROUP BY producto_id) AND m.stock_anterior<>0 GROUP BY m.motivo")))
  console.log('hash de dev_data intacto:', JSON.stringify(L.hashesOrigen()) === JSON.stringify(antes))
  L.limpiar(dir)
})()
