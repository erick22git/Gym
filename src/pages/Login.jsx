import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Dumbbell, Lock, User, ArrowLeft, UserPlus, KeyRound, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

// ─── Formulario de inicio de sesión ──────────────────────────────────────────

function FormLogin({ onRegistrar, onRecuperar, onError }) {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [errores, setErrores] = useState({}) // { username?: string, password?: string }

  function limpiarError(campo) {
    if (errores[campo]) setErrores(e => ({ ...e, [campo]: undefined }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() && !password) {
      setErrores({ username: 'Ingresa tu usuario o carnet', password: 'Ingresa tu contraseña' })
      onError()
      return
    }
    if (!username.trim()) { setErrores({ username: 'Ingresa tu usuario o carnet' }); onError(); return }
    if (!password) { setErrores({ password: 'Ingresa tu contraseña' }); onError(); return }

    setCargando(true)
    try {
      const resultado = await login(username.trim(), password)
      if (!resultado.ok) {
        const msg = resultado.error || 'Credenciales incorrectas'
        if (msg === 'Usuario no encontrado') {
          setErrores({ username: 'Usuario o carnet no encontrado' })
        } else if (msg === 'Contraseña incorrecta') {
          setErrores({ password: 'Contraseña incorrecta' })
        } else if (msg === 'Usuario desactivado') {
          setErrores({ username: 'Esta cuenta está desactivada' })
        } else {
          setErrores({ password: msg })
        }
        onError()
      }
    } catch { toast.error('Error al iniciar sesión') }
    finally { setCargando(false) }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label className="gym-label" style={{ display: 'block', marginBottom: 6 }}>Usuario</label>
        <div style={{ position: 'relative' }}>
          <User size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'oklch(0.78 0.02 250 / .35)', pointerEvents: 'none' }} />
          <input
            className={`gym-input${errores.username ? ' input-error' : ''}`}
            type="text"
            placeholder="usuario o carnet"
            value={username}
            onChange={e => { setUsername(e.target.value); limpiarError('username') }}
            autoComplete="username"
            autoFocus
            style={{ paddingLeft: 38, width: '100%' }}
          />
        </div>
        {errores.username && (
          <div className="input-error-msg"><AlertCircle size={11} />{errores.username}</div>
        )}
      </div>

      <div>
        <label className="gym-label" style={{ display: 'block', marginBottom: 6 }}>Contraseña</label>
        <div style={{ position: 'relative' }}>
          <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'oklch(0.78 0.02 250 / .35)', pointerEvents: 'none' }} />
          <input
            className={`gym-input${errores.password ? ' input-error' : ''}`}
            type={showPass ? 'text' : 'password'}
            placeholder="contraseña"
            value={password}
            onChange={e => { setPassword(e.target.value); limpiarError('password') }}
            autoComplete="current-password"
            style={{ paddingLeft: 38, paddingRight: 42, width: '100%' }}
          />
          <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.78 0.02 250 / .4)', padding: 4, display: 'flex', alignItems: 'center' }} tabIndex={-1}>
            {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {errores.password && (
          <div className="input-error-msg"><AlertCircle size={11} />{errores.password}</div>
        )}
      </div>

      <motion.button
        type="submit"
        className="btn-primary"
        disabled={cargando}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        style={{ marginTop: 6, height: 48, fontSize: 13, fontFamily: 'Oxanium, sans-serif', letterSpacing: '.12em', fontWeight: 700 }}
      >
        {cargando
          ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} style={{ width: 16, height: 16, border: '2px solid oklch(1 0 0 / .3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />
              Verificando...
            </span>
          : 'INICIAR SESIÓN'
        }
      </motion.button>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <button type="button" onClick={onRegistrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'oklch(0.74 0.13 250)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <UserPlus size={12} /> Registrarse
        </button>
        <button type="button" onClick={onRecuperar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'oklch(0.78 0.02 250 / .5)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <KeyRound size={12} /> Olvidé mi contraseña
        </button>
      </div>
    </form>
  )
}

// ─── Botón volver reutilizable ────────────────────────────────────────────────

function BtnVolver({ onClick }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.01, background: 'oklch(0.24 0.02 250 / .6)' }}
      whileTap={{ scale: 0.98 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', padding: '9px 16px', marginBottom: 8,
        background: 'oklch(0.20 0.02 250 / .5)',
        border: '1px solid oklch(1 0 0 / .12)',
        borderRadius: 10,
        cursor: 'pointer',
        fontSize: 12, fontWeight: 500,
        color: 'oklch(0.78 0.02 250 / .75)',
        transition: 'color .15s',
      }}
    >
      <ArrowLeft size={13} />
      Volver al login
    </motion.button>
  )
}

// ─── Formulario de Registro ───────────────────────────────────────────────────

