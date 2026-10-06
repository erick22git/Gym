// Verifica que los dos colores prohibidos de Lusion no aparezcan en NINGÚN CSS/JS/SVG del proyecto (ni hex ni rgb),
// ni en los paquetes de efectos (border-beam, thinking-orbs, bot-avatars). Sale con código 1 si encuentra alguno.
// Uso: node scripts/pruebas/verificar-colores-prohibidos.cjs
const fs = require('fs'), path = require('path')
const RAIZ = path.join(__dirname, '..', '..')
const PATRON = /1a2ffb|c1ff00|rgba?\(\s*26\s*,\s*47\s*,\s*251\b|rgba?\(\s*193\s*,\s*255\s*,\s*0\b/i
const EXT = /\.(css|js|jsx|ts|tsx|svg|html|json|cjs|mjs)$/i
const carpetas = ['src', 'public', 'electron', 'index.html', 'node_modules/border-beam', 'node_modules/thinking-orbs', 'node_modules/bot-avatars']
let n = 0, archivos = 0
function recorre(p) {
  if (!fs.existsSync(p)) return
  const st = fs.statSync(p)
  if (st.isDirectory()) { if (/frames$/.test(p)) return; for (const f of fs.readdirSync(p)) recorre(path.join(p, f)); return }
  if (!EXT.test(p)) return
  archivos++
  const t = fs.readFileSync(p, 'utf8')
  const m = t.match(PATRON)
  if (m) { n++; console.log('ENCONTRADO', path.relative(RAIZ, p), m[0]) }
}
carpetas.forEach(c => recorre(path.join(RAIZ, c)))
console.log(`${archivos} archivos revisados, ${n} con colores prohibidos`)
process.exit(n ? 1 : 0)
