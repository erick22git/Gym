import { useState, useEffect, useRef } from 'react'
import { CreditCard, Plus, Search, Users, Receipt, FileText, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '../components/ui/Modal'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { PAGES } from '../constants'
import { motion } from 'framer-motion'

const tbodyV = { hidden: {}, show: { transition: { staggerChildren: 0.025 } } }
const rowV   = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.18 } } }

// Componente lazy para VistaRecibo
let _VistaRecibo = null
async function getVistaRecibo() {
  if (!_VistaRecibo) {
    const m = await import('../modules/recibos/VistaRecibo.jsx')
    _VistaRecibo = m.default
  }
  return _VistaRecibo
}

export default function Memberships() {
  const { navigate } = useApp()
  const { esModuloActivo, usuario } = useAuth()
  const [clientes, setClientes] = useState([])
  const [planes, setPlanes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(false)
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)
  const [form, setForm] = useState({ plan_id: '', fecha_inicio: new Date().toISOString().slice(0, 10), metodo: 'efectivo' })

  // flujo multi-paso
  const [paso, setPaso] = useState('form') // 'form' | 'miembros' | 'comprobante'
  const [miembros, setMiembros] = useState([])
  const [ventaParaRecibo, setVentaParaRecibo] = useState(null)
  const [membresiaId, setMembresiaId] = useState(null)
  const [VistaReciboComp, setVistaReciboComp] = useState(null)
  const [mostrarRecibo, setMostrarRecibo] = useState(false)
  const [procesando, setProcesando] = useState(false)
  // busqueda miembro
  const [busqMiembros, setBusqMiembros] = useState([])
  const debounceRefs = useRef({})

  useEffect(() => {
    window.api.clientes.getAll().then(setClientes)
    window.api.planes.getActive().then(setPlanes)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      if (busqueda) window.api.clientes.search(busqueda).then(setClientes)
      else window.api.clientes.getAll().then(setClientes)
    }, 300)
    return () => clearTimeout(t)
  }, [busqueda])

  function abrirModal(cliente) {
    setClienteSeleccionado(cliente)
    setForm({ plan_id: planes[0]?.id || '', fecha_inicio: new Date().toISOString().slice(0, 10), metodo: 'efectivo' })
    setPaso('form')
    setMiembros([])
    setVentaParaRecibo(null)
    setMembresiaId(null)
    setMostrarRecibo(false)
    setModal(true)
  }

  function cerrarModal() {
    setModal(false)
    window.api.clientes.getAll().then(setClientes)
  }

  const planActual = planes.find(p => p.id == form.plan_id)
  const esGrupal = planActual && (planActual.capacidad || 1) > 1

  // ── Buscar miembro por carnet ──────────────────────────────────────────────
  async function buscarMiembro(idx, carnet) {
    const nuevos = [...miembros]
    nuevos[idx] = { ...nuevos[idx], carnet }
    setMiembros(nuevos)
    if (carnet.length < 3) { setBusqMiembros(p => ({ ...p, [idx]: [] })); return }
    clearTimeout(debounceRefs.current[idx])
    debounceRefs.current[idx] = setTimeout(async () => {
      const res = await window.api.clientes.search(carnet)
      setBusqMiembros(p => ({ ...p, [idx]: res || [] }))
    }, 300)
  }

  function seleccionarMiembro(idx, cliente) {
    const nuevos = [...miembros]
    nuevos[idx] = { carnet: cliente.carnet, nombre: `${cliente.nombre} ${cliente.apellido}`, cliente_id: cliente.id }
    setMiembros(nuevos)
    setBusqMiembros(p => ({ ...p, [idx]: [] }))
  }

  // ── Guardar ────────────────────────────────────────────────────────────────
  async function guardar(e) {
    e.preventDefault()
    if (!form.plan_id) return toast.error('Selecciona un plan')

    // Si plan grupal y estamos en paso 'form' → ir a paso miembros
    if (esGrupal && paso === 'form') {
      const capacidad = planActual.capacidad || 2
      const numMiembros = Math.max(0, capacidad - 1)
      setMiembros(Array.from({ length: numMiembros }, () => ({ carnet: '', nombre: '', cliente_id: null })))
      setPaso('miembros')
      return
    }

    await procesarPago()
  }

  async function procesarPago() {
    if (!planActual) return toast.error('Plan no encontrado')
    setProcesando(true)
    try {
      const inicio = new Date(form.fecha_inicio)
      const fin = new Date(inicio)
      fin.setDate(fin.getDate() + planActual.duracion_dias)

      // Obtener sesión de caja activa si existe
      let sesionCajaId = null
      try {
        const sesion = await window.api.caja.getSesionActual()
        sesionCajaId = sesion?.id || null
      } catch (_) {}

      const result = await window.api.ventas.procesarPagoMembresia({
        cliente_id: clienteSeleccionado.id,
        plan_id: planActual.id,
        plan_nombre: planActual.nombre,
        fecha_inicio: form.fecha_inicio,
        fecha_fin: fin.toISOString().slice(0, 10),
        total: planActual.precio,
        subtotal: planActual.precio,
        metodo_pago: form.metodo,
        usuario_id: usuario?.id,
        sesion_caja_id: sesionCajaId,
      })

      if (!result.ok) {
        toast.error('Error al procesar el pago')
        return
      }

      const memId = result.membresia_id
      setMembresiaId(memId)

      // Registrar miembros del grupo
      if (esGrupal && memId) {
        await window.api.membresiaMiembros.sincronizarTitular(memId, clienteSeleccionado.id)
        for (const [idx, m] of miembros.filter(m => m.nombre || m.cliente_id).entries()) {
          if (m.cliente_id) {
            await window.api.membresiaMiembros.addMiembro(memId, m.cliente_id, false).catch(() => {})
          } else if (m.nombre) {
            // Crear cliente básico; si no hay carnet se genera uno sintético
            try {
              const [first, ...rest] = m.nombre.trim().split(/\s+/)
              const carnetFinal = m.carnet || `GRP-${memId}-${idx + 1}`
              const nuevo = await window.api.clientes.create({ nombre: first, apellido: rest.join(' '), carnet: carnetFinal })
              if (nuevo?.id) await window.api.membresiaMiembros.addMiembro(memId, nuevo.id, false).catch(() => {})
            } catch (_) {}
          }
        }
      }

      toast.success('Membresía asignada correctamente')

      // Preparar datos para comprobante
      const ventaData = {
        id: result.venta_id,
        numero: result.venta_id,
        fecha: new Date().toLocaleString('es-BO'),
        cliente_nombre: `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}`,
        cliente_doc: clienteSeleccionado.carnet,
        total: planActual.precio,
        metodo_pago: form.metodo,
        cajero: usuario?.nombre_completo || '',
        items: [{ nombre: planActual.nombre, cantidad: 1, total: planActual.precio }],
        vuelto: 0,
      }
      setVentaParaRecibo(ventaData)

      const facturacionActivo = esModuloActivo('facturacion')
      const recibosActivo = esModuloActivo('recibos')

      if (!facturacionActivo && !recibosActivo) {
        cerrarModal()
        return
      }

      setPaso('comprobante')

      // Precargar VistaRecibo
      if (recibosActivo) {
        getVistaRecibo().then(comp => setVistaReciboComp(() => comp))
      }
    } finally {
      setProcesando(false)
    }
  }

  async function abrirRecibo() {
    if (!VistaReciboComp) {
      const comp = await getVistaRecibo()
      setVistaReciboComp(() => comp)
    }
    setMostrarRecibo(true)
  }

  function abrirFactura() {
    if (ventaParaRecibo) {
      localStorage.setItem('factura_prefill', JSON.stringify({
        cliente_documento: ventaParaRecibo.cliente_doc,
        cliente_nombre: ventaParaRecibo.cliente_nombre,
        concepto: planActual?.nombre || 'Membresía',
        precio_unitario: String(planActual?.precio || 0),
        metodo_pago: form.metodo,
      }))
    }
    navigate(PAGES.FACTURACION_EMITIR)
    setModal(false)
  }

  // ── Render modal interior según paso ──────────────────────────────────────

  function renderPasoForm() {
    return (
      <form onSubmit={guardar} className="flex flex-col gap-4">
        <div>
          <label className="gym-label">Plan *</label>
          <select className="gym-select" value={form.plan_id} onChange={e => setForm(p => ({ ...p, plan_id: e.target.value }))}>
            <option value="">Seleccionar plan...</option>
            {planes.map(p => (
              <option key={p.id} value={p.id}>
                {p.nombre} — {p.duracion_dias} días — Bs. {p.precio}
                {p.tipo_plan && p.tipo_plan !== 'individual' ? ` (${p.tipo_plan}, ${p.capacidad || 2} personas)` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="form-grid">
          <div><label className="gym-label">Fecha Inicio</label>
            <input className="gym-input" type="date" value={form.fecha_inicio} onChange={e => setForm(p => ({ ...p, fecha_inicio: e.target.value }))} />
          </div>
          <div><label className="gym-label">Método de Pago</label>
            <select className="gym-select" value={form.metodo} onChange={e => setForm(p => ({ ...p, metodo: e.target.value }))}>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta_debito">Tarjeta Débito</option>
              <option value="tarjeta_credito">Tarjeta Crédito</option>
              <option value="transferencia">Transferencia</option>
              <option value="qr">QR</option>
            </select>
          </div>
        </div>
        {planActual && (
          <div style={{ background: 'oklch(1 0 0 / .04)', border: '1px solid var(--line)', borderRadius: 10, padding: 14, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--muted)' }}>Monto a pagar:</span>
              <strong style={{ color: 'oklch(0.75 0.18 25)', fontSize: 17, fontFamily: 'Oxanium, sans-serif' }}>Bs. {planActual.precio}</strong>
            </div>
          </div>
        )}

        {esGrupal && (() => {
          const extras = (planActual.capacidad || 2) - 1
          return (
            <div style={{ background: 'oklch(0.74 0.13 250 / .08)', border: '1.5px solid oklch(0.74 0.13 250 / .35)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: 'oklch(0.74 0.13 250 / .18)', border: '1px solid oklch(0.74 0.13 250 / .35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Users size={17} color="oklch(0.80 0.12 250)" />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.88 0.09 250)', lineHeight: 1.3 }}>Plan grupal · {planActual.capacidad || 2} personas</div>
                    <div style={{ fontSize: 11, color: 'oklch(0.65 0.08 250)', marginTop: 1 }}>
                      {extras} miembro{extras !== 1 ? 's' : ''} adicional{extras !== 1 ? 'es' : ''} · mismo vencimiento
                    </div>
                  </div>
                </div>
                <span style={{ background: 'oklch(0.74 0.13 250 / .22)', border: '1px solid oklch(0.74 0.13 250 / .45)', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: 'oklch(0.80 0.12 250)', whiteSpace: 'nowrap' }}>
                  +{extras}
                </span>
              </div>
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid oklch(0.74 0.13 250 / .2)', fontSize: 11, color: 'oklch(0.60 0.06 250)' }}>
                Al continuar podrás registrar los datos de cada miembro adicional
              </div>
            </div>
          )
        })()}

        <div className="flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={() => setModal(false)}>Cancelar</button>
          <button type="submit" className="btn-primary flex-1" disabled={procesando}>
            {procesando ? 'Procesando...' : esGrupal ? `Agregar miembros (${(planActual.capacidad || 2) - 1})` : 'Guardar'}
          </button>
        </div>
      </form>
    )
  }

  function renderPasoMiembros() {
    return (
      <div>
        <div style={{ background: 'oklch(0.74 0.13 250 / .08)', border: '1px solid oklch(0.74 0.13 250 / .25)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'oklch(0.74 0.13 250)' }}>
          <Users size={12} style={{ display: 'inline', marginRight: 5 }} />
          Plan {planActual?.nombre} · {planActual?.capacidad || 2} personas · mismo vencimiento para todos
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, letterSpacing: '.06em', textTransform: 'uppercase' }}>Titular</div>
          <div style={{ background: 'var(--glass)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--ink)' }}>
            {clienteSeleccionado?.nombre} {clienteSeleccionado?.apellido} · CI {clienteSeleccionado?.carnet}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {miembros.map((m, idx) => (
            <div key={idx}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                Miembro {idx + 2}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 8 }}>
                <div style={{ position: 'relative' }}>
                  <input
                    className="gym-input"
                    placeholder="Carnet / CI"
                    value={m.carnet}
                    onChange={e => buscarMiembro(idx, e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                  {busqMiembros[idx]?.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'oklch(0.14 0.015 250)', border: '1px solid var(--line)', borderRadius: 8, zIndex: 100, maxHeight: 140, overflowY: 'auto', marginTop: 2 }}>
                      {busqMiembros[idx].map(c => (
                        <div key={c.id} onClick={() => seleccionarMiembro(idx, c)}
                          style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--line)', fontSize: 12 }}
                          onMouseEnter={e => e.currentTarget.style.background = 'oklch(1 0 0 / .05)'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}>
                          {c.nombre} {c.apellido} · {c.carnet}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  className="gym-input"
                  placeholder="Nombre completo"
                  value={m.nombre}
                  onChange={e => { const n = [...miembros]; n[idx] = { ...n[idx], nombre: e.target.value, cliente_id: null }; setMiembros(n) }}
                  style={{ fontSize: 13 }}
                />
              </div>
              {m.cliente_id && <div style={{ fontSize: 10, color: 'oklch(0.78 0.16 155)', marginTop: 3 }}>✓ Cliente registrado encontrado</div>}
            </div>
          ))}
        </div>

        <div className="flex gap-3" style={{ marginTop: 20 }}>
          <button type="button" className="btn-secondary flex-1" onClick={() => setPaso('form')}>← Volver</button>
          <button type="button" className="btn-primary flex-1" disabled={procesando} onClick={procesarPago}>
            {procesando ? 'Procesando...' : 'Confirmar y Pagar'}
          </button>
        </div>
      </div>
    )
  }

  function renderPasoComprobante() {
    const facturacionActivo = esModuloActivo('facturacion')
    const recibosActivo = esModuloActivo('recibos')

    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: 'oklch(0.78 0.16 155 / .15)', border: '1px solid oklch(0.78 0.16 155 / .3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <Check size={26} color="oklch(0.78 0.16 155)" />
        </div>
        <h3 style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>¡Membresía asignada!</h3>
        <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 24 }}>
          {planActual?.nombre} · Bs. {planActual?.precio} · {clienteSeleccionado?.nombre}
        </p>

        {(facturacionActivo || recibosActivo) && (
          <>
            <p style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 14 }}>¿Deseas generar un comprobante?</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 20 }}>
              {recibosActivo && (
                <button onClick={abrirRecibo} style={{ flex: 1, maxWidth: 160, padding: '12px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700, background: 'oklch(0.82 0.14 75 / .15)', border: '1px solid oklch(0.82 0.14 75 / .4)', color: 'oklch(0.88 0.1 75)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <Receipt size={20} />
                  <span>Recibo</span>
                </button>
              )}
              {facturacionActivo && (
                <button onClick={abrirFactura} style={{ flex: 1, maxWidth: 160, padding: '12px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700, background: 'oklch(0.74 0.13 250 / .15)', border: '1px solid oklch(0.74 0.13 250 / .4)', color: 'oklch(0.80 0.12 250)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <FileText size={20} />
                  <span>Factura</span>
                </button>
              )}
            </div>
          </>
        )}

        <button onClick={cerrarModal} className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: 14 }}>
          Finalizar
        </button>
      </div>
    )
  }

  const TITULO_MODAL = {
    form: `Membresía — ${clienteSeleccionado?.nombre} ${clienteSeleccionado?.apellido}`,
    miembros: `Registrar miembros — ${planActual?.nombre}`,
    comprobante: 'Comprobante de pago',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="titulo-metalico">Membresías</h1>
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--dim)' }} />
        <input className="gym-input" placeholder="Buscar cliente..." style={{ paddingLeft: 36 }}
          value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="gym-card" style={{ overflow: 'hidden' }}
      >
        <table className="gym-table">
          <thead><tr><th>Cliente</th><th>Carnet</th><th>Estado</th><th>Vencimiento</th><th>Acción</th></tr></thead>
          <motion.tbody variants={tbodyV} initial="hidden" animate="show">
            {clientes.map(c => {
              const activa = c.mem_estado === 'activa' && c.vigencia && new Date(c.vigencia) >= new Date()
              return (
                <motion.tr key={c.id} variants={rowV}>
                  <td><strong style={{ color: 'var(--ink)' }}>{c.nombre} {c.apellido}</strong></td>
                  <td style={{ fontFamily: 'monospace' }}>{c.carnet}</td>
                  <td><span className={`badge ${activa ? 'badge-green' : 'badge-red'}`}>{activa ? 'Activa' : 'Vencida'}</span></td>
                  <td style={{ fontSize: 13 }}>{c.vigencia ? new Date(c.vigencia).toLocaleDateString('es-BO') : '—'}</td>
                  <td>
                    <button className="btn-secondary btn-sm" onClick={() => abrirModal(c)}>
                      <Plus size={13} style={{ display: 'inline', marginRight: 4 }} />
                      {activa ? 'Renovar' : 'Asignar'}
                    </button>
                  </td>
                </motion.tr>
              )
            })}
          </motion.tbody>
        </table>
      </motion.div>

      <Modal open={modal} onClose={paso === 'comprobante' ? cerrarModal : () => setModal(false)} title={TITULO_MODAL[paso] || ''}>
        {paso === 'form' && renderPasoForm()}
        {paso === 'miembros' && renderPasoMiembros()}
        {paso === 'comprobante' && renderPasoComprobante()}
      </Modal>

      {/* VistaRecibo overlay */}
      {mostrarRecibo && VistaReciboComp && ventaParaRecibo && (
        <VistaReciboComp venta={ventaParaRecibo} onClose={() => setMostrarRecibo(false)} />
      )}
    </div>
  )
}
