// ─── Variants de entrada "gota de agua" — Fase 2 (revisada) ───────────────────
// Física real (spring), no duration simple. Reutilizables vía Framer Motion
// `variants` + `initial="hidden" animate="visible" exit="hidden"`.
// Ver waterReduced* más abajo para el fallback de prefers-reduced-motion
// (useReducedMotion de framer-motion) — quien los use decide cuál pasar.

export const waterContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
}

export const waterCard = {
  hidden: { opacity: 0, y: 40, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 380, damping: 20, mass: 1 },
  },
}

// Variante lateral para casos donde la entrada debe venir de un costado
// (ej. panel de casilleros, anclado a la izquierda).
export const waterCardSide = (fromLeft = true) => ({
  hidden: { opacity: 0, x: fromLeft ? -60 : 60, scale: 0.92 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 380, damping: 20, mass: 1 },
  },
})

// ─── waterCard/waterCardSide "controlado" — Parte B.4/B.8 (ronda de
// motion system) ───────────────────────────────────────────────────
// Mismo spring, menos overshoot (stiffness:300/damping:28 en vez de
// 380/20) — "suave, ligero, preciso, controlado", nunca rebote de
// pelota. Se usa PUNTUALMENTE donde se pidió (card de cliente, grid+
// filas del panel de casilleros) — el waterCard/waterCardSide de
// arriba SIGUEN con sus valores originales para el resto (resultados
// de búsqueda, carrito, cards de plan), que no se marcaron como
// "demasiado rebote" y no se tocan acá.
export const waterCardControlled = {
  hidden: { opacity: 0, y: 40, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 28, mass: 1 },
  },
}
export const waterCardSideControlled = (fromLeft = true) => ({
  hidden: { opacity: 0, x: fromLeft ? -60 : 60, scale: 0.92 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 28, mass: 1 },
  },
})

// ─── Fallback prefers-reduced-motion — mismos nombres de estado
// (hidden/visible) para poder pasarlos como reemplazo 1:1 de los de
// arriba sin cambiar el resto del código que los consume. Sin spring,
// sin movimiento/escala — solo fade.
export const waterContainerReduced = { hidden: {}, visible: {} }
export const waterCardReduced = { hidden: { opacity: 0 }, visible: { opacity: 1 } }
