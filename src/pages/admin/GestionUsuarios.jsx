import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Shield, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Key, Search, ChevronRight, Check, Camera } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { auditoriaService, ACCIONES } from '../../services/auditoriaService'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import '../Clients.css'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resizarBase64(dataUrl, maxPx = 300) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxPx || height > maxPx) {
        const ratio = Math.min(maxPx / width, maxPx / height)
        width = Math.floor(width * ratio)
        height = Math.floor(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

function avatarColor(nombre = '') {
  const COLORS = [
    'oklch(0.60 0.18 25)', 'oklch(0.55 0.20 250)', 'oklch(0.58 0.17 155)',
    'oklch(0.62 0.15 75)', 'oklch(0.57 0.19 300)', 'oklch(0.60 0.16 200)',
  ]
  let h = 0
  for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) & 0xffffffff
  return COLORS[Math.abs(h) % COLORS.length]
}

function UserAvatar({ foto, nombre, size = 32 }) {
  const iniciales = (nombre || '?').trim().split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
  if (foto) {
    return (
      <img
        src={foto}
        alt={nombre}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid oklch(1 0 0 / .15)', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: avatarColor(nombre),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, color: 'white',
      fontFamily: 'Oxanium, sans-serif', letterSpacing: '.04em',
    }}>
      {iniciales}
    </div>
  )
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className="clientes-action-icon"
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 20px',
        background: active ? 'oklch(1 0 0 / .1)' : 'transparent',
        border: active ? '1px solid oklch(1 0 0 / .22)' : '1px solid transparent',
        borderRadius: 999,
        color: active ? 'oklch(0.97 0.01 250)' : 'var(--dim)',
        textShadow: active ? '0 1px 2px oklch(0 0 0 / .6)' : 'none',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: active ? 700 : 400,
        letterSpacing: '.04em',
        transition: 'all .15s',
      }}
    >
      <Icon size={15} />
      {children}
    </button>
  )
}

function Badge({ children, color = 'muted' }) {
  const colors = {
    green: { bg: 'oklch(0.78 0.16 155 / .15)', border: 'oklch(0.78 0.16 155 / .3)', text: 'oklch(0.78 0.16 155)' },
    red: { bg: 'oklch(0.66 0.22 25 / .15)', border: 'oklch(0.66 0.22 25 / .3)', text: 'oklch(0.70 0.18 25)' },
    blue: { bg: 'oklch(0.74 0.13 250 / .15)', border: 'oklch(0.74 0.13 250 / .3)', text: 'oklch(0.74 0.13 250)' },
    muted: { bg: 'oklch(0.78 0.02 250 / .1)', border: 'oklch(0.78 0.02 250 / .2)', text: 'oklch(0.78 0.02 250 / .7)' },
  }
  const c = colors[color] || colors.muted
  return (
    <span style={{
      padding: '2px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '.06em',
      background: c.bg,
      border: `1px solid ${c.border}`,
      color: c.text,
      textTransform: 'uppercase',
      textShadow: '0 1px 2px rgba(0,0,0,0.6)',
    }}>
      {children}
    </span>
  )
}

// ─── Modal Usuario ─────────────────────────────────────────────────────────────

