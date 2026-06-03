import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package, Plus, Search, RefreshCw, Edit2, Trash2, AlertTriangle,
  BarChart2, Truck, Tag, ChevronDown, ChevronUp, X, Check, ArrowUp,
  ArrowDown, Sliders, Box, TrendingDown, LayoutGrid, List, Camera,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { Select } from '../../components/ui/Select'
import Pagination from '../../components/ui/Pagination'
import suplementosImg from '../../assets/categorias/suplementos.svg'
import bebidasImg from '../../assets/categorias/bebidas.svg'
import snacksImg from '../../assets/categorias/snacks.svg'
import accesoriosImg from '../../assets/categorias/accesorios.svg'
import ropaImg from '../../assets/categorias/ropa.svg'
import defaultCatImg from '../../assets/categorias/default.svg'

function toFileUrl(filePath) {
  if (!filePath) return null
  if (filePath.startsWith('data:')) return filePath
  const normalized = filePath.replace(/\\/g, '/')
  if (/^[A-Za-z]:\//.test(normalized)) return `file:///${normalized}`
  if (normalized.startsWith('/')) return `file://${normalized}`
  return `file:///${normalized}`
}

function resizarBase64(dataUrl, maxPx = 400) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxPx || height > maxPx) {
        const ratio = Math.min(maxPx / width, maxPx / height)
        width = Math.floor(width * ratio)
        height = Math.floor(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

const CAT_IMAGES_MAP = [
  [['suplemento', 'proteina', 'proteín', 'vitamina', 'whey', 'creatina'], suplementosImg],
  [['bebida', 'agua', 'refresco', 'jugo', 'isoton'], bebidasImg],
  [['snack', 'barra', 'alimento', 'comida', 'fruta'], snacksImg],
  [['accesorio', 'guante', 'correa', 'banda', 'foam', 'equipo'], accesoriosImg],
  [['ropa', 'camiseta', 'short', 'calzado', 'zapato', 'buzo', 'pants'], ropaImg],
]

function getCategoryImg(nombre, dbImagen = null) {
  if (dbImagen) return dbImagen
  if (!nombre) return defaultCatImg
  const lo = nombre.toLowerCase()
  for (const [keys, img] of CAT_IMAGES_MAP) {
    if (keys.some(k => lo.includes(k))) return img
  }
  return defaultCatImg
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'productos', label: 'Productos', icon: Package },
  { id: 'categorias', label: 'Categorías', icon: Tag },
  { id: 'proveedores', label: 'Proveedores', icon: Truck },
  { id: 'movimientos', label: 'Movimientos', icon: BarChart2 },
]

const TIPO_MOV = {
  entrada: { label: 'Entrada', color: 'oklch(0.78 0.16 155)', icon: ArrowUp },
  salida:  { label: 'Salida',  color: 'oklch(0.75 0.18 25)',  icon: ArrowDown },
  ajuste:  { label: 'Ajuste',  color: 'oklch(0.82 0.14 75)',  icon: Sliders },
  venta:   { label: 'Venta',   color: 'oklch(0.74 0.13 250)', icon: Package },
}

function fmtMoney(n) { return 'Bs. ' + Number(n || 0).toFixed(2) }
function fmtDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Modal genérico ───────────────────────────────────────────────────────────

function Modal({ title, onClose, children, width = 520 }) {
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .6)', backdropFilter: 'blur(4px)' }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.18 }}
        style={{
          position: 'relative', zIndex: 1, width, maxWidth: 'calc(100vw - 40px)',
          maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
          background: 'oklch(0.14 0.015 250)', border: '1px solid oklch(1 0 0 / .12)',
          borderRadius: 16, padding: '24px 28px',
          boxShadow: '0 24px 60px oklch(0 0 0 / .5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 700, color: 'var(--ink)', letterSpacing: '.06em' }}>
            {title}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  )
}

function FormField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</label>
      {children}
    </div>
  )
}

// ─── Modal de Producto ────────────────────────────────────────────────────────

