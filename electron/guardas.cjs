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
  con('inventario:ajustarStock', 'inventario.ajustar_stock', d => inv().ajustarStock(sello(d)))
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
  con('papelera:restaurarProducto', 'papelera.restaurar', id => dbm.papelera.restaurarProducto(id))
  con('papelera:eliminarPermanenteProducto', 'papelera.eliminar_permanente', id => dbm.papelera.eliminarPermanenteProducto(id))
  return G
}
