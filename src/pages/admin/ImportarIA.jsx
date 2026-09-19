// ─── IA / Importar datos ───────────────────────────────────────────────────
// Asistente de chat que lee fotos, Excel, Word y PDF de inventario (servicio
// local de OCR/estructuración en localhost:8420, ver scripts/README.md),
// compara cada producto contra el inventario real y, tras la confirmación del
// usuario, lo escribe de verdad en la base de datos (window.api.inventario.
// importarLote / deshacerLote — transaccionales, todo o nada).
//
// Accesible desde DOS puntos de entrada que renderizan este MISMO
// componente (nunca duplicado):
//   1. TopNav.jsx → PAGES.IA_IMPORTAR (ruta independiente, ver App.jsx)
//   2. Configuracion.jsx → sección 'ia' (dentro del hub de Configuración)

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Plus, Send, X, Image as ImageIcon, FileText,
  FileSpreadsheet, File as FileIcon, Check, AlertTriangle, ChevronRight,
  History, Paperclip, Copy, StopCircle, Search, Activity,
} from 'lucide-react'
import { buscarCoincidencia } from '../../utils/coincidenciasInventario'
import { useAuth } from '../../context/AuthContext'
import ComparacionProductos, { estadoDeCambio, filasDeshacer, filasDeLote } from './ComparacionProductos'
import '../Clients.css'
import './ImportarIA.css'

// ─── Clasificación contra el inventario real ──────────────────────────────
// Separa los productos en "nuevos" y "existentes" comparando cada nombre con
// el inventario ya guardado (ver utils/coincidenciasInventario.js — conservador:
// ante la duda, es nuevo). Un existente lleva el producto real con el que
// coincidió y su stock actual, que es lo que alimenta el diff "antes → después".
function clasificarContraInventario(items, inventario) {
  const nuevos = []
  const existentes = []
  items.forEach(item => {
    const m = buscarCoincidencia(item.nombre, inventario)
    if (m) {
      existentes.push({
        ...item,
        producto_id: m.producto.id,
        nombreExistente: m.producto.nombre,
        cantidadAnterior: m.producto.stock ?? 0,
        coincidencia: m.exacta ? 'exacta' : 'aproximada',
      })
    } else {
      // Limpia restos por si venía de existentes (nombre editado → ya no coincide).
      const { producto_id, nombreExistente, cantidadAnterior, coincidencia, ...resto } = item
      nuevos.push(resto)
    }
  })
  return { nuevos, existentes }
}

async function leerInventarioReal() {
  try {
    const lista = await window.api.inventario.getAll({})
    return { inventario: Array.isArray(lista) ? lista : [], ok: true }
  } catch {
    return { inventario: [], ok: false }
  }
}

// El stock es un entero ≥ 0: un "2.5" o un "-3" (típico error de OCR) se
// rechaza acá, antes de poder confirmar, en vez de romper la escritura.
const cantidadValida = c => c !== '' && c !== null && c !== undefined && Number.isInteger(Number(c)) && Number(c) >= 0

// Textos de la respuesta tras escribir/deshacer, con los datos REALES que
// devolvió la base (no un "listo" genérico).
function textoResultadoAgregado(resultados) {
  const creados = resultados.filter(r => r.accion === 'crear')
  const actualizados = resultados.filter(r => r.accion === 'actualizar')
  const partes = []
  if (creados.length) partes.push(`${creados.length} producto${creados.length === 1 ? '' : 's'} nuevo${creados.length === 1 ? '' : 's'}`)
  if (actualizados.length) partes.push(`${actualizados.length} actualizado${actualizados.length === 1 ? '' : 's'}`)
  const lineas = resultados.slice(0, 12).map(r => r.accion === 'crear'
    ? `+ ${r.nombre}: ${r.stock_real} unidades (nuevo)`
    : r.modo === 'sumar'
      ? `~ ${r.nombre}: ${r.stock_anterior} + ${r.cantidad_archivo} = ${r.stock_real} unidades (sumado)`
      : `~ ${r.nombre}: ${r.stock_anterior} → ${r.stock_real} unidades (reemplazado)`)
  if (resultados.length > 12) lineas.push(`… y ${resultados.length - 12} más`)
  let texto = `Listo, ya está guardado en el inventario: ${partes.join(' y ')}.\n\nStock actual leído de la base de datos:\n${lineas.join('\n')}`
  if (creados.length) texto += '\n\nLos productos nuevos se crearon con precio $0 y stock mínimo 5: completa el precio en Inventario.'
  return texto
}

// ─── Auditoría (tabla ia_importaciones, ver electron/database.cjs) ────────
// Nunca bloquea el flujo: si el registro falla se deja constancia en la
// consola y la importación sigue (perder un registro es mejor que impedir
// que el usuario cargue su inventario).
async function auditoriaCrear(datos) {
  try {
    const r = await window.api.iaAuditoria.crear(datos)
    return r?.ok ? r.id : null
  } catch (e) {
    console.error('[IA auditoría] no se pudo crear el registro', e)
    return null
  }
}

async function auditoriaActualizar(id, cambios) {
  if (!id) return
  try {
    await window.api.iaAuditoria.actualizar(id, cambios)
  } catch (e) {
    console.error('[IA auditoría] no se pudo actualizar el registro', e)
  }
}

// Huella SHA-256 del contenido: deja constancia de QUÉ archivo exacto se
// subió, aunque después se renombre o se borre.
async function sha256Hex(file) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

// Qué corrigió el usuario respecto a lo que extrajo el pipeline (comparando
// contra los valores originales que cada fila guarda desde que se creó).
function calcularEdiciones(msg) {
  const cambios = []
  const revisar = (fila, tipo) => {
    const nombreFinal = String(fila.nombre ?? '').trim()
    const cantFinal = fila.cantidad === '' || fila.cantidad === null || fila.cantidad === undefined ? null : Number(fila.cantidad)
    if (nombreFinal !== (fila.nombre_original ?? '') || cantFinal !== (fila.cantidad_original ?? null)) {
      cambios.push({
        tipo, nombre_original: fila.nombre_original ?? '', nombre_final: nombreFinal,
        cantidad_original: fila.cantidad_original ?? null, cantidad_final: cantFinal,
      })
    }
  }
  msg.resultado.nuevos.forEach(f => revisar(f, 'resuelto'))
  msg.resultado.existentes.forEach(f => revisar(f, 'resuelto'))
  ;(msg.revision || []).forEach(f => revisar(f, 'revision'))
  return cambios
}

// ─── Filas del Antes → Después de la tarjeta de resumen ───────────────────
// Refleja SIEMPRE el valor actual (editado o no) y el modo elegido: en
// "sumar" el "después" de un existente es anterior + archivo; en "reemplazar"
// es el valor del archivo. Sin modo elegido todavía, queda en ámbar pidiéndolo.
function filasComparacionResumen(resultado, modo) {
  const nuevos = resultado.nuevos.map(p => ({
    key: `n-${p.id}`, nombre: p.nombre, antes: null, despues: Number(p.cantidad), estado: 'nuevo',
  }))
  const existentes = resultado.existentes.map(p => {
    const cant = Number(p.cantidad)
    const valida = p.cantidad !== '' && Number.isFinite(cant)
    const despues = !valida ? null : modo === 'sumar' ? p.cantidadAnterior + cant : modo === 'reemplazar' ? cant : null
    let estado = despues === null ? 'atencion' : estadoDeCambio(p.cantidadAnterior, despues)
    let nota = null
    if (!valida) nota = 'Falta una cantidad válida'
    else if (despues === null) nota = 'Elige si se suma o se reemplaza para ver el resultado'
    else if (p.coincidencia === 'aproximada') {
      estado = 'atencion'
      nota = `Nombre parecido a "${p.nombreExistente}": verifica que sea el mismo producto`
    }
    return { key: `e-${p.id}`, nombre: p.nombreExistente, antes: p.cantidadAnterior, despues, estado, nota }
  })
  // Los existentes primero: son los que cambian un stock real y los que piden atención.
  return [...existentes, ...nuevos]
}

// ─── Persistencia local de conversaciones ─────────────────────────────────
// // TODO: reemplazar por guardado real (tabla propia vía window.api, o
// // archivo local) cuando exista el pipeline de IA — hoy usa localStorage
// // con el mismo patrón que ya usa el resto del proyecto (Ventas.jsx,
// // Caja.jsx: JSON.stringify/parse envuelto en try/catch, sin librería
// // propia ni sql.js del lado del renderer).
const STORAGE_KEY_CONVERSACIONES = 'ia_conversaciones'

function cargarConversaciones() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_CONVERSACIONES) || '[]') } catch { return [] }
}

// El "último lote" escrito en el inventario se guarda aparte: si el usuario
// se va a la pantalla de Inventario a comprobarlo y vuelve, sigue pudiendo
// deshacerlo. (deshacerLote igual se niega si algo cambió después.)
const STORAGE_KEY_ULTIMO_LOTE = 'ia_ultimo_lote'

function cargarUltimoLote() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_ULTIMO_LOTE) || 'null') } catch { return null }
}

function guardarUltimoLote(lote) {
  try {
    if (lote) localStorage.setItem(STORAGE_KEY_ULTIMO_LOTE, JSON.stringify(lote))
    else localStorage.removeItem(STORAGE_KEY_ULTIMO_LOTE)
  } catch { /* sin localStorage: el deshacer queda solo para esta sesión */ }
}

function guardarConversaciones(lista) {
  try { localStorage.setItem(STORAGE_KEY_CONVERSACIONES, JSON.stringify(lista)) } catch { /* localStorage lleno o no disponible — se pierde el historial de esta sesión, no es crítico */ }
}

// Agrupa por fecha relativa, mismo patrón que los chats de IA conocidos.
function agruparPorFecha(conversaciones) {
  const ahora = new Date()
  const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime()
  const inicioAyer = inicioHoy - 86400000
  const inicioSemana = inicioHoy - 6 * 86400000

  const grupos = { hoy: [], ayer: [], semana: [], anteriores: [] }
  conversaciones.forEach(c => {
    if (c.actualizadaEn >= inicioHoy) grupos.hoy.push(c)
    else if (c.actualizadaEn >= inicioAyer) grupos.ayer.push(c)
    else if (c.actualizadaEn >= inicioSemana) grupos.semana.push(c)
    else grupos.anteriores.push(c)
  })
  return [
    { etiqueta: 'Hoy', items: grupos.hoy },
    { etiqueta: 'Ayer', items: grupos.ayer },
    { etiqueta: 'Últimos 7 días', items: grupos.semana },
    { etiqueta: 'Anteriores', items: grupos.anteriores },
  ].filter(g => g.items.length > 0)
}

