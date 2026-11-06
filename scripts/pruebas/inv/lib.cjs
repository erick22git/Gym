// Utilidades de las pruebas del Sprint 4B (inventario). Cargan electron/database.cjs en Node puro
// (con `electron` simulado) sobre una COPIA de dev_data en D:\Erick\tmp-4b. Nunca tocan dev_data ni una BD real.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const Module = require('module')

const RAIZ = path.resolve(__dirname, '../../..')
const TMP = process.env.GYM_TMP_4B || 'D:\\Erick\\tmp-4b'
const ORIGEN = path.join(RAIZ, 'dev_data')

const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
const hashesOrigen = () => Object.fromEntries(fs.readdirSync(ORIGEN).map(f => [f, sha(path.join(ORIGEN, f))]))

// `electron` simulado: database.cjs solo usa app.isPackaged y app.getPath.
const cargarOriginal = Module._load
Module._load = function (req, ...resto) {
  if (req === 'electron') return { app: { isPackaged: false, getPath: () => TMP }, dialog: {}, ipcMain: { handle() {} } }
  return cargarOriginal.call(this, req, ...resto)
}

let contador = 0
function dirNuevo(etiqueta) {
  fs.mkdirSync(TMP, { recursive: true })
  const d = path.join(TMP, `${etiqueta}-${process.pid}-${++contador}-${Date.now()}`)
  fs.mkdirSync(d, { recursive: true })
  return d
}

// Copia de dev_data (con datos) o BD vacía. Devuelve el módulo database.cjs ya inicializado.
async function abrir({ etiqueta = 't', copiarDatos = true, dir, env = {} } = {}) {
  const d = dir || dirNuevo(etiqueta)
  if (copiarDatos && !dir) {
    for (const f of fs.readdirSync(ORIGEN)) fs.copyFileSync(path.join(ORIGEN, f), path.join(d, f))
  }
  process.env.GYM_DATA_DIR = d
  for (const [k, v] of Object.entries(env)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
  const ruta = require.resolve(path.join(RAIZ, 'electron/database.cjs'))
  delete require.cache[ruta]
  const mod = require(ruta)
  await mod.initDB()
  return { mod, dir: d, archivo: path.join(d, 'urbanfitness.db') }
}

function limpiar(...dirs) { for (const d of dirs) { try { fs.rmSync(d, { recursive: true, force: true }) } catch (_) {} } }

// Mini marco de pruebas
const res = []
let actual = ''
function grupo(n) { actual = n; console.log('\n' + n) }
function ok(nombre, cond, nota = '') {
  res.push({ grupo: actual, nombre, ok: !!cond })
  console.log(`  ${cond ? '✔' : '✘ FALLA'} ${nombre}${!cond && nota ? '  → ' + nota : ''}`)
}
function igual(nombre, a, b) { ok(nombre, JSON.stringify(a) === JSON.stringify(b), `obtenido ${JSON.stringify(a)}, esperado ${JSON.stringify(b)}`) }
function cerca(nombre, a, b, tol = 1e-9) { ok(nombre, Math.abs(a - b) <= tol, `obtenido ${a}, esperado ${b}`) }
function fin() {
  const malos = res.filter(r => !r.ok)
  console.log(`\n${res.length - malos.length}/${res.length} comprobaciones correctas`)
  if (malos.length) { console.log('FALLARON:'); malos.forEach(m => console.log(` - [${m.grupo}] ${m.nombre}`)); process.exitCode = 1 } else console.log('Todo correcto')
}

// Consultas directas sobre la BD abierta (solo lectura de pruebas)
function helpers(mod) {
  const { queryAll, queryOne } = mod.getQueryHelpers()
  return { queryAll, queryOne }
}

module.exports = { RAIZ, TMP, ORIGEN, sha, hashesOrigen, abrir, limpiar, dirNuevo, grupo, ok, igual, cerca, fin, helpers }
