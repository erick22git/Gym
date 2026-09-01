import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingBag, DollarSign, CreditCard, Package, RefreshCw,
  Search, X, Eye, History, Wallet, StickyNote, ChevronRight,
  TrendingUp, TrendingDown, Check,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { PAGES } from '../../constants'
import { Select } from '../../components/ui/Select'
import Pagination from '../../components/ui/Pagination'
import '../Clients.css'
import './Ventas.css'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n) { return 'Bs. ' + Number(n || 0).toFixed(2) }
function fmtFecha(f) {
  if (!f) return '—'
  return new Date(f).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function fmtDuration(inicio, fin) {
  const ms = (fin ? new Date(fin) : new Date()) - new Date(inicio)
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const METODOS = { efectivo: 'Efectivo', qr: 'QR', tarjeta: 'Tarjeta', transferencia: 'Transferencia', mixto: 'Mixto' }
const MET_ICON = { qr: '📱', tarjeta: '💳', transferencia: '🏦', mixto: '🔀', efectivo: '💵' }

const METODO_INFO = {
  efectivo: { icon: '💵', msg: 'Este pago en efectivo está (o debe estar) en la caja física.', color: 'oklch(0.78 0.16 155)' },
  qr:       { icon: '📱', msg: 'Pago por QR — el dinero fue directo a la cuenta bancaria, NO a la caja física.', color: 'oklch(0.74 0.13 250)' },
  tarjeta:  { icon: '💳', msg: 'Pago con tarjeta — va al banco, NO es efectivo en caja física.', color: 'oklch(0.74 0.13 250)' },
  transferencia: { icon: '🏦', msg: 'Transferencia bancaria — ingresó directo al banco, NO a la caja física.', color: 'oklch(0.74 0.13 250)' },
  mixto:    { icon: '🔀', msg: 'Pago mixto — parte en efectivo (va a caja), parte electrónico (va al banco).', color: 'oklch(0.82 0.14 75)' },
}
const BADGE_TIPO = {
  membresia: { bg: 'oklch(0.74 0.13 250 / .15)', color: 'oklch(0.74 0.13 250)', label: 'Membresía' },
  productos: { bg: 'oklch(0.78 0.18 200 / .15)', color: 'oklch(0.78 0.18 200)', label: 'Productos' },
}
const BADGE_ESTADO = {
  completada: { bg: 'oklch(0.72 0.17 155 / .15)', color: 'oklch(0.72 0.17 155)', label: 'Completada' },
  anulada: { bg: 'oklch(0.75 0.18 25 / .15)', color: 'oklch(0.75 0.18 25)', label: 'Anulada' },
  pendiente: { bg: 'oklch(0.82 0.14 75 / .15)', color: 'oklch(0.82 0.14 75)', label: 'Pendiente' },
}
const TIPO_COLOR = {
  apertura: 'oklch(0.74 0.13 250)', ingreso: 'oklch(0.78 0.16 155)',
  egreso: 'oklch(0.75 0.18 25)', cierre: 'oklch(0.80 0.12 200)',
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, icon: Icon, color }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{
        position: 'relative', overflow: 'hidden',
        background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
        border: '1px solid transparent', borderRadius: 12, padding: '16px 20px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 8,
        boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
      }}
    >
      {/* Glow de estado — mismo patrón que KPICard del Dashboard */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 12,
        background: `radial-gradient(circle at center, ${color.replace(')', ' / 0.15)')} 0%, ${color.replace(')', ' / 0.05)')} 55%, transparent 85%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', width: 40, height: 40, borderRadius: 10, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={19} color={color} />
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'oklch(0.97 0.01 250)', marginBottom: 3, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--display)', color: 'oklch(0.97 0.01 250)', lineHeight: 1, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{value}</div>
      </div>
    </motion.div>
  )
}

// ─── Modal Detalle Venta ──────────────────────────────────────────────────────

function ModalDetalle({ venta, onClose, onAnular, puedeAnular }) {
  const [detalle, setDetalle] = useState(null)
  const [anulando, setAnulando] = useState(false)
  const [confirmarAnular, setConfirmarAnular] = useState(false)

  useEffect(() => {
    window.api.ventas.getById(venta.id).then(v => setDetalle(v))
  }, [venta.id])

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  async function handleAnular() {
    setAnulando(true)
    await onAnular(venta.id)
    setAnulando(false)
    onClose()
  }

  const tipoBadge = BADGE_TIPO[detalle?.tipo] || BADGE_TIPO.membresia
  const estadoBadge = BADGE_ESTADO[detalle?.estado] || BADGE_ESTADO.completada

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .65)', backdropFilter: 'blur(4px)' }} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        style={{
          position: 'relative', zIndex: 1, width: 480,
          background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
          border: '1px solid transparent', borderRadius: 16, padding: '24px 28px',
          boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .11), 0 0 16px 2px oklch(1 0 0 / .08), 0 24px 60px oklch(0 0 0 / .4)',
          maxHeight: 'calc(100vh - 80px)', overflowY: 'auto', textShadow: '0 1px 2px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Venta #{venta.id}</h2>
          <button onClick={onClose} title="Cerrar" className="clientes-action-icon"><X size={17} color="var(--dim)" /></button>
        </div>

        {!detalle ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: tipoBadge.bg, color: tipoBadge.color }}>{tipoBadge.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: estadoBadge.bg, color: estadoBadge.color }}>{estadoBadge.label}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: 16 }}>
              {[
                ['Cliente', detalle.cliente_nombre || 'Sin cliente'],
                ['CI / Carnet', detalle.cliente_carnet || '—'],
                ['Fecha', fmtFecha(detalle.fecha)],
                ['Método de pago', METODOS[detalle.metodo_pago] || detalle.metodo_pago || '—'],
                ['Subtotal', fmtMoney(detalle.subtotal)],
                ['Descuento', fmtMoney(detalle.descuento_valor || 0)],
                ['Total', fmtMoney(detalle.total)],
                ['Monto recibido', fmtMoney(detalle.monto_recibido)],
                ['Vuelto', fmtMoney(detalle.vuelto || 0)],
                ['Registrado por', detalle.usuario_nombre || '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 11, color: 'var(--dim)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: k === 'Total' ? 700 : 400 }}>{v}</div>
                </div>
              ))}
            </div>

            {detalle.detalle && detalle.detalle.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>Productos</div>
                <div style={{ background: 'oklch(1 0 0 / .03)', borderRadius: 8, overflow: 'hidden' }}>
                  {detalle.detalle.map((d, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: i < detalle.detalle.length - 1 ? '1px solid oklch(1 0 0 / .06)' : 'none' }}>
                      <div>
                        <div style={{ fontSize: 14, color: 'var(--ink)' }}>{d.nombre_producto}</div>
                        <div style={{ fontSize: 12, color: 'var(--dim)' }}>x{d.cantidad} × {fmtMoney(d.precio_unitario)}</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{fmtMoney(d.subtotal)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detalle.notas && (
              <div style={{ background: 'oklch(1 0 0 / .03)', borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 4 }}>NOTAS</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{detalle.notas}</div>
              </div>
            )}

            {/* Explicación del método de pago */}
            {(() => {
              const info = METODO_INFO[detalle.metodo_pago] || METODO_INFO.efectivo
              return (
                <div style={{
                  background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
                  border: '1px solid transparent', borderLeft: `3px solid ${info.color}`, borderRadius: 8, padding: '10px 12px', marginBottom: 16,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: info.color, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 5 }}>
                    {info.icon} MÉTODO DE PAGO — {METODOS[detalle.metodo_pago] || detalle.metodo_pago}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>{info.msg}</div>
                </div>
              )
            })()}

            {puedeAnular && detalle.estado === 'completada' && (
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
                {!confirmarAnular ? (
                  <button onClick={() => setConfirmarAnular(true)} className="clientes-glass-btn"
                    style={{ width: '100%', padding: '9px', borderRadius: 9, background: 'transparent', border: '1px solid oklch(0.75 0.18 25 / .35)', cursor: 'pointer' }}>
                    <div className="clientes-glass-bg" />
                    <span className="clientes-glass-content" style={{ color: 'oklch(0.75 0.18 25)', fontSize: 14, fontWeight: 600 }}>Anular venta</span>
                  </button>
                ) : (
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 10, textAlign: 'center' }}>¿Confirmar anulación? Esta acción no se puede deshacer.</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setConfirmarAnular(false)} className="clientes-glass-btn btn-secondary" style={{ flex: 1 }}>
                        <div className="clientes-glass-bg" />
                        <span className="clientes-glass-content">Cancelar</span>
                      </button>
                      <button onClick={handleAnular} disabled={anulando} className="clientes-glass-btn"
                        style={{ flex: 1, padding: '9px', borderRadius: 9, background: 'transparent', border: '1px solid oklch(0.75 0.18 25 / .5)', cursor: 'pointer', opacity: anulando ? 0.6 : 1 }}>
                        <div className="clientes-glass-bg" />
                        <span className="clientes-glass-content" style={{ color: 'oklch(0.75 0.18 25)', fontSize: 14, fontWeight: 700 }}>
                          {anulando ? 'Anulando...' : 'Confirmar anulación'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  )
}

// ─── Modal Detalle Turno ──────────────────────────────────────────────────────

function ModalDetalleTurno({ sesionId, onClose }) {
  const { navigate } = useApp()
  const [resumen, setResumen] = useState(null)
  const [notas, setNotas] = useState([])
  const [ventas, setVentas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [verificados, setVerificados] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`conciliacion_${sesionId}`) || '{}') } catch { return {} }
  })

  useEffect(() => {
    Promise.all([
      window.api.caja.getResumen(sesionId),
      window.api.caja.getNotas(sesionId),
      window.api.ventas.getBySesion(sesionId),
    ]).then(([r, n, v]) => {
      setResumen(r)
      setNotas(n || [])
      setVentas(v || [])
      setCargando(false)
    })
  }, [sesionId])

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  function toggleVerificado(met) {
    const nuevo = { ...verificados, [met]: verificados[met] ? null : new Date().toLocaleString('es-BO') }
    setVerificados(nuevo)
    localStorage.setItem(`conciliacion_${sesionId}`, JSON.stringify(nuevo))
  }

  if (cargando) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .65)', backdropFilter: 'blur(4px)' }} />
      <div className="spinner" style={{ position: 'relative', zIndex: 1 }} />
    </div>
  )

  if (!resumen) return null

  const porMetodo = resumen.por_metodo || {}
  const efectivoVentas = porMetodo.efectivo || 0
  const otrosMetodos = Object.entries(porMetodo).filter(([m]) => m !== 'efectivo')
  const totalElectronico = otrosMetodos.reduce((s, [, v]) => s + v, 0)
  const totalTurno = resumen.saldo_actual || 0
  const efectivoEsperado = resumen.efectivo_esperado || 0
  const montoCierre = resumen.monto_cierre
  const diferencia = resumen.diferencia || 0
  const esCuadra = Math.abs(diferencia) < 0.01
  const esSobrante = diferencia > 0.01
  const difColor = esCuadra ? 'oklch(0.78 0.16 155)' : esSobrante ? 'oklch(0.74 0.13 250)' : 'oklch(0.75 0.18 25)'
  const difLabel = esCuadra ? '✓ CUADRA PERFECTAMENTE' : esSobrante ? `↑ SOBRANTE Bs.${Math.abs(diferencia).toFixed(2)}` : `↓ FALTANTE Bs.${Math.abs(diferencia).toFixed(2)}`
  const movManuales = (resumen.movimientos || []).filter(m => m.tipo === 'ingreso' || m.tipo === 'egreso')

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .65)', backdropFilter: 'blur(4px)' }} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
        style={{
          position: 'relative', zIndex: 1, width: '100%', maxWidth: 560,
          background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#clientes-table-glass)', WebkitBackdropFilter: 'url(#clientes-table-glass)',
          border: '1px solid transparent', borderRadius: 18, padding: '24px 28px',
          boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .11), 0 0 16px 2px oklch(1 0 0 / .08), 0 32px 80px oklch(0 0 0 / .5)',
          maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', textShadow: '0 1px 2px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 800, color: 'var(--ink)', letterSpacing: '.06em' }}>
              Turno #{sesionId}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--dim)', marginTop: 2 }}>
              {resumen.usuario_nombre} · {fmtDate(resumen.fecha_apertura)}
              {resumen.fecha_cierre && ` → ${fmtDate(resumen.fecha_cierre)}`}
              {resumen.fecha_apertura && ` · ${fmtDuration(resumen.fecha_apertura, resumen.fecha_cierre)}`}
            </p>
          </div>
          <button onClick={onClose} title="Cerrar" className="clientes-action-icon"><X size={17} color="var(--dim)" /></button>
        </div>

        {/* BLOQUE ARQUEO DE EFECTIVO */}
        <div style={{
          background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
          border: '1px solid transparent', borderLeft: '3px solid oklch(0.78 0.16 155)', borderRadius: 12, padding: '14px 16px', marginBottom: 12, marginTop: 16,
          boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'oklch(0.78 0.16 155)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 }}>
            💵 ARQUEO DE EFECTIVO
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid oklch(0.78 0.16 155 / .15)' }}>
            {[
              ['Monto apertura', fmtMoney(resumen.monto_inicial)],
              ['+ Ventas en efectivo', fmtMoney(efectivoVentas)],
              ...(resumen.total_ingresos > 0 ? [['+ Ingresos manuales', fmtMoney(resumen.total_ingresos - efectivoVentas)]] : []),
              ...(resumen.total_egresos > 0 ? [['− Egresos', `−${fmtMoney(resumen.total_egresos)}`]] : []),
            ].filter(([, v]) => v !== 'Bs. 0.00' || true).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--dim)' }}>{k}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Efectivo esperado</span>
            <span style={{ fontSize: 17, fontWeight: 800, fontFamily: 'var(--display)', color: 'oklch(0.78 0.16 155)' }}>{fmtMoney(efectivoEsperado)}</span>
          </div>
          {montoCierre != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--dim)' }}>Efectivo contado</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{fmtMoney(montoCierre)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 10, background: `${difColor}14`, border: `1px solid ${difColor}35` }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: difColor, letterSpacing: '.06em', textTransform: 'uppercase' }}>RESULTADO</span>
            <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--display)', color: difColor }}>{difLabel}</span>
          </div>
        </div>

        {/* BLOQUE CONCILIACIÓN ELECTRÓNICA */}
        {otrosMetodos.length > 0 && (
          <div style={{
            background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
            border: '1px solid transparent', borderLeft: '3px solid oklch(0.74 0.13 250)', borderRadius: 12, padding: '14px 16px', marginBottom: 12,
            boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'oklch(0.74 0.13 250)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              🏦 CONCILIACIÓN ELECTRÓNICA
            </div>
            <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 10, lineHeight: 1.5 }}>
              Este dinero fue al banco. Marca cada método cuando lo verifiques en tu cuenta.
            </div>
            {otrosMetodos.map(([met, monto]) => (
              <label key={met} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', borderBottom: '1px solid oklch(0.74 0.13 250 / .1)' }}>
                <input
                  type="checkbox"
                  checked={!!verificados[met]}
                  onChange={() => toggleVerificado(met)}
                  style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'oklch(0.78 0.16 155)', flexShrink: 0 }}
                />
                <span style={{ flex: 1, fontSize: 13, color: verificados[met] ? 'oklch(0.78 0.16 155)' : 'var(--muted)' }}>
                  {MET_ICON[met] || ''} {met === 'qr' ? 'QR' : met.charAt(0).toUpperCase() + met.slice(1)}
                  {verificados[met] && <span style={{ fontSize: 11, color: 'var(--dim)', marginLeft: 6 }}>✓ {verificados[met]}</span>}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: verificados[met] ? 'oklch(0.78 0.16 155)' : 'var(--dim)' }}>{fmtMoney(monto)}</span>
              </label>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 6, borderTop: '1px solid oklch(0.74 0.13 250 / .15)' }}>
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>Total electrónico</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--dim)' }}>{fmtMoney(totalElectronico)}</span>
            </div>
          </div>
        )}

        {/* Resumen del turno */}
        <div style={{
          background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
          border: '1px solid transparent', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
        }}>
          <span style={{ fontSize: 13, color: 'var(--dim)' }}>📊 Total del turno (efectivo + electrónico)</span>
          <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--display)', color: 'var(--ink)' }}>{fmtMoney(totalTurno)}</span>
        </div>

        {/* Ventas del turno */}
        {ventas.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShoppingBag size={12} /> Ventas del turno ({ventas.length})
            </div>
            <div style={{
              background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
              border: '1px solid transparent', borderRadius: 10, overflow: 'hidden',
              boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
            }}>
              {ventas.slice(0, 8).map((v, i) => {
                const info = METODO_INFO[v.metodo_pago] || METODO_INFO.efectivo
                return (
                  <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: i < Math.min(ventas.length, 8) - 1 ? '1px solid oklch(1 0 0 / .04)' : 'none' }}>
                    <span style={{ fontSize: 11, color: 'var(--dim)', minWidth: 28 }}>#{v.id}</span>
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--ink)' }}>{v.cliente_nombre || <span style={{ color: 'var(--dim)' }}>Sin cliente</span>}</span>
                    <span style={{ fontSize: 12, color: 'var(--dim)' }}>{info.icon} {METODOS[v.metodo_pago] || v.metodo_pago}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: v.estado === 'anulada' ? 'var(--dim)' : 'oklch(0.72 0.17 155)', textDecoration: v.estado === 'anulada' ? 'line-through' : 'none' }}>{fmtMoney(v.total)}</span>
                  </div>
                )
              })}
              {ventas.length > 8 && (
                <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--dim)', textAlign: 'center' }}>
                  +{ventas.length - 8} ventas más
                </div>
              )}
            </div>
          </div>
        )}

        {/* Movimientos manuales */}
        {movManuales.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>Movimientos manuales</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {movManuales.map(m => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                  background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
                  border: '1px solid transparent', borderLeft: `3px solid ${TIPO_COLOR[m.tipo] || 'var(--dim)'}`, borderRadius: 7,
                }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: TIPO_COLOR[m.tipo] || 'var(--dim)', minWidth: 44, textTransform: 'uppercase' }}>{m.tipo}</span>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--muted)' }}>{m.concepto}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: m.tipo === 'egreso' ? 'oklch(0.75 0.18 25)' : 'oklch(0.78 0.16 155)' }}>
                    {m.tipo === 'egreso' ? '-' : '+'}{fmtMoney(m.monto)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notas del turno */}
        {notas.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'oklch(0.82 0.14 75)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
              <StickyNote size={12} /> Notas del turno
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {notas.map(n => (
                <div key={n.id} style={{
                  background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
                  border: '1px solid transparent', borderLeft: '3px solid oklch(0.82 0.14 75)', borderRadius: 7, padding: '8px 12px',
                }}>
                  <div style={{ fontSize: 13, color: 'var(--ink)' }}>{n.texto}</div>
                  <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 3 }}>{n.usuario_nombre} · {fmtDate(n.fecha)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notas de apertura/cierre */}
        {(resumen.notas_apertura || resumen.notas_cierre) && (
          <div style={{ marginBottom: 12 }}>
            {resumen.notas_apertura && (
              <div style={{
                background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
                border: '1px solid transparent', borderRadius: 7, padding: '8px 12px', marginBottom: 6,
              }}>
                <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 3 }}>OBSERVACIONES APERTURA</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{resumen.notas_apertura}</div>
              </div>
            )}
            {resumen.notas_cierre && (
              <div style={{
                background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
                border: '1px solid transparent', borderRadius: 7, padding: '8px 12px',
              }}>
                <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 3 }}>OBSERVACIONES CIERRE</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{resumen.notas_cierre}</div>
              </div>
            )}
          </div>
        )}

        <button onClick={onClose} className="clientes-glass-btn btn-secondary" style={{ width: '100%', marginTop: 4 }}>
          <div className="clientes-glass-bg" />
          <span className="clientes-glass-content">Cerrar</span>
        </button>
      </motion.div>
    </div>
  )
}

// ─── Historial de Caja (tab dentro de Ventas) ─────────────────────────────────

function HistorialCaja() {
  const [sesiones, setSesiones] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [cargando, setCargando] = useState(true)
  const [turnoDetalle, setTurnoDetalle] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', resultado: 'todos', estado: 'todos' })
  const debounceRef = useRef(null)

  const cargar = useCallback(async (p, ps, b, f) => {
    setCargando(true)
    try {
      const result = await window.api.caja.getHistorialPaginated({
        page: p, pageSize: ps,
        busqueda: b || undefined,
        desde: f.desde || undefined,
        hasta: f.hasta || undefined,
        resultado: f.resultado !== 'todos' ? f.resultado : undefined,
        estado: f.estado !== 'todos' ? f.estado : undefined,
      })
      setSesiones(result?.data || [])
      setTotal(result?.total || 0)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar(1, pageSize, '', filtros) }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      cargar(1, pageSize, busqueda, filtros)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [busqueda])

  function handleFiltros(f) {
    setFiltros(f)
    setPage(1)
    cargar(1, pageSize, busqueda, f)
  }

  return (
    <div>
      {/* Filtros */}
      <div style={{
        background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
        border: '1px solid transparent', borderRadius: 12, padding: '12px 16px', marginBottom: 14,
        boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)', textShadow: '0 1px 2px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'oklch(0.88 0.01 250 / .85)', pointerEvents: 'none' }} />
            <input
              type="text"
              className="gym-input"
              placeholder="Buscar por cajero..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{
                paddingLeft: 30, fontSize: 14, height: 36,
                background: 'oklch(0.2 0.02 250 / .5)', border: '1px solid oklch(1 0 0 / .18)', color: 'oklch(0.97 0.01 250)', textShadow: '0 1px 2px rgba(0,0,0,0.6)',
              }}
            />
          </div>

          <div style={{ minWidth: 140 }}>
            <Select
              value={filtros.resultado}
              onChange={v => handleFiltros({ ...filtros, resultado: v })}
              options={[
                { value: 'todos', label: 'Todos los resultados' },
                { value: 'cuadra', label: '✓ Cuadró' },
                { value: 'faltante', label: '↓ Faltante' },
                { value: 'sobrante', label: '↑ Sobrante' },
              ]}
            />
          </div>

          <div style={{ minWidth: 130 }}>
            <Select
              value={filtros.estado}
              onChange={v => handleFiltros({ ...filtros, estado: v })}
              options={[
                { value: 'todos', label: 'Todos los estados' },
                { value: 'abierta', label: '● Abierta' },
                { value: 'cerrada', label: 'Cerrada' },
              ]}
            />
          </div>

          <input type="date" className="gym-input" value={filtros.desde} onChange={e => handleFiltros({ ...filtros, desde: e.target.value })} style={{ padding: '0 10px', fontSize: 13, height: 36, width: 130 }} title="Desde" />
          <input type="date" className="gym-input" value={filtros.hasta} onChange={e => handleFiltros({ ...filtros, hasta: e.target.value })} style={{ padding: '0 10px', fontSize: 13, height: 36, width: 130 }} title="Hasta" />

          <button onClick={() => cargar(page, pageSize, busqueda, filtros)} className="clientes-glass-btn btn-secondary" style={{ padding: '8px 10px' }}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content"><RefreshCw size={14} /></span>
          </button>

          {(filtros.resultado !== 'todos' || filtros.estado !== 'todos' || filtros.desde || filtros.hasta || busqueda) && (
            <button onClick={() => { setBusqueda(''); const f = { desde: '', hasta: '', resultado: 'todos', estado: 'todos' }; setFiltros(f); cargar(1, pageSize, '', f) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
              <X size={13} /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="gym-card clientes-glass-table" style={{ overflow: 'hidden' }}>
        {cargando ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : sesiones.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--dim)' }}>
            <Wallet size={43} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
            <p style={{ fontSize: 15 }}>No hay turnos con los filtros seleccionados</p>
          </div>
        ) : (
          <div>
            {/* [SCROLL — pedido explícito: "la página se debe quedar
                estática, no debe haber barra de scroll, elimínala y pon
                una barra de scroll en la tabla, solo la tabla se moverá
                con scroll pero no la página"] Mismo patrón que Caja.jsx
                (.page-content:has(.ventas-page) en Ventas.css desactiva
                el scroll de toda la página) — acá SOLO la tabla scrollea,
                <Pagination> queda fuera de este div, siempre visible. */}
            <div style={{ maxHeight: 'calc(100vh - 460px)', overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  {['Fecha / Cajero', 'Apertura', 'Cierre', 'Efectivo inicial', 'Total efectivo', 'Electrónico', 'Resultado arqueo', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sesiones.map((s, i) => {
                  const dif = s.diferencia || 0
                  const esCuadra = Math.abs(dif) < 0.01
                  const esSobrante = dif > 0.01
                  const difColor = esCuadra ? 'oklch(0.78 0.16 155)' : esSobrante ? 'oklch(0.74 0.13 250)' : 'oklch(0.75 0.18 25)'
                  const difLabel = esCuadra ? '✓ Cuadra' : esSobrante ? '↑ Sobrante' : '↓ Faltante'
                  const abierta = s.estado === 'abierta'
                  return (
                    <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.2) }}
                      style={{ borderBottom: '1px solid oklch(1 0 0 / .04)', cursor: 'pointer' }}
                      onClick={() => setTurnoDetalle(s.id)}
                      onMouseEnter={e => e.currentTarget.style.background = 'oklch(1 0 0 / .03)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{s.usuario_nombre || '—'}</div>
                        <div style={{ fontSize: 11, color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{new Date(s.fecha_apertura).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)', whiteSpace: 'nowrap' }}>
                        {new Date(s.fecha_apertura).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {abierta ? <span style={{ color: 'oklch(0.78 0.16 155)', fontSize: 11, fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>● Abierta</span>
                          : <span style={{ color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{new Date(s.fecha_cierre).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}</span>}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{fmtMoney(s.monto_inicial)}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'oklch(0.78 0.16 155)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                        {fmtMoney(s.monto_calculado != null ? s.monto_inicial + (s.total_ingresos || 0) - (s.total_egresos || 0) : 0)}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'oklch(0.74 0.13 250)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>—</td>
                      <td style={{ padding: '10px 14px' }}>
                        {s.fecha_cierre ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 8, background: `${difColor}12`, border: `1px solid ${difColor}30`, width: 'fit-content' }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: difColor, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{difLabel}</span>
                            {!esCuadra && <span style={{ fontSize: 12, color: difColor, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>Bs.{Math.abs(dif).toFixed(2)}</span>}
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: 'oklch(0.88 0.01 250 / .85)' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <button onClick={e => { e.stopPropagation(); setTurnoDetalle(s.id) }} title="Ver detalle" className="clientes-action-icon">
                          <Eye size={15} color="oklch(0.88 0.01 250 / .85)" />
                        </button>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
            </div>
            <div style={{ padding: '0 14px 4px', borderTop: '1px solid var(--line)' }}>
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={p => { setPage(p); cargar(p, pageSize, busqueda, filtros) }}
                onPageSizeChange={ps => { setPageSize(ps); setPage(1); cargar(1, ps, busqueda, filtros) }}
                pageSizeOptions={[10, 25, 50]}
              />
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {turnoDetalle && (
          <ModalDetalleTurno sesionId={turnoDetalle} onClose={() => setTurnoDetalle(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function Ventas() {
  const { tienePermiso } = useAuth()
  const { navigate } = useApp()
  const [tab, setTab] = useState('ventas')
  const [kpis, setKpis] = useState(null)
  const [ventas, setVentas] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [cargando, setCargando] = useState(true)
  const [ventaDetalle, setVentaDetalle] = useState(null)
  const [filtros, setFiltros] = useState({ tipo: 'todos', estado: 'todos', metodo_pago: 'todos', desde: '', hasta: '' })
  const [busqueda, setBusqueda] = useState('')
  const [mesKPI, setMesKPI] = useState(new Date().toISOString().slice(0, 7))
  const [sesionFiltro, setSesionFiltro] = useState(null)
  const debounceRef = useRef(null)

  const puedeAnular = tienePermiso('ventas.anular')

  async function cargar(p, ps, b, f, mes, sesId) {
    setCargando(true)
    try {
      if (sesId) {
        const [k, result] = await Promise.all([
          window.api.ventas.getKPIs({ mes }),
          window.api.ventas.getBySesion(sesId),
        ])
        setKpis(k)
        setVentas(result || [])
        setTotal((result || []).length)
      } else {
        const [k, result] = await Promise.all([
          window.api.ventas.getKPIs({ mes }),
          window.api.ventas.getPaginated({ ...f, busqueda: b || undefined, page: p, pageSize: ps }),
        ])
        setKpis(k)
        setVentas(result?.data || [])
        setTotal(result?.total || 0)
      }
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    const sesId = localStorage.getItem('ventas_sesion_filter')
    if (sesId) {
      localStorage.removeItem('ventas_sesion_filter')
      setSesionFiltro(sesId)
      cargar(page, pageSize, busqueda, filtros, mesKPI, sesId)
    } else {
      cargar(page, pageSize, busqueda, filtros, mesKPI, null)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      cargar(1, pageSize, busqueda, filtros, mesKPI, sesionFiltro)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [busqueda])

  function handleFiltros(f) {
    setFiltros(f)
    setSesionFiltro(null)
    setPage(1)
    cargar(1, pageSize, busqueda, f, mesKPI, null)
  }

  async function handleAnular(id) {
    const r = await window.api.ventas.anular(id)
    if (r.ok) await cargar(page, pageSize, busqueda, filtros, mesKPI, sesionFiltro)
    return r
  }

  const TAB_ITEMS = [
    { id: 'ventas',          label: 'Ventas',           icon: ShoppingBag },
    { id: 'historial_caja',  label: 'Historial de Caja', icon: History },
  ]

  return (
    <div className="clientes-page ventas-page" style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 className="titulo-metalico" style={{ marginBottom: 4 }}>Ventas y Caja</h1>
          <p style={{ fontSize: 14, color: 'var(--dim)' }}>Ventas, historial de turnos y control de caja</p>
        </div>
        {tab === 'ventas' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: 'var(--dim)', marginRight: 4 }}>Mes KPI:</label>
            <input type="month" value={mesKPI} onChange={e => { setMesKPI(e.target.value); cargar(page, pageSize, busqueda, filtros, e.target.value) }} className="gym-input" style={{ padding: '6px 10px', fontSize: 13, width: 140 }} />
            <button onClick={() => cargar(page, pageSize, busqueda, filtros, mesKPI)} className="clientes-glass-btn btn-secondary" style={{ padding: '8px 12px' }}>
              <div className="clientes-glass-bg" />
              <span className="clientes-glass-content"><RefreshCw size={15} /></span>
            </button>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 20,
        background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
        border: '1px solid transparent', borderRadius: 12, padding: 4,
        boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
      }}>
        {TAB_ITEMS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '8px 14px', borderRadius: 9, fontSize: 14, fontWeight: active ? 700 : 500,
              background: active ? 'oklch(1 0 0 / .1)' : 'transparent',
              border: active ? '1px solid oklch(1 0 0 / .22)' : '1px solid transparent',
              color: active ? 'oklch(0.97 0.01 250)' : 'var(--dim)',
              textShadow: active ? '0 1px 2px oklch(0 0 0 / .6)' : 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              transition: 'all .15s',
            }}>
              <Icon size={15} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ── Tab Ventas ── */}
      {tab === 'ventas' && (
        <div>
          {/* Banner filtro de sesión */}
          {sesionFiltro && (
            <div style={{
              background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
              border: '1px solid transparent', borderLeft: '3px solid oklch(0.74 0.13 250)', borderRadius: 10, padding: '8px 14px', marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 10,
              boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
            }}>
              <span style={{ fontSize: 13, color: 'oklch(0.74 0.13 250)' }}>📋 Mostrando ventas del turno de caja #{sesionFiltro}</span>
              <button onClick={() => { setSesionFiltro(null); cargar(1, pageSize, busqueda, filtros, mesKPI, null) }}
                style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--dim)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <X size={12} /> Ver todas las ventas
              </button>
            </div>
          )}

          {/* KPIs */}
          {kpis && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              <KPICard label="Total ventas del mes" value={kpis.totalVentas} icon={ShoppingBag} color="oklch(0.74 0.13 250)" />
              <KPICard label="Ingresos del mes" value={fmtMoney(kpis.totalIngresos)} icon={DollarSign} color="oklch(0.72 0.17 155)" />
              <KPICard label="Membresías vendidas" value={kpis.ventasMembresia} icon={CreditCard} color="oklch(0.82 0.14 75)" />
              <KPICard label="Ventas de productos" value={kpis.ventasProductos} icon={Package} color="oklch(0.78 0.18 200)" />
            </div>
          )}

          {/* Filtros */}
          <div style={{
            background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
            border: '1px solid transparent', borderRadius: 12, padding: '14px 16px', marginBottom: 16,
            boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)', textShadow: '0 1px 2px rgba(0,0,0,0.6)',
          }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'oklch(0.88 0.01 250 / .85)', pointerEvents: 'none' }} />
                <input type="text" className="gym-input" placeholder="Buscar cliente, CI, #ID..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{
                  paddingLeft: 32, paddingRight: 12, fontSize: 14, height: 36,
                  background: 'oklch(0.2 0.02 250 / .5)', border: '1px solid oklch(1 0 0 / .18)', color: 'oklch(0.97 0.01 250)', textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                }} />
              </div>
              {[
                { key: 'tipo', options: [['todos','Todos los tipos'], ['membresia','Membresía'], ['productos','Productos']] },
                { key: 'estado', options: [['todos','Todos los estados'], ['completada','Completada'], ['anulada','Anulada']] },
                { key: 'metodo_pago', options: [['todos','Todos los métodos'], ['efectivo','Efectivo'], ['qr','QR'], ['tarjeta','Tarjeta'], ['transferencia','Transferencia'], ['mixto','Mixto']] },
              ].map(({ key, options }) => (
                <div key={key} style={{ minWidth: 150 }}>
                  <Select value={filtros[key]} onChange={v => handleFiltros({ ...filtros, [key]: v })} options={options.map(([v, l]) => ({ value: v, label: l }))} />
                </div>
              ))}
              <input type="date" className="gym-input" value={filtros.desde} onChange={e => handleFiltros({ ...filtros, desde: e.target.value })} style={{ padding: '0 10px', fontSize: 13, height: 36, width: 140 }} title="Desde" />
              <input type="date" className="gym-input" value={filtros.hasta} onChange={e => handleFiltros({ ...filtros, hasta: e.target.value })} style={{ padding: '0 10px', fontSize: 13, height: 36, width: 140 }} title="Hasta" />
              {(filtros.tipo !== 'todos' || filtros.estado !== 'todos' || filtros.metodo_pago !== 'todos' || filtros.desde || filtros.hasta) && (
                <button onClick={() => handleFiltros({ tipo: 'todos', estado: 'todos', metodo_pago: 'todos', desde: '', hasta: '' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                  <X size={13} /> Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Tabla de ventas */}
          <div className="gym-card clientes-glass-table" style={{ overflow: 'hidden' }}>
            {cargando ? (
              <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
            ) : ventas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--dim)' }}>
                <ShoppingBag size={43} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
                <p style={{ fontSize: 15 }}>No hay ventas con los filtros seleccionados</p>
              </div>
            ) : (
              <div>
                {/* Solo la tabla scrollea — ver mismo comentario en el
                    tab Historial de Caja más arriba. */}
                <div style={{ maxHeight: 'calc(100vh - 560px)', overflowY: 'auto', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                      {['#', 'Fecha', 'Cliente', 'Tipo', 'Método', 'Total', 'Estado', ''].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ventas.map((v, i) => {
                      const tipoBadge = BADGE_TIPO[v.tipo] || BADGE_TIPO.membresia
                      const estadoBadge = BADGE_ESTADO[v.estado] || BADGE_ESTADO.completada
                      return (
                        <motion.tr key={v.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.2) }}
                          style={{ borderBottom: '1px solid oklch(1 0 0 / .04)', cursor: 'pointer' }}
                          onClick={() => setVentaDetalle(v)}
                          onMouseEnter={e => e.currentTarget.style.background = 'oklch(1 0 0 / .03)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '10px 14px', fontSize: 13, color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>#{v.id}</td>
                          <td style={{ padding: '10px 14px', fontSize: 13, color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)', whiteSpace: 'nowrap' }}>{new Date(v.fecha).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })} {new Date(v.fecha).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}</td>
                          <td style={{ padding: '10px 14px', fontSize: 14, color: 'var(--ink)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{v.cliente_nombre || <span style={{ color: 'oklch(0.88 0.01 250 / .85)' }}>—</span>}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: tipoBadge.bg, color: tipoBadge.color, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{tipoBadge.label}</span>
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 13, color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)', textTransform: 'capitalize' }}>{METODOS[v.metodo_pago] || v.metodo_pago || '—'}</td>
                          <td style={{ padding: '10px 14px', fontSize: 14, fontWeight: 700, color: v.estado === 'anulada' ? 'oklch(0.88 0.01 250 / .85)' : 'oklch(0.72 0.17 155)', textShadow: '0 1px 2px rgba(0,0,0,0.6)', textDecoration: v.estado === 'anulada' ? 'line-through' : 'none' }}>{fmtMoney(v.total)}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: estadoBadge.bg, color: estadoBadge.color, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{estadoBadge.label}</span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <button onClick={e => { e.stopPropagation(); setVentaDetalle(v) }} title="Ver detalle" className="clientes-action-icon">
                              <Eye size={14} color="oklch(0.88 0.01 250 / .85)" />
                            </button>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>
                <div style={{ padding: '0 14px 4px', borderTop: '1px solid var(--line)' }}>
                  <Pagination
                    page={page} pageSize={pageSize} total={total}
                    onPageChange={p => { setPage(p); cargar(p, pageSize, busqueda, filtros, mesKPI, sesionFiltro) }}
                    onPageSizeChange={ps => { setPageSize(ps); setPage(1); cargar(1, ps, busqueda, filtros, mesKPI, sesionFiltro) }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Modal detalle venta */}
          <AnimatePresence>
            {ventaDetalle && (
              <ModalDetalle venta={ventaDetalle} onClose={() => setVentaDetalle(null)} onAnular={handleAnular} puedeAnular={puedeAnular} />
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Tab Historial de Caja ── */}
      {tab === 'historial_caja' && <HistorialCaja />}
    </div>
  )
}
