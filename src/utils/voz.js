// Voz de la IA (TTS) con speechSynthesis del navegador: usa las voces que ya trae Windows,
// así que funciona sin internet y no descarga nada. Solo se usan voces LOCALES en español
// (localService === true); nunca una voz remota.
//
// Notas de Chromium/Electron:
//  · getVoices() empieza vacío y se llena de forma asíncrona (evento 'voiceschanged').
//  · Un texto muy largo se corta a los ~15 s: por eso se habla por frases, en cola.

let voces = []

function cargarVoces() {
  try { voces = window.speechSynthesis.getVoices() } catch (_) { voces = [] }
}

export function hablaSoportada() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

if (hablaSoportada()) {
  cargarVoces()
  window.speechSynthesis.addEventListener('voiceschanged', cargarVoces)
}

// Voz local en español, o null si no hay ninguna instalada.
export function elegirVoz() {
  if (voces.length === 0) cargarVoces()
  const locales = voces.filter(v => v.localService && (v.lang || '').toLowerCase().startsWith('es'))
  return locales.find(v => /es-(bo|mx|us|ar|co|es)/i.test(v.lang)) || locales[0] || null
}

// Quita lo que suena mal al leerlo: símbolos de formato, emojis, flechas y prefijos de diff.
export function limpiarParaHablar(texto) {
  return String(texto ?? '')
    .replace(/https?:\/\/\S+/g, ' ')
    // Dinero: "Bs. 35.00" → "35 bolivianos", "Bs. 12.50" → "12 bolivianos con 50 centavos" (sin cortar la frase en el punto).
    .replace(/Bs\.?\s*(\d+)[.,](\d{2})/g, (_, e, c) => (c === '00' ? `${e} bolivianos` : `${e} bolivianos con ${Number(c)} centavos`))
    .replace(/Bs\.?\s*(\d+)/g, '$1 bolivianos')
    .replace(/(\d+)[.,](\d+)/g, '$1 punto $2')
    .replace(/×/g, ' por ')
    .replace(/[*_`#>~|]/g, ' ')
    .replace(/→/g, ' a ')
    .replace(/^[+\-~=] /gm, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ' ')
    .replace(/([.!?:;])\s*\n+\s*/g, '$1 ')
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\s+/g, ' ')
    .trim()
}

function partirEnFrases(texto, max = 220) {
  // Se corta solo donde un signo de puntuación va seguido de espacio (fin real de frase).
  const frases = texto.split(/(?<=[.!?:;])\s+/).filter(Boolean)
  const out = []
  let acum = ''
  for (const f of frases) {
    if ((acum + f).length > max && acum) { out.push(acum.trim()); acum = '' }
    acum += f + ' '
    while (acum.length > max) { out.push(acum.slice(0, max).trim()); acum = acum.slice(max) }
  }
  if (acum.trim()) out.push(acum.trim())
  return out
}

// Devuelve { ok, motivo }. Cancela lo que se estuviera diciendo antes.
export function hablar(texto, { onFin } = {}) {
  if (!hablaSoportada()) return { ok: false, motivo: 'Este equipo no soporta síntesis de voz.' }
  const limpio = limpiarParaHablar(texto)
  if (!limpio) return { ok: false, motivo: 'Nada que leer.' }
  cargarVoces()
  const voz = elegirVoz()
  if (voces.length > 0 && !voz) return { ok: false, motivo: 'No hay una voz en español instalada en Windows.' }
  window.speechSynthesis.cancel()
  const frases = partirEnFrases(limpio)
  frases.forEach((f, i) => {
    const u = new SpeechSynthesisUtterance(f)
    u.lang = voz?.lang || 'es-ES'
    if (voz) u.voice = voz
    u.rate = 1
    if (i === frases.length - 1) u.onend = () => onFin?.()
    window.speechSynthesis.speak(u)
  })
  return { ok: true }
}

export function detenerHabla() {
  if (hablaSoportada()) window.speechSynthesis.cancel()
}

export function estaHablando() {
  return hablaSoportada() && (window.speechSynthesis.speaking || window.speechSynthesis.pending)
}
