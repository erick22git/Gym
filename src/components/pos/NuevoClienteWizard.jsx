import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { X, Check, ChevronRight, ChevronLeft, ChevronDown, CreditCard, DollarSign,
         CheckCircle, Banknote, QrCode, ArrowLeftRight, Wallet, Maximize2, Receipt, FileText, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { Select } from '../ui/Select'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { PAGES } from '../../constants'
import VistaRecibo from '../../modules/recibos/VistaRecibo'
import { waterContainer, waterCard, waterContainerReduced, waterCardReduced } from '../../animations/waterVariants'
import './NuevoClienteWizard.css'

// Propiedades de layout que van al wrapper interno (.glass-content) en
// vez de al <button> exterior — ver NcGlassButton.
const GLASS_CONTENT_LAYOUT_KEYS = ['display', 'alignItems', 'justifyContent', 'flexDirection', 'flexWrap', 'gap']
function splitGlassStyle(style = {}) {
  const content = {}, outer = {}
  for (const k in style) {
    if (GLASS_CONTENT_LAYOUT_KEYS.includes(k)) content[k] = style[k]
    else outer[k] = style[k]
  }
  return { content, outer }
}

// ─── Botón de vidrio reutilizable — misma ESTRUCTURA DOM que "INICIAR
// SESIÓN" del login (button.glass-root.glass--regular > div.glass-material
// con sus 3 glass-layer [fill/specular/rainbow] > div.glass-content con
// el texto), copiada tal cual del motor GlassMaterial (glass-engine/
// core/glass.js) — pero SIN instanciar el motor JS (useGlassButton): las
// variables --light-intensity/--rainbow-opacity/--rainbow-offset/
// --border-intensity/--press que normalmente anima glass.js en cada
// frame (siguiendo cursor/velocidad — la causa del parpadeo/brillo que
// se mueve) quedan CONGELADAS como valores fijos en CSS
// (.nc-glass-btn.glass-root en NuevoClienteWizard.css). El material
// (blur, tinte, refracción vía los mismos filtros SVG
// #glass-refraction-button/#glass-specular-button, specular, drop-shadow,
// inset box-shadow) sigue funcionando 100% vía CSS, sin reaccionar al
// cursor. className recibe TODAS las clases que ya traía cada botón
// (btn-primary/btn-secondary/nc-glass-btn/nc-glass-btn--sm/
// nc-glass-btn--active) — este wrapper solo agrega glass-root/
// glass--regular y arma el HTML interno. ──
function NcGlassButton({ children, className = '', style, ...props }) {
  const { content: contentStyle, outer: outerStyle } = splitGlassStyle(style)
  return (
    <button
      className={`glass-root glass--regular${className ? ' ' + className : ''}`}
      style={outerStyle}
      {...props}
    >
      <div className="glass-material" aria-hidden="true">
        <div className="glass-layer glass-layer--fill" />
        <div className="glass-layer glass-layer--specular" />
        <div className="glass-layer glass-layer--rainbow" />
      </div>
      <div className="glass-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', ...contentStyle }}>
        {children}
      </div>
    </button>
  )
}

// ── Indicador de pasos ────────────────────────────────────────────────────────
function StepIndicator({ paso, esGrupal }) {
  const steps = esGrupal ? ['Datos', 'Plan', 'Miembros', 'Pago'] : ['Datos', 'Plan', 'Pago']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, justifyContent: 'center', marginBottom: 28 }}>
      {steps.map((label, i) => {
        const n = i + 1
        const done = n < paso
        const active = n === paso
        return (
          <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--display)', fontWeight: 800, fontSize: 14,
                background: done ? 'var(--green)' : active ? 'var(--red)' : 'oklch(1 0 0 / .06)',
                color: done || active ? '#fff' : 'var(--dim)',
                border: active ? '2px solid oklch(0.66 0.22 25 / .6)' : '2px solid transparent',
                boxShadow: active ? '0 0 16px oklch(1 0 0 / .4)' : 'none',
                transition: 'all .3s',
              }}>
                {done ? <Check size={16} /> : n}
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.06em', color: active ? 'var(--ink)' : 'var(--dim)', textTransform: 'uppercase' }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 60, height: 2, background: done ? 'var(--green)' : 'oklch(1 0 0 / .08)', marginBottom: 18, transition: 'background .3s', marginLeft: -1, marginRight: -1 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Paso 1: Datos del cliente ─────────────────────────────────────────────────
const EXT_OPTIONS = ['LP','CB','SC','OR','PT','CH','TJ','BE','PA'].map(x => ({ value: x, label: x }))
const GENERO_OPTIONS = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
  { value: 'Otro', label: 'Otro' },
]
const SANGRE_OPTIONS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(x => ({ value: x, label: x }))

