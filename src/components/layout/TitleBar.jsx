import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, Key, Shield, Minus, Maximize2, Minimize2, X, Bell } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { PAGES } from '../../constants'
import CambiarPasswordModal from '../../pages/CambiarPassword'
import TopNav from './TopNav'

// ─── Diálogo de confirmación de cierre ───────────────────────────────────────

function CloseConfirmDialog({ onConfirm, onCancel }) {
  const [noPreguntar, setNoPreguntar] = useState(false)
  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'oklch(0 0 0 / .75)',
      backdropFilter: 'blur(6px)',
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={{
          width: '100%', maxWidth: 380, margin: 16,
          background: 'oklch(0.15 0.015 250)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          border: '1px solid oklch(1 0 0 / .12)',
          borderRadius: 16,
          padding: '28px 28px 22px',
          boxShadow: '0 24px 60px oklch(0 0 0 / .7), inset 0 1px 0 oklch(1 0 0 / .1)',
        }}
      >
        <div style={{ fontSize: 22, marginBottom: 12, textAlign: 'center' }}>⚠️</div>
        <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: 'oklch(0.97 0.01 250)', textAlign: 'center' }}>
          ¿Cerrar Gimnasio?
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'oklch(0.78 0.02 250 / .65)', textAlign: 'center', lineHeight: 1.5 }}>
          Asegúrate de haber guardado los cambios pendientes antes de cerrar.
        </p>

        <label style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 20, cursor: 'pointer', userSelect: 'none',
          fontSize: 12, color: 'oklch(0.78 0.02 250 / .55)',
          justifyContent: 'center',
        }}>
          <input
            type="checkbox"
            checked={noPreguntar}
            onChange={e => setNoPreguntar(e.target.checked)}
            style={{ accentColor: 'oklch(0.66 0.22 25)', width: 14, height: 14 }}
          />
          No volver a preguntar
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn-secondary"
            onClick={onCancel}
            style={{ flex: 1, fontSize: 13 }}
          >
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={() => onConfirm(noPreguntar)}
            style={{ flex: 1.5, fontSize: 13 }}
          >
            Cerrar aplicación
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  )
}

// ─── Controles de ventana ─────────────────────────────────────────────────────

