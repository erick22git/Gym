import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, XCircle, Clock, RefreshCw, Eye, CheckCircle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { PAGES } from '../constants'

function urgenciaDe(diasRestantes) {
  if (diasRestantes == null || diasRestantes <= 0) return 'vencida'
  if (diasRestantes <= 2) return 'critica'
  if (diasRestantes <= 4) return 'media'
  return 'baja'
}

const URG = {
  critica: { color: 'oklch(0.75 0.18 25)',  bg: 'oklch(0.66 0.22 25 / .10)', border: 'oklch(0.66 0.22 25 / .40)', tag: 'CRÍTICA',  barColor: 'oklch(0.70 0.20 25)'  },
  media:   { color: 'oklch(0.82 0.14 75)',  bg: 'oklch(0.82 0.14 75 / .08)', border: 'oklch(0.82 0.14 75 / .35)', tag: 'MEDIA',   barColor: 'oklch(0.82 0.14 75)'  },
  baja:    { color: 'oklch(0.85 0.14 110)', bg: 'oklch(0.85 0.14 110 / .08)',border: 'oklch(0.85 0.14 110 / .30)',tag: 'BAJA',    barColor: 'oklch(0.85 0.14 110)' },
  vencida: { color: 'oklch(0.70 0.20 25)',  bg: 'oklch(0.60 0.25 25 / .12)', border: 'oklch(0.66 0.22 25 / .50)', tag: 'VENCIDA', barColor: 'oklch(0.65 0.22 20)'  },
}

function SummaryCard({ label, count, color, bg, desc, pulse }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: bg, border: `1px solid ${color}30`, borderRadius: 14,
        padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6,
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.14em', color, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{
        fontSize: 36, fontWeight: 800, fontFamily: 'var(--display)', color,
        lineHeight: 1,
      }}>
        {count}
      </div>
      <div style={{ fontSize: 11, color: 'var(--dim)' }}>{desc}</div>
    </motion.div>
  )
}

