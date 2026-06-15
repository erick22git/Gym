import { useState, useEffect, useCallback } from 'react'
import { History, Download, Mail, Printer, Ban, Eye, Plus, RefreshCw, Receipt } from 'lucide-react'
import toast from 'react-hot-toast'
import StatCard from '../../components/ui/StatCard'
import Modal from '../../components/ui/Modal'
import { useApp } from '../../context/AppContext'
import { PAGES } from '../../constants'
import { motion } from 'framer-motion'

const tbodyV = { hidden: {}, show: { transition: { staggerChildren: 0.025 } } }
const rowV   = { hidden: { opacity: 0, y: 5 }, show: { opacity: 1, y: 0, transition: { duration: 0.18 } } }

const ESTADOS = ['TODAS', 'EMITIDA', 'SIMULADA', 'PENDIENTE_ENVIO', 'ANULADA']

function colorEstado(estado) {
  if (estado === 'EMITIDA') return { color: '#4ade80', bg: '#14532d22', border: '#16a34a44' }
  if (estado === 'SIMULADA') return { color: '#a78bfa', bg: '#4c1d9522', border: '#7c3aed44' }
  if (estado === 'PENDIENTE_ENVIO') return { color: '#fbbf24', bg: '#78350f22', border: '#d9770644' }
  if (estado === 'ANULADA') return { color: '#f87171', bg: '#7f1d1d22', border: '#dc262644' }
  return { color: '#888', bg: '#1f1f1f', border: '#333' }
}

