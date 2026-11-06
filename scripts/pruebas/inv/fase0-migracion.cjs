// FASE 0 — migración versionada + respaldo previo + verificación de conteos. (npm run test:inv)
const fs = require('fs')
const path = require('path')
const L = require('./lib.cjs')

;(async () => {
  const antes = L.hashesOrigen()
  const limpieza = []

  L.grupo('Migración sobre una copia con datos (user_version 0 → versión actual)')
  const a = await L.abrir({ etiqueta: 'f0-a' }); limpieza.push(a.dir)
  const hashCopia = L.sha(a.archivo.replace(/urbanfitness\.db$/, 'urbanfitness.db'))
  const est = a.mod.estadoMigracion()
  const q = L.helpers(a.mod)
  L.ok('la migración se aplicó', est.migrada === true && est.ok === true, JSON.stringify(est))
  L.ok('PRAGMA user_version = versión actual', q.queryOne('PRAGMA user_version').user_version === a.mod.VERSION_ESQUEMA)
  const dirResp = path.join(a.dir, 'respaldos-migracion')
  const resp = fs.existsSync(dirResp) ? fs.readdirSync(dirResp).filter(f => f.endsWith('.db')) : []
  L.ok('se creó exactamente 1 respaldo previo', resp.length === 1, JSON.stringify(resp))
  // El respaldo es el archivo original (cifrado) tal cual estaba antes de abrir: su hash debe coincidir con dev_data
  const hashOrig = antes['urbanfitness.db']
  L.ok('el respaldo es idéntico al archivo original (byte a byte)', resp.length === 1 && L.sha(path.join(dirResp, resp[0])) === hashOrig)
  const cuentaResp = resp.length ? a.mod.contarDesdeArchivo(path.join(dirResp, resp[0])) : null
  const cuentaAhora = a.mod.contarTablasClave()
  L.igual('conteos y suma de stock idénticos antes/después', cuentaAhora, cuentaResp)
  L.ok('hay datos reales que comparar (productos > 0)', cuentaAhora.productos > 0, JSON.stringify(cuentaAhora))

  L.grupo('Idempotencia: reabrir no vuelve a migrar ni a respaldar')
  const b = await L.abrir({ dir: a.dir })
  const est2 = b.mod.estadoMigracion()
  const resp2 = fs.readdirSync(dirResp).filter(f => f.endsWith('.db'))
  L.ok('segunda apertura: no migra', est2.migrada === false && est2.ok === true, JSON.stringify(est2))
  L.ok('segunda apertura: sigue habiendo 1 solo respaldo', resp2.length === 1, JSON.stringify(resp2))
  L.ok('user_version estable', L.helpers(b.mod).queryOne('PRAGMA user_version').user_version === b.mod.VERSION_ESQUEMA)
  L.igual('conteos estables', b.mod.contarTablasClave(), cuentaAhora)

  L.grupo('Fallo simulado: se restaura y se avisa, sin perder datos')
  const c = await L.abrir({ etiqueta: 'f0-c', env: { GYM_MIGRACION_FALLA: '1' } }); limpieza.push(c.dir)
  const est3 = c.mod.estadoMigracion()
  L.ok('la migración falló y se informa', est3.ok === false && !!est3.error, JSON.stringify(est3))
  L.ok('user_version NO avanzó', L.helpers(c.mod).queryOne('PRAGMA user_version').user_version === 0)
  L.igual('los datos siguen idénticos al original', c.mod.contarTablasClave(), cuentaResp)
  const dirRespC = path.join(c.dir, 'respaldos-migracion')
  const respC = fs.existsSync(dirRespC) ? fs.readdirSync(dirRespC).filter(f => f.endsWith('.db')) : []
  L.ok('el respaldo previo existe y es el original', respC.length === 1 && L.sha(path.join(dirRespC, respC[0])) === hashOrig)
  const aud = L.helpers(c.mod).queryOne("SELECT COUNT(*) n FROM auditoria WHERE accion='MIGRACION_FALLIDA'")
  L.ok('quedó registrado en auditoría', aud.n === 1, JSON.stringify(aud))
  // Tras corregir la causa, la siguiente apertura sí migra (sin perder nada)
  const d = await L.abrir({ dir: c.dir, env: { GYM_MIGRACION_FALLA: undefined } })
  L.ok('reabrir sin el fallo migra bien', d.mod.estadoMigracion().ok === true && d.mod.estadoMigracion().migrada === true)
  L.igual('y los conteos siguen iguales', d.mod.contarTablasClave(), cuentaResp)

  L.grupo('BD nueva (sin archivo previo)')
  const e = await L.abrir({ etiqueta: 'f0-e', copiarDatos: false }); limpieza.push(e.dir)
  L.ok('queda en la versión actual', L.helpers(e.mod).queryOne('PRAGMA user_version').user_version === e.mod.VERSION_ESQUEMA)
  const dirRespE = path.join(e.dir, 'respaldos-migracion')
  L.ok('no hace respaldo (no había nada que proteger)', !fs.existsSync(dirRespE) || fs.readdirSync(dirRespE).length === 0)

  L.grupo('Los datos originales no cambiaron')
  L.igual('hash de dev_data idéntico', L.hashesOrigen(), antes)
  L.limpiar(...limpieza)
  L.fin()
})().catch(e => { console.error(e); process.exit(1) })
