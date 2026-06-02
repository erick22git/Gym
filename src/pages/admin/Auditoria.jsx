import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, Search, Filter, ChevronDown, ChevronUp,
  LogIn, LogOut, Plus, Edit3, Trash2, RefreshCw,
  ToggleRight, Package, ShieldCheck, Download, X,
} from 'lucide-react'
import { Select } from '../../components/ui/Select'
import Pagination from '../../components/ui/Pagination'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('es-BO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function fmtFechaCorta(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const ACCION_META = {
  LOGIN_EXITOSO:       { label: 'Inicio de sesión',    icon: LogIn,      color: 'oklch(0.74 0.16 155)' },
  LOGIN_FALLIDO:       { label: 'Login fallido',        icon: LogIn,      color: 'oklch(0.65 0.22 25)'  },
  LOGOUT:              { label: 'Cierre de sesión',     icon: LogOut,     color: 'oklch(0.78 0.02 250)' },
  CLIENTE_CREADO:      { label: 'Cliente creado',       icon: Plus,       color: 'oklch(0.74 0.16 155)' },
  CLIENTE_EDITADO:     { label: 'Cliente editado',      icon: Edit3,      color: 'oklch(0.74 0.13 250)' },
  CLIENTE_ELIMINADO:   { label: 'Cliente eliminado',    icon: Trash2,     color: 'oklch(0.65 0.22 25)'  },
  CLIENTE_RESTAURADO:  { label: 'Cliente restaurado',   icon: RefreshCw,  color: 'oklch(0.74 0.16 155)' },
  PLAN_CREADO:         { label: 'Plan creado',           icon: Plus,       color: 'oklch(0.74 0.16 155)' },
  PLAN_EDITADO:        { label: 'Plan editado',          icon: Edit3,      color: 'oklch(0.74 0.13 250)' },
  PLAN_ELIMINADO:      { label: 'Plan eliminado',        icon: Trash2,     color: 'oklch(0.65 0.22 25)'  },
  MEMBRESIA_CREADA:    { label: 'Membresía creada',     icon: Plus,       color: 'oklch(0.74 0.16 155)' },
  MEMBRESIA_EDITADA:   { label: 'Membresía editada',    icon: Edit3,      color: 'oklch(0.74 0.13 250)' },
  MEMBRESIA_ANULADA:   { label: 'Membresía anulada',    icon: Trash2,     color: 'oklch(0.65 0.22 25)'  },
  PRODUCTO_CREADO:     { label: 'Producto creado',      icon: Plus,       color: 'oklch(0.74 0.16 155)' },
  PRODUCTO_EDITADO:    { label: 'Producto editado',     icon: Edit3,      color: 'oklch(0.74 0.13 250)' },
  PRODUCTO_ELIMINADO:  { label: 'Producto eliminado',   icon: Trash2,     color: 'oklch(0.65 0.22 25)'  },
  STOCK_AJUSTADO:      { label: 'Stock ajustado',       icon: Package,    color: 'oklch(0.82 0.14 75)'  },
  CAJA_ABIERTA:        { label: 'Caja abierta',         icon: Plus,       color: 'oklch(0.74 0.16 155)' },
  CAJA_CERRADA:        { label: 'Caja cerrada',         icon: Trash2,     color: 'oklch(0.82 0.14 75)'  },
  MODULO_ACTIVADO:     { label: 'Módulo activado',      icon: ToggleRight, color: 'oklch(0.74 0.16 155)' },
  MODULO_DESACTIVADO:  { label: 'Módulo desactivado',   icon: ToggleRight, color: 'oklch(0.65 0.22 25)'  },
  FACTURA_EMITIDA:     { label: 'Factura emitida',      icon: Plus,       color: 'oklch(0.74 0.16 155)' },
  FACTURA_ANULADA:     { label: 'Factura anulada',      icon: Trash2,     color: 'oklch(0.65 0.22 25)'  },
  RESPALDO_CREADO:     { label: 'Respaldo creado',      icon: Download,   color: 'oklch(0.74 0.13 250)' },
  PERMISO_CAMBIADO:    { label: 'Permiso cambiado',     icon: ShieldCheck, color: 'oklch(0.82 0.14 75)' },
  USUARIO_CREADO:      { label: 'Usuario creado',       icon: Plus,       color: 'oklch(0.74 0.16 155)' },
  USUARIO_EDITADO:     { label: 'Usuario editado',      icon: Edit3,      color: 'oklch(0.74 0.13 250)' },
  USUARIO_ELIMINADO:   { label: 'Usuario eliminado',    icon: Trash2,     color: 'oklch(0.65 0.22 25)'  },
}

