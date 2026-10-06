// Identidad editable del sistema: nombre del negocio (configuracion_pos.gym_nombre, el mismo que ya se edita en
// Configuración → Datos del negocio) y fondo propio (foto en userData). Todo local. Cambia en caliente.
import { useSyncExternalStore } from 'react'

export const NOMBRE_POR_DEFECTO = 'Gimnasio'
let estado = { nombre: NOMBRE_POR_DEFECTO, fondo: null, cargado: false }
const oyentes = new Set()
function emitir() { try { document.title = estado.nombre } catch { /* sin DOM */ } oyentes.forEach(f => f()) }

export const negocioStore = { get: () => estado, suscribir(f) { oyentes.add(f); return () => oyentes.delete(f) } }
export const useNegocio = () => useSyncExternalStore(negocioStore.suscribir, negocioStore.get)
export const nombreNegocio = () => estado.nombre

export async function cargarNegocio() {
  let nombre = NOMBRE_POR_DEFECTO, fondo = null
  try { const c = await window.api?.pos?.getConfig?.(); if (c?.gym_nombre?.trim()) nombre = c.gym_nombre.trim() } catch { /* sin IPC */ }
  try { fondo = (await window.api?.fondo?.obtener?.()) || null } catch { /* sin IPC */ }
  estado = { nombre, fondo, cargado: true }
  emitir()
}
export function fijarNombreNegocio(n) { estado = { ...estado, nombre: (n || '').trim() || NOMBRE_POR_DEFECTO }; emitir() }
export async function elegirFondo() {
  const r = await window.api.fondo.elegir()
  if (r?.ok && r.dataUri) { estado = { ...estado, fondo: r.dataUri }; emitir() }
  return r
}
export async function restaurarFondo() { await window.api.fondo.restaurar(); estado = { ...estado, fondo: null }; emitir() }
