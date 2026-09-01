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
import './Clients.css'

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

  // [NUEVO] Advertencia suave (no bloqueante) por dígitos faltantes —
  // CI boliviano válido desde 6 dígitos, celular siempre 8. Solo se
  // muestra con contenido tipeado (un campo vacío no es "le faltan
  // dígitos", es simplemente vacío) — nunca impide guardar, ver
  // guardar() más abajo, que no depende de estos checks.
  const ciFaltanDigitos = form.carnet.trim().length > 0 && form.carnet.trim().length < 6
  const telFaltanDigitos = form.telefono.trim().length > 0 && form.telefono.trim().length < 8

  return (
    <div className="clientes-page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Users size={20} color="oklch(0.66 0.22 25)" />
          <h1 className="titulo-metalico" style={{ margin: 0 }}>Clientes</h1>
        </div>
        <button className="clientes-glass-btn btn-primary" onClick={() => abrirModal()} style={{ fontSize: 13 }}>
          <div className="clientes-glass-bg" />
          <span className="clientes-glass-content">
            <Plus size={15} /> Nuevo cliente
          </span>
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
            className="clientes-glass-btn"
            onClick={() => handleFiltro(fl.id)}
            style={{
              padding: '5px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 12,
              // Sin background propio — pedido explícito de que sea
              // transparente, sin ningún color de fondo. El estado
              // activo/inactivo lo marca solo el color de letra.
              // Antes rojo para el filtro activo — pedido explícito de
              // que al "presionarlo" (seleccionarlo) sea blanco, no rojo.
              background: 'transparent',
              color: filtro === fl.id ? 'oklch(0.97 0.01 250)' : 'oklch(0.88 0.01 250 / .85)',
              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
              fontWeight: filtro === fl.id ? 600 : 400,
              transition: 'all .15s',
            }}
          >
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content">{fl.label}</span>
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="gym-card clientes-glass-table" style={{ overflow: 'hidden' }}>
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
              // Rediseño "premium" del badge de estado — un objeto por
              // fila en vez de repetir el ternario 3 veces (fondo, borde,
              // punto) como estaba antes.
              const estadoBadge = activo && !vence
                ? { color: 'oklch(0.78 0.16 155)', label: 'Activa' }
                : vence
                  ? { color: 'oklch(0.78 0.18 80)', label: 'Por vencer' }
                  : { color: 'oklch(0.66 0.22 25)', label: 'Vencida' }
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
                      {/* Avatar — rediseñado: gradiente + anillo + glow en
                          vez de un tinte plano casi invisible (.12/.05 de
                          alpha antes). */}
                      <div style={{
                        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                        background: activo
                          ? 'linear-gradient(135deg, oklch(0.68 0.18 200 / .40), oklch(0.68 0.18 200 / .16))'
                          : 'linear-gradient(135deg, oklch(1 0 0 / .14), oklch(1 0 0 / .05))',
                        border: `1px solid ${activo ? 'oklch(0.68 0.18 200 / .55)' : 'oklch(1 0 0 / .18)'}`,
                        boxShadow: activo
                          ? 'inset 0 1px 0 rgba(255, 255, 255, .25), 0 0 10px oklch(0.68 0.18 200 / .3)'
                          : 'inset 0 1px 0 rgba(255, 255, 255, .12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 800,
                        color: activo ? 'oklch(0.92 0.09 200)' : 'oklch(0.85 0.02 250)',
                        textShadow: '0 1px 2px rgba(0, 0, 0, .6)',
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
                  {/* Carnet/Contacto — antes alpha .6/.55 (se leían
                      difuminados); pasados a color sólido, sin alpha. La
                      sombra la da la regla .clientes-glass-table .gym-table
                      td en Clients.css, se hereda sola. */}
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'oklch(0.88 0.01 250)' }}>{c.carnet}</td>
                  <td style={{ fontSize: 12, color: 'oklch(0.88 0.01 250)' }}>{c.telefono || c.email || '—'}</td>
                  <td>
                    {/* Badge de estado — rediseño "premium": pill
                        (borderRadius:999) + gradiente en vez de tinte
                        plano + punto con glow + halo/inset de vidrio,
                        en vez del recuadro chato de antes. */}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px 4px 8px', borderRadius: 999,
                      fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                      background: `linear-gradient(135deg, ${estadoBadge.color.replace(')', ' / .32)')}, ${estadoBadge.color.replace(')', ' / .10)')})`,
                      color: estadoBadge.color,
                      border: `1px solid ${estadoBadge.color.replace(')', ' / .5)')}`,
                      boxShadow: `inset 0 1px 0 rgba(255, 255, 255, .18), 0 0 10px ${estadoBadge.color.replace(')', ' / .25)')}`,
                      textShadow: '0 1px 2px rgba(0, 0, 0, .6)',
                    }}>
                      <span style={{
                        width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                        background: estadoBadge.color,
                        boxShadow: `0 0 6px ${estadoBadge.color}`,
                      }} />
                      {estadoBadge.label}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: vence ? 'oklch(0.78 0.18 80)' : 'oklch(0.88 0.01 250)' }}>
                    {c.vigencia || '—'}
                  </td>
                  <td>
                    {/* [ÍCONOS DE ACCIÓN — pedido explícito, "no deben ser
                        como botones"] Se saca .clientes-glass-btn/
                        .clientes-glass-bg (vidrio/marco) — quedan sueltos,
                        sin fondo ni borde. .clientes-action-icon
                        (Clients.css) les da el mismo tipo de movimiento
                        (rebote al pasar/tocar) que tenían los botones,
                        más filter:drop-shadow propio (SVG, no texto —
                        text-shadow no les hace nada) y color sólido sin
                        alpha (antes /.7-.8, "más fuerte su color sin
                        opacidad"). */}
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button
                        className="clientes-action-icon"
                        title="Ver perfil"
                        onClick={() => navigate(PAGES.PERFIL_CLIENTE, { clienteId: c.id })}
                        style={{ color: 'oklch(0.68 0.18 200)' }}
                      >
                        <Eye size={15} />
                      </button>
                      <button className="clientes-action-icon" title="Editar" onClick={() => abrirModal(c)} style={{ color: 'oklch(0.92 0.01 250)' }}>
                        <Edit2 size={15} />
                      </button>
                      <button
                        className="clientes-action-icon"
                        title={activo && !vence ? 'Renovar anticipado' : vence ? 'Renovar plan' : 'Asignar / renovar plan'}
                        onClick={() => setRenovarClienteId(c.id)}
                        style={{ color: 'oklch(0.78 0.16 155)' }}
                      >
                        <RefreshCw size={15} />
                      </button>
                      <button className="clientes-action-icon" title="Eliminar" onClick={() => eliminar(c.id)} style={{ color: 'oklch(0.75 0.20 25)' }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              )
            })}
            {clientesMostrados.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 48, color: 'oklch(0.88 0.01 250 / .85)', fontSize: 13, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
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
            <div>
              <label className="gym-label">Carnet *</label>
              <input className="gym-input" required value={form.carnet} onChange={f('carnet')} placeholder="CI o ID" />
              {ciFaltanDigitos && (
                <span style={{ color: '#eab308', fontSize: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ⚠ Ojo, te faltan dígitos
                </span>
              )}
            </div>
            <div><label className="gym-label">Nombre *</label><input className="gym-input" required value={form.nombre} onChange={f('nombre')} /></div>
            <div><label className="gym-label">Apellido *</label><input className="gym-input" required value={form.apellido} onChange={f('apellido')} /></div>
            <div>
              <label className="gym-label">Teléfono</label>
              <input className="gym-input" value={form.telefono} onChange={f('telefono')} />
              {telFaltanDigitos && (
                <span style={{ color: '#eab308', fontSize: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ⚠ Ojo, te faltan dígitos
                </span>
              )}
            </div>
            <div><label className="gym-label">Email</label><input className="gym-input" type="email" value={form.email} onChange={f('email')} /></div>
            <div><label className="gym-label">Fecha nacimiento</label><input className="gym-input" type="date" value={form.fecha_nacimiento} onChange={f('fecha_nacimiento')} /></div>
          </div>
          <div className="flex gap-3" style={{ marginTop: 8 }}>
            <button type="button" className="clientes-glass-btn btn-secondary flex-1" onClick={() => setModal(false)}>
              <div className="clientes-glass-bg" />
              <span className="clientes-glass-content">Cancelar</span>
            </button>
            <button type="submit" className="clientes-glass-btn btn-primary flex-1">
              <div className="clientes-glass-bg" />
              <span className="clientes-glass-content">Guardar</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
