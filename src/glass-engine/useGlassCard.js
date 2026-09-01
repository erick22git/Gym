// [GLASS ENGINE — CONSUMIDOR] — pegamento para React, no motor.
// Instancia GlassCard (core/card.js) directamente sobre un elemento,
// en vez de pasar por engine.js — engine.js importa menu.js, que esta
// fase del port no necesita (ver GLASS_ENGINE_PORTABILIDAD.md).
//
// GlassMaterial.wrapContent() mueve, una sola vez, los hijos que el
// elemento tenga en ese momento a un nuevo div.glass-content. Para que
// React pueda seguir reconciliando su propio árbol sin pelear con esa
// mutación, el elemento pasado a este hook debe tener SIEMPRE un único
// hijo estático (nunca agregado/quitado/reordenado por key o
// condicionales) — todo el contenido dinámico va DENTRO de ese hijo.

import { useEffect } from 'react'
import GlassCard from './core/card.js'

export function useGlassCard(ref, options) {
  useEffect(() => {
    if (!ref.current) return
    const instance = new GlassCard(ref.current, options)
    return () => instance.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
