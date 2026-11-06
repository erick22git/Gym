// Manejadores de inventario/ventas protegidos (Sprint 4B · Fase 1).
// Cada canal IPC sensible pasa por aquí: 1) se exige el permiso de la sesión del proceso principal,
// 2) se sobrescribe el usuario (id y nombre) con el de la sesión: lo que mande la pantalla se ignora.
// Se usa desde main.cjs y desde las pruebas (sin Electron).
module.exports = function crearGuardas({ dbm, seguridad }) {
  const G = {}
  const con = (canal, permiso, fn) => {
    G[canal] = (...args) => {
      const e = permiso ? seguridad.exigir(permiso) : null
      if (e) return e
      return fn(...args)
    }
  }
  const sello = obj => ({ ...(obj || {}), ...seguridad.usuario() })
  const inv = () => dbm.inventario

  con('inventario:create', 'inventario.crear_producto', d => inv().create(sello(d)))
  con('inventario:update', 'inventario.editar_producto', (id, d) => inv().update(id, sello(d)))
  con('inventario:delete', 'inventario.eliminar_producto', id => inv().delete(id))
  con('inventario:archivar', 'inventario.eliminar_producto', id => inv().archivar(id, seguridad.usuario()))
  con('inventario:reactivar', 'inventario.eliminar_producto', id => inv().reactivar(id, seguridad.usuario()))
  con('inventario:conciliacion', 'inventario.conciliar', () => inv().conciliacion())
  con('inventario:repararConciliacion', 'inventario.conciliar', d => inv().repararConciliacion(sello(d)))
  con('inventario:getAlertas', 'inventario.ver', () => inv().getAlertas())
  // El historial mezcla precios de venta (visibles) y costos: sin «ver costos» solo se devuelven los precios de venta.
  con('inventario:getHistorialPrecios', 'inventario.ver', (id, opts) => {
    const filas = inv().getHistorialPrecios(id, opts)
    return seguridad.tiene('inventario.ver_costos') ? filas : filas.filter(x => x.campo === 'precio_venta')
  })
  // Importar / exportar CSV (Fase 9). Los costos solo se exportan/leen con «ver costos».
  const ic = () => dbm.intercambio
  const costos = () => seguridad.tiene('inventario.ver_costos')
  con('intercambio:plantilla', 'inventario.exportar', () => ({ ok: true, texto: ic().plantilla(), nombre_sugerido: 'plantilla-inventario.csv' }))
  con('intercambio:exportarInventario', 'inventario.exportar', () => ({ ok: true, texto: ic().exportarInventario({ costos: costos() }), nombre_sugerido: 'inventario.csv' }))
  con('intercambio:exportarKardex', 'inventario.exportar', f => ({ ok: true, texto: ic().exportarKardex({ ...(f || {}), costos: costos() }), nombre_sugerido: 'kardex.csv' }))
  con('intercambio:previsualizar', 'inventario.importar', texto => ic().previsualizar(texto, { costos: costos() }))
  con('intercambio:aplicar', 'inventario.importar', (texto, d) => ic().aplicar(texto, { archivo: d?.archivo, costos: costos(), ...seguridad.usuario() }))
  con('intercambio:deshacer', 'inventario.importar', id => ic().deshacer(id, seguridad.usuario()))
  con('intercambio:getImportaciones', 'inventario.importar', () => ic().getImportaciones())
  // Reportes (Fase 10): solo lectura. Los que muestran costos exigen «ver costos»; en los demás los costos se quitan sin ese permiso.
  const rep = () => dbm.reportes
  const conC = (n, perm) => con(`reportes:${n}`, perm, f => rep()[n]({ ...(f || {}), costos: seguridad.tiene('inventario.ver_costos') }))
  conC('valorInventario', 'inventario.ver_costos'); conC('margenPorCategoria', 'inventario.ver_costos')
  for (const n of ['masVendidos', 'rotacion', 'cobertura', 'stockMuerto', 'abc']) conC(n, 'inventario.ver')
  con('reportes:exportar', 'inventario.exportar', (nombre, f) => {
    if (rep().NECESITAN_COSTOS.includes(nombre)) { const e = seguridad.exigir('inventario.ver_costos'); if (e) return e }
    return rep().aCsv(nombre, { ...(f || {}), costos: seguridad.tiene('inventario.ver_costos') })
  })
  const cont = () => dbm.conteos
  con('conteos:abrir', 'inventario.conteo', d => cont().abrir(sello(d)))
  con('conteos:getAll', 'inventario.conteo', () => cont().getAll())
  con('conteos:getById', 'inventario.conteo', id => cont().getById(id, { ver_diferencias: seguridad.tiene('inventario.aprobar_ajustes') }))
  con('conteos:registrar', 'inventario.conteo', (id, items) => cont().registrar(id, items, seguridad.usuario()))
  con('conteos:cerrar', 'inventario.conteo', id => cont().cerrar(id))
  con('conteos:cancelar', 'inventario.conteo', id => cont().cancelar(id))
  con('conteos:desdeImportacion', 'inventario.conteo', d => cont().desdeImportacion(sello(d)))
  const comp = () => dbm.compras
  con('compras:crear', 'inventario.compras', d => comp().crear(sello(d)))
  con('compras:enviar', 'inventario.compras', id => comp().enviar(id, seguridad.usuario()))
  con('compras:cancelar', 'inventario.compras', (id, d) => comp().cancelar(id, sello(d)))
  con('compras:recibir', 'inventario.compras', (id, d) => comp().recibir(id, d, seguridad.usuario()))
  con('compras:registrarSimple', 'inventario.compras', d => comp().registrarSimple(sello(d), seguridad.usuario()))
  con('compras:revertirRecepcion', 'inventario.compras', id => comp().revertirRecepcion(id, seguridad.usuario()))
  con('compras:getAll', 'inventario.compras', f => comp().getAll(f))
  con('compras:getById', 'inventario.compras', id => comp().getById(id))
  con('compras:sugerirReposicion', 'inventario.compras', () => comp().sugerirReposicion())
  con('conteos:aprobar', 'inventario.aprobar_ajustes', id => cont().aprobar(id, seguridad.usuario()))
  con('conteos:revertir', 'inventario.aprobar_ajustes', id => cont().revertir(id, seguridad.usuario()))
  // desde_pantalla / omitir_aprobacion / _aprobada los fija SOLO este canal: lo que mande la pantalla se pisa.
  con('inventario:ajustarStock', 'inventario.ajustar_stock', d => inv().ajustarStock({ ...sello(d), desde_pantalla: true, omitir_aprobacion: seguridad.tiene('inventario.aprobar_ajustes'), _aprobada: false }))
  con('inventario:getMotivos', 'inventario.ver', () => inv().getMotivos())
  con('inventario:getUmbralAprobacion', 'inventario.ver', () => inv().getUmbralAprobacion())
  con('inventario:setUmbralAprobacion', 'configuracion.editar_gym', v => inv().setUmbralAprobacion(v, seguridad.usuario()))
  // Quien puede aprobar ve todas las solicitudes; los demás, solo las suyas.
  con('aprobaciones:getAll', 'inventario.ver', f => dbm.aprobaciones.getAll({ ...(f || {}), ...(seguridad.tiene('inventario.aprobar_ajustes') ? {} : { solicitante_id: seguridad.usuario().usuario_id }) }))
  con('aprobaciones:contarPendientes', 'inventario.ver', () => dbm.aprobaciones.contarPendientes())
  con('aprobaciones:aprobar', 'inventario.aprobar_ajustes', id => dbm.aprobaciones.aprobar(id, seguridad.usuario()))
  con('aprobaciones:rechazar', 'inventario.aprobar_ajustes', (id, d) => dbm.aprobaciones.rechazar(id, d, seguridad.usuario()))
  con('inventario:importarLote', 'inventario.ajustar_stock', d => inv().importarLote(sello(d)))
  con('inventario:deshacerLote', 'inventario.ajustar_stock', d => inv().deshacerLote(sello(d)))
  con('inventario:venderProductos', 'ventas.realizar', (items, meta) => inv().venderProductos(items, sello(meta)))
  con('inventario:setPoliticaStock', 'configuracion.editar_gym', v => inv().setPoliticaStock(v, seguridad.usuario()))
  con('inventario:createCategoria', 'inventario.gestionar_categorias', d => inv().createCategoria(d))
  con('inventario:updateCategoria', 'inventario.gestionar_categorias', (id, d) => inv().updateCategoria(id, d))
  con('inventario:deleteCategoria', 'inventario.gestionar_categorias', id => inv().deleteCategoria(id))
  con('inventario:createProveedor', 'inventario.gestionar_proveedores', d => inv().createProveedor(d))
  con('inventario:updateProveedor', 'inventario.gestionar_proveedores', (id, d) => inv().updateProveedor(id, d))
  con('inventario:deleteProveedor', 'inventario.gestionar_proveedores', id => inv().deleteProveedor(id))
  con('ventas:anular', 'ventas.anular', (id, opts) => dbm.ventas.anular(id, sello(opts)))
  con('ventas:devolver', 'ventas.devolver', (id, d) => dbm.ventas.devolver(id, sello(d)))
  con('ventas:devolucionesPendientesFactura', 'ventas.devolver', () => dbm.ventas.devolucionesPendientesFactura())
  con('papelera:restaurarProducto', 'papelera.restaurar', id => dbm.papelera.restaurarProducto(id))
  con('papelera:eliminarPermanenteProducto', 'papelera.eliminar_permanente', id => dbm.papelera.eliminarPermanenteProducto(id))
  return G
}
