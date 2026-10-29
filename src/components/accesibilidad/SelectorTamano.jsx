// Tamaño de la interfaz: 100/125/150/175/200 % (zoom de la ventana, Electron). Vale para toda la app, también el login.
// Dos piezas: SelectorTamano (grupo de opciones, para Configuración) y BotonTamano («Aa» flotante con el mismo selector, para el login).
import { useEffect, useRef, useState } from 'react'
import { Type } from 'lucide-react'
import { TAMANOS, useDispositivo, fijarTamano } from '../../ia/dispositivo'

export function SelectorTamano({ etiquetadoPor }) {
  const { tamano } = useDispositivo()
  return (
    <div role="radiogroup" aria-labelledby={etiquetadoPor} aria-label={etiquetadoPor ? undefined : 'Tamaño de la interfaz'}
      style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {TAMANOS.map(t => {
        const activo = t === tamano
        return (
          <button key={t} type="button" role="radio" aria-checked={activo} data-testid={`tamano-${t}`}
            onClick={() => fijarTamano(t)}
            style={{
              minWidth: 64, padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: activo ? 700 : 500,
              color: 'var(--ink)', background: activo ? 'oklch(1 0 0 / .16)' : 'oklch(1 0 0 / .05)',
              border: activo ? '2px solid var(--ink)' : '1px solid var(--line)',
            }}>
            {activo ? '✓ ' : ''}{t}%
          </button>
        )
      })}
    </div>
  )
}

// Botón «Aa» visible en el login (antes de iniciar sesión). Abre un panel pequeño con las 5 opciones.
export function BotonTamano() {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = e => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false) }
    const esc = e => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [abierto])
  return (
    <div ref={caja} style={{ position: 'fixed', top: 52, right: 16, zIndex: 30 }}>
      <button type="button" data-testid="boton-aa" aria-label="Tamaño de la interfaz" aria-haspopup="true" aria-expanded={abierto}
        onClick={() => setAbierto(a => !a)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 12, cursor: 'pointer', fontSize: 15, fontWeight: 700,
          color: 'var(--ink)', background: 'rgba(10,12,15,.55)', border: '1px solid var(--line)' }}>
        <Type size={16} aria-hidden="true" /> Aa
      </button>
      {abierto && (
        <div role="dialog" aria-label="Tamaño de la interfaz" data-testid="panel-aa"
          style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 300, maxWidth: 'calc(100vw - 32px)', padding: 14, borderRadius: 14,
            background: 'rgba(10,12,15,.92)', border: '1px solid var(--line)', boxShadow: '0 12px 30px rgba(0,0,0,.5)' }}>
          <div id="aa-titulo" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>Tamaño de la interfaz</div>
          <SelectorTamano etiquetadoPor="aa-titulo" />
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>Atajos: Ctrl + = más grande · Ctrl + − más pequeño · Ctrl + 0 vuelve a 100 %.</div>
        </div>
      )}
    </div>
  )
}
