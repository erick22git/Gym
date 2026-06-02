import { motion } from 'framer-motion'
import CountUp from 'react-countup'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function KPICard({ icon: Icon, label, value, prefix = '', suffix = '', decimals = 0, color = 'oklch(0.66 0.22 25)', trend = null, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
      style={{
        background: 'var(--glass)',
        backdropFilter: 'blur(28px) saturate(140%)',
        WebkitBackdropFilter: 'blur(28px) saturate(140%)',
        border: '1px solid var(--line)',
        borderRadius: 16,
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .08), 0 30px 60px oklch(0 0 0 / .4)',
      }}
    >
      {/* Glow de fondo */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at top left, ${color.replace(')', ' / .06)')}, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: color.replace(')', ' / .12)'),
          border: `1px solid ${color.replace(')', ' / .25)')}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={18} color={color} />
        </div>

        {trend !== null && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, fontWeight: 600,
            color: trend > 0 ? 'oklch(0.78 0.16 155)' : trend < 0 ? 'oklch(0.66 0.22 25)' : 'oklch(0.78 0.02 250 / .5)',
          }}>
            {trend > 0 ? <TrendingUp size={13} /> : trend < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
            {trend !== 0 && `${Math.abs(trend)}%`}
          </div>
        )}
      </div>

      {/* Valor */}
      <div>
        <div style={{
          fontSize: 28,
          fontWeight: 700,
          fontFamily: 'Oxanium, sans-serif',
          color: 'oklch(0.97 0.01 250)',
          lineHeight: 1,
          letterSpacing: '-0.01em',
        }}>
          {prefix}
          <CountUp
            end={value}
            duration={1.8}
            delay={delay}
            decimals={decimals}
            separator=","
            decimal="."
          />
          {suffix}
        </div>
        <div style={{
          fontSize: 11,
          color: 'oklch(0.78 0.02 250 / .45)',
          marginTop: 5,
          letterSpacing: '.07em',
          textTransform: 'uppercase',
        }}>
          {label}
        </div>
      </div>
    </motion.div>
  )
}
