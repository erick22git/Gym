import { motion } from 'framer-motion'
import { CheckCircle, AlertTriangle, XCircle, PauseCircle, RefreshCw, Eye, Phone, CreditCard, Clock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

function Avatar({ nombre, apellido, size = 80 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, oklch(0.66 0.22 25 / .35), oklch(0.45 0.18 25 / .2))',
      border: '2px solid oklch(0.66 0.22 25 / .4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.34, fontWeight: 800, color: 'oklch(0.85 0.08 25)',
      fontFamily: 'var(--display)', letterSpacing: '.04em',
      boxShadow: '0 0 24px oklch(0.66 0.22 25 / .25)',
    }}>
      {nombre?.[0]}{apellido?.[0]}
    </div>
  )
}

function BarraProgreso({ diasRestantes, duracionDias }) {
  const total = duracionDias || 30
  const restante = Math.max(0, diasRestantes || 0)
  const pct = Math.min(100, Math.round((restante / total) * 100))
  const color = pct > 30 ? 'var(--green)' : pct > 10 ? 'var(--amber)' : 'oklch(0.75 0.18 25)'
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--dim)' }}>Progreso del plan</span>
        <span style={{ fontSize: 11, color, fontWeight: 600 }}>{pct}% restante</span>
      </div>
      <div style={{ height: 6, background: 'oklch(1 0 0 / .08)', borderRadius: 999, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ height: '100%', background: color, borderRadius: 999 }}
        />
      </div>
    </div>
  )
}

const CONFIG_ESTADO = {
  activa: {
    bg: 'oklch(0.78 0.16 155 / .06)',
    border: 'oklch(0.78 0.16 155 / .25)',
    badge: { bg: 'oklch(0.78 0.16 155 / .15)', color: 'var(--green)', border: 'oklch(0.78 0.16 155 / .4)' },
    label: 'ACTIVO',
    Icon: CheckCircle,
    iconColor: 'var(--green)',
  },
  por_vencer: {
    bg: 'oklch(0.82 0.14 75 / .06)',
    border: 'oklch(0.82 0.14 75 / .25)',
    badge: { bg: 'oklch(0.82 0.14 75 / .15)', color: 'var(--amber)', border: 'oklch(0.82 0.14 75 / .4)' },
    label: 'POR VENCER',
    Icon: AlertTriangle,
    iconColor: 'var(--amber)',
  },
  vencida: {
    bg: 'oklch(0.66 0.22 25 / .06)',
    border: 'oklch(0.66 0.22 25 / .25)',
    badge: { bg: 'oklch(0.66 0.22 25 / .15)', color: 'oklch(0.75 0.18 25)', border: 'oklch(0.66 0.22 25 / .4)' },
    label: 'VENCIDO',
    Icon: XCircle,
    iconColor: 'oklch(0.75 0.18 25)',
  },
  sin_plan: {
    bg: 'oklch(0.66 0.22 25 / .04)',
    border: 'oklch(0.66 0.22 25 / .15)',
    badge: { bg: 'oklch(1 0 0 / .06)', color: 'var(--dim)', border: 'var(--line)' },
    label: 'SIN PLAN',
    Icon: XCircle,
    iconColor: 'var(--dim)',
  },
  pausada: {
    bg: 'oklch(0.74 0.13 250 / .05)',
    border: 'oklch(0.74 0.13 250 / .2)',
    badge: { bg: 'oklch(0.74 0.13 250 / .12)', color: 'var(--blue)', border: 'oklch(0.74 0.13 250 / .35)' },
    label: 'PAUSADO',
    Icon: PauseCircle,
    iconColor: 'var(--blue)',
  },
}

