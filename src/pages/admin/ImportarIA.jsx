// ─── IA / Importar datos ───────────────────────────────────────────────────
// Asistente de chat que en el futuro va a leer documentos/fotos de
// inventario (OCR + comparación contra la base de datos) y cargarlos al
// sistema. HOY es 100% interfaz — todo el "cerebro" de acá adentro es
// mock (setTimeout + datos de ejemplo hardcodeados), no hay conexión a
// ningún modelo real ni escritura real en la base de datos.
//
// Accesible desde DOS puntos de entrada que renderizan este MISMO
// componente (nunca duplicado):
//   1. TopNav.jsx → PAGES.IA_IMPORTAR (ruta independiente, ver App.jsx)
//   2. Configuracion.jsx → sección 'ia' (dentro del hub de Configuración)
//
// // TODO: reemplazar TODO el bloque de simulación (procesarArchivos,
// // ejecutarAgregado, ejecutarEliminado, detectarIntencionDeshacer) con
// // llamadas reales al pipeline de IA (ver BRIEF_IA_OCR_INVENTARIO.md,
// // que todavía no existe — crearlo en la sesión donde se conecte el
// // modelo real).

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Plus, Send, X, Image as ImageIcon, FileText,
  FileSpreadsheet, File as FileIcon, Check, AlertTriangle, ChevronRight,
  History, Paperclip, Copy, StopCircle, Search,
} from 'lucide-react'
import '../Clients.css'
import './ImportarIA.css'

// ─── Datos mock del "resultado del análisis" ──────────────────────────────
// // TODO: reemplazar con el resultado real del pipeline de IA — hoy es
// // un objeto fijo, siempre el mismo, sin importar qué se adjunte.
// `existentes[].cantidadAnterior` es la cantidad que el producto tenía ANTES
// (mock también) — es lo que permite pintar el diff "antes/después".
const RESULTADO_MOCK = {
  totalNuevos: 14,
  totalExistentes: 3,
  nuevos: [
    { nombre: 'Paracetamol 500mg', cantidad: 120 },
    { nombre: 'Ibuprofeno 400mg', cantidad: 80 },
    { nombre: 'Amoxicilina 500mg', cantidad: 60 },
    { nombre: 'Vendas elásticas', cantidad: 45 },
  ],
  existentes: [
    { nombre: 'Alcohol en gel 500ml', cantidadAnterior: 10, cantidad: 30 },
    { nombre: 'Guantes de nitrilo (caja)', cantidadAnterior: 5, cantidad: 15 },
    { nombre: 'Mascarillas quirúrgicas (caja)', cantidadAnterior: 8, cantidad: 25 },
  ],
}

// ─── Líneas de diff (estilo GitHub) a partir del resultado mock ───────────
// // TODO: cuando el análisis sea real, estas mismas funciones deberían
// // poder alimentarse del resultado real sin cambios (misma forma de datos).
function construirLineasDiff(resultado) {
  const lineas = []
  resultado.nuevos.forEach(p => {
    lineas.push({ tipo: 'add', key: `add-${p.nombre}`, texto: `${p.nombre} — ${p.cantidad} unidades` })
  })
  resultado.existentes.forEach(p => {
    lineas.push({ tipo: 'remove', key: `upd-old-${p.nombre}`, texto: `${p.nombre} — ${p.cantidadAnterior} unidades` })
    lineas.push({ tipo: 'add', key: `upd-new-${p.nombre}`, texto: `${p.nombre} — ${p.cantidad} unidades` })
  })
  return lineas
}

function construirLineasEliminacion(productos) {
  return (productos || []).map(p => ({ tipo: 'remove', key: `del-${p.nombre}`, texto: `${p.nombre} — ${p.cantidad} unidades` }))
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

const FASES_PROGRESO = [
  'Leyendo el documento...',
  'Analizando los datos...',
  'Comparando con tu inventario actual...',
]

const MAX_ARCHIVOS = 10
const ACCEPT_ARCHIVOS = '.jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx,image/jpeg,image/png,image/webp,application/pdf'

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

// ─── Línea individual del diff (estilo GitHub) — tipografía monoespaciada,
// fondo sutil rojo/verde según el tipo, nunca colores saturados tipo semáforo ──
function LineaDiff({ tipo, texto }) {
  const esAgregado = tipo === 'add'
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '4px 10px',
      background: esAgregado ? 'oklch(0.7 0.16 155 / .08)' : 'oklch(0.63 0.19 25 / .1)',
      fontFamily: 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
      fontSize: 11.5, lineHeight: 1.7,
    }}>
      <span style={{
        color: esAgregado ? 'oklch(0.74 0.17 155)' : 'oklch(0.74 0.19 25)', fontWeight: 700, flexShrink: 0,
        textShadow: '0 1px 2px rgba(0,0,0,0.6)',
      }}>
        {esAgregado ? '+' : '-'}
      </span>
      <span style={{
        color: esAgregado ? 'oklch(0.84 0.13 155)' : 'oklch(0.82 0.14 25)',
        textShadow: '0 1px 2px rgba(0,0,0,0.6)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {texto}
      </span>
    </div>
  )
}

