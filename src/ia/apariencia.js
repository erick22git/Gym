// Apariencia de TODA la app (login, navegación, páginas, IA y mascota). Tres valores, en español:
//   · transparente → el diseño actual, con vidrio y video de fondo (valor por defecto, intacto).
//   · oscuro       → fondos sólidos oscuros, sin frames ni transparencias.
//   · claro        → fondos sólidos claros, sin frames ni transparencias.
// Se guarda A NIVEL DE DISPOSITIVO (userData/dispositivo.json, igual que el tamaño) para que valga en el login y no parpadee al
// iniciar: preload la entrega de forma síncrona y ./aplicar-inicial.js la pone en <html data-apariencia> antes de pintar.
// El interruptor «Video de fondo» y «Efecto líquido» siguen en la configuración de IA (BD), son por usuario.
import { useSyncExternalStore } from 'react'

export const APARIENCIAS = {
  'transparente': { etiqueta: 'Transparente', detalle: 'El diseño actual, con vidrio y video de fondo.', alias: ['transparente', 'clasico', 'glass', 'cristal', 'vidrio', 'actual'] },
  'oscuro': { etiqueta: 'Oscuro', detalle: 'Fondo negro sólido y texto blanco, sin transparencias.', alias: ['oscuro', 'negro', 'dark', 'noche', 'modo oscuro', 'lusion oscuro', 'lusion-oscuro'] },
  'claro': { etiqueta: 'Claro', detalle: 'Fondo claro sólido y texto negro, sin transparencias.', alias: ['claro', 'blanco', 'luz', 'light', 'modo claro', 'lusion claro', 'lusion-claro'] },
}
export const IDS_APARIENCIA = Object.keys(APARIENCIAS)
export const esOpaca = a => a === 'oscuro' || a === 'claro'

// Acepta valores guardados antes («lusion-oscuro», «lusion-claro»), alias y frases escritas por la persona.
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
  r.setAttribute('data-apariencia', estado.apariencia)
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
  let c = {}, d = {}
  try { c = (await window.api?.ia?.getConfig?.()) || {} } catch { /* sin IPC: valores por defecto */ }
  try { d = (await window.api?.dispositivo?.obtener?.()) || {} } catch { /* sin IPC */ }
  let apariencia = d.apariencia ? normalizarApariencia(d.apariencia) : null
  if (!apariencia) {
    // Migración: antes la apariencia vivía en la BD (ia_tema: 'lusion-oscuro' …). Se pasa al dispositivo una sola vez.
    apariencia = normalizarApariencia(c.ia_tema)
    try { await window.api?.dispositivo?.fijar?.({ apariencia }) } catch { /* sin IPC */ }
  }
  estado = {
    apariencia,
    videoFondo: c.ia_video_fondo !== '0',          // por defecto activado
    efectoLiquido: c.ia_efecto_liquido !== '0',    // por defecto activado (solo se ve en Oscuro y Claro)
    cargado: true,
  }
  emitir()
}

async function guardarIA(clave, valor) { try { await window.api?.ia?.setConfig?.(clave, valor) } catch { /* sin IPC */ } }

export async function setApariencia(v) {
  const apariencia = normalizarApariencia(v)
  estado = { ...estado, apariencia }
  emitir()
  try { await window.api?.dispositivo?.fijar?.({ apariencia }) } catch { /* sin IPC */ }
  return apariencia
}
export async function setVideoFondo(activo) { estado = { ...estado, videoFondo: !!activo }; emitir(); await guardarIA('ia_video_fondo', activo ? '1' : '0') }
export async function setEfectoLiquido(activo) { estado = { ...estado, efectoLiquido: !!activo }; emitir(); await guardarIA('ia_efecto_liquido', activo ? '1' : '0') }
