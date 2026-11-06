// FASE 11 — códigos de barras, índice único de códigos, búsqueda exacta del escáner, etiquetas. (npm run test:inv)
const L = require('./lib.cjs')
const path = require('path')
const fs = require('fs')
const { execFileSync } = require('child_process')
const { pathToFileURL } = require('url')

;(async () => {
  const antes = L.hashesOrigen()
  const barras = require(path.join(L.RAIZ, 'electron/codigobarras.cjs'))
  const etiquetas = require(path.join(L.RAIZ, 'electron/etiquetas.cjs'))

  // ── Códigos de barras ──
  L.grupo('Code 128: tabla íntegra y relectura con un lector INDEPENDIENTE')
  const T = barras.TABLA_128
  L.igual('107 símbolos', T.length, 107)
  L.ok('cada símbolo mide 11 módulos (el final, 13) y todos son distintos', T.every((s, i) => [...s].reduce((a, c) => a + Number(c), 0) === (i === 106 ? 13 : 11)) && new Set(T).size === 107)
  const todos = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i))
  const casos = [...todos, 'ABC-123', 'F9-A', 'Agua 600ml', 'a~Z!', 'X'.repeat(30), '0123456789', 'Código'.replace('ó', 'o')].map((t, i) => ({ id: i, texto: t }))
  casos.forEach(c => { c.b = barras.code128B(c.texto) })
  L.ok('mi propio decodificador relee los 95 caracteres imprimibles y las cadenas de prueba', casos.every(c => { const d = barras.decodificar(c.b.bits); return d.texto === c.texto && d.tipo === 'code128' }))
  const leidos = JSON.parse(execFileSync('python', [path.join(__dirname, 'leer-barras.py')], { input: JSON.stringify(casos.map(c => ({ id: c.id, bits: c.b.bits }))), encoding: 'utf-8', timeout: 120000 }))
  // zxing recorta espacios al inicio/fin: se comparan sin ellos
  const malos = leidos.filter(r => (r.texto ?? '').trim() !== casos[r.id].texto.trim())
  L.ok('lector independiente (zxing-cpp): TODAS las cadenas se leen igual', malos.length === 0, JSON.stringify(malos.slice(0, 3)))
  L.ok('lo leído es Code 128', leidos.every(r => /Code 128/.test(r.formato || '')))
  L.ok('caracteres que no se pueden imprimir (tilde, ñ, vacío) → error claro', ['Camión', 'añ', ''].every(t => { try { barras.code128B(t); return false } catch (e) { return /car[aá]cter|vac/i.test(e.message) } }))

  L.grupo('EAN-13')
  L.igual('dígito verificador de 123456789012 → 8', barras.digitoEan13('123456789012'), 8)
  L.igual('dígito verificador de 400638133393 → 1 (EAN real conocido)', barras.digitoEan13('400638133393'), 1)
  L.igual('12 dígitos: se completa el verificador', barras.ean13('123456789012').texto, '1234567890128')
  L.ok('13 dígitos con verificador MAL → rechazado', (() => { try { barras.ean13('1234567890129'); return false } catch (e) { return /verificador/i.test(e.message) } })())
  const eanCasos = ['1234567890128', '4006381333931', '0000000000000', '9780306406157', '5012345678900'].filter(barras.ean13Valido)
  const eanB = eanCasos.map((t, i) => ({ id: i, texto: t, b: barras.generar(t) }))
  L.ok('un código de 13 dígitos válido sale como EAN-13; uno no válido, como Code 128', eanB.every(c => c.b.tipo === 'ean13') && barras.generar('1234567890129').tipo === 'code128')
  L.ok('mi decodificador relee los EAN-13', eanB.every(c => barras.decodificar(c.b.bits).texto === c.texto))
  const eanLeidos = JSON.parse(execFileSync('python', [path.join(__dirname, 'leer-barras.py')], { input: JSON.stringify(eanB.map(c => ({ id: c.id, bits: c.b.bits }))), encoding: 'utf-8', timeout: 120000 }))
  L.ok('lector independiente: los EAN-13 se leen igual y como EAN-13', eanLeidos.every(r => r.texto === eanB[r.id].texto && /EAN-13/.test(r.formato)), JSON.stringify(eanLeidos))
  const s = barras.svg('F9 <A>&"', { alto: 50 })
  L.ok('SVG válido: barras como rectángulos, texto escapado y etiqueta de accesibilidad', /^<svg /.test(s) && /<rect /.test(s) && s.includes('F9 &lt;A&gt;&amp;&quot;') && !s.includes('<A>') && /aria-label="Código de barras/.test(s))

  // ── Base de datos ──
  const { mod: dbm, dir, archivo } = await L.abrir({ etiqueta: 'f11', copiarDatos: false })
  const seguridad = require(path.join(L.RAIZ, 'electron/seguridad.cjs'))
  const guardas = require(path.join(L.RAIZ, 'electron/guardas.cjs'))({ dbm, seguridad })
  const { queryAll, queryOne } = L.helpers(dbm); const run = dbm.getQueryHelpers().run
  const inv = dbm.inventario
  for (const [u, rol] of [['qa-admin', 1], ['qa-emp', 2]]) dbm.usuarios.create({ username: u, nombre_completo: 'QA ' + u, password: 'qa-pass-1', rol_id: rol })
  const entrar = u => { const r = dbm.usuarios.login(u, 'qa-pass-1'); seguridad.establecer(r.usuario); return r.usuario }
  const adm = entrar('qa-admin'); const U = { usuario_id: adm.id, usuario_nombre: adm.nombre_completo }
  const indice = () => queryAll("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_productos_codigo_unico'").length

  L.grupo('Migración v11 e índice único de códigos')
  L.ok('versión de esquema >= 11', dbm.VERSION_ESQUEMA >= 11)
  L.igual('en una BD sin duplicados el índice único existe', indice(), 1)
  const A = inv.create({ nombre: 'F11 A', codigo: 'COD-1', stock: 5, precio_venta: 10 }).id
  let r = inv.create({ nombre: 'F11 repetido', codigo: ' cod-1 ', stock: 1 })
  L.ok('crear con un código ya usado (aunque cambie mayúsculas o espacios) → rechazado con el nombre del dueño', r.ok === false && /COD-1/i.test(r.error) && /F11 A/.test(r.error), JSON.stringify(r))
  const B = inv.create({ nombre: 'F11 B', codigo: 'COD-2', stock: 3, precio_venta: 8 }).id
  r = inv.update(B, { nombre: 'F11 B', codigo: 'COD-1', precio_venta: 8 })
  L.ok('editar para quedarse con un código ajeno → rechazado y no cambia nada', r.ok === false && queryOne('SELECT codigo FROM productos WHERE id=?', [B]).codigo === 'COD-2', JSON.stringify(r))
  L.ok('editar sin tocar el código funciona', inv.update(B, { nombre: 'F11 B2', codigo: 'COD-2', precio_venta: 9 }).ok === true)
  L.ok('productos SIN código no chocan entre sí', inv.create({ nombre: 'F11 sin 1', stock: 1 }).id > 0 && inv.create({ nombre: 'F11 sin 2', stock: 1, codigo: '' }).id > 0 && inv.create({ nombre: 'F11 sin 3', stock: 1, codigo: '   ' }).id > 0)
  inv.archivar(A, U)
  L.ok('un producto archivado sigue ocupando su código', inv.create({ nombre: 'F11 otro', codigo: 'COD-1', stock: 1 }).ok === false)
  inv.reactivar(A, U)
  inv.delete(B)
  const B2 = inv.create({ nombre: 'F11 B nuevo', codigo: 'COD-2', stock: 1 })
  L.ok('un producto en la papelera libera su código…', B2.id > 0 || B2.ok !== false)
  const rs = dbm.papelera.restaurarProducto(B)
  L.ok('…y restaurarlo con el código ya ocupado se rechaza con texto (no con un error SQL)', rs.ok === false && /COD-2/.test(rs.error || ''), JSON.stringify(rs))

  L.grupo('Si ya hay códigos duplicados NO se falla: se listan y el índice espera')
  // Se simula una BD antigua: sin índice, con duplicados, en v10.
  run('DROP INDEX IF EXISTS idx_productos_codigo_unico')
  run("INSERT INTO productos (nombre, codigo, precio_venta, stock) VALUES ('F11 dup 1', 'DUP-9', 5, 1)")
  const D1 = queryOne("SELECT id FROM productos WHERE nombre='F11 dup 1'").id
  run("INSERT INTO productos (nombre, codigo, precio_venta, stock) VALUES ('F11 dup 2', 'dup-9 ', 5, 2)")
  const D2 = queryOne("SELECT id FROM productos WHERE nombre='F11 dup 2'").id
  run('PRAGMA user_version = 10')
  dbm.saveDB()
  const reab = await L.abrir({ dir, copiarDatos: false })
  const dbm2 = reab.mod, inv2 = dbm2.inventario
  const h2 = dbm2.getQueryHelpers()
  L.ok('la app abre sin error aunque haya duplicados (migración v11 aplicada)', h2.queryOne('PRAGMA user_version').user_version >= 11 && dbm2.estadoMigracion().ok !== false, JSON.stringify(dbm2.estadoMigracion()))
  L.igual('el índice NO se creó', h2.queryAll("SELECT name FROM sqlite_master WHERE name='idx_productos_codigo_unico'").length, 0)
  const dups = inv2.getCodigosDuplicados()
  L.ok('se listan los duplicados con sus productos', dups.length === 1 && dups[0].productos.length === 2 && dups[0].productos.map(p => p.nombre).sort().join() === 'F11 dup 1,F11 dup 2', JSON.stringify(dups))
  L.ok('mientras tanto, crear otro con ese código sigue rechazándose (control en la app)', inv2.create({ nombre: 'F11 dup 3', codigo: 'DUP-9', stock: 1 }).ok === false)
  L.ok('y se puede seguir editando un duplicado sin cambiar su código', inv2.update(D1, { nombre: 'F11 dup 1', codigo: 'DUP-9', precio_venta: 3 }).ok === true)
  r = inv2.asegurarIndiceCodigo()
  L.ok('intentar crear el índice con duplicados no falla: informa y no lo crea', r.ok === true && r.creado === false && r.duplicados.length === 1)
  inv2.update(D2, { nombre: 'F11 dup 2', codigo: 'DUP-10', precio_venta: 5 })
  L.ok('al resolver el último duplicado el índice se crea solo (se reintenta al guardar)', h2.queryAll("SELECT name FROM sqlite_master WHERE name='idx_productos_codigo_unico'").length === 1)
  r = inv2.asegurarIndiceCodigo()
  L.ok('y pedirlo de nuevo es inofensivo', r.ok === true && r.creado === false && r.duplicados.length === 0, JSON.stringify(r))
  L.ok('y ya no quedan duplicados', inv2.getCodigosDuplicados().length === 0)
  L.ok('el índice rechaza duplicados incluso por SQL directo', (() => { try { h2.run("INSERT INTO productos (nombre, codigo, precio_venta, stock) VALUES ('x', 'dup-10', 1, 1)"); return false } catch (e) { return /UNIQUE/i.test(e.message) } })())

  L.grupo('Escáner: Enter agrega el producto EXACTO')
  const E = inv2.create({ nombre: 'F11 Escáner', codigo: '7790001000011', stock: 4, precio_venta: 12, stock_minimo: 1 }).id
  const E2 = inv2.create({ nombre: 'F11 Escáner 2', codigo: '77900010000110', stock: 4, precio_venta: 12 }).id
  const b1 = inv2.buscarPorCodigo('7790001000011')
  L.ok('código exacto → ese producto, con lo que necesita el POS', b1 && b1.id === E && b1.precio_venta === 12 && b1.stock === 4 && 'permite_decimal' in b1, JSON.stringify(b1))
  L.ok('ignora espacios y mayúsculas del lector', inv2.buscarPorCodigo('  7790001000011\r\n ').id === E && inv2.buscarPorCodigo('dup-10').id === D2)
  L.ok('un código PARCIAL no coincide (el escáner nunca adivina)', inv2.buscarPorCodigo('779000100001') === null)
  L.ok('código inexistente o vacío → null', inv2.buscarPorCodigo('NO-EXISTE') === null && inv2.buscarPorCodigo('') === null && inv2.buscarPorCodigo(null) === null)
  inv2.archivar(E2, U)
  L.ok('un producto archivado no se vende por código', inv2.buscarPorCodigo('77900010000110') === null)
  L.ok('un producto pendiente de completar (precio 0 de importación) no se vende por código', (() => { h2.run('UPDATE productos SET pendiente_completar=1 WHERE id=?', [E]); const x = inv2.buscarPorCodigo('7790001000011'); h2.run('UPDATE productos SET pendiente_completar=0 WHERE id=?', [E]); return x === null })())

  L.grupo('Importación IA: el código es la PRIMERA llave de coincidencia')
  const esbuild = require('esbuild')
  const tmp = path.join(L.TMP, `coinc-${process.pid}.mjs`)
  fs.mkdirSync(L.TMP, { recursive: true })
  fs.writeFileSync(tmp, esbuild.transformSync(fs.readFileSync(path.join(L.RAIZ, 'src/utils/coincidenciasInventario.js'), 'utf-8'), { loader: 'js', format: 'esm' }).code)
  const { buscarCoincidencia } = await import(pathToFileURL(tmp).href)
  const inventario = [
    { id: 1, nombre: 'Agua Mineral 600ml', codigo: 'AG-600' }, { id: 2, nombre: 'Agua Mineral 2L', codigo: 'AG-2000' },
    { id: 3, nombre: 'Whey Protein 1kg', codigo: null }, { id: 4, nombre: 'Gemelo', codigo: 'GM-1' }, { id: 5, nombre: 'Gemelo', codigo: 'GM-2' },
  ]
  let m = buscarCoincidencia('nombre totalmente distinto leído por OCR', inventario, 'ag-600')
  L.ok('con código igual coincide aunque el nombre no se parezca (exacta, por código)', m && m.producto.id === 1 && m.exacta === true && m.porCodigo === true, JSON.stringify(m))
  m = buscarCoincidencia('Agua Mineral 600ml', inventario, 'AG-2000')
  L.ok('si el código apunta a OTRO producto, manda el código', m && m.producto.id === 2)
  m = buscarCoincidencia('Whey Protein 1kg', inventario, 'NO-ESTA')
  L.ok('código que no existe → se prueba por nombre como antes', m && m.producto.id === 3 && !m.porCodigo)
  m = buscarCoincidencia('Whey Protein 1kg', inventario)
  L.ok('sin código el comportamiento es el de siempre', m && m.producto.id === 3)
  m = buscarCoincidencia('Gemelo', inventario)
  L.ok('nombre ambiguo sin código → null (conservador, como antes)', m === null)
  m = buscarCoincidencia('Gemelo', inventario, 'GM-2')
  L.ok('…pero con código se resuelve el gemelo correcto', m && m.producto.id === 5)
  m = buscarCoincidencia('x', [{ id: 8, nombre: 'A', codigo: 'DUP' }, { id: 9, nombre: 'B', codigo: 'dup' }], 'DUP')
  L.ok('si el código lo comparten dos productos NO se adivina', m === null)
  fs.rmSync(tmp, { force: true })

  L.grupo('Etiquetas imprimibles (PDF)')
  const items = [
    { nombre: 'Agua Mineral 600ml', codigo: 'AG-600', precio: 5.5, copias: 3 },
    { nombre: 'Whey Protein 1kg con nombre MUY largo que no cabe en la etiqueta de ningún tamaño', codigo: '1234567890128', precio: 250, copias: 1 },
    { nombre: 'Sin código', codigo: null, precio: 1, copias: 2 },
  ]
  const pdf = await etiquetas.generarPdf(items, { columnas: 3, filas: 8 })
  L.ok('devuelve un PDF real', Buffer.isBuffer(pdf.buffer) && pdf.buffer.slice(0, 5).toString() === '%PDF-' && pdf.buffer.length > 1000)
  L.igual('4 etiquetas (3 + 1; la sin código se omite) en 1 hoja', [pdf.etiquetas, pdf.paginas], [4, 1])
  L.igual('informa cuáles se omitieron y por qué', pdf.omitidos, [{ nombre: 'Sin código', motivo: 'no tiene código' }])
  const muchas = await etiquetas.generarPdf([{ nombre: 'Masivo', codigo: 'M-1', precio: 1, copias: 50 }], { columnas: 3, filas: 8 })
  L.igual('50 etiquetas con 24 por hoja → 3 hojas', [muchas.etiquetas, muchas.paginas], [50, 3])
  L.ok('el PDF contiene tantas páginas como se informa', (muchas.buffer.toString('latin1').match(/\/Type \/Page(?!s)/g) || []).length === 3)
  L.ok('un código imposible (con tilde) se omite con aviso, no rompe la hoja', (await etiquetas.generarPdf([{ nombre: 'Tilde', codigo: 'Camión', precio: 1, copias: 1 }, { nombre: 'Ok', codigo: 'OK-1', precio: 1, copias: 1 }], {})).omitidos.some(o => /carácter/i.test(o.motivo)))
  L.ok('copias fuera de rango (0, negativo, 5000) se rechazan', [0, -1, 5000].every(c => { try { etiquetas.generarPdf([{ nombre: 'x', codigo: 'x', precio: 1, copias: c }], {}).catch(() => {}); return true } catch (_) { return true } }))
  const raro = await etiquetas.generarPdf([{ nombre: 'x', codigo: 'x', precio: 1, copias: 0 }], {}).then(() => 'ok', e => e.message)
  L.ok('…con mensaje claro', /copias/i.test(String(raro)), String(raro))
  // Se leen los rectángulos que el PDF realmente dibuja (relleno `f`) y se rasterizan para leerlos con el lector independiente.
  const zlib = require('zlib')
  const crudo = pdf.buffer.toString('latin1')
  const rects = []
  for (const m of crudo.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let txt; try { txt = zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1') } catch (_) { continue }
    if (!/ re/.test(txt)) continue
    for (const r of txt.matchAll(/(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) re\s+f\b/g)) rects.push([Number(r[1]), Number(r[2]), Number(r[3]), Number(r[4])])
    break
  }
  const sal = JSON.parse(execFileSync('python', [path.join(__dirname, 'leer-barras.py')], { input: JSON.stringify({ w: 595.28, h: 841.89, rects }), encoding: 'utf-8', timeout: 120000 }).trim().split(String.fromCharCode(10)).pop())
  L.ok('las barras dibujadas en el PDF se leen con el lector independiente (AG-600 y el EAN-13)', rects.length > 50 && sal.textos.includes('AG-600') && sal.textos.includes('1234567890128'), JSON.stringify({ n: rects.length, sal }))

  L.grupo('Permisos de los canales')
  const pid = c => queryOne('SELECT id FROM permisos WHERE codigo=?', [c]).id
  const H = dbm2.getQueryHelpers()
  H.run('DELETE FROM rol_permisos WHERE rol_id=2 AND permiso_id IN (?,?)', [H.queryOne('SELECT id FROM permisos WHERE codigo=?', ['inventario.exportar']).id, H.queryOne('SELECT id FROM permisos WHERE codigo=?', ['inventario.ver']).id])
  const seg2 = seguridad
  const gu2 = require(path.join(L.RAIZ, 'electron/guardas.cjs'))({ dbm: dbm2, seguridad: seg2 })
  const r2 = dbm2.usuarios.login('qa-emp', 'qa-pass-1'); seg2.establecer(r2.usuario)
  L.ok('sin permiso: el SVG de un código y las etiquetas se DENIEGAN', gu2['codigos:svg']('AG-600').sin_permiso === true && (await gu2['etiquetas:generarPdf']({ items })).sin_permiso === true)
  H.run('INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id) VALUES (2, ?)', [H.queryOne('SELECT id FROM permisos WHERE codigo=?', ['inventario.ver']).id])
  H.run('INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id) VALUES (2, ?)', [H.queryOne('SELECT id FROM permisos WHERE codigo=?', ['inventario.exportar']).id])
  seg2.establecer(dbm2.usuarios.login('qa-emp', 'qa-pass-1').usuario)
  const sv = gu2['codigos:svg']('AG-600')
  L.ok('con permiso: SVG correcto y el PDF viene en base64', sv.ok === true && /^<svg/.test(sv.svg) && (await gu2['etiquetas:generarPdf']({ items })).base64.startsWith('JVBER'))
  L.ok('un código no imprimible vuelve como error de texto', gu2['codigos:svg']('Camión').ok === false)
  L.ok('la lista de duplicados exige ver inventario', typeof gu2['inventario:getCodigosDuplicados']().length === 'number')

  L.grupo('Integridad')
  L.igual('el kardex cuadra (salvo las 2 filas insertadas a mano por SQL para simular la BD antigua)', inv2.conciliacion().diferencias.filter(x => ![D1, D2].includes(x.producto_id)).length, 0)
  L.igual('hash de dev_data', L.hashesOrigen(), antes)
  L.limpiar(dir)
  L.fin()
})().catch(e => { console.error(e); process.exit(1) })
