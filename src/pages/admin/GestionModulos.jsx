import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Boxes, Receipt, Wallet, Trash2, Percent, Mail, Bell, BarChart3,
  ToggleLeft, ToggleRight, CheckCircle, AlertTriangle, X, Lock, ShoppingCart,
  PauseCircle, Cake,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { auditoriaService, ACCIONES } from '../../services/auditoriaService'

// ─── Metadata de cada módulo ──────────────────────────────────────────────────

const META = {
  inventario: {
    icon: Boxes,
    titulo: 'Inventario y Productos',
    descripcion: 'Gestión de productos, stock, categorías, proveedores y control de almacén.',
    features: ['Catálogo de productos', 'Control de stock', 'Categorías y proveedores', 'Alertas de stock bajo'],
    color: 'oklch(0.74 0.13 250)',
  },
  facturacion: {
    icon: Receipt,
    titulo: 'Facturación Electrónica SFE',
    descripcion: 'Emisión y gestión de facturas electrónicas según normativa boliviana.',
    features: ['Emitir facturas electrónicas', 'Historial de facturas', 'Anulación con notas', 'Envío por email'],
    color: 'oklch(0.82 0.14 75)',
    prerequisitos: [
      { label: 'NIT y credenciales SFE configurados', campo: 'nit' },
      { label: 'Certificado digital cargado', campo: 'certificado' },
    ],
  },
  caja: {
    icon: Wallet,
    titulo: 'Caja Diaria',
    descripcion: 'Control de apertura y cierre de caja, movimientos y diferencias.',
    features: ['Apertura y cierre de caja', 'Registro de ingresos/egresos', 'Historial de sesiones', 'Detección de diferencias'],
    color: 'oklch(0.78 0.16 155)',
  },
  papelera: {
    icon: Trash2,
    titulo: 'Papelera de Reciclaje',
    descripcion: 'Eliminación reversible de clientes, planes y productos.',
    features: ['Restaurar elementos eliminados', 'Eliminación permanente', 'Historial de eliminaciones'],
    color: 'oklch(0.75 0.18 25)',
  },
  ventas: {
    icon: ShoppingCart,
    titulo: 'Punto de Venta',
    descripcion: 'Historial y KPIs de ventas de membresías y productos. Requiere módulo Inventario activo.',
    features: ['Historial completo de ventas', 'KPIs del mes', 'Filtros por tipo y fecha', 'Integración con caja', 'Venta rápida de productos desde Control de Acceso'],
    color: 'oklch(0.78 0.18 200)',
    prerequisitos: [
      { label: 'Módulo Inventario debe estar activo', campo: 'inventario' },
    ],
  },
  promociones: {
    icon: Percent,
    titulo: 'Promociones',
    descripcion: 'Gestión de campañas y descuentos especiales por período.',
    features: ['Crear promociones con fechas', 'Descuentos automáticos', 'Reportes de uso'],
    color: 'oklch(0.80 0.12 200)',
  },
  recibos: {
    icon: Receipt,
    titulo: 'Recibos de Pago',
    descripcion: 'Comprobante simple de pago no fiscal. Se ofrece después de cada venta.',
    features: ['Recibo al completar venta', 'Formatos: carta, media carta, ticket 80mm', 'Logo y datos del gym', 'Mensaje personalizado al pie'],
    color: 'oklch(0.74 0.16 155)',
  },
}

// ─── Card de módulo ───────────────────────────────────────────────────────────

