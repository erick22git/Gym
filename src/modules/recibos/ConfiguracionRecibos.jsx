import { useState, useEffect } from 'react'
import { Save, ToggleLeft, ToggleRight, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import VistaRecibo from './VistaRecibo'
import { motion } from 'framer-motion'
import '../../pages/Clients.css'

const DEFAULTS = {
  activo: true,
  formato: 'media',
  mostrar_logo: true,
  mostrar_datos_gym: true,
  mostrar_datos_cliente: true,
  mostrar_detalle: true,
  mostrar_metodo_pago: true,
  mostrar_numero: true,
  mostrar_fecha: true,
  mostrar_cajero: true,
  mostrar_mensaje: false,
  mensaje_pie: 'Gracias por tu preferencia',
}

function boolify(row) {
  const r = { ...row }
  ;['activo','mostrar_logo','mostrar_datos_gym','mostrar_datos_cliente','mostrar_detalle',
    'mostrar_metodo_pago','mostrar_numero','mostrar_fecha','mostrar_cajero','mostrar_mensaje'
  ].forEach(k => { r[k] = r[k] === 1 || r[k] === true })
  return r
}

export default function ConfiguracionRecibos() {
  const [config, setConfig] = useState(DEFAULTS)
  const [guardando, setGuardando] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [ventaPrevia, setVentaPrevia] = useState(null)

  useEffect(() => {
    window.api.recibos.getConfig().then(d => {
      if (d && Object.keys(d).length > 0) setConfig(boolify({ ...DEFAULTS, ...d }))
    })
  }, [])

  function set(k, v) { setConfig(p => ({ ...p, [k]: v })) }

  async function guardar() {
    setGuardando(true)
    try {
      await window.api.recibos.saveConfig(config)
      toast.success('Configuración de recibos guardada')
    } catch { toast.error('Error al guardar') }
    setGuardando(false)
  }

  function verPrevia() {
    setVentaPrevia({
      numero: 42,
      fecha: new Date().toLocaleString('es-BO'),
      cliente_nombre: 'Juan Carlos Mamani',
      cliente_doc: '7234891',
      items: [
        { nombre: 'Membresía Premium', cantidad: 1, total: 250 },
        { nombre: 'Proteína Whey 1kg', cantidad: 1, total: 120 },
      ],
      total: 370,
      metodo_pago: 'Efectivo',
      recibido: 400,
      vuelto: 30,
      cajero: 'Erick Admin',
    })
  }

  const Toggle = ({ k }) => (
    <button type="button" onClick={() => set(k, !config[k])} className="clientes-action-icon" style={{ padding:0 }}>
      {config[k]
        ? <ToggleRight size={28} color="var(--green)" />
        : <ToggleLeft size={28} color="var(--dim)" />}
    </button>
  )

  const Row = ({ label, k }) => (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--line)' }}>
      <span style={{ fontSize:13, color:'var(--ink)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{label}</span>
      <Toggle k={k} />
    </div>
  )

  return (
    <>
    <div className="clientes-page" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 className="titulo-metalico" style={{ marginBottom:4 }}>Recibos de Pago</h1>
          <p style={{ fontSize:13, color:'var(--dim)' }}>Comprobante simple de pago (no fiscal)</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={verPrevia} className="clientes-glass-btn btn-secondary">
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content"><Eye size={14} /> Vista previa</span>
          </button>
          <button onClick={guardar} className="clientes-glass-btn btn-primary" disabled={guardando}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content"><Save size={14} /> {guardando ? 'Guardando...' : 'Guardar'}</span>
          </button>
        </div>
      </div>

      {/* Activar módulo */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
        style={{
          padding:'16px 20px', marginBottom:14,
          background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
          border: '1px solid transparent', borderRadius: 14,
          boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
        }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--ink)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>Emisión de recibos</div>
            <div style={{ fontSize:12, color:'var(--dim)', marginTop:2 }}>Ofrecer recibo después de cada venta</div>
          </div>
          <Toggle k="activo" />
        </div>
      </motion.div>

      {/* Formato */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 0.06 }}
        style={{
          padding:'16px 20px', marginBottom:14,
          background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
          border: '1px solid transparent', borderRadius: 14,
          boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
        }}>
        <h3 style={{ fontSize:13, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>Formato</h3>
        <div style={{ display:'flex', gap:10 }}>
          {[['carta','Carta (8.5×11)'],['media','Media carta (5.5×8.5)'],['ticket','Ticket 80mm']].map(([v,l]) => (
            <button key={v} onClick={() => set('formato', v)} style={{
              flex:1, padding:'10px 6px', borderRadius:999, fontSize:12, fontWeight:600,
              border: config.formato===v ? '1px solid transparent' : '1px solid var(--line)',
              borderLeft: config.formato===v ? '3px solid var(--red)' : undefined,
              background: config.formato===v ? 'oklch(0.66 0.22 25 / .12)' : 'oklch(0.13 0.02 250 / .34)',
              color: config.formato===v ? 'oklch(0.97 0.01 250)' : 'oklch(0.88 0.01 250 / .85)', cursor:'pointer',
              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
            }}>{l}</button>
          ))}
        </div>
      </motion.div>

      {/* Elementos a mostrar */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 0.12 }}
        style={{
          padding:'16px 20px', marginBottom:14,
          background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
          border: '1px solid transparent', borderRadius: 14,
          boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
        }}>
        <h3 style={{ fontSize:13, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>Mostrar en el recibo</h3>
        <Row label="Logo del gym" k="mostrar_logo" />
        <Row label="Datos del gym (dirección, teléfono)" k="mostrar_datos_gym" />
        <Row label="Datos del cliente" k="mostrar_datos_cliente" />
        <Row label="Detalle de la compra" k="mostrar_detalle" />
        <Row label="Método de pago" k="mostrar_metodo_pago" />
        <Row label="Número de recibo" k="mostrar_numero" />
        <Row label="Fecha y hora" k="mostrar_fecha" />
        <Row label="Cajero que atendió" k="mostrar_cajero" />
        <Row label="Mensaje personalizado al pie" k="mostrar_mensaje" />
      </motion.div>

      {/* Mensaje pie */}
      {config.mostrar_mensaje && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
          style={{
          padding:'16px 20px', marginBottom:14,
          background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
          border: '1px solid transparent', borderRadius: 14,
          boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
        }}>
          <label style={{ fontSize:12, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:6 }}>Mensaje al pie</label>
          <input
            className="gym-input"
            value={config.mensaje_pie}
            onChange={e => set('mensaje_pie', e.target.value)}
            placeholder="Ej: Gracias por tu preferencia"
            maxLength={120}
          />
        </motion.div>
      )}
    </div>
    {ventaPrevia && <VistaRecibo venta={ventaPrevia} onClose={() => setVentaPrevia(null)} />}
    </>
  )
}
