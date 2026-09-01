import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Search, UserPlus, CheckCircle, XCircle, AlertTriangle, PauseCircle, ShoppingCart, Plus, Minus, X, Trash2, QrCode, Maximize2, CreditCard, ArrowLeftRight, Banknote, Receipt, Tag, KeyRound, Undo2 } from 'lucide-react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { PAGES } from '../constants'
import ClienteCard from '../components/pos/ClienteCard'
import NuevoClienteWizard from '../components/pos/NuevoClienteWizard'
import LiquidVentaButton from '../components/pos/LiquidVentaButton'
import VistaRecibo from '../modules/recibos/VistaRecibo'
import { waterContainer, waterCard, waterCardSide, waterContainerReduced, waterCardReduced, waterCardControlled, waterCardSideControlled } from '../animations/waterVariants'
import './ControlAcceso.css'

// Propiedades de layout que van al wrapper interno (.glass-content)
// en vez de al <button> exterior — ver VrGlassButton.
const GLASS_CONTENT_LAYOUT_KEYS = ['display', 'alignItems', 'justifyContent', 'flexDirection', 'flexWrap', 'gap']
function splitGlassStyle(style = {}) {
  const content = {}, outer = {}
  for (const k in style) {
    if (GLASS_CONTENT_LAYOUT_KEYS.includes(k)) content[k] = style[k]
    else outer[k] = style[k]
  }
  return { content, outer }
}

// ─── Efecto "agua" real — Fase 2 (revisada) ───────────────────────────────────
// 2 olas SVG superpuestas (distinta velocidad/opacidad = profundidad),
// 100% inline/offline — ver .label/.liquid/.wave1/.wave2 en
// ControlAcceso.css. Envuelve el contenido REAL de cada botón (children)
// sin reescribirlo: `.label` es donde vivía el layout flex del botón/
// glass-content originales (por eso recibe `style` — mismo criterio que
// splitGlassStyle más abajo, así el ícono+texto siguen centrados/con su
// gap exactos, ya que .liquid es position:absolute y no participa del
// flex del padre). El path del wave es el mismo SVG en las 2 <path> —
// nada de <defs>/<use> con id compartido (cada botón tiene su propia
// instancia inline, sin riesgo de colisión de id entre instancias).
const WATER_WAVE_PATH = 'M300,300V2.5c0,0-0.6-0.1-1.1-0.1c0,0-25.5-2.3-40.5-2.4c-15,0-40.6,2.4-40.6,2.4c-12.3,1.1-30.3,1.8-31.9,1.9c-2-0.1-19.7-0.8-32-1.9c0,0-25.8-2.3-40.8-2.4c-15,0-40.8,2.4-40.8,2.4c-12.3,1.1-30.4,1.8-32,1.9c-2-0.1-20-0.8-32.2-1.9c0,0-3.1-0.3-8.1-0.7V300H300z'
function WaterButton({ children, style }) {
  return (
    <>
      <span className="label" style={{ width: '100%', height: '100%', ...style }}>{children}</span>
      <span className="liquid" aria-hidden="true">
        <svg viewBox="0 0 300 300" preserveAspectRatio="none">
          <g className="wave-group">
            <path className="wave wave1" d={WATER_WAVE_PATH} />
            <path className="wave wave2" d={WATER_WAVE_PATH} />
          </g>
        </svg>
      </span>
    </>
  )
}

// ─── Botón de vidrio reutilizable — misma ESTRUCTURA DOM que "INICIAR
// SESIÓN" del login (button.glass-root.glass--regular > div.glass-material
// con sus 3 glass-layer [fill/specular/rainbow] > div.glass-content con
// el texto), copiada tal cual del motor GlassMaterial (glass-engine/
// core/glass.js: wrapContent()+buildLayers()) — pero SIN instanciar el
// motor JS (useGlassButton) para estos botones: las variables
// --light-intensity/--rainbow-opacity/--rainbow-offset/--border-intensity/
// --press que normalmente anima glass.js en cada frame (siguiendo la
// posición/velocidad del cursor — la causa del parpadeo/brillo que se
// mueve reportado en Venta Rápida/Nuevo Cliente) quedan CONGELADAS como
// valores fijos en CSS (.vr-glass-btn.glass-root en ControlAcceso.css).
// El material (blur, tinte, refracción vía los mismos filtros SVG
// #glass-refraction-button/#glass-specular-button, specular, drop-shadow,
// inset box-shadow) sigue funcionando 100% vía CSS — ya no reacciona al
// cursor porque no hay ningún loop de rAF escribiendo esas variables por
// JS. `active` agrega un tinte/borde blanco más marcado para distinguir
// el estado seleccionado. `simple`: escape hatch disponible para un botón
// sin material completo (<button> plano, sin glass-root ni capas) si
// alguno lo necesitara — no lo usa ningún botón de esta página ahora
// mismo (los de método de pago pasaron a llevar el material completo,
// ver checklist del ajuste de glass). [REVERTIDO — Parte A, ronda de
// animaciones siguiente] Ya NO envuelve children en <WaterButton> — el
// efecto agua se sacó de TODOS los botones .vr-glass-btn (Venta
// Rápida: método de pago, montos rápidos, Recibo, Registrar Venta,
// etc.), quedan con el material glass original sin ninguna capa de
// líquido encima. <WaterButton> sigue existiendo como componente (lo
// sigue usando "Nuevo Cliente", el otro botón .ca-glass-btn del
// toolbar — NO se tocó). "Nueva Venta" DEJÓ de usarlo (limpieza,
// competía visualmente con el metaball — ver .nueva-venta-content en
// ControlAcceso.css). ──
function VrGlassButton({ children, className = '', active = false, simple = false, style, ...props }) {
  if (simple) {
    return (
      <button
        className={`vr-glass-btn${active ? ' vr-glass-btn--active' : ''}${className ? ' ' + className : ''}`}
        style={style}
        {...props}
      >
        {children}
      </button>
    )
  }
  const { content: contentStyle, outer: outerStyle } = splitGlassStyle(style)
  return (
    <button
      className={`vr-glass-btn glass-root glass--regular${active ? ' vr-glass-btn--active' : ''}${className ? ' ' + className : ''}`}
      style={outerStyle}
      {...props}
    >
      <div className="glass-material" aria-hidden="true">
        <div className="glass-layer glass-layer--fill" />
        <div className="glass-layer glass-layer--specular" />
        <div className="glass-layer glass-layer--rainbow" />
      </div>
      <div className="glass-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', ...contentStyle }}>
        {children}
      </div>
    </button>
  )
}

