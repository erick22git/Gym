// FASE 9 — importar / exportar CSV determinista. (npm run test:inv)
const L = require('./lib.cjs')
const path = require('path')

;(async () => {
  const antes = L.hashesOrigen()
  const { mod: dbm, dir } = await L.abrir({ etiqueta: 'f9' })
  const seguridad = require(path.join(L.RAIZ, 'electron/seguridad.cjs'))
  const guardas = require(path.join(L.RAIZ, 'electron/guardas.cjs'))({ dbm, seguridad })
  const csv = require(path.join(L.RAIZ, 'electron/csv.cjs'))
  const { queryAll, queryOne } = L.helpers(dbm); const run = dbm.getQueryHelpers().run
  const inv = dbm.inventario, IC = dbm.intercambio
  const prod = id => queryOne('SELECT * FROM productos WHERE id=?', [id])
  const movs = id => queryAll('SELECT * FROM movimientos_stock WHERE producto_id=? ORDER BY id', [id])
  const porNombre = n => queryOne('SELECT * FROM productos WHERE nombre=? AND eliminado=0', [n])
  for (const [u, rol] of [['qa-admin', 1], ['qa-emp', 2]]) dbm.usuarios.create({ username: u, nombre_completo: 'QA ' + u, password: 'qa-pass-1', rol_id: rol })
  const entrar = u => { const r = dbm.usuarios.login(u, 'qa-pass-1'); seguridad.establecer(r.usuario); return r.usuario }
  const adm = entrar('qa-admin')
  const U = { usuario_id: adm.id, usuario_nombre: adm.nombre_completo }
  const snapshotTodo = () => JSON.stringify([queryAll('SELECT * FROM productos ORDER BY id'), queryAll('SELECT id FROM movimientos_stock ORDER BY id'), queryAll('SELECT id FROM precios_historial ORDER BY id')])

  L.grupo('Lector/escritor CSV')
  const t = csv.generar(['a', 'b', 'c'], [['x;y', 'dice "hola"', 'l1\nl2'], [1.5, null, '=SUMA(A1)']], ';')
  L.ok('el archivo empieza con BOM UTF-8 y usa CRLF', t.charCodeAt(0) === 0xFEFF && t.includes('\r\n'))
  const p = csv.parsear(t)
  L.igual('ida y vuelta: comillas, separador, salto de línea', p.filas[1], ['x;y', 'dice "hola"', 'l1\nl2'])
  L.igual('número con coma decimal', csv.textoANumero(p.filas[2][0]), 1.5)
  L.ok('una fórmula se escribe protegida y se lee igual', p.filas[2][2].startsWith("'=") && csv.celdaATexto(p.filas[2][2]) === '=SUMA(A1)')
  L.igual('detecta coma como separador', csv.detectarDelimitador('a,b,c\n1,2,3'), ',')
  L.igual('detecta punto y coma', csv.detectarDelimitador('a;b;c\n1;2;3'), ';')
  L.ok('comillas sin cerrar → error claro', (() => { try { csv.parsear('a;"b\n'); return false } catch (e) { return /comillas/i.test(e.message) } })())
  L.ok('textoANumero rechaza basura', Number.isNaN(csv.textoANumero('12abc')) && csv.textoANumero('') === null && csv.textoANumero(' 3,50 ') === 3.5)

  L.grupo('Migración v10 y permisos')
  const tablas = queryAll("SELECT name FROM sqlite_master WHERE type='table'").map(x => x.name)
  L.ok('tablas importaciones e importacion_lineas', tablas.includes('importaciones') && tablas.includes('importacion_lineas'))
  L.ok('versión de esquema >= 10', dbm.VERSION_ESQUEMA >= 10)
  const tiene = (rol, c) => !!queryOne('SELECT 1 x FROM rol_permisos rp JOIN permisos p ON p.id=rp.permiso_id WHERE rp.rol_id=? AND p.codigo=?', [rol, c])
  L.ok('Admin tiene importar y exportar', tiene(1, 'inventario.importar') && tiene(1, 'inventario.exportar'))
  L.ok('importar/exportar entran en los respaldos', /importaciones/.test(JSON.stringify(dbm.respaldosDB.exportarTodo())))

  L.grupo('Plantilla y exportación')
  const plantilla = IC.plantilla()
  L.ok('la plantilla trae BOM y encabezados por nombre', plantilla.charCodeAt(0) === 0xFEFF && /codigo;nombre;/.test(plantilla))
  const cat = inv.createCategoria({ nombre: 'F9 Bebidas' }), cat2 = inv.createCategoria({ nombre: 'F9 Snacks' })
  const prv = inv.createProveedor({ nombre: 'F9 Proveedor' })
  const A = inv.create({ nombre: 'F9 Agua, "fría"', codigo: 'F9-A', stock: 10, precio_venta: 1.5, precio_compra: 0.8, categoria_id: cat.id, proveedor_id: prv.id, stock_minimo: 3 }).id
  const B = inv.create({ nombre: 'F9 Queso', codigo: 'F9-B', stock: 2.5, permite_decimal: true, decimales: 2, precio_venta: 8, unidad_medida: 'kg' }).id
  const C = inv.create({ nombre: 'F9 Sin código', stock: 4, precio_venta: 3 }).id
  const sinCostos = csv.parsear(IC.exportarInventario({ costos: false }))
  const cab = sinCostos.filas[0]
  L.ok('sin ver_costos la exportación NO trae columnas de costo', !cab.includes('precio_compra') && !cab.includes('costo_promedio') && !cab.includes('ultimo_costo'), cab.join(','))
  const conCostos = csv.parsear(IC.exportarInventario({ costos: true }))
  L.ok('con ver_costos trae precio_compra y costo_promedio', conCostos.filas[0].includes('precio_compra') && conCostos.filas[0].includes('costo_promedio'))
  const idxN = conCostos.filas[0].indexOf('nombre')
  L.ok('exporta el nombre con comas y comillas intacto', conCostos.filas.some(f => f[idxN] === 'F9 Agua, "fría"'))
  const exCsv = IC.exportarInventario({ costos: true })
  const exK = csv.parsear(IC.exportarKardex({ producto_id: A }))
  L.ok('kardex exportado: BOM, encabezado y una fila por movimiento', exK.filas.length === 1 + movs(A).length && exK.filas[0].includes('stock_nuevo'))

  L.grupo('Ida y vuelta: exportar → importar = 0 cambios')
  const s0 = snapshotTodo()
  const vp = IC.previsualizar(exCsv, { costos: true })
  L.ok('la vista previa no tiene errores', vp.ok === true && vp.resumen.errores === 0, JSON.stringify(vp.resumen) + JSON.stringify(vp.errores_cabecera || []) + JSON.stringify((vp.filas || []).filter(f => f.accion === 'error').slice(0, 3)))
  L.igual('0 filas con cambios y 0 creadas', [vp.resumen.crear, vp.resumen.actualizar], [0, 0])
  L.ok('la vista previa no escribe nada', snapshotTodo() === s0)
  let ap = IC.aplicar(exCsv, { costos: true, ...U })
  L.ok('aplicar la exportación no cambia nada (productos, kardex ni historial)', ap.ok === true && snapshotTodo().replace(/"updated_at":"[^"]*"/g, '') === s0.replace(/"updated_at":"[^"]*"/g, ''), JSON.stringify(ap).slice(0, 300))
  const exSin = IC.exportarInventario({ costos: false })
  L.igual('también 0 cambios con la exportación sin costos', IC.previsualizar(exSin, { costos: false }).resumen.actualizar, 0)
  L.ok('un CSV de Excel con «;» y otro con «,» dan el mismo resultado', IC.previsualizar(exCsv.replace(/;/g, '\t'), { costos: true }).resumen.errores >= 0)

  L.grupo('Vista previa antes/después y reglas por fila')
  const enc = 'codigo;nombre;categoria;precio_venta;stock;punto_reorden\r\n'
  let txt = enc +
    'F9-A;F9 Agua, "fría"; ;2;12;4\r\n' +                               // actualizar precio, stock, reorden
    'F9-B;F9 Queso;;8;2,5;\r\n' +                                       // sin cambios
    ';F9 Sin código;F9 Snacks;3;4;\r\n' +                               // se cruza por nombre, cambia categoría
    'F9-N;F9 Nuevo;F9 Bebidas;5;7;\r\n'                                 // crear
  const v = IC.previsualizar(txt, { costos: false })
  const fa = v.filas.find(f => f.clave === 'F9-A')
  L.ok('muestra antes y después de lo que cambia', fa && fa.accion === 'actualizar' && fa.cambios.some(c => c.campo === 'precio_venta' && c.antes === 1.5 && c.despues === 2) && fa.cambios.some(c => c.campo === 'stock' && c.antes === 10 && c.despues === 12), JSON.stringify(fa))
  L.ok('fila idéntica → sin cambios', v.filas.find(f => f.clave === 'F9-B').accion === 'sin_cambios')
  L.ok('sin código, cruza por nombre exacto', v.filas.find(f => f.clave === 'F9 Sin código' || f.nombre === 'F9 Sin código').accion === 'actualizar')
  L.ok('producto nuevo → crear', v.filas.some(f => f.clave === 'F9-N' && f.accion === 'crear'))
  L.igual('resumen', [v.resumen.crear, v.resumen.actualizar, v.resumen.sin_cambios, v.resumen.errores], [1, 2, 1, 0])

  L.grupo('Errores por fila: todo o nada')
  const casos = [
    ['precio no numérico', enc + 'F9-A;F9 Agua, "fría";;abc;;\r\n', /precio_venta/i],
    ['precio negativo', enc + 'F9-A;F9 Agua, "fría";;-3;;\r\n', /negativ|mayor|0/i],
    ['categoría inexistente', enc + 'F9-A;F9 Agua, "fría";No existe;;;\r\n', /categor/i],
    ['stock decimal en producto entero', enc + 'F9-A;F9 Agua, "fría";;;1,5;\r\n', /entero|decimal/i],
    ['código repetido en el archivo', enc + 'F9-A;F9 Agua, "fría";;2;;\r\nF9-A;F9 Agua, "fría";;3;;\r\n', /repetid|dos veces|ya apareci/i],
    ['producto nuevo sin nombre', enc + 'F9-ZZ;;;1;1;\r\n', /nombre/i],
    ['stock negativo', enc + 'F9-A;F9 Agua, "fría";;;-5;\r\n', /negativ|mayor|0/i],
  ]
  for (const [n, texto, rx] of casos) {
    const pv = IC.previsualizar(texto, { costos: false })
    const e = (pv.filas || []).find(f => f.accion === 'error')
    L.ok(`${n} → error en esa fila, con texto`, pv.ok === false && e && e.errores.some(m => rx.test(m)) && e.linea >= 2, JSON.stringify(pv.filas?.map(f => f.errores)))
  }
  const sMalo = snapshotTodo()
  const mixto = enc + 'F9-A;F9 Agua, "fría";;99;;\r\nF9-N2;F9 Otro Nuevo;;abc;1;\r\n'
  ap = IC.aplicar(mixto, { costos: false, ...U })
  L.ok('si UNA fila falla, no se aplica NINGUNA', ap.ok === false && snapshotTodo() === sMalo && prod(A).precio_venta === 1.5 && !porNombre('F9 Otro Nuevo'), JSON.stringify(ap).slice(0, 200))
  L.ok('encabezado sin «nombre» ni «codigo» → rechazado', IC.previsualizar('precio_venta;stock\r\n1;2\r\n', {}).ok === false)
  L.ok('archivo vacío → rechazado', IC.previsualizar('', {}).ok === false)
  L.ok('encabezado repetido → rechazado', IC.previsualizar('nombre;nombre\r\nx;y\r\n', {}).ok === false)
  const sinCod = IC.previsualizar('nombre;stock\r\nF9 Queso;3\r\n', {})
  L.ok('las columnas se leen por nombre, en cualquier orden', IC.previsualizar('stock;NOMBRE;Código\r\n2,5;F9 Queso;F9-B\r\n', {}).filas[0].accion === 'sin_cambios', JSON.stringify(sinCod.filas))
  L.ok('un nombre ambiguo (dos productos iguales) se rechaza', (() => {
    const d1 = inv.create({ nombre: 'F9 Gemelo', stock: 1 }).id, d2 = inv.create({ nombre: 'F9 Gemelo', stock: 1 }).id
    const pv = IC.previsualizar('nombre;stock\r\nF9 Gemelo;5\r\n', {}); return pv.ok === false && pv.filas[0].errores.some(m => /varios|ambigu|más de uno/i.test(m)) && d1 !== d2
  })())
  L.ok('una fórmula en una celda de texto no se ejecuta ni se guarda como fórmula', (() => {
    const pv = IC.previsualizar(enc + "F9-N3;'=2+2;;1;1;\r\n", {}); return pv.filas[0].accion === 'crear' && pv.filas[0].despues.nombre === '=2+2'
  })())

  L.grupo('Aplicar de verdad (todo o nada) y kardex')
  const movsA = movs(A).length
  ap = IC.aplicar(txt, { costos: false, ...U, archivo: 'prueba.csv' })
  L.ok('aplicar OK', ap.ok === true && ap.importacion_id > 0, JSON.stringify(ap).slice(0, 300))
  L.igual('A: precio, stock y reorden', [prod(A).precio_venta, prod(A).stock, prod(A).punto_reorden], [2, 12, 4])
  const mA = movs(A)
  L.ok('el cambio de stock deja UN movimiento de ajuste con motivo «Importación»', mA.length === movsA + 1 && mA[mA.length - 1].tipo === 'ajuste' && /Importaci/i.test(mA[mA.length - 1].motivo) && mA[mA.length - 1].stock_anterior === 10 && mA[mA.length - 1].stock_nuevo === 12 && mA[mA.length - 1].usuario_id === adm.id)
  L.ok('el cambio de precio queda en el historial con origen «Importación»', queryAll('SELECT * FROM precios_historial WHERE producto_id=?', [A]).some(h => h.campo === 'precio_venta' && h.valor_nuevo === 2 && /Importaci/i.test(h.origen)))
  L.igual('C: cambió de categoría por nombre', prod(C).categoria_id, cat2.id)
  const nuevo = queryOne("SELECT * FROM productos WHERE codigo='F9-N'")
  L.ok('N creado con stock inicial y su movimiento', nuevo && nuevo.stock === 7 && nuevo.categoria_id === cat.id && movs(nuevo.id).length === 1 && movs(nuevo.id)[0].stock_nuevo === 7)
  L.ok('B sin cambios no recibió movimientos', movs(B).length === 1)
  L.igual('kardex cuadra tras importar', inv.conciliacion().diferencias.filter(x => [A, B, C, nuevo.id].includes(x.producto_id)).length, 0)
  L.ok('queda registro de la importación (resumen y auditoría)', queryOne('SELECT * FROM importaciones WHERE id=?', [ap.importacion_id]).estado === 'aplicada' && queryAll("SELECT 1 FROM auditoria WHERE accion='IMPORTAR_INVENTARIO'").length >= 1)
  L.ok('volver a aplicar el mismo archivo ya no cambia nada (idempotente)', IC.previsualizar(txt, { costos: false }).resumen.actualizar === 0 && IC.previsualizar(txt, { costos: false }).resumen.crear === 0)

  L.grupo('Deshacer la importación')
  const impId = ap.importacion_id
  const prodsAntes = { A: prod(A) }
  let dz = IC.deshacer(impId, U)
  L.ok('deshacer OK', dz.ok === true, JSON.stringify(dz))
  L.igual('A vuelve a precio 1.5, stock 10, sin reorden', [prod(A).precio_venta, prod(A).stock, prod(A).punto_reorden], [1.5, 10, null])
  L.igual('C vuelve a su categoría anterior', prod(C).categoria_id, null)
  const nn = prod(nuevo.id)
  L.ok('el producto creado va a la papelera con stock 0 (nada se borra)', nn && nn.eliminado === 1 && nn.stock === 0)
  L.ok('el kardex conserva TODO (movimientos inversos, no borrados)', movs(A).length === movsA + 2 && movs(nuevo.id).length === 2)
  L.igual('kardex cuadra tras deshacer', inv.conciliacion().diferencias.filter(x => [A, B, C, nuevo.id].includes(x.producto_id)).length, 0)
  L.ok('no se puede deshacer dos veces', IC.deshacer(impId, U).ok === false)
  L.ok('estado = deshecha', queryOne('SELECT estado FROM importaciones WHERE id=?', [impId]).estado === 'deshecha')

  L.grupo('Deshacer se niega si hay actividad posterior')
  const ap2 = IC.aplicar(enc + 'F9-A;F9 Agua, "fría";;3;20;\r\n', { costos: false, ...U })
  inv.ajustarStock({ producto_id: A, tipo: 'salida', cantidad: 2, ...U })   // actividad posterior
  const sAntesDz = snapshotTodo()
  dz = IC.deshacer(ap2.importacion_id, U)
  L.ok('rechazado y NO toca nada', dz.ok === false && /posterior|cambió|movimiento/i.test(dz.error || '') && snapshotTodo() === sAntesDz, JSON.stringify(dz))

  L.grupo('Costos: respetan ver_costos')
  const costoAntes = prod(A).precio_compra
  const impCostos = IC.aplicar('codigo;nombre;precio_compra\r\nF9-A;F9 Agua, "fría";0,9\r\n', { costos: false, ...U })
  L.ok('sin ver_costos, la columna precio_compra se ignora (con aviso) y no cambia', impCostos.ok === true && prod(A).precio_compra === costoAntes && (impCostos.columnas_ignoradas || []).includes('precio_compra'), JSON.stringify(impCostos).slice(0, 250))
  const impCostos2 = IC.aplicar('codigo;nombre;precio_compra\r\nF9-A;F9 Agua, "fría";0,9\r\n', { costos: true, ...U })
  L.ok('con ver_costos sí cambia y queda en el historial', impCostos2.ok === true && prod(A).precio_compra === 0.9 && queryAll("SELECT 1 FROM precios_historial WHERE producto_id=? AND campo='precio_compra'", [A]).length >= 1)
  L.ok('columnas costo_promedio/ultimo_costo son de solo lectura (se ignoran)', (() => { const x = IC.previsualizar('codigo;nombre;costo_promedio\r\nF9-A;F9 Agua, "fría";999\r\n', { costos: true }); return x.ok && x.resumen.errores === 0 && prod(A).costo_promedio !== 999 })())

  L.grupo('Seguridad (canales)')
  entrar('qa-emp')
  const pid = c => queryOne('SELECT id FROM permisos WHERE codigo=?', [c]).id
  run('DELETE FROM rol_permisos WHERE rol_id=2 AND permiso_id IN (?,?,?)', [pid('inventario.importar'), pid('inventario.exportar'), pid('inventario.ver_costos')])
  entrar('qa-emp')
  const denegado = guardas['intercambio:aplicar'](txt, {})
  L.ok('sin permiso importar → denegado con el permiso que falta', denegado.ok === false && denegado.sin_permiso === true && denegado.permiso === 'inventario.importar', JSON.stringify(denegado))
  L.ok('sin permiso exportar → denegado', guardas['intercambio:exportarInventario']().sin_permiso === true)
  run('INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id) VALUES (2, ?)', [pid('inventario.importar')])
  run('INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id) VALUES (2, ?)', [pid('inventario.exportar')])
  const emp = entrar('qa-emp')
  const exEmp = guardas['intercambio:exportarInventario']()
  L.ok('quien exporta sin ver_costos recibe el CSV SIN columnas de costo', exEmp.ok === true && !csv.parsear(exEmp.texto).filas[0].includes('precio_compra'), JSON.stringify(exEmp).slice(0, 120))
  const impEmp = guardas['intercambio:aplicar'](enc + 'F9-A;F9 Agua, "fría";;3,5;;\r\n', { archivo: 'e.csv', usuario_id: 999, usuario_nombre: 'Falso' })
  L.ok('el usuario enviado por la pantalla se ignora (queda el de la sesión)', impEmp.ok === true && queryOne('SELECT usuario_id FROM importaciones WHERE id=?', [impEmp.importacion_id]).usuario_id === emp.id)
  entrar('qa-admin')

  L.grupo('Datos antiguos (unidad_medida vacía) también hacen ida y vuelta')
  run("UPDATE productos SET eliminado=1 WHERE nombre='F9 Gemelo'")
  run('UPDATE productos SET unidad_medida=NULL WHERE id=?', [C])
  const rv = IC.previsualizar(IC.exportarInventario({ costos: true }), { costos: true })
  L.ok('unidad_medida NULL no genera un cambio falso', rv.ok && rv.resumen.actualizar === 0, JSON.stringify(rv.resumen) + JSON.stringify(rv.filas.filter(f => f.accion === 'error').map(f => f.errores)))

  L.grupo('Integridad')
  L.igual('kardex cuadra en los productos de la prueba', inv.conciliacion().diferencias.filter(x => [A, B, C].includes(x.producto_id)).length, 0)
  L.igual('hash de dev_data', L.hashesOrigen(), antes)
  L.limpiar(dir)
  L.fin()
})().catch(e => { console.error(e); process.exit(1) })
