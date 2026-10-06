// Motor de conversación del asistente (lo usan la página de IA y la mascota). Orden de decisión:
//   1) CÓDIGO: comandos con barra, saludos, recorridos y navegación por palabras clave (resolver.js).
//   2) En modo «Actuar» y solo si parece una orden: el modelo interpreta la frase contra el registro de
//      acciones, con salida JSON validada (servicio + validarAccion). Nunca ejecuta: propone.
//   3) Si no hay acción: respuesta del modelo en streaming (SSE) con el contexto del sistema.
// Ninguna acción se ejecuta sin que la persona pulse «Aprobar» (salvo sus propios comandos con barra, que
// ya son una orden explícita y no cambian datos).
import { chatStore, nuevoId } from './chatStore'
import { resolverPorCodigo, guiaSugerida, pareceOrden, textoAyuda } from './resolver'
import { CATALOGO, EJEMPLOS_LLM, DESTINOS, TEMAS, MODOS, describirAccion, validarAccion } from './registroAcciones'
import { GUIAS } from './guias'
import { APARIENCIAS } from './apariencia'

const BASE = 'http://localhost:8420'
let controlador = null
let ejecutores = {}
let prefs = null // { modelo, perfil } leídas de la BD una vez

export function registrarEjecutores(e) {
  ejecutores = { ...ejecutores, ...e }
  return () => { for (const k of Object.keys(e)) if (ejecutores[k] === e[k]) delete ejecutores[k] }
}

// ─── Preferencias (modelo/perfil/tema) ───────────────────────────────────────────────────────
export async function cargarPrefs(forzar = false) {
  if (prefs && !forzar) return prefs
  let c = {}
  try { c = (await window.api?.ia?.getConfig?.()) || {} } catch { /* sin IPC */ }
  prefs = { modelo: c.ia_modelo || null, perfil: c.ia_perfil || null, tema: c.ia_tema || 'transparente', benchmark: c.ia_benchmark || null, mascotaPos: c.mascota_pos || null, rendimiento: c.ia_modo_rendimiento || null }
  return prefs
}
export async function guardarPref(clave, valor) {
  try { await window.api?.ia?.setConfig?.(clave, valor) } catch { /* sin IPC */ }
  await cargarPrefs(true)
}

// ─── Mensajes ────────────────────────────────────────────────────────────────────────────────
const ai = (m) => chatStore.agregarMensaje({ role: 'ai', type: 'text', ...m })
const usuario = (texto, extra = {}) => chatStore.agregarMensaje({ role: 'user', type: 'text', texto, ...extra })

function historial(hasta) {
  return chatStore.get().mensajes
    .filter(m => m.type === 'text' && m.texto && !m.streaming && m.id !== hasta)
    .slice(-8)
    .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.texto }))
}

export function detener() {
  controlador?.abort()
  controlador = null
}

// ─── Entrada principal ───────────────────────────────────────────────────────────────────────
export async function enviarTexto(texto) {
  const t = String(texto || '').trim()
  if (!t || chatStore.get().generando) return false
  usuario(t)
  await resolverYResponder(t)
  return true
}

async function resolverYResponder(t) {
  const modo = chatStore.get().modo
  const r = resolverPorCodigo(t)

  if (r?.tipo === 'respuesta') { ai({ texto: r.texto }); return }
  if (r?.tipo === 'comando') { await ejecutarComando(r.accion); return }
  if (r?.tipo === 'acciones') { await proponerOExplicar(r.acciones, t); return }

  if (modo === 'actuar' && pareceOrden(t)) {
    const acciones = await interpretarConModelo(t)
    if (acciones?.length) { await proponerOExplicar(acciones, t); return }
  }
  await transmitir(t)
}

async function proponerOExplicar(acciones, textoOriginal) {
  const validas = acciones.filter(validarAccion)
  if (!validas.length) { await transmitir(textoOriginal); return }
  if (chatStore.get().modo === 'actuar') {
    chatStore.agregarMensaje({ role: 'ai', type: 'acciones', acciones: validas, estado: 'pendiente', texto: 'Esto es lo que haré. Dime si te parece bien:' })
    return
  }
  chatStore.agregarMensaje({
    role: 'ai', type: 'opciones',
    texto: `Eso es una acción (${validas.map(describirAccion).join('; ')}). Estoy en modo «Preguntar», que no hace cambios por sí solo.`,
    opciones: [{ id: 'chat:actuar', etiqueta: 'Cambiar a «Actuar» y proponerlo', tono: 'principal', datos: { acciones: validas } }, { id: 'chat:solo-explicar', etiqueta: 'Solo explícame' }],
  })
}

