import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion, useAnimationControls } from 'framer-motion'
import CountUp from 'react-countup'
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
import './Caja.css'
import '../Clients.css'

// Botón con el MISMO criterio de física ya usado en Control de Acceso:
// hover con elevación mínima (SHORT), press con scale (MICRO). Wrapper
// delgado sobre motion.button para no repetir estas props en cada botón
// de la página.
//
// [NUEVO — uniformado con "Nueva Venta"] Los 3 aspectos pedidos
// (jiggle al hover, font-weight, sombra) se aplican ACÁ, una sola vez,
// para que los 18 botones de esta página los reciban automáticamente.
//
// Jiggle: mismos 11 puntos de escala / 1.4s / cubic-bezier(0.36,0.07,
// 0.19,0.97) que @keyframes nueva-venta-jiggle (ControlAcceso.css) —
// los mismos números exactos, pero disparados vía scaleX/scaleY de
// Framer Motion (useAnimationControls + onHoverStart) en vez de un
// `animation` CSS crudo. Nueva Venta corre el jiggle en un DIV
// aparte del botón precisamente porque un `animation` CSS de
// `transform` en el MISMO elemento que ya tiene whileHover:{y:-2}
// pelearía por esa propiedad cada frame (el lift se perdería/
// parpadearía). Acá no hay wrapper por botón (18 botones, varios
// dentro de filas flex — envolver cada uno es riesgo de layout), así
// que se anima con el propio motor de Motion: compone y (lift) +
// scaleX/scaleY (jiggle) en un solo transform sin pisarse.
const JIGGLE_SCALE_X = [1, 0.82, 1.15, 0.90, 1.08, 0.95, 1.04, 0.98, 1.02, 0.99, 1]
const JIGGLE_SCALE_Y = [1, 1.18, 0.85, 1.10, 0.92, 1.05, 0.96, 1.02, 0.98, 1.01, 1]
const JIGGLE_TIMES   = [0, .10, .20, .30, .40, .50, .60, .70, .80, .90, 1]
const JIGGLE_EASE = [0.36, 0.07, 0.19, 0.97]
const JIGGLE_DURATION = 1.4

// Sombra "cantidad Nueva Venta" — mismos 3 valores exactos que ese
// botón (drop-shadow de .nueva-venta-glass-bg, box-shadow inset de esa
// misma capa, text-shadow de .nueva-venta-content). Van inline (no en
// una clase CSS) para que ganen siempre sobre cualquier clase que cada
// botón ya traiga (.btn-primary, .btn-secondary, .caja-danger-btn,
// etc.) sin depender del orden del bundle ni tocar esas clases
// globales compartidas con el resto de la app.
const NUEVA_VENTA_SHADOW_STYLE = {
  filter: 'drop-shadow(0px 0px 42px rgba(0, 0, 0, 0.58))',
  boxShadow: 'inset 0px 30px 12px -21px rgba(255, 255, 255, 0.32)',
  textShadow: '0 2px 6px rgba(0, 0, 0, 0.85)',
}

