// Ejecuta todas las pruebas de datos del Sprint 4B (npm run test:inv). Cada archivo faseN-*.cjs corre en su propio proceso.
const { spawnSync } = require('child_process')
const fs = require('fs'), path = require('path')
const archivos = fs.readdirSync(__dirname).filter(f => /^fase\d+.*\.cjs$/.test(f)).sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]))
let mal = 0
for (const f of archivos) {
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf-8' })
  const ult = (r.stdout || '').trim().split('\n').slice(-2).join(' | ')
  console.log(`${r.status === 0 ? '✔' : '✘'} ${f}  ${ult}`)
  if (r.status !== 0) { mal++; console.log(r.stdout.split('\n').filter(l => /FALLA|FALLARON|^ - /.test(l)).join('\n'), r.stderr) }
}
process.exit(mal ? 1 : 0)
