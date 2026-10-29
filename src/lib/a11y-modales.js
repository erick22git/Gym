// Accesibilidad de ventanas modales (lector de pantalla y teclado) sin tocar cada modal de la app.
// Detecta capas fijas que cubren la pantalla y contienen controles (los modales de la app son capas `position: fixed; inset: 0`)
// y les da: role="dialog" + aria-modal + nombre (su primer encabezado), foco inicial dentro, trampa de Tab y, al cerrarse, devuelve el
// foco a quien lo abrió. No toca tooltips, avisos ni cajones que ya tienen su propio rol.
const FOCO = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
const vistos = new WeakMap() // capa → { opener }

const visible = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' }
function esModal(el) {
  if (!(el instanceof HTMLElement) || el.hasAttribute('role') || el.closest('[data-ap-ignorar]')) return false
  const cs = getComputedStyle(el)
  if (cs.position !== 'fixed' || cs.pointerEvents === 'none') return false
  const r = el.getBoundingClientRect()
  if (r.width < innerWidth * 0.9 || r.height < innerHeight * 0.9) return false
  if ((parseInt(cs.zIndex) || 0) < 100) return false
  return !!el.querySelector(FOCO)
}
function nombreDe(el) { const h = el.querySelector('h1,h2,h3,[role=heading]'); return (h && h.textContent.trim().slice(0, 80)) || 'Ventana' }

function activar(capa) {
  if (vistos.has(capa)) return
  const opener = document.activeElement && document.activeElement !== document.body ? document.activeElement : null
  vistos.set(capa, { opener })
  capa.setAttribute('role', 'dialog'); capa.setAttribute('aria-modal', 'true'); capa.setAttribute('aria-label', nombreDe(capa))
  capa.setAttribute('data-modal-a11y', '1')
  requestAnimationFrame(() => {
    if (capa.contains(document.activeElement)) return
    const primero = [...capa.querySelectorAll(FOCO)].find(visible)
    if (primero) primero.focus({ preventScroll: true })
  })
  capa.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return
    const lista = [...capa.querySelectorAll(FOCO)].filter(visible)
    if (!lista.length) return
    const a = document.activeElement, i = lista.indexOf(a)
    if (e.shiftKey && (i <= 0)) { e.preventDefault(); lista[lista.length - 1].focus() }
    else if (!e.shiftKey && (i === -1 || i === lista.length - 1)) { e.preventDefault(); lista[0].focus() }
  })
}
function devolverFoco(capa) {
  const v = vistos.get(capa); vistos.delete(capa)
  if (v && v.opener && document.contains(v.opener)) try { v.opener.focus({ preventScroll: true }) } catch { /* ya no existe */ }
}

export function iniciarA11yModales() {
  const revisar = nodo => {
    if (!(nodo instanceof HTMLElement)) return
    const cand = [nodo, ...nodo.querySelectorAll(':scope > div, :scope > div > div')]
    for (const c of cand) if (esModal(c)) { activar(c); break }
  }
  new MutationObserver(ms => {
    for (const m of ms) {
      m.addedNodes.forEach(n => requestAnimationFrame(() => revisar(n)))
      m.removedNodes.forEach(n => { if (n instanceof HTMLElement) { if (vistos.has(n)) devolverFoco(n); n.querySelectorAll && n.querySelectorAll('[data-modal-a11y]').forEach(devolverFoco) } })
    }
  }).observe(document.body, { childList: true, subtree: true })
}
