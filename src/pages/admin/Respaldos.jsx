import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HardDrive, Download, Upload, AlertTriangle,
  Clock, RefreshCw, FolderOpen, FlaskConical, Trash2, ShieldAlert,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { auditoriaService, ACCIONES } from '../../services/auditoriaService'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('es-BO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// ─── Card de acción ───────────────────────────────────────────────────────────

function ActionCard({ icon: Icon, titulo, descripcion, color, children }) {
  return (
    <div style={{
      background: 'var(--glass)',
      border: `1px solid ${color}25`,
      borderTop: `3px solid ${color}`,
      borderRadius: 14,
      padding: '22px 24px',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: `${color}18`, border: `1px solid ${color}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} color={color} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{titulo}</div>
          <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>{descripcion}</div>
        </div>
      </div>
      {children}
    </div>
  )
}

// ─── Modal confirmar restaurar ────────────────────────────────────────────────

function ModalConfirmarRestaurar({ onConfirm, onClose }) {
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
          position: 'relative', zIndex: 1, width: 440,
          background: 'oklch(0.14 0.015 250)',
          border: '1px solid oklch(0.65 0.22 25 / .4)',
          borderRadius: 16, padding: '24px 28px',
          boxShadow: '0 24px 60px oklch(0 0 0 / .5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <AlertTriangle size={20} color="oklch(0.65 0.22 25)" />
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 700, color: 'oklch(0.85 0.12 25)' }}>
            ¡Atención! Restaurar base de datos
          </h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 20 }}>
          Esta acción <strong style={{ color: 'oklch(0.85 0.12 25)' }}>reemplazará TODOS los datos actuales</strong> con los del respaldo seleccionado.
          <br /><br />
          Esta operación <strong>no se puede deshacer</strong>. El sistema se reiniciará después de restaurar.
          <br /><br />
          ¿Estás seguro de continuar?
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>Cancelar</button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700,
              background: 'oklch(0.65 0.22 25 / .2)', border: '1px solid oklch(0.65 0.22 25 / .5)',
              color: 'oklch(0.85 0.12 25)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Upload size={14} /> Restaurar ahora
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Modal Datos de Prueba — Eliminar ────────────────────────────────────────

function ModalEliminarPrueba({ conteo, onConfirm, onClose }) {
  const [texto, setTexto] = useState('')
  const confirmar = 'ELIMINAR PRUEBAS'
  const ok = texto === confirmar

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  const filas = [
    ['Clientes de prueba', conteo.clientes],
    ['Membresías de prueba', conteo.membresias],
    ['Asistencias de prueba', conteo.asistencias],
    ['Productos de prueba', conteo.productos],
    ['Ventas de prueba', conteo.ventas],
    ['Cajas de prueba', conteo.cajas],
    ['Pagos de prueba', conteo.pagos],
    ['Facturas de prueba', conteo.facturas],
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .65)', backdropFilter: 'blur(4px)' }} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
        style={{
          position: 'relative', zIndex: 1, width: 480,
          background: 'oklch(0.14 0.015 250)',
          border: '1px solid oklch(0.65 0.22 25 / .4)',
          borderRadius: 16, padding: '24px 28px',
          boxShadow: '0 24px 60px oklch(0 0 0 / .5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <AlertTriangle size={20} color="oklch(0.82 0.14 75)" />
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 700, color: 'oklch(0.90 0.10 75)' }}>
            ELIMINAR DATOS DE PRUEBA
          </h2>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
          Se eliminarán SOLO los datos generados como prueba:
        </p>
        <div style={{ background: 'oklch(0.10 0.01 250)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
          {filas.map(([label, n]) => n > 0 ? (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', padding: '3px 0', borderBottom: '1px solid oklch(1 0 0 / .04)' }}>
              <span>• {label}</span>
              <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{n.toLocaleString()}</span>
            </div>
          ) : null)}
        </div>
        <p style={{ fontSize: 12, color: 'oklch(0.74 0.16 155)', marginBottom: 14, fontWeight: 600 }}>
          Tus datos reales NO se verán afectados.
        </p>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 6 }}>
            Para confirmar escribe: <strong style={{ color: 'var(--ink)' }}>{confirmar}</strong>
          </div>
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder={confirmar}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
              background: 'oklch(0.10 0.01 250)', border: `1px solid ${ok ? 'oklch(0.65 0.22 25 / .6)' : 'var(--line)'}`,
              color: 'var(--ink)', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>Cancelar</button>
          <button
            onClick={ok ? onConfirm : undefined}
            disabled={!ok}
            style={{
              flex: 1, padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700,
              background: ok ? 'oklch(0.65 0.22 25 / .25)' : 'oklch(0.65 0.22 25 / .08)',
              border: `1px solid oklch(0.65 0.22 25 / ${ok ? '.6' : '.2'})`,
              color: ok ? 'oklch(0.85 0.12 25)' : 'var(--dim)',
              cursor: ok ? 'pointer' : 'not-allowed',
            }}
          >
            <Trash2 size={14} style={{ display: 'inline', marginRight: 6 }} />
            Eliminar Datos de Prueba
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Modal Reset Sistema ──────────────────────────────────────────────────────

function ModalResetSistema({ onConfirm, onClose }) {
  const [texto, setTexto] = useState('')
  const confirmar = 'RESETEAR TODO'
  const ok = texto === confirmar

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .70)', backdropFilter: 'blur(4px)' }} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
        style={{
          position: 'relative', zIndex: 1, width: 480,
          background: 'oklch(0.12 0.02 25)',
          border: '1px solid oklch(0.55 0.20 25 / .5)',
          borderRadius: 16, padding: '24px 28px',
          boxShadow: '0 24px 60px oklch(0 0 0 / .6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <ShieldAlert size={22} color="oklch(0.65 0.22 25)" />
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 700, color: 'oklch(0.85 0.15 25)' }}>
            RESETEAR SISTEMA COMPLETO
          </h2>
        </div>
        <div style={{ background: 'oklch(0.65 0.22 25 / .08)', border: '1px solid oklch(0.65 0.22 25 / .25)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
          <p style={{ fontSize: 12, color: 'oklch(0.85 0.12 25)', fontWeight: 600, marginBottom: 6 }}>
            Esta acción eliminará TODOS los datos operativos:
          </p>
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.8 }}>
            • Todos los clientes y membresías<br />
            • Todas las ventas e ingresos<br />
            • Todo el inventario de productos<br />
            • Todas las sesiones de caja<br />
            • Todas las facturas emitidas<br />
            • Todas las asistencias registradas
          </div>
        </div>
        <div style={{ background: 'oklch(0.74 0.16 155 / .08)', border: '1px solid oklch(0.74 0.16 155 / .2)', borderRadius: 8, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: 'oklch(0.74 0.16 155)' }}>
          Se conservarán: usuarios, roles, permisos y configuración del sistema.
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 6 }}>
            Para confirmar escribe: <strong style={{ color: 'oklch(0.85 0.15 25)' }}>{confirmar}</strong>
          </div>
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder={confirmar}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
              background: 'oklch(0.10 0.01 250)', border: `1px solid ${ok ? 'oklch(0.65 0.22 25 / .6)' : 'var(--line)'}`,
              color: 'var(--ink)', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>Cancelar</button>
          <button
            onClick={ok ? onConfirm : undefined}
            disabled={!ok}
            style={{
              flex: 1, padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700,
              background: ok ? 'oklch(0.55 0.20 25 / .3)' : 'oklch(0.55 0.20 25 / .08)',
              border: `1px solid oklch(0.55 0.20 25 / ${ok ? '.7' : '.2'})`,
              color: ok ? 'oklch(0.85 0.15 25)' : 'var(--dim)',
              cursor: ok ? 'pointer' : 'not-allowed',
            }}
          >
            <ShieldAlert size={14} style={{ display: 'inline', marginRight: 6 }} />
            Resetear Sistema Completo
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Constantes de progreso ───────────────────────────────────────────────────

const PASOS_PRUEBA = [
  'Generando 20 clientes',
  'Creando membresías activas',
  'Registrando asistencias',
  'Cargando inventario de productos',
  'Simulando ventas y caja',
  'Generando facturas simuladas',
  'Registrando auditoría',
  'Finalizando datos...',
]

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Respaldos() {
  const [respaldos, setRespaldos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [exportando, setExportando] = useState(false)
  const [restaurando, setRestaurando] = useState(false)
  const [modalRestaurar, setModalRestaurar] = useState(false)
  const [archivoRestaurar, setArchivoRestaurar] = useState(null)
  const [dbInfo, setDbInfo] = useState(null)

  // Datos de prueba
  const [conteoP, setConteoP] = useState(null)
  const [generando, setGenerando] = useState(false)
  const [pasoActivo, setPasoActivo] = useState(-1)
  const [pasosOk, setPasosOk] = useState([])
  const progresoRef = useRef(null)
  const [eliminandoP, setEliminandoP] = useState(false)
  const [modalEliminarP, setModalEliminarP] = useState(false)
  const [reseteando, setReseteando] = useState(false)
  const [modalReset, setModalReset] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [lista, info, conteo] = await Promise.all([
        window.api.respaldos.listar(),
        window.api.respaldos.info(),
        window.api.datosPrueba.contar(),
      ])
      setRespaldos(lista || [])
      setDbInfo(info || null)
      setConteoP(conteo || null)
    } catch {
      setRespaldos([])
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    if (generando) {
      setPasosOk([])
      setPasoActivo(0)
      let i = 0
      progresoRef.current = setInterval(() => {
        i++
        if (i < PASOS_PRUEBA.length) {
          setPasosOk(prev => [...prev, i - 1])
          setPasoActivo(i)
        } else {
          clearInterval(progresoRef.current)
          progresoRef.current = null
        }
      }, 380)
    } else {
      if (progresoRef.current) { clearInterval(progresoRef.current); progresoRef.current = null }
      setPasoActivo(-1)
      setPasosOk([])
    }
    return () => { if (progresoRef.current) clearInterval(progresoRef.current) }
  }, [generando])

  const hayDatosPrueba = conteoP && Object.values(conteoP).some(n => n > 0)

  async function handleGenerarPrueba() {
    setGenerando(true)
    try {
      const r = await window.api.datosPrueba.generar()
      if (r?.ok) {
        toast.success('Datos de prueba generados correctamente')
        await auditoriaService.log(ACCIONES.DATOS_PRUEBA_GENERADOS, 'configuracion', 'Datos de prueba generados')
        await cargar()
      } else {
        toast.error(r?.error || 'Error al generar datos de prueba')
      }
    } catch (e) {
      toast.error('Error al generar datos de prueba')
    } finally {
      setGenerando(false)
    }
  }

  async function handleEliminarPrueba() {
    setModalEliminarP(false)
    setEliminandoP(true)
    try {
      const r = await window.api.datosPrueba.eliminar()
      if (r?.ok) {
        toast.success('Datos de prueba eliminados. Sistema listo para producción.')
        await auditoriaService.log(ACCIONES.DATOS_PRUEBA_ELIMINADOS, 'configuracion', 'Datos de prueba eliminados')
        await cargar()
      } else {
        toast.error(r?.error || 'Error al eliminar datos de prueba')
      }
    } catch {
      toast.error('Error al eliminar datos de prueba')
    } finally {
      setEliminandoP(false)
    }
  }

  async function handleResetear() {
    setModalReset(false)
    setReseteando(true)
    try {
      const r = await window.api.datosPrueba.resetear()
      if (r?.ok) {
        toast.success('Sistema reseteado. Reiniciando...')
        await auditoriaService.log(ACCIONES.SISTEMA_RESETEADO, 'configuracion', 'Sistema reseteado completamente')
        setTimeout(() => window.api.app?.reiniciar?.(), 2500)
      } else {
        toast.error(r?.error || 'Error al resetear el sistema')
      }
    } catch {
      toast.error('Error al resetear el sistema')
    } finally {
      setReseteando(false)
    }
  }

  async function handleExportar() {
    setExportando(true)
    try {
      const resultado = await window.api.respaldos.exportar()
      if (resultado?.ok) {
        toast.success(`Respaldo guardado: ${resultado.nombre}`)
        await auditoriaService.log(ACCIONES.RESPALDO_CREADO, 'sistema', `Respaldo exportado: ${resultado.nombre}`)
        await cargar()
      } else if (resultado?.cancelado) {
        // El usuario canceló el diálogo
      } else {
        toast.error('Error al crear el respaldo')
      }
    } catch {
      toast.error('Error al crear el respaldo')
    } finally {
      setExportando(false)
    }
  }

  async function handleSeleccionarArchivo() {
    try {
      const resultado = await window.api.respaldos.seleccionarArchivo()
      if (resultado?.ruta) {
        setArchivoRestaurar(resultado)
        setModalRestaurar(true)
      }
    } catch {
      toast.error('Error al seleccionar el archivo')
    }
  }

  async function handleRestaurar() {
    if (!archivoRestaurar) return
    setModalRestaurar(false)
    setRestaurando(true)
    try {
      const resultado = await window.api.respaldos.restaurar(archivoRestaurar.ruta)
      if (resultado?.ok) {
        toast.success('Base de datos restaurada correctamente. Reiniciando...')
        setTimeout(() => window.api.app?.reiniciar?.(), 2000)
      } else {
        toast.error(resultado?.error || 'Error al restaurar la base de datos')
      }
    } catch {
      toast.error('Error al restaurar la base de datos')
    } finally {
      setRestaurando(false)
      setArchivoRestaurar(null)
    }
  }

  return (
    <div style={{ padding: '0 2px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h1 className="titulo-metalico" style={{ marginBottom: 6 }}>RESPALDOS</h1>
        <p style={{ fontSize: 13, color: 'var(--dim)' }}>
          Exporta e importa la base de datos completa del sistema
        </p>
      </div>

      {/* Info de la BD */}
      {dbInfo && (
        <div style={{
          background: 'var(--glass)', border: '1px solid var(--line)',
          borderRadius: 12, padding: '14px 18px',
          display: 'flex', gap: 24, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 3 }}>Tamaño actual</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--display)' }}>{fmtBytes(dbInfo.tamaño)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 3 }}>Último respaldo</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
              {respaldos.length > 0 ? fmtFecha(respaldos[0].fecha) : 'Nunca'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 3 }}>Total respaldos</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--display)' }}>{respaldos.length}</div>
          </div>
        </div>
      )}

      {/* Acciones */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <ActionCard
          icon={Download}
          titulo="Crear Respaldo"
          descripcion="Exporta todos los datos como archivo JSON"
          color="oklch(0.74 0.13 250)"
        >
          <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
            Se creará un archivo con todos los datos del sistema: clientes, membresías, planes, inventario, caja, reportes y configuración.
          </p>
          <button
            onClick={handleExportar}
            disabled={exportando}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 4 }}
          >
            {exportando ? (
              <><RefreshCw size={14} className="spin" /> Exportando...</>
            ) : (
              <><Download size={14} /> Exportar base de datos</>
            )}
          </button>
        </ActionCard>

        <ActionCard
          icon={Upload}
          titulo="Restaurar Respaldo"
          descripcion="Importa datos desde un archivo de respaldo"
          color="oklch(0.82 0.14 75)"
        >
          <div style={{
            background: 'oklch(0.65 0.22 25 / .08)',
            border: '1px solid oklch(0.65 0.22 25 / .2)',
            borderRadius: 8, padding: '8px 12px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'oklch(0.82 0.14 75)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
              <AlertTriangle size={11} /> Advertencia
            </div>
            <div style={{ fontSize: 11, color: 'var(--dim)', lineHeight: 1.5 }}>
              Restaurar reemplazará TODOS los datos actuales. Esta acción no se puede deshacer.
            </div>
          </div>
          <button
            onClick={handleSeleccionarArchivo}
            disabled={restaurando}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600,
              background: 'oklch(0.82 0.14 75 / .15)', border: '1px solid oklch(0.82 0.14 75 / .4)',
              color: 'oklch(0.90 0.10 75)', cursor: restaurando ? 'default' : 'pointer',
              opacity: restaurando ? 0.5 : 1, marginTop: 4,
            }}
          >
            {restaurando ? (
              <><RefreshCw size={14} className="spin" /> Restaurando...</>
            ) : (
              <><FolderOpen size={14} /> Seleccionar archivo</>
            )}
          </button>
        </ActionCard>
      </div>

      {/* Historial de respaldos */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={14} color="var(--dim)" /> Historial de respaldos
        </div>

        {cargando ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : respaldos.length === 0 ? (
          <div style={{
            background: 'var(--glass)', border: '1px solid var(--line)',
            borderRadius: 12, padding: '32px 24px', textAlign: 'center',
            color: 'var(--dim)', fontSize: 13,
          }}>
            No hay respaldos registrados todavía.
            <br />
            <span style={{ fontSize: 11, opacity: 0.7 }}>Crea tu primer respaldo con el botón de arriba.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {respaldos.map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'var(--glass)', border: '1px solid var(--line)',
                  borderRadius: 10, padding: '12px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
              >
                <HardDrive size={16} color="oklch(0.74 0.13 250)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.nombre}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 1 }}>
                    {fmtFecha(r.fecha)} · {fmtBytes(r.tamaño)}
                  </div>
                </div>
                {i === 0 && (
                  <div style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    background: 'oklch(0.74 0.16 155 / .15)', color: 'oklch(0.74 0.16 155)',
                    border: '1px solid oklch(0.74 0.16 155 / .3)',
                  }}>
                    Más reciente
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Datos de Prueba */}
      <div style={{
        background: 'var(--glass)',
        border: '1px solid oklch(0.74 0.16 155 / .25)',
        borderTop: '3px solid oklch(0.74 0.16 155)',
        borderRadius: 14, padding: '20px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'oklch(0.74 0.16 155 / .12)', border: '1px solid oklch(0.74 0.16 155 / .3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FlaskConical size={18} color="oklch(0.74 0.16 155)" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Datos de Prueba</div>
            <div style={{ fontSize: 12, color: 'var(--dim)' }}>Genera datos de ejemplo para probar el sistema antes de entregarlo al cliente</div>
          </div>
        </div>

        <div style={{
          background: 'oklch(0.82 0.14 75 / .07)', border: '1px solid oklch(0.82 0.14 75 / .2)',
          borderRadius: 8, padding: '8px 12px', marginBottom: 14,
          fontSize: 11, color: 'oklch(0.82 0.14 75)', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <AlertTriangle size={12} /> Solo para pruebas. Elimínalos antes de entregar el sistema al cliente.
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 4 }}>Estado:</div>
          {hayDatosPrueba ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {conteoP.clientes > 0 && <Chip label={`${conteoP.clientes} clientes`} />}
              {conteoP.membresias > 0 && <Chip label={`${conteoP.membresias} membresías`} />}
              {conteoP.asistencias > 0 && <Chip label={`${conteoP.asistencias} asistencias`} />}
              {conteoP.productos > 0 && <Chip label={`${conteoP.productos} productos`} />}
              {conteoP.ventas > 0 && <Chip label={`${conteoP.ventas} ventas`} />}
              {conteoP.cajas > 0 && <Chip label={`${conteoP.cajas} cajas`} />}
              {conteoP.facturas > 0 && <Chip label={`${conteoP.facturas} facturas`} />}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'oklch(0.74 0.16 155)', fontWeight: 600 }}>Sin datos de prueba</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {generando ? (
            <div style={{ padding: '8px 0' }}>
              {PASOS_PRUEBA.map((paso, i) => {
                const hecho = pasosOk.includes(i)
                const activo = pasoActivo === i
                if (i > pasoActivo) return null
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '3px 0',
                    color: hecho ? 'oklch(0.74 0.16 155)' : activo ? 'var(--ink)' : 'var(--dim)' }}>
                    {hecho
                      ? <span style={{ fontSize: 14, lineHeight: 1 }}>✓</span>
                      : <RefreshCw size={11} className="spin" />}
                    {paso}
                  </div>
                )
              })}
            </div>
          ) : (
            <button
              onClick={handleGenerarPrueba}
              disabled={hayDatosPrueba}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600,
                background: !hayDatosPrueba ? 'oklch(0.74 0.16 155 / .15)' : 'oklch(0.74 0.16 155 / .05)',
                border: `1px solid oklch(0.74 0.16 155 / ${!hayDatosPrueba ? '.45' : '.15'})`,
                color: !hayDatosPrueba ? 'oklch(0.85 0.12 155)' : 'var(--dim)',
                cursor: !hayDatosPrueba ? 'pointer' : 'not-allowed',
              }}
            >
              <FlaskConical size={14} /> Generar Datos de Prueba
            </button>
          )}

          <button
            onClick={() => setModalEliminarP(true)}
            disabled={eliminandoP || !hayDatosPrueba}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600,
              background: (hayDatosPrueba && !eliminandoP) ? 'oklch(0.65 0.22 25 / .12)' : 'oklch(0.65 0.22 25 / .04)',
              border: `1px solid oklch(0.65 0.22 25 / ${(hayDatosPrueba && !eliminandoP) ? '.4' : '.15'})`,
              color: (hayDatosPrueba && !eliminandoP) ? 'oklch(0.85 0.12 25)' : 'var(--dim)',
              cursor: (hayDatosPrueba && !eliminandoP) ? 'pointer' : 'not-allowed',
            }}
          >
            {eliminandoP ? <><RefreshCw size={14} className="spin" /> Eliminando...</> : <><Trash2 size={14} /> Eliminar Datos de Prueba</>}
          </button>
        </div>
      </div>

      {/* Zona Peligrosa */}
      <div style={{
        background: 'oklch(0.12 0.02 25)',
        border: '1px solid oklch(0.55 0.20 25 / .3)',
        borderTop: '3px solid oklch(0.55 0.20 25)',
        borderRadius: 14, padding: '20px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'oklch(0.55 0.20 25 / .12)', border: '1px solid oklch(0.55 0.20 25 / .3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldAlert size={18} color="oklch(0.65 0.22 25)" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'oklch(0.85 0.15 25)' }}>ZONA PELIGROSA</div>
            <div style={{ fontSize: 12, color: 'var(--dim)' }}>Operaciones irreversibles — solo para administradores</div>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'oklch(0.85 0.12 25)', marginBottom: 4 }}>Resetear Sistema Completo</div>
          <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, margin: 0, marginBottom: 12 }}>
            Elimina TODOS los datos operativos (clientes, membresías, ventas, inventario, cajas, facturas).
            Conserva usuarios, roles y configuración. Se recomienda crear un respaldo antes.
          </p>
          <button
            onClick={() => setModalReset(true)}
            disabled={reseteando}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 700,
              background: reseteando ? 'oklch(0.55 0.20 25 / .05)' : 'oklch(0.55 0.20 25 / .18)',
              border: `1px solid oklch(0.55 0.20 25 / ${reseteando ? '.15' : '.5'})`,
              color: reseteando ? 'var(--dim)' : 'oklch(0.85 0.15 25)',
              cursor: reseteando ? 'not-allowed' : 'pointer',
            }}
          >
            {reseteando ? <><RefreshCw size={14} className="spin" /> Reseteando...</> : <><ShieldAlert size={14} /> Resetear Sistema Completo</>}
          </button>
        </div>
      </div>

      {/* Modales */}
      <AnimatePresence>
        {modalRestaurar && (
          <ModalConfirmarRestaurar
            onClose={() => { setModalRestaurar(false); setArchivoRestaurar(null) }}
            onConfirm={handleRestaurar}
          />
        )}
        {modalEliminarP && conteoP && (
          <ModalEliminarPrueba
            conteo={conteoP}
            onClose={() => setModalEliminarP(false)}
            onConfirm={handleEliminarPrueba}
          />
        )}
        {modalReset && (
          <ModalResetSistema
            onClose={() => setModalReset(false)}
            onConfirm={handleResetear}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function Chip({ label }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
      background: 'oklch(0.74 0.16 155 / .12)', color: 'oklch(0.74 0.16 155)',
      border: '1px solid oklch(0.74 0.16 155 / .25)',
    }}>
      {label}
    </div>
  )
}
