// Motor de la apariencia opaca (Oscuro / Claro) para TODA la app.
// La app tiene miles de estilos en línea pensados para vidrio sobre video (colores claros, rgba translúcidos, degradados).
// En vez de reescribirlos página por página, este motor recorre el DOM cuando la apariencia es Oscuro o Claro y:
//   1. quita degradados y vuelve opacas las superficies cuya polaridad contradice la apariencia (oscuras en Claro, claras en Oscuro);
//   2. garantiza el contraste del texto y de los iconos contra su fondo REAL (AA 4.5:1; AAA 7:1 con «Alto contraste»), cambiando
//      solo el color que no llega (los que ya llegan conservan su tono);
//   3. vuelve a procesar lo que React agrega o cambia (MutationObserver).
// Al volver a Transparente revierte todo lo que tocó (los estilos originales se restauran). Transparente nunca se procesa.
import { aparienciaStore, esOpaca } from './apariencia'
import { dispositivoStore } from './dispositivo'

const TOCADO = 'data-ap'
const originales = new WeakMap()          // el → { prop: [valor, prioridad] }
const cacheColor = new Map()
let ctx2d = null
let observador = null
let pendientes = new Set()
let programado = false
let activo = false

// ── Color ────────────────────────────────────────────────────────────────────
function parsear(c) {
  if (!c || c === 'transparent') return [0, 0, 0, 0]
  let r = cacheColor.get(c)
  if (r) return r
  if (!ctx2d) { const cv = document.createElement('canvas'); cv.width = cv.height = 1; ctx2d = cv.getContext('2d', { willReadFrequently: true }) }
  ctx2d.clearRect(0, 0, 1, 1); ctx2d.fillStyle = '#000'; ctx2d.fillStyle = c; ctx2d.fillRect(0, 0, 1, 1)
  const d = ctx2d.getImageData(0, 0, 1, 1).data
  r = [d[0], d[1], d[2], d[3] / 255]
  if (cacheColor.size > 4000) cacheColor.clear()
  cacheColor.set(c, r)
  return r
}
const sobre = (f, b) => { const a = f[3]; return [f[0] * a + b[0] * (1 - a), f[1] * a + b[1] * (1 - a), f[2] * a + b[2] * (1 - a), 1] }
const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])
const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
const saturado = c => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) > 45

// ── Tokens vigentes ──────────────────────────────────────────────────────────
function tokens() {
  const cs = getComputedStyle(document.documentElement)
  const t = n => parsear(cs.getPropertyValue(n).trim())
  return { fondo: t('--ap-fondo'), texto: t('--ap-texto'), sup: t('--ap-sup'), sup2: t('--ap-sup2'), accion: t('--ap-accion'), accionTexto: t('--ap-accion-texto') }
}

// ── Estilos con reversión ────────────────────────────────────────────────────
function poner(el, prop, valor) {
  let o = originales.get(el)
  if (!o) { o = {}; originales.set(el, o) }
  if (!(prop in o)) o[prop] = [el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)]
  el.style.setProperty(prop, valor, 'important')
  el.setAttribute(TOCADO, '1')
}
function revertir() {
  document.querySelectorAll('[' + TOCADO + ']').forEach(el => {
    const o = originales.get(el)
    if (o) for (const [p, [v, pr]] of Object.entries(o)) { if (v) el.style.setProperty(p, v, pr); else el.style.removeProperty(p) }
    originales.delete(el); el.removeAttribute(TOCADO)
  })
}

// ── Recorrido ────────────────────────────────────────────────────────────────
const SALTAR = new Set(['SCRIPT', 'STYLE', 'IMG', 'CANVAS', 'VIDEO', 'PICTURE', 'LINK', 'META', 'NOSCRIPT', 'BR', 'HR', 'PATH', 'DEFS', 'G', 'CIRCLE', 'RECT', 'LINE', 'POLYLINE', 'POLYGON', 'ELLIPSE'])
const esBoton = el => el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button'
const tieneTextoPropio = el => { for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true; return false }

function fondoDe(el, tk, cache) {
  if (cache.has(el)) return cache.get(el)
  const padre = el.parentElement
  const base = padre ? fondoDe(padre, tk, cache) : tk.fondo
  const cs = getComputedStyle(el)
  const own = parsear(cs.backgroundColor)
  const r = own[3] > 0 ? sobre(own, base) : base
  cache.set(el, r)
  return r
}

