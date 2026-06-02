import { useState } from 'react'
import { Lock } from 'lucide-react'
import Modal from './Modal'
import { useApp } from '../../context/AppContext'

export default function AdminModal() {
  const { showAdminModal, closeAdminModal, unlockAdmin } = useApp()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const ok = await unlockAdmin(password)
    setLoading(false)
    if (!ok) {
      setError('Contraseña incorrecta')
      setPassword('')
    } else {
      setPassword('')
    }
  }

  return (
    <Modal open={showAdminModal} onClose={closeAdminModal} title="Acceso Administrador" width={380}>
      <div className="flex flex-col items-center gap-4 py-2">
        <div style={{ background: 'oklch(0.66 0.22 25 / .14)', border: '1px solid oklch(0.66 0.22 25 / .35)', borderRadius: 50, padding: 16 }}>
          <Lock size={28} color="oklch(0.75 0.18 25)" />
        </div>
        <p style={{ color: 'oklch(0.78 0.02 250 / .55)', fontSize: 13, textAlign: 'center' }}>
          Ingresa la contraseña de administrador para continuar
        </p>
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <input
            type="password"
            className="gym-input"
            placeholder="Contraseña"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            autoFocus
            style={{ marginBottom: 12 }}
          />
          {error && <p style={{ color: 'oklch(0.75 0.18 25)', fontSize: 12, marginBottom: 12 }}>{error}</p>}
          <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Verificando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </Modal>
  )
}
