import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package, Plus, Search, RefreshCw, Edit2, Trash2, AlertTriangle,
  BarChart2, Truck, Tag, ChevronDown, ChevronUp, X, Check, ArrowUp,
  ArrowDown, Sliders, Box, TrendingDown, LayoutGrid, List, Camera,
  Percent, ToggleLeft, ToggleRight, Calendar,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { Select } from '../../components/ui/Select'
import Pagination from '../../components/ui/Pagination'
// Reusa las clases de vidrio/movimiento "Nuevo Cliente" (Clients.css) para
// todos los botones y el look de vidrio de las cajas de esta página.
import '../Clients.css'
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
  { id: 'productos',   label: 'Productos',   icon: Package },
  { id: 'categorias',  label: 'Categorías',  icon: Tag },
  { id: 'proveedores', label: 'Proveedores', icon: Truck },
  { id: 'movimientos', label: 'Movimientos', icon: BarChart2 },
  { id: 'conteo',      label: 'Conteo físico', icon: Check, permiso: 'inventario.conteo' },
  { id: 'compras',     label: 'Compras',     icon: Truck, permiso: 'inventario.compras' },
  { id: 'promociones', label: 'Promociones', icon: Percent },
]

const TIPO_MOV = {
  entrada: { label: 'Entrada', color: 'oklch(0.78 0.16 155)', icon: ArrowUp },
  salida:  { label: 'Salida',  color: 'oklch(0.75 0.18 25)',  icon: ArrowDown },
  ajuste:  { label: 'Ajuste',  color: 'oklch(0.82 0.14 75)',  icon: Sliders },
  venta:   { label: 'Venta',   color: 'oklch(0.74 0.13 250)', icon: Package },
  merma:   { label: 'Merma',   color: 'oklch(0.80 0.15 60)',  icon: AlertTriangle },
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
          background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
          border: '1px solid transparent',
          borderRadius: 16, padding: '24px 28px',
          boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .11), 0 0 16px 2px oklch(1 0 0 / .08), 0 24px 60px oklch(0 0 0 / .4)',
          textShadow: '0 1px 2px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 17, fontWeight: 700, color: 'var(--ink)', letterSpacing: '.06em' }}>
            {title}
          </h2>
          <button onClick={onClose} className="clientes-glass-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6 }}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content" style={{ color: 'var(--dim)' }}><X size={19} /></span>
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
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</label>
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
    permite_decimal: producto?.permite_decimal ? 1 : 0,
    decimales: producto?.decimales || 2,
    punto_reorden: producto?.punto_reorden ?? '',
    cantidad_reorden: producto?.cantidad_reorden ?? '',
    imagen: producto?.imagen || '',
  })
  const [cambiandoImg, setCambiandoImg] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [historial, setHistorial] = useState(null)
  async function verHistorial() {
    const r = await window.api.inventario.getHistorialPrecios(producto.id)
    setHistorial(Array.isArray(r) ? r : [])
  }

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
        stock: form.permite_decimal ? (parseFloat(form.stock) || 0) : (parseInt(form.stock) || 0),
        stock_minimo: parseInt(form.stock_minimo) || 5,
        permite_decimal: form.permite_decimal ? 1 : 0,
        decimales: form.permite_decimal ? Number(form.decimales) : 0,
        unidad_medida: form.unidad || 'unidad',
        punto_reorden: form.punto_reorden === '' ? null : Number(form.punto_reorden),
        cantidad_reorden: form.cantidad_reorden === '' ? null : Number(form.cantidad_reorden),
        categoria_id: form.categoria_id || null,
        proveedor_id: form.proveedor_id || null,
        imagen: form.imagen || null,
        usuario_id: usuario?.id,
        usuario_nombre: usuario?.nombre_completo,
      }
      const r = esNuevo ? await window.api.inventario.create(data) : await window.api.inventario.update(producto.id, data)
      if (r && r.ok === false) { toast.error(r.error || 'No se pudo guardar'); return }
      toast.success(esNuevo ? 'Producto creado' : 'Producto actualizado')
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
        <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label htmlFor="prod-permite-decimal" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink)' }}>
            <input id="prod-permite-decimal" type="checkbox" checked={!!form.permite_decimal} onChange={e => set('permite_decimal', e.target.checked ? 1 : 0)} aria-label="Este producto se cuenta y vende con decimales (kg, litros)" />
            Se cuenta y vende con decimales (kg, litros…)
          </label>
          {!!form.permite_decimal && (
            <label htmlFor="prod-decimales" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink)' }}>
              Decimales
              <select id="prod-decimales" className="gym-input" aria-label="Cantidad de decimales" value={form.decimales} onChange={e => set('decimales', Number(e.target.value))} style={{ width: 70 }}>
                {[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          )}
        </div>
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
        {esNuevo && inp('Stock inicial', 'stock', { type: 'number', min: 0, step: form.permite_decimal ? 'any' : 1, placeholder: '0' })}
        {inp('Stock mínimo', 'stock_minimo', { type: 'number', min: 0, placeholder: '5' })}
        {!esNuevo && inp('Punto de reorden (avisa cuándo reponer)', 'punto_reorden', { type: 'number', min: 0, step: 'any', placeholder: 'Sin definir' })}
        {!esNuevo && inp('Cantidad a pedir al reponer', 'cantidad_reorden', { type: 'number', min: 0, step: 'any', placeholder: 'Automática' })}
        {!esNuevo && (
          <div style={{ gridColumn: '1/-1' }}>
            <button type="button" onClick={historial ? () => setHistorial(null) : verHistorial} aria-expanded={!!historial} className="clientes-glass-btn btn-secondary">
              <div className="clientes-glass-bg" /><span className="clientes-glass-content">{historial ? 'Ocultar historial de precios' : 'Ver historial de precios'}</span>
            </button>
            {historial && (historial.length === 0
              ? <p role="status" style={{ fontSize: 13, color: 'var(--dim)', marginTop: 8 }}>Este producto todavía no tiene cambios de precio registrados.</p>
              : (
                <table data-testid="historial-precios" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color: 'var(--ink)', marginTop: 8 }}>
                  <thead><tr style={{ textAlign: 'left', color: 'var(--dim)' }}><th scope="col">Fecha</th><th scope="col">Qué cambió</th><th scope="col">Antes</th><th scope="col">Después</th><th scope="col">Quién y por qué</th></tr></thead>
                  <tbody>
                    {historial.map(h => (
                      <tr key={h.id} style={{ borderTop: '1px solid var(--line)' }}>
                        <td>{h.fecha}</td>
                        <td>{{ precio_venta: 'Precio de venta', precio_compra: 'Precio de compra', costo_promedio: 'Costo promedio' }[h.campo] || h.campo}</td>
                        <td>{h.valor_anterior ?? '—'}</td><td>{h.valor_nuevo ?? '—'}</td>
                        <td>{h.usuario_nombre || 'Sistema'} · {h.origen}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))}
          </div>
        )}
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
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Imagen del Producto</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 77, height: 77, borderRadius: 10, overflow: 'hidden', background: 'var(--glass)', border: '1px solid var(--line)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {form.imagen
                ? <img src={toFileUrl(form.imagen)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display='none' }} />
                : (() => {
                    const catActual = cats.find(c => c.id == form.categoria_id)
                    const imgDefault = getCategoryImg(catActual?.nombre, catActual?.imagen)
                    return <img src={imgDefault} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} onError={e => { e.target.style.display='none' }} />
                  })()}
              <div style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .22)', pointerEvents: 'none' }} />
            </div>
            <div style={{ flex: 1 }}>
              <button type="button" onClick={seleccionarImagen} disabled={cambiandoImg} className="clientes-glass-btn"
                style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid oklch(0.74 0.13 250 / .35)', cursor: 'pointer' }}>
                <div className="clientes-glass-bg" />
                <span className="clientes-glass-content" style={{ color: 'oklch(0.80 0.12 250)' }}>
                  <Camera size={14} />{cambiandoImg ? 'Seleccionando...' : form.imagen ? 'Cambiar imagen' : 'Seleccionar imagen'}
                </span>
              </button>
              {!form.imagen && cats.find(c => c.id == form.categoria_id)?.imagen && (
                <div style={{ marginTop: 5, fontSize: 11, color: 'var(--dim)' }}>Usando imagen de categoría</div>
              )}
              {form.imagen && (
                <button type="button" onClick={() => set('imagen', '')}
                  style={{ marginTop: 6, fontSize: 12, color: 'var(--dim)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Quitar (usar imagen de categoría)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <button onClick={onClose} className="clientes-glass-btn btn-secondary">
          <div className="clientes-glass-bg" />
          <span className="clientes-glass-content">Cancelar</span>
        </button>
        <button onClick={guardar} className="clientes-glass-btn btn-primary" disabled={guardando}>
          <div className="clientes-glass-bg" />
          <span className="clientes-glass-content"><Check size={15} /> {guardando ? 'Guardando...' : 'Guardar'}</span>
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
  const [motivoCodigo, setMotivoCodigo] = useState('')
  const [motivos, setMotivos] = useState(null)
  const [errorAjuste, setErrorAjuste] = useState('')
  const [guardando, setGuardando] = useState(false)
  useEffect(() => { window.api.inventario.getMotivos().then(m => setMotivos(m && m.ok !== false ? m : null)).catch(() => {}) }, [])
  useEffect(() => { setMotivoCodigo('') }, [tipo])

  async function guardar() {
    setErrorAjuste('')
    const cant = producto.permite_decimal ? parseFloat(cantidad) : parseInt(cantidad)
    if (!cant || cant <= 0) return toast.error('La cantidad debe ser mayor a 0')
    if (tipo !== 'entrada' && !motivoCodigo) { setErrorAjuste('Elige el motivo de la lista (es obligatorio en salidas y ajustes).'); return }
    if (motivoCodigo === 'otro' && motivo.trim().length < 3) { setErrorAjuste('Con el motivo «Otro» escribe el detalle.'); return }
    setGuardando(true)
    try {
      const r = await window.api.inventario.ajustarStock({
        producto_id: producto.id,
        tipo,
        cantidad: cant,
        motivo: motivo || null,
        motivo_codigo: motivoCodigo || undefined,
        usuario_id: usuario?.id,
        usuario_nombre: usuario?.nombre_completo,
      })
      if (r.ok && r.pendiente_aprobacion) {
        toast.success('Enviado a aprobación: el stock no cambia hasta que lo apruebe un administrador')
        onSaved()
        onClose()
      } else if (r.ok) {
        toast.success(`Stock ajustado: ${r.stock_anterior} → ${r.stock_nuevo}`)
        onSaved()
        onClose()
      } else {
        setErrorAjuste(r.error || 'No se pudo ajustar el stock')
      }
    } finally {
      setGuardando(false)
    }
  }

  const stockPreview = (() => {
    const cant = (producto.permite_decimal ? parseFloat(cantidad) : parseInt(cantidad)) || 0
    const redo = x => (producto.permite_decimal ? Math.round(x * 10 ** (producto.decimales || 0)) / 10 ** (producto.decimales || 0) : x)
    if (tipo === 'ajuste') return redo(cant)
    if (tipo === 'entrada') return redo((producto.stock || 0) + cant)
    return redo((producto.stock || 0) - cant)
  })()

  return (
    <Modal title={`Ajustar stock — ${producto.nombre}`} onClose={onClose} width={400}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['entrada', 'salida', 'ajuste'].map(t => (
          <button key={t} onClick={() => setTipo(t)} className="clientes-glass-btn" style={{
            flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            border: `1px solid ${tipo === t ? TIPO_MOV[t].color : 'var(--line)'}`,
            cursor: 'pointer', transition: 'border-color .2s',
          }}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content" style={{ color: tipo === t ? TIPO_MOV[t].color : 'var(--dim)' }}>
              {TIPO_MOV[t].label}
            </span>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FormField label={tipo === 'ajuste' ? 'Nuevo stock total' : 'Cantidad'}>
          <input
            className="gym-input"
            type="number" min={producto.permite_decimal ? '0' : '1'} step={producto.permite_decimal ? 'any' : 1}
            value={cantidad}
            onChange={e => setCantidad(e.target.value)}
            placeholder="0"
            autoFocus
          />
        </FormField>
        {motivos && motivos[tipo] && (
          <FormField label={tipo === 'entrada' ? 'Motivo (opcional)' : 'Motivo (obligatorio)'}>
            <select className="gym-input" data-testid="motivo-codigo" aria-label="Motivo del movimiento" value={motivoCodigo} onChange={e => setMotivoCodigo(e.target.value)}>
              <option value="">{tipo === 'entrada' ? 'Sin especificar' : 'Elige un motivo…'}</option>
              {motivos[tipo].map(m => <option key={m.codigo} value={m.codigo}>{m.etiqueta}</option>)}
            </select>
          </FormField>
        )}
        <FormField label={motivoCodigo === 'otro' ? 'Detalle (obligatorio)' : 'Detalle (opcional)'}>
          <input className="gym-input" aria-label="Detalle del motivo" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Escribe el detalle…" />
        </FormField>
        {errorAjuste && <p role="alert" data-testid="ajuste-error" style={{ color: 'oklch(0.75 0.18 25)', fontSize: 13 }}>Error: {errorAjuste}</p>}
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
          border: '1px solid transparent',
          boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 13, color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>Stock resultante</span>
          <span style={{ fontSize: 19, fontWeight: 800, fontFamily: 'var(--display)', color: stockPreview <= producto.stock_minimo ? 'oklch(0.75 0.18 25)' : 'oklch(0.78 0.16 155)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
            {stockPreview} {producto.unidad}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <button onClick={onClose} className="clientes-glass-btn btn-secondary">
          <div className="clientes-glass-bg" />
          <span className="clientes-glass-content">Cancelar</span>
        </button>
        <button onClick={guardar} className="clientes-glass-btn btn-primary" disabled={guardando}>
          <div className="clientes-glass-bg" />
          <span className="clientes-glass-content"><Check size={15} /> {guardando ? 'Aplicando...' : 'Aplicar'}</span>
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
      style={{
        background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
        border: '1px solid transparent', borderLeft: `3px solid ${catColor}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'default',
        boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)', textShadow: '0 1px 2px rgba(0,0,0,0.6)',
      }}
    >
      {/* Header visual */}
      <div style={{ height: 107, background: `${catColor}12`, borderBottom: `1px solid ${catColor}20`, position: 'relative', overflow: 'hidden' }}>
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
        <div style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .28)', pointerEvents: 'none' }} />
        {agotado && (
          <div style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '.12em' }}>AGOTADO</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px', flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--display)', color: 'var(--ink)', marginBottom: 2, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</div>
        {p.categoria_nombre && <div style={{ fontSize: 11, color: catColor, fontWeight: 600, marginBottom: 5 }}>{p.categoria_nombre}</div>}
        <div style={{ fontSize: 17, fontWeight: 800, fontFamily: 'var(--display)', color: 'var(--ink)', marginBottom: 5 }}>
          Bs. {Number(p.precio_venta).toFixed(2)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: stockColor, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'oklch(0.88 0.01 250 / .85)' }}>{p.stock} {p.unidad}{stockBajo && <span style={{ color: stockColor }}> · bajo</span>}</span>
        </div>
      </div>

      {/* Acciones */}
      <div style={{ display: 'flex', borderTop: '1px solid var(--line)', padding: '7px 8px', gap: 5 }}>
        <button onClick={() => onStock(p)} className="clientes-glass-btn btn-secondary" style={{ flex: 1, padding: '5px 0', fontSize: 12 }}>
          <div className="clientes-glass-bg" />
          <span className="clientes-glass-content"><Sliders size={12} /> Stock</span>
        </button>
        <button onClick={() => onEdit(p)} className="clientes-action-icon" title="Editar" style={{ flex: 1, gap: 5, fontSize: 12, fontWeight: 600, color: catColor }}>
          <Edit2 size={12} /> Editar
        </button>
        <button onClick={() => onEliminar(p)} className="clientes-action-icon" title="Eliminar" style={{ flexShrink: 0 }}>
          <Trash2 size={14} color="oklch(0.75 0.18 25)" />
        </button>
      </div>
    </motion.div>
  )
}

// ─── Tab Productos ────────────────────────────────────────────────────────────

function TabProductos({ categorias, proveedores, usuario }) {
  const { tienePermiso } = useAuth()
  const puedeCrear = tienePermiso('inventario.crear_producto'), puedeEditar = tienePermiso('inventario.editar_producto')
  const puedeEliminar = tienePermiso('inventario.eliminar_producto'), puedeAjustar = tienePermiso('inventario.ajustar_stock')
  const puedeConfigurar = tienePermiso('configuracion.editar_gym')
  const [verArchivados, setVerArchivados] = useState(false)
  const [soloPendientes, setSoloPendientes] = useState(false)
  const [nPendientes, setNPendientes] = useState(0)
  const [alertas, setAlertas] = useState(null)
  const [politica, setPolitica] = useState('no_permitir')
  const [umbral, setUmbral] = useState('0')
  useEffect(() => { window.api.inventario.getUmbralAprobacion().then(v => setUmbral(String(v ?? 0))).catch(() => {}) }, [])
  async function guardarUmbral() {
    const r = await window.api.inventario.setUmbralAprobacion(umbral === '' ? 0 : Number(umbral))
    if (r && r.ok === false) { toast.error(r.error || 'No se pudo guardar'); return }
    toast.success(Number(umbral) > 0 ? `Los ajustes de ${umbral} unidades o más pedirán aprobación` : 'Aprobación de ajustes desactivada')
  }
  useEffect(() => { window.api.inventario.getPoliticaStock().then(v => setPolitica(v || 'no_permitir')).catch(() => {}) }, [])
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

  async function cargar(p = page, ps = pageSize, b = busqueda, cat = filtroCategoria, arch = verArchivados, pend = soloPendientes) {
    setCargando(true)
    try {
      window.api.inventario.contarPendientes().then(n => setNPendientes(n || 0)).catch(() => {})
      window.api.inventario.getAlertas().then(a => setAlertas(a && a.ok !== false ? a : null)).catch(() => {})
      const result = await window.api.inventario.getPaginated({ page: p, pageSize: ps, busqueda: b || undefined, categoria_id: cat || undefined, archivados: arch || undefined, pendientes: pend || undefined })
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
    const r = await window.api.inventario.delete(p.id)
    if (r && r.ok === false) { toast.error(r.error || 'No se pudo eliminar'); return }
    toast.success('Producto eliminado (papelera)')
    cargar()
  }

  async function archivar(p) {
    const ok = await confirmar({ titulo: '¿Archivar producto?', mensaje: `"${p.nombre}" dejará de venderse y de aparecer en el punto de venta, pero conserva todo su historial. Puedes reactivarlo cuando quieras.`, tipo: 'advertencia', textoConfirmar: 'Archivar' })
    if (!ok) return
    const r = await window.api.inventario.archivar(p.id)
    if (r && r.ok === false) { toast.error(r.error || 'No se pudo archivar'); return }
    toast.success('Producto archivado')
    cargar()
  }

  async function reactivar(p) {
    const r = await window.api.inventario.reactivar(p.id)
    if (r && r.ok === false) { toast.error(r.error || 'No se pudo reactivar'); return }
    toast.success('Producto reactivado')
    cargar()
  }

  async function cambiarPolitica(v) {
    const r = await window.api.inventario.setPoliticaStock(v)
    if (r && r.ok === false) { toast.error(r.error || 'No se pudo guardar'); return }
    setPolitica(v)
    toast.success(v === 'permitir_con_aviso' ? 'Se permitirá vender sin stock (queda negativo, con aviso)' : 'No se permitirá vender más de lo que hay')
  }

  const stockBajo = productos.filter(p => p.stock <= p.stock_minimo)

  return (
    <div>
      {/* Alerta stock bajo */}
      {stockBajo.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{
          background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
          border: '1px solid transparent', borderLeft: '3px solid oklch(0.66 0.22 25)',
          borderRadius: 10, padding: '10px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
        }}>
          <TrendingDown size={17} color="oklch(0.75 0.18 25)" />
          <span style={{ fontSize: 13, color: 'oklch(0.85 0.10 25)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
            <strong>{stockBajo.length}</strong> producto{stockBajo.length !== 1 ? 's' : ''} con stock bajo o agotado
          </span>
        </motion.div>
      )}

      {/* Controles */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'oklch(0.88 0.01 250 / .85)', zIndex: 1 }} />
          <input
            className="gym-input"
            style={{
              paddingLeft: 32,
              background: 'oklch(0.2 0.02 250 / .5)',
              border: '1px solid oklch(1 0 0 / .18)',
              color: 'oklch(0.97 0.01 250)',
              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
            }}
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
            className="clientes-glass-btn"
            style={{ padding: '6px 10px', border: 'none', cursor: 'pointer' }}
          >
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content" style={{ color: !vistaGrid ? 'oklch(0.76 0.20 25)' : 'var(--dim)' }}><List size={15} /></span>
          </button>
          <button
            onClick={() => setVistaGrid(true)}
            title="Vista cards"
            className="clientes-glass-btn"
            style={{ padding: '6px 10px', border: 'none', cursor: 'pointer' }}
          >
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content" style={{ color: vistaGrid ? 'oklch(0.76 0.20 25)' : 'var(--dim)' }}><LayoutGrid size={15} /></span>
          </button>
        </div>
        <button onClick={() => cargar()} aria-label="Actualizar la lista" className="clientes-glass-btn btn-secondary">
          <div className="clientes-glass-bg" />
          <span className="clientes-glass-content"><RefreshCw size={14} /></span>
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink)' }}>
          <input type="checkbox" checked={verArchivados} onChange={e => { setVerArchivados(e.target.checked); setPage(1); cargar(1, pageSize, busqueda, filtroCategoria, e.target.checked) }} aria-label="Ver productos archivados" />
          Ver archivados
        </label>
        {alertas && alertas.total > 0 && (
          <span role="status" data-testid="alertas-stock" style={{ fontSize: 13, color: 'var(--ink)' }}>
            <strong>Alertas de stock:</strong>{' '}
            {alertas.sin_stock.length > 0 && `${alertas.sin_stock.length} sin stock`}
            {alertas.sin_stock.length > 0 && (alertas.bajo_minimo.length > 0 || alertas.a_reponer.length > 0) && ' · '}
            {alertas.bajo_minimo.length > 0 && `${alertas.bajo_minimo.length} bajo el mínimo`}
            {alertas.bajo_minimo.length > 0 && alertas.a_reponer.length > 0 && ' · '}
            {alertas.a_reponer.length > 0 && `${alertas.a_reponer.length} por reponer`}
          </span>
        )}
        {nPendientes > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink)' }}>
            <input type="checkbox" data-testid="filtro-por-completar" checked={soloPendientes} onChange={e => { setSoloPendientes(e.target.checked); setPage(1); cargar(1, pageSize, busqueda, filtroCategoria, verArchivados, e.target.checked) }} aria-label={`Ver solo los ${nPendientes} productos por completar`} />
            <strong data-testid="contador-por-completar">{nPendientes} por completar</strong>
          </label>
        )}
        {puedeConfigurar && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink)' }}>
            Si no hay stock:
            <select className="gym-input" aria-label="Política de stock negativo" value={politica} onChange={e => cambiarPolitica(e.target.value)} style={{ padding: '6px 8px', fontSize: 13 }}>
              <option value="no_permitir">No permitir vender</option>
              <option value="permitir_con_aviso">Permitir con aviso</option>
            </select>
          </label>
        )}
        {puedeConfigurar && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink)' }}>
            Pedir aprobación desde (unidades; 0 = no):
            <input type="number" min="0" step="any" className="gym-input" data-testid="umbral-aprobacion" aria-label="Umbral de aprobación de ajustes, en unidades. 0 desactiva" value={umbral} onChange={e => setUmbral(e.target.value)} onBlur={guardarUmbral} style={{ width: 80, padding: '6px 8px', fontSize: 13 }} />
          </label>
        )}
        {puedeCrear && (
        <button onClick={() => setModal('crear')} className="clientes-glass-btn btn-primary">
          <div className="clientes-glass-bg" />
          <span className="clientes-glass-content"><Plus size={15} /> Nuevo producto</span>
        </button>)}
      </div>

      {/* Lista / Grid */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--dim)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 13 }}>Cargando...</p>
        </div>
      ) : productos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--dim)' }}>
          <Box size={43} style={{ margin: '0 auto 12px', display: 'block', opacity: .4 }} />
          <p style={{ fontSize: 15 }}>No hay productos</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Agrega tu primer producto</p>
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
              const stockColorFull = agotado ? 'oklch(0.66 0.22 25)' : stockBajo ? 'oklch(0.82 0.14 75)' : 'oklch(0.78 0.16 155)'
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.025 }}
                  style={{
                    position: 'relative', overflow: 'hidden',
                    background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
                    border: '1px solid transparent',
                    borderRadius: 10, padding: '12px 16px',
                    display: 'flex', alignItems: 'center', gap: 12,
                    boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)', textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                  }}
                >
                  {/* Glow de estado de stock — mismo patrón que KPICard del Dashboard:
                      el color va al medio (radial-gradient), no en un marco/borde */}
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: 10,
                    background: `radial-gradient(circle at center, ${stockColorFull.replace(')', ' / 0.15)')} 0%, ${stockColorFull.replace(')', ' / 0.05)')} 55%, transparent 85%)`,
                    pointerEvents: 'none',
                  }} />

                  {/* Stock badge */}
                  <div style={{
                    position: 'relative',
                    minWidth: 56, height: 56, borderRadius: 10,
                    background: 'transparent', border: '1px solid transparent',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 19, fontWeight: 800, fontFamily: 'var(--display)', color: agotado ? 'oklch(0.75 0.18 25)' : stockBajo ? 'oklch(0.82 0.14 75)' : 'oklch(0.78 0.16 155)', lineHeight: 1 }}>
                      {p.stock}
                    </span>
                    <span style={{ fontSize: 10, color: 'oklch(0.88 0.01 250 / .85)', marginTop: 2 }}>{p.unidad}</span>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{p.nombre}</span>
                      {p.codigo && <span style={{ fontSize: 11, color: 'oklch(0.88 0.01 250 / .85)', background: 'var(--glass-2)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--line)' }}>{p.codigo}</span>}
                      {p.pendiente_completar === 1 && <span data-testid="fila-por-completar" title="Sin precio de venta: no se puede vender hasta completarlo" style={{ fontSize: 10, fontWeight: 700, color: 'oklch(0.85 0.12 75)', background: 'oklch(0.82 0.14 75 / .15)', padding: '2px 7px', borderRadius: 10, border: '1px solid oklch(0.82 0.14 75 / .35)', letterSpacing: '.08em' }}>POR COMPLETAR</span>}
                      {agotado && <span style={{ fontSize: 10, fontWeight: 700, color: 'oklch(0.75 0.18 25)', background: 'oklch(0.66 0.22 25 / .15)', padding: '2px 7px', borderRadius: 10, border: '1px solid oklch(0.66 0.22 25 / .3)', letterSpacing: '.08em' }}>AGOTADO</span>}
                    </div>
                    <div style={{ fontSize: 13, color: 'oklch(0.88 0.01 250 / .85)' }}>
                      {p.categoria_nombre || 'Sin categoría'} · Venta: <strong style={{ color: 'var(--ink)' }}>{fmtMoney(p.precio_venta)}</strong>
                      {p.precio_compra > 0 && <> · Compra: {fmtMoney(p.precio_compra)}</>}
                      · Mín: {p.stock_minimo}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {verArchivados ? (
                      puedeEliminar && (
                        <button onClick={() => reactivar(p)} aria-label={`Reactivar ${p.nombre}`} className="clientes-glass-btn btn-secondary" style={{ padding: '6px 10px', fontSize: 13 }}>
                          <div className="clientes-glass-bg" />
                          <span className="clientes-glass-content"><RefreshCw size={13} /> Reactivar</span>
                        </button>
                      )
                    ) : (<>
                    {puedeAjustar && (
                    <button
                      onClick={() => setModal({ tipo: 'stock', p })}
                      title="Ajustar stock"
                      aria-label={`Ajustar stock de ${p.nombre}`}
                      className="clientes-glass-btn btn-secondary"
                      style={{ padding: '6px 10px', fontSize: 13 }}
                    >
                      <div className="clientes-glass-bg" />
                      <span className="clientes-glass-content"><Sliders size={13} /> Stock</span>
                    </button>)}
                    {puedeEditar && (
                    <button onClick={() => setModal({ tipo: 'editar', p })} title="Editar" aria-label={`Editar ${p.nombre}`} className="clientes-action-icon">
                      <Edit2 size={16} color="oklch(0.88 0.01 250 / .85)" />
                    </button>)}
                    {puedeEliminar && (
                    <button onClick={() => archivar(p)} title="Archivar (conserva el historial)" aria-label={`Archivar ${p.nombre}`} className="clientes-action-icon">
                      <Box size={16} color="oklch(0.80 0.15 60)" />
                    </button>)}
                    {puedeEliminar && (
                    <button onClick={() => eliminar(p)} title="Mover a la papelera" aria-label={`Mover ${p.nombre} a la papelera`} className="clientes-action-icon">
                      <Trash2 size={16} color="oklch(0.75 0.18 25)" />
                    </button>)}
                    </>)}
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
          <div key={c.id} style={{
            background: 'oklch(0.13 0.02 250 / .42)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
            border: '1px solid transparent', borderLeft: `3px solid ${c.color || 'oklch(1 0 0 / .12)'}`, borderRadius: 10, padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)', textShadow: '0 1px 2px rgba(0,0,0,0.6)',
          }}>
            <div style={{ width: 43, height: 43, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--glass-2)', border: '1px solid var(--line)', position: 'relative' }}>
              <img src={getCategoryImg(c.nombre, c.imagen)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display='none' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .22)', pointerEvents: 'none' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{c.nombre}</div>
              {c.descripcion && <div style={{ fontSize: 13, color: 'oklch(0.88 0.01 250 / .85)' }}>{c.descripcion}</div>}
            </div>
            <button onClick={() => iniciarEdicion(c)} className="clientes-glass-btn" style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--line)', cursor: 'pointer' }}>
              <div className="clientes-glass-bg" />
              <span className="clientes-glass-content"><Edit2 size={13} color="var(--dim)" /></span>
            </button>
            <button onClick={() => eliminar(c)} className="clientes-glass-btn" style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid oklch(0.66 0.22 25 / .25)', cursor: 'pointer' }}>
              <div className="clientes-glass-bg" />
              <span className="clientes-glass-content"><Trash2 size={13} color="oklch(0.75 0.18 25)" /></span>
            </button>
          </div>
        ))}
      </div>

      {/* Formulario */}
      <div className="gym-card" style={{
        padding: '16px 18px',
        background: 'oklch(0.13 0.02 250 / .42)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
        border: '1px solid transparent',
        boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)', textShadow: '0 1px 2px rgba(0,0,0,0.6)',
      }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 14 }}>
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
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Imagen</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 51, height: 51, borderRadius: 8, overflow: 'hidden', background: 'var(--glass)', border: '1px solid var(--line)', flexShrink: 0, position: 'relative' }}>
                <img src={form.imagen || getCategoryImg(form.nombre)} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: form.imagen ? 1 : 0.5 }} onError={e => { e.target.style.display='none' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .22)', pointerEvents: 'none' }} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button type="button" onClick={seleccionarImagenCategoria} disabled={cambiandoImg} className="clientes-glass-btn"
                  style={{ padding: '5px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600, border: '1px solid oklch(0.74 0.13 250 / .35)', cursor: 'pointer' }}>
                  <div className="clientes-glass-bg" />
                  <span className="clientes-glass-content" style={{ color: 'oklch(0.80 0.12 250)' }}>
                    <Camera size={12} /> {cambiandoImg ? 'Seleccionando...' : form.imagen ? 'Cambiar' : 'Añadir foto'}
                  </span>
                </button>
                {form.imagen && (
                  <button type="button" onClick={() => setForm(p => ({ ...p, imagen: '' }))}
                    style={{ fontSize: 11, color: 'var(--dim)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textAlign: 'left' }}>
                    Quitar imagen
                  </button>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            {editando && (
              <button onClick={() => { setEditando(null); setForm({ nombre: '', descripcion: '', color: 'oklch(0.74 0.13 250)', imagen: '' }) }} className="clientes-glass-btn btn-secondary" style={{ flex: 1 }}>
                <div className="clientes-glass-bg" />
                <span className="clientes-glass-content">Cancelar</span>
              </button>
            )}
            <button onClick={guardar} className="clientes-glass-btn btn-primary" disabled={guardando} style={{ flex: 1 }}>
              <div className="clientes-glass-bg" />
              <span className="clientes-glass-content"><Check size={14} /> {editando ? 'Guardar' : 'Agregar'}</span>
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
          <div key={p.id} style={{
            background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
            border: '1px solid transparent', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)', textShadow: '0 1px 2px rgba(0,0,0,0.6)',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{p.nombre}</div>
              <div style={{ fontSize: 13, color: 'oklch(0.88 0.01 250 / .85)' }}>
                {[p.contacto, p.telefono, p.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
              </div>
            </div>
            <button onClick={() => iniciarEdicion(p)} className="clientes-glass-btn" style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--line)', cursor: 'pointer' }}>
              <div className="clientes-glass-bg" />
              <span className="clientes-glass-content"><Edit2 size={13} color="var(--dim)" /></span>
            </button>
            <button onClick={() => eliminar(p)} className="clientes-glass-btn" style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid oklch(0.66 0.22 25 / .25)', cursor: 'pointer' }}>
              <div className="clientes-glass-bg" />
              <span className="clientes-glass-content"><Trash2 size={13} color="oklch(0.75 0.18 25)" /></span>
            </button>
          </div>
        ))}
      </div>

      <div className="gym-card" style={{
        padding: '16px 18px',
        background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
        border: '1px solid transparent',
        boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)', textShadow: '0 1px 2px rgba(0,0,0,0.6)',
      }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 14 }}>
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
              <button onClick={() => { setEditando(null); setForm({ nombre: '', contacto: '', telefono: '', email: '', direccion: '', notas: '' }) }} className="clientes-glass-btn btn-secondary" style={{ flex: 1 }}>
                <div className="clientes-glass-bg" />
                <span className="clientes-glass-content">Cancelar</span>
              </button>
            )}
            <button onClick={guardar} className="clientes-glass-btn btn-primary" disabled={guardando} style={{ flex: 1 }}>
              <div className="clientes-glass-bg" />
              <span className="clientes-glass-content"><Check size={14} /> {editando ? 'Guardar' : 'Agregar'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tab Movimientos ──────────────────────────────────────────────────────────

// ─── Conciliación del kardex (Fase 2) ────────────────────────────────────────

function PanelConciliacion() {
  const { tienePermiso, usuario } = useAuth()
  const [resultado, setResultado] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [reparando, setReparando] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  if (!tienePermiso('inventario.conciliar')) return null

  async function revisar() {
    setCargando(true); setError('')
    const r = await window.api.inventario.conciliacion()
    setCargando(false)
    if (r && r.ok === false) { setError(r.error || 'No se pudo revisar el kardex'); return }
    setResultado(r)
  }
  async function reparar() {
    setError('')
    const r = await window.api.inventario.repararConciliacion({ producto_id: reparando.producto_id, motivo })
    if (r && r.ok === false) { setError(r.error || 'No se pudo conciliar'); return }
    toast.success('Kardex conciliado: se registró el ajuste')
    setReparando(null); setMotivo('')
    revisar()
  }
  const TIPOS = { stock_distinto: 'El stock no coincide con el kardex', cadena_rota: 'Falta un movimiento en medio', sin_saldo_inicial: 'No hay saldo inicial registrado', stock_sin_movimientos: 'Hay stock pero ningún movimiento' }

  return (
    <section aria-label="Conciliación del kardex" style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <strong style={{ color: 'var(--ink)', fontSize: 14 }}>Conciliación del kardex</strong>
        <span style={{ fontSize: 12, color: 'var(--dim)' }}>Compara el stock de cada producto con la suma de sus movimientos. Solo lectura hasta que decidas reparar.</span>
        <button onClick={revisar} disabled={cargando} className="clientes-glass-btn btn-secondary" style={{ marginLeft: 'auto' }}>
          <div className="clientes-glass-bg" /><span className="clientes-glass-content">{cargando ? 'Revisando…' : 'Revisar kardex'}</span>
        </button>
      </div>
      {error && <p role="alert" style={{ color: 'oklch(0.75 0.18 25)', fontSize: 13, marginTop: 8 }}>Error: {error}</p>}
      {resultado && (
        <div style={{ marginTop: 10 }}>
          <p role="status" style={{ fontSize: 13, color: 'var(--ink)' }}>
            {resultado.con_diferencias === 0 ? 'Todo cuadra: el kardex coincide con el stock de todos los productos.'
              : `${resultado.con_diferencias} de ${resultado.total_productos} productos con diferencias (${resultado.en_papelera} están en la papelera).`}
          </p>
          {resultado.diferencias.slice(0, 50).map(d => (
            <div key={d.producto_id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--line)', fontSize: 13, color: 'var(--ink)' }}>
              <span style={{ flex: 1 }}>{d.nombre}{d.eliminado ? ' (papelera)' : ''}<br /><span style={{ color: 'var(--dim)', fontSize: 12 }}>{d.tipos.map(t => TIPOS[t] || t).join(' · ')}</span></span>
              <span>Stock real: <strong>{d.stock_real}</strong> · Kardex: <strong>{d.stock_kardex}</strong> · Diferencia: <strong>{d.diferencia > 0 ? '+' : ''}{d.diferencia}</strong></span>
              <button onClick={() => { setReparando(d); setMotivo(''); setError('') }} aria-label={`Conciliar ${d.nombre}`} className="clientes-glass-btn btn-secondary">
                <div className="clientes-glass-bg" /><span className="clientes-glass-content">Conciliar</span>
              </button>
            </div>
          ))}
          {resultado.diferencias.length > 50 && <p style={{ fontSize: 12, color: 'var(--dim)' }}>Se muestran 50 de {resultado.diferencias.length}.</p>}
        </div>
      )}
      {reparando && (
        <Modal title={`Conciliar «${reparando.nombre}»`} onClose={() => setReparando(null)}>
          <p style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 10 }}>
            Se registrará un ajuste «Conciliación» que lleva el kardex de {reparando.stock_kardex} a {reparando.stock_real}. El stock del producto no cambia y el historial no se borra. Quedará auditado a nombre de {usuario?.nombre_completo}.
          </p>
          <label htmlFor="conc-motivo" style={{ fontSize: 12, color: 'var(--dim)' }}>Motivo (obligatorio)</label>
          <input id="conc-motivo" className="gym-input" aria-label="Motivo de la conciliación" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej.: conteo físico del 05/11" style={{ width: '100%' }} />
          {error && <p role="alert" style={{ color: 'oklch(0.75 0.18 25)', fontSize: 13, marginTop: 8 }}>Error: {error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <button onClick={() => setReparando(null)} className="clientes-glass-btn btn-secondary"><div className="clientes-glass-bg" /><span className="clientes-glass-content">Cancelar</span></button>
            <button onClick={reparar} className="clientes-glass-btn btn-primary"><div className="clientes-glass-bg" /><span className="clientes-glass-content"><Check size={15} /> Registrar ajuste</span></button>
          </div>
        </Modal>
      )}
    </section>
  )
}

// ─── Aprobaciones de ajustes (Fase 8) ────────────────────────────────────────

function PanelAprobaciones() {
  const { tienePermiso } = useAuth()
  const puedeAprobar = tienePermiso('inventario.aprobar_ajustes')
  const [lista, setLista] = useState([])
  const [error, setError] = useState('')
  const [rechazando, setRechazando] = useState(null)
  const [nota, setNota] = useState('')
  async function cargar() {
    const r = await window.api.aprobaciones.getAll({ estado: 'pendiente' })
    if (r && r.ok === false) { setError(r.error || 'No se pudieron cargar las solicitudes'); return }
    setLista(Array.isArray(r) ? r : [])
  }
  useEffect(() => { cargar() }, [])
  async function resolver(fn, ok) {
    setError('')
    const r = await fn()
    if (r && r.ok === false) { setError(r.error || 'No se pudo completar'); return }
    toast.success(ok); setRechazando(null); setNota(''); cargar()
  }
  if (lista.length === 0 && !error) return null
  return (
    <section aria-label="Ajustes pendientes de aprobación" data-testid="panel-aprobaciones" style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
      <strong style={{ color: 'var(--ink)', fontSize: 14 }}>Ajustes pendientes de aprobación ({lista.length})</strong>
      {error && <p role="alert" style={{ color: 'oklch(0.75 0.18 25)', fontSize: 13, marginTop: 8 }}>Error: {error}</p>}
      {lista.map(a => (
        <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--line)', fontSize: 13, color: 'var(--ink)', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 220 }}>
            {a.producto_nombre}: {a.tipo_movimiento} de {a.cantidad} (cambio de {a.diferencia > 0 ? '+' : ''}{a.diferencia})<br />
            <span style={{ color: 'var(--dim)', fontSize: 12 }}>Pidió {a.solicitado_por_nombre} · {a.fecha}{a.motivo ? ` · ${a.motivo}` : ''}</span>
          </span>
          {puedeAprobar ? (
            <>
              <button onClick={() => resolver(() => window.api.aprobaciones.aprobar(a.id), 'Ajuste aprobado y aplicado')} aria-label={`Aprobar el ajuste de ${a.producto_nombre}`} className="clientes-glass-btn btn-primary"><div className="clientes-glass-bg" /><span className="clientes-glass-content"><Check size={14} /> Aprobar</span></button>
              <button onClick={() => { setRechazando(a.id); setNota('') }} aria-label={`Rechazar el ajuste de ${a.producto_nombre}`} className="clientes-glass-btn btn-secondary"><div className="clientes-glass-bg" /><span className="clientes-glass-content">Rechazar</span></button>
            </>
          ) : <span style={{ color: 'var(--dim)' }}>Esperando aprobación</span>}
          {rechazando === a.id && (
            <div style={{ flexBasis: '100%', display: 'flex', gap: 8 }}>
              <input className="gym-input" aria-label="Motivo del rechazo" placeholder="Motivo del rechazo (obligatorio)" value={nota} onChange={e => setNota(e.target.value)} style={{ flex: 1 }} />
              <button onClick={() => resolver(() => window.api.aprobaciones.rechazar(a.id, { nota }), 'Ajuste rechazado')} className="clientes-glass-btn btn-secondary"><div className="clientes-glass-bg" /><span className="clientes-glass-content">Confirmar rechazo</span></button>
            </div>
          )}
        </div>
      ))}
    </section>
  )
}

function TabMovimientos() {
  const [movimientos, setMovimientos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    window.api.inventario.getAllMovimientos().then(d => { setMovimientos(d || []); setCargando(false) })
  }, [])

  if (cargando) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--dim)' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>

  return (
    <div>
      <PanelAprobaciones />
      <PanelConciliacion />
      {movimientos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--dim)' }}>No hay movimientos registrados</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {movimientos.map((m, i) => {
            const t = TIPO_MOV[m.tipo] || { label: m.tipo, color: 'var(--dim)', icon: Box }
            const Icon = t.icon
            return (
              <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }}
                style={{
                  background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
                  border: '1px solid transparent', borderRadius: 9, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12,
                  boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)', textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                }}
              >
                <div style={{ width: 30, height: 30, borderRadius: 7, background: `${t.color}18`, border: `1px solid ${t.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={13} color={t.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                    {m.producto_nombre}
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: t.color, background: `${t.color}15`, padding: '1px 7px', borderRadius: 10 }}>
                      {t.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'oklch(0.88 0.01 250 / .85)' }}>
                    {m.motivo || '—'} · {m.usuario_nombre || 'Sistema'} · {fmtDate(m.created_at)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--display)', color: t.color }}>
                    {m.tipo === 'merma' ? '' : (m.tipo === 'salida' || m.tipo === 'venta' ? '-' : '+')}{m.cantidad}
                  </div>
                  {m.stock_nuevo != null && (
                    <div style={{ fontSize: 11, color: 'oklch(0.88 0.01 250 / .85)' }}>{m.stock_anterior}→{m.stock_nuevo}</div>
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

// ─── Tab Promociones ──────────────────────────────────────────────────────────

const TIPO_PROMO = {
  '2x1':            { label: '2×1',             color: 'oklch(0.74 0.13 250)', desc: 'El cliente paga 1 y lleva 2' },
  'descuento_pct':  { label: 'Descuento %',      color: 'oklch(0.78 0.16 155)', desc: 'Porcentaje sobre el precio' },
  'descuento_fijo': { label: 'Descuento Fijo Bs.', color: 'oklch(0.82 0.14 75)', desc: 'Monto fijo en bolivianos' },
}

function ModalPromocion({ promo, onSave, onClose }) {
  const esEdicion = !!promo?.id
  const [form, setForm] = useState(promo ? { ...promo } : {
    nombre: '', tipo: '2x1', valor: 0, descripcion: '',
    fecha_inicio: '', fecha_fin: '', activo: 1,
  })
  const [todosProductos, setTodosProductos] = useState([])
  const [seleccionados, setSeleccionados] = useState([])
  const [busqProd, setBusqProd] = useState('')
  const [cargandoProd, setCargandoProd] = useState(true)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  useEffect(() => {
    async function cargarProductos() {
      setCargandoProd(true)
      try {
        const res = await window.api.inventario.getPaginated({ page: 1, pageSize: 999 })
        setTodosProductos(res?.data || [])
        if (esEdicion && promo.id) {
          const asignados = await window.api.promociones.getProductos(promo.id)
          setSeleccionados(asignados.map(a => a.item_id))
        }
      } catch { }
      setCargandoProd(false)
    }
    cargarProductos()
  }, [])

  function toggleProducto(id) {
    setSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleSave() {
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio'); return }
    try {
      const data = {
        ...form,
        items: seleccionados.map(id => ({ tipo_item: 'producto', item_id: id })),
      }
      if (esEdicion) {
        await window.api.promociones.update(promo.id, data)
        toast.success('Promoción actualizada')
      } else {
        await window.api.promociones.create(data)
        toast.success('Promoción creada')
      }
      onSave()
    } catch { toast.error('Error al guardar') }
  }

  const prodsFiltrados = todosProductos.filter(p =>
    !busqProd || p.nombre.toLowerCase().includes(busqProd.toLowerCase())
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'oklch(0 0 0 / .7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{
          width: '100%', maxWidth: 580, maxHeight: '90vh',
          background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
          border: '1px solid transparent', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .11), 0 0 16px 2px oklch(1 0 0 / .08), 0 24px 60px oklch(0 0 0 / .4)', textShadow: '0 1px 2px rgba(0,0,0,0.6)',
        }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 800, letterSpacing: '.06em', margin: 0 }}>
            {esEdicion ? 'Editar Promoción' : 'Nueva Promoción'}
          </h3>
          <button onClick={onClose} className="clientes-glass-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6 }}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content" style={{ color: 'var(--dim)' }}><X size={17} /></span>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 13 }}>
          {/* Nombre */}
          <div>
            <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Nombre *</label>
            <input className="gym-input" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: 2×1 en proteínas" style={{ width: '100%' }} />
          </div>
          {/* Tipo */}
          <div>
            <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Tipo de promoción</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(TIPO_PROMO).map(([k, v]) => (
                <button key={k} type="button" onClick={() => set('tipo', k)} className="clientes-glass-btn" style={{
                  padding: '10px 14px', borderRadius: 10,
                  border: `1px solid ${form.tipo === k ? `${v.color}50` : 'var(--line)'}`,
                  cursor: 'pointer', textAlign: 'left',
                }}>
                  <div className="clientes-glass-bg" />
                  <span className="clientes-glass-content" style={{ justifyContent: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: form.tipo === k ? v.color : 'var(--muted)', minWidth: 90 }}>{v.label}</span>
                    <span style={{ fontSize: 12, color: 'oklch(0.88 0.01 250 / .85)' }}>{v.desc}</span>
                    {form.tipo === k && <Check size={14} style={{ marginLeft: 'auto', flexShrink: 0, color: v.color }} />}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {/* Valor */}
          {form.tipo !== '2x1' && (
            <div>
              <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>
                Valor {form.tipo === 'descuento_pct' ? '(%)' : '(Bs.)'}
              </label>
              <input className="gym-input" type="number" min="0" max={form.tipo === 'descuento_pct' ? 100 : undefined}
                value={form.valor} onChange={e => set('valor', parseFloat(e.target.value) || 0)}
                placeholder={form.tipo === 'descuento_pct' ? '15' : '20'} style={{ width: '100%' }} />
            </div>
          )}
          {/* Descripción */}
          <div>
            <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Descripción (opcional)</label>
            <input className="gym-input" value={form.descripcion || ''} onChange={e => set('descripcion', e.target.value)} placeholder="Detalle de la promoción..." style={{ width: '100%' }} />
          </div>
          {/* Fechas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Fecha inicio</label>
              <input className="gym-input" type="date" value={form.fecha_inicio || ''} onChange={e => set('fecha_inicio', e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label className="gym-label" style={{ display: 'block', marginBottom: 5 }}>Fecha fin</label>
              <input className="gym-input" type="date" value={form.fecha_fin || ''} onChange={e => set('fecha_fin', e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>
          {/* Activo */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--muted)', userSelect: 'none' }}>
            <input type="checkbox" checked={form.activo === 1} onChange={e => set('activo', e.target.checked ? 1 : 0)} />
            Promoción activa
          </label>
          {/* Selección de productos */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label className="gym-label">Productos que aplica</label>
              <span style={{ fontSize: 11, color: 'var(--dim)' }}>
                {seleccionados.length === 0 ? 'Sin selección = aplica a todos' : `${seleccionados.length} seleccionado${seleccionados.length !== 1 ? 's' : ''}`}
              </span>
            </div>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'oklch(0.88 0.01 250 / .85)', pointerEvents: 'none', zIndex: 1 }} />
              <input className="gym-input" placeholder="Filtrar productos..." value={busqProd} onChange={e => setBusqProd(e.target.value)} style={{
                paddingLeft: 28, fontSize: 13, height: 32,
                background: 'oklch(0.2 0.02 250 / .5)', border: '1px solid oklch(1 0 0 / .18)',
                color: 'oklch(0.97 0.01 250)', textShadow: '0 1px 2px rgba(0,0,0,0.6)',
              }} />
            </div>
            <div style={{ maxHeight: 190, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 10, padding: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 6 }}>
              {cargandoProd ? (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 20 }}>
                  <div className="spinner" style={{ margin: '0 auto' }} />
                </div>
              ) : prodsFiltrados.length === 0 ? (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 20, color: 'var(--dim)', fontSize: 13 }}>Sin productos</div>
              ) : prodsFiltrados.map(p => {
                const sel = seleccionados.includes(p.id)
                const catColor = p.categoria_color || 'oklch(0.74 0.13 250)'
                return (
                  <button key={p.id} type="button" onClick={() => toggleProducto(p.id)} className="clientes-glass-btn" style={{
                    border: `2px solid ${sel ? catColor : 'var(--line)'}`,
                    borderRadius: 8, padding: '5px 3px', cursor: 'pointer', textAlign: 'center',
                    transition: 'border-color .12s', position: 'relative',
                  }}>
                    <div className="clientes-glass-bg" />
                    <span className="clientes-glass-content" style={{ flexDirection: 'column', gap: 3 }}>
                      <div style={{ width: 43, height: 43, borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                        <img src={p.imagen ? toFileUrl(p.imagen) : getCategoryImg(p.categoria_nombre, p.categoria_imagen)}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { e.target.src = getCategoryImg(p.categoria_nombre, p.categoria_imagen) }}
                          alt={p.nombre} />
                        <div style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .22)', pointerEvents: 'none' }} />
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: sel ? catColor : 'var(--muted)', lineHeight: 1.2, wordBreak: 'break-word', maxWidth: '100%' }}>{p.nombre}</div>
                      <div style={{ fontSize: 10, color: 'oklch(0.88 0.01 250 / .85)' }}>Bs.{Number(p.precio_venta).toFixed(0)}</div>
                      {sel && (
                        <div style={{ position: 'absolute', top: 2, right: 2, width: 15, height: 15, borderRadius: '50%', background: catColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={9} color="#fff" />
                        </div>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
            {seleccionados.length > 0 && (
              <button type="button" onClick={() => setSeleccionados([])} style={{ marginTop: 5, fontSize: 12, color: 'var(--dim)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                Quitar selección (aplica a todos)
              </button>
            )}
          </div>
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', display: 'flex', gap: 10 }}>
          <button className="clientes-glass-btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content">Cancelar</span>
          </button>
          <button className="clientes-glass-btn btn-primary" onClick={handleSave} style={{ flex: 2 }}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content">{esEdicion ? 'Guardar cambios' : 'Crear promoción'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function TabPromociones() {
  const [lista, setLista] = useState([])
  const [modal, setModal] = useState(null) // null | promo | {}
  const [cargando, setCargando] = useState(true)
  const confirmar = useConfirm()

  const cargar = useCallback(async () => {
    setCargando(true)
    try { setLista(await window.api.promociones.getAll() || []) }
    catch { setLista([]) }
    finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function toggleActivo(p) {
    await window.api.promociones.setActivo(p.id, p.activo ? 0 : 1)
    toast.success(p.activo ? 'Promoción desactivada' : 'Promoción activada')
    cargar()
  }

  async function handleDelete(p) {
    const ok = await confirmar({ titulo: '¿Eliminar promoción?', mensaje: `"${p.nombre}" será eliminada permanentemente.`, tipo: 'peligro', textoConfirmar: 'Eliminar' })
    if (!ok) return
    await window.api.promociones.delete(p.id)
    toast.success('Promoción eliminada')
    cargar()
  }

  function esVigente(p) {
    const hoy = new Date().toISOString().slice(0, 10)
    if (!p.activo) return false
    if (p.fecha_inicio && p.fecha_inicio > hoy) return false
    if (p.fecha_fin && p.fecha_fin < hoy) return false
    return true
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--ink)', textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>Gestión de Promociones</h3>
          <p style={{ fontSize: 13, color: 'oklch(0.88 0.01 250 / .85)', marginTop: 3, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>2×1, descuentos en porcentaje o monto fijo</p>
        </div>
        <button className="clientes-glass-btn btn-primary btn-sm" onClick={() => setModal({})}>
          <div className="clientes-glass-bg" />
          <span className="clientes-glass-content"><Plus size={15} /> Nueva Promoción</span>
        </button>
      </div>

      {cargando ? (
        <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : lista.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--dim)', fontSize: 14 }}>
          <Percent size={43} style={{ margin: '0 auto 12px', opacity: .2, display: 'block' }} />
          No hay promociones. Crea la primera.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lista.map(p => {
            const tipo = TIPO_PROMO[p.tipo] || { label: p.tipo, color: 'var(--dim)' }
            const vigente = esVigente(p)
            return (
              <div key={p.id} style={{
                background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
                border: '1px solid transparent',
                borderLeft: `3px solid ${vigente ? tipo.color : 'oklch(1 0 0 / .1)'}`,
                borderRadius: 12, padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
                opacity: p.activo ? 1 : 0.55,
                boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)', textShadow: '0 1px 2px rgba(0,0,0,0.6)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{p.nombre}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', padding: '2px 8px', borderRadius: 20, background: `${tipo.color}15`, border: `1px solid ${tipo.color}40`, color: tipo.color }}>
                      {tipo.label}{p.tipo !== '2x1' && p.valor > 0 ? ` ${p.valor}${p.tipo === 'descuento_pct' ? '%' : ' Bs.'}` : ''}
                    </span>
                    {vigente && <span style={{ fontSize: 11, fontWeight: 600, color: 'oklch(0.78 0.16 155)', background: 'oklch(0.78 0.16 155 / .1)', padding: '2px 7px', borderRadius: 20 }}>● ACTIVA</span>}
                  </div>
                  {p.descripcion && <div style={{ fontSize: 12, color: 'oklch(0.88 0.01 250 / .85)', marginTop: 3 }}>{p.descripcion}</div>}
                  {(p.fecha_inicio || p.fecha_fin) && (
                    <div style={{ fontSize: 11, color: 'oklch(0.88 0.01 250 / .85)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={11} />
                      {p.fecha_inicio && `Desde ${p.fecha_inicio}`}
                      {p.fecha_inicio && p.fecha_fin && ' · '}
                      {p.fecha_fin && `Hasta ${p.fecha_fin}`}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button className="clientes-glass-btn btn-ghost btn-sm" onClick={() => toggleActivo(p)} title={p.activo ? 'Desactivar' : 'Activar'} style={{ padding: '4px 8px' }}>
                    <div className="clientes-glass-bg" />
                    <span className="clientes-glass-content">{p.activo ? <ToggleRight size={17} color="oklch(0.78 0.16 155)" /> : <ToggleLeft size={17} />}</span>
                  </button>
                  <button className="clientes-glass-btn btn-ghost btn-sm" onClick={() => setModal(p)} title="Editar" style={{ padding: '4px 8px' }}>
                    <div className="clientes-glass-bg" />
                    <span className="clientes-glass-content"><Edit2 size={14} /></span>
                  </button>
                  <button className="clientes-glass-btn btn-ghost btn-sm" onClick={() => handleDelete(p)} title="Eliminar" style={{ padding: '4px 8px' }}>
                    <div className="clientes-glass-bg" />
                    <span className="clientes-glass-content"><Trash2 size={14} color="oklch(0.66 0.22 25)" /></span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {modal !== null && (
          <ModalPromocion
            promo={modal?.id ? modal : null}
            onSave={() => { setModal(null); cargar() }}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Conteo físico guiado (Fase 3) ────────────────────────────────────────────

const ESTADO_CONTEO = { borrador: 'En conteo', contado: 'Contado (por aprobar)', aprobado: 'Aprobado', cancelado: 'Cancelado', revertido: 'Revertido' }

// ─── Compras y costo (Fase 5) ────────────────────────────────────────────────

const ESTADOS_COMPRA = { borrador: 'Borrador', enviada: 'Enviada', recibida_parcial: 'Recibida parcial', recibida: 'Recibida', cancelada: 'Cancelada' }

function FormCompra({ simple, inicial, onClose, onHecho }) {
  const [proveedores, setProveedores] = useState([])
  const [productos, setProductos] = useState([])
  const [proveedorId, setProveedorId] = useState('')
  const [nota, setNota] = useState('')
  const [lineas, setLineas] = useState(inicial?.length ? inicial : [{ producto_id: '', cantidad: '', costo_unitario: '' }])
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => {
    window.api.inventario.getProveedores().then(d => setProveedores(d || []))
    window.api.inventario.getAll().then(d => setProductos(d || []))
  }, [])
  const setL = (i, k, v) => setLineas(ls => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)))
  const total = lineas.reduce((t, l) => t + (Number(l.cantidad) || 0) * (Number(l.costo_unitario) || 0), 0)

  async function guardar() {
    setError('')
    const ls = lineas.map(l => ({ producto_id: Number(l.producto_id), cantidad: Number(l.cantidad), costo_unitario: Number(l.costo_unitario) }))
    if (ls.some(l => !l.producto_id)) { setError('Elige un producto en cada línea.'); return }
    if (ls.some(l => !(l.cantidad > 0))) { setError('La cantidad de cada línea debe ser mayor que 0.'); return }
    if (lineas.some(l => l.costo_unitario === '' || !(Number(l.costo_unitario) >= 0))) { setError('Escribe el costo unitario de cada línea (0 o más).'); return }
    setOcupado(true)
    const datos = { proveedor_id: proveedorId ? Number(proveedorId) : null, nota: nota || undefined, lineas: ls }
    const r = simple ? await window.api.compras.registrarSimple(datos) : await window.api.compras.crear(datos)
    setOcupado(false)
    if (r && r.ok === false) { setError(r.error || 'No se pudo guardar'); return }
    toast.success(simple ? 'Compra registrada: stock y costo actualizados' : 'Orden creada en borrador')
    onHecho()
  }

  return (
    <Modal title={simple ? 'Registrar compra (ya recibida)' : 'Nueva orden de compra'} onClose={onClose}>
      <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 10 }}>
        {simple ? 'Suma el stock ahora y actualiza el costo promedio de cada producto.' : 'Queda en borrador: no cambia el stock hasta que la envíes y recibas la mercadería.'}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <FormField label="Proveedor (opcional)">
          <select className="gym-input" aria-label="Proveedor" value={proveedorId} onChange={e => setProveedorId(e.target.value)}>
            <option value="">Sin proveedor</option>
            {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </FormField>
        <FormField label="Nota (opcional)">
          <input className="gym-input" aria-label="Nota de la compra" value={nota} onChange={e => setNota(e.target.value)} />
        </FormField>
      </div>
      {lineas.map((l, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 6, alignItems: 'end' }}>
          <select className="gym-input" aria-label={`Producto de la línea ${i + 1}`} value={l.producto_id} onChange={e => setL(i, 'producto_id', e.target.value)}>
            <option value="">Elige un producto…</option>
            {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <input className="gym-input" type="number" min="0" step="any" aria-label={`Cantidad de la línea ${i + 1}`} placeholder="Cantidad" value={l.cantidad} onChange={e => setL(i, 'cantidad', e.target.value)} />
          <input className="gym-input" type="number" min="0" step="0.01" aria-label={`Costo unitario de la línea ${i + 1}`} placeholder="Costo (Bs.)" value={l.costo_unitario} onChange={e => setL(i, 'costo_unitario', e.target.value)} />
          <button type="button" aria-label={`Quitar la línea ${i + 1}`} onClick={() => setLineas(ls => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls))} className="clientes-glass-btn btn-secondary"><div className="clientes-glass-bg" /><span className="clientes-glass-content"><X size={14} /></span></button>
        </div>
      ))}
      <button type="button" onClick={() => setLineas(ls => [...ls, { producto_id: '', cantidad: '', costo_unitario: '' }])} className="clientes-glass-btn btn-secondary" style={{ marginTop: 4 }}>
        <div className="clientes-glass-bg" /><span className="clientes-glass-content"><Plus size={14} /> Agregar línea</span>
      </button>
      <p style={{ fontSize: 13, color: 'var(--ink)', marginTop: 10 }}>Total: <strong>Bs. {total.toFixed(2)}</strong></p>
      {error && <p role="alert" style={{ color: 'oklch(0.75 0.18 25)', fontSize: 13, marginTop: 8 }}>Error: {error}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <button onClick={onClose} className="clientes-glass-btn btn-secondary"><div className="clientes-glass-bg" /><span className="clientes-glass-content">Cancelar</span></button>
        <button onClick={guardar} disabled={ocupado} className="clientes-glass-btn btn-primary"><div className="clientes-glass-bg" /><span className="clientes-glass-content"><Check size={15} /> {simple ? 'Registrar compra' : 'Crear orden'}</span></button>
      </div>
    </Modal>
  )
}

function DetalleCompra({ id, onClose, onCambio }) {
  const [o, setO] = useState(null)
  const [recibir, setRecibir] = useState({})
  const [motivo, setMotivo] = useState('')
  const [cancelando, setCancelando] = useState(false)
  const [error, setError] = useState('')
  async function cargar() {
    const d = await window.api.compras.getById(id)
    if (d && d.ok === false) { setError(d.error); return }
    setO(d)
    setRecibir(Object.fromEntries((d?.lineas || []).map(l => [l.id, String(Math.max(0, +(l.cantidad_pedida - l.cantidad_recibida).toFixed(6)))])))
  }
  useEffect(() => { cargar() }, [id])
  async function accion(fn, ok) {
    setError('')
    const r = await fn()
    if (r && r.ok === false) { setError(r.error || 'No se pudo completar'); return }
    if (ok) toast.success(ok)
    await cargar(); onCambio()
  }
  if (!o) return <Modal title="Orden de compra" onClose={onClose}>{error ? <p role="alert">Error: {error}</p> : 'Cargando…'}</Modal>
  const puedeRecibir = o.estado === 'enviada' || o.estado === 'recibida_parcial'
  return (
    <Modal title={`Compra #${o.id} · ${ESTADOS_COMPRA[o.estado] || o.estado}`} onClose={onClose}>
      <p style={{ fontSize: 13, color: 'var(--dim)' }}>{o.proveedor_nombre || 'Sin proveedor'} · {o.fecha} · Total Bs. {Number(o.total).toFixed(2)}{o.nota ? ` · ${o.nota}` : ''}</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, color: 'var(--ink)', margin: '10px 0' }}>
        <thead><tr style={{ textAlign: 'left', color: 'var(--dim)' }}><th scope="col">Producto</th><th scope="col">Pedido</th><th scope="col">Recibido</th><th scope="col">Costo</th>{puedeRecibir && <th scope="col">Recibir ahora</th>}</tr></thead>
        <tbody>
          {o.lineas.map(l => (
            <tr key={l.id} style={{ borderTop: '1px solid var(--line)' }}>
              <td>{l.nombre_producto}</td><td>{l.cantidad_pedida}</td><td>{l.cantidad_recibida}</td><td>Bs. {Number(l.costo_unitario).toFixed(2)}</td>
              {puedeRecibir && <td><input type="number" min="0" step="any" className="gym-input" aria-label={`Cantidad a recibir de ${l.nombre_producto}`} value={recibir[l.id] ?? ''} onChange={e => setRecibir(v => ({ ...v, [l.id]: e.target.value }))} style={{ width: 90, padding: '4px 6px' }} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
      {o.recepciones.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <strong style={{ fontSize: 13, color: 'var(--ink)' }}>Recepciones</strong>
          {o.recepciones.map(r => (
            <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, color: 'var(--ink)', padding: '4px 0' }}>
              <span style={{ flex: 1 }}>Recepción #{r.id} · {r.fecha} · {r.usuario_nombre}{r.revertida_at ? ' · REVERTIDA' : ''}</span>
              {!r.revertida_at && <button onClick={() => accion(() => window.api.compras.revertirRecepcion(r.id), 'Recepción revertida con movimiento inverso')} aria-label={`Revertir la recepción ${r.id}`} className="clientes-glass-btn btn-secondary"><div className="clientes-glass-bg" /><span className="clientes-glass-content">Revertir</span></button>}
            </div>
          ))}
        </div>
      )}
      {cancelando && (
        <FormField label="Motivo de la cancelación (obligatorio)">
          <input className="gym-input" aria-label="Motivo de la cancelación" value={motivo} onChange={e => setMotivo(e.target.value)} />
        </FormField>
      )}
      {error && <p role="alert" style={{ color: 'oklch(0.75 0.18 25)', fontSize: 13, marginTop: 8 }}>Error: {error}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        {(o.estado === 'borrador' || o.estado === 'enviada') && !cancelando && <button onClick={() => setCancelando(true)} className="clientes-glass-btn btn-secondary"><div className="clientes-glass-bg" /><span className="clientes-glass-content">Cancelar orden</span></button>}
        {cancelando && <button onClick={() => accion(() => window.api.compras.cancelar(o.id, { motivo }), 'Orden cancelada')} className="clientes-glass-btn btn-secondary"><div className="clientes-glass-bg" /><span className="clientes-glass-content">Confirmar cancelación</span></button>}
        {o.estado === 'borrador' && <button onClick={() => accion(() => window.api.compras.enviar(o.id), 'Orden enviada')} className="clientes-glass-btn btn-primary"><div className="clientes-glass-bg" /><span className="clientes-glass-content">Marcar como enviada</span></button>}
        {puedeRecibir && <button onClick={() => accion(() => window.api.compras.recibir(o.id, { lineas: Object.entries(recibir).filter(([, v]) => Number(v) > 0).map(([lid, v]) => ({ linea_id: Number(lid), cantidad: Number(v) })) }), 'Mercadería recibida: stock y costo actualizados')} className="clientes-glass-btn btn-primary"><div className="clientes-glass-bg" /><span className="clientes-glass-content"><Check size={15} /> Recibir mercadería</span></button>}
      </div>
    </Modal>
  )
}

function TabCompras() {
  const [lista, setLista] = useState([])
  const [sugeridos, setSugeridos] = useState(null)
  const [form, setForm] = useState(null)       // { simple, inicial }
  const [detalle, setDetalle] = useState(null)
  const [error, setError] = useState('')
  async function cargar() {
    const r = await window.api.compras.getAll()
    if (r && r.ok === false) { setError(r.error || 'No se pudieron cargar las compras'); return }
    setLista(r || [])
  }
  useEffect(() => { cargar() }, [])
  async function verSugerencias() {
    const r = await window.api.compras.sugerirReposicion()
    if (r && r.ok === false) { setError(r.error); return }
    setSugeridos(r || [])
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <button onClick={() => setForm({ simple: true })} className="clientes-glass-btn btn-primary"><div className="clientes-glass-bg" /><span className="clientes-glass-content"><Plus size={15} /> Registrar compra</span></button>
        <button onClick={() => setForm({ simple: false })} className="clientes-glass-btn btn-secondary"><div className="clientes-glass-bg" /><span className="clientes-glass-content"><Plus size={15} /> Nueva orden de compra</span></button>
        <button onClick={verSugerencias} className="clientes-glass-btn btn-secondary"><div className="clientes-glass-bg" /><span className="clientes-glass-content">Qué conviene reponer</span></button>
      </div>
      {error && <p role="alert" style={{ color: 'oklch(0.75 0.18 25)', fontSize: 13 }}>Error: {error}</p>}
      {sugeridos && (
        <section aria-label="Reposición sugerida" style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
          <strong style={{ fontSize: 14, color: 'var(--ink)' }}>Reposición sugerida</strong>
          {sugeridos.length === 0 ? <p role="status" style={{ fontSize: 13, color: 'var(--dim)' }}>Ningún producto está en su punto de reorden. Define el punto de reorden de cada producto al editarlo.</p> : (
            <>
              {sugeridos.map(s => <div key={s.producto_id} style={{ fontSize: 13, color: 'var(--ink)', padding: '3px 0' }}>{s.nombre}: hay {s.stock}, punto de reorden {s.punto_reorden} → sugerido <strong>{s.sugerido}</strong></div>)}
              <button onClick={() => setForm({ simple: false, inicial: sugeridos.map(s => ({ producto_id: String(s.producto_id), cantidad: String(s.sugerido), costo_unitario: s.ultimo_costo != null ? String(s.ultimo_costo) : '' })) })} className="clientes-glass-btn btn-primary" style={{ marginTop: 8 }}><div className="clientes-glass-bg" /><span className="clientes-glass-content">Crear orden con estos productos</span></button>
            </>
          )}
        </section>
      )}
      {lista.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--dim)' }}>Todavía no hay compras registradas</div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, color: 'var(--ink)' }}>
          <thead><tr style={{ textAlign: 'left', color: 'var(--dim)' }}><th scope="col">N°</th><th scope="col">Fecha</th><th scope="col">Proveedor</th><th scope="col">Estado</th><th scope="col">Total (Bs.)</th><th scope="col">Acciones</th></tr></thead>
          <tbody>
            {lista.map(o => (
              <tr key={o.id} style={{ borderTop: '1px solid var(--line)' }}>
                <td>#{o.id}</td><td>{o.fecha}</td><td>{o.proveedor_nombre || '—'}</td><td>{ESTADOS_COMPRA[o.estado] || o.estado}{o.tipo === 'simple' ? ' (compra directa)' : ''}</td><td>{Number(o.total).toFixed(2)}</td>
                <td><button onClick={() => setDetalle(o.id)} aria-label={`Ver la compra ${o.id}`} className="clientes-glass-btn btn-secondary"><div className="clientes-glass-bg" /><span className="clientes-glass-content">Ver</span></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {form && <FormCompra simple={form.simple} inicial={form.inicial} onClose={() => setForm(null)} onHecho={() => { setForm(null); cargar() }} />}
      {detalle && <DetalleCompra id={detalle} onClose={() => setDetalle(null)} onCambio={cargar} />}
    </div>
  )
}

function TabConteo() {
  const { tienePermiso } = useAuth()
  const puedeAprobar = tienePermiso('inventario.aprobar_ajustes')
  const confirmar = useConfirm()
  const [lista, setLista] = useState([])
  const [abierto, setAbierto] = useState(null)
  const [valores, setValores] = useState({})
  const [categorias, setCategorias] = useState([])
  const [categoria, setCategoria] = useState('')
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function cargarLista() { setLista((await window.api.conteos.getAll()) || []) }
  async function abrirConteo(id) {
    setError('')
    const c = await window.api.conteos.getById(id)
    if (c && c.ok === false) { setError(c.error || 'No se pudo abrir el conteo'); return }
    setAbierto(c)
    setValores(Object.fromEntries((c.lineas || []).map(l => [l.producto_id, l.contado === null || l.contado === undefined ? '' : String(l.contado)])))
  }
  useEffect(() => { cargarLista(); window.api.inventario.getCategorias().then(d => setCategorias(d || [])) }, [])

  async function ejecutar(fn, mensajeOk, recargarId) {
    setError(''); setOcupado(true)
    const r = await fn()
    setOcupado(false)
    if (r && r.ok === false) { setError(r.error || 'No se pudo completar la acción'); return false }
    if (mensajeOk) toast.success(mensajeOk)
    await cargarLista()
    if (recargarId) await abrirConteo(recargarId); else setAbierto(null)
    return true
  }
  async function nuevo() {
    setError(''); setOcupado(true)
    const r = await window.api.conteos.abrir({ categoria_id: categoria ? Number(categoria) : undefined, nota: nota || undefined })
    setOcupado(false)
    if (r && r.ok === false) { setError(r.error || 'No se pudo abrir el conteo'); return }
    setNota(''); await cargarLista(); await abrirConteo(r.conteo_id)
  }
  function itemsGuardar() {
    return Object.entries(valores).filter(([, v]) => v !== '').map(([pid, v]) => ({ producto_id: Number(pid), contado: Number(v) }))
  }
  async function guardar() {
    const items = itemsGuardar()
    if (!items.length) { setError('Escribe al menos una cantidad contada.'); return false }
    return ejecutar(() => window.api.conteos.registrar(abierto.id, items), 'Conteo guardado', abierto.id)
  }
  async function cerrarConteo() {
    const items = itemsGuardar()
    if (items.length) { const r = await window.api.conteos.registrar(abierto.id, items); if (r && r.ok === false) { setError(r.error); return } }
    ejecutar(() => window.api.conteos.cerrar(abierto.id), 'Conteo cerrado', abierto.id)
  }
  async function aprobar() {
    const ok = await confirmar({ titulo: '¿Aprobar el conteo?', mensaje: 'Se ajustará el stock de los productos con diferencia y quedará registrado como «Inventario físico».', tipo: 'advertencia', textoConfirmar: 'Aprobar y ajustar' })
    if (ok) ejecutar(() => window.api.conteos.aprobar(abierto.id), 'Conteo aprobado: stock ajustado', abierto.id)
  }
  async function cancelar() {
    const ok = await confirmar({ titulo: '¿Cancelar el conteo?', mensaje: 'No se cambia ningún stock.', tipo: 'advertencia', textoConfirmar: 'Cancelar conteo' })
    if (ok) ejecutar(() => window.api.conteos.cancelar(abierto.id), 'Conteo cancelado')
  }
  async function revertir() {
    const ok = await confirmar({ titulo: '¿Revertir el conteo?', mensaje: 'Se registrarán movimientos inversos que deshacen los ajustes (el historial no se borra).', tipo: 'advertencia', textoConfirmar: 'Revertir' })
    if (ok) ejecutar(() => window.api.conteos.revertir(abierto.id), 'Conteo revertido', abierto.id)
  }
  const Boton = ({ onClick, children, primario, ...rest }) => (
    <button onClick={onClick} disabled={ocupado} className={`clientes-glass-btn ${primario ? 'btn-primary' : 'btn-secondary'}`} {...rest}>
      <div className="clientes-glass-bg" /><span className="clientes-glass-content">{children}</span>
    </button>
  )

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 12 }}>
        Cuenta lo que hay en el estante sin ver lo que dice el sistema. Al aprobar, el stock queda en <strong>lo contado más los movimientos posteriores a la apertura del conteo</strong> (por ejemplo, ventas hechas mientras se contaba).
      </p>
      {error && <p role="alert" data-testid="conteo-error" style={{ color: 'oklch(0.75 0.18 25)', fontSize: 13, marginBottom: 10 }}>Error: {error}</p>}
      {!abierto && (<>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--dim)' }}>Categoría (opcional)
            <select className="gym-input" aria-label="Categoría a contar" value={categoria} onChange={e => setCategoria(e.target.value)} style={{ display: 'block', minWidth: 180 }}>
              <option value="">Todos los productos</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: 'var(--dim)' }}>Nota (opcional)
            <input className="gym-input" aria-label="Nota del conteo" value={nota} onChange={e => setNota(e.target.value)} style={{ display: 'block', minWidth: 220 }} />
          </label>
          <Boton primario onClick={nuevo} data-testid="nuevo-conteo"><Plus size={14} /> Nuevo conteo</Boton>
        </div>
        {lista.length === 0 ? <p style={{ color: 'var(--dim)' }}>Todavía no hay conteos.</p> : lista.map(c => (
          <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--line)', fontSize: 13, color: 'var(--ink)' }}>
            <span style={{ flex: 1 }}>Conteo #{c.id} · {fmtDate(c.fecha_apertura)}{c.nota ? ` · ${c.nota}` : ''}<br /><span style={{ color: 'var(--dim)', fontSize: 12 }}>{ESTADO_CONTEO[c.estado] || c.estado} · {c.contadas}/{c.total_lineas} contados · {c.usuario_nombre || '—'}</span></span>
            <Boton onClick={() => abrirConteo(c.id)} aria-label={`Abrir el conteo ${c.id}`}>Abrir</Boton>
          </div>
        ))}
      </>)}
      {abierto && (
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
            <strong style={{ color: 'var(--ink)' }}>Conteo #{abierto.id} — {ESTADO_CONTEO[abierto.estado] || abierto.estado}</strong>
            <Boton onClick={() => { setAbierto(null); cargarLista() }} style={{ marginLeft: 'auto' }}>Volver a la lista</Boton>
          </div>
          {abierto.estado === 'borrador' && <p style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 8 }}>Conteo a ciegas: no se muestra el stock del sistema. Deja en blanco lo que no cuentes.</p>}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, color: 'var(--ink)' }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--dim)' }}>
              <th scope="col">Producto</th><th scope="col">Contado</th>
              {abierto.lineas[0] && 'diferencia' in abierto.lineas[0] && (<><th scope="col">Al abrir</th><th scope="col">Diferencia</th><th scope="col">Stock final</th></>)}
            </tr></thead>
            <tbody>
              {abierto.lineas.map(l => (
                <tr key={l.producto_id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td>{l.nombre_producto}</td>
                  <td>{abierto.estado === 'borrador'
                    ? <input type="number" min="0" step="any" className="gym-input" aria-label={`Cantidad contada de ${l.nombre_producto}`} value={valores[l.producto_id] ?? ''} onChange={e => setValores(v => ({ ...v, [l.producto_id]: e.target.value }))} style={{ width: 90, padding: '4px 6px' }} />
                    : (l.contado === null ? 'No contado' : l.contado)}</td>
                  {'diferencia' in l && (<>
                    <td>{l.stock_sistema_congelado}</td>
                    <td>{l.diferencia === null ? '—' : <strong>{l.diferencia > 0 ? `+${l.diferencia} (sobra)` : l.diferencia < 0 ? `${l.diferencia} (falta)` : '0 (cuadra)'}</strong>}</td>
                    <td>{l.stock_final_previsto === null ? '—' : l.stock_final_previsto}</td>
                  </>)}
                </tr>
              ))}
            </tbody>
          </table>
          {abierto.estado === 'contado' && !('diferencia' in (abierto.lineas[0] || {})) && <p style={{ fontSize: 13, color: 'var(--dim)', marginTop: 8 }}>Conteo cerrado. Las diferencias las revisa quien tiene permiso para aprobar.</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            {abierto.estado === 'borrador' && (<>
              <Boton onClick={guardar} data-testid="guardar-conteo">Guardar lo contado</Boton>
              <Boton primario onClick={cerrarConteo} data-testid="cerrar-conteo"><Check size={14} /> Cerrar conteo</Boton>
            </>)}
            {(abierto.estado === 'borrador' || abierto.estado === 'contado') && <Boton onClick={cancelar}>Cancelar conteo</Boton>}
            {abierto.estado === 'contado' && puedeAprobar && <Boton primario onClick={aprobar} data-testid="aprobar-conteo"><Check size={14} /> Aprobar y ajustar stock</Boton>}
            {abierto.estado === 'aprobado' && puedeAprobar && <Boton onClick={revertir}>Revertir conteo</Boton>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Inventario() {
  const { usuario, tienePermiso: tienePermisoTabs } = useAuth()
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
    <div className="clientes-page" data-guide-id="inventario-lista" style={{ padding: '0 2px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="titulo-metalico" style={{ marginBottom: 6 }}>INVENTARIO</h1>
        <p style={{ fontSize: 14, color: 'var(--dim)' }}>Gestión de productos, categorías y proveedores</p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 20,
        background: 'oklch(0.13 0.02 250 / .34)',
        backdropFilter: 'url(#top-clientes-glass)',
        WebkitBackdropFilter: 'url(#top-clientes-glass)',
        border: '1px solid transparent',
        borderRadius: 10, padding: 4,
        boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .09), 0 0 12px 2px oklch(1 0 0 / .06), 0 10px 26px oklch(0 0 0 / .35)',
      }}>
        {TABS.filter(t => !t.permiso || tienePermisoTabs(t.permiso)).map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                background: tab === t.id ? 'oklch(1 0 0 / .1)' : 'transparent',
                border: tab === t.id ? '1px solid oklch(1 0 0 / .22)' : '1px solid transparent',
                color: tab === t.id ? 'oklch(0.97 0.01 250)' : 'var(--dim)',
                textShadow: tab === t.id ? '0 1px 2px oklch(0 0 0 / .6)' : 'none',
                cursor: 'pointer', transition: 'all .2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Icon size={14} /> {t.label}
            </button>
          )
        })}
      </div>

      {/* Contenido */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {tab === 'productos'   && <TabProductos categorias={categorias} proveedores={proveedores} usuario={usuario} />}
          {tab === 'categorias'  && <TabCategorias categorias={categorias} onRefresh={refresh} />}
          {tab === 'proveedores' && <TabProveedores proveedores={proveedores} onRefresh={refresh} />}
          {tab === 'movimientos' && <TabMovimientos />}
          {tab === 'conteo'      && <TabConteo />}
          {tab === 'compras'     && <TabCompras />}
          {tab === 'promociones' && <TabPromociones />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