function PasoDatos({ datos, onChange, onNext, onCancel }) {
  const [errores, setErrores] = useState({})
  const [verificandoCI, setVerificandoCI] = useState(false)
  const [ciExiste, setCiExiste] = useState(false)
  const [expandido, setExpandido] = useState(false)

  const verificarCI = useCallback(async (carnet) => {
    if (!carnet || carnet.length < 6) { setCiExiste(false); return }
    setVerificandoCI(true)
    try {
      const existe = await window.api.clientes.checkCarnetExiste(carnet)
      setCiExiste(existe)
    } finally {
      setVerificandoCI(false)
    }
  }, [])

  function set(k, v) { onChange({ ...datos, [k]: v }) }

  // [CAMBIADO — dígitos faltantes ya NO bloquea] "Mínimo 6 dígitos"
  // vivía en `errs` (bloqueaba onNext) — pasa a advertencia amarilla NO
  // bloqueante (ciFaltanDigitos/telFaltanDigitos, ver inp() más abajo),
  // mismo criterio ya aplicado en Clientes (Clients.jsx). Requerido/CI
  // duplicado siguen bloqueando — eso no cambió, solo el conteo de
  // dígitos.
  async function handleNext() {
    const errs = {}
    if (!datos.nombre?.trim()) errs.nombre = 'Requerido'
    if (!datos.apellido?.trim()) errs.apellido = 'Requerido'
    if (!datos.carnet?.trim()) errs.carnet = 'Requerido'
    if (!datos.telefono?.trim()) errs.telefono = 'Requerido'
    if (ciExiste) errs.carnet = 'Ya existe un cliente con este CI'
    setErrores(errs)
    if (Object.keys(errs).length === 0) onNext()
  }

  const ciFaltanDigitos = datos.carnet?.trim().length > 0 && datos.carnet.trim().length < 6
  const telFaltanDigitos = datos.telefono?.trim().length > 0 && datos.telefono.trim().length < 8

  const inp = (label, key, opts = {}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.05em' }}>
        {label}{opts.required && <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>}
      </label>
      <input
        className="gym-input nc-input"
        type={opts.type || 'text'}
        value={datos[key] || ''}
        onChange={e => {
          set(key, e.target.value)
          if (key === 'carnet') verificarCI(e.target.value)
        }}
        placeholder={opts.placeholder}
        style={{ borderColor: errores[key] ? 'oklch(0.66 0.22 25 / .6)' : undefined }}
      />
      {/* [NUEVO — Fase 2 animaciones, punto 6] Mensajes de error/
          advertencia animados — antes aparecían/desaparecían de golpe. */}
      <AnimatePresence>
        {errores[key] && (
          <motion.span
            key="error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            style={{ fontSize: 11, color: 'oklch(0.75 0.18 25)' }}
          >
            {errores[key]}
          </motion.span>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {key === 'carnet' && ciExiste && (
          <motion.span
            key="ci-existe"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            style={{ fontSize: 11, color: 'oklch(0.75 0.18 25)' }}
          >
            Ya existe un cliente con este CI
          </motion.span>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {key === 'carnet' && !ciExiste && ciFaltanDigitos && (
          <motion.span
            key="ci-faltan-digitos"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            style={{ color: '#eab308', fontSize: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            ⚠ Ojo, te faltan dígitos
          </motion.span>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {key === 'telefono' && telFaltanDigitos && (
          <motion.span
            key="tel-faltan-digitos"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            style={{ color: '#eab308', fontSize: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            ⚠ Ojo, te faltan dígitos
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )

  const subSeccion = (titulo) => (
    <div style={{
      fontSize: 10, fontWeight: 700, color: 'var(--dim)', letterSpacing: '.14em',
      textTransform: 'uppercase', marginTop: 18, marginBottom: 10,
      paddingBottom: 6, borderBottom: '1px solid var(--line)',
    }}>
      {titulo}
    </div>
  )

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 16 }}>
        Solo lo esencial. Después puedes agregar más.
      </p>

      {/* ── Campos esenciales ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {inp('Nombre', 'nombre', { required: true })}
        {inp('Apellido', 'apellido', { required: true })}

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>{inp('CI / Carnet', 'carnet', { required: true, placeholder: '8234567' })}</div>
          <div style={{ flexShrink: 0, width: 84 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Ext. *</label>
            <Select value={datos.extension_ci || 'CH'} onChange={v => set('extension_ci', v)} options={EXT_OPTIONS} triggerClassName="nc-select-trigger" dropdownClassName="nc-select-dropdown" />
          </div>
        </div>

        {inp('Teléfono', 'telefono', { required: true, placeholder: '72881336' })}
        {inp('Fecha de nacimiento', 'fecha_nacimiento', { type: 'date' })}
      </div>

      {/* ── Botón acordeón ── */}
      <motion.button
        type="button"
        onClick={() => setExpandido(v => !v)}
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.995 }}
        style={{
          width: '100%', marginTop: 16,
          padding: '11px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: expandido ? 'oklch(1 0 0 / .05)' : 'oklch(1 0 0 / .02)',
          border: `1.5px dashed ${expandido ? 'var(--line-s)' : 'var(--line)'}`,
          borderRadius: 10, cursor: 'pointer',
          color: 'var(--muted)', fontSize: 13, fontWeight: 600,
          transition: 'all .2s',
        }}
      >
        <motion.span animate={{ rotate: expandido ? 180 : 0 }} transition={{ duration: 0.25 }} style={{ display: 'flex' }}>
          <ChevronDown size={16} />
        </motion.span>
        {expandido ? 'Ocultar datos opcionales' : '+ Más datos (opcional)'}
      </motion.button>

      {/* ── Campos opcionales accordion ── */}
      <AnimatePresence>
        {expandido && (
          <motion.div
            key="opcional"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingTop: 4 }}>
              {subSeccion('Datos personales')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {inp('Email', 'email', { placeholder: 'correo@ejemplo.com' })}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.05em' }}>Género</label>
                  <Select value={datos.genero || ''} onChange={v => set('genero', v)} options={GENERO_OPTIONS} triggerClassName="nc-select-trigger" dropdownClassName="nc-select-dropdown" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>{inp('Dirección', 'direccion')}</div>
              </div>

              {subSeccion('Contacto de emergencia')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {inp('Nombre', 'contacto_emergencia')}
                {inp('Teléfono', 'telefono_emergencia')}
              </div>

              {subSeccion('Datos médicos (importante para tu seguridad)')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.05em' }}>Tipo de sangre</label>
                  <Select value={datos.tipo_sangre || ''} onChange={v => set('tipo_sangre', v)} options={SANGRE_OPTIONS} triggerClassName="nc-select-trigger" dropdownClassName="nc-select-dropdown" />
                </div>
                <div />
                <div style={{ gridColumn: '1/-1' }}>{inp('Alergias', 'alergias', { placeholder: 'Penicilina, mariscos...' })}</div>
                <div style={{ gridColumn: '1/-1' }}>{inp('Condiciones / lesiones', 'condiciones_medicas', { placeholder: 'Lesión de rodilla, hipertensión...' })}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <NcGlassButton className="btn-secondary nc-glass-btn" onClick={onCancel}>Cancelar</NcGlassButton>
        <NcGlassButton className="btn-primary nc-glass-btn" onClick={handleNext} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          Siguiente: Plan <ChevronRight size={16} />
        </NcGlassButton>
      </div>
    </div>
  )
}

// ── Paso 2: Selección de Plan ─────────────────────────────────────────────────
function PasoPlan({ seleccion, onChange, onNext, onNextMiembros, onPlanCambio, onBack, onCancel }) {
  // [NUEVO — Fase 2 (revisada) de animaciones] mismo criterio que
  // ControlAcceso.jsx — ver waterVariants.js.
  const reduceMotion = useReducedMotion()
  const cardVariant = reduceMotion ? waterCardReduced : waterCard
  const containerVariant = reduceMotion ? waterContainerReduced : waterContainer
  const [planes, setPlanes] = useState([])
  const [descuentos, setDescuentos] = useState([])
  const [descuentoId, setDescuentoId] = useState(null)
  const [descuentoPersonalizado, setDescuentoPersonalizado] = useState('')
  const [posConfig, setPosConfig] = useState({})

  useEffect(() => {
    Promise.all([
      window.api.planes.getActive(),
      window.api.descuentos.getActive(),
      window.api.pos.getConfig(),
    ]).then(([p, d, cfg]) => {
      setPlanes(p || [])
      setDescuentos(d || [])
      setPosConfig(cfg || {})
    })
  }, [])

  const planSel = planes.find(p => String(p.id) === String(seleccion.plan_id))
  const subtotal = planSel ? planSel.precio : 0
  const descObj = descuentoId === 'personalizado'
    ? { tipo: 'porcentaje', valor: parseFloat(descuentoPersonalizado) || 0 }
    : descuentos.find(d => String(d.id) === String(descuentoId))
  const descValor = descObj
    ? descObj.tipo === 'porcentaje' ? subtotal * (descObj.valor / 100) : descObj.valor
    : 0
  const total = Math.max(0, subtotal - descValor)

  function calcFechaFin(dias) {
    const d = new Date()
    d.setDate(d.getDate() + dias)
    return d.toISOString().split('T')[0]
  }
  function formatFechaLeg(str) {
    if (!str) return ''
    return new Date(str).toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  function seleccionarPlan(plan) {
    const hoy = new Date().toISOString().split('T')[0]
    const fin = calcFechaFin(plan.duracion_dias)
    onChange({
      ...seleccion,
      plan_id: plan.id,
      plan_nombre: plan.nombre,
      plan_precio: plan.precio,
      plan_duracion: plan.duracion_dias,
      plan_capacidad: plan.capacidad || 1,
      fecha_inicio: hoy,
      fecha_fin: fin,
    })
    if (onPlanCambio) onPlanCambio(plan.capacidad || 1)
  }

  function handleNext() {
    if (!seleccion.plan_id) { toast.error('Selecciona un plan'); return }
    const maxDesc = posConfig.descuento_maximo || 50
    if (descObj && descObj.valor > maxDesc && descuentoId !== 'personalizado') {
      toast.error(`Descuento máximo permitido: ${maxDesc}%`)
      return
    }
    onChange({
      ...seleccion,
      plan_capacidad: planSel?.capacidad || 1,
      descuento_id: descuentoId !== 'personalizado' ? descuentoId : null,
      descuento_valor: descValor,
      descuento_nombre: descObj?.nombre || (descuentoId === 'personalizado' ? 'Personalizado' : null),
      subtotal,
      total,
    })
    if ((planSel?.capacidad || 1) > 1 && onNextMiembros) {
      onNextMiembros(planSel.capacidad)
    } else {
      onNext()
    }
  }

  const ICON_COLORS = ['var(--blue)', 'var(--amber)', 'var(--green)', 'var(--red)']

  return (
    <div>
      {/* Cards de planes — [CAMBIADO, Fase 2 (revisada)] entrada con
          waterContainer/waterCard (spring), reemplaza la aparición
          instantánea. whileHover/whileTap ya existían y no se tocan —
          conviven sin problema con `variants` (disparadores
          independientes de Framer Motion). */}
      <motion.div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}
        variants={containerVariant}
        initial="hidden"
        animate="visible"
      >
        {planes.map((plan, i) => {
          const activo = seleccion.plan_id === plan.id
          const caracteristicas = (() => {
            try { return JSON.parse(plan.caracteristicas || '[]') } catch { return [] }
          })()
          const planColor = plan.color || ICON_COLORS[i % ICON_COLORS.length]
          return (
            <motion.button
              key={plan.id}
              type="button"
              onClick={() => seleccionarPlan(plan)}
              variants={cardVariant}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{
                background: activo ? `${planColor}18` : 'var(--glass)',
                border: `1.5px solid ${activo ? planColor : 'var(--line)'}`,
                borderRadius: 14, padding: '16px 14px',
                cursor: 'pointer', textAlign: 'left', position: 'relative',
                boxShadow: activo ? `0 0 20px ${planColor}30` : 'none',
                transition: 'border .2s, box-shadow .2s',
              }}
            >
              {plan.tag && (
                <div style={{
                  position: 'absolute', top: -10, right: 10,
                  background: plan.tag === 'POPULAR' ? 'var(--amber)' : 'var(--red)',
                  color: '#000', fontSize: 9, fontWeight: 800, letterSpacing: '.08em',
                  padding: '3px 8px', borderRadius: 999,
                }}>
                  {plan.tag}
                </div>
              )}
              {activo && (
                <div style={{
                  position: 'absolute', top: 10, right: 10,
                  background: planColor, borderRadius: '50%', width: 20, height: 20,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check size={12} color="#fff" />
                </div>
              )}
              <div style={{ fontSize: 11, fontWeight: 700, color: planColor, letterSpacing: '.1em', marginBottom: 6 }}>
                {plan.nombre.toUpperCase()}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--display)', color: 'var(--ink)', marginBottom: 2 }}>
                Bs. {plan.precio.toFixed(0)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 10 }}>
                / {plan.duracion_dias} días
              </div>
              {caracteristicas.slice(0, 3).map((c, ci) => (
                <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                  <Check size={10} color={planColor} />
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{c}</span>
                </div>
              ))}
            </motion.button>
          )
        })}
      </motion.div>

      {/* Resumen y descuento */}
      {planSel && (
        <div className="nc-panel" style={{
          borderRadius: 12, padding: 16, marginBottom: 16,
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 12, fontFamily: 'var(--display)', letterSpacing: '.04em' }}>
            RESUMEN DE COMPRA
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{planSel.nombre} ({planSel.duracion_dias} días)</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Bs. {subtotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Inicio: Hoy</span>
            <span style={{ fontSize: 13, color: 'var(--dim)' }}>Vence: {formatFechaLeg(seleccion.fecha_fin)}</span>
          </div>

          {/* Descuento */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, display: 'block' }}>Aplicar descuento</label>
            {/* [CAMBIADO — de <select> nativo a Select custom] Un <select>
                nativo abre su lista de <option> con chrome del sistema
                operativo — no se le puede aplicar backdrop-filter (ni
                ningún CSS) a esa lista, es una limitación real del
                elemento, no algo que faltara pisar acá. Se reemplaza por
                el mismo componente Select (../ui/Select) que ya usan
                Ext./Género/Tipo de sangre, así el desplegable de
                descuento SÍ puede llevar #dropdown-glass como el resto. */}
            <div style={{ marginBottom: descuentoId === 'personalizado' ? 8 : 0 }}>
              <Select
                value={descuentoId ?? ''}
                onChange={v => { setDescuentoId(v || null); setDescuentoPersonalizado('') }}
                options={[
                  { value: '', label: 'Sin descuento' },
                  ...descuentos.map(d => ({ value: String(d.id), label: `${d.nombre} (${d.tipo === 'porcentaje' ? `${d.valor}%` : `Bs. ${d.valor}`})` })),
                  { value: 'personalizado', label: 'Personalizado (%)' },
                ]}
                triggerClassName="nc-select-trigger"
                dropdownClassName="nc-select-dropdown"
              />
            </div>
            {descuentoId === 'personalizado' && (
              <input
                className="gym-input nc-input"
                type="number" min="0" max="50" placeholder="Porcentaje de descuento"
                value={descuentoPersonalizado}
                onChange={e => setDescuentoPersonalizado(e.target.value)}
              />
            )}
          </div>

          {descValor > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--dim)' }}>Descuento</span>
              <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>- Bs. {descValor.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
            <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--display)', letterSpacing: '.04em' }}>TOTAL</span>
            <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--display)', color: 'var(--red)' }}>Bs. {total.toFixed(2)}</span>
          </div>
        </div>
      )}

      {(planSel?.capacidad || 1) > 1 && (() => {
        const extras = (planSel.capacidad || 2) - 1
        return (
          <div style={{ background: 'oklch(0.74 0.13 250 / .08)', border: '1.5px solid oklch(0.74 0.13 250 / .4)', borderRadius: 12, padding: '12px 16px', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'oklch(0.74 0.13 250 / .18)', border: '1px solid oklch(0.74 0.13 250 / .35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Users size={16} color="oklch(0.80 0.12 250)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.88 0.09 250)' }}>Plan grupal · {planSel.capacidad} personas</div>
                <div style={{ fontSize: 11, color: 'oklch(0.65 0.08 250)', marginTop: 1 }}>{extras} miembro{extras !== 1 ? 's' : ''} adicional{extras !== 1 ? 'es' : ''} · mismo vencimiento</div>
              </div>
              <span style={{ background: 'oklch(0.74 0.13 250 / .22)', border: '1px solid oklch(0.74 0.13 250 / .5)', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 800, color: 'oklch(0.80 0.12 250)' }}>+{extras}</span>
            </div>
          </div>
        )
      })()}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <NcGlassButton className="btn-secondary nc-glass-btn" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <ChevronLeft size={16} /> Atrás
        </NcGlassButton>
        <div style={{ display: 'flex', gap: 10 }}>
          <NcGlassButton className="btn-secondary nc-glass-btn" onClick={onCancel}>Cancelar</NcGlassButton>
          <NcGlassButton className="btn-primary nc-glass-btn" onClick={handleNext} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {(planSel?.capacidad || 1) > 1 ? `Agregar miembros (${(planSel.capacidad || 2) - 1})` : 'Siguiente: Pago'} <ChevronRight size={16} />
          </NcGlassButton>
        </div>
      </div>
    </div>
  )
}

// ── Paso 2.5: Miembros adicionales (solo planes grupales) ─────────────────────
function PasoMiembros({ seleccion, miembros, onChangeMiembros, onNext, onBack, onCancel }) {
  const debounceRefs = useRef({})
  const [busqMiembros, setBusqMiembros] = useState({})
  const extras = Math.max(0, (seleccion.plan_capacidad || 2) - 1)

  async function buscarMiembro(idx, carnet) {
    const nuevos = [...miembros]
    nuevos[idx] = { ...nuevos[idx], carnet }
    onChangeMiembros(nuevos)
    if (carnet.length < 3) { setBusqMiembros(p => ({ ...p, [idx]: [] })); return }
    clearTimeout(debounceRefs.current[idx])
    debounceRefs.current[idx] = setTimeout(async () => {
      const res = await window.api.clientes.search(carnet)
      setBusqMiembros(p => ({ ...p, [idx]: res || [] }))
    }, 300)
  }

  function seleccionarCliente(idx, cliente) {
    const nuevos = [...miembros]
    nuevos[idx] = { carnet: cliente.carnet, nombre: `${cliente.nombre} ${cliente.apellido}`, cliente_id: cliente.id }
    onChangeMiembros(nuevos)
    setBusqMiembros(p => ({ ...p, [idx]: [] }))
  }

  return (
    <div>
      <div style={{ background: 'oklch(0.74 0.13 250 / .08)', border: '1px solid oklch(0.74 0.13 250 / .25)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: 'oklch(0.74 0.13 250)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Users size={13} />
        Plan {seleccion.plan_nombre} · {seleccion.plan_capacidad || 2} personas · mismo vencimiento para todos
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, letterSpacing: '.06em', textTransform: 'uppercase' }}>Miembro 1 — Titular (quien paga)</div>
        <div className="nc-panel" style={{ borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--ink)' }}>
          El cliente actual ya queda como titular
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {miembros.map((m, idx) => (
          <div key={idx}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, letterSpacing: '.06em', textTransform: 'uppercase' }}>
              Miembro {idx + 2}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                <input
                  className="gym-input nc-input"
                  placeholder="Carnet / CI"
                  value={m.carnet}
                  onChange={e => buscarMiembro(idx, e.target.value)}
                  style={{ fontSize: 13 }}
                />
                {busqMiembros[idx]?.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'oklch(0.14 0.015 250)', border: '1px solid var(--line)', borderRadius: 8, zIndex: 100, maxHeight: 140, overflowY: 'auto', marginTop: 2 }}>
                    {busqMiembros[idx].map(c => (
                      <div key={c.id} onClick={() => seleccionarCliente(idx, c)}
                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--line)', fontSize: 12 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'oklch(1 0 0 / .05)'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                        {c.nombre} {c.apellido} · {c.carnet}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <input
                className="gym-input nc-input"
                placeholder="Nombre completo"
                value={m.nombre}
                onChange={e => { const n = [...miembros]; n[idx] = { ...n[idx], nombre: e.target.value, cliente_id: null }; onChangeMiembros(n) }}
                style={{ fontSize: 13 }}
              />
            </div>
            {m.cliente_id && <div style={{ fontSize: 10, color: 'oklch(0.78 0.16 155)', marginTop: 3 }}>✓ Cliente registrado encontrado</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <NcGlassButton className="btn-secondary nc-glass-btn" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <ChevronLeft size={16} /> Atrás
        </NcGlassButton>
        <div style={{ display: 'flex', gap: 10 }}>
          <NcGlassButton className="btn-secondary nc-glass-btn" onClick={onCancel}>Cancelar</NcGlassButton>
          <NcGlassButton className="btn-primary nc-glass-btn" onClick={onNext} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            Siguiente: Pago <ChevronRight size={16} />
          </NcGlassButton>
        </div>
      </div>
    </div>
  )
}

// ── Paso 3: Proceso de Cobro ──────────────────────────────────────────────────
const TODOS_METODOS = [
  { id: 'efectivo',       label: 'Efectivo',       Icon: Banknote,        color: 'oklch(0.78 0.16 155)' },
  { id: 'qr',            label: 'QR',             Icon: QrCode,          color: 'oklch(0.80 0.12 200)' },
  { id: 'tarjeta',       label: 'Tarjeta',         Icon: CreditCard,      color: 'oklch(0.74 0.13 250)' },
  { id: 'transferencia', label: 'Transferencia',   Icon: ArrowLeftRight,  color: 'oklch(0.82 0.14 75)'  },
  { id: 'mixto',         label: 'Mixto',           Icon: Wallet,          color: 'oklch(0.70 0.18 25)'  },
]

function PasoPago({ seleccion, total, onPagar, onBack, onCancel, procesando, onOverlayHijoChange }) {
  const [metodo, setMetodo] = useState('efectivo')
  const [recibido, setRecibido] = useState('')
  const [qrConfirmado, setQrConfirmado] = useState(false)
  const [qrAmpliado, setQrAmpliado] = useState(false)
  const [posConfig, setPosConfig] = useState({})
  const [metodosDisp, setMetodosDisp] = useState(TODOS_METODOS)

  // [NUEVO — mismo fix que ModalVentaRapida en ControlAcceso.jsx] El QR
  // ampliado es OTRO overlay propio (.96 blur20) que se monta por
  // encima del overlay base del wizard (.7 blur6, ver el motion.div
  // raíz de NuevoClienteWizard) — sin avisarle, ese overlay base sigue
  // ahí detrás y los dos se suman (oscurecimiento doblado). Como el
  // estado qrAmpliado vive ACÁ (PasoPago), no en el componente raíz del
  // wizard que pinta ese overlay, se avisa hacia arriba con este
  // callback para que el padre pueda apagar su propio fondo mientras
  // este hijo esté abierto.
  useEffect(() => { onOverlayHijoChange?.(qrAmpliado) }, [qrAmpliado, onOverlayHijoChange])

  useEffect(() => {
    window.api.pos.getConfig().then(cfg => {
      const c = cfg || {}
      setPosConfig(c)
      const activos = (c.metodos_pago_activos || 'efectivo,qr,tarjeta,transferencia,mixto')
        .split(',').filter(Boolean)
      const filtrados = TODOS_METODOS.filter(m => activos.includes(m.id))
      if (filtrados.length > 0) {
        setMetodosDisp(filtrados)
        if (!activos.includes(metodo)) setMetodo(filtrados[0].id)
      }
    })
  }, [])

  useEffect(() => {
    if (!qrAmpliado) return
    // Fase de captura + stopPropagation: intercepta el ESC ANTES de que
    // llegue al listener (fase burbuja) del wizard completo
    // (NuevoClienteWizard cierra con ESC incondicionalmente) — con el
    // QR ampliado abierto, ESC debe cerrar solo el QR, nunca el wizard
    // entero por debajo. Depender del orden de registro no alcanza acá
    // (el listener del wizard se registra primero, al montar); la fase
    // de captura sí garantiza el orden sin importar cuándo se registró.
    function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); setQrAmpliado(false) } }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [qrAmpliado])

  const vuelto = metodo === 'efectivo' && recibido ? Math.max(0, parseFloat(recibido) - total) : 0
  const montoRec = metodo === 'efectivo' ? parseFloat(recibido) || 0 : total
  const metodoActivo = TODOS_METODOS.find(m => m.id === metodo)

  function puedeConfirmar() {
    if (metodo === 'efectivo') return montoRec >= total
    if (metodo === 'qr') return qrConfirmado
    return true
  }

  function handlePagar() {
    const detalle = metodo === 'mixto'
      ? { efectivo: parseFloat(recibido) || 0, digital: Math.max(0, total - (parseFloat(recibido) || 0)) }
      : {}
    onPagar({ metodo_pago: metodo, monto_recibido: montoRec, vuelto, metodo_pago_detalle: detalle })
  }

  const denoms = [50, 100, 200, 500, 1000]

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Col izq: métodos de pago */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.08em', marginBottom: 12 }}>MÉTODO DE PAGO</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8, marginBottom: 16 }}>
            {metodosDisp.map(({ id, label, Icon, color }) => {
              const sel = metodo === id
              return (
                <button
                  key={id}
                  type="button"
                  className={`nc-method-btn${sel ? ' nc-method-btn--active' : ''}`}
                  onClick={() => { setMetodo(id); setRecibido(''); setQrConfirmado(false) }}
                  style={{
                    padding: '14px 8px', borderRadius: 12, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  }}
                >
                  <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 }}>
                    <Icon size={22} strokeWidth={1.8} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    {label}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Contenido según método */}
          {metodo === 'efectivo' && (
            <div className="nc-panel" style={{ borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--dim)' }}>Total a cobrar</span>
                <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--display)', color: 'var(--red)' }}>Bs. {total.toFixed(2)}</span>
              </div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Monto recibido</label>
              <input
                className="gym-input nc-input"
                type="number" min="0" step="0.5"
                value={recibido}
                onChange={e => setRecibido(e.target.value)}
                placeholder="0.00"
                style={{ fontSize: 18, marginBottom: 8 }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {denoms.map(d => (
                  <NcGlassButton key={d} type="button" className="nc-glass-btn nc-glass-btn--sm" onClick={() => setRecibido(String(d))} style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  }}>{d}</NcGlassButton>
                ))}
                <NcGlassButton type="button" className={`nc-glass-btn nc-glass-btn--sm${recibido === total.toFixed(2) ? ' nc-glass-btn--active' : ''}`} onClick={() => setRecibido(total.toFixed(2))} style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                }}>Exacto</NcGlassButton>
              </div>
              {recibido && parseFloat(recibido) >= total && (
                <div style={{ background: 'oklch(0.78 0.16 155 / .1)', border: '1px solid oklch(0.78 0.16 155 / .3)', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>Vuelto</span>
                  <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--display)', color: 'var(--green)' }}>Bs. {vuelto.toFixed(2)}</span>
                </div>
              )}
              {recibido && parseFloat(recibido) < total && (
                <div style={{ background: 'oklch(0.66 0.22 25 / .1)', border: '1px solid oklch(0.66 0.22 25 / .3)', borderRadius: 8, padding: '8px 12px' }}>
                  <span style={{ fontSize: 12, color: 'oklch(0.80 0.12 25)' }}>Falta: Bs. {(total - parseFloat(recibido)).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {metodo === 'qr' && (
            <div className="nc-panel" style={{ borderRadius: 10, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--display)', color: 'var(--red)', marginBottom: 10 }}>
                Bs. {total.toFixed(2)}
              </div>
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: 10 }}>
                {posConfig.qr_imagen ? (
                  <img src={`file://${posConfig.qr_imagen}`} alt="QR Pago" style={{ width: 180, height: 180, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--line)', display: 'block' }} />
                ) : (
                  <div style={{ width: 180, height: 180, background: 'oklch(1 0 0 / .06)', borderRadius: 8, border: '1px dashed var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <QrCode size={40} color="var(--dim)" />
                    <span style={{ fontSize: 12, color: 'var(--dim)' }}>QR no configurado</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setQrAmpliado(true)}
                  style={{
                    position: 'absolute', top: 6, right: 6,
                    padding: '4px 8px', borderRadius: 6,
                    background: 'oklch(0 0 0 / .65)', backdropFilter: 'blur(8px)',
                    border: '1px solid oklch(1 0 0 / .2)',
                    display: 'flex', alignItems: 'center', gap: 4,
                    color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <Maximize2 size={11} /> Ampliar
                </button>
              </div>
              {posConfig.qr_banco && <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 10 }}>{posConfig.qr_banco} — {posConfig.qr_cuenta}</div>}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', cursor: 'pointer', fontSize: 13, color: 'var(--muted)' }}>
                <input type="checkbox" checked={qrConfirmado} onChange={e => setQrConfirmado(e.target.checked)} />
                Pago confirmado
              </label>
            </div>
          )}

          {(metodo === 'tarjeta' || metodo === 'transferencia') && (
            <div className="nc-panel" style={{ borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--display)', color: 'var(--red)', marginBottom: 12 }}>
                Bs. {total.toFixed(2)}
              </div>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                {metodo === 'tarjeta' ? 'Procesar pago con tarjeta en el dispositivo.' : 'Solicitar comprobante de transferencia bancaria.'}
              </p>
            </div>
          )}

          {metodo === 'mixto' && (
            <div className="nc-panel" style={{ borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--display)', color: 'var(--red)', marginBottom: 10 }}>
                Bs. {total.toFixed(2)}
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>Ingresa el monto en efectivo; el resto es digital.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--dim)', display: 'block', marginBottom: 4 }}>Efectivo</label>
                  <input className="gym-input nc-input" type="number" min="0" max={total} placeholder="0.00" value={recibido} onChange={e => setRecibido(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--dim)', display: 'block', marginBottom: 4 }}>QR / Transferencia</label>
                  <input className="gym-input nc-input" readOnly value={`Bs. ${Math.max(0, total - (parseFloat(recibido) || 0)).toFixed(2)}`} style={{ color: 'var(--dim)' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Col der: detalle */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.08em', marginBottom: 12 }}>DETALLE DE LA VENTA</div>
          <div className="nc-panel" style={{ borderRadius: 10, padding: 14 }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{seleccion.plan_nombre}</div>
              <div style={{ fontSize: 11, color: 'var(--dim)' }}>{seleccion.plan_duracion} días</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>Subtotal</span>
              <span style={{ fontSize: 12 }}>Bs. {seleccion.subtotal?.toFixed(2)}</span>
            </div>
            {seleccion.descuento_valor > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--green)' }}>Descuento ({seleccion.descuento_nombre})</span>
                <span style={{ fontSize: 12, color: 'var(--green)' }}>- Bs. {seleccion.descuento_valor?.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--line)' }}>
              <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--display)' }}>TOTAL</span>
              <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--display)', color: 'var(--red)' }}>Bs. {total.toFixed(2)}</span>
            </div>
          </div>
          {metodoActivo && (
            <div style={{ marginTop: 10, padding: '10px 14px', background: `${metodoActivo.color}10`, border: `1px solid ${metodoActivo.color}28`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <metodoActivo.Icon size={15} color={metodoActivo.color} strokeWidth={1.8} />
              <span style={{ fontSize: 12, color: metodoActivo.color, fontWeight: 600 }}>{metodoActivo.label}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal QR ampliado ── */}
      {qrAmpliado && createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'oklch(0 0 0 / .96)', backdropFilter: 'blur(20px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28,
          }}
        >
          <button
            onClick={() => setQrAmpliado(false)}
            style={{
              position: 'absolute', top: 24, right: 24,
              background: 'oklch(1 0 0 / .1)', border: '1px solid oklch(1 0 0 / .2)',
              borderRadius: '50%', width: 44, height: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--ink)',
            }}
          >
            <X size={20} />
          </button>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--display)', fontSize: 22, fontWeight: 800, letterSpacing: '.12em', color: 'var(--ink)', marginBottom: 6 }}>
              GIMNASIO
            </div>
            <div style={{ fontSize: 18, color: 'var(--muted)' }}>
              Pago por <span style={{ color: 'var(--red)', fontWeight: 700 }}>Bs. {total.toFixed(2)}</span>
            </div>
          </div>

          <div style={{ background: '#fff', padding: 20, borderRadius: 20, boxShadow: '0 8px 60px oklch(0 0 0 / .6)' }}>
            {posConfig.qr_imagen ? (
              <img src={`file://${posConfig.qr_imagen}`} alt="QR" style={{ width: 480, height: 480, objectFit: 'contain', display: 'block' }} />
            ) : (
              <div style={{ width: 480, height: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                <QrCode size={100} color="#333" />
                <span style={{ color: '#777', fontSize: 16 }}>QR no configurado</span>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 16, color: 'var(--muted)', marginBottom: 4 }}>Escanea con tu app bancaria</p>
            {posConfig.qr_banco && (
              <p style={{ fontSize: 13, color: 'var(--dim)' }}>{posConfig.qr_banco} · Cuenta {posConfig.qr_cuenta}</p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <NcGlassButton className="btn-secondary nc-glass-btn" onClick={() => setQrAmpliado(false)}>Cerrar</NcGlassButton>
            <motion.button
              className="glass-root glass--regular nc-glass-btn"
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => { setQrConfirmado(true); setQrAmpliado(false) }}
              style={{ borderRadius: 10, padding: '12px 28px' }}
            >
              <div className="glass-material" aria-hidden="true">
                <div className="glass-layer glass-layer--fill" />
                <div className="glass-layer glass-layer--specular" />
                <div className="glass-layer glass-layer--rainbow" />
              </div>
              <div className="glass-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 800, fontFamily: 'var(--display)', letterSpacing: '.06em', fontSize: 14 }}>
                <Check size={18} /> Pago Recibido
              </div>
            </motion.button>
          </div>
        </motion.div>,
        document.body
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        <NcGlassButton className="btn-secondary nc-glass-btn" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <ChevronLeft size={16} /> Atrás
        </NcGlassButton>
        <div style={{ display: 'flex', gap: 10 }}>
          <NcGlassButton className="btn-secondary nc-glass-btn" onClick={onCancel}>Cancelar</NcGlassButton>
          <motion.button
            className="glass-root glass--regular nc-glass-btn"
            onClick={handlePagar}
            disabled={!puedeConfirmar() || procesando}
            whileHover={puedeConfirmar() && !procesando ? { scale: 1.02 } : {}}
            whileTap={puedeConfirmar() && !procesando ? { scale: 0.98 } : {}}
            style={{
              borderRadius: 10, padding: '14px 28px',
              cursor: puedeConfirmar() && !procesando ? 'pointer' : 'not-allowed',
              opacity: puedeConfirmar() && !procesando ? 1 : 0.5,
            }}
          >
            <div className="glass-material" aria-hidden="true">
              <div className="glass-layer glass-layer--fill" />
              <div className="glass-layer glass-layer--specular" />
              <div className="glass-layer glass-layer--rainbow" />
            </div>
            <div className="glass-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 800, fontFamily: 'var(--display)', letterSpacing: '.06em', fontSize: 14 }}>
              <DollarSign size={18} />
              {procesando ? 'PROCESANDO...' : 'PROCESAR PAGO'}
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  )
}

// ── Pantalla de éxito ──────────────────────────────────────────────────────────
function ConfirmacionExito({ resultado, onFinalizar, onOverlayHijoChange }) {
  const { esModuloActivo } = useAuth()
  const { navigate } = useApp()
  const [reciboPrevia, setReciboPrevia] = useState(null)

  const recibosActivo = esModuloActivo('recibos')
  const facturacionActiva = esModuloActivo('facturacion')
  const hayComprobantes = recibosActivo || facturacionActiva

  // [NUEVO — mismo fix que qrAmpliado en PasoPago] VistaRecibo (.8
  // blur8, componente compartido en modules/recibos/) se monta encima
  // del overlay base del wizard sin apagarlo — se avisa hacia arriba
  // igual que ahí.
  useEffect(() => { onOverlayHijoChange?.(!!reciboPrevia) }, [reciboPrevia, onOverlayHijoChange])

  // Persistir recibo en BD al completar el pago (para que aparezca en el perfil del cliente)
  useEffect(() => {
    if (!recibosActivo || !resultado.venta_id) return
    window.api.recibos.guardar({
      numero: resultado.venta_id,
      venta_id: resultado.venta_id,
      cliente_nombre: resultado.cliente_nombre || '',
      cliente_doc: resultado.cliente_doc || '',
      items: [{ nombre: resultado.plan_nombre, cantidad: 1, total: resultado.total || 0 }],
      total: resultado.total || 0,
      metodo_pago: resultado.metodo_pago || 'efectivo',
      cajero: resultado.cajero || '',
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Solo auto-cierra si no hay módulos de comprobante activos
  useEffect(() => {
    if (hayComprobantes) return
    const t = setTimeout(onFinalizar, 10000)
    return () => clearTimeout(t)
  }, [onFinalizar, hayComprobantes])

  function verRecibo() {
    setReciboPrevia({
      numero: resultado.venta_id || Date.now(),
      fecha: new Date().toLocaleString('es-BO'),
      cliente_nombre: resultado.cliente_nombre || '',
      cliente_doc: resultado.cliente_doc || '',
      items: [{ nombre: resultado.plan_nombre, cantidad: 1, total: resultado.total || 0 }],
      total: resultado.total || 0,
      metodo_pago: resultado.metodo_pago || 'efectivo',
      monto_recibido: resultado.monto_recibido || resultado.total || 0,
      vuelto: resultado.vuelto || 0,
      cajero: resultado.cajero || '',
    })
  }

  function verFactura() {
    localStorage.setItem('factura_prefill', JSON.stringify({
      cliente_documento: resultado.cliente_doc || '',
      cliente_nombre: resultado.cliente_nombre || '',
      concepto: resultado.plan_nombre || 'Membresía',
      precio_unitario: String(resultado.total || 0),
      metodo_pago: resultado.metodo_pago || 'efectivo',
    }))
    navigate(PAGES.FACTURACION_EMITIR)
    onFinalizar()
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ textAlign: 'center', padding: '24px 0' }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          style={{
            width: 80, height: 80, borderRadius: '50%', margin: '0 auto 20px',
            background: 'oklch(0.78 0.16 155 / .2)',
            border: '3px solid var(--green)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <CheckCircle size={40} color="var(--green)" />
        </motion.div>
        <h2 style={{ fontFamily: 'var(--display)', fontSize: 22, fontWeight: 800, color: 'var(--ink)', marginBottom: 8, letterSpacing: '.06em' }}>
          PAGO PROCESADO
        </h2>
        <p style={{ color: 'var(--muted)', marginBottom: 4 }}>{resultado.plan_nombre}</p>
        <p style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--display)', color: 'var(--green)', marginBottom: 4 }}>
          Bs. {resultado.total?.toFixed(2)}
        </p>
        <p style={{ fontSize: 12, color: 'var(--dim)', marginBottom: hayComprobantes ? 16 : 24 }}>
          Vence: {resultado.fecha_fin ? new Date(resultado.fecha_fin).toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
        </p>

        {/* Botones de comprobante */}
        {hayComprobantes && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
              Generar comprobante
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {recibosActivo && (
                <NcGlassButton className="nc-glass-btn" onClick={verRecibo} style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px',
                  borderRadius: 10, fontSize: 13, fontWeight: 600,
                }}>
                  <Receipt size={15} /> Recibo
                </NcGlassButton>
              )}
              {facturacionActiva && (
                <NcGlassButton className="nc-glass-btn" onClick={verFactura} style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px',
                  borderRadius: 10, fontSize: 13, fontWeight: 600,
                }}>
                  <FileText size={15} /> Factura
                </NcGlassButton>
              )}
            </div>
          </div>
        )}

        <NcGlassButton className="btn-primary nc-glass-btn" onClick={onFinalizar} style={{ margin: '0 auto' }}>
          Finalizar
        </NcGlassButton>
        {!hayComprobantes && (
          <p style={{ fontSize: 11, color: 'var(--dim)', marginTop: 12 }}>Se cierra automáticamente en 10 segundos</p>
        )}
      </motion.div>
      {reciboPrevia && <VistaRecibo venta={reciboPrevia} onClose={() => setReciboPrevia(null)} />}
    </>
  )
}

// ── Wizard principal ───────────────────────────────────────────────────────────
export default function NuevoClienteWizard({ mode, clienteId, onClose, onExito, usuario }) {
  const [paso, setPaso] = useState(mode === 'renovar' ? 2 : 1)
  const [datos, setDatos] = useState({})
  const [seleccion, setSeleccion] = useState({})
  const [procesando, setProcesando] = useState(false)
  const [exito, setExito] = useState(null)
  const [clienteExistente, setClienteExistente] = useState(null)
  const [cajaCerradaPrompt, setCajaCerradaPrompt] = useState(false)
  const [montoInicialCaja, setMontoInicialCaja] = useState('0')
  const [notasCaja, setNotasCaja] = useState('')
  const [abriendoCaja, setAbriendoCaja] = useState(false)
  const [pendingPagoInfo, setPendingPagoInfo] = useState(null)
  const [miembros, setMiembros] = useState([])
  const [enMiembros, setEnMiembros] = useState(false)
  // [NUEVO — fondo oscuro apilado] cajaCerradaPrompt ya vive acá, pero
  // qrAmpliado (PasoPago) y reciboPrevia (ConfirmacionExito) viven en
  // componentes hijos — este wizard no puede ver esos estados
  // directamente, así que cada hijo avisa hacia arriba vía
  // onOverlayHijoChange (ver PasoPago/ConfirmacionExito más arriba) y
  // acá se combinan en un solo flag para apagar el overlay propio del
  // wizard (ver motion.div raíz, más abajo) mientras cualquiera de los
  // 3 esté abierto — mismo criterio que hayModalHijoEncima en
  // ModalVentaRapida (ControlAcceso.jsx).
  const [qrAmpliadoActivo, setQrAmpliadoActivo] = useState(false)
  const [reciboPreviaActivo, setReciboPreviaActivo] = useState(false)
  const hayOverlayHijo = cajaCerradaPrompt || qrAmpliadoActivo || reciboPreviaActivo

  useEffect(() => {
    if (mode === 'renovar' && clienteId) {
      window.api.clientes.buscarPOSById(clienteId).then(c => {
        if (c) {
          setClienteExistente(c)
          if (c.plan_id) {
            const hoy = new Date().toISOString().split('T')[0]
            setSeleccion(prev => ({ ...prev, plan_id: c.plan_id }))
          }
        }
      })
    }
  }, [mode, clienteId])

  // Cerrar con ESC — incondicional, nunca valida el formulario (misma
  // regla que el botón X y el click fuera del modal). Si el sub-modal
  // de "Abrir Caja" está abierto, ESC lo cierra a él primero (no cierra
  // el wizard completo por debajo sin que el usuario lo vea).
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return
      if (cajaCerradaPrompt) { setCajaCerradaPrompt(false); return }
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, cajaCerradaPrompt])

  async function abrirCajaYContinuar() {
    setAbriendoCaja(true)
    try {
      const r = await window.api.caja.abrir({
        monto_inicial: parseFloat(montoInicialCaja) || 0,
        notas: notasCaja || null,
        usuario_id: usuario?.id,
        usuario_nombre: usuario?.nombre_completo,
      })
      if (r.ok) {
        toast.success('Caja abierta')
        setCajaCerradaPrompt(false)
        if (pendingPagoInfo) await ejecutarPago(pendingPagoInfo)
      } else {
        toast.error(r.error || 'Error al abrir caja')
      }
    } finally {
      setAbriendoCaja(false)
    }
  }

  async function ejecutarPago(pagoInfo) {
    setProcesando(true)
    try {
      let cId = clienteId
      if (mode === 'nuevo') {
        const nuevoCliente = await window.api.clientes.createCompleto(datos)
        if (!nuevoCliente || !nuevoCliente.id) { toast.error('Error al crear cliente'); return }
        cId = nuevoCliente.id
      }

      const sesionCaja = await window.api.caja.getSesionActual()

      const res = await window.api.ventas.procesarPagoMembresia({
        cliente_id: cId,
        plan_id: seleccion.plan_id,
        plan_nombre: seleccion.plan_nombre,
        fecha_inicio: seleccion.fecha_inicio,
        fecha_fin: seleccion.fecha_fin,
        subtotal: seleccion.subtotal,
        descuento_id: seleccion.descuento_id,
        descuento_valor: seleccion.descuento_valor || 0,
        total: seleccion.total,
        metodo_pago: pagoInfo.metodo_pago,
        metodo_pago_detalle: pagoInfo.metodo_pago_detalle,
        monto_recibido: pagoInfo.monto_recibido,
        vuelto: pagoInfo.vuelto,
        usuario_id: usuario?.id,
        sesion_caja_id: sesionCaja?.id || null,
      })

      if (res.ok) {
        const memId = res.membresia_id
        const planEsGrupal = (seleccion.plan_capacidad || 1) > 1
        const miembrosARegistrar = planEsGrupal ? miembros : []
        if (planEsGrupal && memId) {
          await window.api.membresiaMiembros.sincronizarTitular(memId, cId)
          for (const [idx, m] of miembrosARegistrar.filter(m => m.nombre || m.cliente_id).entries()) {
            if (m.cliente_id) {
              await window.api.membresiaMiembros.addMiembro(memId, m.cliente_id, false).catch(() => {})
            } else if (m.nombre) {
              try {
                const [first, ...rest] = m.nombre.trim().split(/\s+/)
                const carnetFinal = m.carnet || `GRP-${memId}-${idx + 1}`
                const nuevo = await window.api.clientes.create({ nombre: first, apellido: rest.join(' '), carnet: carnetFinal })
                if (nuevo?.id) await window.api.membresiaMiembros.addMiembro(memId, nuevo.id, false).catch(() => {})
              } catch (_) {}
            }
          }
        }
        const clienteNombre = mode === 'nuevo'
          ? `${datos.nombre || ''} ${datos.apellido || ''}`.trim()
          : `${clienteExistente?.nombre || ''} ${clienteExistente?.apellido || ''}`.trim()
        const clienteDoc = mode === 'nuevo' ? (datos.carnet || '') : (clienteExistente?.carnet || '')
        setExito({
          ...seleccion,
          total: seleccion.total,
          clienteId: cId,
          venta_id: res.venta_id,
          metodo_pago: pagoInfo.metodo_pago || 'efectivo',
          monto_recibido: pagoInfo.monto_recibido || seleccion.total,
          vuelto: pagoInfo.vuelto || 0,
          cliente_nombre: clienteNombre,
          cliente_doc: clienteDoc,
          cajero: usuario?.nombre_completo || '',
        })
        toast.success('Pago procesado correctamente')
      } else {
        toast.error('Error al procesar el pago')
      }
    } catch (err) {
      console.error(err)
      toast.error('Error al procesar el pago')
    } finally {
      setProcesando(false)
    }
  }

  async function handlePagar(pagoInfo) {
    const sesionCaja = await window.api.caja.getSesionActual()
    if (!sesionCaja) {
      setPendingPagoInfo(pagoInfo)
      setCajaCerradaPrompt(true)
      return
    }
    await ejecutarPago(pagoInfo)
  }

  function handleFinalizar() {
    if (exito && typeof onExito === 'function') onExito(exito.clienteId)
    else onClose()
  }

  const titulo = mode === 'renovar' ? 'Renovar Plan' : 'Nuevo Cliente'
  const esGrupal = (seleccion.plan_capacidad || 1) > 1
  const pasoIndicador = enMiembros ? 3 : (esGrupal && paso === 3 ? 4 : paso)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        // Mismo nivel que el overlay de Venta Rápida (ControlAcceso.jsx,
        // ModalVentaRapida) — antes era .75/blur(8px), notablemente más
        // oscuro que el .7/blur(6px) de Venta Rápida.
        // [CORREGIDO — fondo oscuro apilado] Se apaga (transparent/none)
        // mientras haya un overlay hijo montado encima (caja cerrada,
        // QR ampliado o vista previa de recibo, ver hayOverlayHijo más
        // arriba) — cada uno de esos trae su PROPIO fondo oscuro; sin
        // esto se sumaban los dos, mismo diagnóstico que ya se hizo con
        // Datos del comprobante en ModalVentaRapida.
        background: hayOverlayHijo ? 'transparent' : 'oklch(0 0 0 / .7)',
        backdropFilter: hayOverlayHijo ? 'none' : 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <motion.div
        className="nc-glass-card"
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        transition={{ duration: 0.25 }}
        style={{
          width: '100%', maxWidth: 760,
          maxHeight: 'calc(100vh - 80px)',
          borderRadius: 20,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid var(--line)',
          flexShrink: 0,
        }}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 18, fontWeight: 800, letterSpacing: '.06em', margin: 0 }}>
            {titulo}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Body scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 8px' }}>
          {exito ? (
            <ConfirmacionExito resultado={exito} onFinalizar={handleFinalizar} onOverlayHijoChange={setReciboPreviaActivo} />
          ) : (
            <>
              <StepIndicator paso={pasoIndicador} esGrupal={esGrupal} />
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${paso}-${enMiembros}`}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.2 }}
                >
                  {paso === 1 && (
                    <PasoDatos
                      datos={datos}
                      onChange={setDatos}
                      onNext={() => setPaso(2)}
                      onCancel={onClose}
                    />
                  )}
                  {paso === 2 && !enMiembros && (
                    <PasoPlan
                      seleccion={seleccion}
                      onChange={setSeleccion}
                      onNext={() => setPaso(3)}
                      onNextMiembros={(capacidad) => {
                        setMiembros(Array.from({ length: Math.max(0, (capacidad || 2) - 1) }, () => ({ carnet: '', nombre: '', cliente_id: null })))
                        setEnMiembros(true)
                      }}
                      onPlanCambio={(capacidad) => {
                        if ((capacidad || 1) <= 1) { setMiembros([]); setEnMiembros(false) }
                      }}
                      onBack={() => mode === 'renovar' ? onClose() : setPaso(1)}
                      onCancel={onClose}
                    />
                  )}
                  {paso === 2 && enMiembros && (
                    <PasoMiembros
                      seleccion={seleccion}
                      miembros={miembros}
                      onChangeMiembros={setMiembros}
                      onNext={() => { setEnMiembros(false); setPaso(3) }}
                      onBack={() => setEnMiembros(false)}
                      onCancel={onClose}
                    />
                  )}
                  {paso === 3 && (
                    <PasoPago
                      seleccion={seleccion}
                      total={seleccion.total || 0}
                      onPagar={handlePagar}
                      onBack={() => setPaso(2)}
                      onCancel={onClose}
                      procesando={procesando}
                      onOverlayHijoChange={setQrAmpliadoActivo}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </>
          )}
        </div>

        {/* Footer padding */}
        <div style={{ height: 16, flexShrink: 0 }} />
      </motion.div>

      {/* Modal apertura de caja (encima del wizard) */}
      <AnimatePresence>
        {cajaCerradaPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div onClick={() => setCajaCerradaPrompt(false)} style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .5)' }} />
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95 }}
              style={{
                position: 'relative', zIndex: 1, width: 380,
                background: 'oklch(0.14 0.015 250)', border: '1px solid oklch(0.78 0.16 155 / .4)',
                borderRadius: 16, padding: '24px 28px',
                boxShadow: '0 24px 60px oklch(0 0 0 / .6)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Wallet size={18} color="oklch(0.78 0.16 155)" />
                <h3 style={{ fontFamily: 'var(--display)', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Abrir Caja</h3>
              </div>
              <p style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 16 }}>
                No hay caja abierta. Abre la caja para registrar el pago y continuar.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Monto inicial (Bs.)</label>
                  <input className="gym-input nc-input" type="number" min="0" step="0.01" value={montoInicialCaja} onChange={e => setMontoInicialCaja(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Observaciones (opcional)</label>
                  <input className="gym-input nc-input" value={notasCaja} onChange={e => setNotasCaja(e.target.value)} placeholder="Inicio de turno..." />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <NcGlassButton onClick={() => setCajaCerradaPrompt(false)} className="btn-secondary nc-glass-btn" style={{ flex: 1 }}>Cancelar</NcGlassButton>
                <NcGlassButton
                  onClick={abrirCajaYContinuar}
                  disabled={abriendoCaja}
                  className="nc-glass-btn"
                  style={{ flex: 2, padding: '9px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: abriendoCaja ? 'not-allowed' : 'pointer', opacity: abriendoCaja ? 0.7 : 1 }}
                >
                  {abriendoCaja ? 'Abriendo...' : 'Abrir y Continuar Pago'}
                </NcGlassButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
