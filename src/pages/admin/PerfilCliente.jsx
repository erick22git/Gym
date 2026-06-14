import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, User, Phone, Mail, MapPin, Calendar, Droplets, AlertCircle,
  Activity, CreditCard, DollarSign, FileText, StickyNote, Edit2, Trash2,
  Plus, ChevronRight, Clock, CheckCircle, XCircle, Heart, Receipt, Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { PAGES } from '../../constants'
import AttendanceHeatmap from '../../components/cliente/AttendanceHeatmap'
import { useConfirm } from '../../components/ui/ConfirmDialog'

const TABS = [
  { id: 'info', label: 'Información', icon: User },
  { id: 'membresias', label: 'Membresías', icon: CreditCard },
  { id: 'asistencia', label: 'Asistencia', icon: Activity },
  { id: 'pagos', label: 'Pagos', icon: DollarSign },
  { id: 'recibos', label: 'Recibos', icon: Receipt },
  { id: 'facturas', label: 'Facturas', icon: FileText },
  { id: 'notas', label: 'Notas', icon: StickyNote },
]

const GENEROS = { M: 'Masculino', F: 'Femenino', O: 'Otro' }
const SANGRES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const METODOS = { efectivo: 'Efectivo', transferencia: 'Transferencia', qr: 'QR', tarjeta: 'Tarjeta' }

function Card({ children, style }) {
  return (
    <div style={{
      background: 'oklch(0.13 0.01 250 / .7)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid oklch(1 0 0 / .08)',
      borderRadius: 14,
      padding: '16px 18px',
      ...style,
    }}>
      {children}
    </div>
  )
}

function Badge({ children, color = 'oklch(0.66 0.22 25)' }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px', borderRadius: 5,
      background: color.replace(')', ' / .15)'),
      border: `1px solid ${color.replace(')', ' / .3)')}`,
      color, fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase',
    }}>
      {children}
    </span>
  )
}

function Field({ label, value, icon: Icon }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ fontSize: 10, color: 'oklch(0.78 0.02 250 / .4)', letterSpacing: '.07em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 13, color: 'oklch(0.90 0.01 250)', display: 'flex', alignItems: 'center', gap: 5 }}>
        {Icon && <Icon size={12} color="oklch(0.78 0.02 250 / .4)" />}
        {value}
      </div>
    </div>
  )
}

