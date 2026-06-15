import { useState } from 'react'
import { Settings as SettingsIcon, Lock, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

const cardV = (delay) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, delay },
})

export default function Settings() {
  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')

  async function cambiarPassword(e) {
    e.preventDefault()
    const { ok } = await window.api.auth.checkAdmin(currentPass)
    if (!ok) return toast.error('Contraseña actual incorrecta')
    if (newPass !== confirmPass) return toast.error('Las contraseñas no coinciden')
    if (newPass.length < 4) return toast.error('La contraseña debe tener al menos 4 caracteres')
    await window.api.auth.setAdmin(newPass)
    toast.success('Contraseña cambiada correctamente')
    setCurrentPass(''); setNewPass(''); setConfirmPass('')
  }

  return (
    <div style={{ maxWidth: 500 }}>
      <h1 className="titulo-metalico mb-6">Configuración</h1>

      <motion.div {...cardV(0)} className="gym-card p-6 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div style={{ background: 'oklch(0.66 0.22 25 / .14)', border: '1px solid oklch(0.66 0.22 25 / .3)', borderRadius: 9, padding: 8 }}>
            <Lock size={18} color="oklch(0.75 0.18 25)" />
          </div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '.04em' }}>Cambiar Contraseña de Admin</h2>
        </div>
        <form onSubmit={cambiarPassword} className="flex flex-col gap-3">
          <div>
            <label className="gym-label">Contraseña Actual</label>
            <input className="gym-input" type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} required />
          </div>
          <div>
            <label className="gym-label">Nueva Contraseña</label>
            <input className="gym-input" type="password" value={newPass} onChange={e => setNewPass(e.target.value)} required />
          </div>
          <div>
            <label className="gym-label">Confirmar Contraseña</label>
            <input className="gym-input" type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary" style={{ marginTop: 8, justifyContent: 'center' }}>
            <Save size={14} style={{ display: 'inline', marginRight: 6 }} />Cambiar Contraseña
          </button>
        </form>
      </motion.div>

      <motion.div {...cardV(0.08)} className="gym-card p-6">
        <div className="flex items-center gap-3 mb-3">
          <div style={{ background: 'oklch(1 0 0 / .05)', border: '1px solid var(--line)', borderRadius: 9, padding: 8 }}>
            <SettingsIcon size={18} color="var(--muted)" />
          </div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '.04em' }}>Acerca del Sistema</h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Urban Fitness Club — Sistema de Gestión v1.0</p>
        <p style={{ fontSize: 13, color: 'var(--dim)', marginTop: 6 }}>Incluye módulo de Facturación Electrónica SFE Bolivia</p>
      </motion.div>
    </div>
  )
}
