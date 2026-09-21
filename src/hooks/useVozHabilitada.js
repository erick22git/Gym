// ¿Está permitido el control por voz en este módulo? ('ventas' | 'caja' | 'ia'). Lo decide el
// administrador en Configuración → Control por voz y se guarda en la base de datos local.
// Se actualiza en vivo si se cambia el interruptor mientras la pantalla está abierta.
import { useEffect, useState } from 'react'

export const EVENTO_VOZ_CONFIG = 'gym-voz-config'

export default function useVozHabilitada(modulo) {
  const [habilitada, setHabilitada] = useState(false) // mientras carga, no se muestra
  useEffect(() => {
    let vivo = true
    const cargar = async () => {
      try {
        const cfg = await window.api.voz.getConfig()
        if (vivo) setHabilitada(cfg?.[modulo] !== false)
      } catch {
        if (vivo) setHabilitada(false) // sin poder leer la configuración, se prefiere NO ofrecer la voz
      }
    }
    cargar()
    window.addEventListener(EVENTO_VOZ_CONFIG, cargar)
    return () => { vivo = false; window.removeEventListener(EVENTO_VOZ_CONFIG, cargar) }
  }, [modulo])
  return habilitada
}
