import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Search, Edit2, Trash2, Eye, Users, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import { useApp } from '../context/AppContext'
import { PAGES } from '../constants'
import NuevoClienteWizard from '../components/pos/NuevoClienteWizard'
import { useConfirm } from '../components/ui/ConfirmDialog'

const EMPTY = { carnet: '', nombre: '', apellido: '', telefono: '', email: '', fecha_nacimiento: '' }

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'activos', label: 'Activos' },
  { id: 'por_vencer', label: 'Por vencer' },
  { id: 'vencidos', label: 'Vencidos' },
  { id: 'cumpleanios', label: 'Cumpleaños' },
]

function estaActivo(c) {
  return c.mem_estado === 'activa' && c.vigencia && new Date(c.vigencia) >= new Date()
}

function porVencer(c) {
  if (!estaActivo(c)) return false
  const dias = (new Date(c.vigencia) - new Date()) / 86400000
  return dias <= 7
}

function esCumpleanios(c) {
  if (!c.fecha_nacimiento) return false
  const hoy = new Date()
  const nac = new Date(c.fecha_nacimiento)
  return nac.getMonth() === hoy.getMonth() && Math.abs(nac.getDate() - hoy.getDate()) <= 7
}

export default function Clients() {
  const { navigate } = useApp()
  const [clientes, setClientes] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [renovarClienteId, setRenovarClienteId] = useState(null)
  const confirmar = useConfirm()
  const debounceRef = useRef(null)

  async function cargar(p, ps, b, f) {
    const estado = f !== 'todos' && f !== 'cumpleanios' ? f : undefined
    const result = await window.api.clientes.getPaginated({ page: p, pageSize: ps, busqueda: b || undefined, estado })
    if (result) {
      setClientes(result.data || [])
      setTotal(result.total || 0)
    }
  }

  useEffect(() => { cargar(page, pageSize, busqueda, filtro) }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const newPage = 1
      setPage(newPage)
      cargar(newPage, pageSize, busqueda, filtro)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [busqueda])

  function handleFiltro(f) {
    setFiltro(f)
    setPage(1)
    cargar(1, pageSize, busqueda, f)
  }

  function handlePage(p) {
    setPage(p)
    cargar(p, pageSize, busqueda, filtro)
  }

  function handlePageSize(ps) {
    setPageSize(ps)
    setPage(1)
    cargar(1, ps, busqueda, filtro)
  }

  // cumpleaños filter is client-side only (birthday within 7 days)
  const clientesMostrados = filtro === 'cumpleanios' ? clientes.filter(esCumpleanios) : clientes

  function abrirModal(cliente = null) {
    setEditando(cliente)
    setForm(cliente
      ? { carnet: cliente.carnet, nombre: cliente.nombre, apellido: cliente.apellido, telefono: cliente.telefono || '', email: cliente.email || '', fecha_nacimiento: cliente.fecha_nacimiento || '' }
      : EMPTY)
    setModal(true)
  }

  async function guardar(e) {
    e.preventDefault()
    try {
      if (editando) await window.api.clientes.update(editando.id, form)
      else await window.api.clientes.create(form)
      toast.success(editando ? 'Cliente actualizado' : 'Cliente creado')
      setModal(false)
      cargar(page, pageSize, busqueda, filtro)
    } catch (err) { toast.error(err.message || 'Error al guardar') }
  }

  async function eliminar(id) {
    const ok = await confirmar({ titulo: '¿Eliminar cliente?', mensaje: 'El cliente será movido a la papelera. Puedes restaurarlo desde ahí.', tipo: 'peligro', textoConfirmar: 'Eliminar' })
    if (!ok) return
    await window.api.clientes.delete(id)
    toast.success('Cliente eliminado')
    cargar(page, pageSize, busqueda, filtro)
  }

  const f = (k) => e => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Users size={20} color="oklch(0.66 0.22 25)" />
          <h1 className="titulo-metalico" style={{ margin: 0 }}>Clientes</h1>
        </div>
        <button className="btn-primary" onClick={() => abrirModal()} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Plus size={15} /> Nuevo cliente
        </button>
      </div>

      {/* Búsqueda */}
      <div style={{ position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'oklch(0.78 0.02 250 / .35)', pointerEvents: 'none' }} />
        <input
          className="gym-input"
          placeholder="Buscar por carnet, nombre, teléfono..."
          style={{ paddingLeft: 36, width: '100%' }}
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8 }}>
        {FILTROS.map(fl => (
          <button
            key={fl.id}
            onClick={() => handleFiltro(fl.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
              background: filtro === fl.id ? 'oklch(0.66 0.22 25 / .18)' : 'oklch(0.13 0.01 250 / .6)',
              color: filtro === fl.id ? 'oklch(0.76 0.20 25)' : 'oklch(0.78 0.02 250 / .5)',
              border: `1px solid ${filtro === fl.id ? 'oklch(0.66 0.22 25 / .35)' : 'oklch(1 0 0 / .07)'}`,
              fontWeight: filtro === fl.id ? 600 : 400,
              transition: 'all .15s',
            }}
          >
            {fl.label}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="gym-card" style={{ overflow: 'hidden' }}>
        <table className="gym-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Carnet</th>
              <th>Contacto</th>
              <th>Membresía</th>
              <th>Vencimiento</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientesMostrados.map((c, i) => {
              const activo = estaActivo(c)
              const vence = porVencer(c)
              const cumple = esCumpleanios(c)
              return (
                <motion.tr
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  style={{ cursor: 'default' }}
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: activo ? 'oklch(0.68 0.18 200 / .12)' : 'oklch(1 0 0 / .05)',
                        border: `1px solid ${activo ? 'oklch(0.68 0.18 200 / .3)' : 'oklch(1 0 0 / .08)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700,
                        color: activo ? 'oklch(0.68 0.18 200)' : 'oklch(0.78 0.02 250 / .4)',
                      }}>
                        {(c.nombre?.[0] || '?').toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'oklch(0.92 0.01 250)', fontSize: 13 }}>
                          {c.nombre} {c.apellido}
                          {cumple && <span style={{ marginLeft: 6 }}>🎂</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'oklch(0.78 0.02 250 / .6)' }}>{c.carnet}</td>
                  <td style={{ fontSize: 12, color: 'oklch(0.78 0.02 250 / .55)' }}>{c.telefono || c.email || '—'}</td>
                  <td>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600, letterSpacing: '.06em',
                      background: activo && !vence ? 'oklch(0.78 0.16 155 / .12)' : vence ? 'oklch(0.78 0.18 80 / .12)' : 'oklch(0.66 0.22 25 / .12)',
                      color: activo && !vence ? 'oklch(0.78 0.16 155)' : vence ? 'oklch(0.78 0.18 80)' : 'oklch(0.66 0.22 25)',
                      border: `1px solid ${activo && !vence ? 'oklch(0.78 0.16 155 / .3)' : vence ? 'oklch(0.78 0.18 80 / .3)' : 'oklch(0.66 0.22 25 / .3)'}`,
                    }}>
                      {activo && !vence ? 'Activa' : vence ? 'Por vencer' : 'Vencida'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: vence ? 'oklch(0.78 0.18 80)' : 'oklch(0.78 0.02 250 / .5)' }}>
                    {c.vigencia || '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className="btn-ghost btn-sm"
                        title="Ver perfil"
                        onClick={() => navigate(PAGES.PERFIL_CLIENTE, { clienteId: c.id })}
                        style={{ color: 'oklch(0.68 0.18 200 / .7)' }}
                      >
                        <Eye size={13} />
                      </button>
                      <button className="btn-ghost btn-sm" title="Editar" onClick={() => abrirModal(c)}><Edit2 size={13} /></button>
                      <button
                        className="btn-ghost btn-sm"
                        title={activo && !vence ? 'Renovar anticipado' : vence ? 'Renovar plan' : 'Asignar / renovar plan'}
                        onClick={() => setRenovarClienteId(c.id)}
                        style={{ color: 'oklch(0.78 0.16 155 / .8)' }}
                      >
                        <RefreshCw size={13} />
                      </button>
                      <button className="btn-ghost btn-sm" style={{ color: 'oklch(0.66 0.22 25 / .7)' }} title="Eliminar" onClick={() => eliminar(c.id)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </motion.tr>
              )
            })}
            {clientesMostrados.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 48, color: 'oklch(0.78 0.02 250 / .3)', fontSize: 13 }}>
                  {busqueda ? 'Sin resultados para la búsqueda' : 'Sin clientes en este filtro'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <Pagination
        page={page}
        pageSize={pageSize}
        total={filtro === 'cumpleanios' ? clientesMostrados.length : total}
        onPageChange={handlePage}
        onPageSizeChange={handlePageSize}
      />

      {/* Wizard renovación */}
      <AnimatePresence>
        {renovarClienteId && (
          <NuevoClienteWizard
            mode="renovar"
            clienteId={renovarClienteId}
            onClose={() => { setRenovarClienteId(null); cargar(page, pageSize, busqueda, filtro) }}
          />
        )}
      </AnimatePresence>

      {/* Modal crear/editar */}
      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar cliente' : 'Nuevo cliente'}>
        <form onSubmit={guardar} className="flex flex-col gap-4">
          <div className="form-grid">
            <div><label className="gym-label">Carnet *</label><input className="gym-input" required value={form.carnet} onChange={f('carnet')} placeholder="CI o ID" /></div>
            <div><label className="gym-label">Nombre *</label><input className="gym-input" required value={form.nombre} onChange={f('nombre')} /></div>
            <div><label className="gym-label">Apellido *</label><input className="gym-input" required value={form.apellido} onChange={f('apellido')} /></div>
            <div><label className="gym-label">Teléfono</label><input className="gym-input" value={form.telefono} onChange={f('telefono')} /></div>
            <div><label className="gym-label">Email</label><input className="gym-input" type="email" value={form.email} onChange={f('email')} /></div>
            <div><label className="gym-label">Fecha nacimiento</label><input className="gym-input" type="date" value={form.fecha_nacimiento} onChange={f('fecha_nacimiento')} /></div>
          </div>
          <div className="flex gap-3" style={{ marginTop: 8 }}>
            <button type="button" className="btn-secondary flex-1" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary flex-1">Guardar</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
