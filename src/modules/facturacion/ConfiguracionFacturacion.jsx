import { useState, useEffect, useCallback } from 'react'
import {
  Building2, Key, Shield, Mail, Wifi, CheckCircle, XCircle, Loader2,
  Eye, EyeOff, AlertTriangle, Upload, RefreshCw, Send, Play, BookOpen,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { sfeService } from '../../services/sfeService'
import { certificadoService } from '../../services/certificadoService'

const DEPARTAMENTOS = ['Chuquisaca', 'La Paz', 'Cochabamba', 'Oruro', 'Potosí', 'Tarija', 'Santa Cruz', 'Beni', 'Pando']
const TABS = [
  { id: 'empresa', label: 'Empresa', icon: Building2 },
  { id: 'credenciales', label: 'Credenciales SFE', icon: Key },
  { id: 'certificado', label: 'Certificado Digital', icon: Shield },
  { id: 'correo', label: 'Correo Electrónico', icon: Mail },
  { id: 'pruebas', label: 'Pruebas de Conexión', icon: Wifi },
  { id: 'guia', label: 'Guía de Configuración', icon: BookOpen },
]

// ── Estado inicial de pruebas ───────────────────────────────────────────────
const PRUEBAS_INICIAL = [
  { id: 'comunicacion', nombre: 'Conectividad con servidor SFE', estado: 'idle', ms: null, detalle: null },
  { id: 'token', nombre: 'Validar Token de Acceso', estado: 'idle', ms: null, detalle: null },
  { id: 'certificado', nombre: 'Validar Certificado Digital', estado: 'idle', ms: null, detalle: null },
  { id: 'cuis', nombre: 'Obtener CUIS', estado: 'idle', ms: null, detalle: null },
  { id: 'cufd', nombre: 'Obtener CUFD del día', estado: 'idle', ms: null, detalle: null },
  { id: 'parametricas', nombre: 'Sincronizar Catálogos/Paramétricas', estado: 'idle', ms: null, detalle: null },
  { id: 'fechahora', nombre: 'Sincronizar Fecha/Hora con SFE', estado: 'idle', ms: null, detalle: null },
  { id: 'factura_prueba', nombre: 'Emitir Factura de Prueba (modo piloto)', estado: 'idle', ms: null, detalle: null },
  { id: 'anular_prueba', nombre: 'Anular Factura de Prueba', estado: 'idle', ms: null, detalle: null },
  { id: 'verificar_estado', nombre: 'Verificar Estado de Factura', estado: 'idle', ms: null, detalle: null },
]

const PASOS_GUIA = [
  { n: 1, titulo: 'Obtener NIT en Impuestos Nacionales', desc: 'Registra o verifica tu NIT (Número de Identificación Tributaria) ante el Servicio de Impuestos Nacionales de Bolivia.', estado: 'pendiente' },
  { n: 2, titulo: 'Solicitar habilitación al SFE', desc: 'Acude a Impuestos Nacionales y solicita la habilitación para el Sistema de Facturación Electrónica (SFE). Necesitarás tu NIT activo y datos de tu empresa.', estado: 'pendiente' },
  { n: 3, titulo: 'Solicitar Token API', desc: 'Una vez habilitado en el SFE, solicita el Token de Acceso a la API. Este token se ingresa en la pestaña "Credenciales SFE".', estado: 'pendiente' },
  { n: 4, titulo: 'Generar Certificado Digital (.p12)', desc: 'Solicita a Impuestos Nacionales la generación de tu certificado digital en formato .p12 (PKCS#12). Guarda también la contraseña del certificado de forma segura.', estado: 'pendiente' },
  { n: 5, titulo: 'Configurar datos en la aplicación', desc: 'Ingresa todos los datos en las pestañas: Empresa, Credenciales SFE, Certificado Digital y Correo Electrónico.', estado: 'pendiente' },
  { n: 6, titulo: 'Ejecutar pruebas en ambiente de Pilotos', desc: 'En la pestaña "Pruebas de Conexión", ejecuta todas las pruebas usando el ambiente de Pilotos. Corrige cualquier error antes de continuar.', estado: 'pendiente' },
  { n: 7, titulo: 'Pasar a Producción', desc: 'Una vez que todas las pruebas pasen correctamente, cambia el ambiente a "Producción" en las Credenciales SFE y solicita las credenciales de producción a Impuestos Nacionales.', estado: 'pendiente' },
]

// ── Tab: Empresa ────────────────────────────────────────────────────────────
function TabEmpresa() {
  const [form, setForm] = useState({ nit: '', razon_social: '', nombre_comercial: '', direccion: '', telefono: '', departamento: 'La Paz', municipio: '', codigo_sucursal: 0, punto_venta: 0, actividad_economica: '', leyenda: 'Esta factura contribuye al desarrollo del país.' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    window.api.facturacion.getEmpresa().then(d => {
      if (d && d.nit) setForm(f => ({ ...f, ...d }))
    })
  }, [])

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function guardar(e) {
    e.preventDefault()
    if (!/^\d{7,13}$/.test(form.nit)) return toast.error('El NIT debe tener entre 7 y 13 dígitos')
    setLoading(true)
    try {
      await window.api.facturacion.saveEmpresa(form)
      toast.success('Datos de empresa guardados')
    } catch (err) { toast.error(err.message) }
    setLoading(false)
  }

  return (
    <form onSubmit={guardar}>
      <div className="form-grid" style={{ marginBottom: 16 }}>
        <div>
          <label className="gym-label">NIT * (7-13 dígitos)</label>
          <input className="gym-input" value={form.nit} onChange={f('nit')} placeholder="Ej: 1234567890" pattern="\d{7,13}" required />
        </div>
        <div>
          <label className="gym-label">Razón Social *</label>
          <input className="gym-input" value={form.razon_social} onChange={f('razon_social')} required />
        </div>
        <div>
          <label className="gym-label">Nombre Comercial</label>
          <input className="gym-input" value={form.nombre_comercial} onChange={f('nombre_comercial')} placeholder="Ej: Urban Fitness Club" />
        </div>
        <div>
          <label className="gym-label">Teléfono</label>
          <input className="gym-input" value={form.telefono} onChange={f('telefono')} />
        </div>
        <div>
          <label className="gym-label">Departamento</label>
          <select className="gym-select" value={form.departamento} onChange={f('departamento')}>
            {DEPARTAMENTOS.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="gym-label">Municipio</label>
          <input className="gym-input" value={form.municipio} onChange={f('municipio')} />
        </div>
        <div>
          <label className="gym-label">Código Sucursal</label>
          <input className="gym-input" type="number" value={form.codigo_sucursal} onChange={f('codigo_sucursal')} min={0} />
        </div>
        <div>
          <label className="gym-label">Punto de Venta</label>
          <input className="gym-input" type="number" value={form.punto_venta} onChange={f('punto_venta')} min={0} />
        </div>
        <div>
          <label className="gym-label">Actividad Económica (CAEB)</label>
          <input className="gym-input" value={form.actividad_economica} onChange={f('actividad_economica')} placeholder="Ej: 960010" />
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label className="gym-label">Dirección Casa Matriz</label>
        <input className="gym-input" value={form.direccion} onChange={f('direccion')} />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label className="gym-label">Leyenda en Factura</label>
        <textarea className="gym-textarea" value={form.leyenda} onChange={f('leyenda')} rows={2} />
      </div>
      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? <><span className="spinner" style={{ marginRight: 8 }} />Guardando...</> : 'Guardar Datos de Empresa'}
      </button>
    </form>
  )
}

// ── Tab: Credenciales SFE ───────────────────────────────────────────────────
function TabCredenciales() {
  const [form, setForm] = useState({ ambiente: 'piloto', token: '', codigo_sistema: '', cuis: '', cufd: '', modalidad: 2, tipo_emision: 1, tipo_factura: 1 })
  const [showToken, setShowToken] = useState(false)
  const [loadingCUIS, setLoadingCUIS] = useState(false)
  const [loadingCUFD, setLoadingCUFD] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cargandoSim, setCargandoSim] = useState(false)
  const [emitiendo, setEmitiendo] = useState(false)
  const [facturaSimulada, setFacturaSimulada] = useState(null)

  useEffect(() => {
    window.api.facturacion.getCredenciales().then(d => {
      if (d) setForm(f => ({ ...f, ...d, token: d.token === '***' ? '' : (d.token || '') }))
    })
  }, [])

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function guardar(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await window.api.facturacion.saveCredenciales(form)
      toast.success('Credenciales guardadas')
    } catch (err) { toast.error(err.message) }
    setLoading(false)
  }

  async function solicitarCUIS() {
    setLoadingCUIS(true)
    try {
      const r = await window.api.facturacion.obtenerCUIS()
      if (r.ok || r.cuis) {
        setForm(p => ({ ...p, cuis: r.cuis }))
        toast.success(`CUIS obtenido: ${r.cuis}`)
      } else throw new Error(r.error || 'Error desconocido')
    } catch (err) { toast.error(`Error CUIS: ${err.message}`) }
    setLoadingCUIS(false)
  }

  async function solicitarCUFD() {
    setLoadingCUFD(true)
    try {
      const r = await window.api.facturacion.obtenerCUFD()
      if (r.ok || r.cufd) {
        setForm(p => ({ ...p, cufd: r.cufd }))
        toast.success(`CUFD obtenido: ${r.cufd?.slice(0, 20)}...`)
      } else throw new Error(r.error || 'Error desconocido')
    } catch (err) { toast.error(`Error CUFD: ${err.message}`) }
    setLoadingCUFD(false)
  }

  return (
    <form onSubmit={guardar}>
      <div className="form-grid" style={{ marginBottom: 16 }}>
        <div>
          <label className="gym-label">Ambiente</label>
          <select className="gym-select" value={form.ambiente} onChange={f('ambiente')}>
            <option value="simulacion">Simulación (sin conexión SIN)</option>
            <option value="piloto">Pilotos (Pruebas con SIN)</option>
            <option value="produccion">Producción</option>
          </select>
          {form.ambiente === 'simulacion' && (
            <div style={{ marginTop: 16, background: 'oklch(0.82 0.14 75 / .06)', border: '1px solid oklch(0.82 0.14 75 / .25)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'oklch(0.90 0.10 75)', marginBottom: 6 }}>MODO PRUEBA / SIMULACIÓN</div>
              <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 12, lineHeight: 1.6 }}>
                Prueba la facturación sin conexión real al SIN. Se llenará NIT, token, CUIS y CUFD simulados automáticamente.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button"
                  onClick={async () => {
                    setCargandoSim(true)
                    const r = await window.api.facturacion.precargarSimulacion()
                    if (r.ok) {
                      toast.success('Datos de simulación precargados')
                      window.api.facturacion.getCredenciales().then(d => { if (d) setForm(f => ({ ...f, ...d, token: d.token === '***' ? '' : (d.token || '') })) })
                    } else toast.error(r.error || 'Error')
                    setCargandoSim(false)
                  }}
                  disabled={cargandoSim}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: 'oklch(0.82 0.14 75 / .15)', border: '1px solid oklch(0.82 0.14 75 / .4)', color: 'oklch(0.90 0.10 75)', cursor: 'pointer' }}>
                  {cargandoSim ? <><RefreshCw size={12} className="spin" /> Cargando...</> : '⚡ Cargar Datos de Prueba'}
                </button>
                <button type="button"
                  onClick={async () => {
                    setEmitiendo(true)
                    try {
                      const res = await window.api.facturacion.emitirFactura({
                        cliente_tipo_doc: 'CI', cliente_documento: '7234891',
                        cliente_nombre: 'Juan Carlos Mamani', cliente_correo: '',
                        concepto: 'Membresía Premium Urban Fitness Club', cantidad: 1,
                        precio_unitario: 250, descuento: 0, monto_total: 250,
                        metodo_pago: 'efectivo', enviar_correo: false,
                      })
                      if (res.ok) { setFacturaSimulada(res); toast.success('Factura de prueba emitida') }
                      else toast.error(res.error || 'Error al emitir')
                    } catch (err) { toast.error(err.message) }
                    setEmitiendo(false)
                  }}
                  disabled={emitiendo}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: 'oklch(0.66 0.22 25 / .12)', border: '1px solid oklch(0.66 0.22 25 / .35)', color: 'oklch(0.80 0.15 25)', cursor: 'pointer' }}>
                  {emitiendo ? <><RefreshCw size={12} className="spin" /> Emitiendo...</> : '🧾 Emitir Factura de Prueba'}
                </button>
              </div>
              {facturaSimulada && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: 'oklch(0.78 0.16 155 / .1)', border: '1px solid oklch(0.78 0.16 155 / .3)', borderRadius: 8, fontSize: 11, color: 'oklch(0.78 0.16 155)' }}>
                  ✓ Factura #{facturaSimulada.factura?.numero_factura} emitida — ver en "Historial de Facturas"
                </div>
              )}
            </div>
          )}
        </div>
        <div>
          <label className="gym-label">Código Sistema</label>
          <input className="gym-input" value={form.codigo_sistema} onChange={f('codigo_sistema')} placeholder="Ej: SIS001" />
        </div>
        <div>
          <label className="gym-label">Modalidad</label>
          <select className="gym-select" value={form.modalidad} onChange={f('modalidad')}>
            <option value={1}>1 — Electrónica En Línea</option>
            <option value={2}>2 — Computarizada En Línea</option>
          </select>
        </div>
        <div>
          <label className="gym-label">Tipo Emisión</label>
          <select className="gym-select" value={form.tipo_emision} onChange={f('tipo_emision')}>
            <option value={1}>1 — Online</option>
            <option value={2}>2 — Offline (fuera de línea)</option>
          </select>
        </div>
        <div>
          <label className="gym-label">Tipo Factura</label>
          <select className="gym-select" value={form.tipo_factura} onChange={f('tipo_factura')}>
            <option value={1}>1 — Compra/Venta</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="gym-label">Token de Acceso *</label>
        <div style={{ position: 'relative' }}>
          <input
            className="gym-input"
            type={showToken ? 'text' : 'password'}
            value={form.token}
            onChange={f('token')}
            placeholder="Pega aquí tu token SFE..."
            style={{ paddingRight: 44 }}
          />
          <button type="button" onClick={() => setShowToken(s => !s)}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)' }}>
            {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div className="form-grid" style={{ marginBottom: 20 }}>
        <div>
          <label className="gym-label">CUIS Actual (solo lectura)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="gym-input" value={form.cuis || ''} readOnly style={{ flex: 1, color: 'var(--dim)' }} placeholder="Sin CUIS" />
            <button type="button" className="btn-secondary" onClick={solicitarCUIS} disabled={loadingCUIS} style={{ whiteSpace: 'nowrap' }}>
              {loadingCUIS ? <span className="spinner" /> : <RefreshCw size={14} />} CUIS
            </button>
          </div>
        </div>
        <div>
          <label className="gym-label">CUFD Actual (solo lectura)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="gym-input" value={form.cufd ? form.cufd.slice(0, 30) + '...' : ''} readOnly style={{ flex: 1, color: 'var(--dim)' }} placeholder="Sin CUFD" />
            <button type="button" className="btn-secondary" onClick={solicitarCUFD} disabled={loadingCUFD} style={{ whiteSpace: 'nowrap' }}>
              {loadingCUFD ? <span className="spinner" /> : <RefreshCw size={14} />} CUFD
            </button>
          </div>
        </div>
      </div>

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? 'Guardando...' : 'Guardar Credenciales'}
      </button>
    </form>
  )
}