function accionMeta(accion) {
  return ACCION_META[accion] || { label: accion, icon: BookOpen, color: 'oklch(0.78 0.02 250)' }
}

const MODULOS_LABEL = {
  auth: 'Autenticación', clientes: 'Clientes', membresias: 'Membresías',
  planes: 'Planes', inventario: 'Inventario', caja: 'Caja', facturacion: 'Facturación',
  configuracion: 'Configuración', usuarios: 'Usuarios', papelera: 'Papelera', sistema: 'Sistema',
}

// ─── Fila de registro ─────────────────────────────────────────────────────────

function FilaRegistro({ reg }) {
  const [abierto, setAbierto] = useState(false)
  const meta = accionMeta(reg.accion)
  const Icon = meta.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'var(--glass)',
        border: '1px solid var(--line)',
        borderLeft: `3px solid ${meta.color}`,
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setAbierto(v => !v)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '10px 14px',
          display: 'grid',
          gridTemplateColumns: '28px 1fr 140px 120px 24px',
          alignItems: 'center', gap: 10, textAlign: 'left',
        }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
          background: `${meta.color}18`, border: `1px solid ${meta.color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={13} color={meta.color} />
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{meta.label}</div>
          <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 1 }}>
            {reg.usuario_nombre || 'Sistema'} · {MODULOS_LABEL[reg.modulo] || reg.modulo}
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--dim)', textAlign: 'right', lineHeight: 1.4 }}>
          {fmtFecha(reg.fecha)}
        </div>

        <div style={{ fontSize: 11, color: 'var(--dim)', textAlign: 'right' }}>
          {reg.ip_local || '—'}
        </div>

        <div style={{ color: 'var(--dim)' }}>
          {abierto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '0 14px 12px 52px',
              borderTop: '1px solid var(--line)',
              paddingTop: 10,
            }}>
              {reg.detalle ? (
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                  {reg.detalle}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--dim)', fontStyle: 'italic' }}>Sin detalles adicionales</div>
              )}
              {reg.registro_afectado_tipo && reg.registro_afectado_id && (
                <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 4 }}>
                  Registro: {reg.registro_afectado_tipo} #{reg.registro_afectado_id}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Filtros ──────────────────────────────────────────────────────────────────

function Filtros({ filtros, onChange, onLimpiar }) {
  const moduloOptions = [
    { value: '', label: 'Todos los módulos' },
    ...Object.entries(MODULOS_LABEL).map(([k, v]) => ({ value: k, label: v })),
  ]
  const accionOptions = [
    { value: '', label: 'Todas las acciones' },
    ...Object.entries(ACCION_META).map(([k, v]) => ({ value: k, label: v.label })),
  ]

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--dim)' }} />
        <input
          placeholder="Buscar usuario o detalle..."
          value={filtros.busqueda}
          onChange={e => onChange({ ...filtros, busqueda: e.target.value })}
          style={{
            width: '100%', background: 'var(--glass)', border: '1px solid var(--line)',
            borderRadius: 8, padding: '7px 10px 7px 30px', fontSize: 12, color: 'var(--ink)',
            outline: 'none',
          }}
        />
      </div>

      <div style={{ minWidth: 170 }}>
        <Select
          value={filtros.modulo}
          onChange={v => onChange({ ...filtros, modulo: v })}
          options={moduloOptions}
          placeholder="Todos los módulos"
        />
      </div>

      <div style={{ minWidth: 170 }}>
        <Select
          value={filtros.accion}
          onChange={v => onChange({ ...filtros, accion: v })}
          options={accionOptions}
          placeholder="Todas las acciones"
        />
      </div>

      <input
        type="date"
        value={filtros.desde}
        onChange={e => onChange({ ...filtros, desde: e.target.value })}
        style={{
          background: 'var(--glass)', border: '1px solid var(--line)', borderRadius: 8,
          padding: '7px 10px', fontSize: 12, color: filtros.desde ? 'var(--ink)' : 'var(--dim)',
          outline: 'none', cursor: 'pointer',
        }}
      />

      <input
        type="date"
        value={filtros.hasta}
        onChange={e => onChange({ ...filtros, hasta: e.target.value })}
        style={{
          background: 'var(--glass)', border: '1px solid var(--line)', borderRadius: 8,
          padding: '7px 10px', fontSize: 12, color: filtros.hasta ? 'var(--ink)' : 'var(--dim)',
          outline: 'none', cursor: 'pointer',
        }}
      />

      {(filtros.busqueda || filtros.modulo || filtros.accion || filtros.desde || filtros.hasta) && (
        <button
          onClick={onLimpiar}
          style={{
            background: 'oklch(0.65 0.22 25 / .12)', border: '1px solid oklch(0.65 0.22 25 / .3)',
            borderRadius: 8, padding: '7px 12px', fontSize: 12, color: 'oklch(0.75 0.15 25)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <X size={12} /> Limpiar
        </button>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

const FILTROS_VACIOS = { busqueda: '', modulo: '', accion: '', desde: '', hasta: '' }

export default function Auditoria() {
  const [registros, setRegistros] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [cargando, setCargando] = useState(true)
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)

  async function cargar(p, ps, f) {
    setCargando(true)
    try {
      const result = await window.api.auditoria.getPaginated({ ...f, page: p, pageSize: ps })
      setRegistros(result?.data || [])
      setTotal(result?.total || 0)
    } catch {
      setRegistros([])
      setTotal(0)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar(page, pageSize, filtros) }, [])

  function handleFiltros(f) {
    setFiltros(f)
    const newPage = 1
    setPage(newPage)
    cargar(newPage, pageSize, f)
  }

  const slice = registros

  return (
    <div style={{ padding: '0 2px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <h1 className="titulo-metalico" style={{ marginBottom: 6 }}>AUDITORÍA DEL SISTEMA</h1>
        <p style={{ fontSize: 13, color: 'var(--dim)' }}>
          {total} registro{total !== 1 ? 's' : ''} · Historial completo de acciones del sistema
        </p>
      </div>

      {/* Filtros */}
      <Filtros
        filtros={filtros}
        onChange={handleFiltros}
        onLimpiar={() => handleFiltros(FILTROS_VACIOS)}
      />

      {/* Lista */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      ) : slice.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--dim)', fontSize: 13 }}>
          No se encontraron registros
        </div>
      ) : (
        <>
          {/* Cabecera de columnas */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '28px 1fr 140px 120px 24px',
            gap: 10, padding: '0 14px',
            fontSize: 10, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.08em',
          }}>
            <div />
            <div>Acción / Usuario</div>
            <div style={{ textAlign: 'right' }}>Fecha y hora</div>
            <div style={{ textAlign: 'right' }}>IP</div>
            <div />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {slice.map(r => <FilaRegistro key={r.id} reg={r} />)}
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={p => { setPage(p); cargar(p, pageSize, filtros) }}
            onPageSizeChange={ps => { setPageSize(ps); setPage(1); cargar(1, ps, filtros) }}
            pageSizeOptions={[10, 25, 50]}
          />
        </>
      )}
    </div>
  )
}