function ModalUsuario({ usuario, roles, onGuardar, onCerrar }) {
  const esEdicion = !!usuario?.id
  const esAdmin = usuario?.username === 'admin'
  const [form, setForm] = useState({
    username: usuario?.username || '',
    nombre_completo: usuario?.nombre_completo || '',
    email: usuario?.email || '',
    telefono: usuario?.telefono || '',
    carnet: usuario?.carnet || '',
    foto: usuario?.foto || null,
    rol_id: usuario?.rol_id || (roles[0]?.id || ''),
    password: '',
    confirmar: '',
    activo: usuario?.activo ?? 1,
  })
  const [cambiandoImg, setCambiandoImg] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function seleccionarFoto() {
    setCambiandoImg(true)
    try {
      const r = await window.api.inventario.pickImage()
      if (r?.dataUrl) {
        const resized = await resizarBase64(r.dataUrl, 300)
        set('foto', resized)
      }
    } catch { toast.error('No se pudo cargar la imagen') }
    finally { setCambiandoImg(false) }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.username.trim() || !form.nombre_completo.trim()) { toast.error('Usuario y nombre son obligatorios'); return }
    if (!esEdicion) {
      if (!form.password) { toast.error('Ingresa una contraseña'); return }
      if (form.password !== form.confirmar) { toast.error('Las contraseñas no coinciden'); return }
      if (form.password.length < 6) { toast.error('Mínimo 6 caracteres'); return }
    }
    await onGuardar(form)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'oklch(0 0 0 / .7)', backdropFilter: 'blur(4px)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
        style={{
          width: '100%', maxWidth: 480,
          background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
          border: '1px solid transparent', borderRadius: 16, padding: '28px 28px 24px',
          boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
          margin: 16, maxHeight: '90vh', overflowY: 'auto',
        }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700, color: 'oklch(0.98 0.01 250)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
          {esEdicion ? 'Editar Usuario' : 'Nuevo Usuario'}
        </h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Foto de perfil */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
            <div style={{ position: 'relative' }}>
              <UserAvatar foto={form.foto} nombre={form.nombre_completo || 'U'} size={64} />
              <button
                type="button"
                onClick={seleccionarFoto}
                disabled={cambiandoImg}
                className="clientes-glass-btn"
                title="Cambiar foto"
                style={{
                  position: 'absolute', bottom: -4, right: -4,
                  width: 22, height: 22, borderRadius: '50%',
                  border: '1px solid oklch(0.66 0.22 25 / .5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', padding: 0,
                }}
              >
                <div className="clientes-glass-bg" style={{ borderRadius: '50%' }} />
                <span className="clientes-glass-content">
                  <Camera size={11} color="oklch(0.75 0.20 25)" />
                </span>
              </button>
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'oklch(0.88 0.01 250 / .85)', fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                {form.nombre_completo || 'Nuevo usuario'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>
                Haz clic en la foto para cambiarla
              </div>
              {form.foto && (
                <button type="button" onClick={() => set('foto', null)} className="clientes-action-icon" style={{ fontSize: 11, color: 'oklch(0.65 0.22 25)', padding: 0, marginTop: 2, justifyContent: 'flex-start' }}>
                  Quitar foto
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Usuario *</label>
              <input className="gym-input" value={form.username} onChange={e => set('username', e.target.value)} placeholder="nombre_usuario" style={{ width: '100%' }} />
            </div>
            <div>
              <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Rol *</label>
              {esAdmin ? (
                <div className="gym-input" style={{ width: '100%', color: 'var(--dim)', cursor: 'not-allowed' }}>
                  Administrador <span style={{ fontSize: 10 }}>(fijo)</span>
                </div>
              ) : (
                <select className="gym-select" value={form.rol_id} onChange={e => set('rol_id', Number(e.target.value))} style={{ width: '100%' }}>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              )}
            </div>
          </div>
          <div>
            <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Nombre completo *</label>
            <input className="gym-input" value={form.nombre_completo} onChange={e => set('nombre_completo', e.target.value)} placeholder="Nombre Apellido" style={{ width: '100%' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Carnet / CI</label>
              <input className="gym-input" value={form.carnet} onChange={e => set('carnet', e.target.value)} placeholder="CI del usuario" style={{ width: '100%' }} />
            </div>
            <div>
              <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Teléfono</label>
              <input className="gym-input" value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="7XXXXXXX" style={{ width: '100%' }} />
            </div>
          </div>
          <div>
            <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Email</label>
            <input className="gym-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="correo@ejemplo.com" style={{ width: '100%' }} />
          </div>
          {!esEdicion && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Contraseña *</label>
                <input className="gym-input" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="mín. 6 caracteres" style={{ width: '100%' }} />
              </div>
              <div>
                <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Confirmar *</label>
                <input className="gym-input" type="password" value={form.confirmar} onChange={e => set('confirmar', e.target.value)} placeholder="repetir" style={{ width: '100%' }} />
              </div>
            </div>
          )}
          {!esAdmin && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', fontSize: 13, color: 'oklch(0.78 0.02 250 / .8)' }}>
              <input type="checkbox" checked={form.activo === 1} onChange={e => set('activo', e.target.checked ? 1 : 0)} />
              Usuario activo
            </label>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" className="clientes-glass-btn btn-secondary" onClick={onCerrar} style={{ flex: 1 }}>
              <div className="clientes-glass-bg" />
              <span className="clientes-glass-content">Cancelar</span>
            </button>
            <button type="submit" className="clientes-glass-btn btn-primary" style={{ flex: 2, fontSize: 13 }}>
              <div className="clientes-glass-bg" />
              <span className="clientes-glass-content">{esEdicion ? 'Guardar cambios' : 'Crear usuario'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Tab Usuarios ──────────────────────────────────────────────────────────────

function TabUsuarios({ roles }) {
  const [lista, setLista] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('')
  const [modal, setModal] = useState(null) // null | {usuario}
  const { usuario: usuarioActual } = useAuth()
  const confirmar = useConfirm()

  const cargar = useCallback(async () => {
    const data = await window.api.usuarios.getAll()
    setLista(data)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const filtrados = lista.filter(u => {
    const ok1 = !busqueda || u.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) || u.username.toLowerCase().includes(busqueda.toLowerCase())
    const ok2 = !filtroRol || String(u.rol_id) === filtroRol
    return ok1 && ok2
  })

  async function handleGuardar(form) {
    try {
      if (modal?.usuario) {
        await window.api.usuarios.update(modal.usuario.id, form)
        await auditoriaService.log(ACCIONES.USUARIO_EDITADO, 'usuarios', `Usuario ${form.username} editado`, modal.usuario.id, 'usuario')
        toast.success('Usuario actualizado')
      } else {
        await window.api.usuarios.create(form)
        await auditoriaService.log(ACCIONES.USUARIO_CREADO, 'usuarios', `Usuario ${form.username} creado`)
        toast.success('Usuario creado')
      }
      setModal(null)
      cargar()
    } catch {
      toast.error('Error al guardar usuario')
    }
  }

  async function toggleActivo(u) {
    const nuevoActivo = u.activo ? 0 : 1
    const r = await window.api.usuarios.setActivo(u.id, nuevoActivo)
    if (!r.ok) { toast.error(r.error || 'No se pudo cambiar el estado'); return }
    await auditoriaService.log(
      nuevoActivo ? ACCIONES.USUARIO_ACTIVADO : ACCIONES.USUARIO_DESACTIVADO,
      'usuarios', `Usuario ${u.username} ${nuevoActivo ? 'activado' : 'desactivado'}`, u.id, 'usuario'
    )
    toast.success(`Usuario ${nuevoActivo ? 'activado' : 'desactivado'}`)
    cargar()
  }

  async function handleEliminar(u) {
    if (u.username === 'admin') { toast.error('No se puede eliminar el admin principal'); return }
    const ok = await confirmar({ titulo: '¿Eliminar usuario?', mensaje: `"${u.nombre_completo}" (${u.username}) será eliminado permanentemente.`, tipo: 'peligro', textoConfirmar: 'Eliminar' })
    if (!ok) return
    const r = await window.api.usuarios.delete(u.id)
    if (r.ok) {
      await auditoriaService.log(ACCIONES.USUARIO_ELIMINADO, 'usuarios', `Usuario ${u.username} eliminado`, u.id, 'usuario')
      toast.success('Usuario eliminado')
      cargar()
    } else {
      toast.error(r.error || 'No se pudo eliminar')
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'oklch(0.88 0.01 250 / .85)', pointerEvents: 'none' }} />
          <input
            className="gym-input"
            placeholder="Buscar usuario..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{
              paddingLeft: 34, width: '100%',
              background: 'oklch(0.2 0.02 250 / .5)', border: '1px solid oklch(1 0 0 / .18)', color: 'oklch(0.97 0.01 250)', textShadow: '0 1px 2px rgba(0,0,0,0.6)',
            }}
          />
        </div>
        <select className="gym-select" value={filtroRol} onChange={e => setFiltroRol(e.target.value)} style={{ minWidth: 140 }}>
          <option value="">Todos los roles</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>
        <button className="clientes-glass-btn btn-primary btn-sm" onClick={() => setModal({ usuario: null })} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="clientes-glass-bg" />
          <span className="clientes-glass-content"><Plus size={14} /> Nuevo Usuario</span>
        </button>
      </div>

      {/* Tabla */}
      <div style={{
        overflowX: 'auto',
        background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
        border: '1px solid transparent', borderRadius: 14,
        boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
      }}>
        <table className="gym-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>Usuario</th>
              <th style={{ color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>Nombre</th>
              <th style={{ color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>Rol</th>
              <th style={{ color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>Último Login</th>
              <th style={{ color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>Estado</th>
              <th style={{ textAlign: 'right', color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map(u => (
              <tr key={u.id}>
                <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>@{u.username}</td>
                <td style={{ fontWeight: 500, color: 'var(--ink)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <UserAvatar foto={u.foto} nombre={u.nombre_completo} size={30} />
                    {u.nombre_completo}
                  </div>
                </td>
                <td><Badge color={u.rol_nombre === 'Administrador' ? 'red' : u.rol_nombre === 'Empleado' ? 'blue' : 'muted'}>{u.rol_nombre}</Badge></td>
                <td style={{ fontSize: 12, color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{u.ultimo_login ? new Date(u.ultimo_login).toLocaleString('es-BO') : '—'}</td>
                <td><Badge color={u.activo ? 'green' : 'red'}>{u.activo ? 'Activo' : 'Inactivo'}</Badge></td>
                <td>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                    <button className="clientes-action-icon" onClick={() => setModal({ usuario: u })} title="Editar">
                      <Edit2 size={13} />
                    </button>
                    <button className="clientes-action-icon" onClick={() => toggleActivo(u)} title={u.activo ? 'Desactivar' : 'Activar'}>
                      {u.activo ? <ToggleRight size={13} color="oklch(0.78 0.16 155)" /> : <ToggleLeft size={13} />}
                    </button>
                    {u.username !== 'admin' && u.id !== usuarioActual?.id && (
                      <button className="clientes-action-icon" onClick={() => handleEliminar(u)} title="Eliminar">
                        <Trash2 size={13} color="oklch(0.66 0.22 25)" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--dim)', padding: 32 }}>No hay usuarios</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {modal !== null && (
          <ModalUsuario usuario={modal.usuario} roles={roles} onGuardar={handleGuardar} onCerrar={() => setModal(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Checkbox custom ──────────────────────────────────────────────────────────

// Solo display — el onClick está en la fila padre para evitar doble-trigger
function CustomCheckbox({ checked }) {
  return (
    <div
      style={{
        width: 20, height: 20, borderRadius: 4, flexShrink: 0,
        border: `1.5px solid ${checked ? 'oklch(0.70 0.18 25)' : 'oklch(0.78 0.02 250 / .35)'}`,
        background: checked ? 'oklch(0.66 0.22 25)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .15s',
        pointerEvents: 'none',
      }}
    >
      {checked && <Check size={12} color="white" strokeWidth={3} />}
    </div>
  )
}

// ─── Tab Roles y Permisos ──────────────────────────────────────────────────────

function TabRoles() {
  const [roles, setRoles] = useState([])
  const [rolSeleccionado, setRolSeleccionado] = useState(null)
  const [permisosRol, setPermisosRol] = useState([])
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [originalSet, setOriginalSet] = useState(new Set())
  const [modalRol, setModalRol] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const confirmar = useConfirm()

  const hayCambios = useMemo(() => {
    if (seleccionados.size !== originalSet.size) return true
    for (const id of seleccionados) if (!originalSet.has(id)) return true
    return false
  }, [seleccionados, originalSet])

  const cargarRoles = useCallback(async () => {
    const data = await window.api.roles.getAll()
    setRoles(data)
    if (!rolSeleccionado && data.length > 0) setRolSeleccionado(data[0])
  }, [rolSeleccionado])

  useEffect(() => { cargarRoles() }, [])

  useEffect(() => {
    if (!rolSeleccionado) return
    setBusqueda('')
    window.api.roles.getPermisos(rolSeleccionado.id).then(data => {
      setPermisosRol(data)
      const set = new Set(data.filter(p => p.asignado).map(p => p.id))
      setSeleccionados(set)
      setOriginalSet(new Set(set))
    })
  }, [rolSeleccionado])

  const porModulo = useMemo(() => {
    const q = busqueda.toLowerCase()
    return permisosRol.reduce((acc, p) => {
      if (q && !p.nombre.toLowerCase().includes(q) && !p.codigo.toLowerCase().includes(q)) return acc
      if (!acc[p.modulo]) acc[p.modulo] = []
      acc[p.modulo].push(p)
      return acc
    }, {})
  }, [permisosRol, busqueda])

  function togglePermiso(id) {
    setSeleccionados(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function toggleModulo(perms, todos) {
    setSeleccionados(s => {
      const n = new Set(s)
      if (todos) perms.forEach(p => n.delete(p.id))
      else perms.forEach(p => n.add(p.id))
      return n
    })
  }

  async function guardarPermisos() {
    if (!rolSeleccionado) return
    setGuardando(true)
    try {
      await window.api.roles.setPermisos(rolSeleccionado.id, Array.from(seleccionados))
      await auditoriaService.log(ACCIONES.PERMISOS_MODIFICADOS, 'roles', `Permisos del rol ${rolSeleccionado.nombre} modificados`, rolSeleccionado.id, 'rol')
      toast.success('Permisos guardados')
      setOriginalSet(new Set(seleccionados))
    } catch {
      toast.error('Error al guardar permisos')
    } finally {
      setGuardando(false)
    }
  }

  async function handleGuardarRol(form) {
    try {
      if (modalRol?.rol) {
        await window.api.roles.update(modalRol.rol.id, form)
        await auditoriaService.log(ACCIONES.ROL_EDITADO, 'roles', `Rol ${form.nombre} editado`, modalRol.rol.id, 'rol')
        toast.success('Rol actualizado')
      } else {
        await window.api.roles.create(form)
        await auditoriaService.log(ACCIONES.ROL_CREADO, 'roles', `Rol ${form.nombre} creado`)
        toast.success('Rol creado')
      }
      setModalRol(null)
      cargarRoles()
    } catch {
      toast.error('Error al guardar rol')
    }
  }

  async function handleEliminarRol(rol) {
    if (rol.es_sistema) { toast.error('No se puede eliminar un rol del sistema'); return }
    const ok = await confirmar({ titulo: '¿Eliminar rol?', mensaje: `El rol "${rol.nombre}" será eliminado. Los usuarios con este rol quedarán sin rol.`, tipo: 'advertencia', textoConfirmar: 'Eliminar' })
    if (!ok) return
    const r = await window.api.roles.delete(rol.id)
    if (r.ok) {
      await auditoriaService.log(ACCIONES.ROL_ELIMINADO, 'roles', `Rol ${rol.nombre} eliminado`, rol.id, 'rol')
      toast.success('Rol eliminado')
      setRolSeleccionado(null)
      cargarRoles()
    } else {
      toast.error(r.error || 'No se pudo eliminar')
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, minHeight: 400, position: 'relative' }}>

      {/* ── Panel izquierdo: roles ──────────────────────────────────────────── */}
      <div style={{
        background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
        border: '1px solid transparent',
        borderRadius: 14,
        padding: '16px 12px',
        display: 'flex', flexDirection: 'column', gap: 6,
        alignSelf: 'start',
        boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
      }}>
        <div style={{ fontSize: 11, letterSpacing: '.1em', color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 4 }}>
          Roles del sistema
        </div>

        {roles.map(r => {
          const activo = rolSeleccionado?.id === r.id
          return (
            <button
              key={r.id}
              onClick={() => setRolSeleccionado(r)}
              className="clientes-action-icon"
              style={{
                width: '100%', textAlign: 'left',
                padding: '10px 14px', borderRadius: 10,
                background: activo ? 'oklch(1 0 0 / .1)' : 'transparent',
                border: activo ? '1px solid oklch(1 0 0 / .22)' : '1px solid transparent',
                color: activo ? 'oklch(0.97 0.01 250)' : 'var(--dim)',
                textShadow: activo ? '0 1px 2px oklch(0 0 0 / .6)' : 'none',
                cursor: 'pointer', fontSize: 13, fontWeight: activo ? 700 : 500,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'all .15s',
              }}
            >
              <span>{r.nombre}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {r.total_usuarios > 0 && (
                  <span style={{
                    fontSize: 10, background: 'oklch(1 0 0 / .1)',
                    padding: '1px 7px', borderRadius: 10, color: 'oklch(0.88 0.01 250 / .85)',
                    fontFamily: 'Oxanium, sans-serif', fontWeight: 700,
                  }}>{r.total_usuarios}</span>
                )}
                {activo && <ChevronRight size={13} />}
              </div>
            </button>
          )
        })}

        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
          <button
            className="clientes-glass-btn btn-secondary btn-sm"
            onClick={() => setModalRol({ rol: null })}
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', fontSize: 12 }}
          >
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content"><Plus size={12} /> Nuevo Rol</span>
          </button>
          {rolSeleccionado && !rolSeleccionado.es_sistema && (
            <button
              className="clientes-action-icon"
              onClick={() => setModalRol({ rol: rolSeleccionado })}
              title="Editar rol"
            >
              <Edit2 size={12} />
            </button>
          )}
          {rolSeleccionado && !rolSeleccionado.es_sistema && (
            <button
              className="clientes-action-icon"
              onClick={() => handleEliminarRol(rolSeleccionado)}
              title="Eliminar rol"
              style={{ color: 'oklch(0.70 0.18 25)' }}
            >
              <Trash2 size={12} color="oklch(0.70 0.18 25)" />
            </button>
          )}
        </div>
      </div>

      {/* ── Panel derecho: permisos ─────────────────────────────────────────── */}
      <div>
        {rolSeleccionado ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Cabecera del rol */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h4 className="silver" style={{ margin: 0, fontSize: 16, fontWeight: 700, fontFamily: 'Oxanium, sans-serif', letterSpacing: '.06em', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                  {rolSeleccionado.nombre.toUpperCase()}
                </h4>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                  {seleccionados.size} de {permisosRol.length} permisos asignados
                  {rolSeleccionado.es_sistema && ' · Rol del sistema'}
                </p>
              </div>
            </div>

            {/* Buscador de permisos */}
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'oklch(0.88 0.01 250 / .85)', pointerEvents: 'none' }} />
              <input
                className="gym-input"
                placeholder="Buscar permiso..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                style={{
                  paddingLeft: 34, width: '100%',
                  background: 'oklch(0.2 0.02 250 / .5)', border: '1px solid oklch(1 0 0 / .18)', color: 'oklch(0.97 0.01 250)', textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                }}
              />
            </div>

            {/* Módulos con permisos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 520, overflowY: 'auto', paddingRight: 4 }}>
              {Object.entries(porModulo).length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--dim)', padding: 32, fontSize: 13 }}>
                  {busqueda ? 'Sin resultados' : 'Sin permisos disponibles'}
                </div>
              )}
              {Object.entries(porModulo).map(([modulo, perms]) => {
                const todosSelec = perms.every(p => seleccionados.has(p.id))
                return (
                  <div
                    key={modulo}
                    style={{
                      background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
                      border: '1px solid transparent',
                      borderRadius: 12,
                      boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
                    }}
                  >
                    {/* Cabecera del módulo */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderBottom: '1px solid oklch(1 0 0 / .06)',
                      background: 'oklch(1 0 0 / .02)',
                    }}>
                      <span className="silver" style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Oxanium, sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                        {modulo}
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => toggleModulo(perms, false)}
                          className="clientes-glass-btn"
                          style={{
                            padding: '3px 10px', borderRadius: 5, border: '1px solid oklch(1 0 0 / .1)',
                            cursor: 'pointer', fontSize: 11, fontWeight: 500,
                          }}
                        >
                          <div className="clientes-glass-bg" />
                          <span className="clientes-glass-content" style={{ color: 'oklch(0.88 0.01 250 / .85)' }}>Todos</span>
                        </button>
                        <button
                          onClick={() => toggleModulo(perms, true)}
                          className="clientes-glass-btn"
                          style={{
                            padding: '3px 10px', borderRadius: 5, border: '1px solid oklch(1 0 0 / .1)',
                            cursor: 'pointer', fontSize: 11, fontWeight: 500,
                          }}
                        >
                          <div className="clientes-glass-bg" />
                          <span className="clientes-glass-content" style={{ color: 'oklch(0.88 0.01 250 / .85)' }}>Ninguno</span>
                        </button>
                      </div>
                    </div>

                    {/* Lista de permisos */}
                    <div style={{ padding: '6px 8px' }}>
                      {perms.map(p => {
                        const activo = seleccionados.has(p.id)
                        return (
                          <div
                            key={p.id}
                            className="permiso-fila"
                            data-activo={activo ? 'true' : 'false'}
                            onClick={() => togglePermiso(p.id)}
                          >
                            <CustomCheckbox checked={activo} />
                            <div className="permiso-texto">
                              <span className="permiso-nombre">{p.nombre}</span>
                              <span className="permiso-codigo">{p.codigo}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 200, color: 'var(--dim)', fontSize: 13,
          }}>
            Selecciona un rol para ver sus permisos
          </div>
        )}
      </div>

      {/* Botón guardar — aparece si hay cambios */}
      <AnimatePresence>
        {hayCambios && rolSeleccionado && (
          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
            onClick={guardarPermisos}
            disabled={guardando}
            className="clientes-glass-btn btn-primary"
            style={{
              position: 'fixed', bottom: 28, right: 32,
              borderRadius: 999,
              padding: '11px 24px', cursor: guardando ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 700, fontFamily: 'Oxanium, sans-serif',
              letterSpacing: '.06em',
              border: '1px solid oklch(0.66 0.22 25 / .5)',
              zIndex: 50,
              opacity: guardando ? 0.7 : 1,
            }}
          >
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content" style={{ color: 'oklch(0.80 0.16 25)' }}>{guardando ? 'Guardando...' : 'Guardar cambios'}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Modal rol */}
      <AnimatePresence>
        {modalRol !== null && (
          <ModalRol rol={modalRol.rol} onGuardar={handleGuardarRol} onCerrar={() => setModalRol(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

function ModalRol({ rol, onGuardar, onCerrar }) {
  const esEdicion = !!rol?.id
  const [nombre, setNombre] = useState(rol?.nombre || '')
  const [descripcion, setDescripcion] = useState(rol?.descripcion || '')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nombre.trim()) { toast.error('El nombre es obligatorio'); return }
    await onGuardar({ nombre: nombre.trim(), descripcion: descripcion.trim() })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'oklch(0 0 0 / .7)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
        style={{
          width: '100%', maxWidth: 380,
          background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
          border: '1px solid transparent', borderRadius: 14, padding: '24px 24px 20px',
          boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
          margin: 16,
        }}>
        <h3 style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{esEdicion ? 'Editar Rol' : 'Nuevo Rol'}</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Nombre *</label>
            <input className="gym-input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del rol"
              disabled={esEdicion && rol?.es_sistema} style={{ width: '100%' }} />
            {esEdicion && rol?.es_sistema && <p style={{ fontSize: 11, color: 'var(--dim)', marginTop: 4 }}>El nombre de roles del sistema no puede editarse</p>}
          </div>
          <div>
            <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Descripción</label>
            <textarea className="gym-textarea" value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción del rol..." rows={2} style={{ width: '100%', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" className="clientes-glass-btn btn-secondary" onClick={onCerrar} style={{ flex: 1 }}>
              <div className="clientes-glass-bg" />
              <span className="clientes-glass-content">Cancelar</span>
            </button>
            <button type="submit" className="clientes-glass-btn btn-primary" style={{ flex: 2, fontSize: 13 }}>
              <div className="clientes-glass-bg" />
              <span className="clientes-glass-content">{esEdicion ? 'Guardar' : 'Crear rol'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function GestionUsuarios() {
  const [tab, setTab] = useState('usuarios')
  const [roles, setRoles] = useState([])

  useEffect(() => {
    window.api.roles.getAll().then(setRoles)
  }, [])

  return (
    <div className="clientes-page" style={{ padding: '0 0 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 className="titulo-metalico" style={{ margin: 0, fontSize: 22 }}>Gestión de Usuarios y Roles</h2>
        <p style={{ margin: '4px 0 0', color: 'oklch(0.78 0.02 250 / .45)', fontSize: 13 }}>
          Administra usuarios, roles y permisos del sistema
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 6, padding: 6, marginBottom: 24,
        background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#top-clientes-glass)', WebkitBackdropFilter: 'url(#top-clientes-glass)',
        border: '1px solid transparent', borderRadius: 999,
        boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
        width: 'fit-content',
      }}>
        <TabButton active={tab === 'usuarios'} onClick={() => setTab('usuarios')} icon={Users}>
          Usuarios
        </TabButton>
        <TabButton active={tab === 'roles'} onClick={() => setTab('roles')} icon={Shield}>
          Roles y Permisos
        </TabButton>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {tab === 'usuarios' ? <TabUsuarios roles={roles} /> : <TabRoles />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