function FormRegistrar({ onVolver }) {
  const [form, setForm] = useState({ nombre_completo: '', carnet: '', telefono: '', password: '', confirmar: '' })
  const [showPass, setShowPass] = useState(false)
  const [cargando, setCargando] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre_completo.trim()) { toast.error('El nombre completo es obligatorio'); return }
    if (!form.carnet.trim()) { toast.error('El carnet es obligatorio'); return }
    if (!form.telefono.trim()) { toast.error('El celular es obligatorio'); return }
    if (!form.password) { toast.error('La contraseña es obligatoria'); return }
    if (form.password.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return }
    if (form.password !== form.confirmar) { toast.error('Las contraseñas no coinciden'); return }
    setCargando(true)
    try {
      const r = await window.api.usuarios.registrar({
        nombre_completo: form.nombre_completo.trim(),
        carnet: form.carnet.trim(),
        telefono: form.telefono.trim(),
        password: form.password,
      })
      if (r.ok) {
        await window.api.auditoria.log({ accion: 'USUARIO_REGISTRADO', modulo: 'auth', detalle: `Usuario registrado: ${form.nombre_completo} · CI ${form.carnet}`, usuario_nombre: form.nombre_completo })
        toast.success('¡Cuenta creada! Inicia sesión con tu carnet de identidad.')
        onVolver()
      } else {
        toast.error(r.error || 'Error al registrar')
      }
    } catch { toast.error('Error al registrar') }
    finally { setCargando(false) }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <BtnVolver onClick={onVolver} />
      <div>
        <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Nombre completo *</label>
        <input className="gym-input" value={form.nombre_completo} onChange={e => set('nombre_completo', e.target.value)} placeholder="Nombre Apellido" autoFocus style={{ width: '100%' }} />
      </div>
      <div className="login-grid-2">
        <div>
          <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Carnet / CI *</label>
          <input className="gym-input" value={form.carnet} onChange={e => set('carnet', e.target.value)} placeholder="Carnet de identidad" style={{ width: '100%' }} />
        </div>
        <div>
          <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Celular *</label>
          <input className="gym-input" value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="7XXXXXXX" style={{ width: '100%' }} />
        </div>
      </div>
      <div className="login-grid-2">
        <div>
          <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Contraseña *</label>
          <div style={{ position: 'relative' }}>
            <input className="gym-input" type={showPass ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)} placeholder="mín. 6 caracteres" style={{ width: '100%', paddingRight: 36 }} />
            <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.78 0.02 250 / .4)', padding: 2, display: 'flex' }} tabIndex={-1}>
              {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>
        <div>
          <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Confirmar *</label>
          <input className="gym-input" type="password" value={form.confirmar} onChange={e => set('confirmar', e.target.value)} placeholder="repetir" style={{ width: '100%' }} />
        </div>
      </div>
      <button type="submit" className="btn-primary" disabled={cargando} style={{ marginTop: 4, height: 44, fontSize: 13, fontFamily: 'Oxanium, sans-serif', letterSpacing: '.1em', fontWeight: 700 }}>
        {cargando ? 'Registrando...' : 'CREAR CUENTA'}
      </button>
      <p style={{ fontSize: 11, color: 'oklch(0.78 0.02 250 / .35)', textAlign: 'center', margin: 0 }}>
        Tu cuenta se crea con rol Cajero. El admin puede cambiar tu rol.
      </p>
    </form>
  )
}

// ─── Formulario Recuperar contraseña ─────────────────────────────────────────

