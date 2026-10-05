// Estado del recorrido guiado en curso (módulo, no componente: el recorrido sobrevive al cambio de pantalla).
import { useSyncExternalStore } from 'react'

let estado = { guiaId: null, paso: 0 }
const oyentes = new Set()
const emitir = () => oyentes.forEach(f => f())

export const guiaStore = {
  get: () => estado,
  suscribir: f => { oyentes.add(f); return () => oyentes.delete(f) },
  iniciar(guiaId) { estado = { guiaId, paso: 0 }; emitir() },
  ir(paso) { estado = { ...estado, paso }; emitir() },
  salir() { estado = { guiaId: null, paso: 0 }; emitir() },
}
export const useGuia = () => useSyncExternalStore(guiaStore.suscribir, guiaStore.get)

// Registro de pasos que no encontraron su elemento (para corregir el recorrido): ring buffer en localStorage.
export function registrarPasoSinElemento(guiaId, paso, id) {
  console.warn(`[guía] «${guiaId}» paso ${paso + 1}: no encontré [data-guide-id="${id}"]; se muestran las instrucciones en texto.`)
  try {
    const k = 'ia_guias_log'
    const log = JSON.parse(localStorage.getItem(k) || '[]')
    log.push({ guiaId, paso, id, fecha: Date.now() })
    localStorage.setItem(k, JSON.stringify(log.slice(-50)))
  } catch { /* sin almacenamiento */ }
}