// ── Tab: Certificado Digital ────────────────────────────────────────────────
function TabCertificado() {
  const [cert, setCert] = useState(null)
  const [rutaTemp, setRutaTemp] = useState(null)
  const [password, setPassword] = useState('')
  const [validando, setValidando] = useState(false)
  const [showPass, setShowPass] = useState(false)

  useEffect(() => {
    window.api.facturacion.getCertificado().then(d => { if (d) setCert(d) })
  }, [])

  async function seleccionarArchivo() {
    const r = await window.api.facturacion.cargarCertificado()
    if (!r.cancelado) { setRutaTemp(r.ruta); toast.success('Archivo seleccionado: ' + r.ruta.split('\\').pop()) }
  }

  async function validar() {
    if (!rutaTemp) return toast.error('Primero selecciona un archivo .p12')
    if (!password) return toast.error('Ingresa la contraseña del certificado')
    setValidando(true)
    try {
      const r = await window.api.facturacion.validarCertificado({ ruta: rutaTemp, password })
      if (r.ok) {
        toast.success('Certificado válido y guardado correctamente')
        window.api.facturacion.getCertificado().then(setCert)
        setRutaTemp(null); setPassword('')
      } else toast.error(`Error: ${r.error}`)
    } catch (err) { toast.error(err.message) }
    setValidando(false)
  }

  const diasRestantes = cert?.diasRestantes
  const alertaVencimiento = diasRestantes !== null && diasRestantes !== undefined && diasRestantes < 30

  return (
    <div>
      {cert && (
        <div style={{
          background: alertaVencimiento ? 'oklch(0.66 0.22 25 / .07)' : 'var(--glass)',
          border: `1px solid ${alertaVencimiento ? 'oklch(0.66 0.22 25 / .35)' : 'var(--line)'}`,
          borderRadius: 12, padding: 16, marginBottom: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 4 }}>Certificado cargado</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{cert.ruta_archivo?.split('\\').pop() || cert.ruta_archivo?.split('/').pop()}</div>
            </div>
            {alertaVencimiento && <span className="badge badge-red"><AlertTriangle size={11} /> ¡Vence pronto!</span>}
          </div>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <div><div className="gym-label">Fecha Emisión</div><div style={{ fontSize: 13, color: 'var(--muted)' }}>{cert.fecha_emision ? new Date(cert.fecha_emision).toLocaleDateString('es-BO') : '—'}</div></div>
            <div><div className="gym-label">Fecha Vencimiento</div><div style={{ fontSize: 13, color: alertaVencimiento ? 'oklch(0.75 0.18 25)' : 'var(--muted)' }}>{cert.fecha_vencimiento ? new Date(cert.fecha_vencimiento).toLocaleDateString('es-BO') : '—'}</div></div>
            <div><div className="gym-label">Días Restantes</div><div style={{ fontSize: 20, fontWeight: 700, color: alertaVencimiento ? 'var(--red)' : 'var(--green)' }}>{diasRestantes ?? '—'}</div></div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div>
          <label className="gym-label">Archivo Certificado .p12</label>
          <button type="button" className="btn-secondary" onClick={seleccionarArchivo} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Upload size={16} /> {rutaTemp ? rutaTemp.split('\\').pop() : 'Seleccionar archivo .p12...'}
          </button>
        </div>
        <div>
          <label className="gym-label">Contraseña del Certificado</label>
          <div style={{ position: 'relative' }}>
            <input className="gym-input" type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña del archivo .p12" style={{ paddingRight: 44 }} />
            <button type="button" onClick={() => setShowPass(s => !s)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)' }}>
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <button className="btn-primary" onClick={validar} disabled={validando}>
          {validando ? <><span className="spinner" style={{ marginRight: 8 }} />Validando...</> : <><Shield size={15} style={{ display: 'inline', marginRight: 6 }} />Validar y Guardar Certificado</>}
        </button>
      </div>
    </div>
  )
}

// ── Tab: Correo Electrónico ─────────────────────────────────────────────────
function TabCorreo() {
  const [form, setForm] = useState({ smtp_host: '', smtp_port: 587, smtp_user: '', smtp_pass_encriptado: '', use_ssl: false, remitente: '', asunto_plantilla: 'Factura Electrónica - Urban Fitness Club', cuerpo_plantilla: 'Estimado/a {nombre},\n\nAdjunto encontrará su factura electrónica N° {numero_factura} por el monto de Bs. {monto}.\n\nGracias por su preferencia.\n\nUrban Fitness Club' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [enviandoPrueba, setEnviandoPrueba] = useState(false)

  useEffect(() => {
    window.api.facturacion.getConfigCorreo().then(d => {
      if (d && d.smtp_host) setForm(f => ({ ...f, ...d, smtp_pass_encriptado: d.smtp_pass_encriptado === '***' ? '' : (d.smtp_pass_encriptado || '') }))
    })
  }, [])

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function guardar(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await window.api.facturacion.saveConfigCorreo(form)
      toast.success('Configuración de correo guardada')
    } catch (err) { toast.error(err.message) }
    setLoading(false)
  }

  async function enviarPrueba() {
    setEnviandoPrueba(true)
    try {
      await window.api.facturacion.enviarCorreoPrueba()
      toast.success('Correo de prueba enviado correctamente')
    } catch (err) { toast.error(`Error al enviar: ${err.message}`) }
    setEnviandoPrueba(false)
  }

  return (
    <form onSubmit={guardar}>
      <div className="form-grid" style={{ marginBottom: 16 }}>
        <div>
          <label className="gym-label">Servidor SMTP</label>
          <input className="gym-input" value={form.smtp_host} onChange={f('smtp_host')} placeholder="smtp.gmail.com" />
        </div>
        <div>
          <label className="gym-label">Puerto</label>
          <input className="gym-input" type="number" value={form.smtp_port} onChange={f('smtp_port')} />
        </div>
        <div>
          <label className="gym-label">Usuario (correo)</label>
          <input className="gym-input" type="email" value={form.smtp_user} onChange={f('smtp_user')} placeholder="gym@gmail.com" />
        </div>
        <div>
          <label className="gym-label">Contraseña de Aplicación</label>
          <div style={{ position: 'relative' }}>
            <input className="gym-input" type={showPass ? 'text' : 'password'} value={form.smtp_pass_encriptado} onChange={f('smtp_pass_encriptado')} style={{ paddingRight: 44 }} />
            <button type="button" onClick={() => setShowPass(s => !s)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)' }}>
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <label className="gym-label">Correo Remitente</label>
          <input className="gym-input" value={form.remitente} onChange={f('remitente')} placeholder="Urban Fitness Club <gym@gmail.com>" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 22 }}>
          <input type="checkbox" id="ssl" checked={form.use_ssl} onChange={f('use_ssl')} style={{ width: 16, height: 16, accentColor: 'oklch(0.66 0.22 25)' }} />
          <label htmlFor="ssl" style={{ fontSize: 13, color: 'var(--muted)', cursor: 'pointer' }}>Usar SSL/TLS</label>
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label className="gym-label">Asunto Plantilla</label>
        <input className="gym-input" value={form.asunto_plantilla} onChange={f('asunto_plantilla')} />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label className="gym-label">Cuerpo Plantilla ({'{nombre}'}, {'{numero_factura}'}, {'{monto}'})</label>
        <textarea className="gym-textarea" value={form.cuerpo_plantilla} onChange={f('cuerpo_plantilla')} rows={5} />
      </div>
      <div className="flex gap-3">
        <button type="submit" className="btn-primary flex-1" disabled={loading}>
          {loading ? 'Guardando...' : 'Guardar Configuración'}
        </button>
        <button type="button" className="btn-secondary" onClick={enviarPrueba} disabled={enviandoPrueba} style={{ whiteSpace: 'nowrap' }}>
          {enviandoPrueba ? <span className="spinner" /> : <Send size={14} style={{ display: 'inline', marginRight: 6 }} />}
          Enviar Prueba
        </button>
      </div>
    </form>
  )
}

// ── Tab: Pruebas de Conexión ────────────────────────────────────────────────
function TabPruebas() {
  const [pruebas, setPruebas] = useState(PRUEBAS_INICIAL)
  const [ejecutandoTodas, setEjecutandoTodas] = useState(false)
  const [detalleModal, setDetalleModal] = useState(null)
  const [xmlPrueba, setXmlPrueba] = useState(null)
  let cufPrueba = null

  function setEstado(id, estado, ms = null, detalle = null) {
    setPruebas(p => p.map(t => t.id === id ? { ...t, estado, ms, detalle } : t))
  }

  async function ejecutarPrueba(id) {
    setEstado(id, 'running')
    const t0 = Date.now()
    try {
      let resultado
      switch (id) {
        case 'comunicacion': {
          const r = await sfeService.verificarComunicacion()
          if (!r.ok) throw new Error(r.error || 'Sin respuesta del SFE')
          setEstado(id, 'ok', r.ms || Date.now() - t0)
          break
        }
        case 'token': {
          const r = await sfeService.verificarToken()
          if (!r.ok) throw new Error(r.error || 'Token inválido')
          setEstado(id, 'ok', r.ms || Date.now() - t0)
          break
        }
        case 'certificado': {
          const r = await window.api.facturacion.getCertificado()
          if (!r) throw new Error('No hay certificado cargado')
          if (r.diasRestantes < 0) throw new Error('El certificado ha vencido')
          setEstado(id, 'ok', Date.now() - t0, `Válido por ${r.diasRestantes} días`)
          break
        }
        case 'cuis': {
          const r = await sfeService.obtenerCUIS()
          if (r.error) throw new Error(r.error)
          setEstado(id, 'ok', r.ms || Date.now() - t0, `CUIS: ${r.cuis}`)
          break
        }
        case 'cufd': {
          const r = await sfeService.obtenerCUFD()
          if (r.error) throw new Error(r.error)
          setEstado(id, 'ok', r.ms || Date.now() - t0, `CUFD obtenido`)
          break
        }
        case 'parametricas': {
          const r = await sfeService.sincronizarParametricas()
          setEstado(id, 'ok', Date.now() - t0, r.mensaje)
          break
        }
        case 'fechahora': {
          const r = await sfeService.sincronizarFechaHora()
          if (r.error) throw new Error(r.error)
          setEstado(id, 'ok', r.ms || Date.now() - t0, `Hora SFE: ${r.fechaHora || 'OK'}`)
          break
        }
        case 'factura_prueba': {
          const r = await sfeService.emitirFacturaPrueba()
          if (!r.ok) throw new Error(r.error)
          cufPrueba = r.cuf
          setXmlPrueba(r.xml)
          setEstado(id, 'ok', Date.now() - t0, `CUF: ${r.cuf}`)
          break
        }
        case 'anular_prueba': {
          const r = await sfeService.anularFacturaPrueba(cufPrueba || 'CUF_PRUEBA')
          setEstado(id, 'ok', Date.now() - t0, r.mensaje)
          break
        }
        case 'verificar_estado': {
          const r = await sfeService.verificarEstadoFactura(cufPrueba || 'CUF_PRUEBA')
          setEstado(id, r.ok ? 'ok' : 'error', r.ms || Date.now() - t0, r.estado || r.error)
          break
        }
      }
    } catch (err) {
      setEstado(id, 'error', Date.now() - t0, err.message)
    }
  }

  async function ejecutarTodas() {
    setEjecutandoTodas(true)
    setPruebas(PRUEBAS_INICIAL)
    for (const p of PRUEBAS_INICIAL) {
      await ejecutarPrueba(p.id)
    }
    setEjecutandoTodas(false)
  }

  const exitosas = pruebas.filter(p => p.estado === 'ok').length
  const fallidas = pruebas.filter(p => p.estado === 'error').length
  const total = pruebas.length

  function iconEstado(estado) {
    if (estado === 'ok') return <CheckCircle size={18} color="oklch(0.78 0.16 155)" />
    if (estado === 'error') return <XCircle size={18} color="oklch(0.66 0.22 25)" />
    if (estado === 'running') return <span className="spinner" />
    return <span style={{ fontSize: 18, color: 'var(--dim)' }}>○</span>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div style={{ fontSize: 13, color: 'var(--dim)' }}>
          {exitosas > 0 && <span style={{ color: 'var(--green)', marginRight: 12 }}>✅ {exitosas} exitosas</span>}
          {fallidas > 0 && <span style={{ color: 'var(--red)' }}>❌ {fallidas} fallidas</span>}
        </div>
        <button className="btn-primary" onClick={ejecutarTodas} disabled={ejecutandoTodas} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {ejecutandoTodas ? <span className="spinner" /> : <Play size={14} />}
          Ejecutar Todas
        </button>
      </div>

      {pruebas.map(p => (
        <div key={p.id} className="test-row">
          <div className="test-status">{iconEstado(p.estado)}</div>
          <div style={{ flex: 1 }}>
            <div className="test-name">{p.nombre}</div>
            {p.detalle && <div style={{ fontSize: 11, color: p.estado === 'error' ? 'oklch(0.75 0.18 25)' : 'var(--green)', marginTop: 2 }}>{p.detalle}</div>}
          </div>
          {p.ms !== null && <div className="test-ms">{p.ms}ms</div>}
          <button className="test-btn" onClick={() => ejecutarPrueba(p.id)} disabled={p.estado === 'running'}>
            {p.estado === 'running' ? '...' : 'Ejecutar'}
          </button>
          {p.estado === 'error' && (
            <button className="test-btn" style={{ color: 'oklch(0.75 0.18 25)', borderColor: 'oklch(0.35 0.12 25)' }} onClick={() => setDetalleModal(p)}>
              Ver error
            </button>
          )}
        </div>
      ))}

      {exitosas === total && total > 0 && (
        <div style={{ marginTop: 20, padding: 16, background: 'oklch(0.78 0.16 155 / .10)', border: '1px solid oklch(0.78 0.16 155 / .30)', borderRadius: 12, textAlign: 'center' }}>
          <CheckCircle size={24} color="oklch(0.78 0.16 155)" style={{ display: 'inline', marginRight: 8 }} />
          <span style={{ color: 'var(--green)', fontWeight: 700 }}>Sistema listo para producción</span>
        </div>
      )}

      {fallidas > 0 && !ejecutandoTodas && (
        <div style={{ marginTop: 20, padding: 16, background: 'oklch(0.66 0.22 25 / .10)', border: '1px solid oklch(0.66 0.22 25 / .30)', borderRadius: 12, textAlign: 'center' }}>
          <span style={{ color: 'oklch(0.75 0.18 25)', fontWeight: 700 }}>Hay {fallidas} prueba{fallidas > 1 ? 's' : ''} fallando</span>
        </div>
      )}

      {xmlPrueba && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 6 }}>XML generado en prueba:</div>
          <textarea className="gym-textarea" readOnly value={xmlPrueba} rows={6} style={{ fontFamily: 'monospace', fontSize: 10 }} />
        </div>
      )}

      {detalleModal && (
        <div className="modal-overlay" onClick={() => setDetalleModal(null)}>
          <div className="modal-box" style={{ maxWidth: 500 }}>
            <h3 style={{ color: 'oklch(0.75 0.18 25)', marginBottom: 12 }}>Error en: {detalleModal.nombre}</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, whiteSpace: 'pre-wrap' }}>{detalleModal.detalle}</p>
            <button className="btn-secondary" style={{ marginTop: 16 }} onClick={() => setDetalleModal(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: Guía de Configuración ───────────────────────────────────────────────
function TabGuia() {
  const [completados, setCompletados] = useState({})

  return (
    <div>
      <div style={{ marginBottom: 20, padding: 16, background: 'oklch(0.66 0.22 25 / .07)', border: '1px solid oklch(0.66 0.22 25 / .18)', borderRadius: 12 }}>
        <p style={{ fontSize: 13, color: 'var(--dim)' }}>
          Siga estos pasos antes de usar la facturación electrónica. El cliente debe realizar los trámites con Impuestos Nacionales (SIN) de Bolivia.
        </p>
      </div>
      {PASOS_GUIA.map(paso => (
        <div key={paso.n} style={{ display: 'flex', gap: 16, marginBottom: 12, padding: 16, background: 'var(--glass)', border: '1px solid var(--line)', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: completados[paso.n] ? 'oklch(0.78 0.16 155 / .15)' : 'oklch(1 0 0 / .05)',
              border: `2px solid ${completados[paso.n] ? 'oklch(0.78 0.16 155 / .5)' : 'oklch(1 0 0 / .12)'}`,
              color: completados[paso.n] ? 'var(--green)' : 'var(--dim)', fontWeight: 700, fontSize: 14,
            }}>
              {completados[paso.n] ? '✓' : paso.n}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{paso.titulo}</div>
              <div style={{ fontSize: 12, color: 'var(--dim)' }}>{paso.desc}</div>
            </div>
          </div>
          <button
            className={completados[paso.n] ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'}
            onClick={() => setCompletados(p => ({ ...p, [paso.n]: !p[paso.n] }))}
            style={{ whiteSpace: 'nowrap', alignSelf: 'center' }}
          >
            {completados[paso.n] ? '✓ Hecho' : 'Marcar como hecho'}
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function ConfiguracionFacturacion() {
  const [tab, setTab] = useState('empresa')

  const tabContent = {
    empresa: <TabEmpresa />,
    credenciales: <TabCredenciales />,
    certificado: <TabCertificado />,
    correo: <TabCorreo />,
    pruebas: <TabPruebas />,
    guia: <TabGuia />,
  }

  return (
    <div>
      <h1 className="titulo-metalico mb-6">Facturación Electrónica SFE Bolivia</h1>

      <div style={{ background: 'var(--glass)', border: '1px solid var(--line)', borderRadius: 12, padding: 4, marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
                border: active ? '1px solid oklch(0.66 0.22 25 / .4)' : '1px solid transparent',
                cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                background: active ? 'oklch(0.66 0.22 25 / .18)' : 'transparent',
                color: active ? 'oklch(0.76 0.20 25)' : 'var(--dim)',
              }}>
              <Icon size={14} />{t.label}
            </button>
          )
        })}
      </div>

      <div className="gym-card" style={{ padding: 24 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {tabContent[tab]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