function FormRecuperar({ onVolver }) {
  const [carnet, setCarnet] = useState('')
  const [errorCarnet, setErrorCarnet] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [cargando, setCargando] = useState(false)

  function handleCarnetChange(e) {
    const valor = e.target.value
    setCarnet(valor)
    if (valor.trim().length > 0 && !/^[0-9]*$/.test(valor.trim())) {
      setErrorCarnet('Ingresa tu número de carnet, no tu nombre de usuario')
    } else {
      setErrorCarnet('')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!carnet.trim()) { toast.error('Ingresa tu carnet'); return }
    if (!/^[0-9]+$/.test(carnet.trim())) {
      setErrorCarnet('Ingresa tu número de carnet, no tu nombre de usuario')
      return
    }
    if (!password) { toast.error('Ingresa la nueva contraseña'); return }
    if (password.length < 6) { toast.error('Mínimo 6 caracteres'); return }
    if (password !== confirmar) { toast.error('Las contraseñas no coinciden'); return }
    setCargando(true)
    try {
      const r = await window.api.usuarios.cambiarPasswordPorCarnet(carnet.trim(), password)
      if (r.ok) {
        await window.api.auditoria.log({ accion: 'CAMBIO_CONTRASENA_RECUPERACION', modulo: 'auth', detalle: `Contraseña recuperada para usuario: ${r.nombre} · CI ${carnet}`, usuario_nombre: r.nombre || 'Desconocido' })
        toast.success('Contraseña actualizada. Puedes iniciar sesión.')
        onVolver()
      } else {
        toast.error(r.error || 'Error al cambiar contraseña')
      }
    } catch { toast.error('Error al cambiar contraseña') }
    finally { setCargando(false) }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <BtnVolver onClick={onVolver} />
      <div>
        <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Carnet / CI *</label>
        <input className="gym-input" value={carnet} onChange={handleCarnetChange} placeholder="Tu número de carnet (solo números)" autoFocus style={{ width: '100%', borderColor: errorCarnet ? 'oklch(0.65 0.18 25 / .6)' : undefined }} />
        {errorCarnet && (
          <p style={{ color: 'oklch(0.65 0.18 25)', fontSize: 11, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={11} /> {errorCarnet}
          </p>
        )}
      </div>
      <div>
        <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Nueva contraseña *</label>
        <div style={{ position: 'relative' }}>
          <input className="gym-input" type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="mín. 6 caracteres" style={{ width: '100%', paddingRight: 36 }} />
          <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.78 0.02 250 / .4)', padding: 2, display: 'flex' }} tabIndex={-1}>
            {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
      </div>
      <div>
        <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Confirmar contraseña *</label>
        <input className="gym-input" type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} placeholder="repetir" style={{ width: '100%' }} />
      </div>
      <button type="submit" className="btn-primary" disabled={cargando} style={{ marginTop: 4, height: 44, fontSize: 13, fontFamily: 'Oxanium, sans-serif', letterSpacing: '.1em', fontWeight: 700 }}>
        {cargando ? 'Actualizando...' : 'CAMBIAR CONTRASEÑA'}
      </button>
    </form>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

const SHAKE_VARIANTS = {
  idle: { x: 0 },
  shake: {
    x: [0, -9, 9, -7, 7, -4, 4, 0],
    transition: { duration: 0.52, ease: 'easeInOut' },
  },
}

export default function Login() {
  const [vista, setVista] = useState('login') // 'login' | 'registrar' | 'recuperar'
  const [shakeKey, setShakeKey] = useState(0)
  const [logoGlow, setLogoGlow] = useState(false)

  const titulos = { login: 'Sistema de Gestión', registrar: 'Crear Cuenta', recuperar: 'Recuperar Contraseña' }

  const handleError = useCallback(() => {
    setShakeKey(k => k + 1)
    setLogoGlow(true)
    setTimeout(() => setLogoGlow(false), 700)
  }, [])

  return (
    <>
      <div className="bg-atmospheric" />
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: '16px' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{
            width: '100%',
            maxWidth: vista === 'registrar' ? 480 : 420,
            background: 'oklch(0.14 0.01 250 / .85)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            border: '1px solid oklch(1 0 0 / .1)',
            borderRadius: 20,
            padding: 'clamp(24px, 5vw, 48px) clamp(20px, 5vw, 40px) clamp(20px, 4vw, 40px)',
            boxShadow: '0 32px 80px oklch(0 0 0 / .6), inset 0 1px 0 oklch(1 0 0 / .08)',
          }}
        >
          {/* ── Logo (shake en error) ── */}
          <motion.div
            key={shakeKey}
            variants={SHAKE_VARIANTS}
            animate={shakeKey > 0 ? 'shake' : 'idle'}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}
          >
            <div
              className={logoGlow ? 'login-error-glow' : ''}
              style={{
                width: 76, height: 76,
                borderRadius: 18,
                overflow: 'hidden',
                border: `2px solid ${logoGlow ? 'oklch(0.66 0.22 25 / .8)' : 'oklch(0.66 0.22 25 / .5)'}`,
                boxShadow: '0 0 32px oklch(0.66 0.22 25 / .35)',
                marginBottom: 14,
                transition: 'border-color .2s',
              }}
            >
              <img
                src="/logo.jpg"
                alt="Urban Fitness Club"
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
                onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex' }}
              />
              <div style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', background: 'oklch(0.20 0.02 250)' }}>
                <Dumbbell size={34} color="oklch(0.66 0.22 25)" />
              </div>
            </div>

            <h1
              className="silver"
              style={{
                fontSize: 'clamp(15px, 4vw, 20px)',
                fontFamily: 'Oxanium, sans-serif',
                letterSpacing: '.18em',
                fontWeight: 700,
                margin: 0,
                textAlign: 'center',
                filter: logoGlow ? 'drop-shadow(0 0 8px oklch(0.66 0.22 25 / .6))' : undefined,
                transition: 'filter .2s',
              }}
            >
              URBAN FITNESS CLUB
            </h1>
            <p style={{ color: 'oklch(0.78 0.02 250 / .55)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', margin: '5px 0 0' }}>
              {titulos[vista]}
            </p>
          </motion.div>

          {/* ── Formularios ── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={vista}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {vista === 'login' && (
                <FormLogin
                  onRegistrar={() => setVista('registrar')}
                  onRecuperar={() => setVista('recuperar')}
                  onError={handleError}
                />
              )}
              {vista === 'registrar' && <FormRegistrar onVolver={() => setVista('login')} />}
              {vista === 'recuperar' && <FormRecuperar onVolver={() => setVista('login')} />}
            </motion.div>
          </AnimatePresence>

          <p style={{ textAlign: 'center', marginTop: 22, fontSize: 11, color: 'oklch(0.78 0.02 250 / .28)', letterSpacing: '.06em' }}>
            Sesión segura · v1.0.0
          </p>
        </motion.div>
      </div>
    </>
  )
}
