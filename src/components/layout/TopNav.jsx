import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Users, CreditCard, LayoutDashboard,
  Receipt,
  Lock, Warehouse, BarChart2, Archive, BookOpen,
  Wallet, ShieldCheck, ShoppingBag, Settings2,
  Menu, X, KeyRound, Sparkles,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { PAGES } from '../../constants'
import { useGlassMenu } from '../../glass-engine/useGlassMenu'

// ─── Definición de items del menú (mismo orden que el sidebar original) ──────

const NAV_ITEMS = [
  // Operaciones
  { section: 'Operaciones' },
  // menuLabel: salto de línea real SOLO en el menú horizontal (ver
  // .menu-item span:last-child{white-space:pre-line} en index.css) —
  // "Control de Acceso" en una sola línea era el ítem más ancho del
  // menú por lejos. item.label (sin el \n) se sigue usando tal cual
  // en el drawer mobile y en el title="" de bloqueado.
  { key: PAGES.CONTROL_ACCESO, label: 'Control de Acceso', menuLabel: 'Control\nde Acceso', icon: ShieldCheck, permiso: 'asistencia.registrar' },
  // Alertas ya NO es un ítem del menú (ni del drawer mobile, comparten
  // este mismo array) — la campana de notificaciones de TitleBar.jsx
  // (esquina derecha, siempre visible en cualquier breakpoint) asume
  // esa función por completo: ya navegaba a PAGES.ALERTS al hacer
  // click y ya mostraba el badge numérico, antes de este cambio.
  // PAGES.ALERTS sigue existiendo como ruta real, solo se accede desde
  // la campana en vez de desde un ítem aparte del menú.
  { key: PAGES.CAJA,           label: 'Caja',               icon: Wallet,      permiso: 'caja.ver', modulo: 'caja' },
  // Administración
  { section: 'Administración' },
  { key: PAGES.DASHBOARD,      label: 'Dashboard',    icon: LayoutDashboard, permiso: 'dashboard.ver' },
  { key: PAGES.CLIENTS,        label: 'Clientes',     icon: Users,           permiso: 'clientes.ver' },
  { key: PAGES.GESTION_PLANES, label: 'Membresías',   icon: CreditCard,      permiso: 'membresias.ver' },
  { key: PAGES.INVENTARIO,     label: 'Inventario',   icon: Warehouse,       permiso: 'inventario.ver',  modulo: 'inventario', esModulo: true },
  { key: PAGES.VENTAS,         label: 'Ventas',       icon: ShoppingBag,     permiso: 'ventas.ver',      modulo: 'ventas',     esModulo: true, moduloDep: 'inventario' },
  { key: PAGES.CASILLEROS,     label: 'Casilleros',   icon: KeyRound,        permiso: 'casilleros.ver',  modulo: 'casilleros', esModulo: true },
  { key: PAGES.REPORTES,       label: 'Reportes',     icon: BarChart2,       permiso: 'reportes.ver' },
  // Sistema
  { section: 'Sistema' },
  { key: PAGES.FACTURACION_EMITIR, label: 'Facturación', icon: Receipt,   permiso: 'facturacion.ver', modulo: 'facturacion', esModulo: true },
  { key: PAGES.PAPELERA,           label: 'Papelera',    icon: Archive,   permiso: 'papelera.ver' },
  { key: PAGES.AUDITORIA,          label: 'Auditoría',   icon: BookOpen,  permiso: 'auditoria.ver' },
  // IA / Importar datos — asistente de carga de inventario por
  // documentos/fotos (mock hoy, ver ImportarIA.jsx). Mismo permiso que
  // Configuración: quien puede configurar el sistema, puede usar el
  // asistente que escribe en el inventario.
  { key: PAGES.IA_IMPORTAR,        label: 'IA',          icon: Sparkles,  permiso: 'configuracion.ver' },
  { key: PAGES.CONFIGURACION,      label: 'Configuración', icon: Settings2, permiso: 'configuracion.ver' },
]

// ─── Tooltip flotante (portal a document.body) ────────────────────────────
// bottom:-32px de un ::after normal se recortaría acá: .topnav (el
// contenedor con scroll horizontal) tiene overflow-y:hidden, y la barra
// no tiene margen vertical de sobra para un tooltip que cuelga debajo del
// ícono. Mismo patrón que UserDropdownPortal (TitleBar.jsx) — posición
// calculada en píxeles reales desde getBoundingClientRect() del ítem
// hovereado/enfocado, fuera del árbol recortado por overflow.

