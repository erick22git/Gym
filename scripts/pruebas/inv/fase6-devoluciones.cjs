// FASE 6 — devolución parcial de venta. (npm run test:inv)
const L = require('./lib.cjs')
const path = require('path')

;(async () => {
  const antes = L.hashesOrigen()
  const { mod: dbm, dir } = await L.abrir({ etiqueta: 'f6' })
  const seguridad = require(path.join(L.RAIZ, 'electron/seguridad.cjs'))
  const guardas = require(path.join(L.RAIZ, 'electron/guardas.cjs'))({ dbm, seguridad })
  const { queryAll, queryOne } = L.helpers(dbm)
  const inv = dbm.inventario, V = dbm.ventas
  const prod = id => queryOne('SELECT * FROM productos WHERE id=?', [id])
  const movs = id => queryAll('SELECT * FROM movimientos_stock WHERE producto_id=? ORDER BY id', [id])
  for (const [u, rol] of [['qa-admin', 1], ['qa-emp', 2], ['qa-caj', 3]]) dbm.usuarios.create({ username: u, nombre_completo: 'QA ' + u, password: 'qa-pass-1', rol_id: rol })
  const entrar = u => { const r = dbm.usuarios.login(u, 'qa-pass-1'); seguridad.establecer(r.usuario); return r.usuario }
  const adm = entrar('qa-admin')
  const U = { usuario_id: adm.id, usuario_nombre: adm.nombre_completo }
  const P = (n, s, pv, extra = {}) => inv.create({ nombre: n, stock: s, precio_venta: pv, ...extra }).id

  // Caja: se cierra cualquier sesión previa de la copia y se abre una nueva con monto inicial 50
  const prev = dbm.caja.getSesionActual()
  if (prev) dbm.caja.cerrar({ usuario_id: adm.id, usuario_nombre: adm.nombre_completo })
  const ab = dbm.caja.abrir({ usuario_id: adm.id, usuario_nombre: adm.nombre_completo, monto_inicial: 50 })
  const ses = ab.sesion_id
  const egresosDev = vid => queryAll("SELECT * FROM caja_movimientos WHERE referencia_tipo='devolucion_venta' AND referencia_id=?", [vid])
  const vender = (items, metodo = 'efectivo') => dbm.inventario.venderProductos(items, { metodo_pago: metodo, sesion_id: ses, ...U })

  const A = P('F6 A', 20, 10), B = P('F6 B', 10, 25), K = P('F6 kg', 10, 20, { permite_decimal: 1, decimales: 2, unidad_medida: 'kg' })
  dbm.compras.registrarSimple({ lineas: [{ producto_id: A, cantidad: 10, costo_unitario: 4 }], ...U })   // costo promedio de A = 4 (10 ya existentes sin costo + 10@4 → 4)

  L.grupo('Migración v7')
  const tablas = queryAll("SELECT name FROM sqlite_master WHERE type='table'").map(t => t.name)
  L.ok('tablas devoluciones y devolucion_lineas', tablas.includes('devoluciones') && tablas.includes('devolucion_lineas'))
  L.ok('versión de esquema >= 7', dbm.VERSION_ESQUEMA >= 7)
  const pd = queryOne("SELECT id FROM permisos WHERE codigo='ventas.devolver'")
  L.ok('permiso ventas.devolver existe', !!pd)
  const rolesDev = queryAll('SELECT rol_id FROM rol_permisos WHERE permiso_id=?', [pd.id]).map(x => x.rol_id).sort()
  const rolesAnu = queryAll("SELECT rp.rol_id FROM rol_permisos rp JOIN permisos p ON p.id=rp.permiso_id WHERE p.codigo='ventas.anular'").map(x => x.rol_id)
  L.igual('lo tienen Admin y quien ya podía anular ventas (nadie gana ni pierde acceso)', rolesDev, [...new Set([1, ...rolesAnu])].sort())

  L.grupo('Devolución parcial: stock, merma, kardex y caja')
  const s1 = vender([{ producto_id: A, nombre_producto: 'F6 A', cantidad: 5, precio_unitario: 10 }, { producto_id: B, nombre_producto: 'F6 B', cantidad: 2, precio_unitario: 25 }])
  L.ok('venta de 100 ok', s1.ok === true && s1.total === 100, JSON.stringify(s1))
  const det = V.getById(s1.venta_id).detalle
  const dA = det.find(d => d.producto_id === A), dB = det.find(d => d.producto_id === B)
  const stockA0 = prod(A).stock, stockB0 = prod(B).stock
  const kpi0 = V.getKPIs({ mes: new Date().toISOString().slice(0, 7) }).totalIngresos
  let r = V.devolver(s1.venta_id, { motivo: 'cliente se arrepintió', lineas: [{ detalle_id: dA.id, cantidad: 2, vuelve_a_stock: true }, { detalle_id: dB.id, cantidad: 1, vuelve_a_stock: false, motivo_merma: 'llegó dañado' }], ...U })
  L.ok('devolución parcial ok', r.ok === true, JSON.stringify(r))
  L.cerca('total devuelto = 2×10 + 1×25 = 45', r.total_devuelto, 45)
  L.ok('A vuelve al stock (+2)', prod(A).stock === stockA0 + 2)
  L.ok('B (merma) NO cambia el stock', prod(B).stock === stockB0)
  const mA = movs(A).slice(-1)[0], mB = movs(B).slice(-1)[0]
  L.ok('kardex A: entrada «Devolución venta #N» con el costo congelado de la venta', mA.tipo === 'entrada' && mA.cantidad === 2 && /Devoluci/i.test(mA.motivo) && mA.costo_unitario === dA.costo_unitario && mA.venta_id === s1.venta_id, JSON.stringify(mA))
  L.ok('kardex B: merma con su motivo, sin cambio de stock', mB.tipo === 'merma' && mB.cantidad === 1 && /dañado/.test(mB.motivo) && mB.stock_anterior === mB.stock_nuevo, JSON.stringify(mB))
  const eg = egresosDev(s1.venta_id)
  L.ok('un egreso de caja de 45 en efectivo, en la sesión abierta', eg.length === 1 && eg[0].tipo === 'egreso' && eg[0].monto === 45 && eg[0].metodo_pago === 'efectivo' && eg[0].sesion_id === ses, JSON.stringify(eg))
  L.cerca('reintegro a caja informado', r.reintegro_caja, 45)
  const g = V.getById(s1.venta_id)
  L.ok('venta: devuelto 45 y total neto 55 (el total original no se toca)', g.devuelto === 45 && g.total_neto === 55 && g.total === 100, JSON.stringify({ d: g.devuelto, n: g.total_neto, t: g.total }))
  L.ok('detalle muestra lo ya devuelto por línea', g.detalle.find(d => d.id === dA.id).devuelto === 2 && g.detalle.find(d => d.id === dB.id).devuelto === 1)
  L.ok('la venta sigue «completada»', g.estado === 'completada')
  L.cerca('el KPI de ingresos del mes baja en 45', V.getKPIs({ mes: new Date().toISOString().slice(0, 7) }).totalIngresos, kpi0 - 45)
  const lista = V.getAll({}).find(v => v.id === s1.venta_id)
  L.ok('el listado trae devuelto y total_neto', lista.devuelto === 45 && lista.total_neto === 55)

  L.grupo('Rechazos: no queda nada a medias')
  const estado = () => JSON.stringify([prod(A).stock, prod(B).stock, egresosDev(s1.venta_id).length, queryOne('SELECT COUNT(*) n FROM devoluciones').n, movs(A).length])
  const e0 = estado()
  const intento = (nombre, venta, datos) => { const x = V.devolver(venta, { ...U, ...datos }); L.ok(`rechaza ${nombre}`, x.ok === false && estado() === e0, JSON.stringify(x)) }
  intento('más de lo que queda por devolver (3 restantes, pide 4)', s1.venta_id, { motivo: 'prueba', lineas: [{ detalle_id: dA.id, cantidad: 4, vuelve_a_stock: true }] })
  intento('cantidad 0', s1.venta_id, { motivo: 'prueba', lineas: [{ detalle_id: dA.id, cantidad: 0, vuelve_a_stock: true }] })
  intento('cantidad negativa', s1.venta_id, { motivo: 'prueba', lineas: [{ detalle_id: dA.id, cantidad: -1, vuelve_a_stock: true }] })
  intento('decimal en producto entero', s1.venta_id, { motivo: 'prueba', lineas: [{ detalle_id: dA.id, cantidad: 0.5, vuelve_a_stock: true }] })
  intento('sin decidir si vuelve al stock', s1.venta_id, { motivo: 'prueba', lineas: [{ detalle_id: dA.id, cantidad: 1 }] })
  intento('merma sin motivo', s1.venta_id, { motivo: 'prueba', lineas: [{ detalle_id: dA.id, cantidad: 1, vuelve_a_stock: false }] })
  intento('sin motivo general', s1.venta_id, { motivo: '  ', lineas: [{ detalle_id: dA.id, cantidad: 1, vuelve_a_stock: true }] })
  intento('sin líneas', s1.venta_id, { motivo: 'prueba', lineas: [] })
  intento('línea de otra venta', s1.venta_id, { motivo: 'prueba', lineas: [{ detalle_id: 999999, cantidad: 1, vuelve_a_stock: true }] })
  intento('la misma línea dos veces', s1.venta_id, { motivo: 'prueba', lineas: [{ detalle_id: dA.id, cantidad: 1, vuelve_a_stock: true }, { detalle_id: dA.id, cantidad: 1, vuelve_a_stock: true }] })
  intento('venta inexistente', 999999, { motivo: 'prueba', lineas: [{ detalle_id: dA.id, cantidad: 1, vuelve_a_stock: true }] })
  intento('una buena y una mala (todo o nada)', s1.venta_id, { motivo: 'prueba', lineas: [{ detalle_id: dA.id, cantidad: 1, vuelve_a_stock: true }, { detalle_id: dB.id, cantidad: 5, vuelve_a_stock: true }] })

  L.grupo('Segunda devolución y tope')
  r = V.devolver(s1.venta_id, { motivo: 'resto de A', lineas: [{ detalle_id: dA.id, cantidad: 3, vuelve_a_stock: true }], ...U })
  L.ok('devuelve las 3 restantes de A', r.ok === true && Math.abs(r.total_devuelto - 30) < 1e-9, JSON.stringify(r))
  L.ok('ya no se puede devolver más de A', V.devolver(s1.venta_id, { motivo: 'otra vez', lineas: [{ detalle_id: dA.id, cantidad: 1, vuelve_a_stock: true }], ...U }).ok === false)
  L.cerca('neto = 100 − 45 − 30 = 25', V.getById(s1.venta_id).total_neto, 25)

  L.grupo('Producto con decimales')
  const s2 = vender([{ producto_id: K, nombre_producto: 'F6 kg', cantidad: 1.5, precio_unitario: 20 }])
  const dK = V.getById(s2.venta_id).detalle[0]
  r = V.devolver(s2.venta_id, { motivo: 'sobró', lineas: [{ detalle_id: dK.id, cantidad: 0.5, vuelve_a_stock: true }], ...U })
  L.ok('devuelve 0,5 kg → 10,00 y el stock queda exacto', r.ok === true && r.total_devuelto === 10 && prod(K).stock === 9, JSON.stringify(r) + prod(K).stock)

  L.grupo('Descuento a nivel de venta: se prorratea')
  const s3 = vender([{ producto_id: A, nombre_producto: 'F6 A', cantidad: 10, precio_unitario: 10 }])
  dbm.getQueryHelpers().run('UPDATE ventas SET total=90 WHERE id=?', [s3.venta_id])
  dbm.getQueryHelpers().run("UPDATE caja_movimientos SET monto=90 WHERE referencia_tipo='venta' AND referencia_id=?", [s3.venta_id])
  const d3 = V.getById(s3.venta_id).detalle[0]
  r = V.devolver(s3.venta_id, { motivo: 'prorrateo', lineas: [{ detalle_id: d3.id, cantidad: 5, vuelve_a_stock: true }], ...U })
  L.ok('5 de 10 con 10 % de descuento → 45 (no 50)', r.ok === true && Math.abs(r.total_devuelto - 45) < 1e-9, JSON.stringify(r))
  r = V.devolver(s3.venta_id, { motivo: 'resto', lineas: [{ detalle_id: d3.id, cantidad: 5, vuelve_a_stock: true }], ...U })
  L.ok('devolver todo suma exactamente el total de la venta (90)', r.ok === true && Math.abs(V.getById(s3.venta_id).devuelto - 90) < 1e-9, JSON.stringify(V.getById(s3.venta_id).devuelto))

  L.grupo('Anular una venta ya devuelta en parte no duplica nada')
  const s4 = vender([{ producto_id: A, nombre_producto: 'F6 A', cantidad: 4, precio_unitario: 10 }, { producto_id: B, nombre_producto: 'F6 B', cantidad: 1, precio_unitario: 25 }])
  const d4 = V.getById(s4.venta_id).detalle
  const a4 = d4.find(d => d.producto_id === A), b4 = d4.find(d => d.producto_id === B)
  V.devolver(s4.venta_id, { motivo: 'una unidad', lineas: [{ detalle_id: a4.id, cantidad: 1, vuelve_a_stock: true }], ...U })
  const sa = prod(A).stock, sb = prod(B).stock
  const an = V.anular(s4.venta_id, { motivo: 'cliente canceló el resto', lineas: [{ detalle_id: a4.id, vuelve_a_stock: true }, { detalle_id: b4.id, vuelve_a_stock: true }], ...U })
  L.ok('anular ok', an.ok === true, JSON.stringify(an))
  L.ok('A: vuelven solo las 3 que seguían vendidas (no 4)', prod(A).stock === sa + 3, `${prod(A).stock} vs ${sa + 3}`)
  L.ok('B: vuelve 1', prod(B).stock === sb + 1)
  const egS4 = queryAll("SELECT SUM(monto) m FROM caja_movimientos WHERE tipo='egreso' AND referencia_id=? AND referencia_tipo IN ('devolucion_venta','anulacion_venta')", [s4.venta_id])[0].m
  L.cerca('caja: lo devuelto + lo reintegrado al anular = lo cobrado (65)', egS4, 65)
  L.ok('no se puede devolver de una venta anulada', V.devolver(s4.venta_id, { motivo: 'prueba', lineas: [{ detalle_id: a4.id, cantidad: 1, vuelve_a_stock: true }], ...U }).ok === false)

  L.grupo('Venta con factura: NO se toca, queda pendiente')
  const s5 = vender([{ producto_id: A, nombre_producto: 'F6 A', cantidad: 2, precio_unitario: 10 }])
  dbm.getQueryHelpers().run('UPDATE ventas SET factura_id=777 WHERE id=?', [s5.venta_id])
  const facturasAntes = queryOne('SELECT COUNT(*) n FROM facturas').n
  const d5 = V.getById(s5.venta_id).detalle[0]
  r = V.devolver(s5.venta_id, { motivo: 'prueba factura', lineas: [{ detalle_id: d5.id, cantidad: 1, vuelve_a_stock: true }], ...U })
  L.ok('devuelve y avisa «factura pendiente… contador»', r.ok === true && (r.avisos || []).some(a => /factura/i.test(a) && /contador/i.test(a)), JSON.stringify(r))
  L.ok('la devolución queda marcada factura_pendiente', queryOne('SELECT factura_pendiente f FROM devoluciones WHERE id=?', [r.devolucion_id]).f === 1)
  L.igual('no se creó/modificó ninguna factura', queryOne('SELECT COUNT(*) n FROM facturas').n, facturasAntes)
  L.ok('aparece en la lista de pendientes de factura', V.devolucionesPendientesFactura().some(x => x.venta_id === s5.venta_id))

  L.grupo('Cierre de caja cuadra')
  const mov = queryAll("SELECT tipo, metodo_pago, SUM(monto) m FROM caja_movimientos WHERE sesion_id=? GROUP BY tipo, metodo_pago", [ses])
  const sum = t => mov.filter(x => x.tipo === t && (!x.metodo_pago || x.metodo_pago === 'efectivo')).reduce((s, x) => s + x.m, 0)
  const esperado = sum('apertura') + sum('ingreso') - sum('egreso')
  const cierre = dbm.caja.cerrar({ usuario_id: adm.id, usuario_nombre: adm.nombre_completo, monto_cierre: esperado })
  L.ok('cierre: esperado = apertura + ventas − devoluciones − anulaciones, diferencia 0', cierre.ok === true && Math.abs(cierre.monto_calculado - esperado) < 1e-9 && Math.abs(cierre.diferencia) < 1e-9, JSON.stringify(cierre))
  L.ok('y las devoluciones SÍ restaron (esperado < apertura + ventas)', esperado < sum('apertura') + sum('ingreso') - 1)

  L.grupo('Sin caja abierta: avisa y no inventa el egreso')
  const ab2 = dbm.caja.abrir({ usuario_id: adm.id, usuario_nombre: adm.nombre_completo, monto_inicial: 0 })
  const s6 = dbm.inventario.venderProductos([{ producto_id: A, nombre_producto: 'F6 A', cantidad: 1, precio_unitario: 10 }], { metodo_pago: 'efectivo', sesion_id: ab2.sesion_id, ...U })
  dbm.caja.cerrar({ usuario_id: adm.id, usuario_nombre: adm.nombre_completo })
  const d6 = V.getById(s6.venta_id).detalle[0]
  r = V.devolver(s6.venta_id, { motivo: 'sin caja', lineas: [{ detalle_id: d6.id, cantidad: 1, vuelve_a_stock: true }], ...U })
  L.ok('devuelve igual y avisa que el reintegro no se registró', r.ok === true && r.reintegro_caja === 0 && (r.avisos || []).some(a => /caja/i.test(a)), JSON.stringify(r))
  L.igual('sin egreso en caja', egresosDev(s6.venta_id).length, 0)

  L.grupo('Seguridad y auditoría')
  const sinPerm = [2, 3].find(rol => !rolesDev.includes(rol))
  if (sinPerm) {
    entrar(sinPerm === 2 ? 'qa-emp' : 'qa-caj')
    const x = guardas['ventas:devolver'](s1.venta_id, { motivo: 'x', lineas: [] })
    L.ok('rol sin permiso → rechazado por el proceso principal', x.ok === false && x.sin_permiso === true, JSON.stringify(x))
    entrar('qa-admin')
  } else L.ok('(todos los roles tienen permiso)', true)
  const s7 = vender([{ producto_id: A, nombre_producto: 'F6 A', cantidad: 1, precio_unitario: 10 }])
  dbm.caja.abrir({ usuario_id: adm.id, usuario_nombre: adm.nombre_completo, monto_inicial: 0 })
  const d7 = V.getById(s7.venta_id).detalle[0]
  const gx = guardas['ventas:devolver'](s7.venta_id, { motivo: 'por canal', lineas: [{ detalle_id: d7.id, cantidad: 1, vuelve_a_stock: true }], usuario_id: 999, usuario_nombre: 'Impostor' })
  L.ok('devolución por el canal protegido ok', gx.ok === true, JSON.stringify(gx))
  const dv = queryOne('SELECT usuario_id, usuario_nombre FROM devoluciones WHERE id=?', [gx.devolucion_id])
  L.ok('usuario = el de la sesión, no el de la pantalla', dv.usuario_id === adm.id && dv.usuario_nombre !== 'Impostor', JSON.stringify(dv))
  L.ok('auditoría DEVOLUCION_VENTA', queryAll("SELECT id FROM auditoria WHERE accion='DEVOLUCION_VENTA'").length >= 5)

  L.grupo('Integridad')
  L.igual('kardex cuadra con el stock', inv.conciliacion().diferencias.filter(d => [A, B, K].includes(d.producto_id)).length, 0)
  const tc = JSON.stringify(dbm.respaldosDB.exportarTodo())
  L.ok('las tablas de devoluciones entran en los respaldos', /devolucion_lineas/.test(tc) && /"devoluciones"/.test(tc))
  L.igual('hash de dev_data', L.hashesOrigen(), antes)
  L.limpiar(dir)
  L.fin()
})().catch(e => { console.error(e); process.exit(1) })
