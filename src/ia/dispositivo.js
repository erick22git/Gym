// Ajustes del DISPOSITIVO (no por usuario): tamaño de la interfaz y alto contraste. Valen también en el login.
// Se guardan en userData/dispositivo.json (proceso principal) y el zoom lo aplica Electron a toda la ventana.
import { useSyncExternalStore } from 'react'

export const TAMANOS = [100, 125, 150, 175, 200]
let estado = { tamano: 100, altoContraste: false, cargado: false }
const oyentes = new Set()
function emitir() {
  try {
    document.documentElement.setAttribute('data-alto-contraste', estado.altoContraste ? '1' : '0')
    document.documentElement.setAttribute('data-tamano', String(estado.tamano))
  } catch { /* sin DOM */ }
  oyentes.forEach(f => f())
}

export const dispositivoStore = { get: () => estado, suscribir(f) { oyentes.add(f); return () => oyentes.delete(f) } }
export const useDispositivo = () => useSyncExternalStore(dispositivoStore.suscribir, dispositivoStore.get)

function aplicar(d) {
  estado = { tamano: TAMANOS.includes(d?.tamano) ? d.tamano : 100, altoContraste: d?.altoContraste === true, cargado: true }
  emitir()
}

export async function cargarDispositivo() {
  try { aplicar(await window.api?.dispositivo?.obtener?.()) } catch { aplicar(null) }
  // Los atajos Ctrl+= / Ctrl+- / Ctrl+0 los atiende el proceso principal y avisan aquí
  try { window.api?.dispositivo?.onCambio?.(aplicar) } catch { /* sin IPC */ }
}

export async function fijarTamano(n) {
  if (!TAMANOS.includes(n)) return
  estado = { ...estado, tamano: n }; emitir()
  try { aplicar(await window.api.dispositivo.fijar({ tamano: n })) } catch { /* sin IPC */ }
}
export async function fijarAltoContraste(v) {
  estado = { ...estado, altoContraste: !!v }; emitir()
  try { aplicar(await window.api.dispositivo.fijar({ altoContraste: !!v })) } catch { /* sin IPC */ }
}
