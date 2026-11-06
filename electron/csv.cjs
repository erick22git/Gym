// CSV determinista (Sprint 4B · Fase 9). Sin dependencias, 100 % local.
// - Lectura: quita el BOM, detecta el separador (; , o tab) en la primera línea, respeta comillas, comillas dobles
//   escapadas ("") y saltos de línea dentro de comillas.
// - Escritura: UTF-8 con BOM (Excel lo abre con tildes), CRLF, comillas solo cuando hacen falta.
// - Seguridad ante fórmulas: un texto que empieza con = + - @ se escribe con un apóstrofo delante y se quita al leer.
'use strict'

const BOM = '﻿'

function quitarBOM(t) { return t && t.charCodeAt(0) === 0xFEFF ? t.slice(1) : t }

// Separador más frecuente en la primera línea (fuera de comillas). Empate o ninguno → ';' (Excel en español).
function detectarDelimitador(texto) {
  const t = quitarBOM(String(texto || ''))
  const cuentas = { ';': 0, ',': 0, '\t': 0 }
  let enComillas = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (c === '"') enComillas = !enComillas
    else if (!enComillas && (c === '\n' || c === '\r')) break
    else if (!enComillas && c in cuentas) cuentas[c]++
  }
  const orden = [';', ',', '\t'].sort((a, b) => cuentas[b] - cuentas[a])
  return cuentas[orden[0]] > 0 ? orden[0] : ';'
}

// → { delimitador, filas: string[][] }  (las filas totalmente vacías se descartan)
function parsear(texto, delimitador) {
  const t = quitarBOM(String(texto ?? ''))
  const d = delimitador || detectarDelimitador(t)
  const filas = []
  let fila = [], celda = '', enComillas = false, hayCelda = false
  const cerrarCelda = () => { fila.push(celda); celda = ''; hayCelda = false }
  const cerrarFila = () => {
    cerrarCelda()
    if (!(fila.length === 1 && fila[0] === '')) filas.push(fila)
    fila = []
  }
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (enComillas) {
      if (c === '"') {
        if (t[i + 1] === '"') { celda += '"'; i++ } else enComillas = false
      } else celda += c
    } else if (c === '"' && !hayCelda) { enComillas = true; hayCelda = true }
    else if (c === d) cerrarCelda()
    else if (c === '\r') { if (t[i + 1] === '\n') i++; cerrarFila() }
    else if (c === '\n') cerrarFila()
    else { celda += c; hayCelda = true }
  }
  if (enComillas) throw new Error('El archivo tiene unas comillas sin cerrar.')
  if (celda !== '' || fila.length) cerrarFila()
  return { delimitador: d, filas }
}

const esFormula = s => /^[=+\-@]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)

function textoACelda(valor) {
  if (valor === null || valor === undefined) return ''
  const s = String(valor)
  return esFormula(s) ? "'" + s : s
}
// Inversa de la protección anterior (solo si lo que sigue al apóstrofo es = + - @).
function celdaATexto(s) {
  const t = String(s ?? '').trim()
  return /^'[=+\-@]/.test(t) ? t.slice(1) : t
}

function escapar(s, d) {
  return /["\r\n]/.test(s) || s.includes(d) ? '"' + s.replace(/"/g, '""') + '"' : s
}

// cabecera: string[] · filas: any[][] (null/undefined → vacío; números con coma decimal si el separador es ';')
function generar(cabecera, filas, delimitador = ';') {
  const fmt = v => {
    if (typeof v === 'number') return Number.isFinite(v) ? (delimitador === ';' ? String(v).replace('.', ',') : String(v)) : ''
    return textoACelda(v)
  }
  const lineas = [cabecera, ...filas].map(f => f.map(v => escapar(fmt(v), delimitador)).join(delimitador))
  return BOM + lineas.join('\r\n') + '\r\n'
}

// '' → null (celda vacía = «no cambiar»); número válido → Number; cualquier otra cosa → NaN. Acepta 2.5 y 2,5.
function textoANumero(s) {
  const t = String(s ?? '').trim()
  if (t === '') return null
  return /^-?\d+([.,]\d+)?$/.test(t) ? Number(t.replace(',', '.')) : NaN
}

// Encabezado → clave canónica: sin tildes, minúsculas, espacios y guiones → «_».
function normalizarEncabezado(h) {
  return String(h ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[\s\-.]+/g, '_').replace(/[^a-z0-9_]/g, '')
}

module.exports = { BOM, quitarBOM, detectarDelimitador, parsear, generar, textoACelda, celdaATexto, textoANumero, normalizarEncabezado }
