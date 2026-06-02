import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Scan, Users, CreditCard, LayoutDashboard,
  Bell, Settings, Receipt, Dumbbell,
  Lock, Warehouse, BarChart2, Archive, BookOpen,
  Wallet, ShieldCheck, ShoppingBag, Settings2,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { PAGES } from '../../constants'

// ─── Definición de items del menú ─────────────────────────────────────────────

const NAV_ITEMS = [
  // Operaciones
  { section: 'Operaciones' },
  { key: PAGES.CONTROL_ACCESO, label: 'Control de Acceso', icon: ShieldCheck, permiso: 'asistencia.registrar' },
  { key: PAGES.ALERTS,         label: 'Alertas',            icon: Bell,        permiso: 'alertas.ver' },
  { key: PAGES.CAJA,           label: 'Caja',               icon: Wallet,      permiso: 'caja.ver', modulo: 'caja' },
  // Administración
  { section: 'Administración' },
  { key: PAGES.DASHBOARD,      label: 'Dashboard',    icon: LayoutDashboard, permiso: 'dashboard.ver' },
  { key: PAGES.CLIENTS,        label: 'Clientes',     icon: Users,           permiso: 'clientes.ver' },
  { key: PAGES.GESTION_PLANES, label: 'Membresías',   icon: CreditCard,      permiso: 'membresias.ver' },
  { key: PAGES.INVENTARIO,     label: 'Inventario',   icon: Warehouse,       permiso: 'inventario.ver',  modulo: 'inventario', esModulo: true },
  { key: PAGES.VENTAS,         label: 'Ventas',       icon: ShoppingBag,     permiso: 'ventas.ver',      modulo: 'ventas',     esModulo: true, moduloDep: 'inventario' },
  { key: PAGES.REPORTES,       label: 'Reportes',     icon: BarChart2,       permiso: 'reportes.ver' },
  // Sistema
  { section: 'Sistema' },
  { key: PAGES.FACTURACION_EMITIR, label: 'Facturación', icon: Receipt,   permiso: 'facturacion.ver', modulo: 'facturacion', esModulo: true },
  { key: PAGES.PAPELERA,           label: 'Papelera',    icon: Archive,   permiso: 'papelera.ver' },
  { key: PAGES.AUDITORIA,          label: 'Auditoría',   icon: BookOpen,  permiso: 'auditoria.ver' },
  { key: PAGES.CONFIGURACION,      label: 'Configuración', icon: Settings2, permiso: 'configuracion.ver' },
]

// ─── Item del menú ────────────────────────────────────────────────────────────

function NavItem({ item, isActive, colapsado, onClick }) {
  const { esModuloActivo } = useAuth()

  const moduloDesactivado = item.modulo && !esModuloActivo(item.modulo)
  const moduloDepDesactivado = item.moduloDep && !esModuloActivo(item.moduloDep)
  const bloqueado = moduloDesactivado || moduloDepDesactivado
  const Icon = item.icon

  const titulo = colapsado
    ? bloqueado ? `${item.label} (módulo desactivado)` : item.label
    : bloqueado ? 'Módulo desactivado — actívalo en Configuración' : undefined

  return (
    <button
      className={`sidebar-item${isActive ? ' active' : ''}`}
      onClick={bloqueado ? undefined : onClick}
      title={titulo}
      style={{
        opacity: bloqueado ? 0.38 : 1,
        cursor: bloqueado ? 'not-allowed' : 'pointer',
        justifyContent: colapsado ? 'center' : undefined,
        padding: colapsado ? '9px 0' : undefined,
        width: '100%',
      }}
    >
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: colapsado ? 'center' : undefined }}>
        <Icon
          size={16}
          className="nav-ico"
          style={{ color: isActive ? 'oklch(0.70 0.18 25)' : 'oklch(0.78 0.02 250 / .42)', flexShrink: 0 }}
        />
        {bloqueado && item.esModulo && (
          <Lock size={8} style={{ position: 'absolute', top: -2, right: -4, color: 'oklch(0.78 0.02 250 / .5)' }} />
        )}
      </div>

      <AnimatePresence>
        {!colapsado && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
          >
            {item.label}
            {bloqueado && item.esModulo && (
              <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.5 }}>🔒</span>
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}

// ─── Logo (clickeable para colapsar) ─────────────────────────────────────────

