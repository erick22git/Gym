import { useState, useEffect } from 'react'
import { Receipt, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import VistaFactura from './VistaFactura'

const TIPOS_DOC = [
  { value: 'CI', label: 'Carnet de Identidad (CI)' },
  { value: 'CEX', label: 'Cédula de Identidad Extranjero' },
  { value: 'PAS', label: 'Pasaporte' },
  { value: 'NIT', label: 'NIT' },
  { value: 'OD', label: 'Otro documento' },
]
const METODOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta_debito', label: 'Tarjeta Débito' },
  { value: 'tarjeta_credito', label: 'Tarjeta Crédito' },
  { value: 'transferencia', label: 'Transferencia Bancaria' },
  { value: 'qr', label: 'QR' },
]

const FORM_INICIAL = {
  cliente_tipo_doc: 'CI',
  cliente_documento: '',
  cliente_nombre: '',
  cliente_correo: '',
  cliente_telefono: '',
  concepto: '',
  cantidad: 1,
  precio_unitario: '',
  descuento: 0,
  metodo_pago: 'efectivo',
  enviar_correo: false,
  // tercero
  facturar_tercero: false,
  tercero_tipo_doc: 'CI',
  tercero_documento: '',
  tercero_nombre: '',
  recordar_facturador: false,
}