function ModuloCard({ modulo, onToggle }) {
  const meta = META[modulo.modulo] || {}
  const Icon = meta.icon || Package
  const activo = modulo.activo === 1
  const color = meta.color || 'oklch(0.74 0.13 250)'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'var(--glass)',
        border: `1px solid ${activo ? color + '35' : 'var(--line)'}`,
        borderTop: `3px solid ${activo ? color : 'transparent'}`,
        borderRadius: 14, padding: '20px 22px',
        display: 'flex', flexDirection: 'column', gap: 14,
        transition: 'border-color .3s',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: `${color}18`, border: `1px solid ${color}35`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={20} color={color} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{meta.titulo || modulo.modulo}</div>
            <div style={{ fontSize: 11, color: activo ? color : 'var(--dim)', fontWeight: 600, marginTop: 1 }}>
              {activo ? '● Activo' : '○ Inactivo'}
            </div>
          </div>
        </div>
        <button
          onClick={() => onToggle(modulo, activo)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
        >
          {activo
            ? <ToggleRight size={36} color={color} />
            : <ToggleLeft size={36} color="var(--dim)" />
          }
        </button>
      </div>

      {/* Descripción */}
      <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
        {meta.descripcion}
      </p>

      {/* Features */}
      {meta.features && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {meta.features.map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <CheckCircle size={11} color={activo ? color : 'var(--dim)'} />
              <span style={{ fontSize: 11, color: activo ? 'var(--muted)' : 'var(--dim)' }}>{f}</span>
            </div>
          ))}
        </div>
      )}

      {/* Prerequisitos */}
      {meta.prerequisitos && !activo && (
        <div style={{ background: 'oklch(0.82 0.14 75 / .08)', border: '1px solid oklch(0.82 0.14 75 / .2)', borderRadius: 8, padding: '8px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'oklch(0.82 0.14 75)', marginBottom: 4 }}>Requiere configuración previa:</div>
          {meta.prerequisitos.map(p => (
            <div key={p.campo} style={{ fontSize: 11, color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <AlertTriangle size={9} color="oklch(0.82 0.14 75)" /> {p.label}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ─── Modal confirmación desactivar ────────────────────────────────────────────

function ModalConfirmarDesactivar({ modulo, onConfirm, onClose }) {
  const meta = META[modulo.modulo] || {}

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .6)', backdropFilter: 'blur(4px)' }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'relative', zIndex: 1, width: 420,
          background: 'oklch(0.14 0.015 250)', border: '1px solid oklch(0.82 0.14 75 / .4)',
          borderRadius: 16, padding: '24px 28px',
          boxShadow: '0 24px 60px oklch(0 0 0 / .5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <AlertTriangle size={20} color="oklch(0.82 0.14 75)" />
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 700, color: 'oklch(0.90 0.10 75)' }}>
            Desactivar módulo
          </h2>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)' }}>
            <X size={16} />
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 20 }}>
          ¿Estás seguro de desactivar <strong style={{ color: 'var(--ink)' }}>{meta.titulo || modulo.modulo}</strong>?
          <br /><br />
          Los datos <strong>NO se perderán</strong>. El módulo se ocultará del menú y no estará disponible hasta que lo reactives.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>Cancelar</button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700,
              background: 'oklch(0.82 0.14 75 / .2)', border: '1px solid oklch(0.82 0.14 75 / .5)',
              color: 'oklch(0.90 0.10 75)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Lock size={14} /> Desactivar
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function GestionModulos() {
  const { usuario, actualizarModulos } = useAuth()
  const [modulos, setModulos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalDesact, setModalDesact] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const data = await window.api.modulos.getAll()
    // Ordenar por importancia
    const orden = ['caja', 'inventario', 'ventas', 'papelera', 'facturacion', 'promociones']
    const sorted = [...(data || [])].sort((a, b) => {
      const ia = orden.indexOf(a.modulo)
      const ib = orden.indexOf(b.modulo)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
    setModulos(sorted)
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function handleToggle(modulo, estaActivo) {
    if (estaActivo) {
      setModalDesact(modulo)
    } else {
      await activar(modulo)
    }
  }

  async function activar(modulo) {
    await window.api.modulos.setActivo(modulo.modulo, true, usuario?.id)
    await auditoriaService.log(ACCIONES.MODULO_ACTIVADO, 'configuracion', `Módulo "${modulo.modulo}" activado`)
    toast.success(`Módulo "${META[modulo.modulo]?.titulo || modulo.modulo}" activado`)
    await cargar()
    await actualizarModulos()
  }

  async function confirmarDesactivar() {
    const modulo = modalDesact
    setModalDesact(null)
    await window.api.modulos.setActivo(modulo.modulo, false, usuario?.id)
    await auditoriaService.log(ACCIONES.MODULO_DESACTIVADO, 'configuracion', `Módulo "${modulo.modulo}" desactivado`)
    toast(`Módulo "${META[modulo.modulo]?.titulo || modulo.modulo}" desactivado`, { icon: '⚠️' })
    await cargar()
    await actualizarModulos()
  }

  const activos = modulos.filter(m => m.activo === 1).length

  return (
    <div style={{ padding: '0 2px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="titulo-metalico" style={{ marginBottom: 6 }}>MÓDULOS DEL SISTEMA</h1>
        <p style={{ fontSize: 13, color: 'var(--dim)' }}>
          {activos} de {modulos.length} módulos activos · Activa o desactiva funcionalidades según tu negocio
        </p>
      </div>

      {cargando ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {modulos.map(m => (
            <ModuloCard key={m.id} modulo={m} onToggle={handleToggle} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {modalDesact && (
          <ModalConfirmarDesactivar
            modulo={modalDesact}
            onClose={() => setModalDesact(null)}
            onConfirm={confirmarDesactivar}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
