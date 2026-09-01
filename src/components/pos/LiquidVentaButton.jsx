import { useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import './LiquidVentaButton.css'

// ─── PRUEBA ÚNICA — Parte C (ronda de animaciones, ver Parte A/B en
// ControlAcceso.jsx) — sistema de líquido premium para UN SOLO botón:
// "Registrar Venta" en ModalVentaRapida (ControlAcceso.jsx). No
// replicar en otros botones todavía — pedido explícito: queda como
// prueba a confirmar antes de tocar nada más.
//
// Requisitos: superficie reactiva al cursor (posición+velocidad),
// ripple en el punto exacto de click que se expande y se amortigua
// con física de resorte (no ease-out genérico) y se disipa sin
// loop/rebote artificial, refracción óptica muy sutil del texto/
// ícono durante el ripple (nunca ilegible), reflejo especular casi
// imperceptible viajando con la onda, energía contenida/absorbida en
// el borde (no cortada de golpe), 2-3 micro-olas secundarias que se
// disipan rápido.
//
// TÉCNICA ELEGIDA Y POR QUÉ:
// - Todo lo CONTINUO (sheen que sigue el cursor, expansión/fade de
//   cada anillo del ripple) es transform+opacity puro vía Framer
//   Motion — compositor-only, sin layout/paint por frame. La posición
//   del cursor se escribe a mano vía ref.style.setProperty() dentro
//   de un requestAnimationFrame propio (throttleado a 1 vez por
//   frame), NO vía React state — evita re-renders en cada pointermove.
// - La refracción del texto usa UN filtro SVG feDisplacementMap ya
//   dentro del mismo pipeline que el resto del vidrio de la app
//   (public/filters-menu-glass.svg, id nuevo #rv-ripple-refraction,
//   ver comentario ahí) — pero aplicado como una CLASE que se prende/
//   apaga ~350ms en el click, nunca con el atributo `scale` reescrito
//   cuadro a cuadro por JS (eso sí sería costoso: forzaría recalcular
//   el filtro en cada frame). Con el toggle, el costo es el de UNA
//   recomputación de filtro por click, no un loop.
// - WebGL evaluado y descartado: exigiría contexto propio, manejo de
//   pérdida de contexto, y un pipeline de shaders nuevo — desproporcionado
//   para un solo botón en "prueba única", y rompería la consistencia
//   con el resto del sistema de vidrio de la app (100% CSS/SVG, sin
//   WebGL en ningún otro lado). Canvas 2D también evaluado para el
//   ripple — descartado porque transform/opacity sobre divs logra el
//   mismo resultado visual sin el costo de un <canvas> + rAF dibujando
//   píxeles a mano ni el boilerplate de escalado por DPI.
export default function LiquidVentaButton({ children, onClick, disabled, style, className = '', ...props }) {
  const reduceMotion = useReducedMotion()
  const btnRef = useRef(null)
  const rafRef = useRef(null)
  const trackRef = useRef({ x: 0, y: 0, t: 0 })
  const [ripples, setRipples] = useState([])
  const [refracting, setRefracting] = useState(false)
  const rippleIdRef = useRef(0)
  const refractTimerRef = useRef(null)

  const handlePointerMove = useCallback((e) => {
    if (reduceMotion || !btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const now = e.timeStamp
    const prev = trackRef.current
    const dt = prev.t ? Math.max(1, now - prev.t) : 0
    const dist = prev.t ? Math.hypot(x - prev.x, y - prev.y) : 0
    const speed = dt ? dist / dt : 0 // px/ms
    const strength = Math.min(1, speed * 4)
    trackRef.current = { x, y, t: now }
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      if (!btnRef.current) return
      btnRef.current.style.setProperty('--rv-x', `${x}px`)
      btnRef.current.style.setProperty('--rv-y', `${y}px`)
      btnRef.current.style.setProperty('--rv-strength', String(strength))
    })
  }, [reduceMotion])

  const handlePointerEnter = useCallback(() => {
    if (!reduceMotion && btnRef.current) btnRef.current.style.setProperty('--rv-sheen-opacity', '1')
  }, [reduceMotion])

  const handlePointerLeave = useCallback(() => {
    if (btnRef.current) btnRef.current.style.setProperty('--rv-sheen-opacity', '0')
  }, [])

  const spawnRipple = useCallback((clientX, clientY) => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    // distancia hasta la esquina más lejana — así el anillo principal
    // llega a cubrir todo el botón antes de terminar de desvanecerse.
    const maxDist = Math.max(
      Math.hypot(x, y),
      Math.hypot(rect.width - x, y),
      Math.hypot(x, rect.height - y),
      Math.hypot(rect.width - x, rect.height - y)
    )
    const id = ++rippleIdRef.current
    setRipples(r => [...r, { id, x, y, maxDist }])
    setTimeout(() => setRipples(r => r.filter(rp => rp.id !== id)), 700)

    if (!reduceMotion) {
      setRefracting(true)
      if (refractTimerRef.current) clearTimeout(refractTimerRef.current)
      refractTimerRef.current = setTimeout(() => setRefracting(false), 350)
    }
  }, [reduceMotion])

  const handlePointerDown = useCallback((e) => {
    if (disabled) return
    spawnRipple(e.clientX, e.clientY)
  }, [disabled, spawnRipple])

  return (
    <button
      ref={btnRef}
      type="button"
      className={`vr-glass-btn glass-root glass--regular rv-liquid-btn${className ? ' ' + className : ''}`}
      style={style}
      disabled={disabled}
      onClick={onClick}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      {...props}
    >
      <div className="glass-material" aria-hidden="true">
        <div className="glass-layer glass-layer--fill" />
        <div className="glass-layer glass-layer--specular" />
        <div className="glass-layer glass-layer--rainbow" />
      </div>

      {!reduceMotion && <div className="rv-sheen" aria-hidden="true" />}

      {!reduceMotion && (
        <div className="rv-ripple-layer" aria-hidden="true">
          <AnimatePresence>
            {ripples.map(rp => (
              <RippleGroup key={rp.id} x={rp.x} y={rp.y} maxDist={rp.maxDist} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <div
        className={`glass-content rv-liquid-content${refracting ? ' rv-refracting' : ''}`}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}
      >
        {children}
      </div>
    </button>
  )
}

// Onda principal + reflejo especular que la acompaña + 2 micro-olas
// secundarias débiles (menor tamaño/opacidad, arrancan con un pequeño
// delay y un resorte más rígido/amortiguado — se disipan más rápido
// que la principal). El "amortiguado por resorte" viene del propio
// spring de Framer (stiffness/damping) en vez de una curva ease-out
// genérica — el leve overshoot del spring (~3-5%) lee como una onda
// real perdiendo energía, no como un rebote de UI.
function RippleGroup({ x, y, maxDist }) {
  const mainSize = maxDist * 2 * 1.15
  const echo1Size = mainSize * 0.7
  const echo2Size = mainSize * 0.45

  const posStyle = (size) => ({
    left: x,
    top: y,
    width: size,
    height: size,
    marginLeft: -size / 2,
    marginTop: -size / 2,
  })

  return (
    <>
      {/* [FIX — verificado en Electron real] opacity con ease:'easeOut'
          cae rápido al principio, así que para cuando el spring de scale
          ya hizo crecer el anillo lo suficiente para notarse, la
          opacity ya casi había llegado a 0 — el ripple existía en el
          DOM (confirmado por getComputedStyle en vivo) pero era
          invisible a simple vista. 'easeIn' mantiene la opacity cerca
          del valor inicial mientras el anillo todavía es chico/mediano
          y solo cae fuerte al final — leído en pantalla como una onda
          que se apaga al llegar al borde, no como algo que nunca se
          encendió. Duración de opacity ajustada para terminar junto
          con el spring de scale (medido en vivo: ~500-550ms para
          stiffness:170/damping:24, ~300-350ms para los ecos). */}
      <motion.div
        className="rv-ripple-ring rv-ripple-main"
        style={posStyle(mainSize)}
        initial={{ scale: 0, opacity: 0.55 }}
        animate={{ scale: 1, opacity: 0 }}
        transition={{
          scale: { type: 'spring', stiffness: 170, damping: 24, mass: 1 },
          opacity: { duration: 0.6, ease: 'easeIn' },
        }}
      />
      <motion.div
        className="rv-ripple-ring rv-ripple-specular"
        style={posStyle(mainSize)}
        initial={{ scale: 0, opacity: 0.32 }}
        animate={{ scale: 1, opacity: 0 }}
        transition={{
          scale: { type: 'spring', stiffness: 170, damping: 24, mass: 1 },
          opacity: { duration: 0.52, ease: 'easeIn' },
        }}
      />
      <motion.div
        className="rv-ripple-ring rv-ripple-echo"
        style={posStyle(echo1Size)}
        initial={{ scale: 0, opacity: 0.26 }}
        animate={{ scale: 1, opacity: 0 }}
        transition={{
          delay: 0.08,
          scale: { type: 'spring', stiffness: 260, damping: 26, mass: 0.8 },
          opacity: { duration: 0.38, ease: 'easeIn', delay: 0.08 },
        }}
      />
      <motion.div
        className="rv-ripple-ring rv-ripple-echo"
        style={posStyle(echo2Size)}
        initial={{ scale: 0, opacity: 0.18 }}
        animate={{ scale: 1, opacity: 0 }}
        transition={{
          delay: 0.16,
          scale: { type: 'spring', stiffness: 320, damping: 28, mass: 0.7 },
          opacity: { duration: 0.3, ease: 'easeIn', delay: 0.16 },
        }}
      />
    </>
  )
}