export default function EmitirFactura() {
  const [form, setForm] = useState(FORM_INICIAL)
  const [emitiendo, setEmitiendo] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [configurado, setConfigurado] = useState(null)
  const [esSimulacion, setEsSimulacion] = useState(false)
  const [empresa, setEmpresa] = useState(null)
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [clientesSugeridos, setClientesSugeridos] = useState([])
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState(null)
  const [facturadorHabitual, setFacturadorHabitual] = useState(null)

  useEffect(() => {
    window.api.facturacion.isConfigurado().then(r => {
      setConfigurado(r.configurado)
      setEsSimulacion(!!r.simulacion)
    })
    window.api.facturacion.getEmpresa().then(d => { if (d?.nit) setEmpresa(d) })
    // Leer prefill de Memberships
    const prefill = localStorage.getItem('factura_prefill')
    if (prefill) {
      try {
        const data = JSON.parse(prefill)
        localStorage.removeItem('factura_prefill')
        setForm(p => ({ ...p, ...data }))
      } catch (_) {}
    }
  }, [])

  // Búsqueda de cliente por nombre
  useEffect(() => {
    if (busquedaCliente.length > 1) {
      window.api.clientes.search(busquedaCliente).then(setClientesSugeridos)
    } else {
      setClientesSugeridos([])
    }
  }, [busquedaCliente])

  // Autocompletar por número de documento (debounce 450ms para que ocurra
  // antes de que el usuario haga click en "Emitir")
  useEffect(() => {
    if (!form.cliente_documento || form.cliente_documento.length < 3) return
    const timer = setTimeout(async () => {
      try {
        const c = await window.api.clientes.getByCarnet(form.cliente_documento.trim())
        if (c && !form.cliente_nombre) setForm(p => ({
          ...p,
          cliente_nombre: `${c.nombre} ${c.apellido}`.trim(),
          cliente_correo: c.email || p.cliente_correo,
          cliente_telefono: c.telefono || p.cliente_telefono,
        }))
      } catch (_) {}
    }, 450)
    return () => clearTimeout(timer)
  }, [form.cliente_documento])

  async function autocompletarPorDoc() {
    if (!form.cliente_documento || form.cliente_documento.length < 3) return
    try {
      const c = await window.api.clientes.getByCarnet(form.cliente_documento)
      if (c) setForm(p => ({
        ...p,
        cliente_nombre: `${c.nombre} ${c.apellido}`.trim(),
        cliente_correo: c.email || p.cliente_correo,
        cliente_telefono: c.telefono || p.cliente_telefono,
      }))
    } catch (_) {}
  }

  async function seleccionarCliente(cliente) {
    setClienteSeleccionadoId(cliente.id)
    setForm(p => ({
      ...p,
      cliente_documento: cliente.carnet,
      cliente_nombre: `${cliente.nombre} ${cliente.apellido}`,
      cliente_correo: cliente.email || '',
      cliente_telefono: cliente.telefono || '',
      facturar_tercero: false,
      tercero_tipo_doc: 'CI', tercero_documento: '', tercero_nombre: '', recordar_facturador: false,
    }))
    setBusquedaCliente('')
    setClientesSugeridos([])
    // Cargar facturador habitual
    try {
      const fh = await window.api.clientes.getFacturadorHabitual(cliente.id)
      setFacturadorHabitual(fh)
      if (fh) {
        setForm(p => ({ ...p, facturar_tercero: true, tercero_tipo_doc: fh.tipo_doc || 'CI', tercero_documento: fh.numero || '', tercero_nombre: fh.nombre || '' }))
      }
    } catch (_) {}
  }

  const f = k => e => {
    const val = e.target.type === 'checkbox' ? e.target.checked
      : e.target.type === 'number' ? parseFloat(e.target.value) || 0
      : e.target.value
    setForm(p => ({ ...p, [k]: val }))
  }

  const subtotal = (parseFloat(form.precio_unitario) || 0) * (parseInt(form.cantidad) || 1)
  const descuento = parseFloat(form.descuento) || 0
  const total = Math.max(0, subtotal - descuento)

  async function emitir(e) {
    e.preventDefault()
    if (!form.cliente_nombre) return toast.error('Ingresa el nombre del cliente')
    if (!form.cliente_documento) return toast.error('Ingresa el número de documento')
    if (!form.concepto) return toast.error('Ingresa el concepto de la factura')
    if (!parseFloat(form.precio_unitario)) return toast.error('Ingresa el precio unitario')
    if (form.facturar_tercero && !form.tercero_documento) return toast.error('Ingresa el documento del facturador')
    if (form.facturar_tercero && !form.tercero_nombre) return toast.error('Ingresa el nombre del facturador')

    setEmitiendo(true)
    try {
      // Si factura a tercero, usar datos del tercero
      const docParaFactura = form.facturar_tercero ? form.tercero_documento : form.cliente_documento
      const nombreParaFactura = form.facturar_tercero ? form.tercero_nombre : form.cliente_nombre
      const tipoDocParaFactura = form.facturar_tercero ? form.tercero_tipo_doc : form.cliente_tipo_doc

      const precioUnit = parseFloat(form.precio_unitario)
      const cant = parseInt(form.cantidad) || 1
      const datos = {
        ...form,
        cliente_documento: docParaFactura,
        cliente_nombre: nombreParaFactura,
        cliente_tipo_doc: tipoDocParaFactura,
        monto_total: total,
        precio_unitario: precioUnit,
        items: [{
          nombre: form.concepto,
          cantidad: cant,
          precio_unitario: precioUnit,
          subtotal: total,
        }],
      }
      const res = await window.api.facturacion.emitirFactura(datos)
      if (res.ok) {
        // Guardar facturador habitual si se pidió
        if (form.facturar_tercero && form.recordar_facturador && clienteSeleccionadoId) {
          await window.api.clientes.setFacturadorHabitual(clienteSeleccionadoId, {
            tipo_doc: form.tercero_tipo_doc,
            numero: form.tercero_documento,
            nombre: form.tercero_nombre,
          })
        }
        setResultado(res)
        toast.success('¡Factura emitida correctamente!')
      } else {
        toast.error(res.error || 'Error al emitir la factura')
      }
    } catch (err) {
      toast.error(err.message || 'Error desconocido')
    }
    setEmitiendo(false)
  }

  function nueva() {
    setForm(FORM_INICIAL)
    setResultado(null)
  }

  // ── Sin configuración ──
  if (configurado === false) {
    return (
      <div style={{ maxWidth: 500, margin: '60px auto', textAlign: 'center' }}>
        <Receipt size={48} color="#333" style={{ marginBottom: 16 }} />
        <h2 style={{ color: '#888', marginBottom: 8 }}>Facturación no configurada</h2>
        <p style={{ color: '#555', fontSize: 13, marginBottom: 20 }}>
          Configura tus credenciales SFE para activar la facturación electrónica.
        </p>
        <p style={{ color: '#e63946', fontSize: 12 }}>
          Ve a: Configurar SFE → completa los 4 tabs → ejecuta las pruebas
        </p>
      </div>
    )
  }

  if (resultado) {
    return (
      <VistaFactura
        factura={resultado.factura}
        empresa={empresa}
        onClose={null}
        onNueva={nueva}
        onEditar={() => setResultado(null)}
      />
    )
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <h1 className="titulo-metalico" style={{ margin:0 }}>Emitir Factura Electrónica</h1>
        {esSimulacion && (
          <span style={{ fontSize:11, fontWeight:700, color:'#856404', background:'#fff3cd', border:'1px solid #ffc107', padding:'3px 10px', borderRadius:20 }}>
            MODO SIMULACIÓN
          </span>
        )}
      </div>

      <form onSubmit={emitir}>
        {/* ── Datos del cliente ── */}
        <div className="gym-card p-5 mb-4">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>Datos del Cliente</h3>

          {/* Búsqueda de cliente */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
            <input
              className="gym-input"
              placeholder="Buscar cliente existente..."
              value={busquedaCliente}
              onChange={e => setBusquedaCliente(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
            {clientesSugeridos.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#111', border: '1px solid #222', borderRadius: 8, zIndex: 100, maxHeight: 180, overflowY: 'auto', marginTop: 2 }}>
                {clientesSugeridos.map(c => (
                  <div key={c.id}
                    onClick={() => seleccionarCliente(c)}
                    style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #1a1a1a', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <div style={{ fontSize: 13 }}>{c.nombre} {c.apellido}</div>
                    <div style={{ fontSize: 11, color: '#666' }}>CI: {c.carnet} · {c.email || 'sin email'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-grid">
            <div>
              <label className="gym-label">Tipo Documento</label>
              <select className="gym-select" value={form.cliente_tipo_doc} onChange={f('cliente_tipo_doc')}>
                {TIPOS_DOC.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="gym-label">Número Documento *</label>
              <input className="gym-input" value={form.cliente_documento} onChange={f('cliente_documento')} onBlur={autocompletarPorDoc} required placeholder="Ej: 12345678" />
            </div>
            <div className="form-full">
              <label className="gym-label">Razón Social / Nombre *</label>
              <input className="gym-input" value={form.cliente_nombre} onChange={f('cliente_nombre')} required placeholder="Nombre completo o razón social" />
            </div>
            <div>
              <label className="gym-label">Correo Electrónico</label>
              <input className="gym-input" type="email" value={form.cliente_correo} onChange={f('cliente_correo')} placeholder="cliente@email.com" />
            </div>
            <div>
              <label className="gym-label">Teléfono</label>
              <input className="gym-input" value={form.cliente_telefono} onChange={f('cliente_telefono')} />
            </div>
          </div>

          {/* ── Facturar a tercero ── */}
          <div style={{ marginTop: 16, borderTop: '1px solid #1a1a1a', paddingTop: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: form.facturar_tercero ? 12 : 0 }}>
              <input type="checkbox" checked={form.facturar_tercero} onChange={f('facturar_tercero')} style={{ width: 15, height: 15, accentColor: '#e63946' }} />
              <span style={{ fontSize: 13, color: '#ccc', fontWeight: 500 }}>
                Facturar a nombre de otra persona
                {facturadorHabitual && !form.facturar_tercero && (
                  <span style={{ marginLeft: 8, fontSize: 11, color: '#e63946', fontWeight: 600 }}>
                    (habitual: {facturadorHabitual.nombre})
                  </span>
                )}
              </span>
            </label>
            {form.facturar_tercero && (
              <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, color: '#e63946', fontWeight: 700, marginBottom: 10, letterSpacing: '.05em', textTransform: 'uppercase' }}>
                  Datos del facturador (aparecerá en la factura)
                </div>
                <div className="form-grid">
                  <div>
                    <label className="gym-label">Tipo Documento</label>
                    <select className="gym-select" value={form.tercero_tipo_doc} onChange={f('tercero_tipo_doc')}>
                      {TIPOS_DOC.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="gym-label">Número Documento *</label>
                    <input className="gym-input" value={form.tercero_documento} onChange={f('tercero_documento')} placeholder="Ej: 12345678" />
                  </div>
                  <div className="form-full">
                    <label className="gym-label">Nombre / Razón Social *</label>
                    <input className="gym-input" value={form.tercero_nombre} onChange={f('tercero_nombre')} placeholder="Nombre completo o empresa" />
                  </div>
                </div>
                {clienteSeleccionadoId && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 10 }}>
                    <input type="checkbox" checked={form.recordar_facturador} onChange={f('recordar_facturador')} style={{ width: 14, height: 14, accentColor: '#e63946' }} />
                    <span style={{ fontSize: 12, color: '#888' }}>Recordar como facturador habitual de este socio</span>
                  </label>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Detalle de factura ── */}
        <div className="gym-card p-5 mb-4">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>Detalle de la Factura</h3>
          <div style={{ marginBottom: 14 }}>
            <label className="gym-label">Concepto / Descripción *</label>
            <input className="gym-input" value={form.concepto} onChange={f('concepto')} required placeholder="Ej: Membresía Mensual Gimnasio" />
          </div>
          <div className="form-grid-3" style={{ marginBottom: 14 }}>
            <div>
              <label className="gym-label">Cantidad</label>
              <input className="gym-input" type="number" min={1} value={form.cantidad} onChange={f('cantidad')} />
            </div>
            <div>
              <label className="gym-label">Precio Unitario (Bs.)</label>
              <input className="gym-input" type="number" step="0.01" min={0} value={form.precio_unitario} onChange={f('precio_unitario')} required placeholder="0.00" />
            </div>
            <div>
              <label className="gym-label">Descuento (Bs.)</label>
              <input className="gym-input" type="number" step="0.01" min={0} value={form.descuento} onChange={f('descuento')} />
            </div>
          </div>
          <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#888', fontSize: 13 }}>Subtotal:</span>
              <span style={{ color: '#ccc' }}>Bs. {subtotal.toFixed(2)}</span>
            </div>
            {descuento > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#888', fontSize: 13 }}>Descuento:</span>
                <span style={{ color: '#f87171' }}>- Bs. {descuento.toFixed(2)}</span>
              </div>
            )}
            <div style={{ height: 1, background: '#222', margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, color: '#e5e5e5' }}>TOTAL:</span>
              <span style={{ fontWeight: 800, fontSize: 20, color: '#e63946' }}>Bs. {total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* ── Método de pago ── */}
        <div className="gym-card p-5 mb-4">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>Método de Pago</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {METODOS_PAGO.map(m => (
              <label key={m.value} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', borderRadius: 8, border: `1px solid ${form.metodo_pago === m.value ? '#e63946' : '#1a1a1a'}`, background: form.metodo_pago === m.value ? '#1a0a0b' : 'transparent', transition: 'all 0.15s' }}>
                <input type="radio" name="metodo" value={m.value} checked={form.metodo_pago === m.value} onChange={f('metodo_pago')} style={{ accentColor: '#e63946' }} />
                <span style={{ fontSize: 13, fontWeight: form.metodo_pago === m.value ? 600 : 400, color: form.metodo_pago === m.value ? '#e5e5e5' : '#888' }}>{m.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Opción enviar correo */}
        {form.cliente_correo && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 20 }}>
            <input type="checkbox" checked={form.enviar_correo} onChange={f('enviar_correo')} style={{ width: 16, height: 16, accentColor: '#e63946' }} />
            <span style={{ fontSize: 13, color: '#ccc' }}>Enviar factura por correo a {form.cliente_correo}</span>
          </label>
        )}

        {/* Botones */}
        <div className="flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={nueva}>Cancelar</button>
          <button type="submit" className="btn-primary" style={{ flex: 2, fontSize: 15 }} disabled={emitiendo}>
            {emitiendo
              ? <><span className="spinner" style={{ marginRight: 8 }} />Procesando...</>
              : <><Receipt size={16} style={{ display: 'inline', marginRight: 8 }} />Emitir Factura</>}
          </button>
        </div>
      </form>

    </div>
  )
}
