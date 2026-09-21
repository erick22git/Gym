// Configuración → Control por voz: un interruptor por módulo para permitir o no el control por voz
// (por ejemplo, si un empleado no debe tener ese acceso). Se guarda en la base de datos local.
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ShoppingBag, Wallet, Sparkles, Mic } from 'lucide-react'
import { EVENTO_VOZ_CONFIG } from '../../hooks/useVozHabilitada'

const MODULOS = [
  { id: 'ventas', titulo: 'Ventas (Venta rápida)', detalle: 'Agregar productos, elegir método de pago y cobrar hablando. El cobro siempre pide confirmación.', icon: ShoppingBag },
  { id: 'caja', titulo: 'Caja', detalle: 'Abrir caja y rellenar movimientos o el cierre hablando. Nunca confirma dinero por sí sola.', icon: Wallet },
  { id: 'ia', titulo: 'IA / Importar datos', detalle: 'Dictar mensajes al asistente de importación con el micrófono.', icon: Sparkles },
]

export default function ConfigVoz() {
  const [config, setConfig] = useState(null)
  const [guardando, setGuardando] = useState(null)

  useEffect(() => {
    window.api.voz.getConfig().then(setConfig).catch(() => setConfig({}))
  }, [])

  async function cambiar(modulo, activo) {
    setGuardando(modulo)
    try {
      const r = await window.api.voz.setConfig(modulo, activo)
      if (!r?.ok) throw new Error(r?.error || 'No se pudo guardar')
      setConfig(r.config)
      window.dispatchEvent(new Event(EVENTO_VOZ_CONFIG))
      toast.success(`Control por voz ${activo ? 'activado' : 'desactivado'} en ${MODULOS.find(m => m.id === modulo).titulo}`)
    } catch (e) {
      toast.error(e.message)
    }
    setGuardando(null)
  }

  if (!config) return <div style={{ color: 'var(--dim)', fontSize: 13 }}>Cargando…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 680 }} data-testid="config-voz">
      <p style={{ fontSize: 13, color: 'oklch(0.88 0.01 250 / .85)', lineHeight: 1.6, margin: 0 }}>
        <Mic size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        El control por voz funciona sin internet, en este equipo. Aquí decides en qué módulos está disponible.
      </p>
      {MODULOS.map(m => {
        const activo = config[m.id] !== false
        const Icon = m.icon
        return (
          <div key={m.id} data-modulo={m.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, background: 'oklch(0.13 0.02 250 / .34)', border: '1px solid var(--line)' }}>
            <Icon size={20} color="oklch(0.88 0.01 250 / .85)" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{m.titulo}</div>
              <div style={{ fontSize: 12, color: 'oklch(0.88 0.01 250 / .75)', marginTop: 2 }}>{m.detalle}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={activo}
              aria-label={`Control por voz en ${m.titulo}`}
              data-testid={`interruptor-voz-${m.id}`}
              disabled={guardando === m.id}
              onClick={() => cambiar(m.id, !activo)}
              style={{
                width: 46, height: 26, borderRadius: 999, border: '1px solid oklch(1 0 0 / .25)', cursor: 'pointer', position: 'relative', flexShrink: 0,
                background: activo ? 'oklch(0.78 0.16 155 / .55)' : 'oklch(0.2 0.02 250 / .6)', transition: 'background .15s',
              }}
            >
              <span style={{ position: 'absolute', top: 2, left: activo ? 22 : 2, width: 20, height: 20, borderRadius: 999, background: '#fff', transition: 'left .15s' }} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
