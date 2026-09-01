import { useState, createContext, useContext, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertOctagon, AlertTriangle, Info } from 'lucide-react'
// Este diálogo es GLOBAL (un solo ConfirmProvider montado en la raíz de la
// app, useConfirm() se usa desde cualquier página) — no hay forma de
// scopearlo por página con un ancestro .clientes-page como en otros
// arreglos de esta sesión. El pedido ("el modal de eliminar en Clientes")
// se aplica acá al componente compartido — afecta a TODOS los confirm()
// de la app (Caja, Historial, etc.), no solo al de eliminar cliente.
import '../../pages/Clients.css'

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
                // [SIMPLIFICADO — pedido explícito: "quitar el negro,
                // transparente, distorsión suave, opacidad, Y SOLO ESO"]
                // La vuelta anterior sumó un halo de 3 capas (inset +
                // glow + sombra) — más de lo pedido. Bajado a un único
                // boxShadow suave (una sombra de caída, sin insets ni
                // brillo) — la "opacidad" pedida es justamente esa, sutil
                // y nada más. Antes: background sólido casi negro
                // (oklch(0.11 ...)), sin backdrop-filter — el resto (fondo
                // transparente, #clientes-table-glass) se mantiene igual.
                background: 'transparent',
                backdropFilter: 'url(#clientes-table-glass)',
                WebkitBackdropFilter: 'url(#clientes-table-glass)',
                border: `1px solid ${cfg.color.replace(')', ' / .35)')}`,
                borderTop: `3px solid ${cfg.color}`,
                borderRadius: 16, padding: '24px 26px',
                boxShadow: '0 20px 50px oklch(0 0 0 / .35)',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.6)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                  background: cfg.color.replace(')', ' / .18)'), border: `1px solid ${cfg.color.replace(')', ' / .35)')}`,
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

              {/* [CORREGIDO — pedido explícito: "los botones tienen que
                  ser como en Nuevo Cliente, transparentes y con
                  movimiento"] Mismas clases de Clients.css. El de
                  Confirmar también tenía el bug de `${cfg.color}22` —
                  corregido con .replace(). */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: dialogo.requiereTexto ? 0 : 4 }}>
                <button onClick={() => responder(false)} className="clientes-glass-btn btn-secondary" style={{ minWidth: 90 }}>
                  <div className="clientes-glass-bg" />
                  <span className="clientes-glass-content">{dialogo.textoCancelar || 'Cancelar'}</span>
                </button>
                <button
                  className="clientes-glass-btn"
                  onClick={() => puedeConfirmar && responder(true)}
                  disabled={!puedeConfirmar}
                  style={{
                    minWidth: 100, padding: '8px 18px', borderRadius: 9,
                    fontSize: 13, fontWeight: 700,
                    background: 'transparent', border: 'none',
                    cursor: puedeConfirmar ? 'pointer' : 'not-allowed',
                    opacity: puedeConfirmar ? 1 : 0.4, transition: 'opacity .15s',
                  }}
                >
                  <div className="clientes-glass-bg" />
                  <span className="clientes-glass-content" style={{ color: cfg.color }}>{dialogo.textoConfirmar || 'Confirmar'}</span>
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