// ─── Tab: Información ─────────────────────────────────────────────────────────
function TabInfo({ perfil, onUpdated }) {
  const [edit, setEdit] = useState(false)
  const [form, setForm] = useState({})

  useEffect(() => {
    setForm({
      nombre: perfil.nombre || '',
      apellido: perfil.apellido || '',
      carnet: perfil.carnet || '',
      email: perfil.email || '',
      telefono: perfil.telefono || '',
      fecha_nacimiento: perfil.fecha_nacimiento || '',
      genero: perfil.genero || '',
      direccion: perfil.direccion || '',
      contacto_emergencia: perfil.contacto_emergencia || '',
      telefono_emergencia: perfil.telefono_emergencia || '',
      tipo_sangre: perfil.tipo_sangre || '',
      alergias: perfil.alergias || '',
      condicion_medica: perfil.condiciones_medicas || perfil.condicion_medica || '',
      notas_internas: perfil.notas || perfil.notas_internas || '',
    })
  }, [perfil])

  async function guardar() {
    try {
      await window.api.clientes.update(perfil.id, { nombre: form.nombre, apellido: form.apellido, carnet: form.carnet, email: form.email, telefono: form.telefono, fecha_nacimiento: form.fecha_nacimiento })
      await window.api.clientesExtra.updateExtra(perfil.id, {
        genero: form.genero, direccion: form.direccion,
        contacto_emergencia: form.contacto_emergencia, telefono_emergencia: form.telefono_emergencia,
        tipo_sangre: form.tipo_sangre, alergias: form.alergias,
        condicion_medica: form.condicion_medica, notas_internas: form.notas_internas,
      })
      toast.success('Información actualizada')
      setEdit(false)
      onUpdated()
    } catch (e) {
      toast.error('Error al guardar')
    }
  }

  const inp = (field, type = 'text', placeholder = '') => (
    <input
      className="gym-input"
      type={type}
      value={form[field] || ''}
      onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
      placeholder={placeholder}
      style={{ width: '100%', fontSize: 13 }}
    />
  )

  if (edit) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label className="gym-label">Nombre</label>{inp('nombre')}</div>
          <div><label className="gym-label">Apellido</label>{inp('apellido')}</div>
          <div><label className="gym-label">Carnet</label>{inp('carnet')}</div>
          <div><label className="gym-label">Email</label>{inp('email', 'email')}</div>
          <div><label className="gym-label">Teléfono</label>{inp('telefono', 'tel')}</div>
          <div><label className="gym-label">Fecha nacimiento</label>{inp('fecha_nacimiento', 'date')}</div>
          <div>
            <label className="gym-label">Género</label>
            <select className="gym-input" value={form.genero} onChange={e => setForm(f => ({ ...f, genero: e.target.value }))} style={{ width: '100%', fontSize: 13 }}>
              <option value="">—</option>
              {Object.entries(GENEROS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="gym-label">Tipo de sangre</label>
            <select className="gym-input" value={form.tipo_sangre} onChange={e => setForm(f => ({ ...f, tipo_sangre: e.target.value }))} style={{ width: '100%', fontSize: 13 }}>
              <option value="">—</option>
              {SANGRES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}><label className="gym-label">Dirección</label>{inp('direccion', 'text', 'Dirección completa')}</div>
          <div><label className="gym-label">Contacto emergencia</label>{inp('contacto_emergencia', 'text', 'Nombre')}</div>
          <div><label className="gym-label">Teléfono emergencia</label>{inp('telefono_emergencia', 'tel')}</div>
          <div style={{ gridColumn: '1 / -1' }}><label className="gym-label">Alergias</label>{inp('alergias', 'text', 'Ej: Penicilina, nueces...')}</div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="gym-label">Condición médica</label>
            <textarea className="gym-input" rows={2} value={form.condicion_medica || ''} onChange={e => setForm(f => ({ ...f, condicion_medica: e.target.value }))} style={{ width: '100%', fontSize: 13, resize: 'vertical' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" onClick={() => setEdit(false)} style={{ flex: 1 }}>Cancelar</button>
          <button className="btn-primary" onClick={guardar} style={{ flex: 2 }}>Guardar cambios</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-secondary" onClick={() => setEdit(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <Edit2 size={13} /> Editar
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'oklch(0.78 0.02 250 / .4)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 12 }}>Datos personales</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label="Email" value={perfil.email} icon={Mail} />
            <Field label="Teléfono" value={perfil.telefono} icon={Phone} />
            <Field label="Fecha nacimiento" value={perfil.fecha_nacimiento} icon={Calendar} />
            <Field label="Género" value={GENEROS[perfil.genero] || perfil.genero} />
            <Field label="Dirección" value={perfil.direccion} icon={MapPin} />
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'oklch(0.78 0.02 250 / .4)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 12 }}>Información médica</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label="Tipo de sangre" value={perfil.tipo_sangre} icon={Droplets} />
            <Field label="Alergias" value={perfil.alergias} icon={AlertCircle} />
            <Field label="Condición médica" value={perfil.condiciones_medicas || perfil.condicion_medica} icon={Heart} />
            <Field label="Contacto emergencia" value={perfil.contacto_emergencia} icon={Phone} />
            <Field label="Teléfono emergencia" value={perfil.telefono_emergencia} icon={Phone} />
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─── Tab: Membresías ──────────────────────────────────────────────────────────
function TabMembresias({ membresias = [], clienteId }) {
  const { navigate } = useApp()
  const [miembrosMap, setMiembrosMap] = useState({})

  useEffect(() => {
    const activas = membresias.filter(m => m.estado === 'activa')
    activas.forEach(m => {
      window.api.membresiaMiembros?.getMiembros(m.id).then(data => {
        if (data && data.length > 1) setMiembrosMap(p => ({ ...p, [m.id]: data }))
      }).catch(() => {})
    })
  }, [membresias])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {membresias.length === 0 && (
        <div style={{ textAlign: 'center', color: 'oklch(0.78 0.02 250 / .35)', paddingTop: 40, fontSize: 13 }}>Sin membresías</div>
      )}
      {membresias.map(m => {
        const inicio = new Date(m.fecha_inicio)
        const fin = new Date(m.fecha_fin)
        const hoy = new Date()
        const total = (fin - inicio) / 86400000
        const restante = Math.max(0, (fin - hoy) / 86400000)
        const pct = Math.min(100, Math.max(0, (1 - restante / total) * 100))
        const activa = m.estado === 'activa' && fin >= hoy

        return (
          <Card key={m.id}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'oklch(0.95 0.01 250)' }}>{m.plan_nombre}</div>
                <div style={{ fontSize: 11, color: 'oklch(0.78 0.02 250 / .45)', marginTop: 2 }}>
                  {m.fecha_inicio} → {m.fecha_fin}
                </div>
              </div>
              <Badge color={activa ? 'oklch(0.78 0.16 155)' : 'oklch(0.66 0.22 25)'}>
                {activa ? 'Activa' : 'Vencida'}
              </Badge>
            </div>

            {activa && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: 'oklch(0.78 0.02 250 / .4)' }}>Progreso</span>
                  <span style={{ fontSize: 11, color: 'oklch(0.78 0.02 250 / .6)' }}>{Math.round(restante)} días restantes</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'oklch(1 0 0 / .08)', overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    style={{
                      height: '100%', borderRadius: 3,
                      background: pct > 80 ? 'oklch(0.66 0.22 25)' : 'oklch(0.78 0.16 155)',
                    }}
                  />
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
              {m.monto_pagado && <div style={{ fontSize: 12, color: 'oklch(0.78 0.02 250 / .5)' }}>Bs. {m.monto_pagado}</div>}
            </div>

            {/* Miembros del grupo */}
            {miembrosMap[m.id] && miembrosMap[m.id].length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid oklch(1 0 0 / .07)' }}>
                <div style={{ fontSize: 10, color: 'oklch(0.74 0.13 250)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Users size={10} /> Membresía compartida ({miembrosMap[m.id].length} personas)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {miembrosMap[m.id].map(mm => (
                    <div key={mm.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '3px 8px', background: mm.es_titular ? 'oklch(0.74 0.13 250 / .15)' : 'oklch(1 0 0 / .06)', border: `1px solid ${mm.es_titular ? 'oklch(0.74 0.13 250 / .3)' : 'oklch(1 0 0 / .1)'}`, borderRadius: 6, color: mm.es_titular ? 'oklch(0.74 0.13 250)' : 'oklch(0.78 0.02 250 / .6)', cursor: mm.cliente_id !== clienteId ? 'pointer' : 'default' }}
                      onClick={() => { if (mm.cliente_id !== clienteId) navigate(PAGES.PERFIL_CLIENTE, { clienteId: mm.cliente_id }) }}>
                      {mm.nombre} {mm.apellido}{mm.es_titular ? ' (titular)' : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// ─── Tab: Asistencia ─────────────────────────────────────────────────────────
function TabAsistencia({ clienteId, stats }) {
  const [heatmap, setHeatmap] = useState([])
  const [recientes, setRecientes] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    Promise.all([
      window.api.clientesExtra.getHeatmap(clienteId, 90),
      window.api.clientesExtra.getAsistenciasRecientes(clienteId, 15),
    ]).then(([h, r]) => {
      setHeatmap(h)
      setRecientes(r)
      setCargando(false)
    })
  }, [clienteId])

  if (cargando) return <div style={{ textAlign: 'center', color: 'oklch(0.78 0.02 250 / .3)', paddingTop: 40 }}>Cargando...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats row */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'Total visitas', value: stats.total || 0 },
            { label: 'Este mes', value: stats.mes || 0 },
            { label: 'Esta semana', value: stats.semana || 0 },
            { label: 'Mejor racha', value: `${stats.mejor_racha || 0} días` },
          ].map(s => (
            <Card key={s.label}>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Oxanium, sans-serif', color: 'oklch(0.95 0.01 250)' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'oklch(0.78 0.02 250 / .4)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '.07em' }}>{s.label}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Heatmap */}
      <Card>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'oklch(0.78 0.02 250 / .4)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 14 }}>Últimos 90 días</div>
        <div style={{ overflowX: 'auto' }}>
          <AttendanceHeatmap data={heatmap} dias={90} />
        </div>
      </Card>

      {/* Historial reciente */}
      <Card>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'oklch(0.78 0.02 250 / .4)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 12 }}>Últimas visitas</div>
        {recientes.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'oklch(0.78 0.02 250 / .3)', fontSize: 12, paddingTop: 16 }}>Sin asistencias registradas</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recientes.map((a, i) => (
              <div key={a.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 8, background: 'oklch(1 0 0 / .025)' }}>
                <CheckCircle size={13} color="oklch(0.78 0.16 155)" />
                <span style={{ fontSize: 12, color: 'oklch(0.88 0.01 250)', flex: 1 }}>{a.fecha_hora?.slice(0, 10)}</span>
                <span style={{ fontSize: 11, color: 'oklch(0.78 0.02 250 / .4)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Clock size={10} /> {a.fecha_hora?.slice(11, 16)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Tab: Pagos ───────────────────────────────────────────────────────────────
function TabPagos({ clienteId }) {
  const [pagos, setPagos] = useState([])

  useEffect(() => {
    window.api.pagos.getByCliente(clienteId).then(setPagos)
  }, [clienteId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {pagos.length === 0 && (
        <div style={{ textAlign: 'center', color: 'oklch(0.78 0.02 250 / .35)', paddingTop: 40, fontSize: 13 }}>Sin pagos registrados</div>
      )}
      {pagos.map(p => (
        <Card key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9, flexShrink: 0,
            background: 'oklch(0.75 0.18 60 / .12)',
            border: '1px solid oklch(0.75 0.18 60 / .25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <DollarSign size={16} color="oklch(0.75 0.18 60)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.95 0.01 250)', fontFamily: 'Oxanium, sans-serif' }}>
              Bs. {Number(p.monto).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 11, color: 'oklch(0.78 0.02 250 / .45)', marginTop: 2 }}>{p.concepto}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <Badge color={p.metodo_pago === 'efectivo' ? 'oklch(0.78 0.16 155)' : 'oklch(0.68 0.18 200)'}>
              {METODOS[p.metodo_pago] || p.metodo_pago || 'Efectivo'}
            </Badge>
            <div style={{ fontSize: 10, color: 'oklch(0.78 0.02 250 / .35)', marginTop: 5 }}>{p.fecha}</div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ─── Tab: Recibos ─────────────────────────────────────────────────────────────
function TabRecibos({ clienteId }) {
  const [recibos, setRecibos] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [cargando, setCargando] = useState(true)
  const [reciboVer, setReciboVer] = useState(null)
  const [VistaRecibo, setVistaRecibo] = useState(null)

  useEffect(() => {
    import('../../modules/recibos/VistaRecibo.jsx').then(m => setVistaRecibo(() => m.default)).catch(() => {})
  }, [])

  const cargar = useCallback(async (p) => {
    setCargando(true)
    try {
      const res = await window.api.recibos.getByCliente(clienteId, p, pageSize)
      setRecibos(res?.data || [])
      setTotal(res?.total || 0)
    } catch {
      setRecibos([])
    } finally {
      setCargando(false)
    }
  }, [clienteId])

  useEffect(() => { cargar(1) }, [cargar])

  function verRecibo(r) {
    let items = []
    try { items = r.items ? JSON.parse(r.items) : [] } catch { items = [] }
    setReciboVer({
      numero: r.numero,
      fecha: r.created_at,
      cliente_nombre: r.cliente_nombre || 'Cliente',
      cliente_doc: r.cliente_doc || '',
      items,
      total: r.total,
      metodo_pago: r.metodo_pago,
      recibido: r.total,
      vuelto: 0,
      cajero: r.cajero || '',
    })
  }

  function fmtFecha(f) {
    if (!f) return '—'
    return new Date(f).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const totalPages = Math.ceil(total / pageSize)

  if (cargando) return <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>

  return (
    <div>
      {recibos.length === 0 && !cargando && (
        <div style={{ textAlign: 'center', color: 'oklch(0.78 0.02 250 / .35)', paddingTop: 40, fontSize: 13 }}>Sin recibos registrados</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {recibos.map(r => {
          let items = []
          try { items = r.items ? JSON.parse(r.items) : [] } catch {}
          return (
            <Card key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Receipt size={16} color="oklch(0.82 0.14 75)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'oklch(0.92 0.01 250)' }}>
                  Recibo #{r.numero || r.id}
                </div>
                <div style={{ fontSize: 11, color: 'oklch(0.78 0.02 250 / .5)', marginTop: 1 }}>
                  {fmtFecha(r.created_at)} · {r.metodo_pago || 'Efectivo'}
                </div>
                {items.length > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {items.map(i => `${i.nombre} x${i.cantidad}`).join(', ')}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Oxanium, sans-serif', color: 'oklch(0.95 0.01 250)' }}>
                  Bs. {Number(r.total || 0).toFixed(2)}
                </div>
              </div>
              {VistaRecibo && (
                <button onClick={() => verRecibo(r)}
                  style={{ background: 'none', border: '1px solid oklch(1 0 0 / .12)', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, flexShrink: 0 }}>
                  <Receipt size={12} /> Ver
                </button>
              )}
            </Card>
          )
        })}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 }}>
          <button
            onClick={() => { const p = page - 1; setPage(p); cargar(p) }}
            disabled={page <= 1}
            style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: 'var(--glass)', border: '1px solid var(--line)', color: page <= 1 ? 'var(--dim)' : 'var(--ink)', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}
          >← Anterior</button>
          <span style={{ fontSize: 12, color: 'var(--dim)', padding: '0 6px' }}>
            Pág. {page} de {totalPages} · {total} recibo{total !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => { const p = page + 1; setPage(p); cargar(p) }}
            disabled={page >= totalPages}
            style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: 'var(--glass)', border: '1px solid var(--line)', color: page >= totalPages ? 'var(--dim)' : 'var(--ink)', cursor: page >= totalPages ? 'default' : 'pointer', opacity: page >= totalPages ? 0.4 : 1 }}
          >Siguiente →</button>
        </div>
      )}

      {reciboVer && VistaRecibo && (
        <VistaRecibo venta={reciboVer} onClose={() => setReciboVer(null)} />
      )}
    </div>
  )
}

// ─── Tab: Facturas ────────────────────────────────────────────────────────────
function TabFacturas({ clienteId }) {
  const [facturas, setFacturas] = useState([])

  useEffect(() => {
    if (window.api.facturacion) {
      window.api.facturacion.getFacturas({ clienteId }).then(setFacturas).catch(() => setFacturas([]))
    }
  }, [clienteId])

  if (!window.api.facturacion) {
    return <div style={{ textAlign: 'center', color: 'oklch(0.78 0.02 250 / .3)', paddingTop: 40, fontSize: 13 }}>Módulo de facturación no disponible</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {facturas.length === 0 && (
        <div style={{ textAlign: 'center', color: 'oklch(0.78 0.02 250 / .35)', paddingTop: 40, fontSize: 13 }}>Sin facturas emitidas</div>
      )}
      {facturas.map(f => (
        <Card key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <FileText size={18} color="oklch(0.72 0.17 280)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'oklch(0.92 0.01 250)' }}>#{f.numero_factura}</div>
            <div style={{ fontSize: 11, color: 'oklch(0.78 0.02 250 / .45)' }}>{f.fecha}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Oxanium, sans-serif', color: 'oklch(0.95 0.01 250)' }}>Bs. {Number(f.total).toFixed(2)}</div>
            <Badge color={f.estado === 'valida' ? 'oklch(0.78 0.16 155)' : 'oklch(0.66 0.22 25)'}>{f.estado}</Badge>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ─── Tab: Notas ───────────────────────────────────────────────────────────────
function TabNotas({ clienteId }) {
  const { usuario } = useAuth()
  const [notas, setNotas] = useState([])
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const confirmar = useConfirm()

  const cargar = useCallback(() => {
    window.api.notasCliente.getByCliente(clienteId).then(setNotas)
  }, [clienteId])

  useEffect(() => { cargar() }, [cargar])

  async function agregar() {
    if (!texto.trim()) return
    setGuardando(true)
    try {
      await window.api.notasCliente.create({
        cliente_id: clienteId,
        texto: texto.trim(),
        usuario_id: usuario?.id,
        usuario_nombre: usuario?.nombre_completo || usuario?.username,
      })
      setTexto('')
      cargar()
    } catch { toast.error('Error al guardar nota') }
    finally { setGuardando(false) }
  }

  async function eliminar(id) {
    const ok = await confirmar({ titulo: '¿Eliminar nota?', mensaje: 'Esta nota se eliminará permanentemente.', tipo: 'advertencia', textoConfirmar: 'Eliminar' })
    if (!ok) return
    await window.api.notasCliente.delete(id)
    cargar()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card>
        <div style={{ display: 'flex', gap: 10 }}>
          <textarea
            className="gym-input"
            rows={3}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Agregar nota sobre este cliente..."
            style={{ flex: 1, resize: 'none', fontSize: 13 }}
          />
          <button className="btn-primary" onClick={agregar} disabled={guardando || !texto.trim()} style={{ alignSelf: 'flex-end', padding: '9px 16px' }}>
            <Plus size={14} />
          </button>
        </div>
      </Card>

      {notas.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'oklch(0.78 0.02 250 / .3)', paddingTop: 24, fontSize: 13 }}>Sin notas</div>
      ) : (
        notas.map(n => (
          <Card key={n.id} style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'oklch(0.90 0.01 250)', lineHeight: 1.5 }}>{n.contenido || n.texto}</div>
                <div style={{ fontSize: 10, color: 'oklch(0.78 0.02 250 / .4)', marginTop: 8 }}>
                  {n.usuario_nombre} · {(n.created_at || n.fecha_creacion)?.slice(0, 16)}
                </div>
              </div>
              <button
                onClick={() => eliminar(n.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.78 0.02 250 / .3)', padding: 4, borderRadius: 5, flexShrink: 0 }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </Card>
        ))
      )}
    </div>
  )
}

// ─── Main PerfilCliente ───────────────────────────────────────────────────────
export default function PerfilCliente() {
  const { pageParams, navigate } = useApp()
  const clienteId = pageParams?.clienteId
  const [perfil, setPerfil] = useState(null)
  const [stats, setStats] = useState(null)
  const [tab, setTab] = useState('info')
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    if (!clienteId) return
    setCargando(true)
    try {
      const [p, s, mems] = await Promise.all([
        window.api.clientesExtra.getPerfilCompleto(clienteId),
        window.api.clientesExtra.getStats(clienteId),
        window.api.membresias.getByCliente(clienteId),
      ])
      setPerfil(p ? { ...p, membresias: mems || [] } : null)
      setStats(s)
    } catch (e) {
      console.error('Error cargando perfil:', e)
      toast.error('Error al cargar perfil')
    } finally {
      setCargando(false)
    }
  }, [clienteId])

  useEffect(() => { cargar() }, [cargar])

  if (!clienteId) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 60, color: 'oklch(0.78 0.02 250 / .4)' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>👤</div>
        <div>Selecciona un cliente para ver su perfil</div>
        <button className="btn-secondary" onClick={() => navigate(PAGES.CLIENTS)} style={{ marginTop: 16, fontSize: 12 }}>Ver clientes</button>
      </div>
    )
  }

  if (cargando) {
    return <div style={{ textAlign: 'center', paddingTop: 80, color: 'oklch(0.78 0.02 250 / .35)', fontSize: 13 }}>Cargando perfil...</div>
  }

  if (!perfil) {
    return <div style={{ textAlign: 'center', paddingTop: 60, color: 'oklch(0.78 0.02 250 / .35)' }}>Cliente no encontrado</div>
  }

  const membresiaActiva = perfil.membresias?.find(m => m.estado === 'activa' && new Date(m.fecha_fin) >= new Date())

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Botón volver */}
      <button
        onClick={() => navigate(PAGES.CLIENTS)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'oklch(0.78 0.02 250 / .5)', fontSize: 12,
          padding: 0, alignSelf: 'flex-start',
          transition: 'color .15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'oklch(0.90 0.01 250)'}
        onMouseLeave={e => e.currentTarget.style.color = 'oklch(0.78 0.02 250 / .5)'}
      >
        <ArrowLeft size={14} /> Volver a clientes
      </button>

      {/* Header card */}
      <Card style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* Avatar */}
        <div style={{
          width: 70, height: 70, borderRadius: 18, flexShrink: 0,
          background: 'oklch(0.66 0.22 25 / .15)',
          border: '2px solid oklch(0.66 0.22 25 / .35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, fontWeight: 700, color: 'oklch(0.66 0.22 25)',
          fontFamily: 'Oxanium, sans-serif',
        }}>
          {(perfil.nombre?.[0] || '?').toUpperCase()}
        </div>

        {/* Info principal */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, fontFamily: 'Oxanium, sans-serif', color: 'oklch(0.97 0.01 250)' }}>
              {perfil.nombre} {perfil.apellido}
            </h2>
            {membresiaActiva
              ? <Badge color="oklch(0.78 0.16 155)">Activo</Badge>
              : <Badge color="oklch(0.66 0.22 25)">Inactivo</Badge>
            }
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'oklch(0.78 0.02 250 / .5)' }}>CI: {perfil.carnet}</span>
            {perfil.email && <span style={{ fontSize: 12, color: 'oklch(0.78 0.02 250 / .5)' }}>{perfil.email}</span>}
            {perfil.telefono && <span style={{ fontSize: 12, color: 'oklch(0.78 0.02 250 / .5)' }}>{perfil.telefono}</span>}
          </div>
          {membresiaActiva && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'oklch(0.78 0.16 155)' }}>
              <ChevronRight size={11} style={{ display: 'inline' }} />
              {membresiaActiva.plan_nombre} — vence {membresiaActiva.fecha_fin}
            </div>
          )}
        </div>

        {/* Stats compactos */}
        <div style={{ display: 'flex', gap: 20, flexShrink: 0 }}>
          {[
            { label: 'Total visitas', value: stats?.total || 0 },
            { label: 'Visitas (mes)', value: stats?.mes || 0 },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Oxanium, sans-serif', color: 'oklch(0.95 0.01 250)' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'oklch(0.78 0.02 250 / .4)', textTransform: 'uppercase', letterSpacing: '.07em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: 'oklch(0.11 0.01 250 / .5)', borderRadius: 12, padding: 4 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: tab === t.id ? 600 : 400,
              background: tab === t.id ? 'oklch(0.17 0.01 250)' : 'transparent',
              color: tab === t.id ? 'oklch(0.95 0.01 250)' : 'oklch(0.78 0.02 250 / .45)',
              transition: 'all .15s', flex: 1, justifyContent: 'center',
            }}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
        >
          {tab === 'info' && <TabInfo perfil={perfil} onUpdated={cargar} />}
          {tab === 'membresias' && <TabMembresias membresias={perfil.membresias || []} clienteId={clienteId} />}
          {tab === 'asistencia' && <TabAsistencia clienteId={clienteId} stats={stats} />}
          {tab === 'pagos' && <TabPagos clienteId={clienteId} />}
          {tab === 'recibos' && <TabRecibos clienteId={clienteId} />}
          {tab === 'facturas' && <TabFacturas clienteId={clienteId} />}
          {tab === 'notas' && <TabNotas clienteId={clienteId} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
