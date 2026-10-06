// Contraste WCAG de los pares de tokens de las apariencias Lusion (ver DISENO.md §6). Uso: node scripts/pruebas/contraste-tokens.cjs
const lum = h => { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * r + .7152 * g + .0722 * b }
const cr = (a, b) => { const x = lum(a), y = lum(b); return +((Math.max(x, y) + .05) / (Math.min(x, y) + .05)).toFixed(2) }
const T = { lavender: '#f0f1fa', paper: '#ffffff', ink: '#000000', graphite: '#2b2e3a', haze: '#e4e6ef', slate: '#34393f', forest: '#34785c', crimson: '#cf2d56', amber: '#c08532' }
const A = {
  'Lusion Claro': { lienzo: T.lavender, superficie: T.paper, superficie2: T.haze, texto: T.ink, suave: T.graphite, accion: T.graphite, accionTxt: T.paper, borde: T.haze, foco: T.ink },
  'Lusion Oscuro': { lienzo: T.ink, superficie: T.graphite, superficie2: T.slate, texto: T.paper, suave: T.haze, accion: T.paper, accionTxt: T.ink, borde: T.slate, foco: T.paper },
}
for (const [n, a] of Object.entries(A)) {
  console.log('##', n)
  const f = (x, y, req) => console.log(`${x.padEnd(26)} sobre ${y.padEnd(14)} ${String(cr(a[x.split(' ')[0]] || T[x], a[y] || T[y])).padStart(6)}:1  ${cr(a[x.split(' ')[0]] || T[x], a[y] || T[y]) >= req ? 'AA ✓' : 'AA ✗'}  (mín. ${req})`)
  f('texto', 'lienzo', 4.5); f('texto', 'superficie', 4.5); f('texto', 'superficie2', 4.5)
  f('suave', 'lienzo', 4.5); f('suave', 'superficie', 4.5); f('suave', 'superficie2', 4.5)
  f('accionTxt', 'accion', 4.5)
  f('foco', 'lienzo', 3); f('foco', 'superficie', 3)
  f('borde', 'lienzo', 1); f('borde', 'superficie', 1)
  for (const s of ['forest', 'crimson', 'amber']) { f(s, 'lienzo', 4.5); f(s, 'superficie', 4.5) }
}
