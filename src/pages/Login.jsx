import { useState, useCallback, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Dumbbell, Lock, User, UserPlus, KeyRound, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useGlassCard } from '../glass-engine/useGlassCard'
import { useGlassButton } from '../glass-engine/useGlassButton'
import './Login.css'

// ─── Fondo "vidrio mojado" — dos fotos reales, una sobre otra ───────────────
// Abajo: login.png (limpia, fondo del div). Encima: sobre_login.png (con
// gotas, dibujada en el canvas). El cursor borra el canvas revelando la
// limpia debajo; el vaho vuelve a aparecer lento donde se limpió.

function LoginVidrio({ children }) {
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const animRef = useRef(null)
  const acumuladorRef = useRef(0)
  const lastTsRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.src = '/sobre_login.png'
    imgRef.current = img

    // Mismo cálculo matemático que CSS background-size:cover
    const drawCover = (targetCtx, image, w, h) => {
      const imgRatio = image.naturalWidth / image.naturalHeight
      const boxRatio = w / h
      let drawW, drawH, drawX, drawY
      if (imgRatio > boxRatio) {
        drawH = h
        drawW = drawH * imgRatio
        drawX = (w - drawW) / 2
        drawY = 0
      } else {
        drawW = w
        drawH = drawW / imgRatio
        drawX = 0
        drawY = (h - drawH) / 2
      }
      targetCtx.drawImage(image, drawX, drawY, drawW, drawH)
    }

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      if (img.complete) {
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = 1
        drawCover(ctx, img, canvas.width, canvas.height)
      }
    }

    img.onload = resize
    // Si la imagen ya está en caché del navegador (típico al volver del
    // logout — LoginVidrio se remonta y crea un <img> nuevo, pero el
    // navegador ya la tiene decodificada), img.complete puede quedar en
    // true ANTES de que se alcance a asignar img.onload — el evento
    // 'load' ya se disparó y nunca llega a este handler. Sin esto,
    // resize() nunca corre y el canvas se queda en su tamaño por
    // defecto (300x150), como si el fondo empañado no existiera.
    if (img.complete) resize()
    window.addEventListener('resize', resize)

    // ---- REEMPAÑADO: pasos discretos por tiempo acumulado ----
    // (evita el punto muerto de redondeo de canvas ya detectado antes)
    const PASO_ALPHA = 0.025
    const INTERVALO_MS = 150 // llega a ~opacidad total en ~15s

    const loop = (ts) => {
      if (!lastTsRef.current) lastTsRef.current = ts
      const delta = ts - lastTsRef.current
      lastTsRef.current = ts
      acumuladorRef.current += delta

      if (acumuladorRef.current >= INTERVALO_MS && img.complete) {
        acumuladorRef.current = 0
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = PASO_ALPHA
        drawCover(ctx, img, canvas.width, canvas.height)
        ctx.globalAlpha = 1
      }
      animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)

    // ---- LIMPIEZA CON EL CURSOR ----
    const limpiar = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      const radio = 110
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radio)
      grad.addColorStop(0, 'rgba(0,0,0,1)')
      grad.addColorStop(0.6, 'rgba(0,0,0,0.8)')
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(x, y, radio, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
    }

    const onMouseMove = (e) => limpiar(e.clientX, e.clientY)
    const onTouchMove = (e) => {
      e.preventDefault()
      limpiar(e.touches[0].clientX, e.touches[0].clientY)
    }

    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('touchmove', onTouchMove)
    }
  }, [])

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundImage: 'url(/login.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          zIndex: 2,
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div style={{ pointerEvents: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Formulario de inicio de sesión ──────────────────────────────────────────

function FormLogin({ onRegistrar, onRecuperar, onError }) {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [errores, setErrores] = useState({}) // { username?: string, password?: string }

  // Botón de vidrio (ver src/glass-engine/useGlassButton.js) — solo
  // INICIAR SESIÓN. Registrarse/Olvidé volvieron a texto plano.
  const submitBtnRef = useRef(null)
  useGlassButton(submitBtnRef, { channel: 'button', chroma: 'always' })

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
        <label className="gym-label" style={{ display: 'block', marginBottom: 6, color: '#ffffff' }}>Usuario</label>
        <div style={{ position: 'relative' }}>
          <User size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9a9aa2', pointerEvents: 'none' }} />
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
        <label className="gym-label" style={{ display: 'block', marginBottom: 6, color: '#ffffff' }}>Contraseña</label>
        <div style={{ position: 'relative' }}>
          <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9a9aa2', pointerEvents: 'none' }} />
          <input
            className={`gym-input${errores.password ? ' input-error' : ''}`}
            type={showPass ? 'text' : 'password'}
            placeholder="contraseña"
            value={password}
            onChange={e => { setPassword(e.target.value); limpiarError('password') }}
            autoComplete="current-password"
            style={{ paddingLeft: 38, paddingRight: 42, width: '100%' }}
          />
          <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9a9aa2', padding: 4, display: 'flex', alignItems: 'center' }} tabIndex={-1}>
            {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {errores.password && (
          <div className="input-error-msg"><AlertCircle size={11} />{errores.password}</div>
        )}
      </div>

      <motion.button
        ref={submitBtnRef}
        type="submit"
        className="btn-primary login-glass-btn"
        disabled={cargando}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        style={{ marginTop: 6, height: 48, fontSize: 'calc(14.95px * var(--login-font-scale, 1))', fontFamily: 'Oxanium, sans-serif', letterSpacing: '.12em', fontWeight: 700, borderColor: 'rgba(255,255,255,0.32)', boxShadow: 'inset 0px 30px 12px -21px rgba(255,255,255,0.32)' }}
      >
        {/* Único hijo estático del botón (ver useGlassButton) — el
            contenido condicional (spinner vs texto) vive adentro. */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          {cargando
            ? <>
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} style={{ width: 16, height: 16, border: '2px solid oklch(1 0 0 / .3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />
                Verificando...
              </>
            : 'INICIAR SESIÓN'
          }
        </span>
      </motion.button>

      <div className="login-bottom-links">
        <button type="button" onClick={onRegistrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'calc(13.8px * var(--login-font-scale, 1))', fontWeight: 600, color: '#60A5FA', opacity: 1, textShadow: '0 1px 4px rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <UserPlus size={12} /> Registrarse
        </button>
        <button type="button" onClick={onRecuperar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'calc(13.8px * var(--login-font-scale, 1))', fontWeight: 600, color: '#E2E8F0', opacity: 1, textShadow: '0 1px 4px rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <KeyRound size={12} /> Olvidé mi contraseña
        </button>
      </div>
    </form>
  )
}

// ─── Botón volver reutilizable ────────────────────────────────────────────────

function BtnVolver({ onClick }) {
  // Botón de vidrio (ver src/glass-engine/useGlassButton.js) — mismo
  // tratamiento que INICIAR SESIÓN/CREAR CUENTA/CAMBIAR CONTRASEÑA.
  const btnRef = useRef(null)
  useGlassButton(btnRef, { channel: 'button', chroma: 'always' })

  return (
    <motion.button
      ref={btnRef}
      type="button"
      onClick={onClick}
      className="login-glass-btn"
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        width: 'fit-content', alignSelf: 'flex-start',
        padding: '8px 16px', marginBottom: 8,
        borderRadius: 10,
        cursor: 'pointer',
        fontSize: 'calc(12px * var(--login-font-scale, 1))', fontWeight: 500,
        color: '#b8b8c0',
        whiteSpace: 'nowrap',
        transition: 'color .15s',
      }}
    >
      <span style={{ whiteSpace: 'nowrap' }}>← Volver</span>
    </motion.button>
  )
}

// ─── Formulario de Registro ───────────────────────────────────────────────────

function FormRegistrar({ onVolver }) {
  const [form, setForm] = useState({ nombre_completo: '', carnet: '', telefono: '', password: '', confirmar: '' })
  const [showPass, setShowPass] = useState(false)
  const [cargando, setCargando] = useState(false)

  // Botón de vidrio (ver src/glass-engine/useGlassButton.js).
  const submitBtnRef = useRef(null)
  useGlassButton(submitBtnRef, { channel: 'button', chroma: 'always' })

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
        <label className="gym-label" style={{ display: 'block', marginBottom: 5, color: '#ffffff' }}>Nombre completo *</label>
        <input className="gym-input" value={form.nombre_completo} onChange={e => set('nombre_completo', e.target.value)} placeholder="Nombre Apellido" autoFocus style={{ width: '100%' }} />
      </div>
      <div className="login-grid-2">
        <div>
          <label className="gym-label" style={{ display: 'block', marginBottom: 5, color: '#ffffff' }}>Carnet / CI *</label>
          <input className="gym-input" value={form.carnet} onChange={e => set('carnet', e.target.value)} placeholder="Carnet de identidad" style={{ width: '100%' }} />
        </div>
        <div>
          <label className="gym-label" style={{ display: 'block', marginBottom: 5, color: '#ffffff' }}>Celular *</label>
          <input className="gym-input" value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="7XXXXXXX" style={{ width: '100%' }} />
        </div>
      </div>
      <div className="login-grid-2">
        <div>
          <label className="gym-label" style={{ display: 'block', marginBottom: 5, color: '#ffffff' }}>Contraseña *</label>
          <div style={{ position: 'relative' }}>
            <input className="gym-input" type={showPass ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)} placeholder="mín. 6 caracteres" style={{ width: '100%', paddingRight: 36 }} />
            <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9a9aa2', padding: 2, display: 'flex' }} tabIndex={-1}>
              {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>
        <div>
          <label className="gym-label" style={{ display: 'block', marginBottom: 5, color: '#ffffff' }}>Confirmar *</label>
          <input className="gym-input" type="password" value={form.confirmar} onChange={e => set('confirmar', e.target.value)} placeholder="repetir" style={{ width: '100%' }} />
        </div>
      </div>
      <button ref={submitBtnRef} type="submit" className="btn-primary login-glass-btn" disabled={cargando} style={{ marginTop: 4, height: 44, fontSize: 'calc(14.95px * var(--login-font-scale, 1))', fontFamily: 'Oxanium, sans-serif', letterSpacing: '.1em', fontWeight: 700, borderColor: 'rgba(255,255,255,0.32)', boxShadow: 'inset 0px 30px 12px -21px rgba(255,255,255,0.32)' }}>
        {cargando ? 'Registrando...' : 'CREAR CUENTA'}
      </button>
      <p style={{ fontSize: 'calc(11px * var(--login-font-scale, 1))', color: '#8a8a92', textAlign: 'center', margin: 0 }}>
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

  // Botón de vidrio (ver src/glass-engine/useGlassButton.js).
  const submitBtnRef = useRef(null)
  useGlassButton(submitBtnRef, { channel: 'button', chroma: 'always' })

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
        <label className="gym-label" style={{ display: 'block', marginBottom: 5, color: '#ffffff' }}>Carnet / CI *</label>
        <input className="gym-input" value={carnet} onChange={handleCarnetChange} placeholder="Tu número de carnet (solo números)" autoFocus style={{ width: '100%', borderColor: errorCarnet ? 'oklch(0.65 0.18 25)' : undefined }} />
        {errorCarnet && (
          <p style={{ color: 'oklch(0.65 0.18 25)', fontSize: 'calc(11px * var(--login-font-scale, 1))', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={11} /> {errorCarnet}
          </p>
        )}
      </div>
      <div>
        <label className="gym-label" style={{ display: 'block', marginBottom: 5, color: '#ffffff' }}>Nueva contraseña *</label>
        <div style={{ position: 'relative' }}>
          <input className="gym-input" type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="mín. 6 caracteres" style={{ width: '100%', paddingRight: 36 }} />
          <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9a9aa2', padding: 2, display: 'flex' }} tabIndex={-1}>
            {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
      </div>
      <div>
        <label className="gym-label" style={{ display: 'block', marginBottom: 5, color: '#ffffff' }}>Confirmar contraseña *</label>
        <input className="gym-input" type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} placeholder="repetir" style={{ width: '100%' }} />
      </div>
      <button ref={submitBtnRef} type="submit" className="btn-primary login-glass-btn" disabled={cargando} style={{ marginTop: 4, height: 44, fontSize: 'calc(14.95px * var(--login-font-scale, 1))', fontFamily: 'Oxanium, sans-serif', letterSpacing: '.1em', fontWeight: 700, borderColor: 'rgba(255,255,255,0.32)', boxShadow: 'inset 0px 30px 12px -21px rgba(255,255,255,0.32)' }}>
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

// ─── Logo + título — se repite en AMBAS caras del flip (front/back son
// nodos 3D independientes, no se puede compartir un único elemento
// entre las dos) ──────────────────────────────────────────────────────
function LogoTitulo({ titulo, shakeKey, logoGlow }) {
  return (
    <motion.div
      key={shakeKey}
      variants={SHAKE_VARIANTS}
      animate={shakeKey > 0 ? 'shake' : 'idle'}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}
    >
      <div
        className={`login-logo${logoGlow ? ' login-error-glow' : ''}`}
        style={{ marginBottom: 14 }}
      >
        <img
          src="/logo.png"
          alt="Gimnasio"
          style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'transparent' }}
          onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex' }}
        />
        <div style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
          <Dumbbell size={34} color="oklch(0.66 0.22 25)" />
        </div>
      </div>

      <h1
        style={{
          fontSize: 'clamp(calc(17.25px * var(--login-font-scale, 1)), calc(4.6vw * var(--login-font-scale, 1)), calc(23px * var(--login-font-scale, 1)))',
          fontFamily: 'Oxanium, sans-serif',
          letterSpacing: '.18em',
          fontWeight: 700,
          margin: 0,
          textAlign: 'center',
          color: '#ffffff',
          filter: logoGlow
            ? 'drop-shadow(0 1px 2px rgba(0,0,0,.8)) drop-shadow(0 0 8px oklch(0.66 0.22 25 / .6))'
            : 'drop-shadow(0 1px 2px rgba(0,0,0,.8))',
          transition: 'filter .2s',
        }}
      >
        GIMNASIO
      </h1>
      <p style={{ color: '#d0d0d5', fontSize: 'calc(12.65px * var(--login-font-scale, 1))', letterSpacing: '.1em', textTransform: 'uppercase', margin: '5px 0 0' }}>
        {titulo}
      </p>
    </motion.div>
  )
}

// ─── Pie de página — idéntico en ambas caras, se repite por el mismo
// motivo que LogoTitulo (front/back son nodos 3D independientes) ─────
function PieSesion() {
  return (
    <p style={{ textAlign: 'center', marginTop: 22, fontSize: 'calc(12.65px * var(--login-font-scale, 1))', color: '#7a7a82', letterSpacing: '.06em' }}>
      Sesión segura · v1.0.0
    </p>
  )
}

export default function Login() {
  const [vista, setVista] = useState('login') // 'login' | 'registrar' | 'recuperar'
  const [shakeKey, setShakeKey] = useState(0)
  const [logoGlow, setLogoGlow] = useState(false)
  const frontCardRef = useRef(null)
  const backCardRef = useRef(null)

  // GlassCard (motor de vidrio líquido, ver src/glass-engine/) — DOS
  // instancias independientes, una por cara del flip, no una compartida
  // afuera. Motivo: GlassCard escribe su PROPIO transform (tilt) en el
  // nodo que referencia, en cada frame. .login-flip-back necesita un
  // transform ESTÁTICO propio (rotateY(180deg), para quedar "derecha"
  // una vez que .login-flip-inner complete su giro de 180°) — si el
  // vidrio viviera en ESE MISMO nodo, el tilt de GlassCard pisaría ese
  // rotateY estático cada frame (gana el último que escribe
  // style.transform) y la cara trasera se vería invertida/rota mal.
  // Por eso el vidrio vive en un hijo de cada cara, no en la cara
  // misma — así el tilt de cada instancia y el rotateY estático del
  // padre son transforms de DOS nodos distintos, se componen sin
  // pisarse (mismo principio que ya se usaba entre .login-outer y la
  // card: nunca mezclar dos transforms independientes en un solo nodo).
  // maxTilt:0 — el tilt normal de GlassCard escribe cada frame
  // `transform: perspective(1000px) rotateX(...) rotateY(...)` sobre
  // este nodo. Anidado dentro del perspective/preserve-3d del flip,
  // ese perspective() propio se compone con el del padre y Chromium
  // deja de poder hacer hit-test hacia los hijos (clicks reales caen
  // en .login-flip-front en vez del botón, aunque el layout se vea
  // bien) — confirmado forzando transform:none en devtools, el click
  // empieza a resolver correctamente. maxTilt:0 (opción ya soportada
  // por GlassCard, ver core/card.js) neutraliza esa rotación sin
  // tocar el motor: el parallax del contenido (translate 2D, no 3D)
  // sigue intacto.
  useGlassCard(frontCardRef, { maxTilt: 0 })
  useGlassCard(backCardRef, { maxTilt: 0 })

  const titulos = { login: 'Sistema de Gestión', registrar: 'Crear Cuenta', recuperar: 'Recuperar Contraseña' }

  const handleError = useCallback(() => {
    setShakeKey(k => k + 1)
    setLogoGlow(true)
    setTimeout(() => setLogoGlow(false), 700)
  }, [])

  return (
    <LoginVidrio>
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'safe center', justifyContent: 'safe center', zIndex: 10, padding: '16px', pointerEvents: 'none' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className={`login-outer${vista === 'registrar' ? ' login-outer--wide' : ''}`}
          style={{ pointerEvents: 'auto' }}
        >
          {/* ── Flip 3D de la card COMPLETA — el vidrio (borde, sombra,
              blur) vive DENTRO de cada cara y gira junto con ella, no en
              un marco exterior fijo. Ver notas arriba (useGlassCard x2)
              sobre por qué el vidrio no puede vivir directamente en
              .login-flip-front/.login-flip-back. */}
          <div className="login-flip-container">
            <div className={`login-flip-inner${vista !== 'login' ? ' is-flipped' : ''}`}>
              <div className="login-flip-front">
                <div
                  ref={frontCardRef}
                  data-glass="card"
                  className="login-glass-card"
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 28,
                    '--glass-tint': 'rgba(10, 12, 15, 0.20)',
                  }}
                >
                  {/* ── Único hijo estático de frontCardRef (ver nota de useGlassCard) ── */}
                  <div className="login-card-body">
                    <LogoTitulo titulo={titulos.login} shakeKey={shakeKey} logoGlow={logoGlow} />
                    <FormLogin
                      onRegistrar={() => setVista('registrar')}
                      onRecuperar={() => setVista('recuperar')}
                      onError={handleError}
                    />
                    <PieSesion />
                  </div>
                </div>
              </div>
              <div className="login-flip-back">
                <div
                  ref={backCardRef}
                  data-glass="card"
                  className="login-glass-card"
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 28,
                    '--glass-tint': 'rgba(10, 12, 15, 0.20)',
                  }}
                >
                  {/* ── Único hijo estático de backCardRef (ver nota de useGlassCard) ── */}
                  <div className="login-card-body">
                    <LogoTitulo titulo={vista === 'registrar' ? titulos.registrar : titulos.recuperar} shakeKey={0} logoGlow={false} />
                    {vista === 'registrar' && <FormRegistrar onVolver={() => setVista('login')} />}
                    {vista === 'recuperar' && <FormRecuperar onVolver={() => setVista('login')} />}
                    <PieSesion />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </LoginVidrio>
  )
}