function formatearFecha(ts) {
  return new Date(ts).toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Junta los archivos adjuntos de TODAS las conversaciones para la biblioteca —
// usa el timestamp del mensaje que los trae (`creadoEn`), no el de la
// conversación entera, para que la fecha por archivo sea exacta.
function listarTodosLosArchivos(conversaciones) {
  const items = []
  conversaciones.forEach(conv => {
    conv.mensajes.forEach(m => {
      ;(m.archivos || []).forEach(a => {
        items.push({ ...a, conversacionId: conv.id, conversacionTitulo: conv.titulo, fecha: m.creadoEn || conv.actualizadaEn })
      })
    })
  })
  return items.sort((a, b) => b.fecha - a.fecha)
}

const MAX_ARCHIVOS = 10
const ACCEPT_ARCHIVOS = '.jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx,image/jpeg,image/png,image/webp,application/pdf'

// Si al enviar hay texto Y archivos, y el archivo más antiguo lleva más de
// esto adjuntado sin haberse enviado, probablemente es un adjunto "viejo"
// que quedó pegado en el compositor (p.ej. de un envío anterior bloqueado
// por `generando`) y no algo que el usuario quiera mandar junto con el
// texto nuevo — en ese caso no asumimos nada, se le pregunta.
const UMBRAL_ARCHIVO_VIEJO_MS = 12000

// ─── Conexión con el servicio real de OCR/estructuración (ver
// scripts/ocr_service.py y scripts/README.md) — procesa imágenes, Excel,
// Word y PDF con pipelines reales. Cada tipo de archivo tiene su propio
// endpoint y su propio campo de multipart/form-data (ver README para el
// detalle de cada uno).
const OCR_SERVICE_BASE = 'http://localhost:8420'

function extensionDe(archivo) {
  const nombre = (archivo.nombre || archivo.name || '').toLowerCase()
  const m = nombre.match(/\.([a-z0-9]+)$/)
  return m ? m[1] : ''
}

function esImagen(archivo) {
  return (archivo.type || '').startsWith('image/')
}

// Determina que endpoint del servicio real le corresponde a un archivo, o
// null si el formato no tiene pipeline real (se rechaza, no se inventa nada).
function endpointYCampoPara(archivo) {
  if (esImagen(archivo)) return { url: `${OCR_SERVICE_BASE}/procesar-imagen`, campo: 'imagen' }
  const ext = extensionDe(archivo)
  if (ext === 'xlsx' || ext === 'xls') return { url: `${OCR_SERVICE_BASE}/procesar-excel`, campo: 'archivo' }
  if (ext === 'docx' || ext === 'doc') return { url: `${OCR_SERVICE_BASE}/procesar-word`, campo: 'archivo' }
  if (ext === 'pdf') return { url: `${OCR_SERVICE_BASE}/procesar-pdf`, campo: 'archivo' }
  return null
}

// Motivo técnico (tal como lo devuelve el servicio) → frase clara para el
// usuario. Si en el futuro el servicio agrega un motivo nuevo que no está
// acá, se muestra el código crudo como fallback (mejor eso que romper la UI).
const MOTIVOS_HUMANOS = {
  fusion_extrema: 'Varios productos parecen estar mezclados en esta línea.',
  cobertura_incompleta: 'No logramos separar bien esta línea — revisa que no falte información.',
  origen_sospechoso: 'La cantidad detectada podría ser incorrecta (parece tomada del nombre del producto, no de un número real).',
  nombre_invalido: 'No pudimos identificar un nombre de producto válido en esta línea.',
  sin_cantidad: 'No pudimos leer la cantidad de este producto.',
}

function motivoHumano(motivo) {
  return MOTIVOS_HUMANOS[motivo] || `Necesita revisión (${motivo}).`
}

function fmtSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function iconoPorArchivo(archivo) {
  const nombre = (archivo.nombre || archivo.name || '').toLowerCase()
  if (archivo.type?.startsWith('image/')) return ImageIcon
  if (nombre.endsWith('.xlsx')) return FileSpreadsheet
  if (nombre.endsWith('.pdf') || nombre.endsWith('.docx')) return FileText
  return FileIcon
}

// ─── Indicador "escribiendo" — 3 puntos, componente NUEVO (no existía uno
// reutilizable en el proyecto), mismo lenguaje de spring/easing que el
// resto de la app (duration corta, easeOut, sin curva inventada) ────────
function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 2px' }}>
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeOut', delay: i * 0.15 }}
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'oklch(0.97 0.01 250)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.5)',
          }}
        />
      ))}
    </div>
  )
}

// ─── Chip de archivo adjunto (antes de enviar, o dentro de una burbuja ya
// enviada) ───────────────────────────────────────────────────────────────
function ArchivoChip({ archivo, onQuitar }) {
  const Icon = iconoPorArchivo(archivo)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'oklch(0.2 0.02 250 / .5)', border: '1px solid oklch(1 0 0 / .18)',
        borderRadius: 10, padding: '5px 8px 5px 6px', maxWidth: 180,
      }}
    >
      {archivo.preview ? (
        <img src={archivo.preview} alt="" style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <Icon size={15} color="oklch(0.88 0.01 250 / .85)" style={{ flexShrink: 0 }} />
      )}
      <span style={{
        fontSize: 11, color: 'oklch(0.97 0.01 250)', textShadow: '0 1px 2px rgba(0,0,0,0.6)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {archivo.nombre}
      </span>
      {onQuitar && (
        <button onClick={() => onQuitar(archivo.id)} className="clientes-action-icon" style={{ padding: 2, flexShrink: 0 }} title="Quitar">
          <X size={12} color="oklch(0.88 0.01 250 / .85)" />
        </button>
      )}
    </motion.div>
  )
}

// ─── Botón "copiar" en cada respuesta final de la IA — visual únicamente,
// copia el texto tal cual al portapapeles del sistema ─────────────────────
function BotonCopiar({ texto }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(texto) } catch { /* portapapeles no disponible */ }
        setCopiado(true)
        setTimeout(() => setCopiado(false), 1500)
      }}
      className="clientes-action-icon"
      style={{ padding: 3, marginTop: 6, alignSelf: 'flex-start' }}
      title="Copiar"
    >
      {copiado ? <Check size={12} color="oklch(0.78 0.16 155)" /> : <Copy size={12} color="oklch(0.88 0.01 250 / .85)" />}
    </button>
  )
}

// ─── Panel lateral (historial de conversaciones / biblioteca de archivos) —
// deslizamiento lateral con el mismo spring/timing que el drawer del
// TopNav (ver NavDrawer en components/layout/TopNav.jsx: x '-100%' → 0,
// duration 0.22 easeOut). Va montado vía portal para quedar por encima de
// todo el layout, igual que ModalConfirmarAccion. Reutiliza #dropdown-glass
// (no hay conflicto real entre backdrop-filters CSS compartidos entre
// varios elementos — a diferencia de las capas WebGL goo/metaball, que sí
// deben ir siempre separadas) ──────────────────────────────────────────────
// ─── Actividad de IA: cada importación registrada en ia_importaciones, con
// su antes → después real y la opción de restaurar. La restauración usa el
// deshacerLote de siempre (transaccional y con su chequeo de "el stock
// cambió después"): acá solo se muestra su motivo exacto si lo rechaza. ────
const ESTADOS_ACTIVIDAD = {
  agregado:   { texto: 'Agregado',   color: '#3fb950' },
  deshecho:   { texto: 'Deshecho',   color: '#8b949e' },
  cancelado:  { texto: 'Cancelado',  color: '#8b949e' },
  error:      { texto: 'Error',      color: '#f85149' },
  detenido:   { texto: 'Detenido',   color: '#8b949e' },
  pendiente:  { texto: 'Sin decidir', color: '#d29922' },
  procesando: { texto: 'Procesando', color: '#d29922' },
}

function leerJsonSeguro(texto, porDefecto) {
  try { return texto ? JSON.parse(texto) : porDefecto } catch { return porDefecto }
}

