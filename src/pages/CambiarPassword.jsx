import { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Lock, KeyRound } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { authService } from '../services/authService'
import { auditoriaService, ACCIONES } from '../services/auditoriaService'

/**
 * Modal para cambio de contraseña.
 * - obligatorio=true: primer login, sin "Cancelar"
 * - obligatorio=false: cambio voluntario desde perfil
 */
export default function CambiarPasswordModal({ obligatorio = false, usuario = null, onCerrar }) {
  const { usuario: usuarioCtx, cambiarPassword, marcarPasswordCambiado } = useAuth()
  const u = usuario || usuarioCtx

  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [showActual, setShowActual] = useState(false)
  const [showNueva, setShowNueva] = useState(false)
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (nueva.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return }
    if (nueva !== confirmar) { toast.error('Las contraseñas no coinciden'); return }

    setCargando(true)
    try {
      let resultado
      if (obligatorio) {
        // Primer login: cambio sin verificar contraseña anterior
        resultado = await authService.cambiarPasswordAdmin(u.id, nueva)
      } else {
        if (!actual) { toast.error('Ingresa tu contraseña actual'); setCargando(false); return }
        resultado = await cambiarPassword(actual, nueva)
      }

      if (resultado.ok) {
        toast.success('Contraseña actualizada correctamente')
        await auditoriaService.log(ACCIONES.PASSWORD_CAMBIADO, 'auth', 'Contraseña cambiada')
        if (obligatorio) marcarPasswordCambiado()
        onCerrar()
      } else {
        toast.error(resultado.error || 'No se pudo cambiar la contraseña')
      }
    } catch (err) {
      toast.error('Error al cambiar contraseña')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'oklch(0 0 0 / .7)',
      backdropFilter: 'blur(4px)',
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        style={{
          width: '100%', maxWidth: 420,
          background: 'oklch(0.14 0.01 250 / .95)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border: '1px solid oklch(1 0 0 / .1)',
          borderRadius: 16,
          padding: '32px 32px 28px',
          boxShadow: '0 24px 60px oklch(0 0 0 / .5)',
          margin: 16,
        }}
      >
        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'oklch(0.66 0.22 25 / .15)',
            border: '1px solid oklch(0.66 0.22 25 / .3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <KeyRound size={18} color="oklch(0.70 0.18 25)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'oklch(0.98 0.01 250)' }}>
              {obligatorio ? 'Cambio de contraseña obligatorio' : 'Cambiar contraseña'}
            </h3>
            {obligatorio && (
              <p style={{ margin: '3px 0 0', fontSize: 12, color: 'oklch(0.78 0.02 250 / .55)' }}>
                Debes establecer una nueva contraseña para continuar
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Contraseña actual (solo cambio voluntario) */}
          {!obligatorio && (
            <div>
              <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Contraseña actual</label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'oklch(0.78 0.02 250 / .35)', pointerEvents: 'none' }} />
                <input
                  className="gym-input"
                  type={showActual ? 'text' : 'password'}
                  value={actual}
                  onChange={e => setActual(e.target.value)}
                  placeholder="contraseña actual"
                  style={{ paddingLeft: 34, paddingRight: 38, width: '100%' }}
                />
                <button type="button" onClick={() => setShowActual(v => !v)} tabIndex={-1}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.78 0.02 250 / .4)', padding: 3 }}>
                  {showActual ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          )}

          {/* Nueva contraseña */}
          <div>
            <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Nueva contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'oklch(0.78 0.02 250 / .35)', pointerEvents: 'none' }} />
              <input
                className="gym-input"
                type={showNueva ? 'text' : 'password'}
                value={nueva}
                onChange={e => setNueva(e.target.value)}
                placeholder="mínimo 6 caracteres"
                style={{ paddingLeft: 34, paddingRight: 38, width: '100%' }}
              />
              <button type="button" onClick={() => setShowNueva(v => !v)} tabIndex={-1}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.78 0.02 250 / .4)', padding: 3 }}>
                {showNueva ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Confirmar contraseña */}
          <div>
            <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Confirmar contraseña</label>
            <input
              className="gym-input"
              type="password"
              value={confirmar}
              onChange={e => setConfirmar(e.target.value)}
              placeholder="repetir nueva contraseña"
              style={{ width: '100%' }}
            />
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            {!obligatorio && (
              <button type="button" className="btn-secondary" onClick={onCerrar} style={{ flex: 1 }}>
                Cancelar
              </button>
            )}
            <motion.button
              type="submit"
              className="btn-primary"
              disabled={cargando}
              whileTap={{ scale: 0.97 }}
              style={{ flex: 2, fontSize: 13 }}
            >
              {cargando ? 'Guardando...' : 'Guardar contraseña'}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
