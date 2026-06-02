import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet, Plus, Minus, X, Check, Lock, Unlock, RefreshCw,
  Clock, TrendingUp, TrendingDown, ChevronRight, History,
  StickyNote, ShoppingBag, MessageSquarePlus,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { PAGES } from '../../constants'
import Pagination from '../../components/ui/Pagination'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMoney(n) { return 'Bs. ' + Number(n || 0).toFixed(2) }
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

const TIPO_COLOR = {
  apertura: 'oklch(0.74 0.13 250)',
  ingreso:  'oklch(0.78 0.16 155)',
  egreso:   'oklch(0.75 0.18 25)',
  cierre:   'oklch(0.80 0.12 200)',
}

// ─── Modal Movimiento ─────────────────────────────────────────────────────────

function ModalMovimiento({ tipo, onClose, onSaved, usuario }) {
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    if (!concepto.trim()) return toast.error('El concepto es obligatorio')
    const m = parseFloat(monto)
    if (!m || m <= 0) return toast.error('El monto debe ser mayor a 0')
    setGuardando(true)
    try {
      const r = await window.api.caja.addMovimiento({
        tipo,
        concepto: concepto.trim(),
        monto: m,
        usuario_id: usuario?.id,
        usuario_nombre: usuario?.nombre_completo,
      })
      if (r.ok) {
        toast.success(tipo === 'ingreso' ? 'Ingreso registrado' : 'Egreso registrado')
        onSaved()
        onClose()
      } else {
        toast.error(r.error || 'Error')
      }
    } finally {
      setGuardando(false)
    }
  }

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  const color = tipo === 'ingreso' ? 'oklch(0.78 0.16 155)' : 'oklch(0.75 0.18 25)'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .6)', backdropFilter: 'blur(4px)' }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          position: 'relative', zIndex: 1, width: 380,
          background: 'oklch(0.14 0.015 250)', border: `1px solid ${color}40`,
          borderRadius: 16, padding: '24px 28px',
          boxShadow: `0 24px 60px oklch(0 0 0 / .5), 0 0 40px ${color}10`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 700, color, letterSpacing: '.06em' }}>
            {tipo === 'ingreso' ? 'Registrar Ingreso' : 'Registrar Egreso'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Concepto</label>
            <input
              className="gym-input"
              value={concepto}
              onChange={e => setConcepto(e.target.value)}
              placeholder={tipo === 'ingreso' ? 'Venta de producto, etc.' : 'Pago de servicio, etc.'}
              autoFocus
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Monto (Bs.)</label>
            <input
              className="gym-input"
              type="number" min="0.01" step="0.01"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={{
            flex: 1, padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700,
            background: `${color}20`, border: `1px solid ${color}50`, color,
            cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando ? .6 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Check size={14} /> {guardando ? 'Guardando...' : 'Confirmar'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Modal Cerrar Caja ────────────────────────────────────────────────────────

function ModalCerrarCaja({ sesion, efectivoEsperado, saldoTotal, porMetodo, resumen, onClose, onCerrada, usuario }) {
  const [montoCierre, setMontoCierre] = useState(efectivoEsperado.toFixed(2))
  const [notas, setNotas] = useState('')
  const [cerrando, setCerrando] = useState(false)
  const [verificados, setVerificados] = useState({})

  async function cerrar() {
    setCerrando(true)
    try {
      const r = await window.api.caja.cerrar({
        monto_cierre: parseFloat(montoCierre) || 0,
        notas: notas || null,
        usuario_id: usuario?.id,
        usuario_nombre: usuario?.nombre_completo,
      })
      if (r.ok) {
        const dif = r.diferencia
        if (Math.abs(dif) < 0.01) toast.success('Turno cerrado. Sin diferencias.')
        else if (dif > 0) toast.success(`Turno cerrado. Sobrante: ${fmtMoney(dif)}`)
        else toast(`Turno cerrado. Faltante: ${fmtMoney(Math.abs(dif))}`, { icon: '⚠️' })
        onCerrada()
        onClose()
      } else {
        toast.error(r.error || 'Error al cerrar caja')
      }
    } finally {
      setCerrando(false)
    }
  }

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  const contado = parseFloat(montoCierre) || 0
  const diferencia = contado - efectivoEsperado
  const esCuadra = Math.abs(diferencia) < 0.01
  const esSobrante = diferencia > 0.01
  const difColor = esCuadra ? 'oklch(0.78 0.16 155)' : esSobrante ? 'oklch(0.74 0.13 250)' : 'oklch(0.75 0.18 25)'
  const difLabel = esCuadra ? '✓ Cuadra' : esSobrante ? '↑ Sobrante' : '↓ Faltante'

  const otrosMetodos = Object.entries(porMetodo || {}).filter(([m]) => m !== 'efectivo')
  const efectivoVentas = porMetodo?.efectivo || 0
  const montoInicial = resumen?.monto_inicial || 0
  const ingresosManuales = resumen?.total_ingresos || 0
  const egresosManuales = resumen?.total_egresos || 0

  const MET_ICON = { qr: '📱', tarjeta: '💳', transferencia: '🏦', mixto: '🔀' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .6)', backdropFilter: 'blur(4px)' }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'relative', zIndex: 1, width: '100%', maxWidth: 480,
          background: 'oklch(0.14 0.015 250)', border: '1px solid oklch(0.66 0.22 25 / .4)',
          borderRadius: 16, padding: '24px 28px',
          boxShadow: '0 24px 60px oklch(0 0 0 / .5)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Lock size={18} color="oklch(0.75 0.18 25)" />
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 700, color: 'oklch(0.85 0.12 25)', letterSpacing: '.06em' }}>
            Arqueo y Cierre de Turno
          </h2>
        </div>
        <p style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 20 }}>
          Turno de <strong style={{ color: 'var(--ink)' }}>{resumen?.usuario_nombre || usuario?.nombre_completo || '—'}</strong> · {fmtDate(sesion?.fecha_apertura)}
        </p>

        {/* ── BLOQUE EFECTIVO ── */}
        <div style={{ background: 'oklch(0.78 0.16 155 / .07)', border: '1px solid oklch(0.78 0.16 155 / .28)', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.78 0.16 155)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 }}>
            💵 EFECTIVO — Conteo físico
          </div>

          {/* Desglose */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid oklch(0.78 0.16 155 / .15)' }}>
            <Row label="Monto apertura" value={fmtMoney(montoInicial)} />
            <Row label="+ Ventas en efectivo" value={fmtMoney(efectivoVentas)} />
            {ingresosManuales > 0 && <Row label="+ Ingresos manuales" value={fmtMoney(ingresosManuales)} />}
            {egresosManuales > 0 && <Row label="− Egresos" value={`−${fmtMoney(egresosManuales)}`} valueColor="oklch(0.75 0.18 25)" />}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>EFECTIVO ESPERADO</span>
            <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--display)', color: 'oklch(0.78 0.16 155)' }}>{fmtMoney(efectivoEsperado)}</span>
          </div>

          {/* Input conteo */}
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
            Efectivo contado (Bs.)
          </label>
          <input
            className="gym-input"
            type="number" step="0.01"
            value={montoCierre}
            onChange={e => setMontoCierre(e.target.value)}
            autoFocus
            style={{ fontSize: 16, fontFamily: 'var(--display)', marginBottom: 10 }}
          />

          {/* Resultado del arqueo */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 14px', borderRadius: 10,
            background: `${difColor}14`, border: `1px solid ${difColor}35`,
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: difColor, letterSpacing: '.08em', textTransform: 'uppercase' }}>RESULTADO</div>
              <div style={{ fontSize: 10, color: 'var(--dim)' }}>Solo aplica al efectivo físico</div>
            </div>
            <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--display)', color: difColor }}>
              {diferencia >= 0 ? '+' : ''}{fmtMoney(diferencia)}
              <span style={{ fontSize: 11, marginLeft: 6 }}>{difLabel}</span>
            </span>
          </div>
        </div>

        {/* ── BLOQUE PAGOS ELECTRÓNICOS ── */}
        {otrosMetodos.length > 0 && (
          <div style={{ background: 'oklch(0.74 0.13 250 / .06)', border: '1px solid oklch(0.74 0.13 250 / .25)', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.74 0.13 250)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                🏦 PAGOS ELECTRÓNICOS
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 10, lineHeight: 1.5 }}>
              Este dinero ya está en tu cuenta bancaria. <strong style={{ color: 'oklch(0.74 0.13 250)' }}>NO se cuenta en caja física</strong>, solo verifica con el banco.
            </div>
            {otrosMetodos.map(([met, monto]) => (
              <div key={met} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!verificados[met]}
                    onChange={e => setVerificados(v => ({ ...v, [met]: e.target.checked }))}
                    style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'oklch(0.74 0.13 250)' }}
                  />
                  <span style={{ fontSize: 12, color: verificados[met] ? 'oklch(0.78 0.16 155)' : 'var(--muted)' }}>
                    {MET_ICON[met] || ''} {met === 'qr' ? 'QR' : met === 'tarjeta' ? 'Tarjeta' : met === 'transferencia' ? 'Transferencia' : met}
                    {verificados[met] && <span style={{ marginLeft: 4, fontSize: 10 }}>✓ Verificado con banco</span>}
                  </span>
                </label>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--dim)' }}>{fmtMoney(monto)}</span>
              </div>
            ))}
            <div style={{ fontSize: 10, color: 'oklch(0.74 0.13 250 / .7)', marginTop: 6, paddingTop: 8, borderTop: '1px solid oklch(0.74 0.13 250 / .15)' }}>
              ℹ️ Estos montos NO generan faltante — son pagos directos al banco.
            </div>
          </div>
        )}

        {/* Resumen total */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', background: 'var(--glass)', border: '1px solid var(--line)', borderRadius: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>Total recaudado (todos los métodos)</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{fmtMoney(saldoTotal)}</span>
        </div>

        {/* Resumen anti-confusión antes de cerrar */}
        <div style={{ background: 'oklch(0.14 0.02 250)', border: '1px solid oklch(1 0 0 / .1)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--dim)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>RESUMEN DEL TURNO</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>💵 Efectivo en caja física</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'oklch(0.78 0.16 155)' }}>{fmtMoney(efectivoEsperado)}</span>
          </div>
          {otrosMetodos.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>🏦 Pagos al banco (QR/Tarjeta/Transfer.)</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'oklch(0.74 0.13 250)' }}>{fmtMoney(otrosMetodos.reduce((s, [, v]) => s + v, 0))}</span>
            </div>
          )}
          <div style={{ paddingTop: 6, marginTop: 4, borderTop: '1px solid oklch(1 0 0 / .06)', fontSize: 11, color: 'var(--dim)', lineHeight: 1.5 }}>
            {esCuadra
              ? <span style={{ color: 'oklch(0.78 0.16 155)' }}>✓ La caja cuadra perfectamente.</span>
              : esSobrante
                ? <span style={{ color: 'oklch(0.82 0.14 75)' }}>↑ Hay un sobrante de {fmtMoney(diferencia)} en efectivo.</span>
                : <span style={{ color: 'oklch(0.75 0.18 25)' }}>↓ Falta {fmtMoney(Math.abs(diferencia))} de efectivo físico — revisa antes de cerrar.</span>
            }
          </div>
        </div>

        {/* Observaciones */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
            Observaciones (opcional)
          </label>
          <input className="gym-input" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones del cierre..." />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>Cancelar</button>
          <button onClick={cerrar} disabled={cerrando} style={{
            flex: 2, padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700,
            background: 'oklch(0.66 0.22 25 / .2)', border: '1px solid oklch(0.66 0.22 25 / .5)',
            color: 'oklch(0.85 0.12 25)', cursor: cerrando ? 'not-allowed' : 'pointer',
            opacity: cerrando ? .6 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Lock size={14} /> {cerrando ? 'Cerrando...' : 'Cerrar Turno e Imprimir Corte'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function Row({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 12, color: 'var(--dim)' }}>{label}</span>
      <span style={{ fontSize: 12, color: valueColor || 'var(--muted)' }}>{value}</span>
    </div>
  )
}

// ─── Historial ────────────────────────────────────────────────────────────────

function Historial({ onVolver }) {
  const { navigate } = useApp()
  const [sesiones, setSesiones] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [cargando, setCargando] = useState(true)
  const [expandido, setExpandido] = useState(null)
  const [movimientos, setMovimientos] = useState({})
  const [notasSesion, setNotasSesion] = useState({})

  async function cargar(p, ps) {
    setCargando(true)
    try {
      const result = await window.api.caja.getHistorialPaginated({ page: p, pageSize: ps })
      setSesiones(result?.data || [])
      setTotal(result?.total || 0)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar(1, pageSize) }, [])

  async function toggleExpandir(id) {
    if (expandido === id) { setExpandido(null); return }
    setExpandido(id)
    if (!movimientos[id]) {
      const [movs, notas] = await Promise.all([
        window.api.caja.getMovimientos(id),
        window.api.caja.getNotas(id),
      ])
      setMovimientos(p => ({ ...p, [id]: movs || [] }))
      setNotasSesion(p => ({ ...p, [id]: notas || [] }))
    }
  }

  if (cargando) return <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button onClick={onVolver} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          ← Volver
        </button>
        <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '.08em' }}>HISTORIAL DE CAJA</h2>
        <span style={{ fontSize: 11, color: 'var(--dim)' }}>{total} sesiones</span>
      </div>
      {sesiones.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--dim)' }}>No hay sesiones registradas</div>
      ) : sesiones.map(s => {
        const abierta = s.estado === 'abierta'
        return (
          <div key={s.id} style={{ marginBottom: 8 }}>
            <div
              onClick={() => toggleExpandir(s.id)}
              style={{
                background: 'var(--glass)', border: `1px solid ${abierta ? 'oklch(0.78 0.16 155 / .4)' : 'var(--line)'}`,
                borderRadius: expandido === s.id ? '10px 10px 0 0' : 10, padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: abierta ? 'oklch(0.78 0.16 155)' : 'var(--dim)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                  {fmtDate(s.fecha_apertura)} {abierta && <span style={{ marginLeft: 8, fontSize: 10, color: 'oklch(0.78 0.16 155)', fontWeight: 700 }}>ABIERTA</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--dim)' }}>
                  {s.usuario_nombre} · Apertura: {fmtMoney(s.monto_inicial)}
                  {s.fecha_cierre && ` · Cierre: ${fmtDate(s.fecha_cierre)}`}
                  {s.fecha_cierre && ` · Duración: ${fmtDuration(s.fecha_apertura, s.fecha_cierre)}`}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {s.monto_cierre != null && <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--display)', color: 'var(--ink)' }}>{fmtMoney(s.monto_cierre)}</div>}
                {s.diferencia != null && Math.abs(s.diferencia) > 0.01 && (
                  <div style={{ fontSize: 11, color: s.diferencia > 0 ? 'oklch(0.82 0.14 75)' : 'oklch(0.75 0.18 25)' }}>
                    {s.diferencia > 0 ? '+' : ''}{fmtMoney(s.diferencia)} efectivo
                  </div>
                )}
                {s.notas_count > 0 && (
                  <div style={{ fontSize: 10, color: 'oklch(0.82 0.14 75)', display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
                    <StickyNote size={9} /> {s.notas_count} nota{s.notas_count > 1 ? 's' : ''}
                  </div>
                )}
              </div>
              <ChevronRight size={14} color="var(--dim)" style={{ transform: expandido === s.id ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
            </div>
            <AnimatePresence>
              {expandido === s.id && movimientos[s.id] && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: 'hidden', background: 'oklch(0.11 0.01 250)', border: '1px solid var(--line)', borderTop: 'none', borderRadius: '0 0 10px 10px' }}
                >
                  <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {movimientos[s.id].map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px' }}>
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', color: TIPO_COLOR[m.tipo] || 'var(--dim)', minWidth: 52, textTransform: 'uppercase' }}>{m.tipo}</span>
                        <span style={{ flex: 1, fontSize: 12, color: 'var(--muted)' }}>{m.concepto}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: m.tipo === 'egreso' ? 'oklch(0.75 0.18 25)' : 'oklch(0.78 0.16 155)' }}>
                          {m.tipo === 'egreso' ? '-' : '+'}{fmtMoney(m.monto)}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--dim)' }}>{fmtDate(m.created_at)}</span>
                      </div>
                    ))}
                    {/* Notas del turno */}
                    {notasSesion[s.id]?.length > 0 && (
                      <div style={{ marginTop: 6, paddingTop: 8, borderTop: '1px solid oklch(0.82 0.14 75 / .15)' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'oklch(0.82 0.14 75)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4 }}>Notas del turno</div>
                        {notasSesion[s.id].map(n => (
                          <div key={n.id} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 12, color: 'var(--muted)' }}>
                            <StickyNote size={11} color="oklch(0.82 0.14 75)" style={{ flexShrink: 0, marginTop: 1 }} />
                            <span>{n.texto}</span>
                            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--dim)' }}>{fmtDate(n.fecha)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Ver ventas del turno */}
                    <div style={{ paddingTop: 6, marginTop: 4, borderTop: '1px solid oklch(1 0 0 / .06)' }}>
                      <button
                        onClick={e => { e.stopPropagation(); localStorage.setItem('ventas_sesion_filter', s.id); navigate(PAGES.VENTAS) }}
                        style={{ fontSize: 11, color: 'oklch(0.74 0.13 250)', background: 'oklch(0.74 0.13 250 / .08)', border: '1px solid oklch(0.74 0.13 250 / .2)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                      >
                        <ShoppingBag size={10} /> Ver ventas de este turno
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={p => { setPage(p); cargar(p, pageSize) }}
        onPageSizeChange={ps => { setPageSize(ps); setPage(1); cargar(1, ps) }}
      />
    </div>
  )
}

// ─── Modal Nota ──────────────────────────────────────────────────────────────

function ModalNota({ sesionId, onClose, onSaved, usuario }) {
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    if (!texto.trim()) return toast.error('Escribe una nota')
    setGuardando(true)
    try {
      const r = await window.api.caja.addNota({
        sesion_id: sesionId,
        texto: texto.trim(),
        usuario_id: usuario?.id,
        usuario_nombre: usuario?.nombre_completo,
      })
      if (r.ok) { toast.success('Nota guardada'); onSaved(); onClose() }
      else toast.error(r.error || 'Error')
    } finally { setGuardando(false) }
  }

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .6)', backdropFilter: 'blur(4px)' }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          position: 'relative', zIndex: 1, width: 400,
          background: 'oklch(0.14 0.015 250)', border: '1px solid oklch(0.82 0.14 75 / .3)',
          borderRadius: 16, padding: '24px 28px',
          boxShadow: '0 24px 60px oklch(0 0 0 / .5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 15, fontWeight: 700, color: 'oklch(0.82 0.14 75)', letterSpacing: '.06em' }}>
            Agregar Nota al Turno
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)' }}>
            <X size={16} />
          </button>
        </div>
        <textarea
          className="gym-input"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Ej: Se retiró Bs. 100 para compra, cliente pagó adelantado..."
          rows={4}
          autoFocus
          style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={{
            flex: 1, padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700,
            background: 'oklch(0.82 0.14 75 / .2)', border: '1px solid oklch(0.82 0.14 75 / .4)',
            color: 'oklch(0.82 0.14 75)', cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando ? .6 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Check size={14} /> {guardando ? 'Guardando...' : 'Guardar nota'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Vista Caja Cerrada ───────────────────────────────────────────────────────

function CajaCerrada({ onAbierta, usuario }) {
  const [montoInicial, setMontoInicial] = useState('0')
  const [notas, setNotas] = useState('')
  const [abriendo, setAbriendo] = useState(false)

  async function abrir() {
    setAbriendo(true)
    try {
      const r = await window.api.caja.abrir({
        monto_inicial: parseFloat(montoInicial) || 0,
        notas: notas || null,
        usuario_id: usuario?.id,
        usuario_nombre: usuario?.nombre_completo,
      })
      if (r.ok) {
        toast.success('Caja abierta')
        onAbierta()
      } else {
        toast.error(r.error || 'Error al abrir caja')
      }
    } finally {
      setAbriendo(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
      <div style={{
        width: 400, background: 'var(--glass)', border: '1px solid oklch(0.78 0.16 155 / .3)',
        borderRadius: 20, padding: '36px 40px', textAlign: 'center',
        boxShadow: '0 0 60px oklch(0.78 0.16 155 / .08)',
      }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: 'oklch(0.78 0.16 155 / .12)', border: '1px solid oklch(0.78 0.16 155 / .3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Wallet size={28} color="oklch(0.78 0.16 155)" />
        </div>
        <h2 style={{ fontFamily: 'var(--display)', fontSize: 20, fontWeight: 800, color: 'var(--ink)', marginBottom: 8, letterSpacing: '.06em' }}>
          CAJA CERRADA
        </h2>
        <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 28 }}>
          Abre la caja para registrar movimientos
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left', marginBottom: 24 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
              Monto inicial (Bs.)
            </label>
            <input
              className="gym-input"
              type="number" min="0" step="0.01"
              value={montoInicial}
              onChange={e => setMontoInicial(e.target.value)}
              style={{ textAlign: 'center', fontSize: 18, fontFamily: 'var(--display)' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
              Notas (opcional)
            </label>
            <input className="gym-input" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones..." />
          </div>
        </div>
        <button onClick={abrir} disabled={abriendo} className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Unlock size={16} /> {abriendo ? 'Abriendo...' : 'Abrir Caja'}
        </button>
      </div>
    </motion.div>
  )
}

// ─── Vista Caja Abierta ───────────────────────────────────────────────────────

function CajaAbierta({ sesion, onCerrada, onRefresh }) {
  const { usuario } = useAuth()
  const { navigate } = useApp()
  const [resumen, setResumen] = useState(null)
  const [notas, setNotas] = useState([])
  const [modal, setModal] = useState(null) // null | 'ingreso' | 'egreso' | 'cerrar' | 'nota'
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    const [r, n] = await Promise.all([
      window.api.caja.getResumen(sesion.id),
      window.api.caja.getNotas(sesion.id),
    ])
    setResumen(r)
    setNotas(n || [])
    setCargando(false)
  }, [sesion.id])

  useEffect(() => { cargar() }, [cargar])

  if (cargando) return <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
  if (!resumen) return null

  const saldoActual = resumen.saldo_actual || 0
  const efectivoEsperado = resumen.efectivo_esperado ?? saldoActual
  const porMetodo = resumen.por_metodo || {}

  const metodoEntries = Object.entries(porMetodo)
  const efectivo = porMetodo.efectivo || 0
  const digital = Object.entries(porMetodo).filter(([m]) => m !== 'efectivo').reduce((s, [, v]) => s + v, 0)

  return (
    <div>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Efectivo esperado', value: fmtMoney(efectivoEsperado), color: 'oklch(0.78 0.16 155)', desc: `Apertura: ${fmtMoney(resumen.monto_inicial)}` },
          { label: 'Total ingresos', value: fmtMoney(resumen.total_ingresos), color: 'oklch(0.72 0.17 155)', desc: 'Todos los métodos' },
          { label: 'Digital / Sin efectivo', value: fmtMoney(digital), color: 'oklch(0.74 0.13 250)', desc: 'QR / Tarjeta / Transfer.' },
          { label: 'Total egresos', value: fmtMoney(resumen.total_egresos), color: 'oklch(0.75 0.18 25)', desc: 'Gastos del turno' },
        ].map(c => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: `${c.color}0c`, border: `1px solid ${c.color}30`, borderRadius: 12, padding: '14px 16px' }}
          >
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.14em', color: c.color, textTransform: 'uppercase', marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--display)', color: c.color, lineHeight: 1, marginBottom: 4 }}>{c.value}</div>
            <div style={{ fontSize: 11, color: 'var(--dim)' }}>{c.desc}</div>
          </motion.div>
        ))}
      </div>

      {/* Nota educativa permanente */}
      <div style={{ background: 'oklch(0.74 0.13 250 / .06)', border: '1px solid oklch(0.74 0.13 250 / .2)', borderRadius: 10, padding: '8px 14px', marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>ℹ️</span>
        <span style={{ fontSize: 11, color: 'var(--dim)', lineHeight: 1.6 }}>
          <strong style={{ color: 'oklch(0.78 0.16 155)' }}>Solo el efectivo se cuenta físicamente.</strong>{' '}
          Los pagos por QR, tarjeta y transferencia van directo a tu cuenta bancaria — NO están en la caja física y nunca pueden "faltar" de ella.
        </span>
      </div>

      {/* Info sesión */}
      <div style={{ background: 'var(--glass)', border: '1px solid oklch(0.78 0.16 155 / .25)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'oklch(0.78 0.16 155)', boxShadow: '0 0 8px oklch(0.78 0.16 155)' }} />
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          Abierta por <strong style={{ color: 'var(--ink)' }}>{resumen.usuario_nombre}</strong> · {fmtDate(resumen.fecha_apertura)} · Tiempo: <strong style={{ color: 'var(--ink)' }}>{fmtDuration(resumen.fecha_apertura, null)}</strong>
        </span>
      </div>

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={() => setModal('ingreso')} style={{ flex: 1, minWidth: 140, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'oklch(0.78 0.16 155 / .12)', border: '1px solid oklch(0.78 0.16 155 / .35)', color: 'oklch(0.78 0.16 155)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all .2s' }}>
          <TrendingUp size={15} /> Registrar ingreso
        </button>
        <button onClick={() => setModal('egreso')} style={{ flex: 1, minWidth: 140, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'oklch(0.75 0.18 25 / .12)', border: '1px solid oklch(0.75 0.18 25 / .35)', color: 'oklch(0.75 0.18 25)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all .2s' }}>
          <TrendingDown size={15} /> Registrar egreso
        </button>
        <button onClick={() => setModal('nota')} style={{ padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'oklch(0.82 0.14 75 / .12)', border: '1px solid oklch(0.82 0.14 75 / .35)', color: 'oklch(0.82 0.14 75)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all .2s' }}>
          <MessageSquarePlus size={14} /> Nota
        </button>
        <button onClick={() => setModal('cerrar')} style={{ padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'oklch(0.66 0.22 25 / .15)', border: '1px solid oklch(0.66 0.22 25 / .4)', color: 'oklch(0.85 0.12 25)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, transition: 'all .2s' }}>
          <Lock size={14} /> Cerrar Caja
        </button>
      </div>

      {/* Navegación cruzada */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => { localStorage.setItem('ventas_sesion_filter', sesion.id); navigate(PAGES.VENTAS) }}
          style={{ fontSize: 12, color: 'oklch(0.74 0.13 250)', background: 'oklch(0.74 0.13 250 / .08)', border: '1px solid oklch(0.74 0.13 250 / .25)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <ShoppingBag size={12} /> Ver ventas de este turno
        </button>
      </div>

      {/* Notas del turno */}
      {notas.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'var(--display)', fontSize: 12, fontWeight: 700, color: 'oklch(0.82 0.14 75)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 10 }}>
            <StickyNote size={12} style={{ marginRight: 5, verticalAlign: 'middle' }} />
            Notas del turno
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {notas.map(n => (
              <div key={n.id} style={{ background: 'oklch(0.82 0.14 75 / .07)', border: '1px solid oklch(0.82 0.14 75 / .2)', borderRadius: 8, padding: '8px 12px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <StickyNote size={13} color="oklch(0.82 0.14 75)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink)' }}>{n.texto}</div>
                  <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 3 }}>
                    {n.usuario_nombre || 'Sistema'} · {fmtDate(n.fecha)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Movimientos */}
      <div>
        <h3 style={{ fontFamily: 'var(--display)', fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 12 }}>
          Movimientos de la sesión
        </h3>
        {resumen.movimientos?.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--dim)', fontSize: 13 }}>No hay movimientos aún</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[...(resumen.movimientos || [])].reverse().map(m => (
              <div key={m.id} style={{ background: 'var(--glass)', border: '1px solid var(--line)', borderRadius: 9, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', color: TIPO_COLOR[m.tipo] || 'var(--dim)', minWidth: 56, textTransform: 'uppercase' }}>{m.tipo}</span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--muted)' }}>{m.concepto}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: m.tipo === 'egreso' ? 'oklch(0.75 0.18 25)' : 'oklch(0.78 0.16 155)' }}>
                  {m.tipo === 'egreso' ? '-' : '+'}{fmtMoney(m.monto)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--dim)', minWidth: 90, textAlign: 'right' }}>{fmtDate(m.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modales */}
      <AnimatePresence>
        {(modal === 'ingreso' || modal === 'egreso') && (
          <ModalMovimiento tipo={modal} onClose={() => setModal(null)} onSaved={cargar} usuario={usuario} />
        )}
        {modal === 'nota' && (
          <ModalNota sesionId={sesion.id} onClose={() => setModal(null)} onSaved={cargar} usuario={usuario} />
        )}
        {modal === 'cerrar' && (
          <ModalCerrarCaja
            sesion={sesion}
            efectivoEsperado={efectivoEsperado}
            saldoTotal={saldoActual}
            porMetodo={porMetodo}
            resumen={resumen}
            onClose={() => setModal(null)}
            onCerrada={onCerrada}
            usuario={usuario}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Caja() {
  const { usuario } = useAuth()
  const [vista, setVista] = useState('caja') // 'caja' | 'historial'
  const [sesion, setSesion] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [rev, setRev] = useState(0)

  const cargar = useCallback(async () => {
    const s = await window.api.caja.getSesionActual()
    setSesion(s || null)
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar, rev])

  const onCerrada = () => setRev(r => r + 1)
  const onAbierta = () => setRev(r => r + 1)

  return (
    <div style={{ padding: '0 2px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 className="titulo-metalico" style={{ marginBottom: 6 }}>CAJA DIARIA</h1>
          <p style={{ fontSize: 13, color: 'var(--dim)' }}>
            {sesion ? <span style={{ color: 'oklch(0.78 0.16 155)' }}>● Sesión activa</span> : <span>● Caja cerrada</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setVista(vista === 'historial' ? 'caja' : 'historial')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <History size={13} /> {vista === 'historial' ? 'Volver' : 'Historial'}
          </button>
          {vista === 'caja' && (
            <button onClick={() => setRev(r => r + 1)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <RefreshCw size={13} />
            </button>
          )}
        </div>
      </div>

      {cargando ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <div className="spinner" style={{ margin: '0 auto 14px' }} />
          <p style={{ fontSize: 13, color: 'var(--dim)' }}>Cargando...</p>
        </div>
      ) : vista === 'historial' ? (
        <Historial onVolver={() => setVista('caja')} />
      ) : sesion ? (
        <CajaAbierta sesion={sesion} onCerrada={onCerrada} onRefresh={cargar} />
      ) : (
        <CajaCerrada onAbierta={onAbierta} usuario={usuario} />
      )}
    </div>
  )
}
