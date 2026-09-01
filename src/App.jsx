import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppProvider, useApp } from './context/AppContext'
import { PAGES } from './constants'
import TitleBar from './components/layout/TitleBar'
import Login from './pages/Login'
import CambiarPasswordModal from './pages/CambiarPassword'
import { ConfirmProvider } from './components/ui/ConfirmDialog'
import ErrorBoundary from './components/ui/ErrorBoundary'
import VideoBackground from './components/background/VideoBackground'
import { Minus, Maximize2, Minimize2, X } from 'lucide-react'

import Attendance from './pages/Attendance'
import ControlAcceso from './pages/ControlAcceso'
import GestionPlanes from './pages/admin/GestionPlanes'
import ConfiguracionPOS from './pages/admin/ConfiguracionPOS'
import Descuentos from './pages/admin/Descuentos'
import Clients from './pages/Clients'
import Memberships from './pages/Memberships'
import Dashboard from './pages/Dashboard'
import AttendanceLog from './pages/AttendanceLog'
import Alerts from './pages/Alerts'
import Income from './pages/Income'
import Settings from './pages/Settings'
import ConfiguracionFacturacion from './modules/facturacion/ConfiguracionFacturacion'
import EmitirFactura from './modules/facturacion/EmitirFactura'
import HistorialFacturas from './modules/facturacion/HistorialFacturas'
import GestionUsuarios from './pages/admin/GestionUsuarios'
import PerfilCliente from './pages/admin/PerfilCliente'
import Inventario from './pages/admin/Inventario'
import Caja from './pages/admin/Caja'
import Papelera from './pages/admin/Papelera'
import GestionModulos from './pages/admin/GestionModulos'
import Reportes from './pages/admin/Reportes'
import Ventas from './pages/admin/Ventas'
import Casilleros from './pages/admin/Casilleros'
import Auditoria from './pages/admin/Auditoria'
import Respaldos from './pages/admin/Respaldos'
import Configuracion from './pages/admin/Configuracion'
import ImportarIA from './pages/admin/ImportarIA'

function Placeholder({ nombre }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: 'oklch(0.78 0.02 250 / .35)', gap: 8 }}>
      <div style={{ fontSize: 36 }}>🚧</div>
      <div style={{ fontSize: 14 }}>{nombre} — próximamente</div>
    </div>
  )
}

const PAGE_COMPONENTS = {
  [PAGES.ATTENDANCE]:            Attendance,
  [PAGES.CONTROL_ACCESO]:        ControlAcceso,
  [PAGES.GESTION_PLANES]:        GestionPlanes,
  [PAGES.CONFIG_POS]:            ConfiguracionPOS,
  [PAGES.DESCUENTOS]:            Descuentos,
  [PAGES.CLIENTS]:               Clients,
  [PAGES.MEMBERSHIPS]:           Memberships,
  [PAGES.DASHBOARD]:             Dashboard,
  [PAGES.ATTENDANCE_LOG]:        AttendanceLog,
  [PAGES.ALERTS]:                Alerts,
  [PAGES.INCOME]:                Income,
  [PAGES.SETTINGS]:              Settings,
  [PAGES.FACTURACION_CONFIG]:    ConfiguracionFacturacion,
  [PAGES.FACTURACION_EMITIR]:    EmitirFactura,
  [PAGES.FACTURACION_HISTORIAL]: HistorialFacturas,
  [PAGES.GESTION_USUARIOS]:      GestionUsuarios,
  [PAGES.PERFIL_CLIENTE]:        PerfilCliente,
  [PAGES.CAJA]:                  Caja,
  [PAGES.INVENTARIO]:            Inventario,
  [PAGES.PAPELERA]:              Papelera,
  [PAGES.VENTAS]:                Ventas,
  [PAGES.CASILLEROS]:            Casilleros,
  [PAGES.REPORTES]:              Reportes,
  [PAGES.AUDITORIA]:             Auditoria,
  [PAGES.GESTION_MODULOS]:       GestionModulos,
  [PAGES.RESPALDOS]:             Respaldos,
  [PAGES.CONFIGURACION]:         Configuracion,
  [PAGES.IA_IMPORTAR]:           ImportarIA,
}

function PageContainer() {
  const { page } = useApp()
  const Component = PAGE_COMPONENTS[page] || ControlAcceso

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={page}
        className="page-content"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <ErrorBoundary key={page}>
          <Component />
        </ErrorBoundary>
      </motion.div>
    </AnimatePresence>
  )
}

function AppInner() {
  return (
    <>
      <VideoBackground />
      <div className="app-layout">
        <TitleBar />
        <div className="main-layout">
          <PageContainer />
        </div>
      </div>
    </>
  )
}