function ModalProducto({ producto, categorias: catsProp, proveedores: provsProp, onClose, onSaved, usuario }) {
  const esNuevo = !producto
  const [cats, setCats] = useState(catsProp)
  const [provs, setProvs] = useState(provsProp)
  const [form, setForm] = useState({
    nombre: producto?.nombre || '',
    codigo: producto?.codigo || '',
    descripcion: producto?.descripcion || '',
    categoria_id: producto?.categoria_id || '',
    proveedor_id: producto?.proveedor_id || '',
    precio_compra: producto?.precio_compra || '',
    precio_venta: producto?.precio_venta || '',
    stock: producto?.stock || 0,
    stock_minimo: producto?.stock_minimo ?? 5,
    unidad: producto?.unidad || 'unidad',
    imagen: producto?.imagen || '',
  })
  const [cambiandoImg, setCambiandoImg] = useState(false)
  const [guardando, setGuardando] = useState(false)

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function addCategoria(nombre) {
    await window.api.inventario.createCategoria({ nombre, descripcion: '', color: 'oklch(0.74 0.13 250)' })
    const newCats = await window.api.inventario.getCategorias()
    setCats(newCats)
    const created = newCats.find(c => c.nombre === nombre)
    if (created) set('categoria_id', created.id)
    toast.success('Categoría creada')
  }

  async function addProveedor(nombre) {
    await window.api.inventario.createProveedor({ nombre, contacto: '', telefono: '', email: '', direccion: '', notas: '' })
    const newProvs = await window.api.inventario.getProveedores()
    setProvs(newProvs)
    const created = newProvs.find(p => p.nombre === nombre)
    if (created) set('proveedor_id', created.id)
    toast.success('Proveedor creado')
  }

  async function seleccionarImagen() {
    setCambiandoImg(true)
    try {
      const r = await window.api.inventario.pickImage()
      if (r?.dataUrl) {
        const resized = await resizarBase64(r.dataUrl)
        set('imagen', resized)
        toast.success('Imagen seleccionada')
      }
    } catch { toast.error('Error al seleccionar imagen') }
    setCambiandoImg(false)
  }

  async function guardar() {
    if (!form.nombre.trim()) return toast.error('El nombre es obligatorio')
    if (!form.precio_venta || parseFloat(form.precio_venta) < 0) return toast.error('El precio de venta debe ser mayor o igual a 0')
    setGuardando(true)
    try {
      const data = {
        ...form,
        precio_compra: parseFloat(form.precio_compra) || 0,
        precio_venta: parseFloat(form.precio_venta) || 0,
        stock: parseInt(form.stock) || 0,
        stock_minimo: parseInt(form.stock_minimo) || 5,
        categoria_id: form.categoria_id || null,
        proveedor_id: form.proveedor_id || null,
        imagen: form.imagen || null,
        usuario_id: usuario?.id,
        usuario_nombre: usuario?.nombre_completo,
      }
      if (esNuevo) {
        await window.api.inventario.create(data)
        toast.success('Producto creado')
      } else {
        await window.api.inventario.update(producto.id, data)
        toast.success('Producto actualizado')
      }
      onSaved()
      onClose()
    } catch {
      toast.error('Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const inp = (label, key, opts = {}) => (
    <FormField label={label}>
      <input
        className="gym-input"
        type={opts.type || 'text'}
        value={form[key]}
        onChange={e => set(key, e.target.value)}
        placeholder={opts.placeholder}
        min={opts.min}
        step={opts.step}
      />
    </FormField>
  )

  return (
    <Modal title={esNuevo ? 'Nuevo Producto' : 'Editar Producto'} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ gridColumn: '1/-1' }}>{inp('Nombre *', 'nombre', { placeholder: 'Proteína Whey 1kg' })}</div>
        {inp('Código / SKU', 'codigo', { placeholder: 'PRO-001' })}
        {inp('Unidad', 'unidad', { placeholder: 'unidad, kg, litro...' })}
        <FormField label="Categoría">
          <Select
            value={form.categoria_id}
            onChange={v => set('categoria_id', v)}
            options={[{ value: '', label: 'Sin categoría' }, ...cats.map(c => ({ value: c.id, label: c.nombre }))]}
            placeholder="Sin categoría"
            onAdd={addCategoria}
            addLabel="Agregar categoría..."
          />
        </FormField>
        <FormField label="Proveedor">
          <Select
            value={form.proveedor_id}
            onChange={v => set('proveedor_id', v)}
            options={[{ value: '', label: 'Sin proveedor' }, ...provs.map(p => ({ value: p.id, label: p.nombre }))]}
            placeholder="Sin proveedor"
            onAdd={addProveedor}
            addLabel="Agregar proveedor..."
          />
        </FormField>
        {inp('Precio compra (Bs.)', 'precio_compra', { type: 'number', min: 0, step: '0.01', placeholder: '0.00' })}
        {inp('Precio venta (Bs.) *', 'precio_venta', { type: 'number', min: 0, step: '0.01', placeholder: '0.00' })}
        {esNuevo && inp('Stock inicial', 'stock', { type: 'number', min: 0, placeholder: '0' })}
        {inp('Stock mínimo', 'stock_minimo', { type: 'number', min: 0, placeholder: '5' })}
        <div style={{ gridColumn: '1/-1' }}>
          <FormField label="Descripción">
            <textarea
              className="gym-input"
              value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)}
              placeholder="Descripción del producto..."
              style={{ resize: 'vertical', minHeight: 60 }}
            />
          </FormField>
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Imagen del Producto</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 72, height: 72, borderRadius: 10, overflow: 'hidden', background: 'var(--glass)', border: '1px solid var(--line)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {form.imagen
                ? <img src={toFileUrl(form.imagen)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display='none' }} />
                : (() => {
                    const catActual = cats.find(c => c.id == form.categoria_id)
                    const imgDefault = getCategoryImg(catActual?.nombre, catActual?.imagen)
                    return <img src={imgDefault} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} onError={e => { e.target.style.display='none' }} />
                  })()}
            </div>
            <div style={{ flex: 1 }}>
              <button type="button" onClick={seleccionarImagen} disabled={cambiandoImg}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: 'oklch(0.74 0.13 250 / .12)', border: '1px solid oklch(0.74 0.13 250 / .35)', color: 'oklch(0.80 0.12 250)', cursor: 'pointer' }}>
                <Camera size={13} />{cambiandoImg ? 'Seleccionando...' : form.imagen ? 'Cambiar imagen' : 'Seleccionar imagen'}
              </button>
              {!form.imagen && cats.find(c => c.id == form.categoria_id)?.imagen && (
                <div style={{ marginTop: 5, fontSize: 10, color: 'var(--dim)' }}>Usando imagen de categoría</div>
              )}
              {form.imagen && (
                <button type="button" onClick={() => set('imagen', '')}
                  style={{ marginTop: 6, fontSize: 11, color: 'var(--dim)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Quitar (usar imagen de categoría)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <button onClick={onClose} className="btn-secondary">Cancelar</button>
        <button onClick={guardar} className="btn-primary" disabled={guardando} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Check size={14} /> {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Modal ajuste stock ───────────────────────────────────────────────────────

function ModalAjusteStock({ producto, onClose, onSaved, usuario }) {
  const [tipo, setTipo] = useState('entrada')
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    const cant = parseInt(cantidad)
    if (!cant || cant <= 0) return toast.error('La cantidad debe ser mayor a 0')
    setGuardando(true)
    try {
      const r = await window.api.inventario.ajustarStock({
        producto_id: producto.id,
        tipo,
        cantidad: cant,
        motivo: motivo || null,
        usuario_id: usuario?.id,
        usuario_nombre: usuario?.nombre_completo,
      })
      if (r.ok) {
        toast.success(`Stock ajustado: ${r.stock_anterior} → ${r.stock_nuevo}`)
        onSaved()
        onClose()
      } else {
        toast.error(r.error || 'Error')
      }
    } finally {
      setGuardando(false)
    }
  }

  const stockPreview = (() => {
    const cant = parseInt(cantidad) || 0
    if (tipo === 'ajuste') return cant
    if (tipo === 'entrada') return (producto.stock || 0) + cant
    return Math.max(0, (producto.stock || 0) - cant)
  })()

  return (
    <Modal title={`Ajustar stock — ${producto.nombre}`} onClose={onClose} width={400}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['entrada', 'salida', 'ajuste'].map(t => (
          <button key={t} onClick={() => setTipo(t)} style={{
            flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            border: `1px solid ${tipo === t ? TIPO_MOV[t].color : 'var(--line)'}`,
            background: tipo === t ? `${TIPO_MOV[t].color}20` : 'transparent',
            color: tipo === t ? TIPO_MOV[t].color : 'var(--dim)',
            cursor: 'pointer', transition: 'all .2s',
          }}>
            {TIPO_MOV[t].label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FormField label={tipo === 'ajuste' ? 'Nuevo stock total' : 'Cantidad'}>
          <input
            className="gym-input"
            type="number" min="1"
            value={cantidad}
            onChange={e => setCantidad(e.target.value)}
            placeholder="0"
            autoFocus
          />
        </FormField>
        <FormField label="Motivo (opcional)">
          <input className="gym-input" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo del ajuste..." />
        </FormField>
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          background: 'oklch(1 0 0 / .04)', border: '1px solid var(--line)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>Stock resultante</span>
          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--display)', color: stockPreview <= producto.stock_minimo ? 'oklch(0.75 0.18 25)' : 'oklch(0.78 0.16 155)' }}>
            {stockPreview} {producto.unidad}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <button onClick={onClose} className="btn-secondary">Cancelar</button>
        <button onClick={guardar} className="btn-primary" disabled={guardando} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Check size={14} /> {guardando ? 'Aplicando...' : 'Aplicar'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Card de producto ─────────────────────────────────────────────────────────


function ProductCard({ p, onEdit, onStock, onEliminar }) {
  const agotado = p.stock === 0
  const stockBajo = p.stock <= p.stock_minimo && !agotado
  const stockColor = agotado ? 'oklch(0.66 0.22 25)' : stockBajo ? 'oklch(0.82 0.14 75)' : 'oklch(0.78 0.16 155)'
  const catColor = p.categoria_color || 'oklch(0.74 0.13 250)'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.15 }}
      style={{ background: 'var(--glass)', border: `1px solid ${catColor}30`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'default' }}
    >
      {/* Header visual */}
      <div style={{ height: 100, background: `${catColor}12`, borderBottom: `1px solid ${catColor}20`, position: 'relative', overflow: 'hidden' }}>
        {p.imagen ? (
          <img
            src={toFileUrl(p.imagen)}
            alt={p.nombre}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={e => { e.target.src = getCategoryImg(p.categoria_nombre, p.categoria_imagen) }}
          />
        ) : (
          <img
            src={getCategoryImg(p.categoria_nombre, p.categoria_imagen)}
            alt={p.categoria_nombre || 'producto'}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
        {agotado && (
          <div style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: '.12em' }}>AGOTADO</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px', flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--display)', color: 'var(--ink)', marginBottom: 2, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</div>
        {p.categoria_nombre && <div style={{ fontSize: 10, color: catColor, fontWeight: 600, marginBottom: 5 }}>{p.categoria_nombre}</div>}
        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--display)', color: 'var(--ink)', marginBottom: 5 }}>
          Bs. {Number(p.precio_venta).toFixed(2)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: stockColor, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--dim)' }}>{p.stock} {p.unidad}{stockBajo && <span style={{ color: stockColor }}> · bajo</span>}</span>
        </div>
      </div>

      {/* Acciones */}
      <div style={{ display: 'flex', borderTop: '1px solid var(--line)', padding: '7px 8px', gap: 5 }}>
        <button onClick={() => onStock(p)} className="btn-secondary" style={{ flex: 1, padding: '5px 0', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <Sliders size={11} /> Stock
        </button>
        <button onClick={() => onEdit(p)} style={{ flex: 1, padding: '5px 0', borderRadius: 7, fontSize: 11, fontWeight: 600, background: `${catColor}18`, border: `1px solid ${catColor}35`, color: catColor, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <Edit2 size={11} /> Editar
        </button>
        <button onClick={() => onEliminar(p)} style={{ width: 30, height: 30, borderRadius: 7, background: 'oklch(0.66 0.22 25 / .1)', border: '1px solid oklch(0.66 0.22 25 / .2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <Trash2 size={11} color="oklch(0.75 0.18 25)" />
        </button>
      </div>
    </motion.div>
  )
}

// ─── Tab Productos ────────────────────────────────────────────────────────────

function TabProductos({ categorias, proveedores, usuario }) {
  const [productos, setProductos] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [modal, setModal] = useState(null)
  const [vistaGrid, setVistaGrid] = useState(false)
  const confirmar = useConfirm()
  const debounceRef = useRef(null)

  async function cargar(p, ps, b, cat) {
    setCargando(true)
    try {
      const result = await window.api.inventario.getPaginated({ page: p, pageSize: ps, busqueda: b || undefined, categoria_id: cat || undefined })
      setProductos(result?.data || [])
      setTotal(result?.total || 0)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar(page, pageSize, busqueda, filtroCategoria) }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const newPage = 1
      setPage(newPage)
      cargar(newPage, pageSize, busqueda, filtroCategoria)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [busqueda])

  async function eliminar(p) {
    const ok = await confirmar({ titulo: '¿Eliminar producto?', mensaje: `"${p.nombre}" se moverá a la papelera. Puedes restaurarlo después.`, tipo: 'advertencia', textoConfirmar: 'Mover a papelera' })
    if (!ok) return
    await window.api.inventario.delete(p.id)
    toast.success('Producto eliminado (papelera)')
    cargar()
  }

  const stockBajo = productos.filter(p => p.stock <= p.stock_minimo)

  return (
    <div>
      {/* Alerta stock bajo */}
      {stockBajo.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{
          background: 'oklch(0.66 0.22 25 / .1)', border: '1px solid oklch(0.66 0.22 25 / .3)',
          borderRadius: 10, padding: '10px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <TrendingDown size={16} color="oklch(0.75 0.18 25)" />
          <span style={{ fontSize: 12, color: 'oklch(0.85 0.10 25)' }}>
            <strong>{stockBajo.length}</strong> producto{stockBajo.length !== 1 ? 's' : ''} con stock bajo o agotado
          </span>
        </motion.div>
      )}

      {/* Controles */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--dim)' }} />
          <input
            className="gym-input"
            style={{ paddingLeft: 32 }}
            placeholder="Buscar producto..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <div style={{ width: 180 }}>
          <Select
            value={filtroCategoria}
            onChange={v => { setFiltroCategoria(v); setPage(1); cargar(1, pageSize, busqueda, v) }}
            options={[{ value: '', label: 'Todas las categorías' }, ...categorias.map(c => ({ value: c.id, label: c.nombre }))]}
            placeholder="Todas las categorías"
          />
        </div>
        <div style={{ display: 'flex', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          <button
            onClick={() => setVistaGrid(false)}
            title="Vista lista"
            style={{ padding: '6px 10px', background: !vistaGrid ? 'oklch(0.66 0.22 25 / .18)' : 'transparent', border: 'none', cursor: 'pointer', color: !vistaGrid ? 'oklch(0.76 0.20 25)' : 'var(--dim)', display: 'flex', alignItems: 'center' }}
          >
            <List size={14} />
          </button>
          <button
            onClick={() => setVistaGrid(true)}
            title="Vista cards"
            style={{ padding: '6px 10px', background: vistaGrid ? 'oklch(0.66 0.22 25 / .18)' : 'transparent', border: 'none', cursor: 'pointer', color: vistaGrid ? 'oklch(0.76 0.20 25)' : 'var(--dim)', display: 'flex', alignItems: 'center' }}
          >
            <LayoutGrid size={14} />
          </button>
        </div>
        <button onClick={cargar} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={13} />
        </button>
        <button onClick={() => setModal('crear')} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Nuevo producto
        </button>
      </div>

      {/* Lista / Grid */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--dim)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 12 }}>Cargando...</p>
        </div>
      ) : productos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--dim)' }}>
          <Box size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: .4 }} />
          <p style={{ fontSize: 14 }}>No hay productos</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Agrega tu primer producto</p>
        </div>
      ) : vistaGrid ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
          {productos.map(p => (
            <ProductCard
              key={p.id}
              p={p}
              onEdit={p => setModal({ tipo: 'editar', p })}
              onStock={p => setModal({ tipo: 'stock', p })}
              onEliminar={eliminar}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <AnimatePresence>
            {productos.map((p, i) => {
              const stockBajo = p.stock <= p.stock_minimo
              const agotado = p.stock === 0
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.025 }}
                  style={{
                    background: 'var(--glass)',
                    border: `1px solid ${agotado ? 'oklch(0.66 0.22 25 / .4)' : stockBajo ? 'oklch(0.82 0.14 75 / .3)' : 'var(--line)'}`,
                    borderLeft: `3px solid ${agotado ? 'oklch(0.66 0.22 25)' : stockBajo ? 'oklch(0.82 0.14 75)' : 'transparent'}`,
                    borderRadius: 10, padding: '12px 16px',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  {/* Stock badge */}
                  <div style={{
                    minWidth: 52, height: 52, borderRadius: 10,
                    background: agotado ? 'oklch(0.66 0.22 25 / .15)' : stockBajo ? 'oklch(0.82 0.14 75 / .12)' : 'oklch(0.78 0.16 155 / .10)',
                    border: `1px solid ${agotado ? 'oklch(0.66 0.22 25 / .3)' : stockBajo ? 'oklch(0.82 0.14 75 / .25)' : 'oklch(0.78 0.16 155 / .2)'}`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--display)', color: agotado ? 'oklch(0.75 0.18 25)' : stockBajo ? 'oklch(0.82 0.14 75)' : 'oklch(0.78 0.16 155)', lineHeight: 1 }}>
                      {p.stock}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--dim)', marginTop: 2 }}>{p.unidad}</span>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{p.nombre}</span>
                      {p.codigo && <span style={{ fontSize: 10, color: 'var(--dim)', background: 'var(--glass-2)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--line)' }}>{p.codigo}</span>}
                      {agotado && <span style={{ fontSize: 9, fontWeight: 700, color: 'oklch(0.75 0.18 25)', background: 'oklch(0.66 0.22 25 / .15)', padding: '2px 7px', borderRadius: 10, border: '1px solid oklch(0.66 0.22 25 / .3)', letterSpacing: '.08em' }}>AGOTADO</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--dim)' }}>
                      {p.categoria_nombre || 'Sin categoría'} · Venta: <strong style={{ color: 'var(--ink)' }}>{fmtMoney(p.precio_venta)}</strong>
                      {p.precio_compra > 0 && <> · Compra: {fmtMoney(p.precio_compra)}</>}
                      · Mín: {p.stock_minimo}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => setModal({ tipo: 'stock', p })}
                      title="Ajustar stock"
                      className="btn-secondary"
                      style={{ padding: '6px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      <Sliders size={12} /> Stock
                    </button>
                    <button onClick={() => setModal({ tipo: 'editar', p })} title="Editar" style={{ width: 32, height: 32, borderRadius: 7, background: 'var(--glass-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <Edit2 size={13} color="var(--dim)" />
                    </button>
                    <button onClick={() => eliminar(p)} title="Eliminar" style={{ width: 32, height: 32, borderRadius: 7, background: 'oklch(0.66 0.22 25 / .1)', border: '1px solid oklch(0.66 0.22 25 / .25)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <Trash2 size={13} color="oklch(0.75 0.18 25)" />
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Paginación */}
      {!cargando && total > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={p => { setPage(p); cargar(p, pageSize, busqueda, filtroCategoria) }}
          onPageSizeChange={ps => { setPageSize(ps); setPage(1); cargar(1, ps, busqueda, filtroCategoria) }}
        />
      )}

      {/* Modales */}
      <AnimatePresence>
        {modal === 'crear' && (
          <ModalProducto categorias={categorias} proveedores={proveedores} onClose={() => setModal(null)} onSaved={() => cargar(page, pageSize, busqueda, filtroCategoria)} usuario={usuario} />
        )}
        {modal?.tipo === 'editar' && (
          <ModalProducto producto={modal.p} categorias={categorias} proveedores={proveedores} onClose={() => setModal(null)} onSaved={() => cargar(page, pageSize, busqueda, filtroCategoria)} usuario={usuario} />
        )}
        {modal?.tipo === 'stock' && (
          <ModalAjusteStock producto={modal.p} onClose={() => setModal(null)} onSaved={() => cargar(page, pageSize, busqueda, filtroCategoria)} usuario={usuario} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Tab Categorías ───────────────────────────────────────────────────────────

function TabCategorias({ categorias, onRefresh }) {
  const confirmar = useConfirm()
  const [form, setForm] = useState({ nombre: '', descripcion: '', color: 'oklch(0.74 0.13 250)', imagen: '' })
  const [editando, setEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [cambiandoImg, setCambiandoImg] = useState(false)

  async function guardar() {
    if (!form.nombre.trim()) return toast.error('El nombre es obligatorio')

    // Alerta solo cuando se CAMBIA la imagen de una categoría existente
    if (editando && form.imagen !== (editando.imagen || '') && (editando.imagen || form.imagen)) {
      const ok = await confirmar({
        titulo: '¿Cambiar imagen de la categoría?',
        mensaje: 'Los productos que usan la imagen de esta categoría mostrarán la nueva imagen automáticamente. Los productos con imagen propia no se verán afectados. ¿Continuar?',
        tipo: 'advertencia',
        textoConfirmar: 'Sí, cambiar imagen',
      })
      if (!ok) return
    }

    setGuardando(true)
    try {
      if (editando) {
        await window.api.inventario.updateCategoria(editando.id, form)
        toast.success('Categoría actualizada')
      } else {
        await window.api.inventario.createCategoria(form)
        toast.success('Categoría creada')
      }
      setForm({ nombre: '', descripcion: '', color: 'oklch(0.74 0.13 250)', imagen: '' })
      setEditando(null)
      onRefresh()
    } catch { toast.error('Error') } finally { setGuardando(false) }
  }

  async function seleccionarImagenCategoria() {
    setCambiandoImg(true)
    try {
      const r = await window.api.inventario.pickImage()
      if (r?.dataUrl) {
        const resized = await resizarBase64(r.dataUrl, 400)
        setForm(p => ({ ...p, imagen: resized }))
        toast.success('Imagen seleccionada')
      }
    } catch { toast.error('Error al seleccionar imagen') }
    setCambiandoImg(false)
  }

  function iniciarEdicion(c) {
    setEditando(c)
    setForm({ nombre: c.nombre, descripcion: c.descripcion || '', color: c.color || 'oklch(0.74 0.13 250)', imagen: c.imagen || '' })
  }

  async function eliminar(c) {
    const ok = await confirmar({ titulo: '¿Eliminar categoría?', mensaje: `"${c.nombre}" se eliminará permanentemente.`, tipo: 'peligro', textoConfirmar: 'Eliminar' })
    if (!ok) return
    await window.api.inventario.deleteCategoria(c.id)
    toast.success('Categoría eliminada')
    onRefresh()
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, alignItems: 'start' }}>
      {/* Lista */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {categorias.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--dim)' }}>No hay categorías</div>
        ) : categorias.map(c => (
          <div key={c.id} style={{ background: 'var(--glass)', border: '1px solid var(--line)', borderLeft: `3px solid ${c.color || 'var(--line)'}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--glass-2)', border: '1px solid var(--line)' }}>
              <img src={getCategoryImg(c.nombre, c.imagen)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display='none' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{c.nombre}</div>
              {c.descripcion && <div style={{ fontSize: 12, color: 'var(--dim)' }}>{c.descripcion}</div>}
            </div>
            <button onClick={() => iniciarEdicion(c)} style={{ width: 30, height: 30, borderRadius: 7, background: 'var(--glass-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Edit2 size={12} color="var(--dim)" />
            </button>
            <button onClick={() => eliminar(c)} style={{ width: 30, height: 30, borderRadius: 7, background: 'oklch(0.66 0.22 25 / .1)', border: '1px solid oklch(0.66 0.22 25 / .25)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Trash2 size={12} color="oklch(0.75 0.18 25)" />
            </button>
          </div>
        ))}
      </div>

      {/* Formulario */}
      <div className="gym-card" style={{ padding: '16px 18px' }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 14 }}>
          {editando ? 'Editar categoría' : 'Nueva categoría'}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FormField label="Nombre">
            <input className="gym-input" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Suplementos" />
          </FormField>
          <FormField label="Descripción">
            <input className="gym-input" value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} placeholder="Opcional" />
          </FormField>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Imagen</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', background: 'var(--glass)', border: '1px solid var(--line)', flexShrink: 0 }}>
                <img src={form.imagen || getCategoryImg(form.nombre)} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: form.imagen ? 1 : 0.5 }} onError={e => { e.target.style.display='none' }} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button type="button" onClick={seleccionarImagenCategoria} disabled={cambiandoImg}
                  style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, background: 'oklch(0.74 0.13 250 / .12)', border: '1px solid oklch(0.74 0.13 250 / .35)', color: 'oklch(0.80 0.12 250)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Camera size={11} /> {cambiandoImg ? 'Seleccionando...' : form.imagen ? 'Cambiar' : 'Añadir foto'}
                </button>
                {form.imagen && (
                  <button type="button" onClick={() => setForm(p => ({ ...p, imagen: '' }))}
                    style={{ fontSize: 10, color: 'var(--dim)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textAlign: 'left' }}>
                    Quitar imagen
                  </button>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            {editando && (
              <button onClick={() => { setEditando(null); setForm({ nombre: '', descripcion: '', color: 'oklch(0.74 0.13 250)', imagen: '' }) }} className="btn-secondary" style={{ flex: 1 }}>
                Cancelar
              </button>
            )}
            <button onClick={guardar} className="btn-primary" disabled={guardando} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Check size={13} /> {editando ? 'Guardar' : 'Agregar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tab Proveedores ──────────────────────────────────────────────────────────

function TabProveedores({ proveedores, onRefresh }) {
  const confirmar = useConfirm()
  const [form, setForm] = useState({ nombre: '', contacto: '', telefono: '', email: '', direccion: '', notas: '' })
  const [editando, setEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    if (!form.nombre.trim()) return toast.error('El nombre es obligatorio')
    setGuardando(true)
    try {
      if (editando) {
        await window.api.inventario.updateProveedor(editando.id, form)
        toast.success('Proveedor actualizado')
      } else {
        await window.api.inventario.createProveedor(form)
        toast.success('Proveedor creado')
      }
      setForm({ nombre: '', contacto: '', telefono: '', email: '', direccion: '', notas: '' })
      setEditando(null)
      onRefresh()
    } catch { toast.error('Error') } finally { setGuardando(false) }
  }

  function iniciarEdicion(p) {
    setEditando(p)
    setForm({ nombre: p.nombre, contacto: p.contacto || '', telefono: p.telefono || '', email: p.email || '', direccion: p.direccion || '', notas: p.notas || '' })
  }

  async function eliminar(p) {
    const ok = await confirmar({ titulo: '¿Eliminar proveedor?', mensaje: `"${p.nombre}" se eliminará permanentemente.`, tipo: 'peligro', textoConfirmar: 'Eliminar' })
    if (!ok) return
    await window.api.inventario.deleteProveedor(p.id)
    toast.success('Proveedor eliminado')
    onRefresh()
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {proveedores.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--dim)' }}>No hay proveedores</div>
        ) : proveedores.map(p => (
          <div key={p.id} style={{ background: 'var(--glass)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{p.nombre}</div>
              <div style={{ fontSize: 12, color: 'var(--dim)' }}>
                {[p.contacto, p.telefono, p.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
              </div>
            </div>
            <button onClick={() => iniciarEdicion(p)} style={{ width: 30, height: 30, borderRadius: 7, background: 'var(--glass-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Edit2 size={12} color="var(--dim)" />
            </button>
            <button onClick={() => eliminar(p)} style={{ width: 30, height: 30, borderRadius: 7, background: 'oklch(0.66 0.22 25 / .1)', border: '1px solid oklch(0.66 0.22 25 / .25)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Trash2 size={12} color="oklch(0.75 0.18 25)" />
            </button>
          </div>
        ))}
      </div>

      <div className="gym-card" style={{ padding: '16px 18px' }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 14 }}>
          {editando ? 'Editar proveedor' : 'Nuevo proveedor'}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {['nombre', 'contacto', 'telefono', 'email', 'direccion'].map(k => (
            <FormField key={k} label={k.charAt(0).toUpperCase() + k.slice(1)}>
              <input className="gym-input" value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
            </FormField>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {editando && (
              <button onClick={() => { setEditando(null); setForm({ nombre: '', contacto: '', telefono: '', email: '', direccion: '', notas: '' }) }} className="btn-secondary" style={{ flex: 1 }}>
                Cancelar
              </button>
            )}
            <button onClick={guardar} className="btn-primary" disabled={guardando} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Check size={13} /> {editando ? 'Guardar' : 'Agregar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tab Movimientos ──────────────────────────────────────────────────────────

function TabMovimientos() {
  const [movimientos, setMovimientos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    window.api.inventario.getAllMovimientos().then(d => { setMovimientos(d || []); setCargando(false) })
  }, [])

  if (cargando) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--dim)' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>

  return (
    <div>
      {movimientos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--dim)' }}>No hay movimientos registrados</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {movimientos.map((m, i) => {
            const t = TIPO_MOV[m.tipo] || { label: m.tipo, color: 'var(--dim)', icon: Box }
            const Icon = t.icon
            return (
              <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }}
                style={{ background: 'var(--glass)', border: '1px solid var(--line)', borderRadius: 9, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 7, background: `${t.color}18`, border: `1px solid ${t.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={12} color={t.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    {m.producto_nombre}
                    <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: t.color, background: `${t.color}15`, padding: '1px 7px', borderRadius: 10 }}>
                      {t.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--dim)' }}>
                    {m.motivo || '—'} · {m.usuario_nombre || 'Sistema'} · {fmtDate(m.created_at)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--display)', color: t.color }}>
                    {m.tipo === 'salida' || m.tipo === 'venta' ? '-' : '+'}{m.cantidad}
                  </div>
                  {m.stock_nuevo != null && (
                    <div style={{ fontSize: 10, color: 'var(--dim)' }}>{m.stock_anterior}→{m.stock_nuevo}</div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Inventario() {
  const { usuario } = useAuth()
  const [tab, setTab] = useState('productos')
  const [categorias, setCategorias] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [rev, setRev] = useState(0)

  const refresh = useCallback(() => setRev(r => r + 1), [])

  useEffect(() => {
    window.api.inventario.getCategorias().then(d => setCategorias(d || []))
    window.api.inventario.getProveedores().then(d => setProveedores(d || []))
  }, [rev])

  return (
    <div style={{ padding: '0 2px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="titulo-metalico" style={{ marginBottom: 6 }}>INVENTARIO</h1>
        <p style={{ fontSize: 13, color: 'var(--dim)' }}>Gestión de productos, categorías y proveedores</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'oklch(1 0 0 / .03)', border: '1px solid var(--line)', borderRadius: 10, padding: 4 }}>
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                background: tab === t.id ? 'oklch(0.66 0.22 25 / .18)' : 'transparent',
                border: tab === t.id ? '1px solid oklch(0.66 0.22 25 / .4)' : '1px solid transparent',
                color: tab === t.id ? 'oklch(0.85 0.12 25)' : 'var(--dim)',
                cursor: 'pointer', transition: 'all .2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Icon size={13} /> {t.label}
            </button>
          )
        })}
      </div>

      {/* Contenido */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {tab === 'productos' && <TabProductos categorias={categorias} proveedores={proveedores} usuario={usuario} />}
          {tab === 'categorias' && <TabCategorias categorias={categorias} onRefresh={refresh} />}
          {tab === 'proveedores' && <TabProveedores proveedores={proveedores} onRefresh={refresh} />}
          {tab === 'movimientos' && <TabMovimientos />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
