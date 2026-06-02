import { useState, useEffect } from 'react'
import { Save, Upload, QrCode, Settings2, ToggleLeft, ToggleRight, Printer, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const METODOS_DISPONIBLES = [
  { id: 'efectivo', label: 'Efectivo', emoji: '💵' },
  { id: 'qr', label: 'QR', emoji: '📱' },
  { id: 'tarjeta', label: 'Tarjeta', emoji: '💳' },
  { id: 'transferencia', label: 'Transferencia', emoji: '🏦' },
  { id: 'mixto', label: 'Pago Mixto', emoji: '🔀' },
]

function Section({ title, children }) {
  return (
    <div className="gym-card" style={{ padding: '20px 22px', marginBottom: 16 }}>
      <h3 style={{ fontFamily: 'var(--display)', fontSize: 13, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted)', marginBottom: 16, textTransform: 'uppercase' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

export default function ConfiguracionPOS() {
  const [config, setConfig] = useState({
    gym_nombre: 'Urban Fitness Club',
    gym_direccion: '',
    gym_telefono: '',
    gym_email: '',
    qr_banco: '',
    qr_cuenta: '',
    qr_descripcion: '',
    metodos_pago_activos: 'efectivo,qr,tarjeta,transferencia,mixto',
    facturacion_activa: false,
    descuento_maximo: 50,
    sonidos_activos: false,
  })
  const [guardando, setGuardando] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [impresoras, setImpresoras] = useState([])
  const [detectando, setDetectando] = useState(false)
  const [probando, setProbando] = useState(false)
  const [impresoraSeleccionada, setImpresoraSeleccionada] = useState('')

  useEffect(() => {
    window.api.pos.getConfig().then(data => {
      if (data) {
        setConfig({
          gym_nombre: data.gym_nombre || 'Urban Fitness Club',
          gym_direccion: data.gym_direccion || '',
          gym_telefono: data.gym_telefono || '',
          gym_email: data.gym_email || '',
          gym_logo: data.gym_logo || '',
          qr_imagen: data.qr_imagen || '',
          qr_banco: data.qr_banco || '',
          qr_cuenta: data.qr_cuenta || '',
          qr_descripcion: data.qr_descripcion || '',
          metodos_pago_activos: data.metodos_pago_activos || 'efectivo,qr,tarjeta,transferencia,mixto',
          facturacion_activa: !!data.facturacion_activa,
          descuento_maximo: data.descuento_maximo ?? 50,
          sonidos_activos: !!data.sonidos_activos,
        })
      }
      setCargando(false)
    })
  }, [])

  function set(k, v) { setConfig(prev => ({ ...prev, [k]: v })) }

  function toggleMetodo(metodoId) {
    const activos = (config.metodos_pago_activos || '').split(',').filter(Boolean)
    const nombre = METODOS_DISPONIBLES.find(m => m.id === metodoId)?.label || metodoId
    if (activos.includes(metodoId)) {
      if (activos.length <= 1) {
        toast.error('Debes mantener al menos un método de pago activo')
        return
      }
      set('metodos_pago_activos', activos.filter(m => m !== metodoId).join(','))
      toast(`Método "${nombre}" desactivado. Ya no aparecerá en cobros.`, { icon: '⚠️' })
    } else {
      set('metodos_pago_activos', [...activos, metodoId].join(','))
      toast.success(`Método "${nombre}" activado`)
    }
  }

  async function detectarImpresoras() {
    setDetectando(true)
    try {
      const lista = await window.api.pos.getPrinters()
      setImpresoras(lista || [])
      if (lista?.length === 0) toast('No se encontraron impresoras instaladas', { icon: '⚠️' })
      else toast.success(`${lista.length} impresora${lista.length !== 1 ? 's' : ''} detectada${lista.length !== 1 ? 's' : ''}`)
    } catch {
      toast.error('Error al detectar impresoras')
    } finally {
      setDetectando(false)
    }
  }

  async function probarImpresora() {
    if (!impresoraSeleccionada) return toast.error('Selecciona una impresora primero')
    setProbando(true)
    try {
      const r = await window.api.pos.testPrint(impresoraSeleccionada)
      if (r.ok) toast.success('Página de prueba enviada correctamente')
      else toast.error(`Error al imprimir: ${r.reason || 'desconocido'}`)
    } catch {
      toast.error('Error al enviar prueba')
    } finally {
      setProbando(false)
    }
  }

  async function seleccionarQR() {
    const ruta = await window.api.openImage()
    if (ruta) set('qr_imagen', ruta)
  }

  async function guardar() {
    setGuardando(true)
    try {
      await window.api.pos.saveConfig(config)
      toast.success('Configuración guardada')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const metodosActivos = (config.metodos_pago_activos || '').split(',').filter(Boolean)
  const inp = (label, key, opts = {}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{label}</label>
      <input
        className="gym-input"
        type={opts.type || 'text'}
        value={config[key] || ''}
        onChange={e => set(key, e.target.value)}
        placeholder={opts.placeholder}
      />
    </div>
  )

  if (cargando) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--dim)' }}>Cargando...</div>

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 className="titulo-metalico" style={{ marginBottom: 4 }}>Punto de Venta y Pagos</h1>
          <p style={{ fontSize: 13, color: 'var(--dim)' }}>Configuración del punto de venta y métodos de cobro</p>
        </div>
        <button onClick={guardar} className="btn-primary" disabled={guardando} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Save size={15} /> {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      <Section title="Datos del establecimiento">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1/-1' }}>{inp('Nombre del gimnasio', 'gym_nombre', { placeholder: 'Urban Fitness Club' })}</div>
          {inp('Dirección', 'gym_direccion')}
          {inp('Teléfono', 'gym_telefono')}
          {inp('Email', 'gym_email', { placeholder: 'contacto@gym.com' })}
        </div>
      </Section>

      <Section title="QR de pago">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {inp('Banco / Empresa', 'qr_banco', { placeholder: 'BNB, Mercantil...' })}
            {inp('Número de cuenta', 'qr_cuenta')}
            {inp('Descripción', 'qr_descripcion', { placeholder: 'Gym Urban - Pagos' })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 120, height: 120, borderRadius: 10, overflow: 'hidden',
              border: '1px solid var(--line)', background: 'oklch(1 0 0 / .04)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {config.qr_imagen ? (
                <img src={`file://${config.qr_imagen}`} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <QrCode size={40} color="var(--dim)" />
              )}
            </div>
            <button onClick={seleccionarQR} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <Upload size={13} /> Cargar QR
            </button>
          </div>
        </div>
      </Section>

      <Section title="Métodos de pago activos">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {METODOS_DISPONIBLES.map(m => {
            const activo = metodosActivos.includes(m.id)
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleMetodo(m.id)}
                style={{
                  padding: '10px 16px', borderRadius: 10,
                  background: activo ? 'oklch(0.66 0.22 25 / .15)' : 'var(--glass)',
                  border: `1px solid ${activo ? 'var(--red)' : 'var(--line)'}`,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
                  color: activo ? 'var(--ink)' : 'var(--dim)',
                  fontSize: 13, fontWeight: activo ? 600 : 400,
                  transition: 'all .2s',
                }}
              >
                <span>{m.emoji}</span>
                <span>{m.label}</span>
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="Impresora fiscal / ticket">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={detectarImpresoras}
              disabled={detectando}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 7 }}
            >
              {detectando
                ? <RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
                : <Printer size={13} />}
              {detectando ? 'Detectando...' : 'Detectar impresoras'}
            </button>
            {impresoras.length > 0 && (
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>{impresoras.length} impresora{impresoras.length !== 1 ? 's' : ''} encontrada{impresoras.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {impresoras.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {impresoras.map(imp => {
                const isSelected = impresoraSeleccionada === imp.name
                const isDefault = imp.isDefault
                return (
                  <div
                    key={imp.name}
                    onClick={() => setImpresoraSeleccionada(imp.name)}
                    style={{
                      padding: '10px 14px', borderRadius: 9, cursor: 'pointer',
                      border: `1px solid ${isSelected ? 'var(--red)' : 'var(--line)'}`,
                      background: isSelected ? 'oklch(0.66 0.22 25 / .12)' : 'var(--glass)',
                      display: 'flex', alignItems: 'center', gap: 10, transition: 'all .15s',
                    }}
                  >
                    <Printer size={14} color={isSelected ? 'oklch(0.76 0.20 25)' : 'var(--dim)'} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? 'var(--ink)' : 'var(--muted)' }}>{imp.name}</div>
                      {imp.description && imp.description !== imp.name && (
                        <div style={{ fontSize: 11, color: 'var(--dim)' }}>{imp.description}</div>
                      )}
                    </div>
                    {isDefault && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'oklch(0.74 0.13 250)', background: 'oklch(0.74 0.13 250 / .15)', padding: '2px 7px', borderRadius: 10, border: '1px solid oklch(0.74 0.13 250 / .3)' }}>
                        PREDETERMINADA
                      </span>
                    )}
                    {isSelected && <CheckCircle size={14} color="oklch(0.78 0.16 155)" />}
                  </div>
                )
              })}
            </div>
          )}

          {impresoraSeleccionada && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={probarImpresora}
                disabled={probando}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 7 }}
              >
                {probando
                  ? <RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
                  : <Printer size={13} />}
                {probando ? 'Enviando...' : 'Imprimir página de prueba'}
              </button>
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>en {impresoraSeleccionada}</span>
            </div>
          )}

          {impresoras.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--dim)' }}>
              Haz clic en "Detectar impresoras" para listar las impresoras instaladas en el sistema.
            </p>
          )}
        </div>
      </Section>

      <Section title="Opciones generales">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Descuento máximo personalizado</div>
              <div style={{ fontSize: 11, color: 'var(--dim)' }}>Porcentaje máximo que se puede aplicar manualmente</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                className="gym-input"
                type="number" min="0" max="100"
                value={config.descuento_maximo}
                onChange={e => set('descuento_maximo', parseFloat(e.target.value))}
                style={{ width: 80, textAlign: 'center' }}
              />
              <span style={{ fontSize: 13, color: 'var(--dim)' }}>%</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Sonidos al registrar ingreso</div>
              <div style={{ fontSize: 11, color: 'var(--dim)' }}>Reproducir efecto de sonido al confirmar</div>
            </div>
            <button type="button" onClick={() => set('sonidos_activos', !config.sonidos_activos)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              {config.sonidos_activos ? <ToggleRight size={32} color="var(--green)" /> : <ToggleLeft size={32} color="var(--dim)" />}
            </button>
          </div>
        </div>
      </Section>
    </div>
  )
}
