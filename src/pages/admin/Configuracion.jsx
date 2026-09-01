import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, Puzzle, Users, CreditCard, HardDrive, Receipt,
  Shield, Info, ChevronRight, ArrowLeft, Lock, Save, FileText, Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'
import '../Clients.css'
import { useApp } from '../../context/AppContext'
import { PAGES } from '../../constants'
import GestionModulos from './GestionModulos'
import GestionUsuarios from './GestionUsuarios'
import ConfiguracionPOS from './ConfiguracionPOS'
import Respaldos from './Respaldos'
import ConfiguracionRecibos from '../../modules/recibos/ConfiguracionRecibos'
import ImportarIA from './ImportarIA'

// ─── Secciones disponibles ────────────────────────────────────────────────────

const SECCIONES = [
  {
    id: 'negocio',
    icon: Building2,
    titulo: 'Negocio',
    descripcion: 'Nombre, logo, dirección y datos del gimnasio',
    color: 'oklch(0.74 0.13 250)',
  },
  {
    id: 'modulos',
    icon: Puzzle,
    titulo: 'Módulos',
    descripcion: 'Activar o desactivar funcionalidades del sistema',
    color: 'oklch(0.78 0.18 200)',
  },
  {
    id: 'usuarios',
    icon: Users,
    titulo: 'Usuarios y Roles',
    descripcion: 'Gestión de usuarios, roles y permisos',
    color: 'oklch(0.80 0.12 155)',
  },
  {
    id: 'pos',
    icon: CreditCard,
    titulo: 'Punto de Venta y Pagos',
    descripcion: 'QR de pago, métodos activos y opciones de cobro',
    color: 'oklch(0.82 0.14 75)',
  },
  {
    id: 'respaldos',
    icon: HardDrive,
    titulo: 'Respaldos y Datos',
    descripcion: 'Crear y restaurar respaldos, datos de prueba',
    color: 'oklch(0.75 0.18 25)',
  },
  {
    id: 'facturacion',
    icon: Receipt,
    titulo: 'Facturación Electrónica',
    descripcion: 'Configuración SFE Bolivia (NIT, certificado, credenciales)',
    color: 'oklch(0.82 0.14 75)',
  },
  {
    id: 'recibos',
    icon: FileText,
    titulo: 'Recibos',
    descripcion: 'Comprobante de pago (no fiscal), formato y opciones',
    color: 'oklch(0.78 0.16 155)',
  },
  {
    id: 'seguridad',
    icon: Shield,
    titulo: 'Seguridad',
    descripcion: 'Cambiar contraseña y opciones de acceso',
    color: 'oklch(0.72 0.18 305)',
  },
  {
    id: 'sobre',
    icon: Info,
    titulo: 'Sobre el Sistema',
    descripcion: 'Versión, créditos y ayuda',
    color: 'oklch(0.78 0.02 250)',
  },
  {
    id: 'ia',
    icon: Sparkles,
    titulo: 'IA / Importar datos',
    descripcion: 'Asistente que lee documentos y fotos de tu inventario y los carga por vos',
    color: 'oklch(0.72 0.18 305)',
  },
]

// ─── Card de sección ──────────────────────────────────────────────────────────