// ─── Sección colapsable "Ver detalle de cambios" — diff completo de líneas,
// sobre #dropdown-glass (siempre hermana del resto de capas, nunca anidada
// con capas goo/metaball) ───────────────────────────────────────────────
function DetalleDiff({ lineas }) {
  const [abierto, setAbierto] = useState(false)
  if (!lineas?.length) return null

  return (
    <div style={{ marginTop: 10, marginBottom: 12 }}>
      <button
        onClick={() => setAbierto(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
          cursor: 'pointer', padding: '4px 2px', fontSize: 11.5, fontWeight: 700,
          color: 'oklch(0.88 0.01 250 / .85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)',
        }}
      >
        <motion.span
          animate={{ rotate: abierto ? 90 : 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          style={{ display: 'flex' }}
        >
          <ChevronRight size={13} />
        </motion.span>
        {abierto ? 'Ocultar detalle de cambios' : 'Ver detalle de cambios'}
      </button>

      <AnimatePresence initial={false}>
        {abierto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              marginTop: 6, borderRadius: 8, overflow: 'hidden',
              background: 'oklch(0.1 0.02 250 / .4)', backdropFilter: 'url(#dropdown-glass)', WebkitBackdropFilter: 'url(#dropdown-glass)',
              border: '1px solid oklch(1 0 0 / .08)',
            }}>
              {lineas.map(l => <LineaDiff key={l.key} tipo={l.tipo} texto={l.texto} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
function PanelLateral({ modo, conversaciones, conversacionActualId, busqueda, onBusqueda, onNuevaConversacion, onAbrirConversacionId, onClose }) {
  if (!modo) return null
  const esHistorial = modo === 'historial'

  const conversacionesFiltradas = esHistorial
    ? conversaciones.filter(c => c.titulo.toLowerCase().includes(busqueda.trim().toLowerCase()))
    : []
  const grupos = esHistorial ? agruparPorFecha(conversacionesFiltradas) : []
  const archivos = !esHistorial ? listarTodosLosArchivos(conversaciones) : []

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
          position: 'fixed', top: 0, left: 0, bottom: 0, width: 320, zIndex: 9401,
          background: 'oklch(0.12 0.02 250 / .6)', backdropFilter: 'url(#dropdown-glass)', WebkitBackdropFilter: 'url(#dropdown-glass)',
          borderRight: '1px solid oklch(1 0 0 / .1)', boxShadow: '20px 0 50px oklch(0 0 0 / .4)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', textShadow: '0 1px 2px rgba(0,0,0,.6)' }}>
            {esHistorial ? 'Historial de conversaciones' : 'Archivos adjuntos'}
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
          {esHistorial ? (
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

// ─── Tarjeta de resumen (resultado mock del "análisis") — cards de color
// con contenido blanco+sombra, y una tabla adentro con distorsión propia +
// capa oscura, mismo patrón que el resto de la app (Ventas/Inventario) ──
function TarjetaResumen({ resultado, resuelto, onConfirmar, onCancelar }) {
  const filas = [
    ...resultado.nuevos.map(p => ({ ...p, estado: 'nuevo' })),
    ...resultado.existentes.map(p => ({ ...p, estado: 'existente' })),
  ]

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: 'oklch(0.13 0.02 250 / .34)', backdropFilter: 'url(#historial-glass)', WebkitBackdropFilter: 'url(#historial-glass)',
      border: '1px solid transparent', borderLeft: '3px solid oklch(0.72 0.18 305)',
      borderRadius: 14, padding: '16px 18px', marginTop: 6,
      boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .1), 0 0 14px 2px oklch(1 0 0 / .07), 0 14px 34px oklch(0 0 0 / .35)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Sparkles size={16} color="oklch(0.78 0.16 250)" />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
          Resultado del análisis
        </span>
      </div>

      <p style={{ fontSize: 13, color: 'oklch(0.97 0.01 250)', lineHeight: 1.6, marginBottom: 12, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
        Se encontraron <strong style={{ color: 'oklch(0.78 0.16 155)' }}>{resultado.totalNuevos} medicamentos nuevos</strong> y{' '}
        <strong style={{ color: 'oklch(0.82 0.14 75)' }}>{resultado.totalExistentes} que ya existen</strong> en tu inventario
        (se actualizará su cantidad).
      </p>

      {/* Tabla de ejemplo — distorsión suave + capa oscura + sombra en
          todo el contenido, mismo patrón que las tablas del resto de la app */}
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
              <tr key={p.nombre} style={{ borderBottom: i < filas.length - 1 ? '1px solid oklch(1 0 0 / .05)' : 'none' }}>
                <td style={{ padding: '7px 12px', fontSize: 12, color: 'var(--ink)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{p.nombre}</td>
                <td style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600, color: 'var(--ink)', textAlign: 'right', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{p.cantidad}</td>
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

      {!resuelto && <DetalleDiff lineas={construirLineasDiff(resultado)} />}

      {!resuelto && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancelar} className="clientes-glass-btn btn-secondary" style={{ flex: 1 }}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content">Cancelar</span>
          </button>
          <button onClick={onConfirmar} className="clientes-glass-btn btn-primary" style={{ flex: 1 }}>
            <div className="clientes-glass-bg" />
            <span className="clientes-glass-content"><Check size={14} /> Confirmar y agregar</span>
          </button>
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
function Burbuja({ msg, onConfirmarAgregado, onCancelarAgregado, onConfirmarEliminado, onCancelarEliminado }) {
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
              resuelto={msg.resuelto}
              onConfirmar={() => onConfirmarAgregado(msg.id)}
              onCancelar={() => onCancelarAgregado(msg.id)}
            />
          )}

          {msg.type === 'confirmarUndo' && (
            <div>
              <span style={{ fontSize: 13, color: 'oklch(0.97 0.01 250)', lineHeight: 1.5, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{msg.texto}</span>
              {!msg.resuelto && <DetalleDiff lineas={msg.lineasDiff} />}
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
  const [generando, setGenerando] = useState(false)
  const ultimoLoteRef = useRef(null) // { totalNuevos, productos } del último lote agregado — para la corrección/deshacer
  const idGeneracionActualRef = useRef(null) // id del mensaje "typing/progress" en curso — para poder Detener
  const fileInputRef = useRef(null)
  const scrollRef = useRef(null)
  const timeoutsRef = useRef([])

  // ─── Historial de conversaciones (persistido en localStorage, ver
  // cargarConversaciones/guardarConversaciones arriba) ────────────────────
  const [conversaciones, setConversaciones] = useState(() => cargarConversaciones())
  const [conversacionActualId, setConversacionActualId] = useState(null)
  const [panelAbierto, setPanelAbierto] = useState(null) // null | 'historial' | 'archivos'
  const [busquedaHistorial, setBusquedaHistorial] = useState('')
  const saltarProximoGuardadoRef = useRef(false) // evita "tocar" la fecha de una conversación solo por abrirla

  useEffect(() => () => timeoutsRef.current.forEach(clearTimeout), [])

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
    setGenerando(false)
  }

  function nuevaConversacion() {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    idGeneracionActualRef.current = null
    setGenerando(false)
    setMensajes([])
    setConversacionActualId(null)
    ultimoLoteRef.current = null
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
    idGeneracionActualRef.current = null
    setGenerando(false)
    saltarProximoGuardadoRef.current = true
    setMensajes(conv.mensajes)
    setConversacionActualId(conv.id)
    // Simplificación: al reabrir una conversación guardada no reconstruimos
    // "último lote" en memoria — el flujo de deshacer solo funciona dentro
    // de la misma sesión de chat en curso.
    // // TODO: si se conecta a datos reales, reconstruir ultimoLoteRef a
    // // partir de los mensajes 'success' guardados, o consultar el backend.
    ultimoLoteRef.current = null
    setModal(null)
    setPanelAbierto(null)
  }

  // ─── Adjuntar archivos ───────────────────────────────────────────────
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
      const conPreview = aAgregar.map(f => ({
        id: nuevoId(),
        nombre: f.name,
        tamano: f.size,
        type: f.type,
        preview: f.type?.startsWith('image/') ? URL.createObjectURL(f) : null,
      }))
      return [...prev, ...conPreview]
    })
  }

  function quitarArchivo(id) {
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
    const contenido = texto.trim()
    if (!contenido && archivos.length === 0) return

    const archivosEnviados = archivos
    setMensajes(prev => [...prev, { id: nuevoId(), role: 'user', type: 'text', texto: contenido, archivos: archivosEnviados, creadoEn: Date.now() }])
    setTexto('')
    setArchivos([])

    if (archivosEnviados.length > 0) {
      procesarArchivos()
      return
    }

    if (esIntencionDeshacer(contenido)) {
      responderDeshacer()
      return
    }

    // Texto libre sin archivos ni intención de deshacer — respuesta
    // genérica corta (mock, no hay NLU real todavía).
    const idTyping = nuevoId()
    idGeneracionActualRef.current = idTyping
    setGenerando(true)
    setMensajes(prev => [...prev, { id: idTyping, role: 'ai', type: 'typing' }])
    agregarTimeout(() => {
      actualizarMensaje(idTyping, {
        type: 'text',
        texto: 'Puedo ayudarte a cargar tu inventario — escribime o adjuntá fotos, PDF, Excel o Word con el botón "+".',
      })
      idGeneracionActualRef.current = null
      setGenerando(false)
    }, 900)
  }

  // ─── Simulación de "análisis" de archivos ─────────────────────────────
  function procesarArchivos() {
    const idProceso = nuevoId()
    idGeneracionActualRef.current = idProceso
    setGenerando(true)
    setMensajes(prev => [...prev, { id: idProceso, role: 'ai', type: 'typing' }])

    FASES_PROGRESO.forEach((texto, i) => {
      agregarTimeout(() => {
        actualizarMensaje(idProceso, { type: 'progress', texto })
      }, 700 + i * 900)
    })

    agregarTimeout(() => {
      actualizarMensaje(idProceso, { type: 'summary', resultado: RESULTADO_MOCK, resuelto: false })
      idGeneracionActualRef.current = null
      setGenerando(false)
    }, 700 + FASES_PROGRESO.length * 900 + 500)
  }

  // ─── Confirmar/cancelar el resumen (agregar al inventario) ────────────
  function pedirConfirmarAgregado(mensajeId) {
    if (noPreguntarSesion) { ejecutarAgregado(mensajeId); return }
    setModal({ tipo: 'agregar', mensajeId })
  }

  function cancelarAgregado(mensajeId) {
    actualizarMensaje(mensajeId, { resuelto: true })
    agregarTimeout(() => {
      setMensajes(prev => [...prev, { id: nuevoId(), role: 'ai', type: 'text', texto: 'Sin problema, no agregué nada. Avisame si querés que lo intente de nuevo.' }])
    }, 300)
  }

  function ejecutarAgregado(mensajeId) {
    // // TODO: acá va la escritura real en window.api.inventario.* — hoy
    // // solo actualiza el estado local del chat.
    setModal(null)
    actualizarMensaje(mensajeId, { resuelto: true })
    ultimoLoteRef.current = { totalNuevos: RESULTADO_MOCK.totalNuevos, productos: RESULTADO_MOCK.nuevos }
    agregarTimeout(() => {
      setMensajes(prev => [...prev, {
        id: nuevoId(), role: 'ai', type: 'success',
        texto: `Listo, se agregaron ${RESULTADO_MOCK.totalNuevos} medicamentos a tu inventario.`,
      }])
    }, 300)
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
        texto: `¿Quieres que elimine los ${ultimoLoteRef.current.totalNuevos} productos que se agregaron recién?`,
        lineasDiff: construirLineasEliminacion(ultimoLoteRef.current.productos),
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

  function ejecutarEliminado(mensajeId) {
    // // TODO: acá va la eliminación real en window.api.inventario.* — hoy
    // // solo actualiza el estado local del chat.
    setModal(null)
    actualizarMensaje(mensajeId, { resuelto: true })
    const cantidad = ultimoLoteRef.current?.totalNuevos
    ultimoLoteRef.current = null
    agregarTimeout(() => {
      setMensajes(prev => [...prev, { id: nuevoId(), role: 'ai', type: 'success', texto: 'Listo, se eliminó ese lote.' }])
    }, 300)
  }

  function handleModalConfirm() {
    if (!modal) return
    if (modal.tipo === 'agregar') ejecutarAgregado(modal.mensajeId)
    else ejecutarEliminado(modal.mensajeId)
  }

  const puedeAdjuntarMas = archivos.length < MAX_ARCHIVOS
  const puedeEnviar = texto.trim().length > 0 || archivos.length > 0

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
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEnviar() } }}
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
      />

      <AnimatePresence>
        {modal && (
          <ModalConfirmarAccion
            titulo={modal.tipo === 'agregar' ? '¿Agregar estos datos a tu inventario?' : '¿Eliminar este lote del inventario?'}
            cuerpo={modal.tipo === 'agregar'
              ? `Se agregarán ${RESULTADO_MOCK.totalNuevos} productos nuevos y se actualizarán ${RESULTADO_MOCK.totalExistentes} existentes.`
              : `Se eliminarán ${ultimoLoteRef.current?.totalNuevos ?? 0} productos agregados recientemente. Esta acción no se puede deshacer.`}
            textoConfirmar={modal.tipo === 'agregar' ? 'Confirmar' : 'Eliminar'}
            noPreguntar={noPreguntarSesion}
            onToggleNoPreguntar={() => setNoPreguntarSesion(v => !v)}
            onConfirm={handleModalConfirm}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
