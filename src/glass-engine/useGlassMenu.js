// [GLASS ENGINE — CONSUMIDOR] — pegamento para React, no motor.
// Instancia GlassMenu (core/menu.js) directamente sobre el elemento raíz
// del menú — mismo patrón que useGlassButton/useGlassCard, sin pasar por
// engine.js (este proyecto no lo porta: ver GLASS_ENGINE_PORTABILIDAD.md,
// los otros dos hooks tampoco lo usan).
//
// GlassMenu lee sus <button class="menu-item"> del DOM UNA VEZ en el
// constructor y controla el "active" con SU PROPIO listener de click
// (además del onClick de React) — cuando la navegación ocurre por fuera
// de un click en el menú (ej. la campana de alertas navega a Alertas),
// React actualiza el prop `activeIndex` pero GlassMenu no se entera solo.
// Este hook expone esa sincronización: llama a `select(activeIndex)`
// cada vez que cambia, así la burbuja sigue al ítem activo sin importar
// quién disparó la navegación. `select()` ya es un no-op si el índice
// no cambió (ver core/menu.js), así que llamarlo de más es seguro.
//
// [FIX] — burbuja angosta/circular al navegar por CLICK en el propio
// menú (ítems con texto permanente como "Control de Acceso" o
// "Inventario"). Causa real (diagnosticada con getComputedStyle +
// rects, no era el bug que se sospechaba de "dos burbujas"): el listener
// NATIVO de click de GlassMenu (bindEvents, core/menu.js) corre ANTES
// que React re-renderice — mide item.getBoundingClientRect() con el
// botón TODAVÍA angosto (sin el <span> de texto, que React recién va a
// agregar/mostrar después, porque isActive cambia recién en el próximo
// render). select() guarda ese ancho angosto como el target Y deja
// activeIndex ya "al día" — así que cuando el efecto de abajo corre
// DESPUÉS del re-render de React (con el botón ya ancho, con texto),
// select(activeIndex) ve el mismo índice y no hace nada (es un no-op
// a propósito) — la burbuja se queda angosta para siempre en ese ítem.
// syncToActive(false) fuerza una remedición contra el DOM YA
// actualizado, sin el guard de "mismo índice" — por eso se llama
// aparte, incondicional, cada vez que activeIndex cambia.

import { useCallback, useEffect, useRef } from 'react'
import GlassMenu from './core/menu.js'

// hoverAt/hoverRelease exponen la extensión de core/menu.js (ver su
// propio comentario ahí) — mueven la burbuja al pasar el mouse por
// CUALQUIER ítem sin cambiar cuál es el activo/navegado. Son funciones
// estables (useCallback sin deps) que consultan instanceRef.current en
// el momento de llamarse, así que es seguro pasarlas como prop/handler
// antes de que el efecto de montaje haya corrido.
export function useGlassMenu(ref, activeIndex, options) {
  const instanceRef = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    const instance = new GlassMenu(ref.current, options)
    instanceRef.current = instance
    return () => {
      instance.destroy()
      instanceRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (instanceRef.current && activeIndex >= 0) {
      instanceRef.current.select(activeIndex)
      instanceRef.current.syncToActive(false)
    }
  }, [activeIndex])

  const hoverAt = useCallback((index) => {
    instanceRef.current?.hoverAt(index)
  }, [])

  const hoverRelease = useCallback(() => {
    instanceRef.current?.hoverRelease()
  }, [])

  return { hoverAt, hoverRelease }
}
