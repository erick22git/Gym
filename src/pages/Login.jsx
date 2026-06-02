import { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Dumbbell, Lock, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() || !password) return
    setCargando(true)
    try {
      const resultado = await login(username.trim(), password)
      if (!resultado.ok) {
        toast.error(resultado.error || 'Credenciales incorrectas')
      }
      // Si ok → AuthContext setea usuario → AppRoot renderiza app (con modal si primer_login)
    } catch (err) {
      toast.error('Error al iniciar sesión')
    } finally {
      setCargando(false)
    }
  }

  return (
    <>
      {/* Fondo atmosférico */}
      <div className="bg-atmospheric" />

      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10,
        padding: 24,
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{
            width: '100%',
            maxWidth: 420,
            background: 'oklch(0.14 0.01 250 / .85)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            border: '1px solid oklch(1 0 0 / .1)',
            borderRadius: 20,
            padding: '48px 40px 40px',
            boxShadow: '0 32px 80px oklch(0 0 0 / .6), inset 0 1px 0 oklch(1 0 0 / .08)',
          }}
        >
          {/* Logo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
            <div style={{
              width: 80, height: 80,
              borderRadius: 20,
              overflow: 'hidden',
              border: '2px solid oklch(0.66 0.22 25 / .5)',
              boxShadow: '0 0 32px oklch(0.66 0.22 25 / .35)',
              marginBottom: 16,
            }}>
              <img
                src="/logo.jpg"
                alt="Urban Fitness Club"
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
                onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex' }}
              />
              <div style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', background: 'oklch(0.20 0.02 250)' }}>
                <Dumbbell size={36} color="oklch(0.66 0.22 25)" />
              </div>
            </div>

            <h1 className="silver" style={{
              fontSize: 20,
              fontFamily: 'Oxanium, sans-serif',
              letterSpacing: '.18em',
              fontWeight: 700,
              margin: 0,
              textAlign: 'center',
            }}>
              URBAN FITNESS CLUB
            </h1>
            <p style={{
              color: 'oklch(0.78 0.02 250 / .55)',
              fontSize: 12,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              margin: '6px 0 0',
            }}>
              Sistema de Gestión
            </p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Usuario */}
            <div style={{ position: 'relative' }}>
              <label className="gym-label" style={{ display: 'block', marginBottom: 6 }}>
                Usuario
              </label>
              <div style={{ position: 'relative' }}>
                <User
                  size={15}
                  style={{
                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                    color: 'oklch(0.78 0.02 250 / .35)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  className="gym-input"
                  type="text"
                  placeholder="nombre de usuario"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  style={{ paddingLeft: 38, width: '100%' }}
                />
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <label className="gym-label" style={{ display: 'block', marginBottom: 6 }}>
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={15}
                  style={{
                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                    color: 'oklch(0.78 0.02 250 / .35)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  className="gym-input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="contraseña"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  style={{ paddingLeft: 38, paddingRight: 42, width: '100%' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'oklch(0.78 0.02 250 / .4)',
                    padding: 4, borderRadius: 4,
                    display: 'flex', alignItems: 'center',
                  }}
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Botón */}
            <motion.button
              type="submit"
              className="btn-primary"
              disabled={cargando}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              style={{
                marginTop: 8,
                height: 48,
                fontSize: 13,
                fontFamily: 'Oxanium, sans-serif',
                letterSpacing: '.12em',
                fontWeight: 700,
              }}
            >
              {cargando ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    style={{ width: 16, height: 16, border: '2px solid oklch(1 0 0 / .3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }}
                  />
                  Verificando...
                </span>
              ) : 'INICIAR SESIÓN'}
            </motion.button>
          </form>

          {/* Footer */}
          <p style={{
            textAlign: 'center',
            marginTop: 24,
            fontSize: 11,
            color: 'oklch(0.78 0.02 250 / .28)',
            letterSpacing: '.06em',
          }}>
            Sesión segura · v1.0.0
          </p>
        </motion.div>
      </div>
    </>
  )
}
