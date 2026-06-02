import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, UserPlus, CheckCircle, XCircle, AlertTriangle, Clock, PauseCircle, ShoppingCart, Plus, Minus, X, Trash2, QrCode, Maximize2, CreditCard, ArrowLeftRight, Banknote, Receipt } from 'lucide-react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import ClienteCard from '../components/pos/ClienteCard'
import NuevoClienteWizard from '../components/pos/NuevoClienteWizard'
import VistaRecibo from '../modules/recibos/VistaRecibo'

// ─── Formulario de datos para recibo (venta rápida) ──────────────────────────
function FormDatosRecibo({ datos, onDatos, onConfirmar, onCancelar }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onCancelar} style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .6)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'relative', zIndex: 1, width: 360, background: 'oklch(0.13 0.01 250)', border: '1px solid var(--line-s)', borderRadius: 16, padding: '24px 22px', boxShadow: '0 20px 60px oklch(0 0 0 / .6)' }}>
        <h3 style={{ fontFamily: 'var(--display)', fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginBottom: 18, letterSpacing: '.06em' }}>Datos del comprobante</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Nombre del cliente</label>
            <input className="gym-input" placeholder="Nombre completo (opcional)" value={datos.nombre}
              onChange={e => onDatos({ ...datos, nombre: e.target.value })} autoFocus />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>CI / NIT (opcional)</label>
            <input className="gym-input" placeholder="Carnet o NIT" value={datos.doc}
              onChange={e => onDatos({ ...datos, doc: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onCancelar}>Cancelar</button>
          <button className="btn-primary" style={{ flex: 2 }} onClick={() => onConfirmar(datos)}>Confirmar e imprimir</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Venta Rápida de Productos ─────────────────────────────────────────

function ModalVentaRapida({ usuario, onClose }) {
  const { esModuloActivo } = useAuth()
  const recibosActivo = esModuloActivo('recibos')
  const facturacionActiva = esModuloActivo('facturacion')

  const [busqueda, setBusqueda] = useState('')
  const [productos, setProductos] = useState([])
  const [carrito, setCarrito] = useState([])
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [recibido, setRecibido] = useState('')
  const [qrConfirmado, setQrConfirmado] = useState(false)
  const [qrAmpliado, setQrAmpliado] = useState(false)
  const [posConfig, setPosConfig] = useState({})
  const [procesando, setProcesando] = useState(false)
  const [exito, setExito] = useState(false)
  const [ventaId, setVentaId] = useState(null)
  const [imprimendoRecibo, setImprimendoRecibo] = useState(false)
  const [emitiendo, setEmitiendo] = useState(false)
  const [reciboPrevia, setReciboPrevia] = useState(null)
  const [formRecibo, setFormRecibo] = useState(null)
  const [cajaCerradaPrompt, setCajaCerradaPrompt] = useState(false)
  const [montoInicialCaja, setMontoInicialCaja] = useState('0')
  const [notasCaja, setNotasCaja] = useState('')
  const [abriendoCaja, setAbriendoCaja] = useState(false)
  const buscarRef = useRef(null)

  useEffect(() => { buscarRef.current?.focus() }, [])

  useEffect(() => {
    window.api.pos.getConfig().then(cfg => setPosConfig(cfg || {}))
  }, [])

  useEffect(() => {
    if (!qrAmpliado) return
    const fn = e => { if (e.key === 'Escape') setQrAmpliado(false) }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [qrAmpliado])

  useEffect(() => {
    const t = setTimeout(async () => {
      if (busqueda.trim().length >= 2) {
        const res = await window.api.inventario.buscarPOS(busqueda)
        setProductos(res || [])
      } else {
        setProductos([])
      }
    }, 200)
    return () => clearTimeout(t)
  }, [busqueda])

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  function agregarItem(prod) {
    setCarrito(prev => {
      const idx = prev.findIndex(i => i.producto_id === prod.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], cantidad: next[idx].cantidad + 1 }
        return next
      }
      return [...prev, { producto_id: prod.id, nombre_producto: prod.nombre, precio_unitario: prod.precio_venta, cantidad: 1, stock: prod.stock }]
    })
    setBusqueda('')
    setProductos([])
  }

  function cambiarCantidad(idx, delta) {
    setCarrito(prev => {
      const next = [...prev]
      const nuevo = next[idx].cantidad + delta
      if (nuevo <= 0) { next.splice(idx, 1); return next }
      if (nuevo > next[idx].stock) { toast.error(`Stock insuficiente (máx: ${next[idx].stock})`); return prev }
      next[idx] = { ...next[idx], cantidad: nuevo }
      return next
    })
  }

  const total = carrito.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0)
  const montoRec = parseFloat(recibido) || 0
  const vuelto = metodoPago === 'efectivo' ? Math.max(0, montoRec - total) : 0

  function puedeConfirmar() {
    if (metodoPago === 'efectivo') return montoRec >= total
    if (metodoPago === 'qr') return qrConfirmado
    return true
  }

  async function abrirCajaYContinuar() {
    setAbriendoCaja(true)
    try {
      const r = await window.api.caja.abrir({
        monto_inicial: parseFloat(montoInicialCaja) || 0,
        notas: notasCaja || null,
        usuario_id: usuario?.id,
        usuario_nombre: usuario?.nombre_completo,
      })
      if (r.ok) {
        toast.success('Caja abierta')
        setCajaCerradaPrompt(false)
        await procesarVenta()
      } else {
        toast.error(r.error || 'Error al abrir caja')
      }
    } finally {
      setAbriendoCaja(false)
    }
  }

  async function procesarVenta() {
    setProcesando(true)
    try {
      const sesionCaja = await window.api.caja.getSesionActual()
      const res = await window.api.inventario.venderProductos(
        carrito.map(i => ({ producto_id: i.producto_id, nombre_producto: i.nombre_producto, cantidad: i.cantidad, precio_unitario: i.precio_unitario })),
        { metodo_pago: metodoPago, monto_recibido: metodoPago === 'efectivo' ? montoRec : total, vuelto, usuario_id: usuario?.id, usuario_nombre: usuario?.nombre_completo, sesion_id: sesionCaja?.id || null }
      )
      if (res.ok) {
        setVentaId(res.venta_id)
        setExito(true)
        toast.success(`Venta registrada: Bs. ${total.toFixed(2)}`)
        if (!recibosActivo) setTimeout(() => onClose(), 1800)
      } else {
        toast.error('Error al procesar la venta')
      }
    } catch (err) {
      console.error(err)
      toast.error('Error al procesar la venta')
    } finally {
      setProcesando(false)
    }
  }

  async function handleProcesar() {
    if (carrito.length === 0) return
    const sesionCaja = await window.api.caja.getSesionActual()
    if (!sesionCaja) {
      setCajaCerradaPrompt(true)
      return
    }
    await procesarVenta()
  }

  function imprimirRecibo() {
    setFormRecibo({
      nombre: '',
      doc: '',
      concepto: carrito.map(i => i.nombre_producto).join(', '),
    })
  }

  function confirmarRecibo(datos) {
    setReciboPrevia({
      numero: ventaId || Date.now(),
      fecha: new Date().toLocaleString('es-BO'),
      cliente_nombre: datos.nombre || 'Venta Directa',
      cliente_doc: datos.doc || '',
      items: carrito.map(i => ({ nombre: i.nombre_producto, cantidad: i.cantidad, total: i.cantidad * i.precio_unitario })),
      total,
      metodo_pago: metodoPago,
      recibido: metodoPago === 'efectivo' ? montoRec : total,
      vuelto,
      cajero: usuario?.nombre_completo || '',
    })
    setFormRecibo(null)
  }

  async function emitirFacturaVenta() {
    setEmitiendo(true)
    try {
      const concepto = carrito.map(i => `${i.nombre_producto} x${i.cantidad}`).join(', ')
      const res = await window.api.facturacion.emitirFactura({
        cliente_tipo_doc: 'CI',
        cliente_documento: '0',
        cliente_nombre: 'S/N',
        cliente_correo: '',
        concepto: concepto.slice(0, 100) || 'Venta productos',
        cantidad: 1,
        precio_unitario: total,
        descuento: 0,
        monto_total: total,
        metodo_pago: metodoPago,
        enviar_correo: false,
      })
      if (res.ok) toast.success('Factura emitida — ver Historial de Facturas')
      else toast.error(res.error || 'Error al emitir factura')
    } catch (err) { toast.error(err.message || 'Error') }
    setEmitiendo(false)
  }

  return (
    <>
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .7)', backdropFilter: 'blur(6px)' }} />
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        style={{
          position: 'relative', zIndex: 1, width: 580, maxHeight: 'calc(100vh - 80px)',
          background: 'oklch(0.11 0.01 250)', border: '1px solid var(--line-s)',
          borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 60px oklch(0 0 0 / .6)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShoppingCart size={18} color="oklch(0.78 0.18 200)" />
            <span style={{ fontFamily: 'var(--display)', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Venta Rápida</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)' }}><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {exito ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'oklch(0.72 0.17 155)' }}>
              <CheckCircle size={48} style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--display)' }}>Venta registrada</div>
              <div style={{ fontSize: 14, color: 'var(--dim)', marginTop: 6 }}>Bs. {total.toFixed(2)}</div>
              {(recibosActivo || facturacionActiva) ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Generar comprobante</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {recibosActivo && (
                      <button onClick={imprimirRecibo}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, fontSize: 12, fontWeight: 600,
                          background: 'oklch(0.74 0.13 250 / .15)', border: '1px solid oklch(0.74 0.13 250 / .4)', color: 'oklch(0.80 0.12 250)', cursor: 'pointer' }}>
                        <Receipt size={13} />Recibo
                      </button>
                    )}
                    {facturacionActiva && (
                      <button onClick={emitirFacturaVenta} disabled={emitiendo}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, fontSize: 12, fontWeight: 600,
                          background: 'oklch(0.82 0.14 75 / .15)', border: '1px solid oklch(0.82 0.14 75 / .4)', color: 'oklch(0.88 0.10 75)',
                          cursor: emitiendo ? 'not-allowed' : 'pointer', opacity: emitiendo ? 0.6 : 1 }}>
                        🧾 {emitiendo ? 'Emitiendo...' : 'Factura'}
                      </button>
                    )}
                    <button onClick={onClose}
                      style={{ padding: '8px 16px', borderRadius: 9, fontSize: 12, fontWeight: 600,
                        background: 'oklch(1 0 0 / .05)', border: '1px solid var(--line)', color: 'var(--muted)', cursor: 'pointer' }}>
                      Cerrar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              {/* Buscador de productos */}
              <div>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--dim)', pointerEvents: 'none' }} />
                  <input
                    ref={buscarRef}
                    type="text"
                    className="gym-input"
                    placeholder="Buscar producto por nombre o código..."
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    style={{ paddingLeft: 32, paddingRight: 12, fontSize: 13, height: 40 }}
                  />
                </div>
                <AnimatePresence>
                  {productos.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      style={{ background: 'oklch(0.14 0.01 250)', border: '1px solid var(--line-s)', borderRadius: 10, overflow: 'hidden', marginTop: 4 }}
                    >
                      {productos.slice(0, 6).map((p, i) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => agregarItem(p)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '9px 14px', background: 'transparent', border: 'none', cursor: p.stock <= 0 ? 'not-allowed' : 'pointer',
                            borderBottom: i < productos.slice(0, 6).length - 1 ? '1px solid oklch(1 0 0 / .05)' : 'none',
                            opacity: p.stock <= 0 ? 0.4 : 1,
                            textAlign: 'left',
                          }}
                          disabled={p.stock <= 0}
                          onMouseEnter={e => { if (p.stock > 0) e.currentTarget.style.background = 'oklch(1 0 0 / .05)' }}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div>
                            <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{p.nombre}</div>
                            <div style={{ fontSize: 11, color: 'var(--dim)' }}>Stock: {p.stock}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.78 0.18 200)' }}>Bs. {Number(p.precio_venta).toFixed(2)}</div>
                            {p.stock <= 0 && <div style={{ fontSize: 10, color: 'var(--red-soft)' }}>Sin stock</div>}
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Carrito */}
              {carrito.length > 0 ? (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>Carrito ({carrito.length} ítem{carrito.length !== 1 ? 's' : ''})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {carrito.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'oklch(1 0 0 / .03)', borderRadius: 8, padding: '8px 12px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.nombre_producto}</div>
                          <div style={{ fontSize: 11, color: 'var(--dim)' }}>Bs. {item.precio_unitario.toFixed(2)} c/u</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <button onClick={() => cambiarCantidad(idx, -1)} style={{ width: 24, height: 24, borderRadius: 6, background: 'oklch(1 0 0 / .06)', border: '1px solid var(--line)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}><Minus size={11} /></button>
                          <span style={{ minWidth: 20, textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{item.cantidad}</span>
                          <button onClick={() => cambiarCantidad(idx, 1)} style={{ width: 24, height: 24, borderRadius: 6, background: 'oklch(1 0 0 / .06)', border: '1px solid var(--line)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}><Plus size={11} /></button>
                        </div>
                        <div style={{ minWidth: 72, textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'oklch(0.78 0.18 200)', flexShrink: 0 }}>
                          Bs. {(item.cantidad * item.precio_unitario).toFixed(2)}
                        </div>
                        <button onClick={() => setCarrito(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)', flexShrink: 0 }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--dim)' }}>
                  <ShoppingCart size={36} style={{ opacity: 0.2, margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 13 }}>Busca y agrega productos al carrito</p>
                </div>
              )}

              {/* Método de pago */}
              {carrito.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>Método de pago</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    {[['efectivo','Efectivo',Banknote,'oklch(0.78 0.16 155)'], ['qr','QR',QrCode,'oklch(0.74 0.13 250)'], ['tarjeta','Tarjeta',CreditCard,'oklch(0.82 0.14 75)'], ['transferencia','Transfer.',ArrowLeftRight,'oklch(0.80 0.12 200)']].map(([v, l, Icon, color]) => (
                      <button
                        key={v}
                        onClick={() => { setMetodoPago(v); setRecibido(''); setQrConfirmado(false) }}
                        style={{
                          padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          background: metodoPago === v ? `${color.replace(')', ' / .18)')}` : 'oklch(1 0 0 / .04)',
                          border: metodoPago === v ? `1px solid ${color.replace(')', ' / .45)')}` : '1px solid var(--line)',
                          color: metodoPago === v ? color : 'var(--muted)',
                          transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 5,
                        }}
                      ><Icon size={13} />{l}</button>
                    ))}
                  </div>

                  {/* EFECTIVO: calculadora de cambio */}
                  {metodoPago === 'efectivo' && (
                    <div style={{ background: 'var(--glass)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--dim)' }}>Total a cobrar</span>
                        <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--display)', color: 'var(--red)' }}>Bs. {total.toFixed(2)}</span>
                      </div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Monto recibido</label>
                      <input className="gym-input" type="number" min="0" step="0.5" value={recibido} onChange={e => setRecibido(e.target.value)} placeholder="0.00" style={{ fontSize: 16, marginBottom: 8 }} autoFocus />
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                        {[50, 100, 200, 500].map(d => (
                          <button key={d} type="button" onClick={() => setRecibido(String(d))} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'var(--glass-2)', border: '1px solid var(--line)', cursor: 'pointer', color: 'var(--muted)' }}>{d}</button>
                        ))}
                        <button type="button" onClick={() => setRecibido(total.toFixed(2))} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'oklch(0.78 0.16 155 / .12)', border: '1px solid oklch(0.78 0.16 155 / .3)', cursor: 'pointer', color: 'var(--green)' }}>Exacto</button>
                      </div>
                      {recibido && montoRec >= total && (
                        <div style={{ background: 'oklch(0.78 0.16 155 / .1)', border: '1px solid oklch(0.78 0.16 155 / .3)', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Vuelto</span>
                          <span style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--display)', color: 'var(--green)' }}>Bs. {vuelto.toFixed(2)}</span>
                        </div>
                      )}
                      {recibido && montoRec < total && (
                        <div style={{ background: 'oklch(0.66 0.22 25 / .1)', border: '1px solid oklch(0.66 0.22 25 / .3)', borderRadius: 8, padding: '8px 12px' }}>
                          <span style={{ fontSize: 12, color: 'oklch(0.80 0.12 25)' }}>Falta: Bs. {(total - montoRec).toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* QR */}
                  {metodoPago === 'qr' && (
                    <div style={{ background: 'var(--glass)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--display)', color: 'var(--red)', marginBottom: 10 }}>Bs. {total.toFixed(2)}</div>
                      <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
                        {posConfig.qr_imagen ? (
                          <img src={`file://${posConfig.qr_imagen}`} alt="QR" style={{ width: 160, height: 160, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--line)', display: 'block' }} />
                        ) : (
                          <div style={{ width: 160, height: 160, background: 'oklch(1 0 0 / .06)', borderRadius: 8, border: '1px dashed var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <QrCode size={36} color="var(--dim)" />
                            <span style={{ fontSize: 11, color: 'var(--dim)' }}>QR no configurado</span>
                          </div>
                        )}
                        <button type="button" onClick={() => setQrAmpliado(true)} style={{ position: 'absolute', top: 5, right: 5, padding: '3px 7px', borderRadius: 5, background: 'oklch(0 0 0 / .65)', backdropFilter: 'blur(6px)', border: '1px solid oklch(1 0 0 / .2)', display: 'flex', alignItems: 'center', gap: 3, color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                          <Maximize2 size={10} /> Ampliar
                        </button>
                      </div>
                      {posConfig.qr_banco && <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 8 }}>{posConfig.qr_banco}{posConfig.qr_cuenta ? ` — ${posConfig.qr_cuenta}` : ''}</div>}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center', cursor: 'pointer', fontSize: 13, color: 'var(--muted)' }}>
                        <input type="checkbox" checked={qrConfirmado} onChange={e => setQrConfirmado(e.target.checked)} />
                        Pago confirmado
                      </label>
                    </div>
                  )}

                  {/* TARJETA / TRANSFERENCIA */}
                  {(metodoPago === 'tarjeta' || metodoPago === 'transferencia') && (
                    <div style={{ background: 'var(--glass)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--display)', color: 'var(--red)', marginBottom: 8 }}>Bs. {total.toFixed(2)}</div>
                      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 0 }}>
                        {metodoPago === 'tarjeta' ? 'Procesa el pago en el datáfono.' : 'Solicita el comprobante de transferencia.'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — apertura de caja requerida */}
        {!exito && cajaCerradaPrompt && (
          <div style={{ padding: '16px 22px', borderTop: '1px solid oklch(0.82 0.14 75 / .4)', background: 'oklch(0.82 0.14 75 / .05)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.90 0.10 75)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
              <X size={14} color="oklch(0.82 0.14 75)" /> No hay caja abierta — ábrela para continuar
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: 'var(--dim)', display: 'block', marginBottom: 4 }}>Monto inicial (Bs.)</label>
                <input className="gym-input" type="number" min="0" step="0.01" value={montoInicialCaja} onChange={e => setMontoInicialCaja(e.target.value)} style={{ height: 36, fontSize: 13 }} />
              </div>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: 10, color: 'var(--dim)', display: 'block', marginBottom: 4 }}>Observaciones (opcional)</label>
                <input className="gym-input" value={notasCaja} onChange={e => setNotasCaja(e.target.value)} placeholder="Inicio de turno..." style={{ height: 36, fontSize: 13 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setCajaCerradaPrompt(false)} className="btn-secondary" style={{ flex: 1, height: 36 }}>Cancelar</button>
              <button
                onClick={abrirCajaYContinuar}
                disabled={abriendoCaja}
                style={{ flex: 2, height: 36, borderRadius: 9, fontSize: 13, fontWeight: 700, background: 'oklch(0.78 0.16 155 / .2)', border: '1px solid oklch(0.78 0.16 155 / .5)', color: 'oklch(0.78 0.16 155)', cursor: abriendoCaja ? 'not-allowed' : 'pointer', opacity: abriendoCaja ? 0.7 : 1 }}
              >
                {abriendoCaja ? 'Abriendo...' : '✓ Abrir Caja y Registrar Venta'}
              </button>
            </div>
          </div>
        )}

        {/* Footer — normal */}
        {!exito && !cajaCerradaPrompt && carrito.length > 0 && (
          <div style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--dim)' }}>TOTAL</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--display)', color: 'oklch(0.72 0.17 155)' }}>Bs. {total.toFixed(2)}</div>
            </div>
            <button
              onClick={handleProcesar}
              disabled={procesando || !puedeConfirmar()}
              className="btn-primary"
              style={{ padding: '11px 28px', fontSize: 14, fontWeight: 700, opacity: (procesando || !puedeConfirmar()) ? 0.5 : 1 }}
            >
              {procesando ? 'Procesando...' : 'Registrar Venta'}
            </button>
          </div>
        )}

        {/* QR ampliado portal */}
        {qrAmpliado && createPortal(
          <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'oklch(0 0 0 / .85)', backdropFilter: 'blur(10px)' }} onClick={() => setQrAmpliado(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: 400 }}>
              {posConfig.qr_imagen
                ? <img src={`file://${posConfig.qr_imagen}`} alt="QR Pago" style={{ width: 300, height: 300, objectFit: 'contain' }} />
                : <div style={{ width: 300, height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', borderRadius: 12 }}><QrCode size={80} color="#ccc" /></div>
              }
              {posConfig.qr_banco && <div style={{ fontSize: 14, color: '#333', fontWeight: 600 }}>{posConfig.qr_banco}{posConfig.qr_cuenta ? ` — ${posConfig.qr_cuenta}` : ''}</div>}
              <div style={{ fontSize: 22, fontWeight: 800, color: '#111', fontFamily: 'Oxanium, sans-serif' }}>Bs. {total.toFixed(2)}</div>
              <button onClick={() => { setQrConfirmado(true); setQrAmpliado(false) }} style={{ width: '100%', padding: '12px', borderRadius: 10, background: '#111', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                Pago Recibido
              </button>
            </div>
          </div>,
          document.body
        )}
      </motion.div>
    </div>
    {formRecibo && <FormDatosRecibo datos={formRecibo} onDatos={setFormRecibo} onConfirmar={confirmarRecibo} onCancelar={() => setFormRecibo(null)} />}
    {reciboPrevia && <VistaRecibo venta={reciboPrevia} onClose={() => setReciboPrevia(null)} />}
    </>
  )
}

function getEstadoMembresia(cliente) {
  if (!cliente.mem_id) return 'sin_plan'
  if (cliente.mem_estado === 'pausada') return 'pausada'
  const dias = cliente.dias_restantes
  if (dias === null || dias === undefined || dias < 0) return 'vencida'
  if (dias <= 5) return 'por_vencer'
  return 'activa'
}

export default function ControlAcceso() {
  const { tienePermiso, usuario, esModuloActivo } = useAuth()
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState([])
  const [clienteActual, setClienteActual] = useState(null)
  const [ingresoRegistrado, setIngresoRegistrado] = useState(false)
  const [ingresoHora, setIngresoHora] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [wizardMode, setWizardMode] = useState('nuevo')
  const [wizardClienteId, setWizardClienteId] = useState(null)
  const [showVentaRapida, setShowVentaRapida] = useState(false)
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const buscar = useCallback(async (q) => {
    if (!q.trim()) { setResultados([]); return }
    setBuscando(true)
    try {
      const res = await window.api.clientes.buscarPOS(q)
      setResultados(res || [])
    } finally {
      setBuscando(false)
    }
  }, [])

  function handleInputChange(e) {
    const v = e.target.value
    setQuery(v)
    setClienteActual(null)
    setIngresoRegistrado(false)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => buscar(v), 200)
  }

  async function seleccionarCliente(cliente) {
    setQuery('')
    setResultados([])
    setIngresoRegistrado(false)

    const fresh = await window.api.clientes.buscarPOSById(cliente.id)
    const c = fresh || cliente
    const estado = getEstadoMembresia(c)
    setClienteActual({ ...c, _estado: estado })

    if (estado === 'activa' || estado === 'por_vencer') {
      try {
        await window.api.asistencias.registrarById(c.id)
        const hora = new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
        setIngresoRegistrado(true)
        setIngresoHora(hora)
        toast.success(`Bienvenido, ${c.nombre} ${c.apellido}!`)
      } catch {
        toast.error('Error al registrar ingreso')
      }
    }

    setTimeout(() => inputRef.current?.focus(), 100)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (resultados.length > 0) {
      await seleccionarCliente(resultados[0])
    }
  }

  function abrirWizardNuevo() {
    setWizardMode('nuevo')
    setWizardClienteId(null)
    setShowWizard(true)
  }

  function abrirWizardRenovar(clienteId) {
    setWizardMode('renovar')
    setWizardClienteId(clienteId)
    setShowWizard(true)
  }

  async function onWizardExito(clienteId) {
    setShowWizard(false)
    const fresh = await window.api.clientes.buscarPOSById(clienteId)
    if (fresh) {
      const estado = getEstadoMembresia(fresh)
      setClienteActual({ ...fresh, _estado: estado })
      setIngresoRegistrado(true)
      setIngresoHora(new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }))
    }
  }

  const puedeCrearCliente = tienePermiso('clientes.crear')
  const puedeVender = tienePermiso('ventas.realizar') && esModuloActivo('ventas') && esModuloActivo('inventario')

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 className="titulo-metalico" style={{ marginBottom: 4 }}>Control de Acceso</h1>
          <p style={{ fontSize: 13, color: 'var(--dim)' }}>Registro rápido de clientes</p>
        </div>
        {puedeVender && (
          <button
            type="button"
            onClick={() => setShowVentaRapida(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: 'oklch(0.78 0.18 200 / .15)', border: '1px solid oklch(0.78 0.18 200 / .4)',
              color: 'oklch(0.78 0.18 200)', cursor: 'pointer', flexShrink: 0,
              transition: 'background .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'oklch(0.78 0.18 200 / .22)'}
            onMouseLeave={e => e.currentTarget.style.background = 'oklch(0.78 0.18 200 / .15)'}
          >
            <ShoppingCart size={15} />
            Nueva Venta
          </button>
        )}
      </div>

      {/* Buscador */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 12, marginBottom: 20, position: 'relative' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            size={20}
            style={{
              position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--dim)', pointerEvents: 'none',
            }}
          />
          <input
            ref={inputRef}
            type="text"
            className="gym-input"
            placeholder="Carnet, código o nombre..."
            value={query}
            onChange={handleInputChange}
            autoComplete="off"
            style={{
              paddingLeft: 52, paddingRight: 20,
              fontSize: 18, height: 56,
              borderRadius: 12,
            }}
          />
          {/* Dropdown resultados */}
          <AnimatePresence>
            {resultados.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50,
                  background: 'oklch(0.13 0.01 250)',
                  border: '1px solid var(--line-s)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  boxShadow: '0 12px 40px oklch(0 0 0 / .6)',
                }}
              >
                {resultados.map((r, i) => {
                  const estado = getEstadoMembresia(r)
                  const colorEstado = estado === 'activa' ? 'var(--green)' : estado === 'por_vencer' ? 'var(--amber)' : 'oklch(0.75 0.18 25)'
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => seleccionarCliente(r)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 16px',
                        background: i === 0 ? 'oklch(1 0 0 / .04)' : 'transparent',
                        border: 'none', cursor: 'pointer', textAlign: 'left',
                        borderBottom: i < resultados.length - 1 ? '1px solid oklch(1 0 0 / .06)' : 'none',
                        transition: 'background .15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'oklch(1 0 0 / .07)'}
                      onMouseLeave={e => e.currentTarget.style.background = i === 0 ? 'oklch(1 0 0 / .04)' : 'transparent'}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        background: 'oklch(0.66 0.22 25 / .2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 700, color: 'var(--red-soft)',
                        fontFamily: 'var(--display)',
                      }}>
                        {r.nombre?.[0]}{r.apellido?.[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.nombre} {r.apellido}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--dim)' }}>
                          CI: {r.carnet} {r.extension_ci || ''} · {r.codigo || ''}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
                        padding: '3px 8px', borderRadius: 999,
                        background: `${colorEstado}20`,
                        color: colorEstado,
                        border: `1px solid ${colorEstado}40`,
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                        {estado === 'activa' ? 'ACTIVO' : estado === 'por_vencer' ? 'POR VENCER' : estado === 'vencida' ? 'VENCIDO' : estado === 'sin_plan' ? 'SIN PLAN' : 'PAUSADO'}
                      </div>
                    </button>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {puedeCrearCliente && (
          <button
            type="button"
            onClick={abrirWizardNuevo}
            className="btn-primary"
            style={{ height: 56, padding: '0 24px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, fontSize: 14 }}
          >
            <UserPlus size={18} />
            <span>Nuevo Cliente</span>
          </button>
        )}
      </form>

      {/* Tarjeta del cliente */}
      <AnimatePresence mode="wait">
        {clienteActual && (
          <motion.div
            key={clienteActual.id}
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <ClienteCard
              cliente={clienteActual}
              estado={clienteActual._estado}
              ingresoRegistrado={ingresoRegistrado}
              ingresoHora={ingresoHora}
              onRenovar={() => abrirWizardRenovar(clienteActual.id)}
              onVerPerfil={() => {}}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Estado vacío */}
      {!clienteActual && !query && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '64px 0', gap: 12,
        }}>
          <Search size={48} style={{ color: 'oklch(1 0 0 / .08)' }} />
          <p style={{ color: 'var(--dim)', fontSize: 14 }}>Escribe para buscar un cliente</p>
          <p style={{ color: 'oklch(1 0 0 / .2)', fontSize: 12 }}>Busca por nombre, CI, código o teléfono</p>
        </div>
      )}

      {/* Wizard */}
      <AnimatePresence>
        {showWizard && (
          <NuevoClienteWizard
            mode={wizardMode}
            clienteId={wizardClienteId}
            onClose={() => setShowWizard(false)}
            onExito={onWizardExito}
            usuario={usuario}
          />
        )}
      </AnimatePresence>

      {/* Venta rápida de productos */}
      <AnimatePresence>
        {showVentaRapida && (
          <ModalVentaRapida
            usuario={usuario}
            onClose={() => setShowVentaRapida(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
