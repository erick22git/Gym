// Códigos de barras 100 % locales (Sprint 4B · Fase 11). Sin dependencias.
// - Code 128 (subconjunto B: ASCII 32–126) para códigos propios como «F9-A» o «AGUA-600».
// - EAN-13 para códigos de 13 dígitos con dígito verificador correcto.
// `bits` es una cadena de '1' (barra) y '0' (espacio), un carácter por módulo, SIN zona de silencio.
// También hay decodificadores propios para releer lo generado (las pruebas además lo leen con un lector independiente).
'use strict'

// Anchos barra/espacio/barra/espacio/barra/espacio de los 107 símbolos de Code 128 (0–102 datos, 103 StartA, 104 StartB, 105 StartC, 106 Stop).
const TABLA_128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
]
const START_B = 104, STOP = 106

function anchosABits(anchos) {
  let bits = '', barra = true
  for (const ch of anchos) { bits += (barra ? '1' : '0').repeat(Number(ch)); barra = !barra }
  return bits
}
const BITS_128 = TABLA_128.map(anchosABits)

function code128B(texto) {
  const t = String(texto ?? '')
  if (!t) throw new Error('El código está vacío.')
  for (const ch of t) {
    const c = ch.codePointAt(0)
    if (c < 32 || c > 126) throw new Error(`El carácter «${ch}» no se puede imprimir en un código de barras (usa letras sin tilde, números y signos comunes).`)
  }
  const valores = [...t].map(ch => ch.codePointAt(0) - 32)
  let suma = START_B
  valores.forEach((v, i) => { suma += v * (i + 1) })
  const secuencia = [START_B, ...valores, suma % 103, STOP]
  return { tipo: 'code128', texto: t, bits: secuencia.map(v => BITS_128[v]).join('') }
}

// ── EAN-13 ──
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
const PARIDAD = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

function digitoEan13(doce) {
  if (!/^\d{12}$/.test(doce)) throw new Error('Para calcular el dígito verificador se necesitan 12 dígitos.')
  const s = [...doce].reduce((a, d, i) => a + Number(d) * (i % 2 === 0 ? 1 : 3), 0)
  return (10 - (s % 10)) % 10
}
function ean13Valido(t) { return /^\d{13}$/.test(t) && digitoEan13(t.slice(0, 12)) === Number(t[12]) }

function ean13(digitos) {
  let t = String(digitos ?? '').trim()
  if (/^\d{12}$/.test(t)) t += String(digitoEan13(t))
  if (!/^\d{13}$/.test(t)) throw new Error('Un EAN-13 lleva 13 dígitos (o 12, y se calcula el último).')
  if (!ean13Valido(t)) throw new Error(`El dígito verificador del EAN-13 no es correcto (debería ser ${digitoEan13(t.slice(0, 12))}).`)
  const p = PARIDAD[Number(t[0])]
  let bits = '101'
  for (let i = 0; i < 6; i++) bits += (p[i] === 'L' ? L : G)[Number(t[i + 1])]
  bits += '01010'
  for (let i = 0; i < 6; i++) bits += R[Number(t[i + 7])]
  bits += '101'
  return { tipo: 'ean13', texto: t, bits }
}

// Elige el tipo: EAN-13 solo si ya es un EAN-13 válido; todo lo demás va en Code 128 (el texto impreso es SIEMPRE el código guardado).
function generar(codigo, tipo) {
  const t = String(codigo ?? '').trim()
  if (tipo === 'ean13') return ean13(t)
  if (tipo === 'code128') return code128B(t)
  return ean13Valido(t) ? ean13(t) : code128B(t)
}

// ── Decodificadores propios (para releer lo generado) ──
function decodificarCode128(bits) {
  const resto = bits.length - 13
  if (resto < 33 || resto % 11 !== 0) throw new Error('Longitud no válida para Code 128.')
  const n = resto / 11
  const vals = []
  for (let i = 0; i < n; i++) {
    const v = BITS_128.indexOf(bits.slice(i * 11, i * 11 + 11))
    if (v < 0 || v > 105) throw new Error('Símbolo desconocido.')
    vals.push(v)
  }
  if (bits.slice(resto) !== BITS_128[STOP]) throw new Error('Falta el final del código.')
  if (vals[0] !== START_B) throw new Error('Solo se decodifica el subconjunto B.')
  const datos = vals.slice(1, -1), chk = vals[vals.length - 1]
  const suma = START_B + datos.reduce((a, v, i) => a + v * (i + 1), 0)
  if (suma % 103 !== chk) throw new Error('El dígito de control no coincide.')
  return { tipo: 'code128', texto: datos.map(v => String.fromCharCode(v + 32)).join('') }
}
function decodificarEan13(bits) {
  if (bits.length !== 95 || bits.slice(0, 3) !== '101' || bits.slice(45, 50) !== '01010' || bits.slice(92) !== '101') throw new Error('Estructura EAN-13 no válida.')
  let paridad = '', d = ''
  for (let i = 0; i < 6; i++) {
    const m = bits.slice(3 + i * 7, 10 + i * 7)
    const l = L.indexOf(m), g = G.indexOf(m)
    if (l >= 0) { paridad += 'L'; d += l } else if (g >= 0) { paridad += 'G'; d += g } else throw new Error('Dígito ilegible.')
  }
  const primero = PARIDAD.indexOf(paridad)
  if (primero < 0) throw new Error('Paridad no válida.')
  for (let i = 0; i < 6; i++) { const r = R.indexOf(bits.slice(50 + i * 7, 57 + i * 7)); if (r < 0) throw new Error('Dígito ilegible.'); d += r }
  const texto = String(primero) + d
  if (!ean13Valido(texto)) throw new Error('El dígito verificador no coincide.')
  return { tipo: 'ean13', texto }
}
function decodificar(bits) { return bits.length === 95 ? decodificarEan13(bits) : decodificarCode128(bits) }

// SVG con zona de silencio de 10 módulos. El texto se escapa; no se ejecuta nada.
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
function svg(codigo, { alto = 60, modulo = 2, mostrarTexto = true, tipo } = {}) {
  const b = generar(codigo, tipo)
  const zona = 10, ancho = (b.bits.length + zona * 2) * modulo
  const total = alto + (mostrarTexto ? 16 : 0)
  let rects = '', i = 0
  while (i < b.bits.length) {
    if (b.bits[i] === '1') { let j = i; while (j < b.bits.length && b.bits[j] === '1') j++; rects += `<rect x="${(zona + i) * modulo}" y="0" width="${(j - i) * modulo}" height="${alto}"/>`; i = j } else i++
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${total}" viewBox="0 0 ${ancho} ${total}" role="img" aria-label="Código de barras ${esc(b.texto)}"><rect width="${ancho}" height="${total}" fill="#fff"/><g fill="#000">${rects}</g>${mostrarTexto ? `<text x="${ancho / 2}" y="${alto + 13}" font-family="monospace" font-size="12" text-anchor="middle" fill="#000">${esc(b.texto)}</text>` : ''}</svg>`
}

module.exports = { TABLA_128, code128B, ean13, digitoEan13, ean13Valido, generar, decodificar, decodificarCode128, decodificarEan13, svg }
