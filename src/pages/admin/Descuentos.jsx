import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Edit2, Trash2, Check, X, ToggleLeft, ToggleRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { useConfirm } from '../../components/ui/ConfirmDialog'

function ModalDescuento({ desc, onSave, onClose }) {
  const [form, setForm] = useState(desc ? {
    ...desc
  } : {
    nombre: '', tipo: 'porcentaje', valor: 0, activo: true, aplicable_a: 'todos',
  })

  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })) }

  async function handleSave() {
    if (!form.nombre?.trim()) { toast.error('Nombre requerido'); return }
    if (!form.valor || isNaN(form.valor) || form.valor <= 0) { toast.error('Valor inválido'); return }
    const data = { ...form, valor: parseFloat(form.valor), activo: form.activo ? 1 : 0 }
    try {
      if (desc?.id) {
        await window.api.descuentos.update(desc.id, data)
        toast.success('Descuento actualizado')
      } else {
        await window.api.descuentos.create(data)
        toast.success('Descuento creado')
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
          width: '100%', maxWidth: 440,
          background: 'oklch(0.11 0.01 250)', border: '1px solid var(--line-s)',
          borderRadius: 18, overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'var(--display)', fontSize: 15, fontWeight: 800, letterSpacing: '.06em', margin: 0 }}>
            {desc ? 'Editar Descuento' : 'Nuevo Descuento'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Nombre *</label>
            <input className="gym-input" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Descuento cumpleaños" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Tipo</label>
              <select className="gym-select" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                <option value="porcentaje">Porcentaje (%)</option>
                <option value="monto">Monto fijo (Bs.)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>
                Valor {form.tipo === 'porcentaje' ? '(%)' : '(Bs.)'}
              </label>
              <input
                className="gym-input" type="number" min="0"
                value={form.valor} onChange={e => set('valor', e.target.value)}
              />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer', color: 'var(--muted)' }}>
            <input type="checkbox" checked={!!form.activo} onChange={e => set('activo', e.target.checked)} />
            Descuento activo
          </label>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Check size={14} /> {desc ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function Descuentos() {
  const { tienePermiso } = useAuth()
  const [descuentos, setDescuentos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const puedeCobrar = tienePermiso('membresias.cobrar')
  const confirmar = useConfirm()

  async function cargar() {
    setCargando(true)
    try {
      setDescuentos(await window.api.descuentos.getAll())
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  async function toggleActivo(d) {
    await window.api.descuentos.update(d.id, { ...d, activo: d.activo ? 0 : 1 })
    cargar()
  }

  async function handleDelete(d) {
    const ok = await confirmar({ titulo: `¿Eliminar descuento?`, mensaje: `"${d.nombre}" se eliminará permanentemente.`, tipo: 'peligro', textoConfirmar: 'Eliminar' })
    if (!ok) return
    await window.api.descuentos.delete(d.id)
    toast.success('Descuento eliminado')
    cargar()
  }

  function abrirNuevo() { setModal(null); setShowModal(true) }
  function abrirEditar(d) { setModal(d); setShowModal(true) }
  function cerrar() { setShowModal(false); setModal(null) }
  function onSave() { cerrar(); cargar() }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 className="titulo-metalico" style={{ marginBottom: 4 }}>Descuentos</h1>
          <p style={{ fontSize: 13, color: 'var(--dim)' }}>Descuentos disponibles al cobrar membresías</p>
        </div>
        {puedeCobrar && (
          <button onClick={abrirNuevo} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={16} /> Nuevo Descuento
          </button>
        )}
      </div>

      <div className="gym-card" style={{ overflow: 'hidden' }}>
        {cargando ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--dim)' }}>Cargando...</div>
        ) : descuentos.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--dim)' }}>No hay descuentos configurados</div>
        ) : descuentos.map((d, i) => (
          <motion.div
            key={d.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 18px',
              borderBottom: i < descuentos.length - 1 ? '1px solid var(--line)' : 'none',
              opacity: d.activo ? 1 : 0.5,
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 10, flexShrink: 0,
              background: d.activo ? 'oklch(0.66 0.22 25 / .15)' : 'oklch(1 0 0 / .04)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${d.activo ? 'oklch(0.66 0.22 25 / .3)' : 'var(--line)'}`,
            }}>
              <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--display)', color: d.activo ? 'var(--red)' : 'var(--dim)' }}>
                {d.tipo === 'porcentaje' ? `${d.valor}%` : `${d.valor}`}
              </span>
              <span style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: '.06em' }}>
                {d.tipo === 'porcentaje' ? 'DESC' : 'Bs.'}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{d.nombre}</div>
              <div style={{ fontSize: 11, color: 'var(--dim)' }}>
                {d.tipo === 'porcentaje' ? `${d.valor}% de descuento` : `Bs. ${d.valor} de descuento fijo`}
                {!d.activo && <span style={{ marginLeft: 8, color: 'var(--dim)' }}>· INACTIVO</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => toggleActivo(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} title={d.activo ? 'Desactivar' : 'Activar'}>
                {d.activo ? <ToggleRight size={22} color="var(--green)" /> : <ToggleLeft size={22} color="var(--dim)" />}
              </button>
              {puedeCobrar && (
                <button onClick={() => abrirEditar(d)} className="btn-secondary" style={{ padding: '5px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Edit2 size={12} /> Editar
                </button>
              )}
              {puedeCobrar && (
                <button onClick={() => handleDelete(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)', padding: 4 }}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showModal && <ModalDescuento desc={modal} onSave={onSave} onClose={cerrar} />}
      </AnimatePresence>
    </div>
  )
}