export default function HistorialFacturas() {
  const { navigate } = useApp()
  const [facturas, setFacturas] = useState([])
  const [stats, setStats] = useState(null)
  const [filtros, setFiltros] = useState({ estado: 'TODAS', cliente: '', numero_factura: '', fecha_desde: '', fecha_hasta: '' })
  const [loading, setLoading] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [facturaDetalle, setFacturaDetalle] = useState(null)
  const [anulando, setAnulando] = useState(null)
  const [motivoAnulacion, setMotivoAnulacion] = useState('')
  const [correoReenvio, setCorreoReenvio] = useState({ open: false, facturaId: null, email: '' })

  const cargar = useCallback(async () => {
    setLoading(true)
    const [data, statsData] = await Promise.all([
      window.api.facturacion.getFacturas(filtros),
      window.api.facturacion.getStats(),
    ])
    setFacturas(data)
    setStats(statsData)
    setLoading(false)
  }, [filtros])

  useEffect(() => { cargar() }, [cargar])

  const f = k => e => setFiltros(p => ({ ...p, [k]: e.target.value }))

  async function sincronizarPendientes() {
    setSincronizando(true)
    try {
      const r = await window.api.facturacion.sincronizarPendientes()
      if (r.ok) {
        toast.success(`Sincronizadas: ${r.enviadas} de ${r.total} facturas pendientes`)
        cargar()
      } else toast.error(r.error || 'Error al sincronizar')
    } catch (err) { toast.error(err.message) }
    setSincronizando(false)
  }

  async function descargarPDF(factura) {
    try {
      const r = await window.api.facturacion.descargarPDF(factura.id)
      if (!r.ok) toast.error(r.error || 'Error al generar PDF')
    } catch (err) { toast.error(err.message) }
  }

  async function confirmarAnulacion() {
    if (!motivoAnulacion.trim()) return toast.error('Ingresa el motivo de anulación')
    try {
      const r = await window.api.facturacion.anularFactura(anulando.id, motivoAnulacion)
      if (r.ok) {
        toast.success('Factura anulada')
        setAnulando(null)
        setMotivoAnulacion('')
        cargar()
      } else toast.error(r.error || 'Error al anular')
    } catch (err) { toast.error(err.message) }
  }

  async function reenviarCorreo() {
    try {
      const r = await window.api.facturacion.reenviarCorreo(correoReenvio.facturaId, correoReenvio.email)
      if (r.ok) {
        toast.success('Correo enviado correctamente')
        setCorreoReenvio({ open: false, facturaId: null, email: '' })
        cargar()
      } else toast.error(r.error || 'Error al enviar correo')
    } catch (err) { toast.error(err.message) }
  }

  function estadoBadge(estado) {
    const c = colorEstado(estado)
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
        background: c.bg, border: `1px solid ${c.border}`, color: c.color,
      }}>
        {estado === 'EMITIDA' ? '🟢' : estado === 'SIMULADA' ? '🔵' : estado === 'PENDIENTE_ENVIO' ? '🟡' : estado === 'ANULADA' ? '🔴' : '⚫'}
        {' '}{estado.replace('_', ' ')}
      </span>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="titulo-metalico">Historial de Facturas</h1>
        <div className="flex gap-3">
          {stats?.pendientesEnvio > 0 && (
            <button className="btn-secondary" onClick={sincronizarPendientes} disabled={sincronizando}>
              <RefreshCw size={14} style={{ display: 'inline', marginRight: 6 }} />
              Sincronizar {stats.pendientesEnvio} pendientes
            </button>
          )}
          <button className="btn-primary" onClick={() => navigate(PAGES.FACTURACION_EMITIR)}>
            <Plus size={14} style={{ display: 'inline', marginRight: 6 }} />Nueva Factura
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}
        >
          <StatCard label="Facturado este mes" value={`Bs. ${(stats.totalFacturadoMes || 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })}`} icon={Receipt} color="#4ade80" />
          <StatCard label="Facturas este mes" value={stats.cantidadFacturasMes} icon={History} color="#3b82f6" />
          <StatCard label="Pendientes de envío" value={stats.pendientesEnvio} icon={RefreshCw} color="#fbbf24" />
          <StatCard label="Anuladas este mes" value={stats.anuladasMes} icon={Ban} color="#f87171" />
        </motion.div>
      )}

      {/* Filtros */}
      <div className="gym-card p-4 mb-4">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label className="gym-label">Estado</label>
            <select className="gym-select" value={filtros.estado} onChange={f('estado')}>
              {ESTADOS.map(e => <option key={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="gym-label">Cliente</label>
            <input className="gym-input" placeholder="Nombre o CI..." value={filtros.cliente} onChange={f('cliente')} />
          </div>
          <div>
            <label className="gym-label">Nº Factura</label>
            <input className="gym-input" placeholder="Número exacto" value={filtros.numero_factura} onChange={f('numero_factura')} />
          </div>
          <div>
            <label className="gym-label">Desde</label>
            <input className="gym-input" type="date" value={filtros.fecha_desde} onChange={f('fecha_desde')} />
          </div>
          <div>
            <label className="gym-label">Hasta</label>
            <input className="gym-input" type="date" value={filtros.fecha_hasta} onChange={f('fecha_hasta')} />
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="gym-card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#555' }}>Cargando facturas...</div>
        ) : (
          <table className="gym-table">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Concepto</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <motion.tbody variants={tbodyV} initial="hidden" animate="show">
              {facturas.map(f => (
                <motion.tr key={f.id} variants={rowV}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#e5e5e5' }}>{f.numero_factura}</td>
                  <td style={{ fontSize: 12, color: '#888' }}>
                    {f.fecha_emision ? new Date(f.fecha_emision).toLocaleDateString('es-BO') : '—'}
                  </td>
                  <td>
                    <div style={{ fontWeight: 500, color: '#ccc' }}>{f.cliente_nombre}</div>
                    <div style={{ fontSize: 11, color: '#555' }}>{f.cliente_tipo_doc}: {f.cliente_documento}</div>
                  </td>
                  <td style={{ color: '#888', fontSize: 12, maxWidth: 180 }}>{f.concepto}</td>
                  <td style={{ fontWeight: 700, color: '#e5e5e5' }}>Bs. {parseFloat(f.monto_total || 0).toFixed(2)}</td>
                  <td>{estadoBadge(f.estado)}</td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn-ghost btn-sm" title="Ver detalle" onClick={() => setFacturaDetalle(f)}>
                        <Eye size={13} />
                      </button>
                      <button className="btn-ghost btn-sm" title="Descargar PDF" onClick={() => descargarPDF(f)}>
                        <Download size={13} />
                      </button>
                      {f.cliente_correo && (
                        <button className="btn-ghost btn-sm" title="Reenviar por correo"
                          onClick={() => setCorreoReenvio({ open: true, facturaId: f.id, email: f.cliente_correo })}>
                          <Mail size={13} />
                        </button>
                      )}
                      {f.estado !== 'ANULADA' && (
                        <button className="btn-ghost btn-sm" title="Anular factura"
                          style={{ color: '#e63946' }} onClick={() => { setAnulando(f); setMotivoAnulacion('') }}>
                          <Ban size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
              {facturas.length === 0 && (
                <motion.tr initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 60, color: '#555' }}>
                    Sin facturas. <button className="btn-ghost" onClick={() => navigate(PAGES.FACTURACION_EMITIR)} style={{ color: '#e63946', textDecoration: 'underline' }}>Emitir primera factura</button>
                  </td>
                </motion.tr>
              )}
            </motion.tbody>
          </table>
        )}
      </div>

      {/* Modal detalle */}
      <Modal open={!!facturaDetalle} onClose={() => setFacturaDetalle(null)} title={`Factura #${facturaDetalle?.numero_factura}`} width={520}>
        {facturaDetalle && (
          <div>
            <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div className="form-grid">
                {[
                  ['Estado', estadoBadge(facturaDetalle.estado)],
                  ['Fecha Emisión', facturaDetalle.fecha_emision ? new Date(facturaDetalle.fecha_emision).toLocaleString('es-BO') : '—'],
                  ['Cliente', facturaDetalle.cliente_nombre],
                  [`${facturaDetalle.cliente_tipo_doc || 'CI'}`, facturaDetalle.cliente_documento],
                  ['Correo', facturaDetalle.cliente_correo || '—'],
                  ['Concepto', facturaDetalle.concepto],
                  ['Cantidad', facturaDetalle.cantidad],
                  ['Precio Unitario', `Bs. ${parseFloat(facturaDetalle.precio_unitario || 0).toFixed(2)}`],
                  ['Descuento', `Bs. ${parseFloat(facturaDetalle.descuento || 0).toFixed(2)}`],
                  ['Total', <strong style={{ color: '#e63946', fontSize: 16 }}>Bs. {parseFloat(facturaDetalle.monto_total || 0).toFixed(2)}</strong>],
                  ['Método Pago', facturaDetalle.metodo_pago?.replace('_', ' ')],
                  ['Correo enviado', facturaDetalle.enviado_correo ? 'Sí' : 'No'],
                ].map(([k, v]) => (
                  <div key={k} style={{ marginBottom: 6 }}>
                    <div className="gym-label" style={{ marginBottom: 2 }}>{k}</div>
                    <div style={{ fontSize: 13, color: '#ccc' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            {facturaDetalle.cuf && (
              <div style={{ marginBottom: 12 }}>
                <div className="gym-label">CUF</div>
                <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#555', wordBreak: 'break-all', background: '#0d0d0d', padding: 8, borderRadius: 6 }}>{facturaDetalle.cuf}</div>
              </div>
            )}
            {facturaDetalle.motivo_anulacion && (
              <div style={{ marginBottom: 12, padding: 10, background: '#7f1d1d22', border: '1px solid #dc262644', borderRadius: 8 }}>
                <div className="gym-label">Motivo de anulación</div>
                <div style={{ fontSize: 13, color: '#f87171' }}>{facturaDetalle.motivo_anulacion}</div>
              </div>
            )}
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => descargarPDF(facturaDetalle)}>
                <Download size={14} style={{ display: 'inline', marginRight: 6 }} />PDF
              </button>
              <button className="btn-secondary flex-1" onClick={() => setFacturaDetalle(null)}>Cerrar</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal anulación */}
      <Modal open={!!anulando} onClose={() => setAnulando(null)} title={`Anular Factura #${anulando?.numero_factura}`} width={420}>
        {anulando && (
          <div>
            <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
              Esta acción marcará la factura como ANULADA. Informa el motivo para el registro legal.
            </p>
            <label className="gym-label">Motivo de anulación *</label>
            <textarea className="gym-textarea" rows={3} value={motivoAnulacion} onChange={e => setMotivoAnulacion(e.target.value)} placeholder="Describe el motivo de anulación..." style={{ marginBottom: 16 }} />
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setAnulando(null)}>Cancelar</button>
              <button className="btn-danger flex-1" onClick={confirmarAnulacion}>
                <Ban size={13} style={{ display: 'inline', marginRight: 6 }} />Anular Factura
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal reenvío correo */}
      <Modal open={correoReenvio.open} onClose={() => setCorreoReenvio({ open: false, facturaId: null, email: '' })} title="Reenviar por Correo" width={380}>
        <div>
          <label className="gym-label">Correo Electrónico</label>
          <input className="gym-input" type="email" value={correoReenvio.email}
            onChange={e => setCorreoReenvio(p => ({ ...p, email: e.target.value }))}
            style={{ marginBottom: 16 }}
          />
          <div className="flex gap-3">
            <button className="btn-secondary flex-1" onClick={() => setCorreoReenvio({ open: false, facturaId: null, email: '' })}>Cancelar</button>
            <button className="btn-primary flex-1" onClick={reenviarCorreo}>
              <Mail size={14} style={{ display: 'inline', marginRight: 6 }} />Enviar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