// ─── Formulario de datos para recibo (venta rápida) ──────────────────────────
function FormDatosRecibo({ datos, onDatos, onConfirmar, onCancelar, confirmLabel = 'Confirmar e imprimir' }) {
  const [sugerencias, setSugerencias] = useState([])
  const [errores, setErrores] = useState({})
  const blurRef = useRef(null)
  const docInputWrapRef = useRef(null)

  // [CORREGIDO — parpadeo/luz que sigue al cursor/destellos rojo-azul]
  // Se había usado useGlassButton (GlassMaterial vía glass.js/card.js)
  // para el marco de este card. Ese motor anima --light-intensity y el
  // --rainbow-opacity/--rainbow-offset en tiempo real siguiendo el
  // cursor, independientemente del tilt 3D (que ya se evitaba) — es la
  // causa raíz reportada. Se reemplaza por vidrio 100% ESTÁTICO, sin
  // ninguna instancia JS: .vr-glass-card en CSS ya trae
  // backdrop-filter:url(#dropdown-glass) + background:transparent,
  // mismo patrón ya probado y estable de .user-dropdown-panel/
  // .ca-results-card.

  // Búsqueda parcial por carnet o nombre mientras escribe
  useEffect(() => {
    const q = datos.doc?.trim()
    if (!q || q.length < 2) { setSugerencias([]); return }
    const timer = setTimeout(async () => {
      try {
        const res = await window.api.clientes.search(q)
        setSugerencias(res?.slice(0, 8) || [])
      } catch (_) { setSugerencias([]) }
    }, 280)
    return () => clearTimeout(timer)
  }, [datos.doc])

  function seleccionar(c) {
    clearTimeout(blurRef.current)
    onDatos({ ...datos, doc: c.carnet, nombre: `${c.nombre} ${c.apellido}`.trim() })
    setSugerencias([])
    setErrores({})
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && sugerencias.length >= 1) seleccionar(sugerencias[0])
    if (e.key === 'Escape') setSugerencias([])
  }

  function handleBlur() {
    blurRef.current = setTimeout(() => setSugerencias([]), 150)
  }

  function handleConfirmar() {
    const errs = {}
    if (!datos.doc?.trim()) errs.doc = 'El CI/NIT es obligatorio'
    if (!datos.nombre?.trim()) errs.nombre = 'El nombre es obligatorio'
    if (Object.keys(errs).length) { setErrores(errs); return }
    onConfirmar(datos)
  }

  const ERR = { fontSize: 10, color: 'oklch(0.75 0.18 25)', marginTop: 3 }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onCancelar} style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .6)', backdropFilter: 'blur(4px)' }} />
      <div className="vr-glass-card" style={{ position: 'relative', zIndex: 1, width: 380, borderRadius: 16 }}>
        <div className="vr-card-body" style={{ padding: '24px 22px' }}>
        <h3 style={{ fontFamily: 'var(--display)', fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginBottom: 18, letterSpacing: '.06em' }}>Datos del comprobante</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── CI / NIT con dropdown ── */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>
              CI / NIT <span style={{ color: 'oklch(0.75 0.18 25)' }}>*</span>
            </label>
            <div ref={docInputWrapRef} style={{ position: 'relative' }}>
              <input
                className="gym-input vr-input"
                placeholder="Carnet, NIT o nombre del cliente"
                value={datos.doc}
                autoFocus
                onChange={e => { onDatos({ ...datos, doc: e.target.value }); setErrores(p => ({ ...p, doc: null })) }}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                style={{ borderColor: errores.doc ? 'oklch(0.75 0.18 25 / .6)' : undefined }}
              />
              {/* [CORREGIDO — sin distorsión de fondo] Este dropdown vivía
                  anidado dentro de .vr-glass-card (el card del modal), que
                  YA trae su propio backdrop-filter:url(#dropdown-glass) —
                  mismo límite de Chromium documentado varias veces en este
                  archivo (un backdrop-filter hijo dentro de un padre que ya
                  tiene uno no se renderiza). Sacarle el filtro a
                  .vr-glass-card no es opción: es el vidrio del modal
                  entero. Se saca este dropdown del árbol anidado con un
                  portal a document.body (mismo patrón que el QR ampliado
                  de ModalVentaRapida, más abajo en este archivo) —
                  position:fixed anclado a la posición real del input
                  (docInputWrapRef), fuera de la cadena de filtros
                  compuestos, así su propio #dropdown-glass sí se ve. */}
              {sugerencias.length > 0 && docInputWrapRef.current && createPortal(
                <div style={{
                  position: 'fixed',
                  top: docInputWrapRef.current.getBoundingClientRect().bottom + 4,
                  left: docInputWrapRef.current.getBoundingClientRect().left,
                  width: docInputWrapRef.current.getBoundingClientRect().width,
                  zIndex: 300,
                  background: 'transparent', backdropFilter: 'url(#dropdown-glass)', WebkitBackdropFilter: 'url(#dropdown-glass)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 10, maxHeight: 240, overflowY: 'auto',
                  boxShadow: '0 12px 32px oklch(0 0 0 / .5)',
                }}>
                  {sugerencias.map((c, i) => (
                    <div
                      key={c.id}
                      onMouseDown={() => seleccionar(c)}
                      style={{
                        padding: '9px 14px', cursor: 'pointer',
                        borderBottom: i < sugerencias.length - 1 ? '1px solid oklch(1 0 0 / .05)' : 'none',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'oklch(1 0 0 / .06)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      <div style={{ fontSize: 13, color: 'var(--ink)', textShadow: '0 1px 3px rgba(0, 0, 0, 0.6)' }}>{c.nombre} {c.apellido}</div>
                      <div style={{ fontSize: 11, color: '#c9cbd1', fontFamily: 'monospace', textShadow: '0 1px 3px rgba(0, 0, 0, 0.6)' }}>{c.carnet}</div>
                    </div>
                  ))}
                </div>,
                document.body
              )}
            </div>
            {errores.doc && <div style={ERR}>{errores.doc}</div>}
          </div>

          {/* ── Nombre ── */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>
              Nombre del cliente <span style={{ color: 'oklch(0.75 0.18 25)' }}>*</span>
            </label>
            <input
              className="gym-input vr-input"
              placeholder="Nombre completo"
              value={datos.nombre}
              onChange={e => { onDatos({ ...datos, nombre: e.target.value }); setErrores(p => ({ ...p, nombre: null })) }}
              style={{ borderColor: errores.nombre ? 'oklch(0.75 0.18 25 / .6)' : undefined }}
            />
            {errores.nombre && <div style={ERR}>{errores.nombre}</div>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <VrGlassButton style={{ flex: 1, height: 40, borderRadius: 10, fontSize: 13, fontWeight: 700 }} onClick={onCancelar}>Cancelar</VrGlassButton>
          <VrGlassButton style={{ flex: 2, height: 40, borderRadius: 10, fontSize: 13, fontWeight: 700 }} onClick={handleConfirmar}>{confirmLabel}</VrGlassButton>
        </div>
        </div>
      </div>
    </div>
  )
}

// ─── Banner Promociones Activas ───────────────────────────────────────────────

const PROMO_TIPO_DESC = { '2x1': '2×1', 'descuento_pct': (v) => `-${v}%`, 'descuento_fijo': (v) => `-Bs.${v}` }

function BannerPromos({ promos }) {
  const [expandido, setExpandido] = useState(true)
  const visible = expandido ? promos : promos.slice(0, 3)
  const hayMas = promos.length > 3

  return (
    <div style={{ borderRadius: 10, background: 'oklch(0.74 0.13 250 / .07)', border: '1px solid oklch(0.74 0.13 250 / .22)', padding: '10px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: visible.length > 0 ? 6 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Tag size={12} color="oklch(0.80 0.12 250)" />
          <span style={{ fontSize: 11, fontWeight: 800, color: 'oklch(0.80 0.12 250)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
            Promociones activas hoy
          </span>
        </div>
        {hayMas && (
          <button onClick={() => setExpandido(e => !e)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'oklch(0.74 0.13 250)', fontWeight: 700 }}>
            {expandido ? 'Ver menos' : `Ver todas (${promos.length})`}
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {visible.map(p => {
          const tipoLabel = p.tipo === '2x1' ? '2×1' : p.tipo === 'descuento_pct' ? `-${p.valor}%` : `-Bs.${p.valor}`
          const prodLabel = p.productos_nombres?.length ? p.productos_nombres.slice(0, 3).join(', ') + (p.productos_nombres.length > 3 ? '…' : '') : 'Todos los productos'
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ fontSize: 9, color: 'var(--dim)' }}>•</span>
              <span style={{ fontSize: 11, color: 'oklch(0.80 0.12 250)', fontWeight: 700 }}>{tipoLabel}</span>
              <span style={{ fontSize: 11, color: 'oklch(0.80 0.12 250)' }}>{p.nombre}</span>
              <span style={{ fontSize: 10, color: 'var(--dim)' }}>→ {prodLabel}</span>
            </div>
          )
        })}
        {!expandido && hayMas && (
          <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>+{promos.length - 3} más…</div>
        )}
      </div>
    </div>
  )
}

// ─── Modal Venta Rápida de Productos ─────────────────────────────────────────

function ModalVentaRapida({ usuario, onClose }) {
  const { esModuloActivo } = useAuth()
  const recibosActivo = esModuloActivo('recibos')
  const facturacionActiva = esModuloActivo('facturacion')
  // [NUEVO — Fase 2 (revisada)] mismo criterio que ControlAcceso() —
  // ver comentario ahí.
  const reduceMotion = useReducedMotion()
  const cardVariant = reduceMotion ? waterCardReduced : waterCard
  const containerVariant = reduceMotion ? waterContainerReduced : waterContainer

  const [busqueda, setBusqueda] = useState('')
  const [productos, setProductos] = useState([])
  const [carrito, setCarrito] = useState([])
  const [promosActivas, setPromosActivas] = useState([])
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
  const [formFactura, setFormFactura] = useState(null)
  const [cajaCerradaPrompt, setCajaCerradaPrompt] = useState(false)
  const [montoInicialCaja, setMontoInicialCaja] = useState('0')
  const [notasCaja, setNotasCaja] = useState('')
  const [abriendoCaja, setAbriendoCaja] = useState(false)
  const buscarRef = useRef(null)

  // Ver comentario largo en FormDatosRecibo: sin motor de cursor
  // (glass.js/card.js) para el contenedor de este modal — vidrio
  // estático vía .vr-glass-card (CSS puro, sin JS).

  useEffect(() => { buscarRef.current?.focus() }, [])

  useEffect(() => {
    window.api.pos.getConfig().then(cfg => setPosConfig(cfg || {}))
    window.api.promociones.getActive().then(p => setPromosActivas(p || [])).catch(() => {})
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

  function getPromoParaProducto(productoId) {
    return promosActivas.find(p =>
      p.productos_ids.length === 0 || p.productos_ids.includes(productoId)
    )
  }

  function agregarItem(prod) {
    const promo = getPromoParaProducto(prod.id)
    setCarrito(prev => {
      const idx = prev.findIndex(i => i.producto_id === prod.id && !i._es_gratis)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], cantidad: next[idx].cantidad + 1 }
        return next
      }
      let precioEfectivo = prod.precio_venta
      if (promo?.tipo === 'descuento_pct') {
        precioEfectivo = prod.precio_venta * (1 - (promo.valor || 0) / 100)
      } else if (promo?.tipo === 'descuento_fijo') {
        precioEfectivo = Math.max(0, prod.precio_venta - (promo.valor || 0))
      }
      return [...prev, {
        producto_id: prod.id,
        nombre_producto: prod.nombre,
        precio_unitario: precioEfectivo,
        precio_original: (promo && promo.tipo !== '2x1') ? prod.precio_venta : null,
        cantidad: 1,
        stock: prod.stock,
        promo_tipo: promo?.tipo || null,
        promo_nombre: promo?.nombre || null,
        promo_valor: promo?.valor || null,
        promo_aplicada: promo?.tipo === '2x1' ? false : (promo ? true : false),
        _precio_base: prod.precio_venta,
      }]
    })
    setBusqueda('')
    setProductos([])
  }

  function aplicar2x1(idx) {
    setCarrito(prev => {
      const item = prev[idx]
      if (!item || item.promo_tipo !== '2x1' || item.promo_aplicada) return prev
      const siguiente = [
        ...prev.slice(0, idx),
        { ...item, promo_aplicada: true, precio_original: item._precio_base },
        { ...item, _es_gratis: true, precio_unitario: 0, precio_original: item._precio_base, cantidad: 1, promo_aplicada: true },
        ...prev.slice(idx + 1),
      ]
      return siguiente
    })
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
  const ahorroTotal = carrito.reduce((s, i) => {
    if (i._es_gratis) return s + i.cantidad * (i._precio_base || i.precio_original || 0)
    if (!i.precio_original) return s
    return s + i.cantidad * (i.precio_original - i.precio_unitario)
  }, 0)
  const montoRec = parseFloat(recibido) || 0
  const vuelto = metodoPago === 'efectivo' ? Math.max(0, montoRec - total) : 0

  const TIPO_PROMO_COLOR = {
    '2x1': 'oklch(0.74 0.13 250)',
    'descuento_pct': 'oklch(0.78 0.16 155)',
    'descuento_fijo': 'oklch(0.82 0.14 75)',
  }
  const TIPO_PROMO_LABEL = {
    '2x1': '2×1',
    'descuento_pct': (v) => `-${v}%`,
    'descuento_fijo': (v) => `-Bs.${v}`,
  }

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
    const itemsRecibo = carrito
      .filter(i => !i._es_gratis)
      .map(i => ({
        nombre: i.nombre_producto,
        cantidad: i.cantidad,
        precio_unitario: i._precio_base || i.precio_unitario,
        total: i.cantidad * i.precio_unitario,
        descuento: i.precio_original ? i.cantidad * (i.precio_original - i.precio_unitario) : 0,
        promo: i.promo_nombre || null,
      }))
    const itemsGratis = carrito
      .filter(i => i._es_gratis)
      .map(i => ({ nombre: `${i.nombre_producto} (GRATIS)`, cantidad: i.cantidad, precio_unitario: 0, total: 0, descuento: 0, promo: i.promo_nombre || null }))
    const todosItems = [...itemsRecibo, ...itemsGratis]

    const reciboData = {
      numero: ventaId || Date.now(),
      fecha: new Date().toLocaleString('es-BO'),
      cliente_nombre: datos.nombre || 'Venta Directa',
      cliente_doc: datos.doc || '',
      items: todosItems,
      total,
      metodo_pago: metodoPago,
      recibido: metodoPago === 'efectivo' ? montoRec : total,
      vuelto,
      cajero: usuario?.nombre_completo || '',
    }
    setReciboPrevia(reciboData)
    setFormRecibo(null)
    window.api.recibos.guardar({
      numero: reciboData.numero,
      venta_id: ventaId || null,
      cliente_nombre: reciboData.cliente_nombre,
      cliente_doc: reciboData.cliente_doc,
      items: todosItems,
      total,
      metodo_pago: metodoPago,
      cajero: reciboData.cajero,
    }).catch(() => {})
    // Actualizar venta con datos del cliente para que aparezca en la lista de ventas
    if (ventaId && (datos.nombre || datos.doc)) {
      window.api.ventas.setCliente(ventaId, datos.nombre || null, datos.doc || null).catch(() => {})
    }
  }

  async function emitirFacturaConDatos(datosForm) {
    setFormFactura(null)
    setEmitiendo(true)
    try {
      const concepto = carrito.map(i => `${i.nombre_producto} x${i.cantidad}`).join(', ')
      const res = await window.api.facturacion.emitirFactura({
        cliente_tipo_doc: 'CI',
        cliente_documento: datosForm.doc,
        cliente_nombre: datosForm.nombre,
        cliente_correo: '',
        concepto: concepto.slice(0, 100) || 'Venta productos',
        cantidad: 1,
        precio_unitario: total,
        descuento: 0,
        monto_total: total,
        metodo_pago: metodoPago,
        enviar_correo: false,
        items: carrito.map(i => ({
          nombre: i.nombre_producto,
          cantidad: i.cantidad,
          precio_unitario: i.precio_original || i.precio_unitario,
          subtotal: i.cantidad * i.precio_unitario,
          descuento_promo: i.precio_original ? i.cantidad * (i.precio_original - i.precio_unitario) : 0,
        })),
      })
      if (res.ok) toast.success('Factura emitida — ver Historial de Facturas')
      else toast.error(res.error || 'Error al emitir factura')
    } catch (err) { toast.error(err.message || 'Error') }
    setEmitiendo(false)
  }

  // [CORREGIDO — "Datos del comprobante"/"Recibo" se veían más oscuros
  // que Venta Rápida] Ambos se montan como HERMANOS de este modal, no lo
  // reemplazan — el overlay oscuro de ESTE modal (de acá abajo) seguía
  // ahí detrás, sumado al overlay propio de FormDatosRecibo (.6 blur 4)
  // o de VistaRecibo (.8 blur 8, componente compartido en
  // modules/recibos/ — no se toca, se usa también solo en otras
  // páginas). Dos oscurecimientos apilados = "muy oscuro", mismo
  // diagnóstico que ya se hizo con Nuevo Cliente. Se oculta ESTE overlay
  // (no el modal completo, solo su capa de oscurecimiento) mientras haya
  // un hijo montado encima — queda un solo nivel de oscurecimiento,
  // igual que Venta Rápida sola. [CORREGIDO — faltaba qrAmpliado] El QR
  // ampliado (.85 blur10, ver portal más abajo) es OTRO overlay hijo
  // que se había quedado afuera de este check — mismo problema apilado.
  const hayModalHijoEncima = !!(formRecibo || formFactura || reciboPrevia || qrAmpliado)

  return (
    <>
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {!hayModalHijoEncima && (
        <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .7)', backdropFilter: 'blur(6px)' }} />
      )}
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        style={{
          position: 'relative', zIndex: 1, width: 580, maxHeight: 'calc(100vh - 80px)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div className="vr-glass-card" style={{ borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 80px)' }}>
        <div className="vr-card-body" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShoppingCart size={18} color="oklch(0.78 0.18 200)" />
            <span style={{ fontFamily: 'var(--display)', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Venta Rápida</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)' }}><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* [NUEVO — Fase 2, punto 3] Transición entre "formulario de
              venta" y "confirmación" — antes era un salto instantáneo,
              ahora fade+slide con AnimatePresence mode="wait" (mismo
              patrón que los pasos de Nuevo Cliente). */}
          <AnimatePresence mode="wait">
          {exito ? (
            // No existía ninguna animación acá (confirmado en la
            // auditoría Fase 1) — se agrega el MISMO patrón "pop" que ya
            // usa ConfirmacionExito en NuevoClienteWizard.jsx (círculo
            // con spring stiffness:200, delay:0.1 + contenedor
            // opacity+scale). No se importa el componente de ahí porque
            // su lógica interna está atada a datos de membresía
            // (resultado.clienteId, persistencia de recibo con otro
            // shape) — se replica solo la animación, sin duplicar esa
            // lógica de negocio.
            <motion.div
              key="exito"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              style={{ textAlign: 'center', padding: '32px 0', color: 'oklch(0.72 0.17 155)' }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                style={{ margin: '0 auto 12px', width: 48, height: 48 }}
              >
                <CheckCircle size={48} />
              </motion.div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--display)' }}>Venta registrada</div>
              <div style={{ fontSize: 14, color: 'var(--dim)', marginTop: 6 }}>Bs. {total.toFixed(2)}</div>
              {(recibosActivo || facturacionActiva) ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Generar comprobante</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {recibosActivo && (
                      <VrGlassButton onClick={imprimirRecibo}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, fontSize: 12, fontWeight: 600 }}>
                        <Receipt size={13} />Recibo
                      </VrGlassButton>
                    )}
                    {facturacionActiva && (
                      <button onClick={() => setFormFactura({ doc: '', nombre: '' })} disabled={emitiendo}
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
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              {/* Banner de promociones activas */}
              {promosActivas.length > 0 && (
                <BannerPromos promos={promosActivas} />
              )}

              {/* Buscador de productos */}
              <div>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--dim)', pointerEvents: 'none' }} />
                  <input
                    ref={buscarRef}
                    type="text"
                    className="gym-input vr-input"
                    placeholder="Buscar producto por nombre o código..."
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    style={{ paddingLeft: 32, paddingRight: 12, fontSize: 13, height: 40 }}
                  />
                </div>
                <AnimatePresence>
                  {productos.length > 0 && (
                    <motion.div
                      variants={containerVariant}
                      initial="hidden"
                      animate="visible"
                      exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
                      style={{ background: 'transparent', backdropFilter: 'url(#dropdown-glass)', WebkitBackdropFilter: 'url(#dropdown-glass)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, overflow: 'hidden', marginTop: 4 }}
                    >
                      {/* [CAMBIADO — Fase 2 (revisada)] waterContainer/
                          waterCard con spring. La opacidad de "agotado"
                          no puede vivir en el variant compartido (es
                          dinámica por producto) — variant local por fila
                          que reusa la MISMA curva/spring de waterCard,
                          solo cambiando el opacity de destino. */}
                      {productos.slice(0, 6).map((p, i) => {
                        const promo = getPromoParaProducto(p.id)
                        const agotado = p.stock <= 0
                        const stockBajo = !agotado && p.stock_minimo && p.stock <= p.stock_minimo
                        const itemVariant = reduceMotion
                          ? { hidden: { opacity: 0 }, visible: { opacity: agotado ? 0.5 : 1 } }
                          : { hidden: { opacity: 0, y: 40, scale: 0.9 }, visible: { opacity: agotado ? 0.5 : 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 380, damping: 20, mass: 1 } } }
                        return (
                          <motion.button
                            key={p.id}
                            type="button"
                            onClick={() => !agotado && agregarItem(p)}
                            variants={itemVariant}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '9px 14px', background: 'transparent', border: 'none',
                              cursor: agotado ? 'not-allowed' : 'pointer',
                              borderBottom: i < productos.slice(0, 6).length - 1 ? '1px solid oklch(1 0 0 / .05)' : 'none',
                              textAlign: 'left',
                              // [NUEVO — Parte B.9] Ya tenía el cambio de fondo al
                              // hover (líneas de abajo) pero era instantáneo —
                              // se le agrega la transición, MICRO.
                              transition: 'background 120ms ease-out',
                            }}
                            disabled={agotado}
                            onMouseEnter={e => { if (!agotado) e.currentTarget.style.background = 'oklch(1 0 0 / .05)' }}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{p.nombre}</span>
                                {agotado && (
                                  <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 5, background: 'oklch(0.66 0.22 25 / .15)', border: '1px solid oklch(0.66 0.22 25 / .4)', color: 'oklch(0.75 0.18 25)', letterSpacing: '.08em' }}>AGOTADO</span>
                                )}
                                {stockBajo && (
                                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 5, background: 'oklch(0.82 0.14 75 / .12)', border: '1px solid oklch(0.82 0.14 75 / .35)', color: 'oklch(0.82 0.14 75)' }}>Stock bajo</span>
                                )}
                              </div>
                              {promo && (
                                <div style={{ fontSize: 11, color: TIPO_PROMO_COLOR[promo.tipo] || 'oklch(0.74 0.13 250)', marginTop: 1 }}>
                                  🏷️ Promo: {promo.nombre}
                                </div>
                              )}
                              <div style={{ fontSize: 11, color: '#c9cbd1' }}>
                                Stock: {p.stock} {p.unidad || ''}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.78 0.18 200)' }}>Bs. {Number(p.precio_venta).toFixed(2)}</div>
                              {promo && !agotado && (
                                <div style={{ fontSize: 10, color: TIPO_PROMO_COLOR[promo.tipo], fontWeight: 600 }}>
                                  {promo.tipo === '2x1' ? '2×1' : promo.tipo === 'descuento_pct' ? `-${promo.valor}%` : `-Bs.${promo.valor}`}
                                </div>
                              )}
                            </div>
                          </motion.button>
                        )
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Carrito — [NUEVO, Fase 2 punto 3] swap animado entre
                  estado vacío y carrito con contenido, en vez del salto
                  instantáneo de antes. */}
              <AnimatePresence mode="wait" initial={false}>
              {carrito.length > 0 ? (
                <motion.div key="carrito-lleno" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.2 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>Carrito ({carrito.length} ítem{carrito.length !== 1 ? 's' : ''})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {/* [NUEVO — Fase 2, punto 3] Entrada/salida por fila —
                        key estable (producto_id + si es la unidad gratis
                        de un 2x1, nunca el índice: el índice cambia de
                        item cuando se quita una fila del medio, y eso le
                        haría animar/reasignar la fila EQUIVOCADA). */}
                    <AnimatePresence initial={false}>
                    {carrito.map((item, idx) => {
                      const promoColor = TIPO_PROMO_COLOR[item.promo_tipo] || 'oklch(0.74 0.13 250)'
                      const es2x1Pendiente = item.promo_tipo === '2x1' && !item.promo_aplicada && !item._es_gratis
                      return (
                        <motion.div
                          key={`${item.producto_id}-${item._es_gratis ? 'gratis' : 'normal'}`}
                          variants={cardVariant}
                          initial="hidden"
                          animate="visible"
                          exit="hidden"
                          style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          // Fondo con distorsión (mismo filtro que el dropdown de
                          // usuario) en vez de un relleno plano — el tinte de color
                          // de promo/gratis se mantiene (es indicador, no material)
                          // y se pinta ENCIMA de la distorsión, no la reemplaza.
                          background: item._es_gratis ? 'oklch(0.78 0.16 155 / .06)' : item.promo_tipo ? `${promoColor}08` : 'transparent',
                          backdropFilter: 'url(#dropdown-glass)',
                          WebkitBackdropFilter: 'url(#dropdown-glass)',
                          border: item._es_gratis ? '1px solid oklch(0.78 0.16 155 / .25)' : item.promo_tipo ? `1px solid ${promoColor}25` : '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 8, padding: '8px 12px',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13, color: item._es_gratis ? 'oklch(0.72 0.17 155)' : 'var(--ink)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
                                {item._es_gratis ? `${item.nombre_producto} (GRATIS)` : item.nombre_producto}
                              </span>
                              {item.promo_tipo && !item._es_gratis && item.promo_aplicada && (
                                <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 5, background: `${promoColor}20`, border: `1px solid ${promoColor}40`, color: promoColor, whiteSpace: 'nowrap' }}>
                                  {item.promo_tipo === '2x1' ? '2×1' : item.promo_tipo === 'descuento_pct' ? `-${item.promo_valor}%` : `-Bs.${item.promo_valor}`}
                                </span>
                              )}
                            </div>
                            {item._es_gratis ? (
                              <div style={{ fontSize: 11, color: 'oklch(0.72 0.17 155)', fontWeight: 600 }}>¡Gratis! 🎁</div>
                            ) : item.precio_original ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ fontSize: 10, color: 'var(--dim)', textDecoration: 'line-through' }}>Bs. {item.precio_original.toFixed(2)}</span>
                                <span style={{ fontSize: 11, color: promoColor, fontWeight: 600 }}>Bs. {item.precio_unitario.toFixed(2)} c/u</span>
                              </div>
                            ) : (
                              <div style={{ fontSize: 11, color: 'var(--dim)' }}>Bs. {item.precio_unitario.toFixed(2)} c/u</div>
                            )}
                            {es2x1Pendiente && (
                              <button
                                onClick={() => aplicar2x1(idx)}
                                style={{ marginTop: 4, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: 'oklch(0.74 0.13 250 / .15)', border: '1px solid oklch(0.74 0.13 250 / .45)', color: 'oklch(0.80 0.12 250)', cursor: 'pointer' }}
                              >
                                🏷️ Aplicar 2×1 (+ 1 gratis)
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {!item._es_gratis && (
                              <>
                                <button onClick={() => cambiarCantidad(idx, -1)} style={{ width: 24, height: 24, borderRadius: 6, background: 'oklch(1 0 0 / .06)', border: '1px solid var(--line)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}><Minus size={11} /></button>
                                <span style={{ minWidth: 20, textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{item.cantidad}</span>
                                <button onClick={() => cambiarCantidad(idx, 1)} style={{ width: 24, height: 24, borderRadius: 6, background: 'oklch(1 0 0 / .06)', border: '1px solid var(--line)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}><Plus size={11} /></button>
                              </>
                            )}
                          </div>
                          <div style={{ minWidth: 72, textAlign: 'right', fontSize: 13, fontWeight: 700, color: item._es_gratis ? 'oklch(0.72 0.17 155)' : 'oklch(0.78 0.18 200)', flexShrink: 0 }}>
                            {item._es_gratis ? 'Bs. 0.00' : `Bs. ${(item.cantidad * item.precio_unitario).toFixed(2)}`}
                          </div>
                          <button onClick={() => setCarrito(prev => {
                            const next = prev.filter((_, i) => i !== idx)
                            if (item._es_gratis) return next
                            return next.filter(x => !(x._es_gratis && x.producto_id === item.producto_id))
                          })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)', flexShrink: 0 }}>
                            <Trash2 size={13} />
                          </button>
                        </motion.div>
                      )
                    })}
                    </AnimatePresence>
                  </div>
                  {ahorroTotal > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 6, padding: '5px 8px', borderRadius: 6, background: 'oklch(0.78 0.16 155 / .08)', border: '1px solid oklch(0.78 0.16 155 / .2)' }}>
                      <Tag size={10} color="oklch(0.72 0.16 155)" />
                      <span style={{ fontSize: 11, color: 'oklch(0.72 0.16 155)', fontWeight: 600 }}>Ahorro por promos: Bs. {ahorroTotal.toFixed(2)}</span>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div key="carrito-vacio" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.2 }} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--dim)' }}>
                  <ShoppingCart size={36} style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 13 }}>Busca y agrega productos al carrito</p>
                </motion.div>
              )}
              </AnimatePresence>

              {/* Método de pago — [NUEVO, Fase 2 punto 3] aparece/
                  desaparece con fade+slide en vez de golpe. */}
              <AnimatePresence>
              {carrito.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.2 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>Método de pago</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    {[['efectivo','Efectivo',Banknote], ['qr','QR',QrCode], ['tarjeta','Tarjeta',CreditCard], ['transferencia','Transfer.',ArrowLeftRight]].map(([v, l, Icon]) => (
                      <VrGlassButton
                        key={v}
                        active={metodoPago === v}
                        onClick={() => { setMetodoPago(v); setRecibido(''); setQrConfirmado(false) }}
                        style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}
                      ><Icon size={13} />{l}</VrGlassButton>
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
                      <input className="gym-input vr-input" type="number" min="0" step="0.5" value={recibido} onChange={e => setRecibido(e.target.value)} placeholder="0.00" style={{ fontSize: 16, marginBottom: 8 }} autoFocus />
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                        {[50, 100, 200, 500].map(d => (
                          <VrGlassButton key={d} type="button" active={recibido === String(d)} onClick={() => setRecibido(String(d))} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{d}</VrGlassButton>
                        ))}
                        <VrGlassButton type="button" active={recibido === total.toFixed(2)} onClick={() => setRecibido(total.toFixed(2))} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>Exacto</VrGlassButton>
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
                </motion.div>
              )}
              </AnimatePresence>
            </motion.div>
          )}
          </AnimatePresence>
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
                <input className="gym-input vr-input" type="number" min="0" step="0.01" value={montoInicialCaja} onChange={e => setMontoInicialCaja(e.target.value)} style={{ height: 36, fontSize: 13 }} />
              </div>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: 10, color: 'var(--dim)', display: 'block', marginBottom: 4 }}>Observaciones (opcional)</label>
                <input className="gym-input vr-input" value={notasCaja} onChange={e => setNotasCaja(e.target.value)} placeholder="Inicio de turno..." style={{ height: 36, fontSize: 13 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <VrGlassButton onClick={() => setCajaCerradaPrompt(false)} style={{ flex: 1, height: 36, borderRadius: 9, fontSize: 13, fontWeight: 700 }}>Cancelar</VrGlassButton>
              <VrGlassButton
                onClick={abrirCajaYContinuar}
                disabled={abriendoCaja}
                style={{ flex: 2, height: 36, borderRadius: 9, fontSize: 13, fontWeight: 700, opacity: abriendoCaja ? 0.7 : 1 }}
              >
                {abriendoCaja ? 'Abriendo...' : '✓ Abrir Caja y Registrar Venta'}
              </VrGlassButton>
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
            {/* [NUEVO — Parte C, PRUEBA ÚNICA] único botón con el sistema
                de líquido premium completo — ver LiquidVentaButton.jsx.
                No replicar en otros botones todavía. */}
            <LiquidVentaButton
              onClick={handleProcesar}
              disabled={procesando || !puedeConfirmar()}
              style={{ padding: '11px 28px', fontSize: 14, fontWeight: 700, opacity: (procesando || !puedeConfirmar()) ? 0.5 : 1 }}
            >
              {procesando ? 'Procesando...' : 'Registrar Venta'}
            </LiquidVentaButton>
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
        </div>
        </div>
      </motion.div>
    </div>
    {formRecibo && <FormDatosRecibo datos={formRecibo} onDatos={setFormRecibo} onConfirmar={confirmarRecibo} onCancelar={() => setFormRecibo(null)} />}
    {formFactura && <FormDatosRecibo datos={formFactura} onDatos={setFormFactura} onConfirmar={emitirFacturaConDatos} onCancelar={() => setFormFactura(null)} confirmLabel="Emitir Factura" />}
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

// ─── Panel Casilleros (Fase 3) — bloque del panel izquierdo, solo se monta
// cuando esModuloActivo('casilleros') es true (ver return de ControlAcceso
// más abajo). Reutiliza el CRUD de Fase 2 (window.api.casilleros.*) más 4
// funciones agregadas al mismo objeto backend específicamente para esta
// integración: getDisponibles, getAsignadasActivas, asignar, devolver.
//
// Diagnóstico de la "salida": esta página NO tiene un evento de salida
// separado del check-in — `asistencias` solo registra fecha_hora (un
// timestamp de entrada), sin par entrada/salida, y seleccionarCliente()
// siempre registra una asistencia nueva, nunca "cierra" una anterior. Por
// eso la devolución de llave se resuelve como una acción DIRECTA sobre la
// lista en vivo "Llaves en uso ahora" (abajo): el empleado hace click en
// "Devolver" en la fila del cliente que ve salir del gimnasio, sin depender
// de ningún evento de asistencia — no se inventó un concepto de "salida"
// nuevo en la base de datos, solo se usa el estado ya existente de
// casillero_asignaciones (fecha_salida IS NULL = todavía afuera).
function PanelCasilleros({ clienteActual, ingresoRegistrado, usuario, modalAbierto }) {
  // [NUEVO — Fase 2 (revisada)] mismo criterio que ControlAcceso()/
  // ModalVentaRapida() — ver comentario en ControlAcceso().
  const reduceMotion = useReducedMotion()
  const containerVariant = reduceMotion ? waterContainerReduced : waterContainer
  // [CAMBIADO — Parte B.8] spring más controlado (stiffness:300/
  // damping:28) — mismo ajuste que la card de cliente (punto 4).
  const sideVariant = reduceMotion ? waterCardReduced : waterCardSideControlled(true)
  const [disponibles, setDisponibles] = useState([])
  const [activas, setActivas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [asignandoId, setAsignandoId] = useState(null)
  const [devolviendoId, setDevolviendoId] = useState(null)
  const [descartadoClienteId, setDescartadoClienteId] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [d, a] = await Promise.all([
        window.api.casilleros.getDisponibles(),
        window.api.casilleros.getAsignadasActivas(),
      ])
      setDisponibles(d || [])
      setActivas(a || [])
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar, clienteActual?.id])

  // Si el cliente que acaba de hacer check-in ya tiene una llave activa
  // (no la devolvió la vez anterior), no se le vuelve a ofrecer el
  // selector — se informa cuál tiene. Se deriva de `activas` (ya cargada
  // arriba), sin pedirle al backend una consulta aparte.
  const yaTieneLlave = clienteActual ? activas.find(a => a.cliente_id === clienteActual.id) : null
  const mostrarPrompt = !!clienteActual && ingresoRegistrado && !yaTieneLlave && descartadoClienteId !== clienteActual.id

  async function asignar(casilleroId) {
    if (!clienteActual) return
    setAsignandoId(casilleroId)
    try {
      const r = await window.api.casilleros.asignar(casilleroId, clienteActual.id, usuario?.id)
      if (r.ok) {
        toast.success(`Llave asignada a ${clienteActual.nombre}`)
      } else {
        toast.error(r.error || 'No se pudo asignar la llave')
      }
      await cargar()
    } finally {
      setAsignandoId(null)
    }
  }

  async function devolver(casilleroId) {
    setDevolviendoId(casilleroId)
    try {
      await window.api.casilleros.devolver(casilleroId)
      toast.success('Llave devuelta')
      await cargar()
    } finally {
      setDevolviendoId(null)
    }
  }

  function fmtHora(f) {
    if (!f) return '—'
    return new Date(f).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
  }
  function esNoDevuelta(fecha) {
    if (!fecha) return false
    const hoy = new Date().toISOString().slice(0, 10)
    return new Date(fecha).toISOString().slice(0, 10) < hoy
  }

  const TXT_SOMBRA = '0 1px 3px rgba(0, 0, 0, 0.6)'

  return (
    // [CAMBIADO — Fase 2 (revisada)] waterCardSide(true) — entra desde
    // la izquierda con spring, reemplaza el fade+x con duration fija.
    // [NUEVO — Parte B.1] delay:0.15 — último paso del revelado
    // progresivo de la página (título→buscador→botones→panel), ver
    // comentario largo en ControlAcceso() sobre por qué la card de
    // cliente no entra en esta cadena.
    // [NUEVO — Parte B.10] div plano con opacity condicionada envolviendo
    // el motion.div de entrada — mismo patrón que .ca-cliente-card-row en
    // ControlAcceso(), para no pisar la animación de entrada por variants
    // con un valor de opacity en conflicto.
    <div style={{ opacity: modalAbierto ? 0.88 : 1, transition: 'opacity 300ms ease-out' }}>
    <motion.div
      className="ca-side-panel"
      variants={sideVariant}
      initial="hidden"
      animate="visible"
      transition={{ delay: 0.15 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <KeyRound size={16} color="#ffffff" />
        <span style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', letterSpacing: '.04em', textShadow: TXT_SOMBRA }}>Casilleros</span>
      </div>

      {mostrarPrompt && (
        <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ fontSize: 11, color: '#c9cbd1', marginBottom: 8, textShadow: TXT_SOMBRA }}>
            Asignar llave a <strong style={{ color: '#ffffff' }}>{clienteActual.nombre} {clienteActual.apellido}</strong>
          </div>
          {disponibles.length === 0 ? (
            <div style={{ fontSize: 12, color: '#c9cbd1', marginBottom: 8, textShadow: TXT_SOMBRA }}>No hay llaves disponibles</div>
          ) : (
            <motion.div className="ca-key-grid" style={{ marginBottom: 8 }} variants={containerVariant} initial="hidden" animate="visible">
              {/* [CAMBIADO — Fase 2 (revisada)] waterContainer/waterCard
                  con spring — la opacidad de "asignando" (0.5 mientras
                  se procesa un click) no puede vivir en el variant
                  compartido (es dinámica por llave), variant local por
                  botón igual que en el dropdown de productos. */}
              {disponibles.map((k) => {
                // [CAMBIADO — Parte B.8] spring más controlado (300/28).
                const btnVariant = reduceMotion
                  ? { hidden: { opacity: 0 }, visible: { opacity: asignandoId === k.id ? 0.5 : 1 } }
                  : { hidden: { opacity: 0, y: 40, scale: 0.9 }, visible: { opacity: asignandoId === k.id ? 0.5 : 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 28, mass: 1 } } }
                return (
                  <motion.button
                    key={k.id}
                    type="button"
                    className="ca-key-btn"
                    disabled={asignandoId !== null}
                    onClick={() => asignar(k.id)}
                    variants={btnVariant}
                  >
                    {k.numero}
                  </motion.button>
                )
              })}
            </motion.div>
          )}
          <button
            type="button"
            onClick={() => setDescartadoClienteId(clienteActual.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#c9cbd1', padding: 0, textShadow: TXT_SOMBRA }}
          >
            Ingreso sin llave
          </button>
        </div>
      )}

      {!!yaTieneLlave && !!clienteActual && ingresoRegistrado && (
        <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.12)', fontSize: 12, color: '#c9cbd1', textShadow: TXT_SOMBRA }}>
          {clienteActual.nombre} ya tiene la llave <strong style={{ color: '#ffffff' }}>Nº {yaTieneLlave.numero}</strong>
        </div>
      )}

      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#c9cbd1', marginBottom: 8, textShadow: TXT_SOMBRA }}>
        Llaves en uso ahora ({activas.length})
      </div>
      {cargando ? (
        <div style={{ textAlign: 'center', padding: 20 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : activas.length === 0 ? (
        <div style={{ fontSize: 12, color: '#c9cbd1', textShadow: TXT_SOMBRA }}>Ninguna llave asignada</div>
      ) : (
        <div>
          {/* [CAMBIADO — Fase 2 (revisada)] Cada fila entra/sale individual
              (key=asignacion_id, estable — no el índice). El collapse de
              altura anima TAMBIÉN padding/margin (no solo height) — con
              box-sizing:border-box (global, index.css) un height:0 con
              padding vertical fijo NO colapsa a 0 real, el padding se
              sigue viendo; por eso van los 3 en el mismo animate/exit.
              No usa el waterCard compartido tal cual (ese no contempla
              height/padding/margin, específicos de este collapse) — sí
              un spring [CAMBIADO — Parte B.8: 300/28, más controlado]
              en vez de duration fija, para sentirse igual que el resto
              del panel. La SALIDA (al devolver una llave) sigue con
              duration fija (.15s) — un spring en la salida podría hacer
              overshoot negativo (altura por debajo de 0) justo cuando
              tiene que desaparecer del todo, más seguro con duration. */}
          <AnimatePresence initial={false}>
            {activas.map((a, i) => {
              const alerta = esNoDevuelta(a.fecha_entrada)
              const rowTransition = reduceMotion ? { duration: 0.15 } : { type: 'spring', stiffness: 300, damping: 28, mass: 1 }
              return (
                <motion.div
                  key={a.asignacion_id}
                  className={`ca-key-row${alerta ? ' ca-key-row--alerta' : ''}`}
                  initial={{ opacity: 0, x: reduceMotion ? 0 : -8, height: 0, paddingTop: 0, paddingBottom: 0, marginTop: 0 }}
                  animate={{ opacity: 1, x: 0, height: 'auto', paddingTop: 8, paddingBottom: 8, marginTop: i === 0 ? 0 : 6, transition: rowTransition }}
                  exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0, marginTop: 0, transition: { duration: 0.15 } }}
                  style={{ overflow: 'hidden' }}
                >
                  {alerta && <AlertTriangle size={13} color="oklch(0.75 0.18 25)" style={{ flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: TXT_SOMBRA }}>
                      Nº {a.numero} · {a.cliente_nombre}
                    </div>
                    <div style={{ fontSize: 10, color: '#c9cbd1', textShadow: TXT_SOMBRA }}>Desde las {fmtHora(a.fecha_entrada)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => devolver(a.casillero_id)}
                    disabled={devolviendoId !== null}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ffffff', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, flexShrink: 0, opacity: devolviendoId === a.casillero_id ? 0.5 : 1, textShadow: TXT_SOMBRA }}
                  >
                    <Undo2 size={12} /> Devolver
                  </button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
    </div>
  )
}

export default function ControlAcceso() {
  const { tienePermiso, usuario, esModuloActivo } = useAuth()
  const { navigate } = useApp()
  // [NUEVO — Fase 2 (revisada)] prefers-reduced-motion — cuando está
  // activo se usan las variants "Reduced" (solo fade, sin spring/
  // movimiento/escala) en vez de las de agua, ver waterVariants.js.
  const reduceMotion = useReducedMotion()
  const cardVariant = reduceMotion ? waterCardReduced : waterCard
  const containerVariant = reduceMotion ? waterContainerReduced : waterContainer
  // [NUEVO — Parte B.4] Solo para la card de cliente — menos overshoot
  // (stiffness:300/damping:28) que el waterCard compartido de arriba
  // (que sigue en 380/20 para resultados de búsqueda, sin cambios ahí).
  const cardVariantControlled = reduceMotion ? waterCardReduced : waterCardControlled
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
  const [panelCasillerosAbierto, setPanelCasillerosAbierto] = useState(false)
  // [NUEVO — Parte B.10] Con un modal (Venta Rápida o Nuevo Cliente)
  // abierto, el contenido de fondo pierde protagonismo — solo opacity
  // (nada de blur nuevo, ya se usa bastante en esta página), leve
  // (.88, no dramático). El overlay propio de cada modal (oklch(0 0 0
  // /.7) + blur, ya existente) sigue siendo el oscurecimiento
  // principal — esto es una capa ADICIONAL sutil sobre el contenido de
  // Control de Acceso en sí, no un reemplazo de esos overlays.
  const modalAbierto = showWizard || showVentaRapida
  const inputRef = useRef(null)
  const timerRef = useRef(null)
  // [NUEVO] Metaball "Nueva Venta" — el círculo que sigue al cursor
  // real (.nueva-venta-cursor-blob) se mueve escribiendo left/top/
  // transform directo por ref, no por state, para no re-renderizar
  // el componente en cada pointermove (ver ControlAcceso.css/handlers
  // más abajo).
  const ventaBlobRef = useRef(null)
  const ventaWrapRef = useRef(null)
  // [NUEVO] Temblor tipo gelatina — dispara UNA VEZ al entrar el
  // cursor (is-jiggling, ver handleVentaMetaballEnter/ControlAcceso.css).
  // ventaJiggleTimerRef limpia el timeout anterior si el cursor
  // vuelve a entrar antes de que termine el temblor previo (~1.4s) —
  // mismo patrón que refractTimerRef en LiquidVentaButton.jsx, evita
  // que un setIsJiggling(false) viejo corte un temblor nuevo a mitad.
  const [isJiggling, setIsJiggling] = useState(false)
  const ventaJiggleTimerRef = useRef(null)
  // [NUEVO] El líquido (anchor+blob) desaparece mientras se mantiene
  // presionado el click — ver handleVentaMetaballDown/Up e
  // is-pressed en ControlAcceso.css.
  const [isPressed, setIsPressed] = useState(false)
  // [NUEVO — reemplaza al sistema de idle timer de la ronda anterior,
  // que se sacó por completo: el líquido ahora se muestra ÚNICAMENTE
  // mientras el cursor está físicamente encima (mouseenter/leave),
  // sin delay ni timeout de por medio.
  const [isHovering, setIsHovering] = useState(false)

  // [NUEVO] Metaball "Nuevo Cliente" — réplica exacta del sistema de
  // "Nueva Venta" de arriba (mismo estado/refs, mismos handlers, ver
  // handleClienteMetaball* más abajo), con prefijo `cliente` en vez
  // de `venta` para no colisionar. Mismos comentarios/razonamiento
  // que los de Nueva Venta aplican acá — no repetidos línea por
  // línea para no duplicar el historial completo.
  const clienteBlobRef = useRef(null)
  const clienteWrapRef = useRef(null)
  const [isClienteJiggling, setIsClienteJiggling] = useState(false)
  const clienteJiggleTimerRef = useRef(null)
  const [isClientePressed, setIsClientePressed] = useState(false)
  const [isClienteHovering, setIsClienteHovering] = useState(false)

  // [CAMBIADO — de motor JS a vidrio estático] .ca-search-card usaba
  // GlassMaterial vía useGlassButton (channel:"card", chroma:"always"),
  // el mismo motor que causaba el brillo/parpadeo que se corrigió en el
  // resto de esta página (ver comentarios de abajo y ControlAcceso.css).
  // Se pidió el mismo tratamiento que los desplegables: backdrop-filter
  // url(#dropdown-glass) estático, sin instancia JS — ver .ca-search-card
  // en ControlAcceso.css.

  // [CORREGIDO — brillo que sigue al cursor] Los botones "Nueva Venta"/
  // "Nuevo Cliente" usaban este mismo motor (useGlassButton vía
  // glass.js/card.js, channel:'button', chroma:'always'), que anima
  // --light-intensity en tiempo real siguiendo la posición del mouse —
  // eso es exactamente el brillo no deseado reportado. Se quita el
  // motor por completo para estos 2 botones: pasan a vidrio 100%
  // ESTÁTICO vía CSS puro (mismo tratamiento que "INICIAR SESIÓN" del
  // login — drop-shadow + inset box-shadow fijos, sin JS), ver
  // .ca-glass-btn en ControlAcceso.css.

  // [CAMBIADO — parpadeo] .ca-results-card usaba el mismo GlassMaterial
  // JS que el resto (fePointLight/luz que sigue proximidad de cursor,
  // chroma:'always'), pero instanciado vía ref-callback porque el panel
  // entra/sale del DOM en cada búsqueda (AnimatePresence) — cada
  // mount creaba una instancia NUEVA desde cero, y esa instancia
  // arranca sus valores de luz/specular sin el estado suavizado de la
  // anterior, lo que se percibía como un parpadeo de luz blanca cada
  // vez que se tipeaba. Reemplazado por vidrio ESTÁTICO (backdrop-filter
  // vía CSS puro, .ca-results-card en ControlAcceso.css) — sin JS, sin
  // instancia que crear/destruir, sin parpadeo posible.

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // [NUEVO] Metaball "Nueva Venta" — el círculo vive dentro de
  // .nueva-venta-liquid-layer, que tiene inset:-18px (más grande que
  // el wrap, ver ControlAcceso.css) para darle espacio real al blob
  // antes de que el filtro lo recorte. Eso desplaza el origen de
  // coordenadas del propio layer -18px en x/y respecto al wrap — x/y
  // acá se miden contra el wrap (rect = wrap.getBoundingClientRect()),
  // así que hay que sumar +18 al escribir left/top del blob o
  // quedaría dibujado desviado de la posición real del cursor. [OJO —
  // este offset DEBE coincidir siempre con el inset (en valor
  // absoluto) de .nueva-venta-liquid-layer; si se cambia uno hay que
  // cambiar el otro.]
  const handleVentaMetaballMove = useCallback((e) => {
    if (reduceMotion || !ventaWrapRef.current || !ventaBlobRef.current) return
    const rect = ventaWrapRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left + 18
    const y = e.clientY - rect.top + 18
    ventaBlobRef.current.style.left = `${x}px`
    ventaBlobRef.current.style.top = `${y}px`
    ventaBlobRef.current.style.transform = 'translate(-50%, -50%) scale(1)'
    ventaBlobRef.current.style.opacity = '1'
  }, [reduceMotion])

  const handleVentaMetaballLeave = useCallback(() => {
    setIsHovering(false)
    if (!ventaBlobRef.current) return
    ventaBlobRef.current.style.transform = 'translate(-50%, -50%) scale(0)'
    ventaBlobRef.current.style.opacity = '0'
    // Safety net: si el cursor sale del wrap con el botón todavía
    // presionado (mousedown adentro, arrastre afuera, mouseup nunca
    // llega a este elemento), no debe quedar isPressed atascado en
    // true — eso dejaría el líquido invisible para siempre hasta
    // recargar. El pedido original solo cubría mouseup; esto es un
    // caso borde que no estaba, pero sin esto es un bug real.
    setIsPressed(false)
  }, [])

  const handleVentaMetaballEnter = useCallback(() => {
    setIsHovering(true)
    if (reduceMotion) return
    setIsJiggling(true)
    if (ventaJiggleTimerRef.current) clearTimeout(ventaJiggleTimerRef.current)
    // 1400ms — DEBE coincidir con la duración de @keyframes nueva-venta-jiggle
    // (ControlAcceso.css); si se cambia una hay que cambiar la otra.
    ventaJiggleTimerRef.current = setTimeout(() => setIsJiggling(false), 1400)
  }, [reduceMotion])

  const handleVentaMetaballDown = useCallback(() => {
    setIsPressed(true)
  }, [])

  const handleVentaMetaballUp = useCallback(() => {
    setIsPressed(false)
  }, [])

  // [CAMBIADO] Metaball "Nuevo Cliente" — offset sincronizado a +18
  // (antes +24): .nuevo-cliente-liquid-layer usa el mismo inset:-18px
  // que Nueva Venta (el botón mide la misma altura, 56px, la
  // dimensión que determinaba el margen), así que no hizo falta
  // recalcular un offset distinto, solo igualar el valor.
  const handleClienteMetaballMove = useCallback((e) => {
    if (reduceMotion || !clienteWrapRef.current || !clienteBlobRef.current) return
    const rect = clienteWrapRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left + 18
    const y = e.clientY - rect.top + 18
    clienteBlobRef.current.style.left = `${x}px`
    clienteBlobRef.current.style.top = `${y}px`
    clienteBlobRef.current.style.transform = 'translate(-50%, -50%) scale(1)'
    clienteBlobRef.current.style.opacity = '1'
  }, [reduceMotion])

  const handleClienteMetaballLeave = useCallback(() => {
    setIsClienteHovering(false)
    if (!clienteBlobRef.current) return
    clienteBlobRef.current.style.transform = 'translate(-50%, -50%) scale(0)'
    clienteBlobRef.current.style.opacity = '0'
    setIsClientePressed(false)
  }, [])

  const handleClienteMetaballEnter = useCallback(() => {
    setIsClienteHovering(true)
    if (reduceMotion) return
    setIsClienteJiggling(true)
    if (clienteJiggleTimerRef.current) clearTimeout(clienteJiggleTimerRef.current)
    // 1400ms — DEBE coincidir con la duración de @keyframes nuevo-cliente-jiggle
    // (ControlAcceso.css); si se cambia una hay que cambiar la otra.
    clienteJiggleTimerRef.current = setTimeout(() => setIsClienteJiggling(false), 1400)
  }, [reduceMotion])

  const handleClienteMetaballDown = useCallback(() => {
    setIsClientePressed(true)
  }, [])

  const handleClienteMetaballUp = useCallback(() => {
    setIsClientePressed(false)
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

  // [CORREGIDO — Enter no registraba ingreso/llave] handleSubmit tomaba
  // SIEMPRE resultados[0] al presionar Enter, sin mirar su estado —
  // si el primer resultado (orden que decide el backend) era un
  // homónimo con plan vencido/pausado, seleccionarCliente() no
  // registraba asistencia (solo lo hace para 'activa'/'por_vencer',
  // ver más abajo) y el panel de casilleros nunca se disparaba. Desde
  // el mostrador esto se ve exactamente como "busqué por carnet/nombre
  // y no pasó nada" — reproducido: buscar "valeria" con Enter
  // seleccionaba a una "Valeria" vencida en vez de "valeria regresa"
  // (activa). Ahora Enter prioriza el primer resultado que SÍ puede
  // registrar ingreso; si ninguno puede, cae a resultados[0] como
  // antes (mismo mensaje de "plan vencido" que ya mostraba la card).
  async function handleSubmit(e) {
    e.preventDefault()
    if (resultados.length > 0) {
      const elegible = resultados.find(r => {
        const estado = getEstadoMembresia(r)
        return estado === 'activa' || estado === 'por_vencer'
      })
      await seleccionarCliente(elegible || resultados[0])
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
  const casillerosActivo = esModuloActivo('casilleros')

  const contenido = (
    <>
      {/* [NUEVO — Parte B.1] Revelado progresivo al entrar a la página:
          título → buscador → botones → (panel de casilleros, si el
          módulo está activo — ver su propio delay en PanelCasilleros).
          50ms de diferencia entre capa y capa, opacity+y:8→0, MEDIUM
          (.3s easeOut). La card de cliente NO entra en esta cadena a
          propósito: su propio trigger es seleccionar un cliente (no el
          montaje de la página — clienteActual siempre arranca null acá,
          ver useState), así que ya tiene su entrada propia (punto 4) sin
          depender de este delay de layout — meterle este delay fijo la
          haría sentir tarde cada vez que se busca un cliente, no solo al
          entrar a la página. Título — centrado respecto al ANCHO TOTAL
          de la página (fuera del maxWidth:1040 que usa el resto del
          contenido, por eso vive en su propio div sin ese límite).
          Tamaños/fuente sin tocar. */}
      <motion.div
        className="ca-header-title"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: modalAbierto ? 0.88 : 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <h1 className="titulo-metalico" style={{ marginBottom: 4 }}>Control de Acceso</h1>
        <p style={{ fontSize: 13, color: 'var(--dim)' }}>Registro rápido de clientes</p>
      </motion.div>

      {/* Fila del buscador — también fuera del maxWidth:1040 (a
          propósito): los botones necesitan medir sus 200px contra el
          ancho TOTAL de la página, no contra los 860px del buscador —
          si el right:200px se calculara sobre un contenedor de 1040px,
          los botones caerían encima del buscador (860px de ancho) en
          vez de a la derecha de él. El buscador en sí sigue con su
          mismo max-width de 860px por dentro (.ca-toolbar en
          ControlAcceso.css) — mismo tamaño y posición horizontal de
          siempre, solo el WRAPPER que lo contiene dejó de estar
          limitado a 1040px. */}
      <div className="ca-search-actions-row">
        <motion.form
          onSubmit={handleSubmit}
          className="ca-toolbar"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: modalAbierto ? 0.88 : 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut', delay: 0.05 }}
        >
        <div className="ca-search-card">
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={20}
              className="ca-search-icon"
              style={{
                position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)',
                pointerEvents: 'none',
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
            {/* Dropdown resultados — vidrio ESTÁTICO vía CSS (ver
                .ca-results-card en ControlAcceso.css), se monta/desmonta
                con AnimatePresence. Ya no necesita un ref de motor JS —
                el backdrop-filter no necesita instanciarse ni reaccionar
                al mount/unmount, así que no hay parpadeo posible. */}
            {/* [CAMBIADO — Fase 2 (revisada)] waterContainer/waterCard con
                spring real (reemplaza el stagger a mano por índice de la
                ronda anterior) — mismo variant reutilizable que el resto
                de la app, respeta prefers-reduced-motion. */}
            <AnimatePresence>
              {resultados.length > 0 && (
                <motion.div
                  variants={containerVariant}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
                  className="ca-results-wrap"
                >
                  <div className="ca-results-card">
                    <div>
                    {resultados.map((r, i) => {
                      const estado = getEstadoMembresia(r)
                      const colorEstado = estado === 'activa' ? 'var(--green)' : estado === 'por_vencer' ? 'var(--amber)' : 'oklch(0.75 0.18 25)'
                      return (
                        <motion.button
                          key={r.id}
                          type="button"
                          onClick={() => seleccionarCliente(r)}
                          className={`ca-result-item${i === 0 ? ' ca-result-item--default' : ''}`}
                          variants={cardVariant}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                            padding: '10px 16px',
                            cursor: 'pointer', textAlign: 'left',
                            // border (no solo borderBottom) lo da ahora la clase CSS
                            // .ca-result-item (copia literal de .user-dropdown-panel) —
                            // antes un border:'none' inline lo tapaba por completo,
                            // sin importar lo que dijera la clase.
                            borderBottom: i < resultados.length - 1 ? '1px solid oklch(1 0 0 / .1)' : undefined,
                          }}
                        >
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                            background: 'oklch(0.66 0.22 25 / .3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14, fontWeight: 700, color: '#ffffff',
                            fontFamily: 'var(--display)',
                          }}>
                            {r.nombre?.[0]}{r.apellido?.[0]}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 1px 5px rgba(0, 0, 0, 0.85)' }}>
                              {r.nombre} {r.apellido}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#c9cbd1', textShadow: '0 1px 3px rgba(0, 0, 0, 0.6)' }}>
                              CI: {r.carnet} {r.extension_ci || ''} · {r.codigo || ''}
                            </div>
                          </div>
                          {/* [NUEVO — Fase 2, punto 5] Transición de color
                              simple, CSS puro — el cambio de estado ya
                              no es un salto brusco. */}
                          <div style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
                            padding: '3px 8px', borderRadius: 999,
                            background: `${colorEstado}30`,
                            color: colorEstado,
                            border: `1px solid ${colorEstado}60`,
                            whiteSpace: 'nowrap', flexShrink: 0,
                            textShadow: '0 1px 3px rgba(0, 0, 0, 0.6)',
                            transition: 'background 200ms, color 200ms, border-color 200ms',
                          }}>
                            {estado === 'activa' ? 'ACTIVO' : estado === 'por_vencer' ? 'POR VENCER' : estado === 'vencida' ? 'VENCIDO' : estado === 'sin_plan' ? 'SIN PLAN' : 'PAUSADO'}
                          </div>
                        </motion.button>
                      )
                    })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.form>

        <motion.div
          className="ca-toolbar-actions"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: modalAbierto ? 0.88 : 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut', delay: 0.1 }}
        >
          {/* [NUEVO — Parte B.3] Hover: elevación mínima (y:-2, SHORT
              easeOut). Press: scale(.97), MICRO. Release: vuelve a
              hover/reposo con el mismo SHORT del componente (sin
              rebote, física controlada — no whileTap con su propio
              spring). */}
          {puedeVender && (
            <div
              ref={ventaWrapRef}
              className={`nueva-venta-metaball-wrap${isJiggling ? ' is-jiggling' : ''}${isPressed ? ' is-pressed' : ''}${isHovering ? ' is-hovering' : ''}`}
              style={{ height: 56, flexShrink: 0 }}
              onMouseMove={handleVentaMetaballMove}
              onMouseEnter={handleVentaMetaballEnter}
              onMouseLeave={handleVentaMetaballLeave}
              onMouseDown={handleVentaMetaballDown}
              onMouseUp={handleVentaMetaballUp}
            >
              <div className="nueva-venta-glass-bg" aria-hidden="true" />
              <div className="nueva-venta-liquid-layer" aria-hidden="true">
                <div className="nueva-venta-liquid-anchor" />
                <div className="nueva-venta-cursor-blob" ref={ventaBlobRef} />
              </div>
              <motion.button
                type="button"
                onClick={() => setShowVentaRapida(true)}
                className="ca-glass-btn ca-venta-btn"
                style={{
                  flex: 1, padding: '0 20px', fontSize: 14, fontWeight: 700,
                  cursor: 'pointer',
                }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97, transition: { duration: 0.12, ease: 'easeOut' } }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <span className="nueva-venta-content">
                  <ShoppingCart size={17} />
                  <span>Nueva Venta</span>
                </span>
              </motion.button>
            </div>
          )}

          {puedeCrearCliente && (
            <div
              ref={clienteWrapRef}
              className={`nuevo-cliente-metaball-wrap${isClienteJiggling ? ' is-jiggling' : ''}${isClientePressed ? ' is-pressed' : ''}${isClienteHovering ? ' is-hovering' : ''}`}
              style={{ height: 56, flexShrink: 0 }}
              onMouseMove={handleClienteMetaballMove}
              onMouseEnter={handleClienteMetaballEnter}
              onMouseLeave={handleClienteMetaballLeave}
              onMouseDown={handleClienteMetaballDown}
              onMouseUp={handleClienteMetaballUp}
            >
              <div className="nuevo-cliente-glass-bg" aria-hidden="true" />
              <div className="nuevo-cliente-liquid-layer" aria-hidden="true">
                <div className="nuevo-cliente-liquid-anchor" />
                <div className="nuevo-cliente-cursor-blob" ref={clienteBlobRef} />
              </div>
              <motion.button
                type="button"
                onClick={abrirWizardNuevo}
                className="btn-primary ca-glass-btn nuevo-cliente-btn"
                style={{
                  flex: 1, padding: '0 24px', fontSize: 15, fontWeight: 700,
                  cursor: 'pointer',
                }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97, transition: { duration: 0.12, ease: 'easeOut' } }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <span className="nuevo-cliente-content">
                  <UserPlus size={18} />
                  <span>Nuevo Cliente</span>
                </span>
              </motion.button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Tarjeta del cliente — envuelta en su propio contenedor full-width
          (hermano de .ca-search-actions-row, fuera del maxWidth:1040 de
          "resto de la página" de abajo) con display:flex+justify-content:
          center: es lo que le da al margin:0 auto de ClienteCard.jsx
          espacio real para centrarse contra el ancho TOTAL de la página
          (el mismo que usa el buscador) — dentro de un contenedor de
          1040px sin centrar, el margin:auto del hijo solo centraba
          contra ESOS 1040px, no contra la página completa. Tamaños/
          padding de ClienteCard.jsx sin tocar. */}
      {/* [CAMBIADO — Parte B.4] spring más controlado — stiffness:300/
          damping:28 (antes 380/20), menos overshoot, se siente menos
          "rebote de pelota" y más preciso. */}
      <AnimatePresence mode="wait">
        {clienteActual && (
          // [NUEVO — Parte B.10] opacity en el wrapper PLANO (no en el
          // motion.div de adentro, que ya anima su propia entrada vía
          // variants — así no compiten por la misma propiedad).
          <div className="ca-cliente-card-row" style={{ opacity: modalAbierto ? 0.88 : 1, transition: 'opacity 300ms ease-out' }}>
            <motion.div
              key={clienteActual.id}
              variants={cardVariantControlled}
              initial="hidden"
              animate="visible"
              exit="hidden"
              style={{ width: '100%' }}
            >
              <ClienteCard
                cliente={clienteActual}
                estado={clienteActual._estado}
                ingresoRegistrado={ingresoRegistrado}
                ingresoHora={ingresoHora}
                onRenovar={() => abrirWizardRenovar(clienteActual.id)}
                onVerPerfil={() => navigate(PAGES.PERFIL_CLIENTE, { clienteId: clienteActual.id })}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Estado vacío — mismo problema/arreglo que la card de cliente:
          envuelto en .ca-empty-state-row (full-width, fuera del
          maxWidth:1040 de "resto de la página") para que se centre
          contra el ancho TOTAL de la página, no contra esos 1040px. El
          div de adentro (ícono + textos) no se tocó — mismo padding,
          gap, tamaños y colores de siempre. */}
      {!clienteActual && !query && (
        <div className="ca-empty-state-row" style={{ opacity: modalAbierto ? 0.88 : 1, transition: 'opacity 300ms ease-out' }}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '64px 0', gap: 12,
          }}>
            <Search size={48} style={{ color: 'oklch(1 0 0 / .08)' }} />
            <p style={{ color: 'var(--dim)', fontSize: 14 }}>Escribe para buscar un cliente</p>
            <p style={{ color: 'oklch(1 0 0 / .2)', fontSize: 12 }}>Busca por nombre, CI, código o teléfono</p>
          </div>
        </div>
      )}

      {/* Resto de la página — sin tocar, mismo maxWidth:1040 de siempre. */}
      <div style={{ maxWidth: 1040, margin: 0 }}>

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
    </>
  )

  if (!casillerosActivo) return contenido

  // [NUEVO — bug de superposición en tablet] En el rango 600-1023px el
  // panel de 240px (position:absolute, ver ControlAcceso.css) se comía
  // buena parte del buscador/card centrados (que en ese ancho ocupan
  // casi toda la pantalla) — así que en ESE rango puntual el panel no
  // se muestra siempre abierto: colapsa a un botón/ícono
  // (.ca-panel-toggle) que lo despliega como flotante bajo demanda
  // (.ca-panel-flyout + .ca-panel-abierto, ver ControlAcceso.css). En
  // desktop y mobile este botón/backdrop no se renderiza visualmente
  // (display:none por CSS) — el panel se sigue viendo siempre, igual
  // que antes.
  return (
    <div className={`ca-layout-split${panelCasillerosAbierto ? ' ca-panel-abierto' : ''}`}>
      <div className="ca-panel-col">
        <button
          type="button"
          className="ca-panel-toggle"
          onClick={() => setPanelCasillerosAbierto(v => !v)}
          aria-label={panelCasillerosAbierto ? 'Ocultar casilleros' : 'Mostrar casilleros'}
        >
          <KeyRound size={18} />
        </button>
        {panelCasillerosAbierto && (
          <div className="ca-panel-backdrop" onClick={() => setPanelCasillerosAbierto(false)} />
        )}
        <div className="ca-panel-flyout">
          <PanelCasilleros clienteActual={clienteActual} ingresoRegistrado={ingresoRegistrado} usuario={usuario} modalAbierto={modalAbierto} />
        </div>
      </div>
      <div className="ca-main-col">{contenido}</div>
    </div>
  )
}