function PanelCambios({ usuario, onRestaurado }) {
  const [entradas, setEntradas] = useState(null) // null = cargando
  const [abierta, setAbierta] = useState(null)
  const [confirmando, setConfirmando] = useState(null)
  const [restaurando, setRestaurando] = useState(null)
  const [rechazos, setRechazos] = useState({}) // id → motivo exacto que devolvió deshacerLote

  const cargar = useCallback(async () => {
    try {
      const filas = await window.api.iaAuditoria.getAll({ limite: 100 })
      setEntradas(filas.map(f => {
        const final = leerJsonSeguro(f.resultado_final, null)
        return {
          id: f.id, fecha: f.fecha, resultado: f.resultado, detalle: f.detalle,
          archivos: leerJsonSeguro(f.archivos, []), guardado: final?.guardado || [], modo: final?.modo || null,
        }
      }))
    } catch {
      setEntradas([])
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function restaurar(entrada) {
    setRestaurando(entrada.id)
    setConfirmando(null)
    try {
      const r = await window.api.inventario.deshacerLote({
        items: entrada.guardado.map(g => ({
          accion: g.accion, producto_id: g.producto_id, nombre: g.nombre, stock_anterior: g.stock_anterior, stock_nuevo: g.stock_nuevo,
        })),
        auditoria_id: entrada.id, usuario_id: usuario?.id, usuario_nombre: usuario?.nombre_completo,
      })
      if (r?.ok) {
        await auditoriaActualizar(entrada.id, { detalle: 'Restaurado a su estado anterior desde el panel de actividad.' })
        setRechazos(prev => { const { [entrada.id]: _quitado, ...resto } = prev; return resto })
        onRestaurado(entrada.id)
        await cargar()
      } else {
        setRechazos(prev => ({ ...prev, [entrada.id]: r?.error || 'No se pudo restaurar (error desconocido).' }))
      }
    } catch (e) {
      setRechazos(prev => ({ ...prev, [entrada.id]: `No se pudo restaurar: ${e.message}` }))
    }
    setRestaurando(null)
  }

  if (entradas === null) return <div style={{ padding: '20px 10px', textAlign: 'center', fontSize: 12.5, color: 'oklch(0.88 0.01 250 / .6)' }}>Cargando…</div>
  if (entradas.length === 0) return <div style={{ padding: '20px 10px', textAlign: 'center', fontSize: 12.5, color: 'oklch(0.88 0.01 250 / .6)' }}>Todavía no hay importaciones registradas</div>

  return entradas.map(e => {
    const est = ESTADOS_ACTIVIDAD[e.resultado] || { texto: e.resultado, color: '#8b949e' }
    const creados = e.guardado.filter(g => g.accion === 'crear').length
    const actualizados = e.guardado.length - creados
    const abiertaEsta = abierta === e.id
    const puedeRestaurar = e.resultado === 'agregado' && e.guardado.length > 0
    return (
      <div key={e.id} data-testid={`actividad-${e.id}`} data-estado={e.resultado} style={{ marginBottom: 6, borderRadius: 10, border: '1px solid oklch(1 0 0 / .1)', background: 'oklch(0.11 0.02 250 / .4)' }}>
        <button
          onClick={() => setAbierta(abiertaEsta ? null : e.id)}
          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 11px', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--ink)', textShadow: '0 1px 2px rgba(0,0,0,.6)' }}>{formatearFecha(new Date(String(e.fecha).replace(' ', 'T')).getTime())}</span>
            <span style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 700, letterSpacing: '.05em', color: est.color, border: `1px solid ${est.color}`, borderRadius: 999, padding: '1px 8px' }}>{est.texto.toUpperCase()}</span>
            <ChevronRight size={13} color="oklch(0.88 0.01 250 / .7)" style={{ transform: abiertaEsta ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
          </div>
          <div style={{ fontSize: 11, color: 'oklch(0.88 0.01 250 / .7)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {e.guardado.length > 0
              ? `${creados} nuevo${creados === 1 ? '' : 's'} · ${actualizados} actualizado${actualizados === 1 ? '' : 's'}${e.modo ? ` (${e.modo === 'sumar' ? 'sumado' : 'reemplazado'})` : ''}`
              : (e.archivos.map(a => a.nombre).join(', ') || 'Sin archivos')}
          </div>
        </button>

        {abiertaEsta && (
          <div style={{ padding: '0 10px 10px' }}>
            {e.guardado.length > 0
              ? <ComparacionProductos titulo={e.resultado === 'deshecho' ? 'Lo que se había guardado' : 'Antes → Después'} subtitulo={e.resultado === 'deshecho' ? 'ya restaurado' : null} filas={filasDeLote(e.guardado)} maxHeight={260} />
              : <div style={{ fontSize: 11.5, color: 'oklch(0.88 0.01 250 / .7)', padding: '4px 2px' }}>{e.detalle || 'Esta importación no llegó a guardar productos.'}</div>}
            {e.guardado.length > 0 && e.detalle && <div style={{ fontSize: 11, color: 'oklch(0.88 0.01 250 / .7)', marginBottom: 6 }}>{e.detalle}</div>}
            {rechazos[e.id] && (
              <div role="alert" data-testid="motivo-rechazo" style={{ fontSize: 11.5, color: '#d29922', background: 'rgba(210,153,34,.10)', border: '1px solid rgba(210,153,34,.5)', borderRadius: 8, padding: '7px 10px', marginBottom: 8 }}>
                No se restauró nada. {rechazos[e.id]}
              </div>
            )}
            {puedeRestaurar && (confirmando === e.id ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11.5, color: 'var(--ink)', flex: 1 }}>¿Devolver todo a como estaba antes?</span>
                <button onClick={() => restaurar(e)} className="clientes-glass-btn btn-primary" style={{ padding: '5px 12px', fontSize: 11.5 }}>
                  <div className="clientes-glass-bg" /><span className="clientes-glass-content">Sí, restaurar</span>
                </button>
                <button onClick={() => setConfirmando(null)} className="clientes-glass-btn btn-secondary" style={{ padding: '5px 12px', fontSize: 11.5 }}>
                  <div className="clientes-glass-bg" /><span className="clientes-glass-content">No</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmando(e.id)}
                disabled={restaurando === e.id}
                className="clientes-glass-btn btn-secondary"
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                <div className="clientes-glass-bg" />
                <span className="clientes-glass-content">{restaurando === e.id ? 'Restaurando…' : 'Restaurar a antes'}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  })
}

function PanelLateral({ modo, conversaciones, conversacionActualId, busqueda, onBusqueda, onNuevaConversacion, onAbrirConversacionId, onClose, usuario, onRestaurado }) {
  if (!modo) return null
  const esHistorial = modo === 'historial'
  const esCambios = modo === 'cambios'

  const conversacionesFiltradas = esHistorial
    ? conversaciones.filter(c => c.titulo.toLowerCase().includes(busqueda.trim().toLowerCase()))
    : []
  const grupos = esHistorial ? agruparPorFecha(conversacionesFiltradas) : []
  const archivos = modo === 'archivos' ? listarTodosLosArchivos(conversaciones) : []

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="ia-panel-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 9400, background: 'oklch(0 0 0 / .35)', backdropFilter: 'blur(4px)' }}
      />
      <motion.div
        key="ia-panel"
        initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, width: esCambios ? 460 : 320, maxWidth: '100vw', zIndex: 9401,
          background: 'oklch(0.12 0.02 250 / .6)', backdropFilter: 'url(#dropdown-glass)', WebkitBackdropFilter: 'url(#dropdown-glass)',
          borderRight: '1px solid oklch(1 0 0 / .1)', boxShadow: '20px 0 50px oklch(0 0 0 / .4)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', textShadow: '0 1px 2px rgba(0,0,0,.6)' }}>
            {esHistorial ? 'Historial de conversaciones' : esCambios ? 'Actividad de IA' : 'Archivos adjuntos'}
          </span>
          <button onClick={onClose} className="clientes-action-icon" title="Cerrar">
            <X size={16} color="oklch(0.97 0.01 250)" />
          </button>
        </div>

        {esHistorial && (
          <div style={{ padding: '0 16px 12px' }}>
            <button onClick={onNuevaConversacion} className="clientes-glass-btn btn-primary" style={{ width: '100%', marginBottom: 10 }}>
              <div className="clientes-glass-bg" />
              <span className="clientes-glass-content"><Plus size={14} /> Nueva conversación</span>
            </button>
            <div style={{ position: 'relative' }}>
              <Search size={13} color="oklch(0.88 0.01 250 / .6)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                value={busqueda}
                onChange={e => onBusqueda(e.target.value)}
                placeholder="Buscar conversación..."
                style={{
                  width: '100%', background: 'oklch(0.2 0.02 250 / .5)', border: '1px solid oklch(1 0 0 / .18)',
                  borderRadius: 10, padding: '8px 12px 8px 30px', fontSize: 12.5,
                  color: 'oklch(0.97 0.01 250)', textShadow: '0 1px 2px rgba(0,0,0,.6)', outline: 'none',
                }}
              />
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 16px' }}>
          {esCambios ? (
            <PanelCambios usuario={usuario} onRestaurado={onRestaurado} />
          ) : esHistorial ? (
            grupos.length === 0 ? (
              <div style={{ padding: '20px 10px', textAlign: 'center', fontSize: 12.5, color: 'oklch(0.88 0.01 250 / .6)' }}>
                {conversaciones.length === 0 ? 'Todavía no hay conversaciones guardadas' : 'Sin resultados'}
              </div>
            ) : grupos.map(g => (
              <div key={g.etiqueta} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'oklch(0.88 0.01 250 / .6)', padding: '6px 8px' }}>
                  {g.etiqueta}
                </div>
                {g.items.map(c => (
                  <button
                    key={c.id}
                    onClick={() => onAbrirConversacionId(c.id)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 9,
                      background: c.id === conversacionActualId ? 'oklch(1 0 0 / .1)' : 'transparent',
                      border: c.id === conversacionActualId ? '1px solid oklch(1 0 0 / .18)' : '1px solid transparent',
                      cursor: 'pointer', marginBottom: 2,
                    }}
                  >
                    <div style={{ fontSize: 12.5, color: 'var(--ink)', textShadow: '0 1px 2px rgba(0,0,0,.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.titulo}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'oklch(0.88 0.01 250 / .6)', marginTop: 2 }}>{formatearFecha(c.actualizadaEn)}</div>
                  </button>
                ))}
              </div>
            ))
          ) : (
            archivos.length === 0 ? (
              <div style={{ padding: '20px 10px', textAlign: 'center', fontSize: 12.5, color: 'oklch(0.88 0.01 250 / .6)' }}>
                Todavía no adjuntaste archivos
              </div>
            ) : archivos.map(a => {
              const Icon = iconoPorArchivo(a)
              return (
                <div key={`${a.conversacionId}-${a.id}`} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 8px', borderRadius: 9 }}>
                  <Icon size={16} color="oklch(0.88 0.01 250 / .85)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--ink)', textShadow: '0 1px 2px rgba(0,0,0,.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.nombre}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'oklch(0.88 0.01 250 / .6)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {formatearFecha(a.fecha)} · {a.conversacionTitulo}
                    </div>
                  </div>
                  <button onClick={() => onAbrirConversacionId(a.conversacionId)} className="clientes-action-icon" style={{ flexShrink: 0 }} title="Ir a la conversación">
                    <ChevronRight size={14} color="oklch(0.88 0.01 250 / .85)" />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}

// ─── Sección "necesita tu revisión" — productos que el pipeline de OCR/IA
// no pudo resolver solo con confianza (ver requiere_revision del servicio,
// scripts/README.md). Cada item muestra el texto OCR crudo tal cual salió
// de la imagen, el motivo en lenguaje humano, y dos campos editables
// (nombre/cantidad) pre-rellenados con la sugerencia si el servicio la
// trae. Mientras falte completar alguno, "Confirmar y agregar" queda
// deshabilitado (ver TarjetaResumen) ────────────────────────────────────
function SeccionRevision({ revision, resuelto, onCambiar }) {
  if (!revision?.length) return null

  return (
    <div style={{ marginTop: 14, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <AlertTriangle size={14} color="oklch(0.82 0.14 75)" />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'oklch(0.82 0.14 75)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
          {revision.length} producto{revision.length === 1 ? '' : 's'} necesita{revision.length === 1 ? '' : 'n'} tu revisión
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {revision.map(item => {
          const incompleto = !item.nombre?.trim() || !cantidadValida(item.cantidad)
          return (
            <div
              key={item.id}
              style={{
                background: 'oklch(0.11 0.02 250 / .4)', borderRadius: 10, padding: '10px 12px',
                border: `1px solid ${incompleto && !resuelto ? 'oklch(0.82 0.14 75 / .35)' : 'oklch(1 0 0 / .08)'}`,
              }}
            >
              <div style={{ fontSize: 10.5, color: 'oklch(0.88 0.01 250 / .6)', marginBottom: 3 }}>
                Texto detectado: <span style={{ color: 'oklch(0.88 0.01 250 / .85)' }}>{(item.texto_ocr_crudo || []).join(' · ')}</span>
              </div>
              <div style={{ fontSize: 11, color: 'oklch(0.82 0.14 75)', marginBottom: 8, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                {motivoHumano(item.motivo)}
              </div>

              {resuelto ? (
                <div style={{ fontSize: 12, color: 'var(--ink)' }}>
                  {item.nombre?.trim() ? `${item.nombre} — ${item.cantidad} unidades` : 'Sin completar (no se agregó)'}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={item.nombre ?? ''}
                    onChange={e => onCambiar(item.id, 'nombre', e.target.value)}
                    placeholder="Nombre del producto"
                    style={{
                      flex: 1, background: 'oklch(0.2 0.02 250 / .5)', border: '1px solid oklch(1 0 0 / .18)',
                      borderRadius: 8, padding: '6px 10px', fontSize: 12, color: 'oklch(0.97 0.01 250)', outline: 'none',
                    }}
                  />
                  <input
                    value={item.cantidad ?? ''}
                    onChange={e => onCambiar(item.id, 'cantidad', e.target.value)}
                    placeholder="Cantidad"
                    type="number"
                    style={{
                      width: 90, background: 'oklch(0.2 0.02 250 / .5)', border: '1px solid oklch(1 0 0 / .18)',
                      borderRadius: 8, padding: '6px 10px', fontSize: 12, color: 'oklch(0.97 0.01 250)', outline: 'none',
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tarjeta de resumen — cards de color con contenido blanco+sombra, y
// una tabla adentro con distorsión propia + capa oscura, mismo patrón que
// el resto de la app (Ventas/Inventario). `resultado.nuevos/existentes`
// viene del pipeline real (scripts/ocr_service.py) ya comparado contra el
// inventario. `revision` son los
// productos que el servicio marcó como requiere_revision: el usuario los
// completa acá mismo antes de poder confirmar ────────────────────────────
// ─── Miniaturas de la(s) imagen(es) original(es) que generaron este
// resultado — para que el usuario pueda comparar directo contra la tabla
// sin tener que recordar qué decía la foto. Clic para ver en grande
// (lightbox simple, mismo overlay oscuro que el resto de modales). Solo
// existen para archivos de tipo imagen — Excel/Word/PDF no tienen preview
// visual, así que esto no aparece para esos formatos ─────────────────────
function ImagenesOriginales({ urls }) {
  const [ampliada, setAmpliada] = useState(null)
  if (!urls?.length) return null

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {urls.map((url, i) => (
          <img
            key={url}
            src={url}
            alt={`Imagen original ${i + 1}`}
            onClick={() => setAmpliada(url)}
            style={{
              height: 90, borderRadius: 8, objectFit: 'cover', cursor: 'zoom-in',
              border: '1px solid oklch(1 0 0 / .18)',
            }}
          />
        ))}
      </div>
      {ampliada && createPortal(
        <div
          onClick={() => setAmpliada(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9600, background: 'oklch(0 0 0 / .75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30, cursor: 'zoom-out',
          }}
        >
          <img src={ampliada} alt="Imagen original ampliada" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 8 }} />
        </div>,
        document.body
      )}
    </>
  )
}

// ─── Pregunta obligatoria: ¿las cantidades REEMPLAZAN el stock o se SUMAN? ─
// El sistema no puede adivinarlo (un conteo físico reemplaza, una compra
// suma), así que mientras haya productos "ya existe" no se puede confirmar
// sin elegir. Si todos son nuevos no hay ambigüedad y no se pregunta.
function PreguntaModoStock({ ejemplo, modoStock, onElegir }) {
  const opciones = [
    {
      valor: 'reemplazar',
      titulo: 'Esto es lo que tengo ahora',
      detalle: 'Reemplaza el stock actual (conteo físico).',
      cuenta: ejemplo ? `${ejemplo.nombre}: ${ejemplo.anterior} → ${ejemplo.cantidad}` : null,
    },
    {
      valor: 'sumar',
      titulo: 'Esto es lo que estoy agregando',
      detalle: 'Suma al stock actual (una compra o ingreso).',
      cuenta: ejemplo ? `${ejemplo.nombre}: ${ejemplo.anterior} + ${ejemplo.cantidad} = ${ejemplo.anterior + ejemplo.cantidad}` : null,
    },
  ]
  return (
    <div data-testid="pregunta-modo" style={{ marginTop: 6, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <AlertTriangle size={14} color="oklch(0.82 0.14 75)" />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'oklch(0.82 0.14 75)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
          Algunos productos ya existen: ¿qué representan estas cantidades?
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {opciones.map(o => {
          const activa = modoStock === o.valor
          return (
            <button
              key={o.valor}
              onClick={() => onElegir(o.valor)}
              aria-pressed={activa}
              style={{
                flex: '1 1 200px', textAlign: 'left', cursor: 'pointer', padding: '12px 14px', borderRadius: 12,
                background: activa ? 'oklch(1 0 0 / .14)' : 'oklch(0.11 0.02 250 / .4)',
                border: `1.5px solid ${activa ? 'oklch(1 0 0 / .7)' : 'oklch(1 0 0 / .14)'}`,
                boxShadow: activa ? '0 0 14px oklch(1 0 0 / .12)' : 'none',
                color: 'var(--ink)', transition: 'all .15s',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{o.titulo}</div>
              <div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 3 }}>{o.detalle}</div>
              {o.cuenta && <div style={{ fontSize: 11, marginTop: 6, fontFamily: 'ui-monospace, Consolas, monospace', color: 'oklch(0.82 0.14 75)' }}>{o.cuenta}</div>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TarjetaResumen({ resultado, revision, resuelto, imagenesOriginales, modoStock, onElegirModo, onConfirmar, onCancelar, onCambiarRevision, onCambiarResuelto, onTerminarEdicionNombre }) {
  const filas = [
    ...resultado.nuevos.map(p => ({ ...p, estado: 'nuevo', tipo: 'nuevos' })),
    ...resultado.existentes.map(p => ({ ...p, estado: 'existente', tipo: 'existentes' })),
  ]

  const itemInvalido = item => !item.nombre?.toString().trim() || !cantidadValida(item.cantidad)
  const pendientes = (revision || []).filter(itemInvalido)
  // Editar un producto ya "resuelto" y dejarlo sin nombre o sin cantidad
  // válida tampoco debería poder confirmarse — mismo criterio que revisión.
  const resueltosInvalidos = filas.filter(itemInvalido)
  const hayExistentes = resultado.existentes.length > 0
  const primerExistente = resultado.existentes[0]
  const modoPendiente = hayExistentes && !modoStock
  const puedeConfirmar = pendientes.length === 0 && resueltosInvalidos.length === 0 && !modoPendiente

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
      border: '1px solid transparent', borderLeft: '3px solid oklch(1 0 0 / .25)',
      borderRadius: 14, padding: '16px 18px', marginTop: 6,
      boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Sparkles size={16} color="oklch(0.78 0.16 250)" />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
          Resultado del análisis
        </span>
      </div>

      <ImagenesOriginales urls={imagenesOriginales} />

      <p style={{ fontSize: 13, color: 'oklch(0.97 0.01 250)', lineHeight: 1.6, marginBottom: 12, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
        Se encontraron <strong style={{ color: 'oklch(0.78 0.16 155)' }}>{resultado.nuevos.length} productos nuevos</strong> y{' '}
        <strong style={{ color: 'oklch(0.82 0.14 75)' }}>{resultado.existentes.length} que ya existen</strong> en tu inventario
        (se actualizará su cantidad){revision?.length > 0 ? `, además de ${revision.length} que necesitan tu revisión` : ''}.
      </p>
      {resultado.avisoComparacion && (
        <p style={{ fontSize: 11.5, color: 'oklch(0.82 0.14 75)', marginBottom: 10 }}>{resultado.avisoComparacion}</p>
      )}

      {/* Tabla de resultados resueltos automáticamente — distorsión suave +
          capa oscura + sombra en todo el contenido, mismo patrón que las
          tablas del resto de la app. Si TODO fue a revisión (ninguno se
          resolvió solo), no se muestra tabla vacía */}
      {filas.length > 0 && (
      <div style={{
        background: 'oklch(0.11 0.02 250 / .4)', backdropFilter: 'url(#clientes-table-glass)', WebkitBackdropFilter: 'url(#clientes-table-glass)',
        borderRadius: 10, overflow: 'hidden', marginBottom: resuelto ? 0 : 14,
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid oklch(1 0 0 / .08)' }}>
              <th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>Producto</th>
              <th style={{ padding: '7px 12px', textAlign: 'right', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>Cantidad</th>
              <th style={{ padding: '7px 12px', textAlign: 'right', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}></th>
            </tr>
          </thead>
          <tbody>
            {filas.map((p, i) => (
              <tr key={p.id} style={{ borderBottom: i < filas.length - 1 ? '1px solid oklch(1 0 0 / .05)' : 'none' }}>
                <td style={{ padding: '4px 8px', fontSize: 12, color: 'var(--ink)' }}>
                  {resuelto ? (
                    <span style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{p.nombre}</span>
                  ) : (
                    <input
                      value={p.nombre}
                      onChange={e => onCambiarResuelto(p.tipo, p.id, 'nombre', e.target.value)}
                      style={{
                        width: '100%', background: 'transparent', border: '1px solid transparent',
                        borderRadius: 6, padding: '3px 6px', fontSize: 12, color: 'var(--ink)',
                        textShadow: '0 1px 2px rgba(0,0,0,0.6)', outline: 'none', fontFamily: 'inherit',
                      }}
                      onFocus={e => { e.target.style.background = 'oklch(0.2 0.02 250 / .5)'; e.target.style.borderColor = 'oklch(1 0 0 / .18)' }}
                      onBlur={e => {
                        e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent'
                        onTerminarEdicionNombre(p.tipo, p.id)
                      }}
                    />
                  )}
                  {p.estado === 'existente' && (
                    <div style={{ fontSize: 10, padding: '0 6px 2px', color: 'oklch(0.82 0.14 75 / .9)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                      {p.coincidencia === 'aproximada' ? 'Parecido a' : 'Coincide con'}: {p.nombreExistente} · stock actual {p.cantidadAnterior}
                    </div>
                  )}
                </td>
                <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                  {resuelto ? (
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{p.cantidad}</span>
                  ) : (
                    <input
                      type="number"
                      value={p.cantidad}
                      onChange={e => onCambiarResuelto(p.tipo, p.id, 'cantidad', e.target.value)}
                      style={{
                        width: 70, background: 'transparent', border: '1px solid transparent',
                        borderRadius: 6, padding: '3px 6px', fontSize: 12, fontWeight: 600, color: 'var(--ink)',
                        textShadow: '0 1px 2px rgba(0,0,0,0.6)', textAlign: 'right', outline: 'none', fontFamily: 'inherit',
                      }}
                      onFocus={e => { e.target.style.background = 'oklch(0.2 0.02 250 / .5)'; e.target.style.borderColor = 'oklch(1 0 0 / .18)' }}
                      onBlur={e => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent' }}
                    />
                  )}
                </td>
                <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                    background: p.estado === 'nuevo' ? 'oklch(0.78 0.16 155 / .15)' : 'oklch(0.82 0.14 75 / .15)',
                    color: p.estado === 'nuevo' ? 'oklch(0.78 0.16 155)' : 'oklch(0.82 0.14 75)',
                    textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                  }}>
                    {p.estado === 'nuevo' ? 'NUEVO' : 'YA EXISTE'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {!resuelto && filas.length > 0 && (
        <ComparacionProductos
          titulo="Antes → Después"
          subtitulo={!hayExistentes ? null : modoStock === 'sumar' ? 'sumando al stock actual' : modoStock === 'reemplazar' ? 'reemplazando el stock actual' : 'falta elegir: sumar o reemplazar'}
          filas={filasComparacionResumen(resultado, modoStock)}
        />
      )}

      <SeccionRevision revision={revision} resuelto={resuelto} onCambiar={onCambiarRevision} />

      {!resuelto && hayExistentes && (
        <PreguntaModoStock
          ejemplo={primerExistente && !isNaN(Number(primerExistente.cantidad)) ? { nombre: primerExistente.nombreExistente, anterior: primerExistente.cantidadAnterior, cantidad: Number(primerExistente.cantidad) } : null}
          modoStock={modoStock}
          onElegir={onElegirModo}
        />
      )}

      {!resuelto && (
        <div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onCancelar} className="clientes-glass-btn btn-secondary" style={{ flex: 1 }}>
              <div className="clientes-glass-bg" />
              <span className="clientes-glass-content">Cancelar</span>
            </button>
            <button
              onClick={onConfirmar}
              disabled={!puedeConfirmar}
              className="clientes-glass-btn btn-primary"
              style={{ flex: 1, opacity: puedeConfirmar ? 1 : 0.45, cursor: puedeConfirmar ? 'pointer' : 'not-allowed' }}
            >
              <div className="clientes-glass-bg" />
              <span className="clientes-glass-content"><Check size={14} /> Confirmar y agregar</span>
            </button>
          </div>
          {!puedeConfirmar && (
            <div style={{ fontSize: 11, color: 'oklch(0.82 0.14 75)', textAlign: 'center', marginTop: 6 }}>
              {pendientes.length > 0 && (
                <div>Completa los {pendientes.length} producto{pendientes.length === 1 ? '' : 's'} pendiente{pendientes.length === 1 ? '' : 's'} de revisión</div>
              )}
              {modoPendiente && pendientes.length === 0 && resueltosInvalidos.length === 0 && (
                <div>Elige arriba si las cantidades reemplazan el stock o se suman a él</div>
              )}
              {resueltosInvalidos.length > 0 && (
                <div>Falta nombre o cantidad válida en {resueltosInvalidos.length} producto{resueltosInvalidos.length === 1 ? '' : 's'} de la tabla</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Confirmación Sí/No dentro del chat (deshacer) ────────────────────────
function ConfirmarSiNo({ resuelto, onSi, onNo }) {
  if (resuelto) return null
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      <button onClick={onSi} className="clientes-glass-btn btn-primary" style={{ padding: '6px 16px', fontSize: 12 }}>
        <div className="clientes-glass-bg" />
        <span className="clientes-glass-content">Sí</span>
      </button>
      <button onClick={onNo} className="clientes-glass-btn btn-secondary" style={{ padding: '6px 16px', fontSize: 12 }}>
        <div className="clientes-glass-bg" />
        <span className="clientes-glass-content">No</span>
      </button>
    </div>
  )
}

// ─── Burbuja de mensaje — usuario a la derecha, IA a la izquierda, ambas
// sobre #dropdown-glass (pedido explícito), nunca #historial-glass acá ───
function Burbuja({ msg, onConfirmarAgregado, onCancelarAgregado, onConfirmarEliminado, onCancelarEliminado, onCambiarRevision, onCambiarResuelto, onTerminarEdicionNombre, onElegirModo }) {
  const esUsuario = msg.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{ display: 'flex', justifyContent: esUsuario ? 'flex-end' : 'flex-start', marginBottom: 12 }}
    >
      <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: esUsuario ? 'flex-end' : 'flex-start' }}>
        {!esUsuario && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3, marginLeft: 2 }}>
            <Sparkles size={12} color="oklch(0.78 0.16 250)" />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', color: 'oklch(0.88 0.01 250 / .85)', textTransform: 'uppercase' }}>Asistente IA</span>
          </div>
        )}

        <div style={{
          background: esUsuario ? 'oklch(0.2 0.1 260 / .4)' : 'oklch(0.15 0.02 250 / .5)',
          backdropFilter: 'url(#dropdown-glass)', WebkitBackdropFilter: 'url(#dropdown-glass)',
          border: `1px solid ${esUsuario ? 'oklch(0.7 0.15 260 / .3)' : 'oklch(1 0 0 / .12)'}`,
          borderRadius: esUsuario ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          padding: '10px 14px',
          boxShadow: '0 8px 24px oklch(0 0 0 / .3)',
        }}>
          {msg.type === 'typing' && <TypingDots />}

          {msg.type === 'progress' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TypingDots />
              <span style={{ fontSize: 13, color: 'oklch(0.97 0.01 250)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{msg.texto}</span>
            </div>
          )}

          {(msg.type === 'text' || msg.type === 'success') && (
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                {msg.type === 'success' && (
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    style={{ flexShrink: 0, marginTop: 1 }}
                  >
                    <Check size={16} color="oklch(0.78 0.16 155)" />
                  </motion.div>
                )}
                <span style={{ fontSize: 13, color: 'oklch(0.97 0.01 250)', lineHeight: 1.5, textShadow: '0 1px 2px rgba(0,0,0,0.6)', whiteSpace: 'pre-wrap' }}>
                  {msg.texto}
                </span>
              </div>
              {!esUsuario && <BotonCopiar texto={msg.texto} />}
            </div>
          )}

          {msg.type === 'summary' && (
            <TarjetaResumen
              resultado={msg.resultado}
              revision={msg.revision}
              resuelto={msg.resuelto}
              imagenesOriginales={msg.imagenesOriginales}
              modoStock={msg.modoStock}
              onElegirModo={modo => onElegirModo(msg.id, modo)}
              onConfirmar={() => onConfirmarAgregado(msg.id)}
              onCancelar={() => onCancelarAgregado(msg.id)}
              onCambiarRevision={(itemId, campo, valor) => onCambiarRevision(msg.id, itemId, campo, valor)}
              onCambiarResuelto={(tipo, itemId, campo, valor) => onCambiarResuelto(msg.id, tipo, itemId, campo, valor)}
              onTerminarEdicionNombre={(tipo, itemId) => onTerminarEdicionNombre(msg.id, tipo, itemId)}
            />
          )}

          {msg.type === 'confirmarUndo' && (
            <div>
              <span style={{ fontSize: 13, color: 'oklch(0.97 0.01 250)', lineHeight: 1.5, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{msg.texto}</span>
              {!msg.resuelto && <ComparacionProductos titulo="Se revertirá" filas={msg.filasDiff} />}
              <ConfirmarSiNo
                resuelto={msg.resuelto}
                onSi={() => onConfirmarEliminado(msg.id)}
                onNo={() => onCancelarEliminado(msg.id)}
              />
            </div>
          )}

          {/* Archivos adjuntos al mensaje del usuario, como miniaturas dentro de su burbuja */}
          {msg.archivos?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: msg.texto ? 8 : 0 }}>
              {msg.archivos.map(a => <ArchivoChip key={a.id} archivo={a} />)}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Modal de confirmación estilo "permisos" — tono ámbar, checkbox de
// "no preguntar en esta sesión", aparece ANTES de aplicar cualquier
// cambio real al inventario (agregar o deshacer) ──────────────────────────
function ModalConfirmarAccion({ titulo, cuerpo, textoConfirmar, noPreguntar, onToggleNoPreguntar, onConfirm, onClose }) {
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .35)', backdropFilter: 'blur(8px)' }} />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.17, ease: [0.25, 0.1, 0.25, 1] }}
        style={{
          position: 'relative', zIndex: 1, width: '100%', maxWidth: 420,
          background: 'oklch(0.13 0.02 250 / .5)', backdropFilter: 'url(#clientes-table-glass)', WebkitBackdropFilter: 'url(#clientes-table-glass)',
          border: '1px solid oklch(0.82 0.14 75 / .4)', borderTop: '3px solid oklch(0.82 0.14 75)',
          borderRadius: 16, padding: '24px 26px',
          boxShadow: '0 20px 50px oklch(0 0 0 / .45)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10, flexShrink: 0,
            background: 'oklch(0.82 0.14 75 / .18)', border: '1px solid oklch(0.82 0.14 75 / .35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={20} color="oklch(0.82 0.14 75)" />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontFamily: 'var(--display)', fontSize: 15, fontWeight: 800, color: 'var(--ink)', letterSpacing: '.02em', margin: 0, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
              {titulo}
            </h3>
            <p style={{ fontSize: 13, color: 'oklch(0.88 0.01 250 / .85)', lineHeight: 1.6, margin: '8px 0 0', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
              {cuerpo}
            </p>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'oklch(0.88 0.01 250 / .85)', cursor: 'pointer', marginBottom: 18, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
          <input type="checkbox" checked={noPreguntar} onChange={onToggleNoPreguntar} />
          No volver a preguntarme en esta sesión
        </label>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="clientes-glass-btn btn-secondary" style={{ minWidth: 90 }}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content">Cancelar</span>
          </button>
          <button onClick={onConfirm} className="clientes-glass-btn" style={{ minWidth: 110, padding: '8px 18px', borderRadius: 9, fontSize: 13, fontWeight: 700 }}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content" style={{ color: 'oklch(0.82 0.14 75)' }}>{textoConfirmar}</span>
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Aviso de archivo adjunto "viejo" pendiente al enviar texto nuevo ──────
function ModalArchivoViejo({ archivos, onEnviarConArchivo, onQuitarArchivo, onClose }) {
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  const nombres = archivos.map(a => a.nombre).join(', ')

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .35)', backdropFilter: 'blur(8px)' }} />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.17, ease: [0.25, 0.1, 0.25, 1] }}
        style={{
          position: 'relative', zIndex: 1, width: '100%', maxWidth: 440,
          background: 'oklch(0.13 0.02 250 / .5)', backdropFilter: 'url(#clientes-table-glass)', WebkitBackdropFilter: 'url(#clientes-table-glass)',
          border: '1px solid oklch(0.82 0.14 75 / .4)', borderTop: '3px solid oklch(0.82 0.14 75)',
          borderRadius: 16, padding: '24px 26px',
          boxShadow: '0 20px 50px oklch(0 0 0 / .45)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10, flexShrink: 0,
            background: 'oklch(0.82 0.14 75 / .18)', border: '1px solid oklch(0.82 0.14 75 / .35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={20} color="oklch(0.82 0.14 75)" />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontFamily: 'var(--display)', fontSize: 15, fontWeight: 800, color: 'var(--ink)', letterSpacing: '.02em', margin: 0, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
              Tienes {archivos.length > 1 ? 'archivos' : 'un archivo'} sin enviar
            </h3>
            <p style={{ fontSize: 13, color: 'oklch(0.88 0.01 250 / .85)', lineHeight: 1.6, margin: '8px 0 0', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
              <strong>{nombres}</strong> lleva un rato adjuntado sin mandarse. ¿Lo mandas junto con este mensaje, o lo quitas y envías solo el texto?
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={onQuitarArchivo} className="clientes-glass-btn btn-secondary" style={{ minWidth: 90 }}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content">Quitar archivo</span>
          </button>
          <button onClick={onEnviarConArchivo} className="clientes-glass-btn" style={{ minWidth: 110, padding: '8px 18px', borderRadius: 9, fontSize: 13, fontWeight: 700 }}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content" style={{ color: 'oklch(0.82 0.14 75)' }}>Enviar junto</span>
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Estado vacío (bienvenida) ─────────────────────────────────────────────
function EstadoVacio() {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: '40px 20px', gap: 14,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: 'oklch(0.72 0.18 305 / .15)', border: '1px solid oklch(0.72 0.18 305 / .3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Sparkles size={26} color="oklch(0.78 0.16 250)" />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
          Asistente de inventario
        </div>
        <p style={{ fontSize: 13, color: 'oklch(0.88 0.01 250 / .85)', lineHeight: 1.6, maxWidth: 340, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
          Puedes escribirme o adjuntar fotos, PDF, Excel o Word de tu inventario y te ayudo a cargarlo.
        </p>
      </div>
    </div>
  )
}

// ─── Página principal ──────────────────────────────────────────────────────

let idCounter = 0
function nuevoId() { idCounter += 1; return `m${idCounter}-${Date.now()}` }

export default function ImportarIA() {
  const [mensajes, setMensajes] = useState([])
  const [texto, setTexto] = useState('')
  const [archivos, setArchivos] = useState([])
  const [avisoLimite, setAvisoLimite] = useState(false)
  const [noPreguntarSesion, setNoPreguntarSesion] = useState(false)
  const [modal, setModal] = useState(null) // { tipo: 'agregar'|'eliminar', mensajeId }
  const [avisoArchivoViejo, setAvisoArchivoViejo] = useState(null) // { contenido, archivosEnviados } — pausa el envío para preguntar
  const [generando, setGenerando] = useState(false)
  const { usuario } = useAuth()
  const abortRef = useRef(null) // AbortController de la petición HTTP en curso — "Detener" la cancela de verdad
  const auditoriaProcesoRef = useRef(null) // { id, crudo } de la importación en curso — para registrar un "Detener"
  const escribiendoRef = useRef(false) // evita doble escritura si se confirma dos veces seguidas
  const ultimoLoteRef = useRef(cargarUltimoLote()) // { items, totalNuevos } del último lote escrito (los `resultados` de importarLote) — para deshacer
  const idGeneracionActualRef = useRef(null) // id del mensaje "typing/progress" en curso — para poder Detener
  const fileInputRef = useRef(null)
  const scrollRef = useRef(null)
  const timeoutsRef = useRef([])

  // ─── Historial de conversaciones (persistido en localStorage, ver
  // cargarConversaciones/guardarConversaciones arriba) ────────────────────
  const [conversaciones, setConversaciones] = useState(() => cargarConversaciones())
  const [conversacionActualId, setConversacionActualId] = useState(null)
  const [panelAbierto, setPanelAbierto] = useState(null) // null | 'historial' | 'archivos' | 'cambios'
  const [busquedaHistorial, setBusquedaHistorial] = useState('')
  const saltarProximoGuardadoRef = useRef(false) // evita "tocar" la fecha de una conversación solo por abrirla

  useEffect(() => () => {
    timeoutsRef.current.forEach(clearTimeout)
    abortRef.current?.abort()
    if (auditoriaProcesoRef.current) {
      auditoriaActualizar(auditoriaProcesoRef.current.id, {
        resultado: 'detenido', crudo: auditoriaProcesoRef.current.crudo, detalle: 'El usuario salió de la pantalla mientras se procesaba.',
      })
    }
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [mensajes])

  // Guarda/actualiza la conversación actual apenas tiene al menos un
  // mensaje — mismo patrón de persistencia que el resto del proyecto
  // (ver cargarConversaciones/guardarConversaciones). El título se fija
  // una sola vez, con las primeras palabras del primer mensaje.
  useEffect(() => {
    if (mensajes.length === 0) return
    if (saltarProximoGuardadoRef.current) { saltarProximoGuardadoRef.current = false; return }

    const ahora = Date.now()
    const id = conversacionActualId || nuevoId()
    if (!conversacionActualId) setConversacionActualId(id)

    const primerMensajeUsuario = mensajes.find(m => m.role === 'user')
    const tituloBase = primerMensajeUsuario?.texto?.trim()
      ? primerMensajeUsuario.texto.trim().slice(0, 60)
      : primerMensajeUsuario?.archivos?.length
        ? `${primerMensajeUsuario.archivos.length} archivo(s) adjuntos`
        : 'Nueva conversación'

    setConversaciones(prev => {
      const existente = prev.find(c => c.id === id)
      const actualizada = {
        id,
        titulo: existente?.titulo || tituloBase,
        creadaEn: existente?.creadaEn || ahora,
        actualizadaEn: ahora,
        mensajes,
      }
      const nueva = [actualizada, ...prev.filter(c => c.id !== id)]
      guardarConversaciones(nueva)
      return nueva
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensajes])

  function agregarTimeout(fn, ms) {
    const id = setTimeout(fn, ms)
    timeoutsRef.current.push(id)
    return id
  }

  function actualizarMensaje(id, cambios) {
    setMensajes(prev => prev.map(m => (m.id === id ? { ...m, ...cambios } : m)))
  }

  function detenerGeneracion() {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    if (idGeneracionActualRef.current) {
      actualizarMensaje(idGeneracionActualRef.current, { type: 'text', texto: 'Generación detenida.' })
      idGeneracionActualRef.current = null
    }
    // Cancela la petición HTTP que esté en vuelo (no solo el bucle entre archivos).
    abortRef.current?.abort()
    abortRef.current = null
    if (auditoriaProcesoRef.current) {
      auditoriaActualizar(auditoriaProcesoRef.current.id, {
        resultado: 'detenido', crudo: auditoriaProcesoRef.current.crudo, detalle: 'El usuario apretó "Detener" mientras se procesaba.',
      })
      auditoriaProcesoRef.current = null
    }
    setGenerando(false)
  }

  function nuevaConversacion() {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    abortRef.current?.abort()
    idGeneracionActualRef.current = null
    setGenerando(false)
    setMensajes([])
    setConversacionActualId(null)
    setModal(null)
    setTexto('')
    setArchivos([])
    setPanelAbierto(null)
  }

  function abrirConversacionId(id) {
    const conv = conversaciones.find(c => c.id === id)
    if (!conv) return
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    abortRef.current?.abort()
    idGeneracionActualRef.current = null
    setGenerando(false)
    saltarProximoGuardadoRef.current = true
    setMensajes(conv.mensajes)
    setConversacionActualId(conv.id)
    setModal(null)
    setPanelAbierto(null)
  }

  // ─── Adjuntar archivos ───────────────────────────────────────────────
  // El objeto File nativo NO se guarda en el estado `archivos` (ese estado
  // se persiste a localStorage vía guardarConversaciones, y un File no
  // sobrevive JSON.stringify) — se guarda aparte en este ref, indexado por
  // el mismo id, solo para poder mandarlo al servicio real al enviar.
  const archivosFileMapRef = useRef(new Map())

  function handleSeleccionArchivos(e) {
    const nuevos = Array.from(e.target.files || [])
    e.target.value = '' // permite volver a elegir el mismo archivo después
    if (nuevos.length === 0) return

    setArchivos(prev => {
      const espacio = MAX_ARCHIVOS - prev.length
      const aAgregar = nuevos.slice(0, Math.max(0, espacio))
      if (nuevos.length > espacio) {
        setAvisoLimite(true)
        agregarTimeout(() => setAvisoLimite(false), 3000)
      }
      const conPreview = aAgregar.map(f => {
        const id = nuevoId()
        archivosFileMapRef.current.set(id, f)
        return {
          id,
          nombre: f.name,
          tamano: f.size,
          type: f.type,
          preview: f.type?.startsWith('image/') ? URL.createObjectURL(f) : null,
          adjuntadoEn: Date.now(),
        }
      })
      return [...prev, ...conPreview]
    })
  }

  function quitarArchivo(id) {
    archivosFileMapRef.current.delete(id)
    setArchivos(prev => prev.filter(a => a.id !== id))
  }

  // ─── Detectar intención de "deshacer" en texto libre ─────────────────
  // // TODO: reemplazar por NLU real — hoy es un regex simple sobre
  // // palabras clave, ver BRIEF_IA_OCR_INVENTARIO.md.
  function esIntencionDeshacer(txt) {
    return /elimin|borr|deshac|equivoqu|revert/i.test(txt)
  }

  // ─── Enviar mensaje ────────────────────────────────────────────────────
  function handleEnviar() {
    // Guard defensivo: con `generando` activo no debería poder llegar
    // acá (botón deshabilitado, Enter ignorado), pero si algo más lo
    // invoca de todos modos, mejor no mandar un segundo mensaje que pise
    // la respuesta en curso en silencio.
    if (generando) return
    const contenido = texto.trim()
    if (!contenido && archivos.length === 0) return

    const archivosEnviados = archivos

    // Hay texto Y archivos a la vez: esto es normal cuando el usuario
    // realmente quiere mandar ambos juntos ("aquí está mi lista" + foto).
    // Pero si el archivo lleva rato adjuntado sin enviarse, es más probable
    // que sea uno "viejo" que quedó pegado del compositor — no lo asumimos,
    // preguntamos antes de mandar nada.
    if (contenido && archivosEnviados.length > 0) {
      const masAntiguo = Math.min(...archivosEnviados.map(a => a.adjuntadoEn || Date.now()))
      if (Date.now() - masAntiguo > UMBRAL_ARCHIVO_VIEJO_MS) {
        setAvisoArchivoViejo({ contenido, archivosEnviados })
        return
      }
    }

    enviarConfirmado(contenido, archivosEnviados)
  }

  function enviarConfirmado(contenido, archivosEnviados) {
    setMensajes(prev => [...prev, { id: nuevoId(), role: 'user', type: 'text', texto: contenido, archivos: archivosEnviados, creadoEn: Date.now() }])
    setTexto('')
    setArchivos([])

    if (archivosEnviados.length > 0) {
      procesarArchivos(archivosEnviados)
      return
    }

    if (esIntencionDeshacer(contenido)) {
      responderDeshacer()
      return
    }

    // Texto libre sin archivos ni intención de deshacer — el Agente
    // Supervisor clasifica la intención (importar sin adjuntar / pregunta
    // sobre el sistema / charla general) y responde acorde.
    responderConsultaTexto(contenido)
  }

  // ─── Resolver el aviso de "archivo viejo pendiente" ───────────────────
  function confirmarEnviarConArchivoViejo() {
    if (!avisoArchivoViejo) return
    const { contenido, archivosEnviados } = avisoArchivoViejo
    setAvisoArchivoViejo(null)
    enviarConfirmado(contenido, archivosEnviados)
  }

  function confirmarQuitarArchivoViejo() {
    if (!avisoArchivoViejo) return
    const { contenido, archivosEnviados } = avisoArchivoViejo
    archivosEnviados.forEach(a => archivosFileMapRef.current.delete(a.id))
    setArchivos(prev => prev.filter(a => !archivosEnviados.some(v => v.id === a.id)))
    setAvisoArchivoViejo(null)
    enviarConfirmado(contenido, [])
  }

  // ─── Agente Supervisor: clasifica la intención de un mensaje de texto
  // (sin archivos adjuntos — con archivos, siempre es "importar" y no vale
  // la pena preguntarle al LLM, ver procesarArchivos) y responde acorde.
  // Nunca pasa por la tarjeta de resumen/diff: eso es solo para
  // resultados de importación real. ────────────────────────────────────
  async function responderConsultaTexto(contenido) {
    const idTyping = nuevoId()
    idGeneracionActualRef.current = idTyping
    setGenerando(true)
    setMensajes(prev => [...prev, { id: idTyping, role: 'ai', type: 'typing' }])
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const resp = await fetch(`${OCR_SERVICE_BASE}/asistente-texto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: contenido }),
        signal: controller.signal,
      })
      if (!resp.ok) throw new Error(`El servicio respondió ${resp.status}`)
      const data = await resp.json()
      if (idGeneracionActualRef.current !== idTyping) return // se apretó "Detener"
      actualizarMensaje(idTyping, { type: 'text', texto: data.respuesta })
    } catch (err) {
      if (idGeneracionActualRef.current !== idTyping) return
      actualizarMensaje(idTyping, {
        type: 'text',
        texto: 'No pude conectarme al asistente (localhost:8420). Igual podés adjuntar fotos, Excel, Word o PDF de tu inventario con el botón "+".',
      })
    }
    idGeneracionActualRef.current = null
    setGenerando(false)
  }

  // Convierte una entrada requiere_revision del servicio (ver
  // scripts/README.md) en un item editable para SeccionRevision — con id
  // propio (no el "grupo_N"/"fila_N" del servicio, para no chocar entre
  // varias imágenes) y nombre/cantidad pre-rellenados con la sugerencia.
  function revisionDesdeServicio(r) {
    return {
      id: nuevoId(),
      texto_ocr_crudo: r.texto_ocr_crudo || [],
      nombre: r.nombre_sugerido || '',
      cantidad: r.cantidad_sugerida ?? '',
      nombre_original: r.nombre_sugerido || '',
      cantidad_original: r.cantidad_sugerida ?? null,
      motivo: r.motivo,
    }
  }

  // ─── Análisis real de archivos ─────────────────────────────────────────
  // Imagen, Excel, Word y PDF van al servicio real (ver
  // scripts/ocr_service.py, localhost:8420) — cada uno a su propio
  // endpoint (endpointYCampoPara). // TODO: cualquier otro formato que
  // llegue a adjuntarse (no debería, ACCEPT_ARCHIVOS ya lo filtra) cae al
  // mock, ya que no hay pipeline real para nada fuera de esos 4 tipos.
  async function procesarArchivos(archivosEnviados) {
    const idProceso = nuevoId()
    idGeneracionActualRef.current = idProceso
    setGenerando(true)
    setMensajes(prev => [...prev, { id: idProceso, role: 'ai', type: 'typing' }])

    const controller = new AbortController()
    abortRef.current = controller

    const conPipelineReal = archivosEnviados.filter(a => endpointYCampoPara(a))
    const sinPipeline = archivosEnviados.filter(a => !endpointYCampoPara(a))

    const resueltosTotal = []
    const revisionTotal = []
    let huboErrorServicio = false
    const archivosConError = []

    // Auditoría: el registro nace AHORA (antes de procesar), así también
    // quedan constancia los errores y los "Detener".
    const archivosInfo = await Promise.all(archivosEnviados.map(async a => ({
      nombre: a.nombre, tamano: a.tamano, tipo: a.type || extensionDe(a),
      sha256: archivosFileMapRef.current.get(a.id) ? await sha256Hex(archivosFileMapRef.current.get(a.id)) : null,
      endpoint: endpointYCampoPara(a)?.url ?? null,
    })))
    const crudoAuditoria = []
    const auditoriaId = await auditoriaCrear({
      usuario_id: usuario?.id, usuario_nombre: usuario?.nombre_completo, archivos: archivosInfo, resultado: 'procesando',
    })
    auditoriaProcesoRef.current = auditoriaId ? { id: auditoriaId, crudo: crudoAuditoria } : null
    // Previews (object URL) de las imágenes procesadas — para mostrarlas
    // junto al resultado y que el usuario pueda comparar sin tener que
    // recordar qué decía la foto. Excel/Word/PDF no tienen preview visual
    // (no son imágenes), así que solo se juntan las que sí la tienen.
    const imagenesOriginales = conPipelineReal.filter(a => esImagen(a) && a.preview).map(a => a.preview)

    for (let i = 0; i < conPipelineReal.length; i++) {
      // Si el usuario apretó "Detener" mientras procesábamos un archivo
      // anterior, no seguimos con los que faltan ni pisamos su mensaje
      // (y el fetch en curso ya lo canceló el AbortController).
      if (idGeneracionActualRef.current !== idProceso) return

      const archivo = conPipelineReal[i]
      const { url, campo } = endpointYCampoPara(archivo)
      actualizarMensaje(idProceso, {
        type: 'progress',
        texto: conPipelineReal.length > 1
          ? `Analizando ${archivo.nombre} (${i + 1} de ${conPipelineReal.length}) — puede tardar unos minutos en esta máquina...`
          : `Analizando ${archivo.nombre} (puede tardar unos minutos en esta máquina)...`,
      })

      const file = archivosFileMapRef.current.get(archivo.id)
      if (!file) continue // no debería pasar; por seguridad no rompe el resto del lote

      try {
        const formData = new FormData()
        formData.append(campo, file, archivo.nombre)
        const resp = await fetch(url, { method: 'POST', body: formData, signal: controller.signal })
        if (!resp.ok) throw new Error(`El servicio respondió ${resp.status}`)
        const data = await resp.json()
        crudoAuditoria.push({ archivo: archivo.nombre, respuesta: data })
        // `id` propio (no viene del servicio) para poder editar cada
        // producto resuelto en la tarjeta de resumen sin depender del
        // nombre como key (el nombre es justo uno de los campos editables).
        resueltosTotal.push(...(data.resueltos || []).map(item => ({ ...item, id: nuevoId(), nombre_original: item.nombre, cantidad_original: item.cantidad })))
        revisionTotal.push(...(data.requiere_revision || []).map(revisionDesdeServicio))
      } catch (err) {
        if (err?.name === 'AbortError') return // el usuario detuvo el proceso; ya quedó registrado como 'detenido'
        huboErrorServicio = true
        archivosConError.push(archivo.nombre)
        crudoAuditoria.push({ archivo: archivo.nombre, error: err.message })
      }
    }

    if (idGeneracionActualRef.current !== idProceso) return

    // Formatos sin pipeline real (no debería pasar con el ACCEPT_ARCHIVOS
    // actual): NO se inventan datos — con escritura real al inventario, un
    // mock acabaría como productos falsos guardados. Se avisa y se ignoran.
    if (sinPipeline.length > 0 && resueltosTotal.length === 0 && revisionTotal.length === 0) {
      actualizarMensaje(idProceso, {
        type: 'text',
        texto: `No puedo leer este formato todavía: ${sinPipeline.map(a => a.nombre).join(', ')}. Acepto fotos (JPG/PNG/WEBP), Excel (.xlsx), Word (.docx) y PDF.`,
      })
      auditoriaActualizar(auditoriaId, { resultado: 'error', crudo: crudoAuditoria, detalle: 'Formato de archivo no soportado.' })
      auditoriaProcesoRef.current = null
      idGeneracionActualRef.current = null
      setGenerando(false)
      return
    }

    if (huboErrorServicio && resueltosTotal.length === 0 && revisionTotal.length === 0) {
      actualizarMensaje(idProceso, {
        type: 'text',
        texto: 'No pude conectarme al servicio de análisis (localhost:8420). Verificá que esté corriendo (venv-ocr\\Scripts\\python.exe scripts\\ocr_service.py) e intentá de nuevo.',
      })
      auditoriaActualizar(auditoriaId, { resultado: 'error', crudo: crudoAuditoria, detalle: 'No se pudo procesar ningún archivo (servicio no disponible o respondió con error).' })
      auditoriaProcesoRef.current = null
      idGeneracionActualRef.current = null
      setGenerando(false)
      return
    }

    // Compara contra el inventario real ANTES de mostrar la tarjeta: lo que ya
    // existe se marca "se actualizará cantidad" en vez de tratarse como nuevo.
    // Si no se pudo leer el inventario, todo queda como nuevo y se avisa.
    const { inventario, ok: inventarioLeido } = await leerInventarioReal()
    if (idGeneracionActualRef.current !== idProceso) return
    const clasificados = clasificarContraInventario(resueltosTotal, inventario)

    const resultado = {
      nuevos: clasificados.nuevos,
      existentes: clasificados.existentes,
      // Todo lo que NO se pudo procesar se le dice al usuario; nada se pierde en silencio.
      avisoComparacion: [
        inventarioLeido ? null : 'No pude leer el inventario para compararlo: todo se muestra como nuevo. Revisa antes de confirmar.',
        archivosConError.length > 0 ? `No pude procesar: ${archivosConError.join(', ')}. Sus productos NO están en esta lista.` : null,
        sinPipeline.length > 0 ? `Ignoré ${sinPipeline.length} archivo(s) de formato no soportado.` : null,
      ].filter(Boolean).join(' ') || null,
    }

    auditoriaActualizar(auditoriaId, {
      resultado: 'pendiente', crudo: crudoAuditoria,
      detalle: archivosConError.length > 0 ? `Archivos con error: ${archivosConError.join(', ')}` : null,
    })
    auditoriaProcesoRef.current = null
    actualizarMensaje(idProceso, { type: 'summary', resultado, revision: revisionTotal, resuelto: false, imagenesOriginales, auditoriaId })
    idGeneracionActualRef.current = null
    setGenerando(false)
  }

  // ─── Confirmar/cancelar el resumen (agregar al inventario) ────────────
  function cambiarCampoRevision(mensajeId, itemId, campo, valor) {
    setMensajes(prev => prev.map(m => {
      if (m.id !== mensajeId) return m
      return { ...m, revision: (m.revision || []).map(r => (r.id === itemId ? { ...r, [campo]: valor } : r)) }
    }))
  }

  // Mismo patrón que cambiarCampoRevision, pero para los productos que ya
  // vinieron "resueltos" (tabla nuevos/existentes) — el usuario puede
  // corregir nombre o cantidad ahí tambien antes de confirmar, no solo en
  // los de revisión. `tipo` es 'nuevos' o 'existentes'.
  function cambiarCampoResuelto(mensajeId, tipo, itemId, campo, valor) {
    setMensajes(prev => prev.map(m => {
      if (m.id !== mensajeId) return m
      return {
        ...m,
        resultado: {
          ...m.resultado,
          [tipo]: m.resultado[tipo].map(p => (p.id === itemId ? { ...p, [campo]: valor } : p)),
        },
      }
    }))
  }

  // Se llama al TERMINAR de editar el nombre de un producto resuelto (onBlur,
  // no en cada tecla): el nombre nuevo puede coincidir —o dejar de coincidir—
  // con un producto real, y eso cambia si se crea uno nuevo o se actualiza
  // uno existente. Re-clasifica solo esa fila contra el inventario actual.
  async function reclasificarFilaResuelta(mensajeId, tipo, itemId) {
    const { inventario } = await leerInventarioReal()
    setMensajes(prev => prev.map(m => {
      if (m.id !== mensajeId || m.resuelto) return m
      const fila = m.resultado[tipo].find(p => p.id === itemId)
      if (!fila) return m
      const { nuevos, existentes } = clasificarContraInventario([fila], inventario)
      const nueva = nuevos[0] || existentes[0]
      const nuevoTipo = nuevos[0] ? 'nuevos' : 'existentes'
      if (nuevoTipo === tipo) {
        return { ...m, resultado: { ...m.resultado, [tipo]: m.resultado[tipo].map(p => (p.id === itemId ? nueva : p)) } }
      }
      return {
        ...m,
        resultado: {
          ...m.resultado,
          [tipo]: m.resultado[tipo].filter(p => p.id !== itemId),
          [nuevoTipo]: [...m.resultado[nuevoTipo], nueva],
        },
      }
    }))
  }

  function itemRevisionCompleto(item) {
    return !!item.nombre?.trim() && cantidadValida(item.cantidad)
  }

  // Junta lo que se resolvió solo (msg.resultado) con lo que el usuario
  // completó a mano en la sección de revisión — este es el lote que
  // realmente se agrega al confirmar, no msg.resultado a secas.
  function construirResultadoFinal(msg) {
    const completados = (msg.revision || [])
      .filter(itemRevisionCompleto)
      .map(r => ({ nombre: r.nombre.trim(), cantidad: Number(r.cantidad) }))
    const nuevos = [...msg.resultado.nuevos, ...completados]
    return {
      ...msg.resultado,
      nuevos,
      totalNuevos: nuevos.length,
      totalExistentes: msg.resultado.existentes.length,
    }
  }

  function pedirConfirmarAgregado(mensajeId) {
    if (noPreguntarSesion) { ejecutarAgregado(mensajeId); return }
    setModal({ tipo: 'agregar', mensajeId })
  }

  function cancelarAgregado(mensajeId) {
    const msg = mensajes.find(m => m.id === mensajeId)
    if (msg) auditoriaActualizar(msg.auditoriaId, { resultado: 'cancelado', ediciones: calcularEdiciones(msg), detalle: 'El usuario canceló antes de agregar.' })
    actualizarMensaje(mensajeId, { resuelto: true })
    agregarTimeout(() => {
      setMensajes(prev => [...prev, { id: nuevoId(), role: 'ai', type: 'text', texto: 'Sin problema, no agregué nada. Avisame si querés que lo intente de nuevo.' }])
    }, 300)
  }

  // Escritura REAL al inventario. Todo o nada: `importarLote` corre en una
  // sola transacción en electron/database.cjs — si algo falla, no queda nada
  // escrito y la tarjeta sigue ahí para reintentar. La decisión crear/actualizar
  // se toma de nuevo AQUÍ contra el inventario del momento (pudo cambiar desde
  // que se mostró la tarjeta), con el mismo comparador conservador.
  async function ejecutarAgregado(mensajeId) {
    if (escribiendoRef.current) return
    setModal(null)
    const msg = mensajes.find(m => m.id === mensajeId)
    if (!msg) return
    escribiendoRef.current = true
    try {
      const filas = [
        ...msg.resultado.nuevos,
        ...msg.resultado.existentes,
        ...(msg.revision || []).filter(itemRevisionCompleto),
      ]
      const { inventario, ok } = await leerInventarioReal()
      if (!ok) throw new Error('No pude leer el inventario para comprobar duplicados, así que no escribí nada.')
      const { nuevos, existentes } = clasificarContraInventario(
        filas.map(f => ({ id: f.id, nombre: String(f.nombre).trim(), cantidad: Number(f.cantidad) })),
        inventario,
      )
      const items = [
        ...nuevos.map(n => ({ accion: 'crear', nombre: n.nombre, cantidad: n.cantidad })),
        ...existentes.map(e => ({ accion: 'actualizar', producto_id: e.producto_id, nombre: e.nombreExistente, cantidad: e.cantidad })),
      ]
      if (existentes.length > 0 && !msg.modoStock) {
        throw new Error('Falta elegir si las cantidades reemplazan el stock o se suman a él.')
      }
      const r = await window.api.inventario.importarLote({
        items, modo: existentes.length > 0 ? msg.modoStock : undefined, usuario_id: usuario?.id, usuario_nombre: usuario?.nombre_completo,
      })
      if (!r?.ok) throw new Error(r?.error || 'Error desconocido al escribir en el inventario.')

      // Lee de vuelta el stock real de cada producto (no confía solo en la respuesta).
      const { inventario: despues } = await leerInventarioReal()
      const resultados = r.resultados.map(x => ({
        ...x, stock_real: despues.find(p => p.id === x.producto_id)?.stock ?? x.stock_nuevo,
      }))
      ultimoLoteRef.current = { items: r.resultados, totalNuevos: r.resultados.filter(x => x.accion === 'crear').length, auditoriaId: msg.auditoriaId ?? null }
      guardarUltimoLote(ultimoLoteRef.current)
      auditoriaActualizar(msg.auditoriaId, {
        resultado: 'agregado',
        ediciones: calcularEdiciones(msg),
        final: {
          modo: existentes.length > 0 ? msg.modoStock : null,
          guardado: resultados,
          omitidos_sin_completar: (msg.revision || []).filter(f => !itemRevisionCompleto(f)).map(f => ({ texto_ocr_crudo: f.texto_ocr_crudo, motivo: f.motivo })),
        },
        detalle: msg.intentosFallidos ? `Guardado tras ${msg.intentosFallidos} intento(s) fallido(s).` : null,
      })
      actualizarMensaje(mensajeId, { resuelto: true })
      agregarTimeout(() => {
        setMensajes(prev => [...prev, { id: nuevoId(), role: 'ai', type: 'success', texto: textoResultadoAgregado(resultados) }])
      }, 300)
    } catch (err) {
      auditoriaActualizar(msg.auditoriaId, { resultado: 'error', ediciones: calcularEdiciones(msg), detalle: `No se guardó nada: ${err.message}` })
      actualizarMensaje(mensajeId, { intentosFallidos: (msg.intentosFallidos || 0) + 1 })
      setMensajes(prev => [...prev, {
        id: nuevoId(), role: 'ai', type: 'text',
        texto: `No se guardó nada en el inventario: ${err.message}\n\nPuedes corregirlo en la tarjeta y volver a confirmar.`,
      }])
    } finally {
      escribiendoRef.current = false
    }
  }

  // ─── Deshacer último lote ──────────────────────────────────────────────
  function responderDeshacer() {
    const idTyping = nuevoId()
    idGeneracionActualRef.current = idTyping
    setGenerando(true)
    setMensajes(prev => [...prev, { id: idTyping, role: 'ai', type: 'typing' }])
    agregarTimeout(() => {
      idGeneracionActualRef.current = null
      setGenerando(false)
      if (!ultimoLoteRef.current) {
        actualizarMensaje(idTyping, { type: 'text', texto: 'No encuentro ningún lote reciente para deshacer en esta sesión.' })
        return
      }
      actualizarMensaje(idTyping, {
        type: 'confirmarUndo', resuelto: false,
        texto: `¿Quieres que revierta el último lote? ${ultimoLoteRef.current.totalNuevos} producto(s) nuevo(s) se eliminarán y ${ultimoLoteRef.current.items.length - ultimoLoteRef.current.totalNuevos} volverán a su stock anterior.`,
        filasDiff: filasDeshacer(ultimoLoteRef.current.items),
      })
    }, 800)
  }

  function pedirConfirmarEliminado(mensajeId) {
    if (noPreguntarSesion) { ejecutarEliminado(mensajeId); return }
    setModal({ tipo: 'eliminar', mensajeId })
  }

  function cancelarEliminado(mensajeId) {
    actualizarMensaje(mensajeId, { resuelto: true })
    agregarTimeout(() => {
      setMensajes(prev => [...prev, { id: nuevoId(), role: 'ai', type: 'text', texto: 'Entendido, dejo esos productos como están.' }])
    }, 300)
  }

  async function ejecutarEliminado(mensajeId) {
    if (escribiendoRef.current) return
    setModal(null)
    const lote = ultimoLoteRef.current
    if (!lote) return
    escribiendoRef.current = true
    try {
      const r = await window.api.inventario.deshacerLote({
        items: lote.items, auditoria_id: lote.auditoriaId ?? undefined, usuario_id: usuario?.id, usuario_nombre: usuario?.nombre_completo,
      })
      if (!r?.ok) throw new Error(r?.error || 'Error desconocido al deshacer.')
      auditoriaActualizar(lote.auditoriaId, { detalle: 'El usuario revirtió este lote desde el chat.' })
      ultimoLoteRef.current = null
      guardarUltimoLote(null)
      actualizarMensaje(mensajeId, { resuelto: true })
      agregarTimeout(() => {
        setMensajes(prev => [...prev, {
          id: nuevoId(), role: 'ai', type: 'success',
          texto: `Listo, revertí el lote: ${lote.totalNuevos} producto(s) nuevo(s) eliminado(s) y ${lote.items.length - lote.totalNuevos} devuelto(s) a su stock anterior.`,
        }])
      }, 300)
    } catch (err) {
      setMensajes(prev => [...prev, { id: nuevoId(), role: 'ai', type: 'text', texto: `No deshice nada: ${err.message}` }])
    } finally {
      escribiendoRef.current = false
    }
  }

  function handleModalConfirm() {
    if (!modal) return
    if (modal.tipo === 'agregar') ejecutarAgregado(modal.mensajeId)
    else ejecutarEliminado(modal.mensajeId)
  }

  const puedeAdjuntarMas = archivos.length < MAX_ARCHIVOS
  // Bloqueado mientras `generando` esté activo: antes se podía mandar un
  // mensaje nuevo con una respuesta anterior todavía en curso, y esa
  // respuesta vieja se perdía en silencio al llegar tarde (el guard
  // idGeneracionActualRef la descartaba sin avisar a nadie). Ahora es
  // fisicamente imposible mandar dos a la vez — hay que esperar a que
  // termine (o cancelarla con "Detener") antes de poder enviar otra.
  const puedeEnviar = !generando && !avisoArchivoViejo && (texto.trim().length > 0 || archivos.length > 0)

  const msgModalAgregar = modal?.tipo === 'agregar' ? mensajes.find(m => m.id === modal.mensajeId) : null
  const resultadoFinalModal = msgModalAgregar ? construirResultadoFinal(msgModalAgregar) : null

  return (
    <div className="clientes-page ia-importar-page" style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 className="titulo-metalico" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={22} color="oklch(0.78 0.16 250)" /> IA / IMPORTAR DATOS
          </h1>
          <p style={{ fontSize: 13, color: 'var(--dim)' }}>Cargá tu inventario a partir de documentos o fotos, con ayuda del asistente</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginTop: 2 }}>
          <button onClick={() => setPanelAbierto('archivos')} className="clientes-action-icon" title="Archivos adjuntos">
            <Paperclip size={18} color="oklch(0.97 0.01 250)" />
          </button>
          <button onClick={() => setPanelAbierto('cambios')} className="clientes-action-icon" title="Actividad de IA (cambios y restaurar)" data-testid="abrir-actividad">
            <Activity size={18} color="oklch(0.97 0.01 250)" />
          </button>
          <button onClick={() => setPanelAbierto('historial')} className="clientes-action-icon" title="Historial de conversaciones">
            <History size={18} color="oklch(0.97 0.01 250)" />
          </button>
        </div>
      </div>

      {/* Área de mensajes — sola scrollea, el resto de la página queda fija */}
      <div ref={scrollRef} className="ia-mensajes" style={{ display: 'flex', flexDirection: 'column' }}>
        {mensajes.length === 0 ? (
          <EstadoVacio />
        ) : (
          <AnimatePresence initial={false}>
            {mensajes.map(msg => (
              <Burbuja
                key={msg.id}
                msg={msg}
                onConfirmarAgregado={pedirConfirmarAgregado}
                onCancelarAgregado={cancelarAgregado}
                onConfirmarEliminado={pedirConfirmarEliminado}
                onCancelarEliminado={cancelarEliminado}
                onCambiarRevision={cambiarCampoRevision}
                onCambiarResuelto={cambiarCampoResuelto}
                onTerminarEdicionNombre={reclasificarFilaResuelta}
                onElegirModo={(id, modo) => actualizarMensaje(id, { modoStock: modo })}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Chips de archivos adjuntos pendientes de enviar */}
      {archivos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 2px 0' }}>
          <AnimatePresence>
            {archivos.map(a => <ArchivoChip key={a.id} archivo={a} onQuitar={quitarArchivo} />)}
          </AnimatePresence>
        </div>
      )}
      {avisoLimite && (
        <div style={{ fontSize: 11, color: 'oklch(0.82 0.14 75)', padding: '4px 2px 0' }}>
          Máximo {MAX_ARCHIVOS} archivos por mensaje
        </div>
      )}

      {/* Botón "Detener" — solo mientras la IA está "generando" (3 puntitos /
          mensajes de progreso), corta la simulación en el punto en que esté */}
      {generando && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0 6px' }}>
          <button onClick={detenerGeneracion} className="clientes-glass-btn btn-secondary" style={{ padding: '6px 16px', fontSize: 12 }}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content"><StopCircle size={13} /> Detener</span>
          </button>
        </div>
      )}

      {/* Input fijo abajo — el textarea tiene altura FIJA (sin auto-grow):
          si el texto no entra, hace scroll interno, nunca crece la caja,
          así los botones de al lado nunca se mueven de lugar */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '10px 0 2px' }}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT_ARCHIVOS}
          onChange={handleSeleccionArchivos}
          style={{ display: 'none' }}
        />
        <button
          onClick={() => puedeAdjuntarMas && fileInputRef.current?.click()}
          disabled={!puedeAdjuntarMas}
          title={puedeAdjuntarMas ? 'Adjuntar archivos' : `Máximo ${MAX_ARCHIVOS} archivos`}
          className="clientes-action-icon"
          style={{ flexShrink: 0, opacity: puedeAdjuntarMas ? 1 : 0.4 }}
        >
          <Plus size={20} color="oklch(0.97 0.01 250)" />
        </button>

        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (puedeEnviar) handleEnviar() } }}
          placeholder="Escribí o adjuntá fotos, PDF, Excel o Word de tu inventario..."
          style={{
            flex: 1, resize: 'none', height: 92, overflowY: 'auto',
            background: 'oklch(0.2 0.02 250 / .5)', border: '1px solid oklch(1 0 0 / .18)',
            borderRadius: 12, padding: '10px 14px', fontSize: 13,
            color: 'oklch(0.97 0.01 250)', textShadow: '0 1px 2px rgba(0,0,0,0.6)',
            outline: 'none', fontFamily: 'inherit',
          }}
        />

        <button
          onClick={handleEnviar}
          disabled={!puedeEnviar}
          title="Enviar"
          className="clientes-glass-btn btn-primary"
          style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 999, padding: 0, opacity: puedeEnviar ? 1 : 0.4 }}
        >
          <div className="clientes-glass-bg" />
          <span className="clientes-glass-content"><Send size={16} /></span>
        </button>
      </div>

      <PanelLateral
        modo={panelAbierto}
        conversaciones={conversaciones}
        conversacionActualId={conversacionActualId}
        busqueda={busquedaHistorial}
        onBusqueda={setBusquedaHistorial}
        onNuevaConversacion={nuevaConversacion}
        onAbrirConversacionId={abrirConversacionId}
        onClose={() => setPanelAbierto(null)}
        usuario={usuario}
        onRestaurado={id => {
          // Si el lote restaurado es el "último" del chat, ya no se puede deshacer de nuevo desde ahí.
          if (ultimoLoteRef.current?.auditoriaId === id) { ultimoLoteRef.current = null; guardarUltimoLote(null) }
        }}
      />

      <AnimatePresence>
        {modal && (
          <ModalConfirmarAccion
            titulo={modal.tipo === 'agregar' ? '¿Agregar estos datos a tu inventario?' : '¿Eliminar este lote del inventario?'}
            cuerpo={modal.tipo === 'agregar'
              ? `Se agregarán ${resultadoFinalModal?.totalNuevos ?? 0} productos nuevos y se actualizarán ${resultadoFinalModal?.totalExistentes ?? 0} existentes${msgModalAgregar?.modoStock === 'sumar' ? ' (sumando a su stock)' : msgModalAgregar?.modoStock === 'reemplazar' ? ' (reemplazando su stock)' : ''}.`
              : `Se revertirá el último lote: ${ultimoLoteRef.current?.totalNuevos ?? 0} producto(s) nuevo(s) se eliminarán y el resto volverá a su stock anterior.`}
            textoConfirmar={modal.tipo === 'agregar' ? 'Confirmar' : 'Eliminar'}
            noPreguntar={noPreguntarSesion}
            onToggleNoPreguntar={() => setNoPreguntarSesion(v => !v)}
            onConfirm={handleModalConfirm}
            onClose={() => setModal(null)}
          />
        )}
        {avisoArchivoViejo && (
          <ModalArchivoViejo
            archivos={avisoArchivoViejo.archivosEnviados}
            onEnviarConArchivo={confirmarEnviarConArchivoViejo}
            onQuitarArchivo={confirmarQuitarArchivoViejo}
            onClose={() => setAvisoArchivoViejo(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
