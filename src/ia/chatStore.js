// Almacén ÚNICO de la conversación con el asistente. Lo usan la página de IA y la mascota flotante: así
// una conversación empezada en una se ve y continúa en la otra, con el mismo backend. Es un módulo (no un
// componente), por eso sobrevive a cambiar de pantalla.
import { useSyncExternalStore } from 'react'

let contador = 0
export function nuevoId() { contador += 1; return `m${contador}-${Date.now()}` }

const leerLS = (k, def) => { try { return localStorage.getItem(k) ?? def } catch { return def } }

let estado = {
  mensajes: [],
  generando: false,
  modo: leerLS('ia_chat_modo', 'preguntar') === 'actuar' ? 'actuar' : 'preguntar',
  conversacionId: null,        // la página de IA lo asigna al guardar en su historial
}
const oyentes = new Set()
function emitir() { oyentes.forEach(f => f()) }

export const chatStore = {
  get: () => estado,
  suscribir(f) { oyentes.add(f); return () => oyentes.delete(f) },
  set(parcial) { estado = { ...estado, ...parcial }; emitir() },
  setMensajes(upd) {
    const nuevos = typeof upd === 'function' ? upd(estado.mensajes) : upd
    estado = { ...estado, mensajes: nuevos }
    emitir()
  },
  setGenerando(v) { if (estado.generando !== v) { estado = { ...estado, generando: v }; emitir() } },
  setModo(m) {
    const modo = m === 'actuar' ? 'actuar' : 'preguntar'
    try { localStorage.setItem('ia_chat_modo', modo) } catch { /* sin almacenamiento */ }
    chatStore.set({ modo })
  },
  actualizarMensaje(id, cambios) {
    chatStore.setMensajes(prev => prev.map(m => (m.id === id ? { ...m, ...(typeof cambios === 'function' ? cambios(m) : cambios) } : m)))
  },
  agregarMensaje(m) { chatStore.setMensajes(prev => [...prev, { id: nuevoId(), creadoEn: Date.now(), ...m }]) },
}

export function useChat() {
  return useSyncExternalStore(chatStore.suscribir, chatStore.get)
}