function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)

  function handleClose() {
    const skip = localStorage.getItem('skipCloseConfirm') === 'true'
    if (skip) {
      window.api?.close?.()
    } else {
      setShowCloseConfirm(true)
    }
  }

  function confirmClose(noPreguntar) {
    if (noPreguntar) localStorage.setItem('skipCloseConfirm', 'true')
    window.api?.close?.()
  }

  function handleMaximize() {
    window.api?.maximize?.()
    setIsMaximized(v => !v)
  }

  return (
    <>
      <div style={{ display: 'flex', WebkitAppRegion: 'no-drag', marginLeft: 8 }}>
        {/* Minimizar */}
        <button
          className="winbtn11"
          title="Minimizar"
          onClick={() => window.api?.minimize?.()}
        >
          <Minus size={13} strokeWidth={1.8} />
        </button>

        {/* Maximizar / Restaurar */}
        <button
          className="winbtn11"
          title={isMaximized ? 'Restaurar' : 'Maximizar'}
          onClick={handleMaximize}
        >
          {isMaximized
            ? <Minimize2 size={12} strokeWidth={1.8} />
            : <Maximize2 size={12} strokeWidth={1.8} />
          }
        </button>

        {/* Cerrar */}
        <button
          className="winbtn11 winbtn11-close"
          title="Cerrar"
          onClick={handleClose}
        >
          <X size={13} strokeWidth={1.8} />
        </button>
      </div>

      <AnimatePresence>
        {showCloseConfirm && (
          <CloseConfirmDialog
            onConfirm={confirmClose}
            onCancel={() => setShowCloseConfirm(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Dropdown del usuario (via Portal) ───────────────────────────────────────

function UserDropdownPortal({ open, pos, usuario, onClose, onCambioPass, onGestionUsuarios, onLogout }) {
  if (!open) return null

  return createPortal(
    <>
      {/* Overlay invisible para cerrar al hacer click fuera */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'transparent' }}
      />

      {/* Dropdown — fondo de vidrio real (::before/::after en index.css,
          ver .user-dropdown-panel), mismos filtros SVG que ya usa la
          barra (pack-upper + liquid-glass-new + fresnel, sin duplicar
          ids). El contenido va en .user-dropdown-content, z-index mayor
          que las dos capas de filtro — sólido, nunca parte del material. */}
      <motion.div
        className="user-dropdown-panel"
        initial={{ opacity: 0, y: -6, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.97 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          top: pos.bottom + 6,
          right: pos.right,
          zIndex: 9999,
          padding: '6px',
          minWidth: 220,
        }}
      >
        <div className="user-dropdown-content">
          {/* Info usuario */}
          <div style={{
            padding: '8px 10px 10px',
            borderBottom: '1px solid oklch(1 0 0 / .07)',
            marginBottom: 4,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'oklch(0.95 0.01 250)' }}>
              {usuario.nombre_completo}
            </div>
            <div style={{ fontSize: 11, color: 'oklch(0.78 0.02 250 / .45)', marginTop: 1 }}>
              @{usuario.username}
            </div>
            <div style={{ marginTop: 6 }}>
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '.08em',
                textTransform: 'uppercase',
                background: 'oklch(0.66 0.22 25 / .15)',
                border: '1px solid oklch(0.66 0.22 25 / .3)',
                color: 'oklch(0.70 0.18 25)',
                padding: '2px 8px', borderRadius: 20,
              }}>
                {usuario.rol_nombre}
              </span>
            </div>
          </div>

          <DropItem icon={Key} label="Cambiar contraseña" onClick={onCambioPass} />
          {usuario.rol_nombre === 'Administrador' && (
            <DropItem icon={Shield} label="Usuarios y Roles" onClick={onGestionUsuarios} />
          )}
          <div style={{ borderTop: '1px solid oklch(1 0 0 / .06)', marginTop: 4, paddingTop: 4 }} />
          <DropItem icon={LogOut} label="Cerrar sesión" onClick={onLogout} danger />
        </div>
      </motion.div>
    </>,
    document.body
  )
}

// ─── TitleBar principal ───────────────────────────────────────────────────────

export default function TitleBar() {
  const { usuario, logout } = useAuth()
  const { navigate } = useApp()
  const [showDropdown, setShowDropdown] = useState(false)
  const [dropPos, setDropPos] = useState({ bottom: 48, right: 16 })
  const [showCambioPass, setShowCambioPass] = useState(false)
  const [alertCount, setAlertCount] = useState(0)
  const [alertCriticas, setAlertCriticas] = useState(false)
  // Animación de "nueva notificación" — swingKey cambia SOLO cuando el
  // contador sube respecto al valor anterior; se usa como key de un
  // motion.div (ver abajo) para que React lo remonte y la animación de
  // keyframes se reproduzca una vez y se detenga (no un loop). prevCountRef
  // arranca en null para no disparar el swing en el primer fetch (eso
  // sería "loop molesto" al cargar la página, no "llegó algo nuevo").
  const [swingKey, setSwingKey] = useState(0)
  const prevAlertCountRef = useRef(null)
  const btnRef = useRef(null)

  useEffect(() => {
    if (!usuario) return
    async function fetchAlerts() {
      try {
        const [pv, v] = await Promise.all([
          window.api.membresias.getPorVencer(),
          window.api.membresias.getVencidas(),
        ])
        const total = (pv?.length || 0) + (v?.length || 0)
        const criticas = (pv || []).filter(m => (m.dias_restantes ?? 0) <= 2).length
        if (prevAlertCountRef.current !== null && total > prevAlertCountRef.current) {
          setSwingKey(k => k + 1)
        }
        prevAlertCountRef.current = total
        setAlertCount(total)
        setAlertCriticas(criticas > 0 || (v?.length || 0) > 0)
      } catch {}
    }
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [usuario])

  // Balanceo al ABRIR la app — dispara UNA vez al montar (deps [], no
  // depende de usuario/alertCount). Delay de 500ms para que no se sienta
  // simultáneo a las animaciones de entrada del resto de la barra
  // (dropdown, framer-motion de otros elementos). Reutiliza el MISMO
  // swingKey que ya dispara con alertCount y con el click de abajo — un
  // solo mecanismo, tres disparadores.
  useEffect(() => {
    const t = setTimeout(() => setSwingKey(k => k + 1), 500)
    return () => clearTimeout(t)
  }, [])

  const openDropdown = useCallback(() => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setDropPos({
        bottom: rect.bottom,
        right: window.innerWidth - rect.right,
      })
    }
    setShowDropdown(v => !v)
  }, [])

  const initiales = usuario?.nombre_completo
    ? usuario.nombre_completo.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  // Color determinista por nombre (igual que UserAvatar en GestionUsuarios)
  const AVATAR_COLORS = [
    'oklch(0.60 0.18 25)', 'oklch(0.55 0.20 250)', 'oklch(0.58 0.17 155)',
    'oklch(0.62 0.15 75)', 'oklch(0.57 0.19 300)', 'oklch(0.60 0.16 200)',
  ]
  function avatarColor(nombre = '') {
    let h = 0
    for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) & 0xffffffff
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
  }
  const colorAvatar = avatarColor(usuario?.nombre_completo || '')

  async function handleLogout() {
    setShowDropdown(false)
    await logout()
  }

  return (
    <>
      <div className="titlebar">
        {/* [ELIMINADO] .titlebar-glass-mask (máscara de bit-packing vía
            mix-blend-mode:plus-lighter) — diagnosticado y descartado con
            prueba de fondo rojo: reemplazando temporalmente el contenido
            real detrás de la barra por rojo puro, CON la máscara la barra
            seguía viéndose negra (rgb 12,12,12) pase lo que pase detrás;
            SIN la máscara, el rojo pasaba casi intacto (rgb 254,0,0).
            plus-lighter es un blend ADITIVO puro (min(1, fondo+fuente)) —
            matemáticamente no puede convertir rojo en negro. Eso prueba
            que el navegador NO estaba mezclando esta capa con mix-blend-mode
            como se esperaba: la pintaba OPACA (normal, no blend), tapando
            todo lo real detrás con el resultado casi-negro de #pack-lower
            (blanco escalado a ~1/255) — y ESE tapado corrompía además lo
            que #liquid-glass-new leía como fondo real, arruinando la
            transparencia para toda la barra, no solo donde estaba la
            máscara. Es una limitación real de Chromium combinando
            mix-blend-mode + filter:url(#svg) en este caso, no un valor de
            CSS mal puesto. Sin esta capa, ::before (#pack-upper) +
            ::after (#liquid-glass-new + #fresnel) SÍ dejan pasar el fondo
            real tal cual (mismo test: rojo se mantiene rojo). */}

        {/* Navegación horizontal (antes sidebar vertical) */}
        <TopNav />

        {/* Campana de alertas — vidrio, no fondo sólido: .bell-inner es
            SOLO box-shadow inset (bisel claro en reposo, "hundimiento"
            oscuro en hover) — nunca background-color, nunca un sistema
            de backdrop-filter aparte. Ya está sentada sobre el material
            compartido de .titlebar (::before/::after en index.css, la
            campana es descendiente con z-index:1 encima de ese vidrio),
            así que no necesita su propio backdrop-filter — sería
            redundante y reintroduciría el mismo riesgo de
            filter+mix-blend-mode que ya rompió .titlebar-glass-mask.
            Ícono y badge van en .bell-icon-wrap / el div del badge,
            ambos position:relative (o absolute con z-index implícito
            por orden de DOM) para quedar SIEMPRE encima de .bell-inner
            — 100% sólidos, nunca parte del material.
            swingKey>0 es lo que evita que el swing se reproduzca en el
            primer render (ver el useEffect de fetchAlerts arriba, que
            solo lo incrementa cuando el contador SUBE) — key={swingKey}
            remonta el <span> cada vez que sube, así la animación CSS se
            reproduce una vez desde el principio y se quita sola al
            terminar (onAnimationEnd), lista para la siguiente alerta. */}
        {usuario && (
          <div style={{ WebkitAppRegion: 'no-drag', marginRight: 4 }}>
            <button
              className="titlebar-bell"
              onClick={() => { navigate(PAGES.ALERTS); setSwingKey(k => k + 1) }}
              title="Ver alertas"
              style={{
                borderColor: alertCriticas ? 'rgba(255, 255, 255, .35)' : 'transparent',
                color: '#ffffff',
              }}
            >
              <span className="bell-inner" aria-hidden="true" />
              <span
                key={swingKey}
                className={`bell-icon-wrap${swingKey > 0 ? ' bell-ring-animate' : ''}`}
                onAnimationEnd={() => setSwingKey(0)}
              >
                <Bell size={15} strokeWidth={alertCriticas ? 2 : 1.6} />
              </span>
              {alertCount > 0 && (
                swingKey > 0 ? (
                  <motion.div
                    key={`badge-${swingKey}`}
                    className={alertCriticas ? 'badge-pulse' : ''}
                    initial={{ scale: 1 }}
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 0.4 }}
                    style={{
                      position: 'absolute', top: -4, right: -4,
                      minWidth: 16, height: 16, borderRadius: 8,
                      background: '#ffffff', border: '2px solid oklch(0.12 0.01 250)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 800, color: 'oklch(0.12 0.01 250)', padding: '0 3px',
                    }}
                  >
                    {alertCount > 99 ? '99+' : alertCount}
                  </motion.div>
                ) : (
                  <div
                    className={alertCriticas ? 'badge-pulse' : ''}
                    style={{
                      position: 'absolute', top: -4, right: -4,
                      minWidth: 16, height: 16, borderRadius: 8,
                      background: '#ffffff', border: '2px solid oklch(0.12 0.01 250)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 800, color: 'oklch(0.12 0.01 250)', padding: '0 3px',
                    }}
                  >
                    {alertCount > 99 ? '99+' : alertCount}
                  </div>
                )
              )}
            </button>
          </div>
        )}

        {/* Sesión de usuario — sin fondo/borde sólido propio, igual que la
            campana: se integra con el vidrio compartido de .titlebar en
            vez de verse como un bloque aparte (ver .titlebar-user-btn en
            index.css). El único estado que sigue inline es "abierto"
            (dropdown visible), como ya hacía la campana con el crítico. */}
        {usuario && (
          <div style={{ WebkitAppRegion: 'no-drag' }}>
            <button
              ref={btnRef}
              onClick={openDropdown}
              className="titlebar-user-btn"
              data-open={showDropdown || undefined}
              style={{
                color: 'oklch(0.95 0.01 250)',
              }}
            >
              {usuario?.foto ? (
                <img
                  src={usuario.foto}
                  alt={usuario.nombre_completo}
                  style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'cover', border: '1px solid oklch(1 0 0 / .2)', flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: 26, height: 26, borderRadius: 6,
                  background: colorAvatar,
                  border: '1px solid oklch(1 0 0 / .15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: 'white',
                  letterSpacing: '.04em', flexShrink: 0,
                }}>
                  {initiales}
                </div>
              )}
              <div className="titlebar-user-text" style={{ textAlign: 'left', lineHeight: 1.2 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'oklch(0.95 0.01 250)' }}>
                  {usuario.nombre_completo}
                </div>
                <div style={{
                  fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase',
                  color: 'oklch(0.78 0.02 250 / .5)',
                }}>
                  {usuario.rol_nombre}
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Controles de ventana */}
        <WindowControls />
      </div>

      {/* Dropdown via portal */}
      <AnimatePresence>
        {showDropdown && usuario && (
          <UserDropdownPortal
            open={showDropdown}
            pos={dropPos}
            usuario={usuario}
            onClose={() => setShowDropdown(false)}
            onCambioPass={() => { setShowDropdown(false); setShowCambioPass(true) }}
            onGestionUsuarios={() => { setShowDropdown(false); navigate(PAGES.GESTION_USUARIOS) }}
            onLogout={handleLogout}
          />
        )}
      </AnimatePresence>

      {/* Modal cambiar contraseña */}
      <AnimatePresence>
        {showCambioPass && (
          <CambiarPasswordModal onCerrar={() => setShowCambioPass(false)} />
        )}
      </AnimatePresence>
    </>
  )
}

function DropItem({ icon: Icon, label, onClick, danger = false }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '7px 10px', borderRadius: 7,
        background: hover ? 'oklch(1 0 0 / .06)' : 'transparent',
        border: 'none', cursor: 'pointer',
        color: danger
          ? (hover ? 'oklch(0.72 0.20 25)' : 'oklch(0.66 0.22 25)')
          : (hover ? 'oklch(0.98 0.01 250)' : 'oklch(0.78 0.02 250 / .8)'),
        fontSize: 12.5, transition: 'all .1s',
      }}
    >
      <Icon size={14} style={{ flexShrink: 0 }} />
      {label}
    </button>
  )
}
