import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  KeyRound, Plus, Search, X, Check, AlertTriangle, RefreshCw, Ban,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { Select } from '../../components/ui/Select'
import Pagination from '../../components/ui/Pagination'
import '../Clients.css'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtFecha(f) {
  if (!f) return '—'
  return new Date(f).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function soloFecha(f) {
  if (!f) return null
  return new Date(f).toISOString().slice(0, 10)
}

function esNoDevuelta(c) {
  if (c.estado !== 'asignada' || !c.asignacion_activa_fecha) return false
  const hoy = new Date().toISOString().slice(0, 10)
  return soloFecha(c.asignacion_activa_fecha) < hoy
}

const ESTADO_BADGE = {
  disponible: { bg: 'oklch(0.78 0.16 155 / .15)', color: 'oklch(0.78 0.16 155)', label: 'Disponible' },
  asignada:   { bg: 'oklch(0.74 0.13 250 / .15)', color: 'oklch(0.74 0.13 250)', label: 'Asignada' },
  perdida:    { bg: 'oklch(0.75 0.18 25 / .15)',  color: 'oklch(0.75 0.18 25)',  label: 'Perdida' },
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, icon: Icon, color, alerta }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{
        position: 'relative', overflow: 'hidden',
        background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
        border: alerta ? `1px solid ${color.replace(')', ' / .5)')}` : '1px solid transparent', borderRadius: 12,
        padding: '16px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 8,
        boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
      }}
    >
      {/* Glow de estado — mismo patrón que el resto de la app */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 12,
        background: `radial-gradient(circle at center, ${color.replace(')', ' / 0.15)')} 0%, ${color.replace(')', ' / 0.05)')} 55%, transparent 85%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', width: 40, height: 40, borderRadius: 10, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={color} />
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'oklch(0.97 0.01 250)', marginBottom: 3, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--display)', color: 'oklch(0.97 0.01 250)', lineHeight: 1, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{value}</div>
      </div>
    </motion.div>
  )
}

// ─── Modal Crear Rango de Llaves ───────────────────────────────────────────────

function ModalCrearRango({ onClose, onCreated }) {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  async function handleCrear() {
    const d = parseInt(desde, 10)
    const h = parseInt(hasta, 10)
    if (!Number.isFinite(d) || !Number.isFinite(h) || d > h) {
      toast.error('Rango inválido')
      return
    }
    setGuardando(true)
    try {
      const r = await window.api.casilleros.crearRango(desde, hasta)
      if (!r.ok) {
        toast.error(r.error || 'No se pudo crear el rango')
        return
      }
      toast.success(`${r.creadas} llave${r.creadas === 1 ? '' : 's'} creada${r.creadas === 1 ? '' : 's'}${r.existentes ? ` — ${r.existentes} ya existían` : ''}`)
      onCreated()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'oklch(0 0 0 / .25)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0 }} />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{
          position: 'relative', zIndex: 1, width: '100%', maxWidth: 400,
          background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
          border: '1px solid transparent', borderRadius: 18, overflow: 'hidden',
          boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .08), 0 0 12px 1px oklch(1 0 0 / .05), 0 24px 60px oklch(0 0 0 / .4)',
          textShadow: '0 1px 2px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'var(--display)', fontSize: 15, fontWeight: 800, letterSpacing: '.06em', margin: 0 }}>Alta de llaves por rango</h3>
          <button onClick={onClose} className="clientes-action-icon" title="Cerrar"><X size={18} color="var(--dim)" /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 12, color: 'oklch(0.88 0.01 250 / .85)', lineHeight: 1.5 }}>
            Crea varias llaves de una sola vez (ej. del 1 al 50). Las que ya existan se omiten automáticamente.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Desde</label>
              <input className="gym-input" type="number" min="1" value={desde} onChange={e => setDesde(e.target.value)} placeholder="1" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Hasta</label>
              <input className="gym-input" type="number" min="1" value={hasta} onChange={e => setHasta(e.target.value)} placeholder="50" />
            </div>
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
          <button className="clientes-glass-btn btn-secondary" onClick={onClose}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content">Cancelar</span>
          </button>
          <button className="clientes-glass-btn btn-primary" onClick={handleCrear} disabled={guardando} style={{ opacity: guardando ? 0.6 : 1 }}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content"><Check size={14} /> {guardando ? 'Creando...' : 'Crear llaves'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function Casilleros() {
  const { tienePermiso } = useAuth()
  const confirmar = useConfirm()
  const puedeGestionar = tienePermiso('casilleros.gestionar')

  const [stats, setStats] = useState(null)
  const [casilleros, setCasilleros] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState({ estado: 'todos', desde: '', hasta: '' })
  const [showModalRango, setShowModalRango] = useState(false)
  const debounceRef = useRef(null)

  const cargar = useCallback(async (p, ps, b, f) => {
    setCargando(true)
    try {
      const [s, result] = await Promise.all([
        window.api.casilleros.getStats(),
        window.api.casilleros.getPaginated({
          page: p, pageSize: ps,
          busqueda: b || undefined,
          estado: f.estado !== 'todos' ? f.estado : undefined,
          desde: f.desde || undefined,
          hasta: f.hasta || undefined,
        }),
      ])
      setStats(s)
      setCasilleros(result?.data || [])
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

  async function handleMarcarPerdida(c) {
    const ok = await confirmar({
      titulo: '¿Marcar llave como perdida?',
      mensaje: `La llave "${c.numero}"${c.cliente_actual_nombre ? ` (actualmente con ${c.cliente_actual_nombre})` : ''} quedará marcada como perdida y dejará de estar disponible para asignación.`,
      tipo: 'advertencia',
      textoConfirmar: 'Marcar perdida',
    })
    if (!ok) return
    await window.api.casilleros.marcarPerdida(c.id)
    toast.success(`Llave "${c.numero}" marcada como perdida`)
    cargar(page, pageSize, busqueda, filtros)
  }

  function handleModalCreated() {
    setShowModalRango(false)
    cargar(1, pageSize, busqueda, filtros)
    setPage(1)
  }

  const hayFiltrosActivos = filtros.estado !== 'todos' || filtros.desde || filtros.hasta || busqueda

  return (
    <div className="clientes-page" style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 className="titulo-metalico" style={{ marginBottom: 4 }}>Casilleros</h1>
          <p style={{ fontSize: 13, color: 'var(--dim)' }}>Control de llaves de casillero: asignación, devolución e historial</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {puedeGestionar && (
            <button onClick={() => setShowModalRango(true)} className="clientes-glass-btn btn-primary">
              <div className="clientes-glass-bg" />
              <span className="clientes-glass-content"><Plus size={14} /> Alta de llaves</span>
            </button>
          )}
          <button onClick={() => cargar(page, pageSize, busqueda, filtros)} className="clientes-glass-btn btn-secondary" style={{ padding: '8px 12px' }}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content"><RefreshCw size={14} /></span>
          </button>
        </div>
      </div>

      {/* KPIs */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
          <KPICard label="Total llaves" value={stats.total} icon={KeyRound} color="oklch(0.74 0.13 250)" />
          <KPICard label="Disponibles" value={stats.disponibles} icon={KeyRound} color="oklch(0.78 0.16 155)" />
          <KPICard label="Asignadas ahora" value={stats.asignadas} icon={KeyRound} color="oklch(0.82 0.14 75)" />
          <KPICard label="Perdidas" value={stats.perdidas} icon={Ban} color="oklch(0.75 0.18 25)" />
          <KPICard label="No devueltas" value={stats.noDevueltas} icon={AlertTriangle} color="oklch(0.75 0.18 25)" alerta={stats.noDevueltas > 0} />
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
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'oklch(0.88 0.01 250 / .85)', pointerEvents: 'none' }} />
            <input type="text" className="gym-input" placeholder="Buscar número de llave..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{
              paddingLeft: 32, paddingRight: 12, fontSize: 13, height: 36,
              background: 'oklch(0.2 0.02 250 / .5)', border: '1px solid oklch(1 0 0 / .18)', color: 'oklch(0.97 0.01 250)', textShadow: '0 1px 2px rgba(0,0,0,0.6)',
            }} />
          </div>
          <div style={{ minWidth: 170 }}>
            <Select
              value={filtros.estado}
              onChange={v => handleFiltros({ ...filtros, estado: v })}
              options={[
                { value: 'todos', label: 'Todos los estados' },
                { value: 'disponible', label: 'Disponible' },
                { value: 'asignada', label: 'Asignada' },
                { value: 'perdida', label: 'Perdida' },
                { value: 'no_devueltas', label: '⚠ No devueltas' },
              ]}
            />
          </div>
          <input type="date" className="gym-input" value={filtros.desde} onChange={e => handleFiltros({ ...filtros, desde: e.target.value })} style={{ padding: '0 10px', fontSize: 12, height: 36, width: 140 }} title="Desde" />
          <input type="date" className="gym-input" value={filtros.hasta} onChange={e => handleFiltros({ ...filtros, hasta: e.target.value })} style={{ padding: '0 10px', fontSize: 12, height: 36, width: 140 }} title="Hasta" />
          {hayFiltrosActivos && (
            <button onClick={() => { setBusqueda(''); const f = { estado: 'todos', desde: '', hasta: '' }; setFiltros(f); cargar(1, pageSize, '', f) }}
              className="clientes-action-icon" style={{ fontSize: 12, fontWeight: 600 }}>
              <X size={12} /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
        border: '1px solid transparent', borderRadius: 18,
        boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
      }}>
        {cargando ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : casilleros.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'oklch(0.88 0.01 250 / .85)' }}>
            <KeyRound size={40} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
            <p style={{ fontSize: 14, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>No hay llaves con los filtros seleccionados</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  {['Número', 'Estado', 'Cliente actual', 'Última persona', 'Fecha última asignación', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {casilleros.map((c, i) => {
                  const badge = ESTADO_BADGE[c.estado] || ESTADO_BADGE.disponible
                  const noDevuelta = esNoDevuelta(c)
                  return (
                    <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.2) }}
                      style={{
                        borderBottom: '1px solid oklch(1 0 0 / .04)',
                        background: noDevuelta ? 'oklch(0.75 0.18 25 / .1)' : 'transparent',
                        borderLeft: noDevuelta ? '3px solid oklch(0.75 0.18 25)' : '3px solid transparent',
                      }}
                    >
                      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: 'var(--ink)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {noDevuelta && <AlertTriangle size={13} color="oklch(0.75 0.18 25)" title="No devuelta" />}
                          {c.numero}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: badge.bg, color: badge.color, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{badge.label}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--ink)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                        {c.cliente_actual_nombre || <span style={{ color: 'oklch(0.88 0.01 250 / .85)' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                        {c.estado !== 'asignada' ? (c.ultimo_cliente_nombre || <span>—</span>) : <span>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)', whiteSpace: 'nowrap' }}>
                        {fmtFecha(c.ultima_asignacion_fecha)}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {puedeGestionar && c.estado !== 'perdida' && (
                          <button onClick={() => handleMarcarPerdida(c)} title="Marcar perdida" className="clientes-action-icon" style={{ fontSize: 11, fontWeight: 600, color: 'oklch(0.75 0.18 25)' }}>
                            <Ban size={13} color="oklch(0.75 0.18 25)" /> Marcar perdida
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ padding: '0 14px 4px', borderTop: '1px solid var(--line)' }}>
              <Pagination
                page={page} pageSize={pageSize} total={total}
                onPageChange={p => { setPage(p); cargar(p, pageSize, busqueda, filtros) }}
                onPageSizeChange={ps => { setPageSize(ps); setPage(1); cargar(1, ps, busqueda, filtros) }}
                pageSizeOptions={[10, 25, 50]}
              />
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModalRango && (
          <ModalCrearRango onClose={() => setShowModalRango(false)} onCreated={handleModalCreated} />
        )}
      </AnimatePresence>
    </div>
  )
}