function MenuTooltip({ tooltip }) {
  return createPortal(
    <AnimatePresence>
      {tooltip && (
        <motion.div
          className="menu-tooltip"
          // x:'-50%' entra en los MISMOS objetos initial/animate/exit que
          // y — framer-motion escribe UN solo transform inline (translateX
          // + translateY combinados). Si el -50% viviera en una clase CSS
          // aparte, el transform inline de la animación (solo translateY)
          // lo pisaría por completo y el tooltip quedaría descentrado.
          initial={{ opacity: 0, y: -4, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -4, x: '-50%' }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            top: tooltip.rect.bottom + 8,
            left: tooltip.rect.left + tooltip.rect.width / 2,
          }}
        >
          {tooltip.label}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

// ─── Item del menú de vidrio (desktop/tablet) ─────────────────────────────
// Estructura obligatoria del motor: <button class="menu-item"> >
// <span class="icon"><svg/></span> + <span>Texto</span> — ver
// GLASS_ENGINE_PORTABILIDAD.md. `disabled` (no solo onClick condicional)
// es lo que evita que el listener nativo de GlassMenu (bindEvents en
// core/menu.js, además del onClick de React) mueva la burbuja a un
// ítem bloqueado — un <button disabled> no dispara ningún evento click.
//
// Ícono solo por defecto — el texto permanente queda SOLO para el ítem
// activo (ya se distingue con burbuja+zoom, no necesita tooltip). Los
// demás muestran su nombre en el MenuTooltip de arriba al hover/focus.

function MenuItem({ item, index, isActive, onClick, onTooltipShow, onTooltipHide, onHoverIn }) {
  const { esModuloActivo } = useAuth()

  const moduloDesactivado = item.modulo && !esModuloActivo(item.modulo)
  const moduloDepDesactivado = item.moduloDep && !esModuloActivo(item.moduloDep)
  const bloqueado = moduloDesactivado || moduloDepDesactivado
  const Icon = item.icon

  const titulo = bloqueado ? 'Módulo desactivado — actívalo en Configuración' : undefined

  // Un solo onMouseEnter hace dos cosas independientes: muestra el
  // tooltip (ya existía) y mueve la burbuja de vidrio a este ítem (ver
  // hoverAt en useGlassMenu/core/menu.js) — la burbuja se mueve incluso
  // en el ítem activo (inofensivo, ya está ahí) para no tener que
  // distinguir casos. onMouseLeave del ítem SOLO oculta el tooltip; la
  // burbuja vuelve al activo recién al salir de TODO el menú (ver
  // onMouseLeave en .glass-menu, TopNav()), no ítem por ítem — si no,
  // "saltaría" de vuelta al activo por una fracción de segundo cada vez
  // que el mouse cruza el gap entre dos íconos vecinos.
  function mostrarTooltip(e) {
    onHoverIn(index)
    if (isActive) return
    onTooltipShow(item.label, e.currentTarget.getBoundingClientRect())
  }

  return (
    <button
      className={`menu-item${isActive ? ' active' : ''}`}
      onClick={bloqueado ? undefined : onClick}
      disabled={bloqueado}
      title={titulo}
      onMouseEnter={mostrarTooltip}
      onMouseLeave={onTooltipHide}
      onFocus={mostrarTooltip}
      onBlur={onTooltipHide}
    >
      {/* Envuelve ícono+texto para que el zoom hover/activo (CSS)
          escale el conjunto, no solo el ícono — ver .menu-item-content
          en index.css. */}
      {/* [AJUSTE PUNTUAL] content-control-acceso: hook para mover
          ícono+texto COMO BLOQUE solo en este ítem específico (ver
          .menu-item-content.content-control-acceso en index.css) —
          reemplaza el ajuste anterior que solo movía el ícono. */}
      <div className={`menu-item-content${item.key === PAGES.CONTROL_ACCESO ? ' content-control-acceso' : ''}`}>
        <span className="icon">
          <Icon size={17} strokeWidth={2} />
          {bloqueado && item.esModulo && <Lock size={9} className="menu-item-lock" />}
        </span>
        {isActive && <span>{item.menuLabel || item.label}</span>}
      </div>
    </button>
  )
}

// ─── Item del drawer mobile (ícono + texto, ver .drawer-item en index.css) ───

function DrawerItem({ item, isActive, onClick }) {
  const { esModuloActivo } = useAuth()

  const moduloDesactivado = item.modulo && !esModuloActivo(item.modulo)
  const moduloDepDesactivado = item.moduloDep && !esModuloActivo(item.moduloDep)
  const bloqueado = moduloDesactivado || moduloDepDesactivado
  const Icon = item.icon

  return (
    <button
      className={`drawer-item${isActive ? ' active' : ''}`}
      onClick={bloqueado ? undefined : onClick}
      style={{
        opacity: bloqueado ? 0.38 : 1,
        cursor: bloqueado ? 'not-allowed' : 'pointer',
      }}
    >
      <Icon size={17} className="nav-ico" />
      <span>{item.label}</span>
      {bloqueado && item.esModulo && (
        <Lock size={11} style={{ marginLeft: 'auto', color: 'oklch(0.78 0.02 250 / .5)', flexShrink: 0 }} />
      )}
    </button>
  )
}

// ─── Drawer lateral (mobile <600px, via portal — ver .drawer-* en index.css) ─

function NavDrawer({ open, items, page, onNavigate, onClose }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="drawer-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="drawer-panel"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <div className="drawer-header">
              <span className="drawer-title">Menú</span>
              <button className="drawer-close" onClick={onClose} title="Cerrar">
                <X size={16} />
              </button>
            </div>
            <div className="drawer-nav">
              {items.map((item, i) => {
                if (item.section) {
                  return i === 0 ? null : <div key={`div-${i}`} className="drawer-divider" />
                }
                return (
                  <DrawerItem
                    key={item.key}
                    item={item}
                    isActive={page === item.key}
                    onClick={() => onNavigate(item.key)}
                  />
                )
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

// ─── Menú principal (vidrio líquido en desktop/tablet, hamburguesa +
// drawer sólido en mobile — el toggle entre ambos es puro CSS, ver
// src/styles/responsive.css) ───────────────────────────────────────────────

export default function TopNav() {
  const { page, navigate } = useApp()
  const { usuario, tienePermiso } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [tooltip, setTooltip] = useState(null) // { label, rect } | null
  const menuRef = useRef(null)

  function mostrarTooltip(label, rect) {
    setTooltip({ label, rect })
  }
  function ocultarTooltip() {
    setTooltip(null)
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

  // Índice del ítem activo SOLO entre los <button class="menu-item">
  // (sin contar los divisores de sección) — tiene que coincidir con
  // el orden en que GlassMenu los lee vía querySelectorAll('.menu-item')
  // en core/menu.js, para que useGlassMenu mueva la burbuja al índice
  // correcto sin importar qué disparó la navegación (click en el menú,
  // la campana de alertas, etc.).
  const botones = itemsFiltrados.filter(item => !item.section)
  const activeIndex = botones.findIndex(item => item.key === page)

  const { hoverAt, hoverRelease } = useGlassMenu(menuRef, activeIndex, { proximity: 260 })

  function handleNavigate(key) {
    navigate(key)
    setDrawerOpen(false)
  }

  return (
    <>
      <div className="topnav">
        {/* onMouseLeave acá (todo el menú), no por ítem — así la
            burbuja no "rebota" al activo por una fracción de segundo
            al cruzar el gap entre dos íconos vecinos; solo vuelve
            cuando el mouse deja el menú completo. */}
        <div className="glass-menu" data-glass="menu" ref={menuRef} onMouseLeave={hoverRelease}>
          {itemsFiltrados.map((item, i) => {
            if (item.section) {
              return i === 0 ? null : <div key={`div-${i}`} className="menu-divider" />
            }
            const botonIndex = botones.findIndex(b => b.key === item.key)
            return (
              <MenuItem
                key={item.key}
                item={item}
                index={botonIndex}
                isActive={page === item.key}
                onClick={() => { navigate(item.key); ocultarTooltip() }}
                onTooltipShow={mostrarTooltip}
                onTooltipHide={ocultarTooltip}
                onHoverIn={hoverAt}
              />
            )
          })}
        </div>
      </div>

      <button
        className="topnav-hamburger"
        onClick={() => setDrawerOpen(true)}
        title="Abrir menú"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        <Menu size={18} />
      </button>

      <NavDrawer
        open={drawerOpen}
        items={itemsFiltrados}
        page={page}
        onNavigate={handleNavigate}
        onClose={() => setDrawerOpen(false)}
      />

      <MenuTooltip tooltip={tooltip} />
    </>
  )
}
