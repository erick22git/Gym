import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, Plus, Loader2 } from 'lucide-react'

export function Select({ value, onChange, options, placeholder = '— Seleccionar —', onAdd, addLabel }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const [adding, setAdding] = useState(false)
  const [addText, setAddText] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const triggerRef = useRef(null)
  const addInputRef = useRef(null)
  const selected = options.find(o => String(o.value) === String(value))

  function toggle() {
    if (!open) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 180) })
      setAdding(false)
      setAddText('')
    }
    setOpen(v => !v)
  }

  function close() {
    setOpen(false)
    setAdding(false)
    setAddText('')
  }

  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (adding && addInputRef.current) addInputRef.current.focus()
  }, [adding])

  async function submitAdd(e) {
    e.preventDefault()
    if (!addText.trim()) return
    setAddLoading(true)
    try {
      await onAdd(addText.trim())
      close()
    } finally {
      setAddLoading(false)
    }
  }

  return (
    <>
      <button ref={triggerRef} className="custom-select-trigger" onClick={toggle} type="button">
        <span style={{ color: selected ? 'var(--ink)' : 'var(--dim)' }}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={14} style={{ color: 'var(--dim)', flexShrink: 0 }} />
      </button>

      {open && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99990 }} onClick={close} />
          <div
            className="custom-select-dropdown"
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 99991 }}
          >
            {options.map(opt => (
              <div
                key={opt.value}
                className={`select-option${String(value) === String(opt.value) ? ' selected' : ''}`}
                onClick={() => { onChange(opt.value); close() }}
              >
                <span>{opt.label}</span>
                {String(value) === String(opt.value) && <Check size={13} />}
              </div>
            ))}
            {onAdd && !adding && (
              <div
                className="select-option"
                onClick={e => { e.stopPropagation(); setAdding(true) }}
                style={{ borderTop: '1px solid var(--line)', color: 'var(--dim)', fontSize: 12 }}
              >
                <Plus size={12} />
                <span>{addLabel || 'Agregar...'}</span>
              </div>
            )}
            {onAdd && adding && (
              <form
                onSubmit={submitAdd}
                onClick={e => e.stopPropagation()}
                style={{ padding: '8px 10px', borderTop: '1px solid var(--line)', display: 'flex', gap: 6 }}
              >
                <input
                  ref={addInputRef}
                  value={addText}
                  onChange={e => setAddText(e.target.value)}
                  placeholder={addLabel || 'Nombre...'}
                  style={{
                    flex: 1, background: 'var(--glass)', border: '1px solid var(--line-s)',
                    borderRadius: 6, padding: '5px 8px', fontSize: 12, color: 'var(--ink)',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={addLoading || !addText.trim()}
                  style={{
                    background: 'oklch(0.66 0.22 25 / .2)', border: '1px solid oklch(0.66 0.22 25 / .35)',
                    borderRadius: 6, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  }}
                >
                  {addLoading
                    ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} color="oklch(0.76 0.20 25)" />
                    : <Check size={12} color="oklch(0.76 0.20 25)" />
                  }
                </button>
              </form>
            )}
          </div>
        </>,
        document.body
      )}
    </>
  )
}