function AlertCard({ alerta, index, onVerCliente }) {
  const esVencida = alerta.tipo === 'vencida'
  const urg = URG[alerta.urgencia]
  const dias = alerta.dias_restantes ?? 0
  const diasTexto = esVencida
    ? `Venció hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}`
    : `Vence en ${dias} día${dias !== 1 ? 's' : ''}`
  const fechaFin = alerta.fecha_fin
    ? new Date(alerta.fecha_fin).toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      whileHover={{ scale: 1.003 }}
      style={{
        background: 'var(--glass)',
        border: `1px solid ${urg.border}`,
        borderLeft: `3px solid ${urg.barColor}`,
        borderRadius: 12, padding: '14px 18px',
        transition: 'transform .2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Tags */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
              background: urg.bg, border: `1px solid ${urg.border}`, color: urg.color,
              padding: '2px 9px', borderRadius: 20,
            }}>
              {urg.tag}
            </span>
            {esVencida
              ? <XCircle size={13} color={urg.color} style={{ flexShrink: 0 }} />
              : <AlertTriangle size={13} color={urg.color} style={{ flexShrink: 0 }} />
            }
            <span style={{ fontSize: 11, color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={10} /> {fechaFin}
            </span>
          </div>

          {/* Nombre */}
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>
            {alerta.nombre} {alerta.apellido}
          </div>

          {/* Detalle */}
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {alerta.plan_nombre} ·{' '}
            <span style={{ color: urg.color, fontWeight: 600 }}>{diasTexto}</span>
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
          {alerta.cliente_id && (
            <button
              title="Ver perfil del cliente"
              onClick={() => onVerCliente(alerta.cliente_id)}
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'oklch(0.74 0.13 250 / .12)', border: '1px solid oklch(0.74 0.13 250 / .35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Eye size={13} color="oklch(0.80 0.12 250)" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default function Alerts() {
  const { navigate } = useApp()
  const [porVencer, setPorVencer] = useState([])
  const [vencidas, setVencidas] = useState([])
  const [filtro, setFiltro] = useState('todas')
  const [cargando, setCargando] = useState(true)
  const [ultimaAct, setUltimaAct] = useState(null)

  async function cargar() {
    setCargando(true)
    try {
      const [pv, v] = await Promise.all([
        window.api.membresias.getPorVencer(),
        window.api.membresias.getVencidas(),
      ])
      setPorVencer(pv || [])
      setVencidas(v || [])
      setUltimaAct(new Date())
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  // Construir lista unificada
  const alertasPV = (porVencer).map(m => ({
    ...m,
    tipo: 'por_vencer',
    urgencia: urgenciaDe(m.dias_restantes),
  }))
  const alertasV = (vencidas).map(m => {
    const dias = m.fecha_fin
      ? Math.floor((Date.now() - new Date(m.fecha_fin).getTime()) / 86400000)
      : 0
    return { ...m, tipo: 'vencida', urgencia: 'vencida', dias_restantes: -dias }
  })

  const todas = [...alertasPV, ...alertasV].sort((a, b) => a.dias_restantes - b.dias_restantes)
  const criticas = todas.filter(a => a.urgencia === 'critica')
  const medias   = todas.filter(a => a.urgencia === 'media')
  const bajas    = todas.filter(a => a.urgencia === 'baja')
  const vencId   = todas.filter(a => a.urgencia === 'vencida')

  const filtradas =
    filtro === 'criticas' ? criticas :
    filtro === 'medias'   ? medias   :
    filtro === 'bajas'    ? bajas    :
    filtro === 'vencidas' ? vencId   :
    todas

  const FILTROS = [
    { id: 'todas',    label: `Todas (${todas.length})` },
    { id: 'criticas', label: `Críticas (${criticas.length})` },
    { id: 'medias',   label: `Medias (${medias.length})` },
    { id: 'bajas',    label: `Bajas (${bajas.length})` },
    { id: 'vencidas', label: `Vencidas (${vencId.length})` },
  ]

  return (
    <div style={{ padding: '0 2px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 className="titulo-metalico" style={{ marginBottom: 6 }}>ALERTAS</h1>
          <p style={{ fontSize: 13, color: 'var(--dim)' }}>
            {todas.length} alertas activas · {criticas.length} críticas
            {ultimaAct && (
              <span style={{ marginLeft: 10 }}>
                · Actualizado {ultimaAct.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={cargar}
          disabled={cargando}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
        >
          <RefreshCw size={13} style={{ animation: cargando ? 'spin 0.8s linear infinite' : 'none' }} />
          Actualizar
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <SummaryCard label="Críticas"   count={criticas.length} color={URG.critica.color} bg={URG.critica.bg} desc="Atención urgente"   pulse={criticas.length > 0} />
        <SummaryCard label="Medias"     count={medias.length}   color={URG.media.color}   bg={URG.media.bg}   desc="3–4 días"            />
        <SummaryCard label="Bajas"      count={bajas.length}    color={URG.baja.color}    bg={URG.baja.bg}    desc="5–7 días"            />
        <SummaryCard label="Vencidas"   count={vencId.length}   color={URG.vencida.color} bg={URG.vencida.bg} desc="Plan expirado"       />
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'oklch(1 0 0 / .03)', border: '1px solid var(--line)', borderRadius: 10, padding: 4, flexWrap: 'wrap' }}>
        {FILTROS.map(f => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            style={{
              padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
              background: filtro === f.id ? 'oklch(0.66 0.22 25 / .18)' : 'transparent',
              border: filtro === f.id ? '1px solid oklch(0.66 0.22 25 / .4)' : '1px solid transparent',
              color: filtro === f.id ? 'oklch(0.85 0.12 25)' : 'var(--dim)',
              cursor: 'pointer', transition: 'all .2s',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--dim)' }}>
          <div className="spinner" style={{ margin: '0 auto 14px', width: 24, height: 24 }} />
          <p style={{ fontSize: 13 }}>Cargando alertas...</p>
        </div>
      ) : filtradas.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: 60, color: 'var(--dim)' }}>
          <CheckCircle size={48} style={{ margin: '0 auto 14px', color: 'var(--green)', display: 'block' }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Todo en orden</p>
          <p style={{ fontSize: 13 }}>No hay alertas en esta categoría</p>
        </motion.div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <AnimatePresence>
            {filtradas.map((alerta, i) => (
              <AlertCard key={alerta.id} alerta={alerta} index={i} onVerCliente={id => navigate(PAGES.PERFIL_CLIENTE, { clienteId: id })} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
