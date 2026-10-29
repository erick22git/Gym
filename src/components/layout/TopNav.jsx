import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Users, CreditCard, LayoutDashboard,
  Receipt,
  Lock, Warehouse, BarChart2, Archive, BookOpen,
  Wallet, ShieldCheck, ShoppingBag, Settings2,
  KeyRound, Sparkles,
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
      data-guide-id={`nav-${item.key}`}
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

// ─── Barra de iconos SIEMPRE visible (B1) ──────────────────────────────────────
// Ningún zoom ni ancho oculta módulos: si no caben, el menú hace scroll horizontal con una barra propia
// (delgada pero visible; crece al pasar el mouse), rueda del mouse como scroll horizontal y degradados en los bordes.

function useBarraMenu(navRef, deps) {
  const [est, setEst] = useState({ scrollable: false, izq: false, der: false, ancho: 0, pos: 0 })
  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const medir = () => {
      const max = nav.scrollWidth - nav.clientWidth
      const scrollable = max > 1
      const pista = Math.max(0, nav.clientWidth - 16)
      const ancho = scrollable ? Math.max(36, pista * nav.clientWidth / nav.scrollWidth) : 0
      const pos = scrollable ? (pista - ancho) * (nav.scrollLeft / max) : 0
      setEst(e => (e.scrollable === scrollable && e.izq === (nav.scrollLeft > 1) && e.der === (nav.scrollLeft < max - 1) && Math.abs(e.ancho - ancho) < 0.5 && Math.abs(e.pos - pos) < 0.5)
        ? e : { scrollable, izq: nav.scrollLeft > 1, der: nav.scrollLeft < max - 1, ancho, pos })
    }
    const onWheel = e => {
      if (nav.scrollWidth <= nav.clientWidth) return
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { nav.scrollLeft += e.deltaY; e.preventDefault() }
    }
    medir()
    const ro = new ResizeObserver(medir); ro.observe(nav); if (nav.firstElementChild) ro.observe(nav.firstElementChild)
    nav.addEventListener('scroll', medir, { passive: true })
    nav.addEventListener('wheel', onWheel, { passive: false })
    return () => { ro.disconnect(); nav.removeEventListener('scroll', medir); nav.removeEventListener('wheel', onWheel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return est
}

export default function TopNav() {
  const { page, navigate } = useApp()
  const { usuario, tienePermiso } = useAuth()
  const [tooltip, setTooltip] = useState(null) // { label, rect } | null
  const menuRef = useRef(null)
  const navRef = useRef(null)

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
  const barra = useBarraMenu(navRef, [itemsFiltrados.length])

  // El módulo activo siempre queda a la vista dentro del menú
  useEffect(() => {
    const nav = navRef.current
    const btn = nav && nav.querySelectorAll('.menu-item')[activeIndex]
    if (!btn) return
    const n = nav.getBoundingClientRect(), b = btn.getBoundingClientRect()
    if (b.left < n.left + 8) nav.scrollLeft -= (n.left + 8 - b.left)
    else if (b.right > n.right - 8) nav.scrollLeft += (b.right - n.right + 8)
  }, [activeIndex, barra.scrollable])

  // Arrastrar el pulgar / clic en la pista
  function moverA(clientX, desdePulgar) {
    const nav = navRef.current; if (!nav) return
    const pista = nav.clientWidth - 16, max = nav.scrollWidth - nav.clientWidth
    const rect = nav.getBoundingClientRect()
    const x = clientX - rect.left - 8 - (desdePulgar ? barra.ancho / 2 : barra.ancho / 2)
    nav.scrollLeft = Math.max(0, Math.min(max, (x / Math.max(1, pista - barra.ancho)) * max))
  }
  function iniciarArrastre(e) {
    e.preventDefault(); e.stopPropagation()
    const move = ev => moverA(ev.clientX, true)
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }

  return (
    <>
      <div className={`topnav-caja${barra.izq ? ' mas-izq' : ''}${barra.der ? ' mas-der' : ''}`}>
        <div className="topnav" ref={navRef} role="navigation" aria-label="Módulos">
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
        {barra.scrollable && (
          <div className="topnav-barra" data-testid="topnav-barra" aria-hidden="true" onPointerDown={e => moverA(e.clientX, false)}>
            <div className="topnav-pulgar" data-testid="topnav-pulgar" style={{ width: barra.ancho, transform: `translateX(${barra.pos}px)` }} onPointerDown={iniciarArrastre} />
          </div>
        )}
      </div>

      <MenuTooltip tooltip={tooltip} />
    </>
  )
}
