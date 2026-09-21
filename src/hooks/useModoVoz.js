// Estado compartido del "modo voz" (la IA lee en voz alta lo que responde/narra). Se guarda en
// localStorage ('ia_modo_voz') y se sincroniza entre pantallas con un evento.
import { useEffect, useState } from 'react'

export const CLAVE_MODO_VOZ = 'ia_modo_voz'
export const EVENTO_MODO_VOZ = 'gym-modo-voz'

export function leerModoVoz() {
  try { return localStorage.getItem(CLAVE_MODO_VOZ) === '1' } catch { return false }
}

export function guardarModoVoz(valor) {
  try { localStorage.setItem(CLAVE_MODO_VOZ, valor ? '1' : '0') } catch { /* sin localStorage: vale solo esta sesión */ }
  window.dispatchEvent(new Event(EVENTO_MODO_VOZ))
}

export default function useModoVoz() {
  const [activo, setActivo] = useState(leerModoVoz)
  useEffect(() => {
    const al = () => setActivo(leerModoVoz())
    window.addEventListener(EVENTO_MODO_VOZ, al)
    window.addEventListener('storage', al)
    return () => { window.removeEventListener(EVENTO_MODO_VOZ, al); window.removeEventListener('storage', al) }
  }, [])
  return activo
}
