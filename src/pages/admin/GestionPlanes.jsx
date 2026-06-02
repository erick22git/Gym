import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Edit2, Trash2, Check, X, Users, ToggleLeft, ToggleRight, Percent } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import Descuentos from './Descuentos'

const COLORS_PRESET = [
  'oklch(0.66 0.22 25)', 'oklch(0.74 0.13 250)', 'oklch(0.78 0.16 155)',
  'oklch(0.82 0.14 75)', 'oklch(0.80 0.12 200)', 'oklch(0.72 0.18 305)',
]

const TAGS_PRESET = ['POPULAR', 'RECOMENDADO', 'OFERTA']

function parseTag(tag) {
  if (!tag) return null
  if (tag.includes('|')) {
    const [text, color] = tag.split('|')
    return { text, color: color || 'oklch(0.66 0.22 25)' }
  }
  const presets = {
    POPULAR: 'oklch(0.82 0.14 75)',
    RECOMENDADO: 'oklch(0.66 0.22 25)',
    OFERTA: 'oklch(0.68 0.18 200)',
  }
  return { text: tag, color: presets[tag] || 'oklch(0.66 0.22 25)' }
}

function ModalPlan({ plan, onSave, onClose }) {
  const esOtroTag = plan?.tag && !TAGS_PRESET.includes(plan.tag) && plan.tag !== ''
  const [form, setForm] = useState(plan ? {
    ...plan,
    tag: esOtroTag ? '' : (plan.tag || ''),
    caracteristicas: (() => { try { return JSON.parse(plan.caracteristicas || '[]').join('\n') } catch { return '' } })(),
  } : {
    nombre: '', duracion_dias: 30, precio: 0, descripcion: '',
    color: 'oklch(0.66 0.22 25)', tag: '', orden: 0,
    acceso_sauna: false, acceso_piscina: false, acceso_clases: false, acceso_pt: false,
    visible_cliente: true, activo: true, caracteristicas: '',
    tipo_plan: 'individual', capacidad: 1,
  })
  const [tagOtro, setTagOtro] = useState(esOtroTag)
  const [tagCustomText, setTagCustomText] = useState(esOtroTag ? (plan.tag.split('|')[0] || '') : '')
  const [tagCustomColor, setTagCustomColor] = useState(esOtroTag ? (plan.tag.split('|')[1] || 'oklch(0.66 0.22 25)') : 'oklch(0.66 0.22 25)')

  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })) }

  async function handleSave() {
    if (!form.nombre?.trim()) { toast.error('Nombre requerido'); return }
    if (!form.precio || isNaN(form.precio)) { toast.error('Precio inválido'); return }
    if (!form.duracion_dias || isNaN(form.duracion_dias)) { toast.error('Duración inválida'); return }

    const caract = form.caracteristicas
      ? form.caracteristicas.split('\n').map(l => l.trim()).filter(Boolean)
      : []

    const tagFinal = tagOtro
      ? (tagCustomText.trim() ? `${tagCustomText.trim().toUpperCase()}|${tagCustomColor}` : '')
      : (form.tag || '')

    const data = {
      ...form,
      tag: tagFinal,
      precio: parseFloat(form.precio),
      duracion_dias: parseInt(form.duracion_dias),
      orden: parseInt(form.orden) || 0,
      caracteristicas: caract,
      activo: form.activo ? 1 : 0,
      visible_cliente: form.visible_cliente ? 1 : 0,
    }

    try {
      if (plan?.id) {
        await window.api.planes.update(plan.id, data)
        toast.success('Plan actualizado')
      } else {
        await window.api.planes.create(data)
        toast.success('Plan creado')
      }
      onSave()
    } catch {
      toast.error('Error al guardar')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'oklch(0 0 0 / .7)',
      backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{
          width: '100%', maxWidth: 580, maxHeight: 'calc(100vh - 80px)',
          background: 'oklch(0.11 0.01 250)', border: '1px solid var(--line-s)',
          borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 800, letterSpacing: '.06em', margin: 0 }}>
            {plan ? 'Editar Plan' : 'Crear Plan'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)' }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Nombre del plan *</label>
              <input className="gym-input" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Plan Premium" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Precio (Bs.) *</label>
              <input className="gym-input" type="number" min="0" value={form.precio} onChange={e => set('precio', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Duración (días) *</label>
              <input className="gym-input" type="number" min="1" value={form.duracion_dias} onChange={e => set('duracion_dias', e.target.value)} placeholder="30" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Tipo de plan</label>
              <select className="gym-select" value={form.tipo_plan || 'individual'} onChange={e => { set('tipo_plan', e.target.value); if (e.target.value === 'individual') set('capacidad', 1) }}>
                <option value="individual">Individual (1 persona)</option>
                <option value="pareja">Pareja (2 personas)</option>
                <option value="familiar">Familiar (3+ personas)</option>
                <option value="grupal">Grupal (definir capacidad)</option>
              </select>
            </div>
            {form.tipo_plan !== 'individual' && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>
                  Personas incluidas{form.tipo_plan === 'pareja' ? ' (máx. 2)' : ''}
                </label>
                <input className="gym-input" type="number" min={form.tipo_plan === 'pareja' ? 2 : 3} max={form.tipo_plan === 'pareja' ? 2 : 20}
                  value={form.capacidad || (form.tipo_plan === 'pareja' ? 2 : 3)}
                  onChange={e => set('capacidad', parseInt(e.target.value) || 2)} />
              </div>
            )}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Orden de aparición</label>
              <input className="gym-input" type="number" min="0" value={form.orden} onChange={e => set('orden', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Tag</label>
              <select
                className="gym-select"
                value={tagOtro ? 'OTRO' : (form.tag || '')}
                onChange={e => {
                  if (e.target.value === 'OTRO') { setTagOtro(true); set('tag', '') }
                  else { setTagOtro(false); set('tag', e.target.value) }
                }}
              >
                <option value="">— Sin tag —</option>
                {TAGS_PRESET.map(t => <option key={t} value={t}>{t}</option>)}
                <option value="OTRO">Otro...</option>
              </select>
              {tagOtro && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input
                    className="gym-input"
                    value={tagCustomText}
                    onChange={e => setTagCustomText(e.target.value)}
                    placeholder="Texto del tag"
                    maxLength={20}
                    style={{ fontSize: 12 }}
                  />
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {COLORS_PRESET.map(c => (
                      <button key={c} type="button" onClick={() => setTagCustomColor(c)} style={{
                        width: 22, height: 22, borderRadius: '50%', background: c,
                        border: tagCustomColor === c ? '2px solid #fff' : '2px solid transparent',
                        cursor: 'pointer', flexShrink: 0,
                      }} />
                    ))}
                    {tagCustomText.trim() && (
                      <span style={{
                        marginLeft: 4, background: tagCustomColor, color: '#000',
                        fontSize: 9, fontWeight: 800, letterSpacing: '.08em',
                        padding: '2px 8px', borderRadius: 999,
                      }}>{tagCustomText.trim().toUpperCase()}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>Color identificador</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLORS_PRESET.map(c => (
                <button key={c} type="button" onClick={() => set('color', c)} style={{
                  width: 28, height: 28, borderRadius: '50%', background: c,
                  border: form.color === c ? '3px solid #fff' : '3px solid transparent',
                  cursor: 'pointer', flexShrink: 0,
                }} />
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>
              Características (una por línea)
            </label>
            <textarea
              className="gym-textarea"
              value={form.caracteristicas}
              onChange={e => set('caracteristicas', e.target.value)}
              placeholder="Acceso completo al gym&#10;Horario completo&#10;Clases grupales"
              rows={4}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>Acceso especial</label>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[['acceso_sauna', 'Sauna'], ['acceso_piscina', 'Piscina'], ['acceso_clases', 'Clases'], ['acceso_pt', 'Entrenador personal']].map(([k, l]) => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--muted)' }}>
                  <input type="checkbox" checked={!!form[k]} onChange={e => set(k, e.target.checked)} />
                  {l}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--muted)' }}>
              <input type="checkbox" checked={!!form.visible_cliente} onChange={e => set('visible_cliente', e.target.checked)} />
              Visible en selección de planes
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--muted)' }}>
              <input type="checkbox" checked={!!form.activo} onChange={e => set('activo', e.target.checked)} />
              Plan activo
            </label>
          </div>
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Check size={15} /> {plan ? 'Guardar cambios' : 'Crear plan'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function PlanCard({ plan, onEdit, onToggle, onDelete }) {
  const { tienePermiso } = useAuth()
  const puedeEditar = tienePermiso('membresias.editar_plan')
  const puedeCrear = tienePermiso('membresias.crear_plan')
  const caracteristicas = (() => { try { return JSON.parse(plan.caracteristicas || '[]') } catch { return [] } })()
  const color = plan.color || 'var(--red)'
  const tagParsed = parseTag(plan.tag)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'var(--glass)', border: `1px solid ${plan.activo ? color + '40' : 'var(--line)'}`,
        borderRadius: 14, padding: '18px 16px', position: 'relative',
        opacity: plan.activo ? 1 : 0.55,
      }}
    >
      {tagParsed && (
        <div style={{
          position: 'absolute', top: -10, right: 12,
          background: tagParsed.color, color: '#000',
          fontSize: 9, fontWeight: 800, letterSpacing: '.08em',
          padding: '3px 8px', borderRadius: 999,
        }}>{tagParsed.text}</div>
      )}
      <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '.1em', marginBottom: 4 }}>
        {plan.nombre.toUpperCase()}
        {!plan.activo && <span style={{ marginLeft: 6, color: 'var(--dim)' }}>(INACTIVO)</span>}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--display)', marginBottom: 2 }}>
        Bs. {plan.precio}
      </div>
      <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 10 }}>/ {plan.duracion_dias} días</div>
      {caracteristicas.slice(0, 4).map((c, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
          <Check size={10} color={color} />
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{c}</span>
        </div>
      ))}
      {plan.clientes_activos > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, padding: '4px 8px', background: 'oklch(1 0 0 / .04)', borderRadius: 6 }}>
          <Users size={11} color="var(--dim)" />
          <span style={{ fontSize: 11, color: 'var(--dim)' }}>{plan.clientes_activos} clientes activos</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        {puedeEditar && (
          <button onClick={() => onEdit(plan)} className="btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12, padding: '6px 0' }}>
            <Edit2 size={13} /> Editar
          </button>
        )}
        {puedeEditar && (
          <button onClick={() => onToggle(plan)} className="btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} title={plan.activo ? 'Desactivar' : 'Activar'}>
            {plan.activo ? <ToggleRight size={16} color="var(--green)" /> : <ToggleLeft size={16} color="var(--dim)" />}
          </button>
        )}
      </div>
    </motion.div>
  )
}

