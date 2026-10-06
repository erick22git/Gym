// Resolutor por CÓDIGO: lo que se puede decidir con reglas se decide acá, sin LLM (rápido, gratis y
// predecible). Solo si nada coincide, el motor le pide al modelo que interprete la frase contra el registro
// de acciones, y esa salida también se valida (ver motorChat.js).
//
// Devuelve null (nada coincide) o uno de:
//   { tipo: 'respuesta', texto, opciones? }          respuesta fija (saludos, ayuda…)
//   { tipo: 'comando', accion: {accion, ...}, ... }    orden explícita con barra (/tema, /limpiar…): se ejecuta directa
//   { tipo: 'acciones', acciones: [{accion, ...}] }    petición en lenguaje natural: en modo «Actuar» pide aprobación
import { DESTINOS, TEMAS, MODOS } from './registroAcciones'
import { GUIAS, guiaDesdeTexto } from './guias'
import { normalizarApariencia, APARIENCIAS, IDS_APARIENCIA } from './apariencia'

function esAparienciaConocida(arg) {
  const n = normalizarApariencia(arg)
  return n === arg || APARIENCIAS[n].alias.includes(arg)
}

export function normalizar(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[¿?¡!.,;:]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export const COMANDOS = [
  { cmd: '/tema', uso: '/tema transparente | oscuro | claro', detalle: 'Cambia la apariencia (IA y mascota)' },
  { cmd: '/modelo', uso: '/modelo [nombre]', detalle: 'Muestra o cambia el modelo de IA' },
  { cmd: '/modo', uso: '/modo preguntar | actuar', detalle: 'Cambia entre solo preguntar o poder actuar' },
  { cmd: '/guia', uso: '/guia [recorrido]', detalle: 'Inicia un recorrido paso a paso' },
  { cmd: '/limpiar', uso: '/limpiar', detalle: 'Empieza una conversación nueva' },
  { cmd: '/ayuda', uso: '/ayuda', detalle: 'Muestra los comandos disponibles' },
]

export function sugerirComandos(texto) {
  if (!texto.startsWith('/') || texto.includes(' ')) return []
  return COMANDOS.filter(c => c.cmd.startsWith(texto.toLowerCase()))
}

export function textoAyuda() {
  return '**Comandos disponibles**\n' + COMANDOS.map(c => `- \`${c.uso}\` — ${c.detalle}`).join('\n') +
    '\n\nTambién puedes escribir con tus palabras, por ejemplo: «guíame para abrir la caja» o «llévame a clientes».'
}

const SALUDO = /^(hola|holaa+|buenas|buenos dias|buen dia|buenas tardes|buenas noches|hey|que tal|saludos)( .{0,25})?$/
const GRACIAS = /^(gracias|muchas gracias|mil gracias|te agradezco|ok gracias|listo gracias)( .{0,25})?$/

const PIDE_GUIA = /\b(guia|guiame|guiarme|ensename|ensenarme|muestrame como|mostrarme como|recorrido|paso a paso|alumbra|iluminame|donde esta el boton|donde queda el boton)\b/
const VERBO_IR = /^(ir a|ve a|vamos a|llevame a|llevarme a|abre|abrir|abreme|muestrame|mostrar|quiero ver|quiero ir a|necesito ver|dame)\s+(la |el |las |los )?(pantalla de |seccion de |modulo de |pagina de |ventana de )?(.+)$/
const PIDE_IMPORTAR = /\b(quiero|necesito|voy a|puedo|deseo)\b.*\b(importar|subir|cargar|adjuntar)\b.*\b(foto|imagen|archivo|lista|excel|pdf|word|inventario|productos)\b/
const PIDE_LIMPIAR = /^(limpia|limpiar|borra|borrar|reinicia|reiniciar)( el| la)? (chat|conversacion)$|^(nueva|otra) conversacion$/
const TEMA_NL = /\b(modo|tema|apariencia)\s+(lusion\s+)?(oscuro|claro|clasico|transparente)\b|\b(ponlo|ponla|ponme|cambia(?:lo|r)?|activa(?:r)?)\b.*\b(oscuro|claro|clasico|transparente)\b/

export function resolverPorCodigo(textoOriginal) {
  const crudo = String(textoOriginal || '').trim()
  if (!crudo) return null

  // 1) Comandos con barra
  if (crudo.startsWith('/')) {
    const [cmd, ...resto] = crudo.split(/\s+/)
    const arg = normalizar(resto.join(' '))
    switch (cmd.toLowerCase()) {
      case '/ayuda': return { tipo: 'respuesta', texto: textoAyuda() }
      case '/limpiar': return { tipo: 'comando', accion: { accion: 'limpiar_chat' } }
      case '/tema':
        if (arg && esAparienciaConocida(arg)) return { tipo: 'comando', accion: { accion: 'cambiar_tema', tema: normalizarApariencia(arg) } }
        return { tipo: 'respuesta', texto: 'Apariencias: **Transparente**, **Lusion Oscuro** y **Lusion Claro**.\nUso: `/tema transparente`, `/tema oscuro` o `/tema claro`.' }
      case '/modelo': return { tipo: 'comando', accion: { accion: 'modelo', nombre: resto.join(' ').trim() } }
      case '/modo':
        if (MODOS[arg]) return { tipo: 'comando', accion: { accion: 'modo', modo: arg } }
        return { tipo: 'respuesta', texto: 'Uso: `/modo preguntar` o `/modo actuar`.' }
      case '/guia': {
        const id = Object.keys(GUIAS).find(k => k === arg.replace(/ /g, '_')) || guiaDesdeTexto(arg)
        if (id) return { tipo: 'comando', accion: { accion: 'iniciar_guia', guia: id } }
        return { tipo: 'respuesta', texto: 'Recorridos disponibles:\n' + Object.values(GUIAS).map(g => `- ${g.titulo}`).join('\n') + '\n\nEjemplo: `/guia abrir caja`.' }
      }
      default: return { tipo: 'respuesta', texto: `No conozco el comando \`${cmd}\`.\n\n${textoAyuda()}` }
    }
  }

  const t = normalizar(crudo)
  if (!t) return null

  // 2) Saludos y agradecimientos (respuesta fija: no hace falta el modelo)
  if (SALUDO.test(t)) return { tipo: 'respuesta', texto: '¡Hola! Soy tu asistente. Puedo explicarte cómo usar el sistema, guiarte paso a paso o ayudarte a importar inventario desde una foto, Excel, Word o PDF. ¿Qué necesitas?' }
  if (GRACIAS.test(t)) return { tipo: 'respuesta', texto: '¡De nada! Aquí estoy si necesitas algo más.' }

  // 3) Limpiar, tema, importar
  if (PIDE_LIMPIAR.test(t)) return { tipo: 'acciones', acciones: [{ accion: 'limpiar_chat' }] }
  const mt = t.match(TEMA_NL)
  if (mt) {
    const palabra = ['transparente', 'clasico', 'oscuro', 'claro'].find(x => t.includes(x))
    if (palabra) return { tipo: 'acciones', acciones: [{ accion: 'cambiar_tema', tema: normalizarApariencia(palabra) }] }
  }
  if (PIDE_IMPORTAR.test(t)) return { tipo: 'acciones', acciones: [{ accion: 'importar_archivo' }] }

  // 4) Recorrido guiado: si PIDE un recorrido, se dispara; si solo pregunta «¿cómo…?», se responde y se ofrece
  const guia = guiaDesdeTexto(t)
  if (guia && PIDE_GUIA.test(t)) return { tipo: 'acciones', acciones: [{ accion: 'iniciar_guia', guia }] }

  // 5) Navegación explícita: «llévame a clientes», «ir a caja»…
  const mv = t.match(VERBO_IR)
  if (mv) {
    const objetivo = mv[4].trim()
    const destino = Object.entries(DESTINOS).find(([, d]) => d.alias.some(a => objetivo === a))?.[0]
    if (destino) return { tipo: 'acciones', acciones: [{ accion: 'navegar', destino }] }
  }
  return null
}

// ¿La pregunta toca un recorrido disponible? (para ofrecer «¿te lo muestro paso a paso?» tras la respuesta)
export function guiaSugerida(texto) {
  const t = normalizar(texto)
  return /^(como|donde|que debo|cual es el paso)/.test(t) ? guiaDesdeTexto(t) : null
}

// ¿Parece una orden y no una pregunta? Solo entonces, en modo «Actuar», vale la pena gastar un llamado al modelo.
export function pareceOrden(texto) {
  const t = normalizar(texto)
  if (/^(como|donde|que|cual|cuales|cuando|por que|para que|quien)\b/.test(t)) return false
  return /\b(quiero|necesito|llevame|ve a|ir a|abre|abrir|muestrame|ponme|pon|cambia|cambiar|activa|guiame|ensename|importa|importar|sube|subir|limpia)\b/.test(t)
}
