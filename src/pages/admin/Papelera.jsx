import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Archive, Trash2, RotateCcw, Users, CreditCard, Package, RefreshCw, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import '../Clients.css'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtMoney(n) { return 'Bs. ' + Number(n || 0).toFixed(2) }

const TABS = [
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'planes', label: 'Planes', icon: CreditCard },
  { id: 'productos', label: 'Productos', icon: Package },
]

// ─── Fila de elemento ─────────────────────────────────────────────────────────

function FilaEliminado({ children, onRestaurar, onEliminar }) {
  const [confirmando, setConfirmando] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      style={{
        position: 'relative',
        background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
        border: '1px solid transparent',
        borderLeft: '3px solid oklch(0.66 0.22 25 / .6)',
        borderRadius: 10, padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .07), 0 0 10px 1px oklch(1 0 0 / .04), 0 14px 34px oklch(0 0 0 / .35)',
        textShadow: '0 1px 2px rgba(0,0,0,0.6)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
        <button
          onClick={onRestaurar}
          title="Restaurar"
          className="clientes-glass-btn"
          style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 999 }}
        >
          <div className="clientes-glass-bg" />
          <span className="clientes-glass-content" style={{ color: 'oklch(0.78 0.16 155)' }}><RotateCcw size={12} /> Restaurar</span>
        </button>
        {!confirmando ? (
          <button
            onClick={() => setConfirmando(true)}
            title="Eliminar permanentemente"
            className="clientes-action-icon"
          >
            <Trash2 size={13} color="oklch(0.75 0.18 25)" />
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'oklch(0.75 0.18 25)', whiteSpace: 'nowrap' }}>¿Confirmar?</span>
            <button
              onClick={() => { onEliminar(); setConfirmando(false) }}
              className="clientes-glass-btn"
              style={{ padding: '5px 12px', fontSize: 11, fontWeight: 700, borderRadius: 999 }}
            >
              <div className="clientes-glass-bg" />
              <span className="clientes-glass-content" style={{ color: 'oklch(0.75 0.18 25)' }}>Sí</span>
            </button>
            <button
              onClick={() => setConfirmando(false)}
              className="clientes-glass-btn"
              style={{ padding: '5px 12px', fontSize: 11, borderRadius: 999 }}
            >
              <div className="clientes-glass-bg" />
              <span className="clientes-glass-content" style={{ color: 'oklch(0.88 0.01 250 / .85)' }}>No</span>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Tab Clientes ─────────────────────────────────────────────────────────────