function SeccionCard({ sec, onClick }) {
  const Icon = sec.icon
  return (
    <motion.button
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        position: 'relative', overflow: 'hidden',
        background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
        border: '1px solid transparent',
        borderTop: `3px solid ${sec.color}`,
        borderRadius: 14,
        padding: '20px 18px',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 12,
        textAlign: 'left', width: '100%',
        boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .07), 0 0 10px 1px oklch(1 0 0 / .04), 0 14px 34px oklch(0 0 0 / .35)',
        textShadow: '0 1px 2px rgba(0,0,0,0.6)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 42, height: 42, borderRadius: 11, flexShrink: 0,
          background: sec.color.replace(')', ' / .15)'), border: `1px solid ${sec.color.replace(')', ' / .35)')}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} color={sec.color} />
        </div>
        <ChevronRight size={16} color="oklch(0.88 0.01 250 / .85)" />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{sec.titulo}</div>
        <div style={{ fontSize: 12, color: 'oklch(0.88 0.01 250 / .85)', lineHeight: 1.5 }}>{sec.descripcion}</div>
      </div>
    </motion.button>
  )
}

// ─── Sección: Negocio ─────────────────────────────────────────────────────────

function SeccionNegocio() {
  const [form, setForm] = useState({ gym_nombre: '', gym_direccion: '', gym_telefono: '', gym_email: '', gym_nit: '', gym_horario: '' })
  const [cargado, setCargado] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useState(() => {
    window.api.pos.getConfig().then(data => {
      if (data) setForm({
        gym_nombre: data.gym_nombre || '',
        gym_direccion: data.gym_direccion || '',
        gym_telefono: data.gym_telefono || '',
        gym_email: data.gym_email || '',
        gym_nit: data.gym_nit || '',
        gym_horario: data.gym_horario || '',
      })
      setCargado(true)
    })
  })

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function guardar() {
    setGuardando(true)
    try {
      const current = await window.api.pos.getConfig()
      await window.api.pos.saveConfig({ ...current, ...form })
      toast.success('Datos del negocio guardados')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const inp = (label, key, opts = {}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{label}</label>
      <input className="gym-input" type={opts.type || 'text'} value={form[key] || ''} onChange={e => set(key, e.target.value)} placeholder={opts.placeholder} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
      <div style={{
        background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
        border: '1px solid transparent', borderRadius: 14, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14,
        boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
        textShadow: '0 1px 2px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1/-1' }}>{inp('Nombre del gimnasio *', 'gym_nombre', { placeholder: 'Gimnasio' })}</div>
          <div style={{ gridColumn: '1/-1' }}>{inp('Dirección', 'gym_direccion', { placeholder: 'Av. Principal #123' })}</div>
          {inp('Teléfono', 'gym_telefono', { placeholder: '+591 7XXXXXXX' })}
          {inp('Email', 'gym_email', { placeholder: 'contacto@gym.com' })}
          {inp('NIT', 'gym_nit', { placeholder: '0000000' })}
          {inp('Horario de atención', 'gym_horario', { placeholder: 'Lun-Vie 6:00-22:00' })}
        </div>
        <div style={{ paddingTop: 4, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={guardar} className="clientes-glass-btn btn-primary" disabled={guardando}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content"><Save size={14} /> {guardando ? 'Guardando...' : 'Guardar'}</span>
          </button>
        </div>
      </div>
      <p style={{ fontSize: 12, color: 'oklch(0.88 0.01 250 / .85)', textAlign: 'center' }}>
        Estos datos aparecen en recibos y reportes del sistema.
      </p>
    </div>
  )
}

// ─── Sección: Facturación link ────────────────────────────────────────────────

function SeccionFacturacion({ onNavigate }) {
  return (
    <div style={{ maxWidth: 500 }}>
      <div style={{
        background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
        border: '1px solid transparent', borderRadius: 14, padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 16,
        boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
        textShadow: '0 1px 2px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'oklch(0.82 0.14 75 / .15)', border: '1px solid oklch(0.82 0.14 75 / .3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Receipt size={22} color="oklch(0.82 0.14 75)" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Facturación Electrónica SFE</div>
            <div style={{ fontSize: 12, color: 'oklch(0.88 0.01 250 / .85)', marginTop: 2 }}>Normativa boliviana — Sistema de Facturación Electrónica</div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'oklch(0.88 0.01 250 / .85)', lineHeight: 1.7 }}>
          Configura tus credenciales SFE, NIT, certificado digital y opciones de facturación electrónica según la normativa boliviana.
        </p>
        <button onClick={onNavigate} className="clientes-glass-btn btn-primary">
          <div className="clientes-glass-bg" />
          <span className="clientes-glass-content"><Receipt size={15} /> Ir a Configuración de Facturación</span>
        </button>
      </div>
    </div>
  )
}

// ─── Sección: Seguridad ───────────────────────────────────────────────────────

function SeccionSeguridad() {
  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')

  async function cambiarPassword(e) {
    e.preventDefault()
    const { ok } = await window.api.auth.checkAdmin(currentPass)
    if (!ok) return toast.error('Contraseña actual incorrecta')
    if (newPass !== confirmPass) return toast.error('Las contraseñas no coinciden')
    if (newPass.length < 4) return toast.error('Mínimo 4 caracteres')
    await window.api.auth.setAdmin(newPass)
    toast.success('Contraseña cambiada correctamente')
    setCurrentPass(''); setNewPass(''); setConfirmPass('')
  }

  return (
    <div style={{ maxWidth: 460 }}>
      <div style={{
        background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
        border: '1px solid transparent', borderRadius: 14, padding: '22px 24px',
        boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
        textShadow: '0 1px 2px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ background: 'oklch(0.66 0.22 25 / .14)', border: '1px solid oklch(0.66 0.22 25 / .3)', borderRadius: 9, padding: 8 }}>
            <Lock size={18} color="oklch(0.75 0.18 25)" />
          </div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '.04em' }}>Cambiar Contraseña de Admin</h2>
        </div>
        <form onSubmit={cambiarPassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="gym-label">Contraseña actual</label>
            <input className="gym-input" type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} required />
          </div>
          <div>
            <label className="gym-label">Nueva contraseña</label>
            <input className="gym-input" type="password" value={newPass} onChange={e => setNewPass(e.target.value)} required />
          </div>
          <div>
            <label className="gym-label">Confirmar contraseña</label>
            <input className="gym-input" type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} required />
          </div>
          <button type="submit" className="clientes-glass-btn btn-primary" style={{ marginTop: 4, justifyContent: 'center' }}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content"><Save size={14} /> Cambiar contraseña</span>
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Sección: Sobre el Sistema ────────────────────────────────────────────────

function SeccionSobre() {
  return (
    <div style={{ maxWidth: 500 }}>
      <div style={{
        background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
        border: '1px solid transparent', borderRadius: 14, padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 16,
        boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
        textShadow: '0 1px 2px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'oklch(0.78 0.02 250 / .08)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Info size={22} color="var(--muted)" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Gimnasio</div>
            <div style={{ fontSize: 12, color: 'oklch(0.88 0.01 250 / .85)', marginTop: 2, fontFamily: 'Oxanium, sans-serif', letterSpacing: '.08em' }}>SISTEMA DE GESTIÓN v1.0</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            ['Versión', '1.0.0'],
            ['Módulo Facturación', 'SFE Bolivia'],
            ['Plataforma', 'Electron + React'],
            ['Base de datos', 'SQLite (sql.js)'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ fontSize: 13, color: 'oklch(0.88 0.01 250 / .85)' }}>{k}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{v}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'oklch(0.88 0.01 250 / .85)', lineHeight: 1.7, marginTop: 4 }}>
          Para soporte técnico o reportar un problema, contacta al administrador del sistema.
        </p>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Configuracion() {
  const { navigate } = useApp()
  const [seccion, setSeccion] = useState(null)

  const seccionActiva = SECCIONES.find(s => s.id === seccion)
  const Icon = seccionActiva?.icon

  return (
    <div className="clientes-page" style={{ padding: '0 2px' }}>
      <AnimatePresence mode="wait">
        {!seccion ? (
          <motion.div key="grid" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <div style={{ marginBottom: 24 }}>
              <h1 className="titulo-metalico" style={{ marginBottom: 6 }}>CONFIGURACIÓN</h1>
              <p style={{ fontSize: 13, color: 'var(--dim)' }}>Gestiona todos los aspectos del sistema desde aquí</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
              {SECCIONES.map(sec => (
                <SeccionCard key={sec.id} sec={sec} onClick={() => setSeccion(sec.id)} />
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div key={seccion} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            {/* Header con back */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
              <button
                onClick={() => setSeccion(null)}
                className="clientes-glass-btn"
                style={{ borderRadius: 999, padding: '6px 14px', fontSize: 12, flexShrink: 0 }}
              >
                <div className="clientes-glass-bg" />
                <span className="clientes-glass-content" style={{ color: 'var(--muted)' }}><ArrowLeft size={14} /> Configuración</span>
              </button>
              {Icon && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: seccionActiva.color.replace(')', ' / .15)'), border: `1px solid ${seccionActiva.color.replace(')', ' / .35)')}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} color={seccionActiva.color} />
                  </div>
                  <h1 className="titulo-metalico" style={{ margin: 0, fontSize: 20 }}>{seccionActiva.titulo.toUpperCase()}</h1>
                </div>
              )}
            </div>

            {/* Contenido de la sección */}
            {seccion === 'negocio' && <SeccionNegocio />}
            {seccion === 'modulos' && <GestionModulos />}
            {seccion === 'usuarios' && <GestionUsuarios />}
            {seccion === 'pos' && <ConfiguracionPOS />}
            {seccion === 'respaldos' && <Respaldos />}
            {seccion === 'facturacion' && <SeccionFacturacion onNavigate={() => navigate(PAGES.FACTURACION_CONFIG)} />}
            {seccion === 'recibos' && <ConfiguracionRecibos />}
            {seccion === 'seguridad' && <SeccionSeguridad />}
            {seccion === 'sobre' && <SeccionSobre />}
            {/* Mismo componente que se abre desde el TopNav (PAGES.IA_IMPORTAR)
                — un solo componente, dos puntos de entrada, ver ImportarIA.jsx */}
            {seccion === 'ia' && <ImportarIA />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