function LogoBox({ colapsado, onClick }) {
  if (colapsado) {
    return (
      <motion.div
        onClick={onClick}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        title="Expandir menú"
        style={{
          width: 40, height: 40, borderRadius: 10,
          overflow: 'hidden', flexShrink: 0,
          border: '1px solid oklch(0.66 0.22 25 / .4)',
          boxShadow: '0 0 16px oklch(0.66 0.22 25 / .2)',
          cursor: 'pointer',
        }}
      >
        <img
          src="/logo.jpg"
          alt="logo"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
          onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex' }}
        />
        <div style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', background: 'oklch(0.12 0.02 250)' }}>
          <Dumbbell size={20} color="oklch(0.66 0.22 25)" />
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      title="Contraer menú"
      className="sidebar-logo"
      style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }}
    >
      <div className="ring" />
      <img
        src="/logo.jpg"
        alt="Urban Fitness Club"
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: 0.92, filter: 'drop-shadow(0 0 16px oklch(0.66 0.22 25 / .5))' }}
        onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex' }}
      />
      <div className="sidebar-logo-icon" style={{ display: 'none', position: 'absolute', inset: 0, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Dumbbell size={44} strokeWidth={1.5} />
        <span className="sidebar-logo-text">URBAN FITNESS</span>
      </div>
    </motion.div>
  )
}

// ─── Sidebar principal ────────────────────────────────────────────────────────

export default function Sidebar() {
  const { page, navigate } = useApp()
  const { usuario, tienePermiso, esModuloActivo } = useAuth()

  const [colapsado, setColapsado] = useState(() => {
    try { return localStorage.getItem('sidebarCollapsed') === 'true' } catch { return false }
  })

  function toggleColapso() {
    const nuevo = !colapsado
    setColapsado(nuevo)
    try { localStorage.setItem('sidebarCollapsed', String(nuevo)) } catch {}
  }

  function debeVerItem(item) {
    if (item.section) return true
    if (!usuario) return false
    if (item.permiso && !tienePermiso(item.permiso)) return false
    return true
  }

  const itemsVisibles = NAV_ITEMS.filter(debeVerItem)

  const itemsFiltrados = itemsVisibles.filter((item, idx) => {
    if (!item.section) return true
    const siguiente = itemsVisibles.slice(idx + 1)
    return siguiente.some(it => !it.section)
  })

  return (
    <motion.nav
      className="sidebar"
      animate={{ width: colapsado ? 72 : 248 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ overflow: 'hidden', flexShrink: 0 }}
    >
      {/* Logo — clickeable para colapsar/expandir */}
      <div style={{
        display: 'flex',
        alignItems: colapsado ? 'center' : undefined,
        justifyContent: colapsado ? 'center' : undefined,
        flexShrink: 0,
        paddingBottom: 4,
      }}>
        <LogoBox colapsado={colapsado} onClick={toggleColapso} />
      </div>

      {/* Navegación */}
      <div className="sidebar-nav" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingTop: 4 }}>
        {itemsFiltrados.map((item, i) => {
          if (item.section) {
            return (
              <AnimatePresence key={i}>
                {!colapsado && (
                  <motion.div
                    className="sidebar-section"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {item.section}
                  </motion.div>
                )}
                {colapsado && (
                  <div style={{ margin: '6px 0', borderTop: '1px solid oklch(1 0 0 / .06)' }} />
                )}
              </AnimatePresence>
            )
          }

          return (
            <NavItem
              key={item.key}
              item={item}
              isActive={page === item.key}
              colapsado={colapsado}
              onClick={() => navigate(item.key)}
            />
          )
        })}
      </div>

      {/* Footer — versión */}
      <div style={{
        padding: colapsado ? '12px 0' : '12px 16px',
        borderTop: '1px solid oklch(1 0 0 / .06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: colapsado ? 'center' : undefined,
        flexShrink: 0,
      }}>
        <AnimatePresence>
          {!colapsado && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ fontSize: 10, color: 'oklch(0.78 0.02 250 / .25)', letterSpacing: '.08em', whiteSpace: 'nowrap' }}
            >
              v1.0.0
            </motion.span>
          )}
        </AnimatePresence>
        {colapsado && (
          <span style={{ fontSize: 9, color: 'oklch(0.78 0.02 250 / .2)' }}>v1</span>
        )}
      </div>
    </motion.nav>
  )
}
