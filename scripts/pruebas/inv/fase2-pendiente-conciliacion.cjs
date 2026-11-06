// FASE 2 — producto «pendiente de completar» + conciliación del kardex (delta, continuidad, reparación guiada). (npm run test:inv)
const L = require('./lib.cjs')
const path = require('path')

;(async () => {
  const antes = L.hashesOrigen()
  const { mod: dbm, dir } = await L.abrir({ etiqueta: 'f2' })
  const seguridad = require(path.join(L.RAIZ, 'electron/seguridad.cjs'))
  const guardas = require(path.join(L.RAIZ, 'electron/guardas.cjs'))({ dbm, seguridad })
  const { queryAll, queryOne } = L.helpers(dbm)
  const stock = id => queryOne('SELECT stock FROM productos WHERE id=?', [id]).stock
  for (const [u, rol] of [['qa-admin', 1], ['qa-emp', 2]]) dbm.usuarios.create({ username: u, nombre_completo: 'QA ' + u, password: 'qa-pass-1', rol_id: rol })
  const entrar = u => { const r = dbm.usuarios.login(u, 'qa-pass-1'); seguridad.establecer(r.usuario); return r.usuario }
  const adm = entrar('qa-admin')

  L.grupo('Migración v3: columnas, delta rellenado y disparador')
  const cols = t => queryAll(`PRAGMA table_info(${t})`).map(c => c.name)
  L.ok('productos.pendiente_completar', cols('productos').includes('pendiente_completar'))
  L.ok('movimientos_stock.delta y es_conciliacion', cols('movimientos_stock').includes('delta') && cols('movimientos_stock').includes('es_conciliacion'))
  const malos = queryOne('SELECT COUNT(*) n FROM movimientos_stock WHERE stock_anterior IS NOT NULL AND stock_nuevo IS NOT NULL AND (delta IS NULL OR ABS(delta - (stock_nuevo - stock_anterior)) > 1e-9)').n
  L.ok('delta histórico = stock_nuevo − stock_anterior en TODAS las filas existentes', malos === 0, `${malos} filas mal`)
  const pA = dbm.inventario.create({ nombre: 'F2 Base', stock: 10, precio_venta: 5 }).id
  dbm.inventario.ajustarStock({ producto_id: pA, tipo: 'salida', cantidad: 3 })
  dbm.inventario.ajustarStock({ producto_id: pA, tipo: 'ajuste', cantidad: 20 })
  const dels = queryAll('SELECT tipo, delta FROM movimientos_stock WHERE producto_id=? ORDER BY id', [pA]).map(m => m.delta)
  L.igual('movimientos nuevos: delta calculado al escribir (+10, −3, +13)', dels, [10, -3, 13])

  L.grupo('2a · Producto «pendiente de completar»')
  const imp = dbm.inventario.importarLote({ modo: 'sumar', items: [{ accion: 'crear', nombre: 'F2 Importado', cantidad: 6 }] })
  const pI = imp.resultados[0].producto_id
  L.ok('importar crea el producto como pendiente', queryOne('SELECT pendiente_completar p, precio_venta v FROM productos WHERE id=?', [pI]).p === 1)
  L.ok('un producto creado a mano NO queda pendiente', queryOne('SELECT pendiente_completar p FROM productos WHERE id=?', [pA]).p === 0)
  L.ok('no aparece en el punto de venta', dbm.inventario.buscarPOS('F2 Importado').length === 0)
  const nVentas = queryOne('SELECT COUNT(*) n FROM ventas').n
  let r = await guardas['inventario:venderProductos']([{ producto_id: pI, nombre_producto: 'F2 Importado', cantidad: 1, precio_unitario: 0 }], { metodo_pago: 'efectivo' })
  L.ok('no se puede vender (pide completar el precio)', r.ok === false && /precio|completar/i.test(r.error) && stock(pI) === 6 && queryOne('SELECT COUNT(*) n FROM ventas').n === nVentas, JSON.stringify(r))
  L.ok('el contador «por completar» cuenta 1 más', dbm.inventario.contarPendientes() >= 1 && dbm.inventario.getPaginated({ page: 1, pageSize: 500, pendientes: true }).data.some(p => p.id === pI))
  const antesPend = dbm.inventario.contarPendientes()
  const prod = dbm.inventario.getById(pI)
  await guardas['inventario:update'](pI, { ...prod, precio_venta: 0 })
  L.ok('guardar con precio 0 lo mantiene pendiente', queryOne('SELECT pendiente_completar p FROM productos WHERE id=?', [pI]).p === 1)
  await guardas['inventario:update'](pI, { ...prod, precio_venta: 12.5 })
  L.ok('al poner precio de venta > 0 deja de ser pendiente', queryOne('SELECT pendiente_completar p FROM productos WHERE id=?', [pI]).p === 0 && dbm.inventario.contarPendientes() === antesPend - 1)
  L.ok('y ya aparece en el punto de venta', dbm.inventario.buscarPOS('F2 Importado').length === 1)
  r = await guardas['inventario:venderProductos']([{ producto_id: pI, nombre_producto: 'F2 Importado', cantidad: 2, precio_unitario: 12.5 }], { metodo_pago: 'efectivo' })
  L.ok('y se puede vender', r.ok === true && stock(pI) === 4, JSON.stringify(r))
  // Actualizar un producto existente por importación NO lo marca pendiente
  dbm.inventario.importarLote({ modo: 'sumar', items: [{ accion: 'actualizar', producto_id: pA, nombre: 'F2 Base', cantidad: 1 }] })
  L.ok('importar sobre un producto existente no lo marca pendiente', queryOne('SELECT pendiente_completar p FROM productos WHERE id=?', [pA]).p === 0)

  L.grupo('2b · Conciliación del kardex')
  // Medición sobre los datos de la copia ANTES de sembrar nada (se registra en el informe)
  const base0 = dbm.inventario.conciliacion()
  console.log(`  ℹ diferencias históricas en la copia de datos de prueba (antes de sembrar): ${base0.con_diferencias} de ${base0.total_productos} productos`)
  const idsBase = new Set(base0.diferencias.map(d => d.producto_id))
  L.ok('el reporte corre y devuelve un número', Number.isInteger(base0.con_diferencias) && Array.isArray(base0.diferencias))
  L.ok('los productos sanos creados en esta prueba no tienen diferencias', ![pA, pI].some(id => idsBase.has(id)))

  const pB = dbm.inventario.create({ nombre: 'F2 Sana', stock: 8, precio_venta: 3 }).id
  dbm.inventario.venderProductos([{ producto_id: pB, nombre_producto: 'F2 Sana', cantidad: 2, precio_unitario: 3 }], { metodo_pago: 'efectivo' })
  // Sembrar 3 discrepancias a propósito (UPDATE/DELETE directos, como haría una edición externa o un error antiguo)
  const pX = dbm.inventario.create({ nombre: 'F2 StockEditado', stock: 10, precio_venta: 1 }).id
  const { run } = dbm.getQueryHelpers()
  run('UPDATE productos SET stock=14 WHERE id=?', [pX])                                   // stock distinto del kardex
  const pY = dbm.inventario.create({ nombre: 'F2 CadenaRota', stock: 5, precio_venta: 1 }).id
  dbm.inventario.ajustarStock({ producto_id: pY, tipo: 'entrada', cantidad: 5 })
  dbm.inventario.ajustarStock({ producto_id: pY, tipo: 'salida', cantidad: 2 })
  const medio = queryAll('SELECT id FROM movimientos_stock WHERE producto_id=? ORDER BY id', [pY])[1].id
  run('DELETE FROM movimientos_stock WHERE id=?', [medio])                                  // falta un movimiento en medio
  const pZ = dbm.inventario.create({ nombre: 'F2 SinKardex', stock: 0, precio_venta: 1 }).id
  run('UPDATE productos SET stock=7 WHERE id=?', [pZ])                                      // stock sin ningún movimiento
  const c1 = dbm.inventario.conciliacion()
  const dif = id => c1.diferencias.find(d => d.producto_id === id)
  L.ok('detecta el stock editado a mano (14 vs kardex 10)', !!dif(pX) && dif(pX).stock_real === 14 && dif(pX).stock_kardex === 10, JSON.stringify(dif(pX)))
  L.ok('detecta la cadena rota y señala el primer movimiento que la rompe', !!dif(pY) && !!dif(pY).primer_movimiento_roto && dif(pY).tipos.includes('cadena_rota'), JSON.stringify(dif(pY)))
  L.ok('detecta stock sin ningún movimiento', !!dif(pZ) && dif(pZ).stock_real === 7 && dif(pZ).stock_kardex === 0, JSON.stringify(dif(pZ)))
  L.ok('la BD sana no genera falsos positivos (producto de venta normal)', !dif(pB))
  L.ok('el reporte es de solo lectura (no cambió ningún stock)', stock(pX) === 14 && stock(pZ) === 7)

  L.grupo('2b · Reparación guiada: con permiso, auditada, nunca silenciosa')
  entrar('qa-emp')
  r = await guardas['inventario:repararConciliacion']({ producto_id: pX, motivo: 'conteo' })
  L.ok('Empleado: reparar rechazado (no tiene el permiso)', r.ok === false && r.sin_permiso === true && stock(pX) === 14)
  r = await guardas['inventario:conciliacion']()
  L.ok('Empleado: ni siquiera puede pedir el reporte', r.ok === false && r.sin_permiso === true)
  entrar('qa-admin')
  r = await guardas['inventario:repararConciliacion']({ producto_id: pX })
  L.ok('reparar sin motivo → rechazado', r.ok === false && /motivo/i.test(r.error))
  r = await guardas['inventario:repararConciliacion']({ producto_id: pX, motivo: 'Se contó en físico: hay 14' })
  L.ok('reparar con motivo → ok', r.ok === true, JSON.stringify(r))
  const movC = queryAll('SELECT * FROM movimientos_stock WHERE producto_id=? ORDER BY id DESC LIMIT 1', [pX])[0]
  L.ok('deja un movimiento de ajuste «Conciliación» con el motivo y el usuario', movC.tipo === 'ajuste' && movC.es_conciliacion === 1 && /Conciliación/.test(movC.motivo) && /conté|contó/.test(movC.motivo) && movC.usuario_id === adm.id, JSON.stringify(movC))
  L.ok('no cambia el stock real (14) y registra anterior=10 → nuevo=14', stock(pX) === 14 && movC.stock_anterior === 10 && movC.stock_nuevo === 14 && movC.delta === 4)
  for (const id of [pY, pZ]) await guardas['inventario:repararConciliacion']({ producto_id: id, motivo: 'regularización' })
  const c2 = dbm.inventario.conciliacion()
  L.ok('tras reparar, los 3 productos sembrados ya no tienen diferencias', ![pX, pY, pZ].some(id => c2.diferencias.some(d => d.producto_id === id)), JSON.stringify(c2.diferencias.filter(d => [pX, pY, pZ].includes(d.producto_id))))
  L.ok('las diferencias históricas de la copia siguen ahí (la reparación no tocó otros productos)', c2.con_diferencias === base0.con_diferencias, `${c2.con_diferencias} vs ${base0.con_diferencias}`)
  r = await guardas['inventario:repararConciliacion']({ producto_id: pX, motivo: 'otra vez' })
  L.ok('reparar un producto sin diferencias → rechazado', r.ok === false)
  const aud = queryOne("SELECT COUNT(*) n FROM auditoria WHERE accion='CONCILIAR_KARDEX'").n
  L.ok('cada reparación queda en auditoría', aud === 3, String(aud))
  // La cadena sigue correcta después de movimientos posteriores a la conciliación
  dbm.inventario.ajustarStock({ producto_id: pY, tipo: 'entrada', cantidad: 1 })
  L.ok('movimientos posteriores a la conciliación mantienen la cadena sana', !dbm.inventario.conciliacion().diferencias.some(d => d.producto_id === pY))

  L.grupo('2b · Causa de las diferencias históricas: deshacer una importación que creó productos')
  const imp2 = dbm.inventario.importarLote({ modo: 'sumar', items: [{ accion: 'crear', nombre: 'F2 CreadoYDeshecho', cantidad: 9 }] })
  const pD = imp2.resultados[0].producto_id
  L.ok('deshacer la creación', dbm.inventario.deshacerLote({ items: imp2.resultados }).ok === true)
  L.ok('el producto en la papelera queda con stock 0 (igual que su movimiento «salida → 0»)', stock(pD) === 0)
  L.ok('y el kardex cuadra: sin diferencias para ese producto', !dbm.inventario.conciliacion().diferencias.some(d => d.producto_id === pD))

  L.grupo('Los datos originales no cambiaron')
  L.igual('hash de dev_data idéntico', L.hashesOrigen(), antes)
  L.limpiar(dir)
  L.fin()
})().catch(e => { console.error(e); process.exit(1) })
