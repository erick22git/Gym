import { useState, createContext, useContext, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertOctagon, AlertTriangle, Info } from 'lucide-react'

const ConfirmContext = createContext(null)

const TIPO_CONFIG = {
  peligro:     { color: 'oklch(0.66 0.22 25)',  icon: AlertOctagon  },
  advertencia: { color: 'oklch(0.82 0.14 75)',  icon: AlertTriangle },
  info:        { color: 'oklch(0.74 0.13 250)', icon: Info          },
}

export function ConfirmProvider({ children }) {
  const [dialogo, setDialogo] = useState(null)
  const resolveRef = useRef(null)
  const [inputVal, setInputVal] = useState('')

  const confirmar = useCallback((opciones) => {
    setInputVal('')
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setDialogo(opciones)
    })
  }, [])

  function responder(ok) {
    resolveRef.current?.(ok)
    setDialogo(null)
  }

  useEffect(() => {
    if (!dialogo) return
    function onKey(e) {
      if (e.key === 'Escape' && !dialogo.requiereTexto) responder(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialogo])

  const cfg = TIPO_CONFIG[dialogo?.tipo || 'peligro']
  const Icon = cfg?.icon
  const textoReq = dialogo?.textoRequerido || 'ELIMINAR'
  const puedeConfirmar = !dialogo?.requiereTexto || inputVal === textoReq

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      <AnimatePresence>
        {dialogo && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div
              onClick={dialogo.requiereTexto ? undefined : () => responder(false)}
              style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .72)', backdropFilter: 'blur(10px)' }}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.17, ease: [0.25, 0.1, 0.25, 1] }}
              style={{
                position: 'relative', zIndex: 1, width: '100%', maxWidth: 420,
                background: 'oklch(0.11 0.01 250)',
                border: `1px solid ${cfg.color}35`,
                borderTop: `3px solid ${cfg.color}`,
                borderRadius: 16, padding: '24px 26px',
                boxShadow: '0 24px 60px oklch(0 0 0 / .55)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                  background: `${cfg.color}18`, border: `1px solid ${cfg.color}35`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={20} color={cfg.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontFamily: 'var(--display)', fontSize: 15, fontWeight: 800, color: 'var(--ink)', letterSpacing: '.04em', margin: 0 }}>
                    {dialogo.titulo || '¿Confirmar?'}
                  </h3>
                  {dialogo.mensaje && (
                    <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.65, margin: '7px 0 0' }}>
                      {dialogo.mensaje}
                    </p>
                  )}
                </div>
              </div>

              {dialogo.requiereTexto && (
                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                    Escribe <strong style={{ color: cfg.color }}>{textoReq}</strong> para confirmar:
                  </label>
                  <input
                    className="gym-input"
                    autoFocus
                    value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && puedeConfirmar) responder(true) }}
                    placeholder={textoReq}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: dialogo.requiereTexto ? 0 : 4 }}>
                <button onClick={() => responder(false)} className="btn-secondary" style={{ minWidth: 90 }}>
                  {dialogo.textoCancelar || 'Cancelar'}
                </button>
                <button
                  onClick={() => puedeConfirmar && responder(true)}
                  style={{
                    minWidth: 100, padding: '8px 18px', borderRadius: 9,
                    fontSize: 13, fontWeight: 700,
                    background: `${cfg.color}22`, border: `1px solid ${cfg.color}50`,
                    color: cfg.color, cursor: puedeConfirmar ? 'pointer' : 'not-allowed',
                    opacity: puedeConfirmar ? 1 : 0.4, transition: 'opacity .15s',
                  }}
                >
                  {dialogo.textoConfirmar || 'Confirmar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    // Graceful fallback for components outside provider (shouldn't happen in prod)
    return (opts) => Promise.resolve(window.confirm(opts?.titulo || '¿Confirmar?'))
  }
  return ctx
}