function TabClientes({ onRefresh }) {
  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    const d = await window.api.papelera.getClientes()
    setItems(d || [])
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function restaurar(id) {
    await window.api.papelera.restaurarCliente(id)
    toast.success('Cliente restaurado')
    cargar(); onRefresh()
  }

  async function eliminar(id) {
    await window.api.papelera.eliminarPermanenteCliente(id)
    toast.success('Cliente eliminado permanentemente')
    cargar(); onRefresh()
  }

  if (cargando) return <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
  if (items.length === 0) return (
    <div style={{ textAlign: 'center', padding: 48, color: 'var(--dim)' }}>
      <Users size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: .3 }} />
      <p>No hay clientes eliminados</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <AnimatePresence>
        {items.map(c => (
          <FilaEliminado key={c.id} onRestaurar={() => restaurar(c.id)} onEliminar={() => eliminar(c.id)}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{c.nombre} {c.apellido}</div>
            <div style={{ fontSize: 12, color: 'oklch(0.88 0.01 250 / .85)' }}>
              CI: {c.carnet} · {c.telefono || 'Sin teléfono'} · {c.plan_nombre || 'Sin plan'}
            </div>
          </FilaEliminado>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ─── Tab Planes ───────────────────────────────────────────────────────────────

function TabPlanes({ onRefresh }) {
  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    const d = await window.api.papelera.getPlanes()
    setItems(d || [])
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function restaurar(id) {
    await window.api.papelera.restaurarPlan(id)
    toast.success('Plan restaurado')
    cargar(); onRefresh()
  }

  async function eliminar(id) {
    await window.api.papelera.eliminarPermanentePlan(id)
    toast.success('Plan eliminado permanentemente')
    cargar(); onRefresh()
  }

  if (cargando) return <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
  if (items.length === 0) return (
    <div style={{ textAlign: 'center', padding: 48, color: 'var(--dim)' }}>
      <CreditCard size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: .3 }} />
      <p>No hay planes eliminados</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <AnimatePresence>
        {items.map(p => (
          <FilaEliminado key={p.id} onRestaurar={() => restaurar(p.id)} onEliminar={() => eliminar(p.id)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {p.color && <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, flexShrink: 0 }} />}
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{p.nombre}</span>
            </div>
            <div style={{ fontSize: 12, color: 'oklch(0.88 0.01 250 / .85)' }}>
              {p.duracion_dias} días · {fmtMoney(p.precio)}
            </div>
          </FilaEliminado>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ─── Tab Productos ────────────────────────────────────────────────────────────

function TabProductos({ onRefresh }) {
  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    const d = await window.api.papelera.getProductos()
    setItems(d || [])
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function restaurar(id) {
    await window.api.papelera.restaurarProducto(id)
    toast.success('Producto restaurado')
    cargar(); onRefresh()
  }

  async function eliminar(id) {
    await window.api.papelera.eliminarPermanenteProducto(id)
    toast.success('Producto eliminado permanentemente')
    cargar(); onRefresh()
  }

  if (cargando) return <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
  if (items.length === 0) return (
    <div style={{ textAlign: 'center', padding: 48, color: 'var(--dim)' }}>
      <Package size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: .3 }} />
      <p>No hay productos eliminados</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <AnimatePresence>
        {items.map(p => (
          <FilaEliminado key={p.id} onRestaurar={() => restaurar(p.id)} onEliminar={() => eliminar(p.id)}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{p.nombre}</div>
            <div style={{ fontSize: 12, color: 'oklch(0.88 0.01 250 / .85)' }}>
              {p.categoria_nombre || 'Sin categoría'} · {fmtMoney(p.precio_venta)} · Stock: {p.stock}
              {p.eliminado_at && ` · Eliminado: ${fmtDate(p.eliminado_at)}`}
            </div>
          </FilaEliminado>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Papelera() {
  const [tab, setTab] = useState('clientes')
  const [resumen, setResumen] = useState({ clientes: 0, planes: 0, productos: 0, total: 0 })
  const [rev, setRev] = useState(0)

  const cargarResumen = useCallback(async () => {
    const r = await window.api.papelera.getResumen()
    setResumen(r || { clientes: 0, planes: 0, productos: 0, total: 0 })
  }, [])

  useEffect(() => { cargarResumen() }, [cargarResumen, rev])

  const onRefresh = useCallback(() => setRev(r => r + 1), [])

  return (
    <div className="clientes-page" style={{ padding: '0 2px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 className="titulo-metalico" style={{ marginBottom: 6 }}>PAPELERA</h1>
          <p style={{ fontSize: 13, color: 'var(--dim)' }}>
            {resumen.total} elemento{resumen.total !== 1 ? 's' : ''} eliminado{resumen.total !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={onRefresh} className="clientes-glass-btn btn-secondary" style={{ fontSize: 12 }}>
          <div className="clientes-glass-bg" />
          <span className="clientes-glass-content"><RefreshCw size={13} /> Actualizar</span>
        </button>
      </div>

      {/* Aviso */}
      {resumen.total > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{
            background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
            border: '1px solid transparent', borderLeft: '3px solid oklch(0.82 0.14 75)',
            borderRadius: 10, padding: '10px 16px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .07), 0 0 10px 1px oklch(1 0 0 / .04), 0 14px 34px oklch(0 0 0 / .35)',
          }}
        >
          <AlertTriangle size={15} color="oklch(0.82 0.14 75)" />
          <span style={{ fontSize: 12, color: 'oklch(0.90 0.10 75)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
            Los elementos eliminados pueden restaurarse. La eliminación permanente no puede deshacerse.
          </span>
        </motion.div>
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 20,
        background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#top-clientes-glass)', WebkitBackdropFilter: 'url(#top-clientes-glass)',
        border: '1px solid transparent', borderRadius: 10, padding: 4,
        boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
      }}>
        {TABS.map(t => {
          const Icon = t.icon
          const count = resumen[t.id] || 0
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                background: active ? 'oklch(1 0 0 / .1)' : 'transparent',
                border: active ? '1px solid oklch(1 0 0 / .22)' : '1px solid transparent',
                color: active ? 'oklch(0.97 0.01 250)' : 'var(--dim)',
                textShadow: active ? '0 1px 2px oklch(0 0 0 / .6)' : 'none',
                cursor: 'pointer', transition: 'all .2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Icon size={13} /> {t.label}
              {count > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, background: active ? 'oklch(0.66 0.22 25 / .3)' : 'oklch(0.66 0.22 25 / .15)', color: 'oklch(0.85 0.12 25)', padding: '1px 6px', borderRadius: 8, marginLeft: 2 }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Contenido */}
      <AnimatePresence mode="wait">
        <motion.div key={`${tab}-${rev}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {tab === 'clientes' && <TabClientes onRefresh={onRefresh} />}
          {tab === 'planes' && <TabPlanes onRefresh={onRefresh} />}
          {tab === 'productos' && <TabProductos onRefresh={onRefresh} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
