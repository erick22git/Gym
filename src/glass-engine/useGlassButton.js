// [GLASS ENGINE — CONSUMIDOR] — pegamento para React, no motor.
// Instancia GlassMaterial (core/glass.js) directamente sobre un botón —
// a diferencia de useGlassCard, NO usa GlassCard (card.js): los botones no
// necesitan tilt 3D, y GlassMaterial por sí sola nunca escribe
// root.style.transform, así que convive sin conflicto con whileHover/
// whileTap de framer-motion en el mismo nodo.
//
// Misma regla que useGlassCard: el elemento debe tener siempre el mismo
// hijo estático (nunca agregado/quitado por condicionales) para que
// wrapContent() no rompa la reconciliación de React.

import { useEffect } from 'react'
import GlassMaterial from './core/glass.js'

export function useGlassButton(ref, options) {
  useEffect(() => {
    if (!ref.current) return
    const instance = new GlassMaterial(ref.current, options)
    return () => instance.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
