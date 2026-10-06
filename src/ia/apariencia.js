// Apariencia del módulo de IA (página de IA + mascota). Tres valores, en español:
//   · transparente  → el diseño glass ACTUAL, intacto (valor por defecto).
//   · lusion-oscuro → opaco, derivado de los tokens de Lusion (ver DISENO.md).
//   · lusion-claro  → opaco, Lusion tal cual (Lavender Mist).
// El resto del sistema (login, navegación, Ventas, Caja, Inventario, Clientes…) NO cambia con ninguna selección:
// las apariencias Lusion solo se aplican dentro de los contenedores con la clase `.ia-scope`.
// Se guarda en la BD local (ia_tema) y cambia en caliente (sin recargar).
import { useSyncExternalStore } from 'react'

export const APARIENCIAS = {
  'transparente': { etiqueta: 'Transparente', detalle: 'El diseño actual, con vidrio y video de fondo.', alias: ['transparente', 'clasico', 'glass', 'cristal', 'vidrio', 'actual'] },
  'lusion-oscuro': { etiqueta: 'Lusion Oscuro', detalle: 'Opaco, fondo negro y texto blanco.', alias: ['lusion oscuro', 'oscuro', 'negro', 'dark', 'lusion-oscuro'] },
  'lusion-claro': { etiqueta: 'Lusion Claro', detalle: 'Opaco, lienzo lavanda y texto negro.', alias: ['lusion claro', 'claro', 'blanco', 'light', 'lusion-claro'] },
}
export const IDS_APARIENCIA = Object.keys(APARIENCIAS)
export const esLusion = a => a === 'lusion-oscuro' || a === 'lusion-claro'

// Acepta valores viejos ('clasico', 'oscuro', 'claro') y alias escritos por la persona.
export function normalizarApariencia(v) {
  const t = String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  if (!t) return 'transparente'
  for (const [id, a] of Object.entries(APARIENCIAS)) if (id === t || a.alias.includes(t)) return id
  return 'transparente'
}

let estado = { apariencia: 'transparente', videoFondo: true, efectoLiquido: true, cargado: false }
const oyentes = new Set()
function emitir() {
  const r = document.documentElement
  r.setAttribute('data-ia-tema', estado.apariencia)
  r.setAttribute('data-ia-video', estado.videoFondo ? '1' : '0')
  r.setAttribute('data-ia-liquido', estado.efectoLiquido ? '1' : '0')
  oyentes.forEach(f => f())
}

export const aparienciaStore = {
  get: () => estado,
  suscribir(f) { oyentes.add(f); return () => oyentes.delete(f) },
}
export const useApariencia = () => useSyncExternalStore(aparienciaStore.suscribir, aparienciaStore.get)

export async function cargarApariencia() {
  let c = {}
  try { c = (await window.api?.ia?.getConfig?.()) || {} } catch { /* sin IPC: valores por defecto */ }
  estado = {
    apariencia: normalizarApariencia(c.ia_tema),
    videoFondo: c.ia_video_fondo !== '0',          // por defecto activado
    efectoLiquido: c.ia_efecto_liquido !== '0',    // por defecto activado (solo se ve en Lusion)
    cargado: true,
  }
  emitir()
}

async function guardar(clave, valor) { try { await window.api?.ia?.setConfig?.(clave, valor) } catch { /* sin IPC */ } }

export async function setApariencia(v) {
  const apariencia = normalizarApariencia(v)
  estado = { ...estado, apariencia }
  emitir()
  await guardar('ia_tema', apariencia)
  return apariencia
}
export async function setVideoFondo(activo) { estado = { ...estado, videoFondo: !!activo }; emitir(); await guardar('ia_video_fondo', activo ? '1' : '0') }
export async function setEfectoLiquido(activo) { estado = { ...estado, efectoLiquido: !!activo }; emitir(); await guardar('ia_efecto_liquido', activo ? '1' : '0') }
