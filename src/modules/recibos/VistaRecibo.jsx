import { useState, useEffect, useRef } from 'react'
import { Download, Printer, X, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Print styles injected once ──────────────────────────────────────────────
const PRINT_STYLE_ID = 'vista-recibo-print-style'
function injectPrintStyle(formato) {
  let el = document.getElementById(PRINT_STYLE_ID)
  if (!el) { el = document.createElement('style'); el.id = PRINT_STYLE_ID; document.head.appendChild(el) }
  const pageSize = formato === 'ticket' ? '80mm auto' : formato === 'carta' ? 'letter' : '5.5in 8.5in'
  const w = formato === 'ticket' ? '72mm' : formato === 'carta' ? '190mm' : '130mm'
  el.textContent = `
    @media print {
      @page { size: ${pageSize}; margin: ${formato === 'ticket' ? '2mm' : '10mm'}; }
      body * { visibility: hidden !important; }
      #recibo-print-root, #recibo-print-root * { visibility: visible !important; }
      #recibo-print-root { position: fixed; top: 0; left: 0; width: 100%; background: white; z-index: 999999; }
      #recibo-print-root .impresora-wrap, #recibo-print-root .print-actions { display: none !important; }
      .recibo-paper {
        transform: none !important;
        box-shadow: none !important;
        width: ${w} !important;
        max-width: ${w} !important;
        margin: 0 auto !important;
        max-height: none !important;
        overflow: visible !important;
        page-break-inside: avoid;
      }
    }
  `
}

export default function VistaRecibo({ venta, onClose }) {
  const [config, setConfig] = useState(null)
  const [gymConfig, setGymConfig] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [desplegada, setDesplegada] = useState(false)
  const [fmt, setFmt] = useState('media')
  const animRef = useRef(null)

  useEffect(() => {
    Promise.all([
      window.api.recibos.getConfig(),
      window.api.pos.getConfig(),
    ]).then(([cfg, pos]) => {
      setConfig(cfg || {})
      setGymConfig(pos || {})
      const f = (cfg || {}).formato || 'media'
      setFmt(f)
      injectPrintStyle(f)
    })
  }, [])

  useEffect(() => {
    if (!config) return
    animRef.current = setTimeout(() => setDesplegada(true), 350)
    return () => clearTimeout(animRef.current)
  }, [config])

  function lanzarAnimacion() {
    setDesplegada(false)
    clearTimeout(animRef.current)
    animRef.current = setTimeout(() => setDesplegada(true), 200)
  }

  function cambiarFormato(f) {
    setFmt(f)
    injectPrintStyle(f)
    lanzarAnimacion()
  }

  async function descargar() {
    setGuardando(true)
    try {
      const r = await window.api.recibos.guardarPDF(venta)
      if (r?.ok) toast.success('Recibo guardado')
      else if (!r?.cancelado) toast.error('Error al guardar')
    } catch (err) { toast.error(err.message || 'Error') }
    setGuardando(false)
  }

  function imprimir() {
    setDesplegada(true)
    setTimeout(() => window.api.pos.imprimir(), 200)
  }

  if (!config) return null

  const isTicket = fmt === 'ticket'
  const isCarta = fmt === 'carta'
  const W = isTicket ? 226 : isCarta ? 595 : 420
  const printerW = Math.min(W + 32, 500)
  const show = (k) => config[k] !== 0 && config[k] !== false
  const items = venta.items || []

  return (
    <div id="recibo-print-root" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'oklch(0 0 0 / .8)', backdropFilter: 'blur(8px)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, maxHeight: '92vh', position: 'relative' }}>

        {/* Impresora + papel */}
        <div style={{ width: printerW, position: 'relative' }} className="impresora-wrap">
          {/* Cuerpo de la impresora */}
          <div style={{
            width: '100%', height: 50, position: 'relative', zIndex: 20,
            background: 'linear-gradient(180deg, #3a3a3e 0%, #2b2b2e 60%, #1a1a1d 100%)',
            borderRadius: 14,
            boxShadow: 'inset 0 -2px 0 rgba(255,255,255,0.04), inset 0 2px 4px rgba(0,0,0,0.5), 0 8px 20px -8px rgba(0,0,0,0.6)',
          }}>
            {/* Ranura */}
            <div style={{ position: 'absolute', left: 14, right: 14, bottom: 9, height: 7, background: '#0f0f10', borderRadius: 4, boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.8)' }} />
            {/* LED parpadeante */}
            <div style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px rgba(74,222,128,0.8)', animation: 'ledBlink 1.6s ease-in-out infinite' }} />
            {/* Texto impresora */}
            <div style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', fontSize: 9, fontWeight: 700, letterSpacing: '.12em', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>Urban Fitness</div>
          </div>

          {/* Máscara: oculta la parte superior del papel */}
          <div style={{ width: '100%', overflow: 'hidden', marginTop: -10, flex: 1, position: 'relative' }}>
            {/* Sombra del papel */}
            <div style={{ position: 'absolute', left: '50%', bottom: '8%', transform: 'translateX(-50%)', width: '70%', height: 14, background: 'radial-gradient(ellipse, rgba(0,0,0,0.3), transparent 70%)', zIndex: 1, opacity: desplegada ? 1 : 0, transition: 'opacity 0.6s 1.6s ease', pointerEvents: 'none' }} />

            {/* El papel (recibo) */}
            <div className="recibo-paper" style={{
              width: W,
              maxWidth: '100%',
              margin: '0 auto',
              background: '#fff',
              color: '#111',
              fontFamily: isTicket ? 'monospace' : 'Arial, sans-serif',
              fontSize: isTicket ? 9 : 11,
              padding: isTicket ? 10 : 20,
              paddingTop: isTicket ? 18 : 28,
              borderRadius: isTicket ? '0 0 4px 4px' : '0 0 6px 6px',
              boxShadow: desplegada ? '0 24px 60px rgba(0,0,0,0.4)' : 'none',
              transform: desplegada ? 'translateY(0)' : 'translateY(-110%)',
              transition: 'transform 2.2s cubic-bezier(0.22, 1, 0.36, 1)',
              maxHeight: 'calc(92vh - 160px)',
              overflowY: 'auto',
            }}>
              {/* Contenido del recibo */}
              {show('mostrar_logo') && (
                <div style={{ textAlign: 'center', marginBottom: 6 }}>
                  <img src="/logo.jpg" alt="logo" style={{ height: isTicket ? 28 : 44, objectFit: 'contain', maxWidth: '80%' }} onError={e => e.target.style.display = 'none'} />
                </div>
              )}
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: isTicket ? 11 : 15, marginBottom: 2 }}>
                {gymConfig?.gym_nombre || 'URBAN FITNESS CLUB'}
              </div>
              {show('mostrar_datos_gym') && gymConfig?.gym_direccion && (
                <div style={{ textAlign: 'center', fontSize: isTicket ? 8 : 9, color: '#555', marginBottom: 4 }}>
                  {gymConfig.gym_direccion}{gymConfig.gym_telefono ? ` · Tel: ${gymConfig.gym_telefono}` : ''}
                </div>
              )}
              <div style={{ borderTop: '1px dashed #ccc', margin: '6px 0' }} />
              {show('mostrar_numero') && (
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: isTicket ? 10 : 13, marginBottom: 2 }}>
                  RECIBO N° {String(venta.numero || 1).padStart(4, '0')}
                </div>
              )}
              {show('mostrar_fecha') && (
                <div style={{ textAlign: 'center', fontSize: isTicket ? 8 : 9, color: '#555', marginBottom: 6 }}>
                  {venta.fecha || new Date().toLocaleString('es-BO')}
                </div>
              )}
              <div style={{ borderTop: '1px dashed #ccc', margin: '6px 0' }} />
              {show('mostrar_datos_cliente') && venta.cliente_nombre && (
                <div style={{ fontSize: isTicket ? 8 : 10, marginBottom: 4 }}>
                  Cliente: {venta.cliente_nombre}{venta.cliente_doc ? ` · CI: ${venta.cliente_doc}` : ''}
                </div>
              )}
              <div style={{ borderTop: '1px dashed #ccc', margin: '6px 0' }} />
              {show('mostrar_detalle') && items.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  {!isTicket && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700, color: '#888', paddingBottom: 4, borderBottom: '1px dashed #eee', marginBottom: 4 }}>
                      <span>DESCRIPCIÓN</span><span>CANT</span><span>TOTAL</span>
                    </div>
                  )}
                  {items.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: isTicket ? 8 : 10, marginBottom: 2 }}>
                      <span style={{ flex: 1, paddingRight: 4 }}>{item.nombre}{isTicket ? ` x${item.cantidad}` : ''}</span>
                      {!isTicket && <span style={{ marginRight: 8 }}>x{item.cantidad}</span>}
                      <span style={{ fontWeight: 'bold' }}>Bs.{Number(item.total).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ borderTop: '1px dashed #ccc', margin: '6px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: isTicket ? 13 : 16, marginBottom: 4 }}>
                <span>TOTAL:</span>
                <span>Bs. {Number(venta.total || 0).toFixed(2)}</span>
              </div>
              {show('mostrar_metodo_pago') && (
                <div style={{ fontSize: isTicket ? 8 : 9, color: '#555', marginBottom: 2 }}>
                  Método: {venta.metodo_pago || 'Efectivo'}
                </div>
              )}
              {venta.vuelto > 0 && show('mostrar_metodo_pago') && (
                <div style={{ fontSize: isTicket ? 8 : 9, color: '#555', marginBottom: 4 }}>
                  Cambio: Bs. {Number(venta.vuelto).toFixed(2)}
                </div>
              )}
              {show('mostrar_cajero') && venta.cajero && (
                <>
                  <div style={{ borderTop: '1px dashed #ccc', margin: '6px 0' }} />
                  <div style={{ textAlign: 'center', fontSize: isTicket ? 8 : 9, color: '#555' }}>
                    Atendido por: {venta.cajero}
                  </div>
                </>
              )}
              {show('mostrar_mensaje') && config.mensaje_pie && (
                <>
                  <div style={{ borderTop: '1px dashed #ccc', margin: '6px 0' }} />
                  <div style={{ textAlign: 'center', fontSize: isTicket ? 8 : 9, fontWeight: 'bold' }}>{config.mensaje_pie}</div>
                </>
              )}
              <div style={{ borderTop: '1px dashed #ccc', margin: '6px 0' }} />
              <div style={{ textAlign: 'center', fontSize: isTicket ? 7 : 8, color: '#aaa' }}>
                Este recibo no es válido como factura fiscal
              </div>
              {/* Efecto borde dentado inferior tipo ticket */}
              {isTicket && (
                <div style={{ height: 14, marginTop: 12, background: 'radial-gradient(circle at 6px 0, #fff 4px, transparent 4.5px)', backgroundSize: '12px 14px', backgroundRepeat: 'repeat-x', marginLeft: -10, marginRight: -10 }} />
              )}
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="print-actions" style={{ display: 'flex', gap: 8, marginTop: 14, zIndex: 10 }}>
          <button onClick={lanzarAnimacion} title="Repetir animación" style={{ width: 42, height: 42, borderRadius: 12, background: 'oklch(1 0 0 / .1)', border: '1px solid oklch(1 0 0 / .2)', color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RefreshCw size={16} />
          </button>
          <button onClick={imprimir} style={{ height: 42, flex: 1, borderRadius: 12, background: 'oklch(0.66 0.22 25 / .25)', border: '1px solid oklch(0.66 0.22 25 / .5)', color: 'oklch(0.9 0.1 25)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <Printer size={15} /> Imprimir
          </button>
          <button onClick={descargar} disabled={guardando} style={{ height: 42, flex: 1, borderRadius: 12, background: 'oklch(0.74 0.13 250 / .2)', border: '1px solid oklch(0.74 0.13 250 / .4)', color: 'oklch(0.85 0.1 250)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <Download size={15} /> {guardando ? 'Guardando...' : 'Guardar PDF'}
          </button>
          {onClose && (
            <button onClick={onClose} style={{ width: 42, height: 42, borderRadius: 12, background: 'oklch(1 0 0 / .1)', border: '1px solid oklch(1 0 0 / .2)', color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Animación LED CSS */}
      <style>{`
        @keyframes ledBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
      `}</style>
    </div>
  )
}
