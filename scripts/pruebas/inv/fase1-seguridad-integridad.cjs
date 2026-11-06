// FASE 1 — seguridad e integridad: permisos en el proceso principal, anular con stock y caja, venta atómica,
// stock negativo configurable, archivar en vez de borrar. (npm run test:inv)
const L = require('./lib.cjs')
const path = require('path')

;(async () => {
  const antes = L.hashesOrigen()
  const { mod: dbm, dir } = await L.abrir({ etiqueta: 'f1' })
  const seguridad = require(path.join(L.RAIZ, 'electron/seguridad.cjs'))
  const guardas = require(path.join(L.RAIZ, 'electron/guardas.cjs'))({ dbm, seguridad })
  const { queryAll, queryOne } = L.helpers(dbm)
  const stock = id => queryOne('SELECT stock FROM productos WHERE id=?', [id]).stock
  const mov = id => queryAll('SELECT * FROM movimientos_stock WHERE producto_id=? ORDER BY id', [id])

  // Usuarios reales de prueba (hash bcrypt) para el flujo de inicio de sesión de verdad
  const rolAdmin = 1, rolEmpleado = 2, rolCajero = 3
  for (const [u, rol] of [['qa-admin', rolAdmin], ['qa-emp', rolEmpleado], ['qa-caj', rolCajero]]) {
    dbm.usuarios.create({ username: u, nombre_completo: 'QA ' + u, password: 'qa-pass-1', rol_id: rol })
  }
  const entrar = async u => { const r = dbm.usuarios.login(u, 'qa-pass-1'); seguridad.establecer(r.usuario); return r.usuario }
  const P = (n, s, pv = 10) => dbm.inventario.create({ nombre: n, stock: s, precio_venta: pv, precio_compra: 4 }).id

  L.grupo('1a · Permisos aplicados en el proceso principal')
  seguridad.limpiar()
  let r = await guardas['inventario:create']({ nombre: 'SinSesion', stock: 1 })
  L.ok('sin sesión: crear producto rechazado', r && r.ok === false && r.sin_permiso === true, JSON.stringify(r))
  const uCaj = await entrar('qa-caj')
  const pA = P('F1 Arroz', 10)
  r = await guardas['inventario:ajustarStock']({ producto_id: pA, tipo: 'entrada', cantidad: 5, motivo: 'x' })
  L.ok('Cajero: ajustarStock rechazado', r.ok === false && r.sin_permiso === true && stock(pA) === 10, JSON.stringify(r))
  r = await guardas['inventario:delete'](pA)
  L.ok('Cajero: borrar producto rechazado', r.ok === false && queryOne('SELECT eliminado FROM productos WHERE id=?', [pA]).eliminado === 0)
  r = await guardas['ventas:anular'](1, { motivo: 'x' })
  L.ok('Cajero: anular venta rechazado', r.ok === false && r.sin_permiso === true)
  r = await guardas['inventario:importarLote']({ modo: 'sumar', items: [{ accion: 'actualizar', producto_id: pA, nombre: 'F1 Arroz', cantidad: 1 }] })
  L.ok('Cajero: importar lote rechazado', r.ok === false && r.sin_permiso === true && stock(pA) === 10)
  r = await guardas['papelera:eliminarPermanenteProducto'](pA)
  L.ok('Cajero: borrado permanente rechazado', r.ok === false && r.sin_permiso === true)
  // Cajero sí puede vender (ventas.realizar) y el id de usuario falso de la pantalla se ignora
  r = await guardas['inventario:venderProductos']([{ producto_id: pA, nombre_producto: 'F1 Arroz', cantidad: 2, precio_unitario: 10 }], { usuario_id: 1, usuario_nombre: 'IMPOSTOR', metodo_pago: 'efectivo' })
  L.ok('Cajero: puede vender', r.ok === true && stock(pA) === 8, JSON.stringify(r))
  const vta = queryOne('SELECT usuario_id FROM ventas WHERE id=?', [r.venta_id])
  const mv = queryOne("SELECT usuario_id, usuario_nombre FROM movimientos_stock WHERE venta_id=?", [r.venta_id])
  L.ok('id de usuario falso desde la pantalla → ignorado (venta)', vta.usuario_id === uCaj.id, JSON.stringify(vta))
  L.ok('id/nombre falsos ignorados (kardex)', mv.usuario_id === uCaj.id && mv.usuario_nombre !== 'IMPOSTOR', JSON.stringify(mv))
  const ventaCajero = r.venta_id

  const uEmp = await entrar('qa-emp')
  r = await guardas['inventario:ajustarStock']({ producto_id: pA, tipo: 'entrada', cantidad: 5, motivo: 'reposición', usuario_id: 1, usuario_nombre: 'IMPOSTOR' })
  L.ok('Empleado: ajustarStock permitido', r.ok === true && stock(pA) === 13, JSON.stringify(r))
  const ult = mov(pA).pop()
  L.ok('Empleado: el kardex guarda al usuario de la sesión, no el que mandó la pantalla', ult.usuario_id === uEmp.id && ult.usuario_nombre !== 'IMPOSTOR', JSON.stringify(ult))
  r = await guardas['inventario:create']({ nombre: 'F1 Empleado crea', stock: 0 })
  L.ok('Empleado conserva hoy: crear producto permitido', !!r && (r.ok !== false) && !!r.id, JSON.stringify(r))
  r = await guardas['ventas:anular'](ventaCajero, { motivo: 'x', lineas: [] })
  L.ok('Empleado: anular venta sigue sin permiso (no lo tenía)', r.ok === false && r.sin_permiso === true)

  L.grupo('1b · Anular venta: por línea, motivo, una sola vez, caja')
  const uAdm = await entrar('qa-admin')
  // Caja: sesión de prueba
  dbm.caja.abrir({ monto_inicial: 100, usuario_id: uAdm.id, usuario_nombre: uAdm.nombre_completo })
  const sesion = dbm.caja.getSesionActual().id
  const pB = P('F1 Aceite', 20, 25), pC = P('F1 Harina', 20, 8)
  const v = await guardas['inventario:venderProductos']([
    { producto_id: pB, nombre_producto: 'F1 Aceite', cantidad: 3, precio_unitario: 25 },
    { producto_id: pC, nombre_producto: 'F1 Harina', cantidad: 4, precio_unitario: 8 }], { metodo_pago: 'efectivo', sesion_id: sesion })
  L.ok('venta con 2 líneas', v.ok === true && stock(pB) === 17 && stock(pC) === 16, JSON.stringify(v))
  const esperadoConVenta = dbm.caja.getResumen(sesion).efectivo_esperado
  L.cerca('caja: efectivo esperado incluye la venta (100 + 75 + 32)', esperadoConVenta, 207)
  const det = dbm.ventas.getById(v.venta_id).detalle
  r = await guardas['ventas:anular'](v.venta_id, { lineas: [{ detalle_id: det[0].id, vuelve_a_stock: true }, { detalle_id: det[1].id, vuelve_a_stock: true }] })
  L.ok('anular sin motivo → rechazado y nada cambia', r.ok === false && /motivo/i.test(r.error) && stock(pB) === 17 && queryOne('SELECT estado FROM ventas WHERE id=?', [v.venta_id]).estado === 'completada', JSON.stringify(r))
  r = await guardas['ventas:anular'](v.venta_id, { motivo: 'error de cobro', lineas: [{ detalle_id: det[0].id, vuelve_a_stock: true }] })
  L.ok('anular sin decidir todas las líneas → rechazado', r.ok === false && stock(pB) === 17, JSON.stringify(r))
  r = await guardas['ventas:anular'](v.venta_id, { motivo: 'cliente se arrepintió', lineas: [
    { detalle_id: det[0].id, vuelve_a_stock: true },
    { detalle_id: det[1].id, vuelve_a_stock: false } ] })
  L.ok('merma sin motivo de merma → rechazado', r.ok === false && stock(pC) === 16, JSON.stringify(r))
  r = await guardas['ventas:anular'](v.venta_id, { motivo: 'cliente se arrepintió', lineas: [
    { detalle_id: det[0].id, vuelve_a_stock: true },
    { detalle_id: det[1].id, vuelve_a_stock: false, motivo_merma: 'paquete abierto' } ] })
  L.ok('anular con decisión por línea → ok', r.ok === true, JSON.stringify(r))
  L.ok('línea "vuelve": stock repuesto (17→20)', stock(pB) === 20)
  L.ok('línea "no vuelve": stock sin cambio (merma)', stock(pC) === 16)
  const mB = mov(pB).pop(), mC = mov(pC).pop()
  L.ok('kardex: entrada «Anulación venta #N»', mB.tipo === 'entrada' && mB.cantidad === 3 && mB.stock_anterior === 17 && mB.stock_nuevo === 20 && mB.motivo.includes(`Anulación venta #${v.venta_id}`), JSON.stringify(mB))
  L.ok('kardex: merma con su motivo', mC.tipo === 'merma' && mC.stock_anterior === 16 && mC.stock_nuevo === 16 && mC.motivo.includes('paquete abierto'), JSON.stringify(mC))
  L.ok('venta marcada anulada con motivo y usuario', (() => { const x = queryOne('SELECT estado, motivo_anulacion, anulada_por FROM ventas WHERE id=?', [v.venta_id]); return x.estado === 'anulada' && x.motivo_anulacion === 'cliente se arrepintió' && x.anulada_por === uAdm.id })())
  r = await guardas['ventas:anular'](v.venta_id, { motivo: 'otra vez', lineas: [] })
  L.ok('anular dos veces → rechazado', r.ok === false && /anulada/i.test(r.error))
  L.ok('la segunda vez no tocó el stock', stock(pB) === 20 && stock(pC) === 16)
  const res = dbm.caja.getResumen(sesion)
  L.cerca('caja: tras anular, efectivo esperado vuelve a 100 (egreso auditado)', res.efectivo_esperado, 100)
  const eg = queryAll("SELECT * FROM caja_movimientos WHERE sesion_id=? AND tipo='egreso'", [sesion])
  L.ok('hay un egreso de 107 ligado a la venta', eg.length === 1 && eg[0].monto === 107 && /Anulación venta/.test(eg[0].concepto), JSON.stringify(eg))
  const cierre = dbm.caja.cerrar({ monto_cierre: 100, usuario_id: uAdm.id, usuario_nombre: 'QA' })
  L.ok('cierre de caja cuadra (diferencia 0)', cierre.ok === true && cierre.diferencia === 0, JSON.stringify(cierre))

  L.grupo('1c · Venta atómica y 1d · stock negativo')
  const pD = P('F1 Sal', 3), pE = P('F1 Azúcar', 10)
  const antesE = stock(pE)
  const nVentas = queryOne('SELECT COUNT(*) n FROM ventas').n, nMov = queryOne('SELECT COUNT(*) n FROM movimientos_stock').n
  r = await guardas['inventario:venderProductos']([
    { producto_id: pE, nombre_producto: 'F1 Azúcar', cantidad: 2, precio_unitario: 5 },
    { producto_id: pD, nombre_producto: 'F1 Sal', cantidad: 5, precio_unitario: 2 }], { metodo_pago: 'efectivo' })
  L.ok('vender más que el stock → rechazado con mensaje', r.ok === false && /stock/i.test(r.error), JSON.stringify(r))
  L.ok('todo o nada: ni venta, ni detalle, ni movimientos, ni stock cambiado', stock(pE) === antesE && stock(pD) === 3 &&
    queryOne('SELECT COUNT(*) n FROM ventas').n === nVentas && queryOne('SELECT COUNT(*) n FROM movimientos_stock').n === nMov)
  r = await guardas['inventario:venderProductos']([{ producto_id: 999999, nombre_producto: 'Fantasma', cantidad: 1, precio_unitario: 1 }], { metodo_pago: 'efectivo' })
  L.ok('producto inexistente → rechazado', r.ok === false)
  r = await guardas['inventario:ajustarStock']({ producto_id: pD, tipo: 'salida', cantidad: 50, motivo: 'x' })
  L.ok('salida mayor que el stock → rechazada (no se recorta a 0)', r.ok === false && stock(pD) === 3, JSON.stringify(r))
  r = await guardas['inventario:ajustarStock']({ producto_id: pD, tipo: 'ajuste', cantidad: -4, motivo: 'x' })
  L.ok('ajuste a negativo → rechazado', r.ok === false && stock(pD) === 3)
  r = await guardas['inventario:ajustarStock']({ producto_id: pD, tipo: 'entrada', cantidad: -2, motivo: 'x' })
  L.ok('entrada con cantidad negativa → rechazada', r.ok === false && stock(pD) === 3)
  L.ok('política por defecto = no permitir', dbm.inventario.getPoliticaStock() === 'no_permitir')
  r = await guardas['inventario:setPoliticaStock']('permitir_con_aviso')
  L.ok('admin cambia la política', r.ok === true && dbm.inventario.getPoliticaStock() === 'permitir_con_aviso')
  r = await guardas['inventario:venderProductos']([{ producto_id: pD, nombre_producto: 'F1 Sal', cantidad: 5, precio_unitario: 2 }], { metodo_pago: 'efectivo' })
  L.ok('con "permitir": la venta pasa y el stock queda negativo (-2)', r.ok === true && stock(pD) === -2 && !!r.aviso, JSON.stringify(r))
  const mn = mov(pD).pop()
  L.ok('kardex cuadra aun en negativo: cantidad = anterior − nuevo', mn.cantidad === mn.stock_anterior - mn.stock_nuevo && mn.stock_anterior === 3 && mn.stock_nuevo === -2, JSON.stringify(mn))
  L.ok('un valor inválido de política se rechaza', (await guardas['inventario:setPoliticaStock']('cualquiera')).ok === false)
  await entrar('qa-emp')
  r = await guardas['inventario:setPoliticaStock']('no_permitir')
  L.ok('Empleado no puede cambiar la política', r.ok === false && r.sin_permiso === true && dbm.inventario.getPoliticaStock() === 'permitir_con_aviso')
  await entrar('qa-admin'); await guardas['inventario:setPoliticaStock']('no_permitir')

  L.grupo('1e · Archivar en lugar de borrar')
  const pF = P('F1 Archivable', 5, 12)
  await guardas['inventario:venderProductos']([{ producto_id: pF, nombre_producto: 'F1 Archivable', cantidad: 1, precio_unitario: 12 }], { metodo_pago: 'efectivo' })
  await guardas['inventario:delete'](pF) // a la papelera
  r = await guardas['papelera:eliminarPermanenteProducto'](pF)
  L.ok('borrado permanente de producto con ventas/movimientos → rechazado con motivo', r.ok === false && /arch[ií]v/i.test(r.error) && !!queryOne('SELECT id FROM productos WHERE id=?', [pF]), JSON.stringify(r))
  await guardas['papelera:restaurarProducto'](pF)
  const pG = P('F1 Sin historia', 0, 1) // sin movimientos ni ventas
  await guardas['inventario:delete'](pG)
  r = await guardas['papelera:eliminarPermanenteProducto'](pG)
  L.ok('sin historia sí se puede borrar de verdad', r.ok === true && !queryOne('SELECT id FROM productos WHERE id=?', [pG]), JSON.stringify(r))
  r = await guardas['inventario:archivar'](pF)
  L.ok('archivar ok', r.ok === true && queryOne('SELECT archivado FROM productos WHERE id=?', [pF]).archivado === 1, JSON.stringify(r))
  L.ok('el buscador del punto de venta lo excluye', dbm.inventario.buscarPOS('F1 Archivable').length === 0)
  L.ok('el listado normal lo excluye', !dbm.inventario.getPaginated({ page: 1, pageSize: 500 }).data.some(p => p.id === pF))
  L.ok('el listado de archivados lo muestra', dbm.inventario.getPaginated({ page: 1, pageSize: 500, archivados: true }).data.some(p => p.id === pF))
  L.ok('conserva su historia (kardex y ventas)', mov(pF).length >= 2 && queryOne('SELECT COUNT(*) n FROM detalle_ventas_productos WHERE producto_id=?', [pF]).n === 1)
  r = await guardas['inventario:venderProductos']([{ producto_id: pF, nombre_producto: 'F1 Archivable', cantidad: 1, precio_unitario: 12 }], { metodo_pago: 'efectivo' })
  L.ok('no se puede vender un producto archivado', r.ok === false)
  r = await guardas['inventario:importarLote']({ modo: 'sumar', items: [{ accion: 'actualizar', producto_id: pF, nombre: 'F1 Archivable', cantidad: 1 }] })
  L.ok('importar sobre un archivado → rechazado (pide reactivar)', r.ok === false && /archiv/i.test(r.error))
  r = await guardas['inventario:reactivar'](pF)
  L.ok('reactivar → vuelve a venderse', r.ok === true && dbm.inventario.buscarPOS('F1 Archivable').length === 1)
  // deshacerLote con un producto creado por importación que luego se archivó
  const imp = await guardas['inventario:importarLote']({ modo: 'sumar', items: [{ accion: 'crear', nombre: 'F1 Importado', cantidad: 4 }] })
  const pI = imp.resultados[0].producto_id
  await guardas['inventario:archivar'](pI)
  r = await guardas['inventario:deshacerLote']({ items: imp.resultados })
  L.ok('deshacerLote soporta un producto archivado (lo lleva a la papelera, sin archivado)', r.ok === true && (() => { const x = queryOne('SELECT eliminado, archivado FROM productos WHERE id=?', [pI]); return x.eliminado === 1 && x.archivado === 0 })(), JSON.stringify(r))

  L.grupo('Migración v2 (esquema de la fase 1)')
  const cols = t => queryAll(`PRAGMA table_info(${t})`).map(c => c.name)
  L.ok('productos.archivado', cols('productos').includes('archivado'))
  L.ok('ventas.motivo_anulacion / anulada_por / anulada_at', ['motivo_anulacion', 'anulada_por', 'anulada_at'].every(c => cols('ventas').includes(c)))
  L.ok('Empleado conserva los permisos de la pantalla de inventario', (() => { const p = dbm.roles.getPermisos(2).filter(x => x.asignado).map(x => x.codigo); return ['inventario.crear_producto', 'inventario.editar_producto', 'inventario.eliminar_producto'].every(c => p.includes(c)) })())
  L.ok('Cajero no recibió permisos de inventario', !dbm.roles.getPermisos(3).some(x => x.asignado && /^inventario\./.test(x.codigo)))
  L.ok('Admin tiene todo', dbm.roles.getPermisos(1).every(x => x.asignado))

  L.grupo('Los datos originales no cambiaron')
  L.igual('hash de dev_data idéntico', L.hashesOrigen(), antes)
  L.limpiar(dir)
  L.fin()
})().catch(e => { console.error(e); process.exit(1) })