export default function GestionPlanes() {
  const { tienePermiso } = useAuth()
  const [planes, setPlanes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalPlan, setModalPlan] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showDescuentos, setShowDescuentos] = useState(false)
  const puedeCrear = tienePermiso('membresias.crear_plan')

  async function cargar() {
    setCargando(true)
    try {
      const data = await window.api.planes.getWithClientCount()
      setPlanes(data || [])
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  async function togglePlan(plan) {
    await window.api.planes.update(plan.id, { ...plan, activo: plan.activo ? 0 : 1 })
    toast.success(plan.activo ? 'Plan desactivado' : 'Plan activado')
    cargar()
  }

  function abrirNuevo() { setModalPlan(null); setShowModal(true) }
  function abrirEditar(plan) { setModalPlan(plan); setShowModal(true) }
  function cerrarModal() { setShowModal(false); setModalPlan(null) }
  function onSave() { cerrarModal(); cargar() }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 className="titulo-metalico" style={{ marginBottom: 4 }}>Gestión de Planes</h1>
          <p style={{ fontSize: 13, color: 'var(--dim)' }}>Administra los planes de membresía del gimnasio</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowDescuentos(true)}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}
          >
            <Percent size={14} /> Descuentos
          </button>
          {puedeCrear && (
            <button onClick={abrirNuevo} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={16} /> Nuevo Plan
            </button>
          )}
        </div>
      </div>

      {cargando ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--dim)' }}>Cargando planes...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {planes.map(plan => (
            <PlanCard key={plan.id} plan={plan} onEdit={abrirEditar} onToggle={togglePlan} onDelete={() => {}} />
          ))}
          {puedeCrear && (
            <motion.button
              type="button"
              onClick={abrirNuevo}
              whileHover={{ scale: 1.02 }}
              style={{
                background: 'oklch(1 0 0 / .03)', border: '1.5px dashed var(--line)',
                borderRadius: 14, padding: '40px 16px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                minHeight: 180,
              }}
            >
              <Plus size={28} color="var(--dim)" />
              <span style={{ fontSize: 13, color: 'var(--dim)' }}>Crear nuevo plan</span>
            </motion.button>
          )}
        </div>
      )}

      <AnimatePresence>
        {showModal && <ModalPlan plan={modalPlan} onSave={onSave} onClose={cerrarModal} />}
      </AnimatePresence>

      {/* Modal Descuentos */}
      <AnimatePresence>
        {showDescuentos && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'oklch(0 0 0 / .7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              style={{ width: '100%', maxWidth: 760, maxHeight: 'calc(100vh - 80px)', background: 'oklch(0.11 0.01 250)', border: '1px solid var(--line-s)', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <h2 style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 800, letterSpacing: '.06em', margin: 0 }}>Descuentos y Promociones</h2>
                <button onClick={() => setShowDescuentos(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)' }}><X size={18} /></button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
                <Descuentos />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
