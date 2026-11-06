// FASE 3 — inventario físico guiado: conteo ciego, diferencias, aprobación con permiso, ajuste auditado, cancelar, revertir. (npm run test:inv)
const L = require('./lib.cjs')
const path = require('path')

;(async () => {
  const antes = L.hashesOrigen()
  const { mod: dbm, dir } = await L.abrir({ etiqueta: 'f3' })
  const seguridad = require(path.join(L.RAIZ, 'electron/seguridad.cjs'))
  const guardas = require(path.join(L.RAIZ, 'electron/guardas.cjs'))({ dbm, seguridad })
  const { queryAll, queryOne } = L.helpers(dbm)
  const stock = id => queryOne('SELECT stock FROM productos WHERE id=?', [id]).stock
  const movs = id => queryAll('SELECT * FROM movimientos_stock WHERE producto_id=? ORDER BY id', [id])
  for (const [u, rol] of [['qa-admin', 1], ['qa-emp', 2], ['qa-caj', 3]]) dbm.usuarios.create({ username: u, nombre_completo: 'QA ' + u, password: 'qa-pass-1', rol_id: rol })
  const entrar = u => { const r = dbm.usuarios.login(u, 'qa-pass-1'); seguridad.establecer(r.usuario); return r.usuario }
  const adm = entrar('qa-admin')
  const cat = dbm.inventario.createCategoria({ nombre: 'F3 Cat', descripcion: '', color: 'x' })
  const P = (n, s, extra = {}) => dbm.inventario.create({ nombre: n, stock: s, precio_venta: 10, categoria_id: cat.id ?? null, ...extra }).id
  const idCat = queryOne("SELECT id FROM categorias_productos WHERE nombre='F3 Cat'").id
  const A = P('F3 A', 10), B = P('F3 B', 5), C = P('F3 C', 7), D = P('F3 D', 20), E = P('F3 E', 20)
  for (const id of [A, B, C, D, E]) dbm.getQueryHelpers().run('UPDATE productos SET categoria_id=? WHERE id=?', [idCat, id])

  L.grupo('Migración v4: tablas y respaldo')
  const tablas = queryAll("SELECT name FROM sqlite_master WHERE type='table'").map(t => t.name)
  L.ok('tablas conteos y conteo_lineas', tablas.includes('conteos') && tablas.includes('conteo_lineas'))
  L.ok('movimientos_stock.conteo_id', queryAll('PRAGMA table_info(movimientos_stock)').some(c => c.name === 'conteo_id'))
  L.ok('las tablas nuevas entran en el respaldo exportable', 'conteos' in dbm.respaldosDB.exportarTodo().tablas && 'conteo_lineas' in dbm.respaldosDB.exportarTodo().tablas)
  L.ok('permisos nuevos: Empleado puede contar, solo Admin aprueba', (() => {
    const pe = dbm.roles.getPermisos(2).filter(x => x.asignado).map(x => x.codigo), pa = dbm.roles.getPermisos(1).filter(x => x.asignado).map(x => x.codigo)
    return pe.includes('inventario.conteo') && !pe.includes('inventario.aprobar_ajustes') && pa.includes('inventario.aprobar_ajustes') && pa.includes('inventario.conteo')
  })())

  L.grupo('Abrir un conteo y contar a ciegas')
  entrar('qa-caj')
  let r = await guardas['conteos:abrir']({ categoria_id: idCat })
  L.ok('Cajero no puede abrir un conteo', r.ok === false && r.sin_permiso === true)
  const emp = entrar('qa-emp')
  r = await guardas['conteos:abrir']({ categoria_id: idCat, nota: 'conteo de prueba' })
  L.ok('Empleado abre un conteo', r.ok === true && r.conteo_id > 0, JSON.stringify(r))
  const cid = r.conteo_id
  let c = await guardas['conteos:getById'](cid)
  L.ok('el conteo trae la lista de qué contar (5 productos de la categoría)', c.lineas.length === 5, String(c.lineas && c.lineas.length))
  L.ok('conteo CIEGO: no muestra el stock esperado ni la diferencia', c.estado === 'borrador' && c.lineas.every(l => !('stock_sistema_congelado' in l) && !('diferencia' in l) && !('esperado_actual' in l)), JSON.stringify(c.lineas[0]))
  // Ventas durante el conteo: D y E (se venden 3 después de abrir)
  entrar('qa-admin')
  const vend = (id, n) => dbm.inventario.venderProductos([{ producto_id: id, nombre_producto: 'x', cantidad: n, precio_unitario: 10 }], { metodo_pago: 'efectivo' })
  L.ok('se vende durante el conteo (D y E, 3 c/u)', vend(D, 3).ok && vend(E, 3).ok && stock(D) === 17 && stock(E) === 17)
  entrar('qa-emp')
  r = await guardas['conteos:cerrar'](cid)
  L.ok('cerrar un conteo sin ningún producto contado → rechazado', r.ok === false)
  r = await guardas['conteos:registrar'](cid, [
    { producto_id: A, contado: 8 }, { producto_id: B, contado: 5 }, { producto_id: D, contado: 20 }, { producto_id: E, contado: 19 }])
  L.ok('registrar lo contado', r.ok === true, JSON.stringify(r))
  r = await guardas['conteos:registrar'](cid, [{ producto_id: A, contado: -1 }])
  L.ok('un conteo negativo se rechaza', r.ok === false)
  r = await guardas['conteos:registrar'](cid, [{ producto_id: 999999, contado: 1 }])
  L.ok('un producto que no está en el conteo se rechaza', r.ok === false)
  r = await guardas['conteos:aprobar'](cid)
  L.ok('Empleado no puede aprobar', r.ok === false && r.sin_permiso === true)
  r = await guardas['conteos:cerrar'](cid)
  L.ok('Empleado cierra el conteo (queda «contado»)', r.ok === true, JSON.stringify(r))
  r = await guardas['conteos:registrar'](cid, [{ producto_id: C, contado: 7 }])
  L.ok('un conteo cerrado ya no admite cambios', r.ok === false)
  c = await guardas['conteos:getById'](cid)
  L.ok('quien cuenta no ve las diferencias ni el esperado', c.lineas.every(l => !('diferencia' in l) && !('esperado_actual' in l)))

  L.grupo('Diferencias y aprobación')
  entrar('qa-admin')
  c = await guardas['conteos:getById'](cid)
  const lin = id => c.lineas.find(l => l.producto_id === id)
  L.ok('el aprobador ve las diferencias', c.estado === 'contado' && lin(A).diferencia === -2 && lin(B).diferencia === 0, JSON.stringify(lin(A)))
  L.ok('con ventas durante el conteo: diferencia = contado − stock al abrir (D: 20−20 = 0); el esperado actual descuenta lo vendido (17)', lin(D).diferencia === 0 && lin(D).esperado_actual === 17 && lin(D).stock_final_previsto === 17, JSON.stringify(lin(D)))
  L.ok('E: contado 19 vs 20 al abrir → −1; stock final previsto 19−3 = 16', lin(E).diferencia === -1 && lin(E).stock_final_previsto === 16 && lin(E).ajuste_previsto === -1, JSON.stringify(lin(E)))
  L.ok('lo no contado (C) no tiene diferencia', lin(C).contado === null && lin(C).diferencia === null)
  const nMovAntes = queryOne('SELECT COUNT(*) n FROM movimientos_stock').n
  r = await guardas['conteos:aprobar'](cid)
  L.ok('aprobar → ok', r.ok === true && r.ajustes === 2, JSON.stringify(r))
  L.ok('A: 10 → 8 con movimiento «Inventario físico #N» a nombre del aprobador', stock(A) === 8 && (() => { const m = movs(A).pop(); return m.tipo === 'ajuste' && m.stock_anterior === 10 && m.stock_nuevo === 8 && m.delta === -2 && m.motivo.includes(`Inventario físico #${cid}`) && m.usuario_id === adm.id && m.conteo_id === cid })())
  L.ok('B sin diferencia: sin movimiento nuevo', movs(B).length === 1 && stock(B) === 5)
  L.ok('C no contado: intacto', stock(C) === 7 && movs(C).length === 1)
  L.ok('D: stock final = contado + deltas posteriores = 20 − 3 = 17 → sin cambio de stock (no hay ajuste)', stock(D) === 17)
  L.ok('E: stock final = 19 − 3 = 16 (un ajuste de −1)', stock(E) === 16 && movs(E).pop().delta === -1)
  L.ok('solo se escribieron los movimientos necesarios', queryOne('SELECT COUNT(*) n FROM movimientos_stock').n - nMovAntes === 2, String(queryOne('SELECT COUNT(*) n FROM movimientos_stock').n - nMovAntes))
  L.ok('el kardex sigue cuadrando (conciliación sin diferencias para los 5)', ![A, B, C, D, E].some(id => dbm.inventario.conciliacion().diferencias.some(d => d.producto_id === id)))
  r = await guardas['conteos:aprobar'](cid)
  L.ok('aprobar dos veces → rechazado', r.ok === false)
  r = await guardas['conteos:cancelar'](cid)
  L.ok('un conteo aprobado no se cancela', r.ok === false)

  L.grupo('Cancelar no cambia nada')
  entrar('qa-emp')
  r = await guardas['conteos:abrir']({ producto_ids: [A, B] })
  const c2 = r.conteo_id
  await guardas['conteos:registrar'](c2, [{ producto_id: A, contado: 1 }])
  const nMov2 = queryOne('SELECT COUNT(*) n FROM movimientos_stock').n
  r = await guardas['conteos:cancelar'](c2)
  L.ok('cancelar → ok y sin tocar stock ni kardex', r.ok === true && stock(A) === 8 && queryOne('SELECT COUNT(*) n FROM movimientos_stock').n === nMov2)
  entrar('qa-admin')
  r = await guardas['conteos:aprobar'](c2)
  L.ok('un conteo cancelado no se puede aprobar', r.ok === false)
  r = await guardas['conteos:aprobar']((await guardas['conteos:abrir']({ producto_ids: [A] })).conteo_id)
  L.ok('un conteo en borrador (sin cerrar) no se puede aprobar', r.ok === false)

  L.grupo('Revertir con movimiento inverso')
  r = await guardas['conteos:revertir'](cid)
  L.ok('revertir → ok', r.ok === true, JSON.stringify(r))
  L.ok('A vuelve a 10 y E a 17 con movimientos inversos (no se borra nada)', stock(A) === 10 && stock(E) === 17 && movs(A).length === 3 && /Reversión inventario físico/.test(movs(A).pop().motivo))
  L.ok('el estado queda «revertido»', queryOne('SELECT estado FROM conteos WHERE id=?', [cid]).estado === 'revertido')
  r = await guardas['conteos:revertir'](cid)
  L.ok('revertir dos veces → rechazado', r.ok === false)
  // Revertir cuando dejaría stock negativo → se rechaza
  const F = P('F3 F', 4)
  entrar('qa-emp'); const c3 = (await guardas['conteos:abrir']({ producto_ids: [F] })).conteo_id
  await guardas['conteos:registrar'](c3, [{ producto_id: F, contado: 10 }]); await guardas['conteos:cerrar'](c3)
  entrar('qa-admin'); await guardas['conteos:aprobar'](c3)         // 4 → 10 (+6)
  dbm.inventario.venderProductos([{ producto_id: F, nombre_producto: 'x', cantidad: 8, precio_unitario: 10 }], { metodo_pago: 'efectivo' }) // 10 → 2
  r = await guardas['conteos:revertir'](c3)                          // −6 dejaría −4
  L.ok('revertir que dejaría stock negativo → rechazado sin tocar nada', r.ok === false && stock(F) === 2 && queryOne('SELECT estado FROM conteos WHERE id=?', [c3]).estado === 'aprobado', JSON.stringify(r))

  L.grupo('Un archivo importado alimenta un conteo (modo seguro de «reemplazar»)')
  r = await guardas['conteos:desdeImportacion']({ items: [
    { accion: 'actualizar', producto_id: B, nombre: 'F3 B', cantidad: 4 },
    { accion: 'actualizar', producto_id: C, nombre: 'F3 C', cantidad: 7 },
    { accion: 'crear', nombre: 'F3 Nuevo', cantidad: 3 }], nota: 'Archivo inventario.xlsx' })
  L.ok('crea un conteo en borrador con lo contado ya cargado; los productos nuevos se ignoran con aviso', r.ok === true && r.lineas === 2 && r.ignorados === 1, JSON.stringify(r))
  const c4 = r.conteo_id
  L.ok('stock sin tocar hasta aprobar', stock(B) === 5 && stock(C) === 7)
  await guardas['conteos:cerrar'](c4)
  r = await guardas['conteos:aprobar'](c4)
  L.ok('aprobado: B 5 → 4, C sin cambio', r.ok === true && stock(B) === 4 && stock(C) === 7 && r.ajustes === 1, JSON.stringify(r))

  L.grupo('Los datos originales no cambiaron')
  L.igual('hash de dev_data idéntico', L.hashesOrigen(), antes)
  L.limpiar(dir)
  L.fin()
})().catch(e => { console.error(e); process.exit(1) })