function formatFecha(str) {
  if (!str) return '—'
  const d = new Date(str)
  return d.toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ClienteCard({ cliente, estado, ingresoRegistrado, ingresoHora, onRenovar, onVerPerfil }) {
  const { tienePermiso } = useAuth()
  const cfg = CONFIG_ESTADO[estado] || CONFIG_ESTADO.sin_plan
  const { Icon } = cfg
  const puedeCobrar = tienePermiso('membresias.cobrar')
  const puedeRenovar = tienePermiso('membresias.renovar')

  const diasRestantes = cliente.dias_restantes
  const fechaVence = cliente.fecha_fin

  return (
    <div style={{
      borderRadius: 16,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      padding: 24,
      backdropFilter: 'blur(20px)',
      boxShadow: '0 4px 32px oklch(0 0 0 / .3)',
    }}>
      {/* Header con avatar e info */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <Avatar nombre={cliente.nombre} apellido={cliente.apellido} size={80} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
            <h2 style={{
              fontSize: 22, fontWeight: 800, fontFamily: 'var(--display)',
              letterSpacing: '.04em', color: 'var(--ink)', margin: 0,
            }}>
              {cliente.nombre} {cliente.apellido}
            </h2>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
              padding: '4px 10px', borderRadius: 999,
              background: cfg.badge.bg, color: cfg.badge.color, border: `1px solid ${cfg.badge.border}`,
            }}>
              {cfg.label}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <CreditCard size={12} />
              CI: {cliente.carnet} {cliente.extension_ci || ''}
            </span>
            {cliente.codigo && (
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                Código: {cliente.codigo}
              </span>
            )}
            {cliente.telefono && (
              <span style={{ fontSize: 12, color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Phone size={12} />
                {cliente.telefono}
              </span>
            )}
          </div>

          {/* Plan */}
          {cliente.plan_nombre && (
            <div style={{
              marginTop: 12,
              background: 'oklch(1 0 0 / .04)',
              border: '1px solid var(--line)',
              borderRadius: 10, padding: '10px 14px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--display)', letterSpacing: '.04em' }}>
                  {cliente.plan_nombre}
                </span>
                {fechaVence && (
                  <span style={{ fontSize: 11, color: 'var(--dim)' }}>
                    Vence: {formatFecha(fechaVence)}
                    {diasRestantes >= 0 ? ` (${diasRestantes} días)` : ''}
                  </span>
                )}
              </div>
              {diasRestantes !== null && diasRestantes !== undefined && (
                <BarraProgreso diasRestantes={diasRestantes} duracionDias={cliente.duracion_dias} />
              )}
            </div>
          )}

          {/* Mensaje de ingreso */}
          {ingresoRegistrado && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                marginTop: 10, display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', borderRadius: 8,
                background: 'oklch(0.78 0.16 155 / .12)',
                border: '1px solid oklch(0.78 0.16 155 / .3)',
              }}
            >
              <CheckCircle size={16} color="var(--green)" />
              <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>
                Bienvenido/a — Ingreso registrado · {ingresoHora}
              </span>
            </motion.div>
          )}

          {estado === 'vencida' && (
            <div style={{
              marginTop: 10, padding: '8px 14px', borderRadius: 8,
              background: 'oklch(0.66 0.22 25 / .1)', border: '1px solid oklch(0.66 0.22 25 / .3)',
              fontSize: 13, color: 'oklch(0.80 0.12 25)', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <XCircle size={16} />
              Plan vencido. Se requiere renovación para registrar ingreso.
            </div>
          )}

          {estado === 'sin_plan' && (
            <div style={{
              marginTop: 10, padding: '8px 14px', borderRadius: 8,
              background: 'oklch(1 0 0 / .04)', border: '1px solid var(--line)',
              fontSize: 13, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <XCircle size={16} />
              Sin membresía activa.
            </div>
          )}

          {estado === 'por_vencer' && diasRestantes <= 5 && (
            <div style={{
              marginTop: 10, padding: '8px 14px', borderRadius: 8,
              background: 'oklch(0.82 0.14 75 / .1)', border: '1px solid oklch(0.82 0.14 75 / .3)',
              fontSize: 13, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertTriangle size={16} />
              Atención: el plan vence en {diasRestantes} días.
            </div>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
        {(estado === 'vencida' || estado === 'sin_plan' || estado === 'por_vencer') && (puedeRenovar || puedeCobrar) && (
          <button
            onClick={onRenovar}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}
          >
            <RefreshCw size={15} />
            {estado === 'sin_plan' ? 'Asignar Plan' : 'Renovar Plan'}
          </button>
        )}
        {estado === 'activa' && (puedeRenovar || puedeCobrar) && (
          <button
            onClick={onRenovar}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}
          >
            <RefreshCw size={15} />
            Renovar anticipado
          </button>
        )}
        {onVerPerfil && (
          <button
            onClick={onVerPerfil}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}
          >
            <Eye size={15} />
            Ver Perfil
          </button>
        )}
      </div>
    </div>
  )
}
