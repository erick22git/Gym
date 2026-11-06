// FASE 10 — reportes de inventario contra cálculos hechos A MANO sobre una BD conocida y vacía. (npm run test:inv)
const L = require('./lib.cjs')
const path = require('path')

;(async () => {
  const antes = L.hashesOrigen()
  const { mod: dbm, dir } = await L.abrir({ etiqueta: 'f10', copiarDatos: false })
  const seguridad = require(path.join(L.RAIZ, 'electron/seguridad.cjs'))
  const guardas = require(path.join(L.RAIZ, 'electron/guardas.cjs'))({ dbm, seguridad })
  const csv = require(path.join(L.RAIZ, 'electron/csv.cjs'))
  const { queryAll, queryOne } = L.helpers(dbm); const run = dbm.getQueryHelpers().run
  const inv = dbm.inventario, V = dbm.ventas, R = dbm.reportes
  for (const [u, rol] of [['qa-admin', 1], ['qa-emp', 2]]) dbm.usuarios.create({ username: u, nombre_completo: 'QA ' + u, password: 'qa-pass-1', rol_id: rol })
  const entrar = u => { const r = dbm.usuarios.login(u, 'qa-pass-1'); seguridad.establecer(r.usuario); return r.usuario }
  const adm = entrar('qa-admin')
  const U = { usuario_id: adm.id, usuario_nombre: adm.nombre_completo }
  const prev = dbm.caja.getSesionActual(); if (prev) dbm.caja.cerrar(U)
  const ses = dbm.caja.abrir({ ...U, monto_inicial: 50 }).sesion_id
  const vender = items => inv.venderProductos(items, { metodo_pago: 'efectivo', sesion_id: ses, ...U })
  const dia = (id, n) => run("UPDATE ventas SET fecha=datetime('now','localtime',?) WHERE id=?", [`-${n} days`, id])
  const L2 = (p, c, pu) => ({ producto_id: p, nombre_producto: 'x', cantidad: c, precio_unitario: pu })

  // Categorías y productos (todos con stock inicial 0; el stock entra por compras para fijar el costo promedio)
  const cX = inv.createCategoria({ nombre: 'Cat X' }).id, cY = inv.createCategoria({ nombre: 'Cat Y' }).id
  const P = (n, cat, extra = {}) => inv.create({ nombre: n, categoria_id: cat, precio_venta: 10, stock: 0, ...extra }).id
  const A = P('Prod A', cX), B = P('Prod B', cX), C = P('Prod C', cY, { stock: 40 }), D = P('Prod D', cY), E = P('Prod E', cY), F = P('Prod F', cY, { stock: 5 }), G = P('Prod G', cY, { stock: 3 })
  const comprar = (p, c, k) => dbm.compras.registrarSimple({ lineas: [{ producto_id: p, cantidad: c, costo_unitario: k }], ...U })
  comprar(A, 100, 4); comprar(B, 50, 10); comprar(B, 50, 20)      // B: 100 u a costo promedio 15
  comprar(D, 30, 2); comprar(E, 10, 5)
  // Ventas (fechas relativas a hoy)
  const s1 = vender([L2(A, 10, 10), L2(B, 4, 30)]); dia(s1.venta_id, 1)             // A 100 · B 120
  const s2 = vender([L2(A, 20, 10), L2(C, 5, 8)]); dia(s2.venta_id, 5)              // A 200 · C 40
  const s3 = vender([L2(D, 6, 5), L2(B, 1, 30)]); dia(s3.venta_id, 10)              // D 30 · B 30
  const s4 = vender([L2(A, 50, 10)]); dia(s4.venta_id, 2)                           // ANULADA
  const d4 = V.getById(s4.venta_id).detalle
  V.anular(s4.venta_id, { motivo: 'error de caja', lineas: d4.map(d => ({ detalle_id: d.id, vuelve_a_stock: true })), ...U })
  const s5 = vender([L2(A, 5, 10)]); dia(s5.venta_id, 3)                            // A 50, se devuelven 2 (20) → neto 3 u / 30
  V.devolver(s5.venta_id, { motivo: 'devolvió 2', lineas: [{ detalle_id: V.getById(s5.venta_id).detalle[0].id, cantidad: 2, vuelve_a_stock: true }], ...U })
  const s6 = vender([L2(E, 1, 9)]); dia(s6.venta_id, 200)                           // venta vieja de E
  const s7 = vender([L2(D, 2, 5)]); dia(s7.venta_id, 200)                           // venta vieja de D (fuera del período)
  // Productos "viejos": E y G existen desde hace casi un año; F es nuevo.
  run("UPDATE productos SET created_at=datetime('now','localtime','-300 days') WHERE id IN (?,?)", [E, G])
  const stock = id => queryOne('SELECT stock FROM productos WHERE id=?', [id]).stock

  L.grupo('Base conocida')
  L.igual('stocks finales calculados a mano (A 67, B 95, C 35, D 22, E 9, F 5, G 3)', [A, B, C, D, E, F, G].map(stock), [67, 95, 35, 22, 9, 5, 3])
  L.igual('costos promedio (A 4, B 15, C sin costo, D 2, E 5)', [A, B, C, D, E].map(p => queryOne('SELECT costo_promedio c FROM productos WHERE id=?', [p]).c), [4, 15, null, 2, 5])

  L.grupo('Valor del inventario = Σ stock × costo promedio')
  // A 67×4=268 · B 95×15=1425 · D 22×2=44 · E 9×5=45  → 1782 ; sin costo: C(35), F(5), G(3)
  const vi = R.valorInventario()
  L.cerca('valor total = 1782', vi.resumen.valor_total, 1782)
  L.igual('productos sin costo: 3 (C, F, G)', vi.resumen.productos_sin_costo, 3)
  L.igual('productos con costo: 4', vi.resumen.productos_con_costo, 4)
  L.ok('el detalle por producto suma el total', Math.abs(vi.filas.reduce((s, f) => s + (f.valor || 0), 0) - 1782) < 1e-9)
  L.ok('un producto archivado no cuenta', (() => { inv.archivar(F, U); const x = R.valorInventario().resumen.productos_sin_costo; inv.reactivar(F, U); return x === 2 })())

  L.grupo('Más vendidos (período 30 días; ventas anuladas fuera; devoluciones restadas)')
  const mv = R.masVendidos({ dias: 30 })
  L.igual('orden por cantidad: A 33, D 6, B 5, C 5 (empate B/C por monto)', mv.filas.map(f => [f.nombre, f.cantidad]), [['Prod A', 33], ['Prod D', 6], ['Prod B', 5], ['Prod C', 5]])
  L.cerca('monto de A = 100 + 200 + (50 − 20) = 330', mv.filas[0].monto, 330)
  L.ok('la venta anulada (50 u) NO cuenta', mv.filas[0].cantidad === 33)
  L.ok('la venta de hace 200 días queda fuera', !mv.filas.some(f => f.nombre === 'Prod E'))
  L.igual('orden por monto: A, B, C, D', R.masVendidos({ dias: 30, orden: 'monto' }).filas.map(f => f.nombre), ['Prod A', 'Prod B', 'Prod C', 'Prod D'])
  L.igual('límite', R.masVendidos({ dias: 30, limite: 2 }).filas.length, 2)
  L.igual('período de 365 días incluye las ventas viejas (E y D suman)', R.masVendidos({ dias: 365 }).filas.find(f => f.nombre === 'Prod D').cantidad, 8)

  L.grupo('Rotación = unidades netas vendidas ÷ stock actual')
  const ro = R.rotacion({ dias: 30 })
  const rot = n => ro.filas.find(f => f.nombre === n).rotacion
  L.cerca('A 33/67', rot('Prod A'), 33 / 67, 1e-4); L.cerca('B 5/95', rot('Prod B'), 5 / 95, 1e-4); L.cerca('C 5/35', rot('Prod C'), 5 / 35, 1e-4); L.cerca('D 6/22', rot('Prod D'), 6 / 22, 1e-4)
  L.cerca('E sin ventas en el período = 0', rot('Prod E'), 0)

  L.grupo('Cobertura en días (stock ÷ venta diaria del período)')
  const co = R.cobertura({ dias: 30 })
  const cob = n => co.filas.find(f => f.nombre === n)
  L.cerca('A: 67 ÷ (33/30) = 60,9', cob('Prod A').cobertura_dias, 60.9, 0.05)
  L.cerca('B: 95 ÷ (5/30) = 570', cob('Prod B').cobertura_dias, 570, 0.05)
  L.cerca('C: 35 ÷ (5/30) = 210', cob('Prod C').cobertura_dias, 210, 0.05)
  L.cerca('D: 22 ÷ (6/30) = 110', cob('Prod D').cobertura_dias, 110, 0.05)
  L.ok('E y F sin ventas → «sin datos suficientes», nunca infinito ni 0', cob('Prod E').cobertura_dias === null && /sin datos suficientes/i.test(cob('Prod E').nota) && cob('Prod F').cobertura_dias === null)
  L.ok('un período demasiado corto se rechaza', R.cobertura({ dias: 3 }).ok === false)

  L.grupo('Stock muerto (sin ventas en N días; N editable, 90 por defecto)')
  const sm = R.stockMuerto({})
  L.igual('por defecto N = 90', sm.resumen.dias, 90)
  L.igual('muertos a 90 días: E (última venta hace 200) y G (nunca vendió, es viejo)', sm.filas.map(f => f.nombre).sort(), ['Prod E', 'Prod G'])
  L.ok('F (producto nuevo) NO se marca como muerto', !sm.filas.some(f => f.nombre === 'Prod F'))
  L.ok('E: 200 días sin vender; G: sin venta registrada', sm.filas.find(f => f.nombre === 'Prod E').dias_sin_venta === 200 && sm.filas.find(f => f.nombre === 'Prod G').dias_sin_venta === null)
  L.cerca('valor inmovilizado = E 9×5 = 45 (G no tiene costo)', sm.resumen.valor, 45); L.igual('1 sin costo', sm.resumen.sin_costo, 1)
  L.igual('con N = 7 también es muerto D (su última venta fue hace 10 días); A, B y C vendieron hace menos', R.stockMuerto({ dias: 7 }).filas.map(f => f.nombre).sort(), ['Prod D', 'Prod E', 'Prod G'])

  L.grupo('Clasificación ABC (A 80 % · B 15 % · C 5 %, editable)')
  const ab = R.abc({ dias: 30 })
  L.igual('por defecto: A→A (0 %), B→A (60 %), C→B (87,3 %), D→B (94,5 %)', ab.filas.map(f => [f.nombre, f.clase]), [['Prod A', 'A'], ['Prod B', 'A'], ['Prod C', 'B'], ['Prod D', 'B']])
  L.cerca('A pesa 330/550 = 60 %', ab.filas[0].porcentaje, 60, 0.01); L.cerca('acumulado de D = 100 %', ab.filas[3].acumulado, 100, 0.01)
  L.igual('con 60/30: A, B, B, C', R.abc({ dias: 30, a: 60, b: 30 }).filas.map(f => f.clase), ['A', 'B', 'B', 'C'])
  L.ok('porcentajes que no suman ≤ 100 se rechazan', R.abc({ dias: 30, a: 90, b: 20 }).ok === false)
  L.ok('productos sin ventas no entran al ABC', !ab.filas.some(f => f.nombre === 'Prod E' || f.nombre === 'Prod F'))

  L.grupo('Margen por categoría (solo ventas CON costo; informa cuántas se excluyen)')
  const mg = R.margenPorCategoria({ dias: 30 })
  const x = mg.filas.find(f => f.categoria === 'Cat X'), y = mg.filas.find(f => f.categoria === 'Cat Y')
  L.ok('Cat X: ingreso 480, costo 33×4 + 5×15 = 207, margen 273 (56,88 %)', x && Math.abs(x.ingreso - 480) < 1e-9 && Math.abs(x.costo - 207) < 1e-9 && Math.abs(x.margen - 273) < 1e-9 && Math.abs(x.margen_pct - 56.88) < 0.01, JSON.stringify(x))
  L.ok('Cat Y: solo D (6 u): ingreso 30, costo 12, margen 18 (60 %)', y && Math.abs(y.ingreso - 30) < 1e-9 && Math.abs(y.costo - 12) < 1e-9 && Math.abs(y.margen - 18) < 1e-9 && Math.abs(y.margen_pct - 60) < 0.01, JSON.stringify(y))
  L.igual('se excluye 1 línea sin costo (C, 40)', [mg.resumen.lineas_excluidas, mg.resumen.monto_excluido], [1, 40])
  L.ok('el texto explica la exclusión', /sin costo/i.test(mg.resumen.nota || ''))

  L.grupo('Permisos y exportación a CSV')
  const pid = c => queryOne('SELECT id FROM permisos WHERE codigo=?', [c]).id
  for (const c of ['inventario.ver', 'inventario.exportar']) run('INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id) VALUES (2, ?)', [pid(c)])
  run('DELETE FROM rol_permisos WHERE rol_id=2 AND permiso_id=?', [pid('inventario.ver_costos')])
  entrar('qa-emp')
  L.ok('sin ver_costos: valor del inventario DENEGADO', guardas['reportes:valorInventario']().sin_permiso === true)
  L.ok('sin ver_costos: margen DENEGADO', guardas['reportes:margenPorCategoria']({ dias: 30 }).sin_permiso === true)
  L.ok('sin ver_costos: más vendidos sí, y el stock muerto viene SIN valor', guardas['reportes:masVendidos']({ dias: 30 }).filas.length > 0 && guardas['reportes:stockMuerto']({}).filas.every(f => !('valor' in f)) && !('valor' in guardas['reportes:stockMuerto']({}).resumen))
  const csvV = guardas['reportes:exportar']('masVendidos', { dias: 30 })
  L.ok('exportar reporte → CSV con BOM, encabezado en español y una fila por producto', csvV.ok === true && csvV.texto.charCodeAt(0) === 0xFEFF && csv.parsear(csvV.texto).filas.length === 1 + 4 && /cantidad/i.test(csv.parsear(csvV.texto).filas[0].join(',')), JSON.stringify(csvV).slice(0, 150))
  L.ok('exportar el valor sin permiso de costos → denegado', guardas['reportes:exportar']('valorInventario', {}).sin_permiso === true)
  entrar('qa-admin')
  L.ok('Admin exporta el valor del inventario', guardas['reportes:exportar']('valorInventario', {}).ok === true)
  L.ok('reporte desconocido → error de texto', guardas['reportes:exportar']('inventado', {}).ok === false)

  L.grupo('Integridad')
  L.igual('los reportes no escribieron nada (kardex cuadra)', inv.conciliacion().diferencias.length, 0)
  L.igual('hash de dev_data', L.hashesOrigen(), antes)
  L.limpiar(dir)
  L.fin()
})().catch(e => { console.error(e); process.exit(1) })
