import { useState, useEffect } from 'react'
import { Save, ToggleLeft, ToggleRight, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import VistaRecibo from './VistaRecibo'

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
    <button type="button" onClick={() => set(k, !config[k])} style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', padding:0 }}>
      {config[k]
        ? <ToggleRight size={28} color="var(--green)" />
        : <ToggleLeft size={28} color="var(--dim)" />}
    </button>
  )

  const Row = ({ label, k }) => (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--line)' }}>
      <span style={{ fontSize:13, color:'var(--ink)' }}>{label}</span>
      <Toggle k={k} />
    </div>
  )

  return (
    <>
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 className="titulo-metalico" style={{ marginBottom:4 }}>Recibos de Pago</h1>
          <p style={{ fontSize:13, color:'var(--dim)' }}>Comprobante simple de pago (no fiscal)</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={verPrevia} className="btn-secondary" style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Eye size={14} /> Vista previa
          </button>
          <button onClick={guardar} className="btn-primary" disabled={guardando} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Save size={14} /> {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Activar módulo */}
      <div className="gym-card" style={{ padding:'16px 20px', marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--ink)' }}>Emisión de recibos</div>
            <div style={{ fontSize:12, color:'var(--dim)', marginTop:2 }}>Ofrecer recibo después de cada venta</div>
          </div>
          <Toggle k="activo" />
        </div>
      </div>

      {/* Formato */}
      <div className="gym-card" style={{ padding:'16px 20px', marginBottom:14 }}>
        <h3 style={{ fontSize:13, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>Formato</h3>
        <div style={{ display:'flex', gap:10 }}>
          {[['carta','Carta (8.5×11)'],['media','Media carta (5.5×8.5)'],['ticket','Ticket 80mm']].map(([v,l]) => (
            <button key={v} onClick={() => set('formato', v)} style={{
              flex:1, padding:'10px 6px', borderRadius:8, fontSize:12, fontWeight:600,
              border:`1px solid ${config.formato===v ? 'var(--red)' : 'var(--line)'}`,
              background: config.formato===v ? 'oklch(0.66 0.22 25 / .12)' : 'transparent',
              color: config.formato===v ? 'var(--ink)' : 'var(--dim)', cursor:'pointer',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Elementos a mostrar */}
      <div className="gym-card" style={{ padding:'16px 20px', marginBottom:14 }}>
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
      </div>

      {/* Mensaje pie */}
      {config.mostrar_mensaje && (
        <div className="gym-card" style={{ padding:'16px 20px', marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:6 }}>Mensaje al pie</label>
          <input
            className="gym-input"
            value={config.mensaje_pie}
            onChange={e => set('mensaje_pie', e.target.value)}
            placeholder="Ej: Gracias por tu preferencia"
            maxLength={120}
          />
        </div>
      )}
    </div>
    {ventaPrevia && <VistaRecibo venta={ventaPrevia} onClose={() => setVentaPrevia(null)} />}
    </>
  )
}