async function interpretarConModelo(t) {
  const id = nuevoId()
  chatStore.setGenerando(true)
  chatStore.agregarMensaje({ id, role: 'ai', type: 'typing' })
  try {
    const p = await cargarPrefs()
    const resp = await fetch(`${BASE}/interpretar-comando`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: t, solo_acciones: true, pantalla: 'chat del asistente', catalogo: CATALOGO, ejemplos: EJEMPLOS_LLM, contexto: { pantalla_actual: ejecutores.getRuta?.() || '' }, modelo: p.modelo }),
    })
    const data = await resp.json()
    return Array.isArray(data.acciones) ? data.acciones : []
  } catch {
    return []
  } finally {
    chatStore.setMensajes(prev => prev.filter(m => m.id !== id))
    chatStore.setGenerando(false)
  }
}

// ─── Streaming ───────────────────────────────────────────────────────────────────────────────
export async function transmitir(textoUsuario, { reemplazarId } = {}) {
  const id = reemplazarId || nuevoId()
  const t0 = performance.now()
  let tPrimero = null
  let acumulado = ''
  let pendiente = null
  chatStore.setGenerando(true)
  chatStore.agregarMensaje({ id, role: 'ai', type: 'typing' })
  const ctl = new AbortController()
  controlador = ctl
  const volcar = () => { pendiente = null; chatStore.actualizarMensaje(id, { type: 'text', texto: acumulado, streaming: true }) }
  try {
    const p = await cargarPrefs()
    const msgs = [...historial(id), ...(historial(id).at(-1)?.content === textoUsuario ? [] : [{ role: 'user', content: textoUsuario }])]
    const resp = await fetch(`${BASE}/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({ mensajes: msgs, modo: chatStore.get().modo, modelo: p.modelo || undefined, perfil: p.perfil || undefined, ruta: ejecutores.getRuta?.() || '' }),
    })
    if (!resp.ok || !resp.body) throw new Error(`El servicio respondió ${resp.status}`)
    const lector = resp.body.getReader()
    const dec = new TextDecoder()
    let buf = ''
    let fin = null
    for (;;) {
      const { value, done } = await lector.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      let i
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const bloque = buf.slice(0, i).trim()
        buf = buf.slice(i + 2)
        if (!bloque.startsWith('data:')) continue
        const ev = JSON.parse(bloque.slice(5))
        if (ev.error) throw new Error(ev.error)
        if (ev.token) {
          if (tPrimero === null) tPrimero = performance.now()
          acumulado += ev.token
          if (!pendiente) pendiente = setTimeout(volcar, 60) // pinta en lotes: no un render por token
        }
        if (ev.fin) fin = ev
      }
    }
    if (pendiente) { clearTimeout(pendiente); pendiente = null }
    const total = performance.now() - t0
    const metricas = { primerTokenMs: Math.round((tPrimero ?? performance.now()) - t0), totalMs: Math.round(total), tokens: fin?.tokens ?? null }
    console.info(`[IA] primer token ${metricas.primerTokenMs} ms · total ${metricas.totalMs} ms · ${metricas.tokens ?? '?'} tokens`)
    chatStore.actualizarMensaje(id, { type: 'text', texto: acumulado.trim() || 'No obtuve respuesta del modelo.', streaming: false, metricas, pregunta: textoUsuario })
    const g = guiaSugerida(textoUsuario)
    if (g) { // solo resalta: no cambia nada, y la persona elige con un clic
      chatStore.agregarMensaje({
        role: 'ai', type: 'opciones', texto: `¿Quieres que te muestre paso a paso: ${GUIAS[g].titulo}?`,
        opciones: [{ id: 'chat:guia', etiqueta: 'Sí, muéstrame', tono: 'principal', datos: { guia: g } }, { id: 'chat:no', etiqueta: 'No, gracias' }],
      })
    }
  } catch (err) {
    if (pendiente) { clearTimeout(pendiente); pendiente = null }
    if (ctl.signal.aborted) {
      chatStore.actualizarMensaje(id, { type: 'text', texto: acumulado.trim() ? `${acumulado.trim()}\n\n_(detenido)_` : 'Generación detenida.', streaming: false, pregunta: textoUsuario })
    } else {
      chatStore.actualizarMensaje(id, { type: 'text', texto: 'No pude conectarme al asistente local. Si acaba de abrir la app, espera a que termine de iniciar. Igual puedes adjuntar fotos, Excel, Word o PDF de tu inventario con el botón "+".', streaming: false })
    }
  } finally {
    if (controlador === ctl) controlador = null
    chatStore.setGenerando(false)
  }
}

export async function regenerar() {
  const { mensajes, generando } = chatStore.get()
  if (generando) return
  let iUser = -1
  for (let i = mensajes.length - 1; i >= 0; i--) if (mensajes[i].role === 'user' && mensajes[i].type === 'text' && mensajes[i].texto) { iUser = i; break }
  if (iUser < 0) return
  const pregunta = mensajes[iUser].texto
  chatStore.setMensajes(mensajes.slice(0, iUser + 1)) // se descarta la respuesta anterior
  await resolverYResponder(pregunta)
}

// ─── Acciones ────────────────────────────────────────────────────────────────────────────────
async function ejecutarUna(a) {
  switch (a.accion) {
    case 'navegar': ejecutores.navegar?.(DESTINOS[a.destino].page); return `Listo, te llevé a «${DESTINOS[a.destino].etiqueta}».`
    case 'iniciar_guia': ejecutores.iniciarGuia?.(a.guia); return `Empecemos: ${GUIAS[a.guia].titulo}. Sigue el resaltado (Esc para salir).`
    case 'cambiar_tema': await ejecutores.aplicarTema?.(a.tema); return `Apariencia «${APARIENCIAS[a.tema].etiqueta}» aplicada.${a.tema !== 'transparente' ? ' Solo cambia la IA y la mascota; el resto del sistema mantiene el diseño Transparente.' : ''}`
    case 'importar_archivo': ejecutores.importarArchivo?.(); return 'Abrí el selector de archivos en la pantalla de IA. Revisarás todo antes de agregar nada.'
    case 'limpiar_chat': limpiarChat(); return null
    case 'modo': chatStore.setModo(a.modo); return `Modo «${MODOS[a.modo].etiqueta}»: ${MODOS[a.modo].detalle}`
    case 'modelo': return await comandoModelo(a.nombre)
    default: return 'No sé hacer eso todavía.'
  }
}

export function limpiarChat() {
  detener()
  chatStore.set({ mensajes: [], generando: false, conversacionId: null })
  ejecutores.alLimpiar?.()
}

async function ejecutarComando(a) {
  try {
    const r = await ejecutarUna(a)
    if (r) ai({ texto: r })
  } catch (e) { ai({ texto: `No pude hacerlo: ${e.message}` }) }
}

async function comandoModelo(nombre) {
  let info
  try { info = await (await fetch(`${BASE}/modelos`)).json() } catch { return 'No pude consultar los modelos del servicio local.' }
  const p = await cargarPrefs()
  const actual = p.modelo || info.modelo_por_defecto
  if (!nombre) return `**Modelo actual:** ${actual}\n**Instalados:** ${info.modelos?.length ? info.modelos.join(', ') : '(ninguno)'}\n\nPara cambiarlo: \`/modelo nombre\`.`
  if (!info.modelos?.includes(nombre)) return `El modelo «${nombre}» no está instalado. Instalados: ${info.modelos?.join(', ') || '(ninguno)'}.`
  await guardarPref('ia_modelo', nombre)
  return `Modelo cambiado a **${nombre}**. Se usará desde el próximo mensaje.`
}

export async function aprobarAcciones(idMensaje) {
  const m = chatStore.get().mensajes.find(x => x.id === idMensaje)
  if (!m || m.estado !== 'pendiente') return
  chatStore.actualizarMensaje(idMensaje, { estado: 'ejecutando' })
  const resultados = []
  for (const a of m.acciones) {
    try { const r = await ejecutarUna(a); if (r) resultados.push(r) } catch (e) { resultados.push(`Falló: ${e.message}`) }
  }
  // limpiar_chat vacía el historial: el mensaje ya no existe
  if (chatStore.get().mensajes.some(x => x.id === idMensaje)) chatStore.actualizarMensaje(idMensaje, { estado: 'hecha', resultado: resultados.join(' ') })
}

export function rechazarAcciones(idMensaje) {
  chatStore.actualizarMensaje(idMensaje, { estado: 'rechazada', resultado: 'No hice nada.' })
}

// Opciones clicables propias del chat (id «chat:…»). Devuelve true si la opción era suya.
export async function manejarOpcion(idMensaje, op) {
  if (!op.id.startsWith('chat:')) return false
  chatStore.actualizarMensaje(idMensaje, { elegida: op.id })
  switch (op.id) {
    case 'chat:actuar':
      chatStore.setModo('actuar')
      chatStore.agregarMensaje({ role: 'ai', type: 'acciones', acciones: op.datos.acciones, estado: 'pendiente', texto: 'Modo «Actuar» activado. Esto es lo que haré; confírmalo:' })
      break
    case 'chat:guia': await ejecutarComando({ accion: 'iniciar_guia', guia: op.datos.guia }); break
    default: break
  }
  return true
}

export { textoAyuda, TEMAS, resolverYResponder as responderA }
