// Visor de recorridos guiados: oscurece la pantalla y recorta un "foco" sobre el elemento del paso. SOLO
// resalta: el hueco deja pasar los clics para que la PERSONA pulse el botón real; nunca se hace clic por ella.
// Cuatro paneles oscuros rodean el hueco (así el hueco queda realmente interactivo y sin máscaras costosas).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGuia, guiaStore, registrarPasoSinElemento } from '../../ia/guiaStore'
import { GUIAS } from '../../ia/guias'
import '../../ia/ia.css'

const MARGEN = 8
const ESPERA_MAX_MS = 2500

function rectDe(el) {
  const r = el.getBoundingClientRect()
  return { x: r.left - MARGEN, y: r.top - MARGEN, w: r.width + MARGEN * 2, h: r.height + MARGEN * 2 }
}

export default function VisorGuia() {
  const { guiaId, paso } = useGuia()
  const guia = guiaId ? GUIAS[guiaId] : null
  const p = guia?.pasos[paso]
  const [rect, setRect] = useState(null)       // null = sin elemento (texto de respaldo)
  const [buscando, setBuscando] = useState(true)
  const elRef = useRef(null)

  // Busca el elemento del paso (espera a que aparezca si acaba de cambiar de pantalla)
  useEffect(() => {
    if (!p) return
    setRect(null); setBuscando(true); elRef.current = null
    let vivo = true
    const t0 = Date.now()
    const buscar = () => {
      if (!vivo) return
      const el = document.querySelector(`[data-guide-id="${p.id}"]`)
      if (el) {
        elRef.current = el
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        setRect(rectDe(el)); setBuscando(false)
        return
      }
      if (Date.now() - t0 > ESPERA_MAX_MS) { registrarPasoSinElemento(guiaId, paso, p.id); setBuscando(false); return }
      setTimeout(buscar, 150)
    }
    buscar()
    return () => { vivo = false }
  }, [guiaId, paso])

  // Mantiene el foco sobre el elemento si la pantalla se mueve/redimensiona
  useEffect(() => {
    if (!elRef.current) return
    const act = () => elRef.current && document.contains(elRef.current) && setRect(rectDe(elRef.current))
    const iv = setInterval(act, 300)
    window.addEventListener('resize', act); window.addEventListener('scroll', act, true)
    return () => { clearInterval(iv); window.removeEventListener('resize', act); window.removeEventListener('scroll', act, true) }
  }, [rect !== null, guiaId, paso])

  // Si la persona pulsa el elemento resaltado, se avanza solo al paso siguiente
  useEffect(() => {
    const el = elRef.current
    if (!el || !guia) return
    const alClic = () => { if (paso < guia.pasos.length - 1) setTimeout(() => guiaStore.ir(paso + 1), 350) }
    el.addEventListener('click', alClic, { once: true })
    return () => el.removeEventListener('click', alClic)
  }, [rect !== null, guiaId, paso])

  useEffect(() => {
    if (!guia) return
    const tecla = e => { if (e.key === 'Escape') guiaStore.salir() }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [guiaId])

  if (!guia || !p) return null
  const total = guia.pasos.length
  const vw = window.innerWidth
  const vh = window.innerHeight
  // La tarjeta va debajo del hueco (o arriba si no cabe); centrada si no hay elemento
  const tarjetaPos = rect
    ? { left: Math.min(Math.max(12, rect.x), vw - 340), top: rect.y + rect.h + 12 > vh - 190 ? Math.max(12, rect.y - 176) : rect.y + rect.h + 12 }
    : { left: Math.max(12, vw / 2 - 160), top: Math.max(12, vh / 2 - 90) }
  const oscuro = { position: 'fixed', background: 'oklch(0 0 0 / .62)', zIndex: 9990 }

  return (
    <div data-testid="visor-guia" aria-live="polite">
      {rect ? (
        <>
          <div style={{ ...oscuro, left: 0, top: 0, width: '100vw', height: Math.max(0, rect.y) }} />
          <div style={{ ...oscuro, left: 0, top: rect.y + rect.h, width: '100vw', height: Math.max(0, vh - rect.y - rect.h) }} />
          <div style={{ ...oscuro, left: 0, top: rect.y, width: Math.max(0, rect.x), height: rect.h }} />
          <div style={{ ...oscuro, left: rect.x + rect.w, top: rect.y, width: Math.max(0, vw - rect.x - rect.w), height: rect.h }} />
          <div className="ia-foco" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />
        </>
      ) : (
        <div style={{ ...oscuro, inset: 0, background: 'oklch(0 0 0 / .5)' }} />
      )}
      <div className="ia-guia-tarjeta" style={{ ...tarjetaPos, zIndex: 9992 }} role="dialog" aria-label={guia.titulo}>
        <div className="ia-guia-cab">{guia.titulo} · paso {paso + 1} de {total}</div>
        <div className="ia-guia-texto" data-testid="guia-texto">
          {buscando ? 'Buscando el botón…' : rect ? p.texto : `${p.respaldo} (No encuentro ese botón en esta pantalla.)`}
        </div>
        <div className="ia-botones" style={{ marginTop: 10 }}>
          <button className="ia-boton" disabled={paso === 0} onClick={() => guiaStore.ir(paso - 1)}>Anterior</button>
          {paso < total - 1
            ? <button className="ia-boton ia-boton-principal" data-testid="guia-siguiente" onClick={() => guiaStore.ir(paso + 1)}>Siguiente</button>
            : <button className="ia-boton ia-boton-principal" data-testid="guia-terminar" onClick={() => guiaStore.salir()}>Terminar</button>}
          <button className="ia-boton" data-testid="guia-salir" onClick={() => guiaStore.salir()}>Salir (Esc)</button>
        </div>
      </div>
    </div>
  )
}