function LoadingScreen() {
  return (
    <>
      <div className="bg-atmospheric" />
      <div style={{
        position: 'fixed', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 10,
        flexDirection: 'column', gap: 16,
      }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{
            width: 36, height: 36,
            border: '3px solid oklch(0.66 0.22 25 / .2)',
            borderTopColor: 'oklch(0.66 0.22 25)',
            borderRadius: '50%',
          }}
        />
        <span style={{ color: 'oklch(0.78 0.02 250 / .4)', fontSize: 13, letterSpacing: '.08em' }}>
          Iniciando...
        </span>
      </div>
    </>
  )
}

// ─── Barra de ventana mínima (para login/loading) ────────────────────────────

function MinimalWindowBar() {
  const [isMax, setIsMax] = useState(false)
  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, zIndex: 99999,
      display: 'flex', WebkitAppRegion: 'no-drag',
    }}>
      <button className="winbtn11" title="Minimizar" onClick={() => window.api?.minimize?.()}>
        <Minus size={13} strokeWidth={1.8} />
      </button>
      <button className="winbtn11" title={isMax ? 'Restaurar' : 'Maximizar'} onClick={() => { window.api?.maximize?.(); setIsMax(v => !v) }}>
        {isMax ? <Minimize2 size={12} strokeWidth={1.8} /> : <Maximize2 size={12} strokeWidth={1.8} />}
      </button>
      <button className="winbtn11 winbtn11-close" title="Cerrar" onClick={() => window.api?.close?.()}>
        <X size={13} strokeWidth={1.8} />
      </button>
    </div>
  )
}

// ─── Sincronización modo login↔app con el resize de la ventana ─────────────
// El resize nativo (win.setSize en main.cjs) es instantáneo, pero el swap
// de layout (Login <-> AppInner) y el reflow de React no lo son — si pasan
// desacoplados se ve un instante de "pantalla dividida" (tamaño nuevo +
// layout viejo, o viceversa). Acá el swap de `displayMode` (lo que decide
// qué layout se pinta) y la llamada a enterAppMode/enterLoginMode quedan
// tapados por una cortina opaca: cortina opaca (sin transición) → 2 rAF
// para asegurar que ya pintó → recién ahí swap + resize → breve espera a
// que la ventana/layout se asienten → fade-out de la cortina.
const CURTAIN_HOLD_MS = 120
const CURTAIN_FADE_MS = 220

function useWindowModeCurtain(usuario, cargando) {
  const [displayMode, setDisplayMode] = useState(null) // 'login' | 'app' | null
  const [curtainOpaque, setCurtainOpaque] = useState(false)
  const [curtainInstant, setCurtainInstant] = useState(false)
  const prevModeRef = useRef(null)

  useEffect(() => {
    if (cargando) return
    const nextMode = usuario ? 'app' : 'login'

    if (prevModeRef.current === null) {
      // Primera resolución tras el loading — todavía no se pintó ningún
      // layout, no hace falta cortina para esto.
      prevModeRef.current = nextMode
      setDisplayMode(nextMode)
      if (nextMode === 'app') window.api?.enterAppMode?.()
      return
    }

    if (prevModeRef.current === nextMode) return
    prevModeRef.current = nextMode

    let cancelado = false
    setCurtainInstant(true)
    setCurtainOpaque(true)

    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelado) return
        setDisplayMode(nextMode)
        if (nextMode === 'app') window.api?.enterAppMode?.()
        else window.api?.enterLoginMode?.()

        setTimeout(() => {
          if (cancelado) return
          setCurtainInstant(false)
          setCurtainOpaque(false)
        }, CURTAIN_HOLD_MS)
      })
    })

    return () => { cancelado = true; cancelAnimationFrame(raf1) }
  }, [usuario, cargando])

  return { displayMode, curtainOpaque, curtainInstant }
}

function ModeCurtain({ opaque, instant }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 999999,
        background: '#060709',
        opacity: opaque ? 1 : 0,
        transition: instant ? 'none' : `opacity ${CURTAIN_FADE_MS}ms ease`,
        pointerEvents: opaque ? 'auto' : 'none',
      }}
    />
  )
}

function AppRoot() {
  const { usuario, cargando } = useAuth()
  const { displayMode, curtainOpaque, curtainInstant } = useWindowModeCurtain(usuario, cargando)

  if (cargando || displayMode === null) return (
    <>
      <MinimalWindowBar />
      <LoadingScreen />
    </>
  )

  return (
    <>
      {displayMode === 'login' ? (
        <>
          <MinimalWindowBar />
          <Login />
        </>
      ) : (
        <AppProvider>
          <AppInner />
          {/* Modal de cambio obligatorio de contraseña en primer login */}
          <AnimatePresence>
            {usuario?.primer_login && (
              <CambiarPasswordModal
                obligatorio
                usuario={usuario}
                onCerrar={() => {}}
              />
            )}
          </AnimatePresence>
        </AppProvider>
      )}
      <ModeCurtain opaque={curtainOpaque} instant={curtainInstant} />
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <AppRoot />
      </ConfirmProvider>
    </AuthProvider>
  )
}