function CajaBtn({ children, className, style, disabled, ...props }) {
  const reduceMotion = useReducedMotion()
  const controls = useAnimationControls()

  const handleHoverStart = useCallback((e) => {
    props.onHoverStart?.(e)
    if (reduceMotion) return
    controls.start({
      scaleX: JIGGLE_SCALE_X,
      scaleY: JIGGLE_SCALE_Y,
      transition: { duration: JIGGLE_DURATION, ease: JIGGLE_EASE, times: JIGGLE_TIMES },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion, controls])

  return (
    <motion.button
      className={`caja-btn-uniform${className ? ' ' + className : ''}`}
      style={{ ...style, ...NUEVA_VENTA_SHADOW_STYLE, fontWeight: 700 }}
      disabled={disabled}
      animate={controls}
      whileHover={disabled ? undefined : { y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.97, transition: { duration: 0.12, ease: 'easeOut' } }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      {...props}
      onHoverStart={disabled ? undefined : handleHoverStart}
    >
      {children}
    </motion.button>
  )
}

// CountUp corto para montos — decimals:2 (Bs.), duración breve (no es
// un dashboard con números grandes, es un conteo "corto" como pide la
// Parte 3.3). preserveValue evita que reinicie desde 0 en cada
// keystroke del arqueo — anima desde el valor anterior, no desde cero.
function Monto({ value, decimals = 2, prefix = 'Bs. ' }) {
  return (
    <CountUp end={value || 0} duration={0.6} decimals={decimals} separator="," decimal="." prefix={prefix} preserveValue />
  )
}

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
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .68)', backdropFilter: 'blur(4px)' }} />
      <motion.div
        className="caja-glass-shell"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          position: 'relative', zIndex: 1, width: 380,
          // [MARCO — pedido explícito, "que no tenga marco"] Borde sólido
          // sacado, reemplazado por el mismo halo difuminado que ya usan
          // las cajas del Dashboard, sumado al glow de color existente.
          borderRadius: 16, padding: '24px 28px',
          boxShadow: `inset 0 1px 0 oklch(1 0 0 / .08), inset -14px -14px 28px oklch(1 0 0 / .07), inset -5px -5px 9px oklch(1 0 0 / .10), 0 0 10px 1px oklch(1 0 0 / .05), 0 24px 60px oklch(0 0 0 / .5), 0 0 40px ${color}10`,
          textShadow: '0 1px 2px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 19, fontWeight: 700, color, letterSpacing: '.06em' }}>
            {tipo === 'ingreso' ? 'Registrar Ingreso' : 'Registrar Egreso'}
          </h2>
          <button onClick={onClose} title="Cerrar" className="clientes-action-icon">
            <X size={21} color="rgba(220, 220, 225, 0.9)" />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Concepto</label>
            <input
              className="gym-input"
              value={concepto}
              onChange={e => setConcepto(e.target.value)}
              placeholder={tipo === 'ingreso' ? 'Venta de producto, etc.' : 'Pago de servicio, etc.'}
              autoFocus
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Monto (Bs.)</label>
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
          <CajaBtn onClick={onClose} className="btn-secondary clientes-glass-btn" style={{ flex: 1 }}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content">Cancelar</span>
          </CajaBtn>
          <CajaBtn onClick={guardar} disabled={guardando} className="clientes-glass-btn" style={{
            flex: 1, padding: '9px 16px', borderRadius: 9, fontSize: 15, fontWeight: 700,
            border: `1px solid ${color}50`,
            cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando ? .6 : 1,
          }}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content" style={{ color }}>
              <Check size={16} /> {guardando ? 'Guardando...' : 'Confirmar'}
            </span>
          </CajaBtn>
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
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .68)', backdropFilter: 'blur(4px)' }} />
      <motion.div
        className="caja-glass-shell"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'relative', zIndex: 1, width: '100%', maxWidth: 480,
          borderRadius: 16, padding: '24px 28px',
          boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .08), inset -14px -14px 28px oklch(1 0 0 / .07), inset -5px -5px 9px oklch(1 0 0 / .10), 0 0 10px 1px oklch(1 0 0 / .05), 0 24px 60px oklch(0 0 0 / .5)',
          maxHeight: '92vh', overflowY: 'auto',
          textShadow: '0 1px 2px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Lock size={21} color="oklch(0.75 0.18 25)" />
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 19, fontWeight: 700, color: 'oklch(0.85 0.12 25)', letterSpacing: '.06em' }}>
            Arqueo y Cierre de Turno
          </h2>
        </div>
        <p style={{ fontSize: 14, color: 'rgba(220, 220, 225, 0.9)', marginBottom: 20 }}>
          Turno de <strong style={{ color: 'var(--ink)' }}>{resumen?.usuario_nombre || usuario?.nombre_completo || '—'}</strong> · {fmtDate(sesion?.fecha_apertura)}
        </p>

        {/* ── BLOQUE EFECTIVO ── */}
        <div style={{ background: 'oklch(0.78 0.16 155 / .07)', border: '1px solid oklch(0.78 0.16 155 / .28)', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.78 0.16 155)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 }}>
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
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>EFECTIVO ESPERADO</span>
            <span style={{ fontSize: 21, fontWeight: 800, fontFamily: 'var(--display)', color: 'oklch(0.78 0.16 155)' }}><Monto value={efectivoEsperado} /></span>
          </div>

          {/* Input conteo */}
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
            Efectivo contado (Bs.)
          </label>
          <input
            className="gym-input"
            type="number" step="0.01"
            value={montoCierre}
            onChange={e => setMontoCierre(e.target.value)}
            autoFocus
            style={{ fontSize: 19, fontFamily: 'var(--display)', marginBottom: 10 }}
          />

          {/* Resultado del arqueo — [NUEVO, Parte 3.4] pequeña confirmación
              visual sutil (fade+scale, sin rebote) cuando CAMBIA la
              categoría (cuadra/sobrante/faltante) — key=categoría, no el
              monto exacto, así no re-anima en cada dígito tecleado, solo
              cuando el resultado realmente cambia de "tipo". */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={esCuadra ? 'cuadra' : esSobrante ? 'sobrante' : 'faltante'}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', borderRadius: 10,
                background: `${difColor}14`, border: `1px solid ${difColor}35`,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: difColor, letterSpacing: '.08em', textTransform: 'uppercase' }}>RESULTADO</div>
                <div style={{ fontSize: 12, color: 'rgba(220, 220, 225, 0.9)' }}>Solo aplica al efectivo físico</div>
              </div>
              <span style={{ fontSize: 19, fontWeight: 800, fontFamily: 'var(--display)', color: difColor }}>
                {diferencia >= 0 ? '+' : ''}<Monto value={diferencia} />
                <span style={{ fontSize: 13, marginLeft: 6 }}>{difLabel}</span>
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── BLOQUE PAGOS ELECTRÓNICOS ── */}
        {otrosMetodos.length > 0 && (
          <div style={{ background: 'oklch(0.74 0.13 250 / .06)', border: '1px solid oklch(0.74 0.13 250 / .25)', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.74 0.13 250)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                🏦 PAGOS ELECTRÓNICOS
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(220, 220, 225, 0.9)', marginBottom: 10, lineHeight: 1.5 }}>
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
                  <span style={{ fontSize: 14, color: verificados[met] ? 'oklch(0.78 0.16 155)' : 'var(--muted)' }}>
                    {MET_ICON[met] || ''} {met === 'qr' ? 'QR' : met === 'tarjeta' ? 'Tarjeta' : met === 'transferencia' ? 'Transferencia' : met}
                    {verificados[met] && <span style={{ marginLeft: 4, fontSize: 12 }}>✓ Verificado con banco</span>}
                  </span>
                </label>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'rgba(220, 220, 225, 0.9)' }}>{fmtMoney(monto)}</span>
              </div>
            ))}
            <div style={{ fontSize: 12, color: 'oklch(0.74 0.13 250 / .7)', marginTop: 6, paddingTop: 8, borderTop: '1px solid oklch(0.74 0.13 250 / .15)' }}>
              ℹ️ Estos montos NO generan faltante — son pagos directos al banco.
            </div>
          </div>
        )}

        {/* Resumen total */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', background: 'var(--glass)', border: '1px solid var(--line)', borderRadius: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 14, color: 'rgba(220, 220, 225, 0.9)' }}>Total recaudado (todos los métodos)</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{fmtMoney(saldoTotal)}</span>
        </div>

        {/* Resumen anti-confusión antes de cerrar */}
        <div style={{ background: 'oklch(0.14 0.02 250)', border: '1px solid oklch(1 0 0 / .1)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(220, 220, 225, 0.9)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>RESUMEN DEL TURNO</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 14, color: 'rgba(220, 220, 225, 0.9)' }}>💵 Efectivo en caja física</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'oklch(0.78 0.16 155)' }}>{fmtMoney(efectivoEsperado)}</span>
          </div>
          {otrosMetodos.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 14, color: 'rgba(220, 220, 225, 0.9)' }}>🏦 Pagos al banco (QR/Tarjeta/Transfer.)</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'oklch(0.74 0.13 250)' }}>{fmtMoney(otrosMetodos.reduce((s, [, v]) => s + v, 0))}</span>
            </div>
          )}
          <div style={{ paddingTop: 6, marginTop: 4, borderTop: '1px solid oklch(1 0 0 / .06)', fontSize: 13, color: 'rgba(220, 220, 225, 0.9)', lineHeight: 1.5 }}>
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
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
            Observaciones (opcional)
          </label>
          <input className="gym-input" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones del cierre..." />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <CajaBtn onClick={onClose} className="btn-secondary clientes-glass-btn" style={{ flex: 1 }}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content">Cancelar</span>
          </CajaBtn>
          <CajaBtn onClick={cerrar} disabled={cerrando} className="clientes-glass-btn" style={{
            flex: 2, padding: '9px 16px', borderRadius: 9, fontSize: 15, fontWeight: 700,
            border: '1px solid oklch(0.66 0.22 25 / .5)',
            cursor: cerrando ? 'not-allowed' : 'pointer',
            opacity: cerrando ? .6 : 1,
          }}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content" style={{ color: 'oklch(0.85 0.12 25)' }}>
              <Lock size={16} /> {cerrando ? 'Cerrando...' : 'Cerrar Turno e Imprimir Corte'}
            </span>
          </CajaBtn>
        </div>
      </motion.div>
    </div>
  )
}

