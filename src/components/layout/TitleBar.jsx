import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, Key, Shield, Minus, Maximize2, Minimize2, X, Bell } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { PAGES } from '../../constants'
import CambiarPasswordModal from '../../pages/CambiarPassword'

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
          ¿Cerrar Urban Fitness Club?
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

      {/* Dropdown */}
      <motion.div
        initial={{ opacity: 0, y: -6, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.97 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          top: pos.bottom + 6,
          right: pos.right,
          zIndex: 9999,
          background: 'oklch(0.15 0.015 250)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          border: '1px solid oklch(1 0 0 / .14)',
          borderRadius: 12,
          padding: '6px',
          minWidth: 220,
          boxShadow: '0 20px 60px oklch(0 0 0 / .8), inset 0 1px 0 oklch(1 0 0 / .1)',
        }}
      >
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
        setAlertCount(total)
        setAlertCriticas(criticas > 0 || (v?.length || 0) > 0)
      } catch {}
    }
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [usuario])

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

  async function handleLogout() {
    setShowDropdown(false)
    await logout()
  }

  return (
    <>
      <div className="titlebar">
        {/* Marca */}
        <div className="titlebar-brand" style={{ WebkitAppRegion: 'no-drag' }}>
          <img
            src="/logo.jpg"
            alt="Urban Fitness Club"
            style={{
              width: 32, height: 32,
              objectFit: 'cover', objectPosition: 'center 30%',
              borderRadius: 7,
              border: '1px solid oklch(0.66 0.22 25 / .4)',
              filter: 'drop-shadow(0 2px 6px oklch(0 0 0 /.6))',
            }}
          />
          <span className="silver" style={{ fontSize: 13, letterSpacing: '.16em' }}>
            URBAN FITNESS CLUB
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Campana de alertas */}
        {usuario && (
          <div style={{ WebkitAppRegion: 'no-drag', marginRight: 4 }}>
            <button
              onClick={() => navigate(PAGES.ALERTS)}
              title="Ver alertas"
              style={{
                position: 'relative', width: 34, height: 34, borderRadius: 8,
                background: alertCriticas ? 'oklch(0.66 0.22 25 / .12)' : 'oklch(1 0 0 / .04)',
                border: alertCriticas ? '1px solid oklch(0.66 0.22 25 / .35)' : '1px solid var(--line)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: alertCriticas ? 'oklch(0.82 0.14 25)' : 'var(--dim)',
                transition: 'all .15s',
              }}
            >
              <Bell size={15} strokeWidth={alertCriticas ? 2 : 1.6} />
              {alertCount > 0 && (
                <div
                  className={alertCriticas ? 'badge-pulse' : ''}
                  style={{
                    position: 'absolute', top: -4, right: -4,
                    minWidth: 16, height: 16, borderRadius: 8,
                    background: 'var(--red)', border: '2px solid oklch(0.12 0.01 250)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 800, color: '#fff', padding: '0 3px',
                  }}
                >
                  {alertCount > 99 ? '99+' : alertCount}
                </div>
              )}
            </button>
          </div>
        )}

        {/* Sesión de usuario */}
        {usuario && (
          <div style={{ WebkitAppRegion: 'no-drag' }}>
            <button
              ref={btnRef}
              onClick={openDropdown}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: showDropdown ? 'oklch(1 0 0 / .08)' : 'oklch(1 0 0 / .04)',
                border: '1px solid oklch(1 0 0 / .1)',
                borderRadius: 8, padding: '4px 10px 4px 6px',
                cursor: 'pointer', color: 'oklch(0.95 0.01 250)',
                transition: 'background .15s',
              }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: 6,
                background: 'oklch(0.66 0.22 25 / .25)',
                border: '1px solid oklch(0.66 0.22 25 / .4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: 'oklch(0.80 0.12 25)',
                letterSpacing: '.04em', flexShrink: 0,
              }}>
                {initiales}
              </div>
              <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
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