function procesarElemento(el, tk, opc, cache) {
  const cs = getComputedStyle(el)
  if (cs.display === 'none' || cs.visibility === 'hidden') return
  const polOscura = opc.apariencia === 'oscuro'

  // 1) superficies
  let cambioFondo = false
  if (cs.backgroundImage && cs.backgroundImage.includes('gradient')) { poner(el, 'background-image', 'none'); cambioFondo = true }
  const own = parsear(cs.backgroundColor)
  const peq = el.offsetWidth <= 30 && el.offsetHeight <= 30
  if (!polOscura && !peq && own[3] > 0.04 && lum(own) < 0.35) {
    // vidrio oscuro translúcido (rgba(10,12,15,.5)…) sobre fondo claro se vería como un panel gris pesado: pasa a superficie blanca
    poner(el, 'background-color', 'var(--ap-sup)'); cambioFondo = true
  } else if (own[3] >= 0.5 && !peq) {
    const padreEf = el.parentElement ? fondoDe(el.parentElement, tk, cache) : tk.fondo
    const comp = sobre(own, padreEf), L = lum(comp)
    const contradice = polOscura ? L > 0.5 : L < 0.4
    if (contradice) {
      if (esBoton(el) || saturado(own)) { poner(el, 'background-color', 'var(--ap-accion)'); poner(el, 'color', 'var(--ap-accion-texto)') }
      else poner(el, 'background-color', 'var(--ap-sup)')
      cambioFondo = true
    }
  }
  if (cambioFondo) cache.delete(el)

  // 2) texto / iconos
  const texto = tieneTextoPropio(el) || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || [...el.children].some(h => h.tagName === 'svg' || h.tagName === 'SVG')
  if (texto) {
    if (cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)') poner(el, '-webkit-text-fill-color', 'currentColor')
    const ef = fondoDe(el, tk, cache)
    const fg0 = parsear(cs.color)
    const fg = fg0[3] < 1 ? sobre(fg0, ef) : fg0
    const px = parseFloat(cs.fontSize) || 16, bold = (parseInt(cs.fontWeight) || 400) >= 700
    const grande = px >= 24 || (px >= 18.66 && bold)
    const objetivo = opc.altoContraste ? (grande ? 4.5 : 7) : (grande ? 3 : 4.5)
    if (contraste(fg, ef) < objetivo) {
      const cT = contraste(tk.texto, ef), cI = contraste(opc.invertido, ef)
      poner(el, 'color', cT >= cI ? 'var(--ap-texto)' : 'var(--ap-texto-inv)')
      // ni el mejor color de texto llega al objetivo sobre ese fondo (etiquetas de color): la superficie pasa a la de acción (siempre ≥ 7:1)
      if (Math.max(cT, cI) < objetivo && parsear(cs.backgroundColor)[3] >= 0.5) { poner(el, 'background-color', 'var(--ap-accion)'); poner(el, 'color', 'var(--ap-accion-texto)') }
    }
  }
}

function procesarRaiz(raiz, opc) {
  if (!(raiz instanceof Element) || !document.contains(raiz)) return
  const tk = tokens(), cache = new Map()
  const lista = [raiz, ...raiz.querySelectorAll('*')]
  for (const el of lista) {
    if (SALTAR.has(el.tagName.toUpperCase())) continue
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'text' && el.tagName.toLowerCase() !== 'tspan') continue
    if (el.closest('[data-ap-ignorar]')) continue
    procesarElemento(el, tk, opc, cache)
  }
  // texto SVG (gráficos): el color es el atributo fill
  raiz.querySelectorAll('svg text, svg tspan').forEach(t => {
    const cs = getComputedStyle(t), fg = parsear(cs.fill)
    const ef = fondoDe(t.closest('svg').parentElement || document.body, tk, cache)
    if (fg[3] > 0 && contraste(sobre(fg, ef), ef) < (opc.altoContraste ? 7 : 4.5)) poner(t, 'fill', 'var(--ap-texto)')
  })
}

function opciones() {
  const ap = aparienciaStore.get().apariencia === 'claro' ? 'claro' : 'oscuro' // en Transparente + Alto contraste se usa la polaridad oscura
  return { apariencia: ap, altoContraste: dispositivoStore.get().altoContraste, invertido: ap === 'oscuro' ? [0, 0, 0, 1] : [255, 255, 255, 1] }
}

function vaciar() {
  programado = false
  if (!activo) return
  const t0 = performance.now(), opc = opciones()
  const raices = [...pendientes].filter(n => n.isConnected); pendientes = new Set()
  observador && observador.disconnect()
  try {
    const filtradas = raices.filter(r => !raices.some(o => o !== r && o.contains(r)))
    for (const r of filtradas) procesarRaiz(r, opc)
  } finally { reconectar() }
  window.__motorApariencia = { ...(window.__motorApariencia || {}), pasadas: ((window.__motorApariencia || {}).pasadas || 0) + 1, ultimoMs: Math.round(performance.now() - t0) }
}
function programar() { if (!programado) { programado = true; requestAnimationFrame(vaciar) } }
function reconectar() {
  if (!observador || !activo) return
  observador.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] })
}
function iniciarObservador() {
  if (observador) return
  observador = new MutationObserver(ms => {
    for (const m of ms) {
      if (m.type === 'childList') m.addedNodes.forEach(n => { if (n.nodeType === 1) pendientes.add(n) })
      else if (m.target.nodeType === 1 && !m.target.closest('.glass-root, [data-ap-ignorar]')) pendientes.add(m.target)   // el selector de vidrio del menú reescribe su style en cada cuadro
    }
    if (pendientes.size) programar()
  })
}

function sincronizar() {
  const ap = aparienciaStore.get().apariencia
  const debe = esOpaca(ap) || dispositivoStore.get().altoContraste // Alto contraste también fuerza superficies opacas en Transparente
  if (!debe) {
    if (activo) { activo = false; observador && observador.disconnect(); pendientes = new Set(); revertir() }
    return
  }
  activo = true
  iniciarObservador()
  revertir()                                   // cambio Oscuro↔Claro o de contraste: se parte de los estilos originales
  pendientes = new Set([document.body])
  vaciar()
}

export function iniciarMotorApariencia() {
  let ultimo = ''
  const reaccionar = () => {
    const k = aparienciaStore.get().apariencia + '|' + dispositivoStore.get().altoContraste
    if (k !== ultimo) { ultimo = k; requestAnimationFrame(sincronizar) }
  }
  aparienciaStore.suscribir(reaccionar); dispositivoStore.suscribir(reaccionar); reaccionar()
}