function Row({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 14, color: 'rgba(220, 220, 225, 0.9)' }}>{label}</span>
      <span style={{ fontSize: 14, color: valueColor || 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{value}</span>
    </div>
  )
}

// ─── Historial ────────────────────────────────────────────────────────────────

function Historial({ onVolver }) {
  const { navigate } = useApp()
  const reduceMotion = useReducedMotion()
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
        <CajaBtn onClick={onVolver} className="btn-secondary clientes-glass-btn" style={{ fontSize: 14 }}>
          <div className="clientes-glass-bg" />
          <span className="clientes-glass-content">← Volver</span>
        </CajaBtn>
        <h2 style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 700, color: 'var(--ink)', letterSpacing: '.08em' }}>HISTORIAL DE CAJA</h2>
        <span style={{ fontSize: 13, color: 'rgba(220, 220, 225, 0.9)' }}>{total} sesiones</span>
      </div>
      {/* [SCROLL — pedido explícito, "no está dando la barra de scroll"]
          Este listado no tenía overflow propio: .page-content:has(.caja-page)
          (Caja.css) desactiva el scroll general de la página cuando se
          está en Caja, y acá no había ningún overflow-y:auto que lo
          reemplazara — con varias sesiones expandidas, el contenido
          quedaba cortado sin forma de llegar a él ni a la <Pagination>
          de abajo (que YA existe con Anterior/Siguiente/números de
          página — el problema era que quedaba fuera de vista, no que
          faltara). Mismo patrón que .caja-movimientos-list (overflow-y:
          auto) para esta lista. */}
      <div style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto', overflowX: 'hidden', paddingRight: 4 }}>
      {sesiones.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'rgba(220, 220, 225, 0.9)' }}>No hay sesiones registradas</div>
      ) : sesiones.map((s, i) => {
        const abierta = s.estado === 'abierta'
        return (
          <motion.div
            key={s.id}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut', delay: Math.min(i, 8) * 0.04 }}
            style={{ marginBottom: 8 }}
          >
            <div
              className="caja-glass-block"
              onClick={() => toggleExpandir(s.id)}
              style={{
                // [MARCO — pedido explícito] Borde (verde si "abierta",
                // var(--line) si no) sacado — el estado sigue siendo
                // visible por el punto de color + el texto "ABIERTA" de
                // abajo.
                // [OPACIDAD — dos vueltas] El fondo BLANCO (oklch(1 0 0/.13))
                // era el "filtro que lo vuelve blanco" reportado, así que
                // se sacó del todo. Pedido explícito después: sí necesita
                // ALGUNA capa de opacidad ("para evitar que no se pueda
                // ver", el mismo motivo por el que las cards de Dashboard
                // tienen su capa de tinte) — pero neutra/oscura, no blanca.
                // Se usa el mismo tinte oscuro que ya trae .caja-glass-shell
                // por CSS (oklch(0.14 0.015 250 / .28)) para que la fila y
                // el panel expandido de abajo queden parejos.
                background: 'oklch(0.14 0.015 250 / .28)',
                // [DISTORSIÓN — pedido explícito, "bájale un poco más a
                // historial"] Filtro propio #historial-glass (public/
                // filters-menu-glass.svg), más bajo que el #top-clientes-
                // glass compartido de .caja-glass-block — se override acá
                // en vez de tocar la clase, que sigue sirviendo al resto
                // de Caja.
                backdropFilter: 'url(#historial-glass)',
                WebkitBackdropFilter: 'url(#historial-glass)',
                borderRadius: expandido === s.id ? '10px 10px 0 0' : 10, padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .08), inset -14px -14px 28px oklch(1 0 0 / .07), inset -5px -5px 9px oklch(1 0 0 / .10), 0 0 10px 1px oklch(1 0 0 / .05)',
                // [SOMBRA DE LETRA — pedido explícito] text-shadow se
                // hereda — poniéndolo acá alcanza a TODOS los textos hijos
                // (fecha, usuario, montos) sin tocar cada span. Más fuerte
                // que el 0 1px 2px/.6 general de .caja-page (Caja.css).
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.85)',
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: abierta ? 'oklch(0.78 0.16 155)' : 'var(--dim)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                  {fmtDate(s.fecha_apertura)} {abierta && <span style={{ marginLeft: 8, fontSize: 12, color: 'oklch(0.78 0.16 155)', fontWeight: 700 }}>ABIERTA</span>}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(220, 220, 225, 0.9)' }}>
                  {s.usuario_nombre} · Apertura: {fmtMoney(s.monto_inicial)}
                  {s.fecha_cierre && ` · Cierre: ${fmtDate(s.fecha_cierre)}`}
                  {s.fecha_cierre && ` · Duración: ${fmtDuration(s.fecha_apertura, s.fecha_cierre)}`}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {s.monto_cierre != null && <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--display)', color: 'var(--ink)' }}>{fmtMoney(s.monto_cierre)}</div>}
                {s.diferencia != null && Math.abs(s.diferencia) > 0.01 && (
                  <div style={{ fontSize: 13, color: s.diferencia > 0 ? 'oklch(0.82 0.14 75)' : 'oklch(0.75 0.18 25)' }}>
                    {s.diferencia > 0 ? '+' : ''}{fmtMoney(s.diferencia)} efectivo
                  </div>
                )}
                {s.notas_count > 0 && (
                  <div style={{ fontSize: 12, color: 'oklch(0.82 0.14 75)', display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
                    <StickyNote size={11} /> {s.notas_count} nota{s.notas_count > 1 ? 's' : ''}
                  </div>
                )}
              </div>
              <ChevronRight size={16} color="rgba(220, 220, 225, 0.9)" style={{ transform: expandido === s.id ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
            </div>
            <AnimatePresence>
              {expandido === s.id && movimientos[s.id] && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="caja-glass-shell"
                  style={{
                    overflow: 'hidden', borderRadius: '0 0 10px 10px',
                    // Mismo filtro más bajo que la fila de arriba, y mismo
                    // refuerzo de text-shadow (hereda a los montos/fechas
                    // de cada movimiento).
                    backdropFilter: 'url(#historial-glass)',
                    WebkitBackdropFilter: 'url(#historial-glass)',
                    boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .08), inset -14px -14px 28px oklch(1 0 0 / .07), inset -5px -5px 9px oklch(1 0 0 / .10), 0 0 10px 1px oklch(1 0 0 / .05)',
                    textShadow: '0 2px 4px rgba(0, 0, 0, 0.85)',
                  }}
                >
                  <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {movimientos[s.id].map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: TIPO_COLOR[m.tipo] || 'rgba(220, 220, 225, 0.9)', minWidth: 52, textTransform: 'uppercase' }}>{m.tipo}</span>
                        <span className="caja-emphasis" style={{ flex: 1, fontSize: 14, color: 'oklch(0.88 0.01 250 / .85)' }}>{m.concepto}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: m.tipo === 'egreso' ? 'oklch(0.75 0.18 25)' : 'oklch(0.78 0.16 155)' }}>
                          {m.tipo === 'egreso' ? '-' : '+'}{fmtMoney(m.monto)}
                        </span>
                        <span style={{ fontSize: 12, color: 'rgba(220, 220, 225, 0.9)' }}>{fmtDate(m.created_at)}</span>
                      </div>
                    ))}
                    {/* Notas del turno */}
                    {notasSesion[s.id]?.length > 0 && (
                      <div style={{ marginTop: 6, paddingTop: 8, borderTop: '1px solid oklch(0.82 0.14 75 / .15)' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.82 0.14 75)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4 }}>Notas del turno</div>
                        {notasSesion[s.id].map(n => (
                          <div key={n.id} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 14, color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                            <StickyNote size={13} color="oklch(0.82 0.14 75)" style={{ flexShrink: 0, marginTop: 1 }} />
                            <span>{n.texto}</span>
                            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(220, 220, 225, 0.9)' }}>{fmtDate(n.fecha)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Ver ventas del turno */}
                    <div style={{ paddingTop: 6, marginTop: 4, borderTop: '1px solid oklch(1 0 0 / .06)' }}>
                      <CajaBtn
                        onClick={e => { e.stopPropagation(); localStorage.setItem('ventas_sesion_filter', s.id); navigate(PAGES.VENTAS) }}
                        className="caja-btn-ventas clientes-glass-btn"
                        style={{ fontSize: 13, border: '1px solid oklch(0.74 0.13 250 / .2)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                      >
                        <div className="clientes-glass-bg" />
                        <span className="clientes-glass-content" style={{ color: 'oklch(0.74 0.13 250)' }}>
                          <ShoppingBag size={12} /> Ver ventas de este turno
                        </span>
                      </CajaBtn>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
      </div>
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
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .68)', backdropFilter: 'blur(4px)' }} />
      <motion.div
        className="caja-glass-shell"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          position: 'relative', zIndex: 1, width: 400,
          borderRadius: 16, padding: '24px 28px',
          boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .08), inset -14px -14px 28px oklch(1 0 0 / .07), inset -5px -5px 9px oklch(1 0 0 / .10), 0 0 10px 1px oklch(1 0 0 / .05), 0 24px 60px oklch(0 0 0 / .5)',
          textShadow: '0 1px 2px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 18, fontWeight: 700, color: 'oklch(0.82 0.14 75)', letterSpacing: '.06em' }}>
            Agregar Nota al Turno
          </h2>
          <button onClick={onClose} title="Cerrar" className="clientes-action-icon">
            <X size={19} color="rgba(220, 220, 225, 0.9)" />
          </button>
        </div>
        <textarea
          className="gym-input"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Ej: Se retiró Bs. 100 para compra, cliente pagó adelantado..."
          rows={4}
          autoFocus
          style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 15, boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <CajaBtn onClick={onClose} className="btn-secondary clientes-glass-btn" style={{ flex: 1 }}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content">Cancelar</span>
          </CajaBtn>
          <CajaBtn onClick={guardar} disabled={guardando} className="clientes-glass-btn" style={{
            flex: 1, padding: '9px 16px', borderRadius: 9, fontSize: 15, fontWeight: 700,
            border: '1px solid oklch(0.82 0.14 75 / .4)',
            cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando ? .6 : 1,
          }}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content" style={{ color: 'oklch(0.82 0.14 75)' }}>
              <Check size={16} /> {guardando ? 'Guardando...' : 'Guardar nota'}
            </span>
          </CajaBtn>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Vista Caja Cerrada ───────────────────────────────────────────────────────

function CajaCerrada({ onAbierta, usuario }) {
  const reduceMotion = useReducedMotion()
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
    <motion.div initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
      <div className="caja-glass-block" style={{
        width: 400,
        // [OPACIDAD — pedido explícito, "quítale lo blanco, ponle un poco
        // de opacidad para que se note"] Antes oklch(1 0 0/.13), blanco.
        // Reemplazado por un tinte oscuro/neutro (mismo criterio que
        // Historial: oklch(0.14 .../.28)) — se nota sin lavar la card.
        background: 'oklch(0.14 0.015 250 / .28)',
        borderRadius: 20, padding: '36px 40px', textAlign: 'center',
        boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .08), inset -14px -14px 28px oklch(1 0 0 / .07), inset -5px -5px 9px oklch(1 0 0 / .10), 0 0 10px 1px oklch(1 0 0 / .05), 0 0 60px oklch(0.78 0.16 155 / .08)',
        textShadow: '0 1px 2px rgba(0,0,0,0.6)',
      }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: 'oklch(0.78 0.16 155 / .12)', border: '1px solid oklch(0.78 0.16 155 / .3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Wallet size={33} color="oklch(0.78 0.16 155)" />
        </div>
        <h2 style={{ fontFamily: 'var(--display)', fontSize: 24, fontWeight: 800, color: 'var(--ink)', marginBottom: 8, letterSpacing: '.06em' }}>
          CAJA CERRADA
        </h2>
        <p style={{ fontSize: 15, color: 'rgba(220, 220, 225, 0.9)', marginBottom: 28 }}>
          Abre la caja para registrar movimientos
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left', marginBottom: 24 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
              Monto inicial (Bs.)
            </label>
            <input
              className="gym-input"
              type="number" min="0" step="0.01"
              value={montoInicial}
              onChange={e => setMontoInicial(e.target.value)}
              style={{ textAlign: 'center', fontSize: 21, fontFamily: 'var(--display)' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
              Notas (opcional)
            </label>
            <input className="gym-input" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones..." />
          </div>
        </div>
        <CajaBtn onClick={abrir} disabled={abriendo} className="clientes-glass-btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: 16 }}>
          <div className="clientes-glass-bg" />
          <span className="clientes-glass-content">
            <Unlock size={19} /> {abriendo ? 'Abriendo...' : 'Abrir Caja'}
          </span>
        </CajaBtn>
      </div>
    </motion.div>
  )
}

// ─── Vista Caja Abierta ───────────────────────────────────────────────────────

function CajaAbierta({ sesion, onCerrada, onRefresh }) {
  const { usuario } = useAuth()
  const { navigate } = useApp()
  const reduceMotion = useReducedMotion()
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
          { label: 'Efectivo esperado', value: efectivoEsperado, color: 'oklch(0.78 0.16 155)', desc: `Apertura: ${fmtMoney(resumen.monto_inicial)}` },
          { label: 'Total ingresos', value: resumen.total_ingresos, color: 'oklch(0.72 0.17 155)', desc: 'Todos los métodos' },
          { label: 'Digital / Sin efectivo', value: digital, color: 'oklch(0.74 0.13 250)', desc: 'QR / Tarjeta / Transfer.' },
          { label: 'Total egresos', value: resumen.total_egresos, color: 'oklch(0.75 0.18 25)', desc: 'Gastos del turno' },
        ].map((c, i) => (
          <motion.div key={c.label} className="caja-glass-block"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut', delay: i * 0.04 }}
            style={{
              // [FONDO — pedido explícito, "aumentalo mucho más"] Mismo
              // radial-gradient de KPICard.jsx, alphas subidas bastante
              // por encima de las de Dashboard (.17/.06 → .45/.18) — acá
              // se pidió explícitamente mucho más presencia de color que
              // en las KPI del Dashboard, no la misma intensidad.
              background: `radial-gradient(circle at center, ${c.color.replace(')', ' / 0.45)')} 0%, ${c.color.replace(')', ' / 0.18)')} 50%, transparent 80%)`,
              borderRadius: 12, padding: '14px 16px',
              boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .08), inset -14px -14px 28px oklch(1 0 0 / .07), inset -5px -5px 9px oklch(1 0 0 / .10), 0 0 10px 1px oklch(1 0 0 / .05)',
              // [CENTRADO — pedido explícito] textAlign se hereda a los 3
              // divs hijos (label/valor/desc), los centra a los tres de
              // una sin tocarlos uno por uno.
              textAlign: 'center',
              // [SOMBRA — pedido explícito] Mismo criterio: se hereda a
              // los 3 hijos sin tocarlos uno por uno.
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.85)',
            }}
          >
            {/* [LETRA — pedido explícito] Antes color: c.color (texto del
                mismo tono que el fondo) — ahora blanco fijo en label y
                valor, el color de cada card queda solo en el fondo. */}
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: 'oklch(0.97 0.01 250)', textTransform: 'uppercase', marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--display)', color: 'oklch(0.97 0.01 250)', lineHeight: 1, marginBottom: 4 }}><Monto value={c.value} /></div>
            <div style={{ fontSize: 13, color: 'oklch(0.97 0.01 250 / .75)' }}>{c.desc}</div>
          </motion.div>
        ))}
      </div>

      {/* Nota educativa permanente — [NUEVO, Parte 3.1] sigue en la cadena
          de revelado progresivo (después de las 4 KPI cards, que ya
          terminan su propio stagger en i*0.04 hasta 0.12). */}
      <motion.div className="caja-glass-block"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut', delay: 0.16 }}
        style={{
          background: 'oklch(0.74 0.13 250 / .13)', borderRadius: 10, padding: '8px 14px', marginBottom: 14,
          display: 'flex', alignItems: 'flex-start', gap: 8,
          // [DISTORSIÓN — pedido explícito, "bájale la distorsión a esas
          // dos barras"] Override del #top-clientes-glass compartido de
          // .caja-glass-block, mismo filtro suave que Historial.
          backdropFilter: 'url(#historial-glass)',
          WebkitBackdropFilter: 'url(#historial-glass)',
          boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .08), inset -14px -14px 28px oklch(1 0 0 / .07), inset -5px -5px 9px oklch(1 0 0 / .10), 0 0 10px 1px oklch(1 0 0 / .05)',
          textShadow: '0 1px 2px rgba(0,0,0,0.6)',
        }}>
        {/* [REVERTIDO — pedido explícito: "esto no tenías que hacerlo
            grande"] Excluida del aumento del 10% que se aplicó al resto
            de Caja — vuelve a su tamaño original. */}
        <span style={{ fontSize: 15, flexShrink: 0 }}>ℹ️</span>
        <span style={{ fontSize: 12, color: 'rgba(220, 220, 225, 0.9)', lineHeight: 1.6 }}>
          <strong style={{ color: 'oklch(0.78 0.16 155)' }}>Solo el efectivo se cuenta físicamente.</strong>{' '}
          Los pagos por QR, tarjeta y transferencia van directo a tu cuenta bancaria — NO están en la caja física y nunca pueden "faltar" de ella.
        </span>
      </motion.div>

      {/* Info sesión */}
      <motion.div className="caja-glass-block"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut', delay: 0.2 }}
        style={{
          background: 'oklch(1 0 0 / .13)', borderRadius: 12, padding: '12px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 12,
          // [DISTORSIÓN — pedido explícito] Mismo override que la barra
          // de arriba.
          backdropFilter: 'url(#historial-glass)',
          WebkitBackdropFilter: 'url(#historial-glass)',
          boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .08), inset -14px -14px 28px oklch(1 0 0 / .07), inset -5px -5px 9px oklch(1 0 0 / .10), 0 0 10px 1px oklch(1 0 0 / .05)',
          textShadow: '0 1px 2px rgba(0,0,0,0.6)',
        }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'oklch(0.78 0.16 155)', boxShadow: '0 0 8px oklch(0.78 0.16 155)' }} />
        {/* [REVERTIDO — pedido explícito] Misma exclusión que la barra de
            arriba, vuelve a su tamaño original. */}
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          Abierta por <strong style={{ color: 'var(--ink)' }}>{resumen.usuario_nombre}</strong> · {fmtDate(resumen.fecha_apertura)} · Tiempo: <strong style={{ color: 'var(--ink)' }}>{fmtDuration(resumen.fecha_apertura, null)}</strong>
        </span>
      </motion.div>

      {/* Acciones */}
      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut', delay: 0.24 }}
        style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <CajaBtn onClick={() => setModal('ingreso')} className="caja-btn-ingreso clientes-glass-btn" style={{ flex: 1, minWidth: 140, padding: '10px 16px', borderRadius: 10, fontSize: 15, border: '1px solid oklch(0.78 0.16 155 / .35)', cursor: 'pointer' }}>
          <div className="clientes-glass-bg" />
          <span className="clientes-glass-content" style={{ color: 'oklch(0.78 0.16 155)' }}>
            <TrendingUp size={18} /> Registrar ingreso
          </span>
        </CajaBtn>
        <CajaBtn onClick={() => setModal('egreso')} className="caja-btn-egreso clientes-glass-btn" style={{ flex: 1, minWidth: 140, padding: '10px 16px', borderRadius: 10, fontSize: 15, border: '1px solid oklch(0.75 0.18 25 / .35)', cursor: 'pointer' }}>
          <div className="clientes-glass-bg" />
          <span className="clientes-glass-content" style={{ color: 'oklch(0.75 0.18 25)' }}>
            <TrendingDown size={18} /> Registrar egreso
          </span>
        </CajaBtn>
        <CajaBtn onClick={() => setModal('nota')} className="caja-btn-nota clientes-glass-btn" style={{ padding: '10px 14px', borderRadius: 10, fontSize: 15, border: '1px solid oklch(0.82 0.14 75 / .35)', cursor: 'pointer' }}>
          <div className="clientes-glass-bg" />
          <span className="clientes-glass-content" style={{ color: 'oklch(0.82 0.14 75)' }}>
            <MessageSquarePlus size={16} /> Nota
          </span>
        </CajaBtn>
        <CajaBtn onClick={() => setModal('cerrar')} className="caja-btn-cerrar clientes-glass-btn" style={{ padding: '10px 20px', borderRadius: 10, fontSize: 15, border: '1px solid oklch(0.66 0.22 25 / .4)', cursor: 'pointer' }}>
          <div className="clientes-glass-bg" />
          <span className="clientes-glass-content" style={{ color: 'oklch(0.85 0.12 25)' }}>
            <Lock size={16} /> Cerrar Caja
          </span>
        </CajaBtn>
      </motion.div>

      {/* Navegación cruzada */}
      <div style={{ marginBottom: 20 }}>
        <CajaBtn
          onClick={() => { localStorage.setItem('ventas_sesion_filter', sesion.id); navigate(PAGES.VENTAS) }}
          className="caja-btn-ventas clientes-glass-btn"
          style={{ fontSize: 14, border: '1px solid oklch(0.74 0.13 250 / .25)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}
        >
          <div className="clientes-glass-bg" />
          <span className="clientes-glass-content" style={{ color: 'oklch(0.74 0.13 250)' }}>
            <ShoppingBag size={14} /> Ver ventas de este turno
          </span>
        </CajaBtn>
      </div>

      {/* Notas del turno */}
      {notas.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'var(--display)', fontSize: 14, fontWeight: 700, color: 'oklch(0.82 0.14 75)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 10 }}>
            <StickyNote size={14} style={{ marginRight: 5, verticalAlign: 'middle' }} />
            Notas del turno
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* [NUEVO, Parte 3.7] entrada con stagger — también sirve de
                confirmación visual breve cuando se agrega una nota nueva
                (además del toast ya existente en ModalNota.guardar()):
                la nota entra animada al refrescar la lista, no aparece
                de golpe. */}
            <AnimatePresence initial={false}>
              {notas.map((n, i) => (
                <motion.div key={n.id}
                  className="caja-glass-block"
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut', delay: Math.min(i, 6) * 0.04 }}
                  style={{
                    background: 'oklch(0.82 0.14 75 / .14)', borderRadius: 8, padding: '8px 12px',
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .08), inset -14px -14px 28px oklch(1 0 0 / .07), inset -5px -5px 9px oklch(1 0 0 / .10), 0 0 10px 1px oklch(1 0 0 / .05)',
                    textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                  }}>
                  <StickyNote size={15} color="oklch(0.82 0.14 75)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, color: 'var(--ink)' }}>{n.texto}</div>
                    <div style={{ fontSize: 12, color: 'rgba(220, 220, 225, 0.9)', marginTop: 3 }}>
                      {n.usuario_nombre || 'Sistema'} · {fmtDate(n.fecha)}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Movimientos */}
      <div className="caja-movimientos">
        <h3 style={{ fontFamily: 'var(--display)', fontSize: 14, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 12 }}>
          Movimientos de la sesión
        </h3>
        {resumen.movimientos?.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'rgba(220, 220, 225, 0.9)', fontSize: 15 }}>No hay movimientos aún</div>
        ) : (
          <div className="caja-movimientos-list" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* [NUEVO, Parte 3.6] entrada con stagger corto — mismo
                criterio que resultados de búsqueda en Control de Acceso. */}
            <AnimatePresence initial={false}>
              {[...(resumen.movimientos || [])].reverse().map((m, i) => (
                <motion.div key={m.id}
                  className="caja-glass-block"
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut', delay: Math.min(i, 8) * 0.04 }}
                  style={{
                    // [OPACIDAD — corregido] Mismo fix que en Historial:
                    // fondo blanco sacado (era el "filtro que lo vuelve
                    // blanco" reportado), queda solo backdrop-filter + halo,
                    // igual que Dashboard.jsx.
                    background: 'oklch(0.13 0.02 250 / .2)', borderRadius: 9, padding: '10px 14px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .08), inset -14px -14px 28px oklch(1 0 0 / .07), inset -5px -5px 9px oklch(1 0 0 / .10), 0 0 10px 1px oklch(1 0 0 / .05)',
                    textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                  }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: TIPO_COLOR[m.tipo] || 'rgba(220, 220, 225, 0.9)', minWidth: 56, flexShrink: 0, textTransform: 'uppercase' }}>{m.tipo}</span>
                  <span className="caja-emphasis caja-movimiento-concepto" style={{ flex: 1, fontSize: 15, color: 'oklch(0.88 0.01 250 / .85)' }}>{m.concepto}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, flexShrink: 0, color: m.tipo === 'egreso' ? 'oklch(0.75 0.18 25)' : 'oklch(0.78 0.16 155)' }}>
                    {m.tipo === 'egreso' ? '-' : '+'}<Monto value={m.monto} />
                  </span>
                  <span style={{ fontSize: 13, color: 'rgba(220, 220, 225, 0.9)', minWidth: 90, flexShrink: 0, textAlign: 'right' }}>{fmtDate(m.created_at)}</span>
                </motion.div>
              ))}
            </AnimatePresence>
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
  const reduceMotion = useReducedMotion()
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

  // [NUEVO, Parte 3.2] key identifica cada "estado" de la vista —
  // cambiar de vista (caja/historial) o de sesión (cerrada/abierta,
  // vía onCerrada/onAbierta → rev → cargar() → sesion cambia de
  // null↔objeto) dispara una transición fade+scale clara en vez del
  // swap instantáneo que había antes.
  const vistaKey = cargando ? 'cargando' : vista === 'historial' ? 'historial' : sesion ? 'abierta' : 'cerrada'

  return (
    <div className="caja-page clientes-page" style={{ padding: '0 2px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 className="titulo-metalico" style={{ marginBottom: 6 }}>CAJA DIARIA</h1>
          <p style={{ fontSize: 15, color: 'rgba(220, 220, 225, 0.9)' }}>
            {sesion ? <span style={{ color: 'oklch(0.78 0.16 155)' }}>● Sesión activa</span> : <span>● Caja cerrada</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <CajaBtn onClick={() => setVista(vista === 'historial' ? 'caja' : 'historial')} className="btn-secondary clientes-glass-btn" style={{ fontSize: 14 }}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content">
              <History size={15} /> {vista === 'historial' ? 'Volver' : 'Historial'}
            </span>
          </CajaBtn>
          {vista === 'caja' && (
            <button onClick={() => setRev(r => r + 1)} title="Actualizar" className="clientes-action-icon">
              <RefreshCw size={15} color="var(--muted)" />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={vistaKey}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {cargando ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <div className="spinner" style={{ margin: '0 auto 14px' }} />
              <p style={{ fontSize: 15, color: 'rgba(220, 220, 225, 0.9)' }}>Cargando...</p>
            </div>
          ) : vista === 'historial' ? (
            <Historial onVolver={() => setVista('caja')} />
          ) : sesion ? (
            <CajaAbierta sesion={sesion} onCerrada={onCerrada} onRefresh={cargar} />
          ) : (
            <CajaCerrada onAbierta={onAbierta} usuario={usuario} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
