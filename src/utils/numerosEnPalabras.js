// Convierte números dichos con palabras a dígitos ("dos" → 2, "ciento cincuenta" → 150,
// "treinta y uno" → 31, "dos mil" → 2000) dentro de una frase dictada. Es determinista a
// propósito: no se le deja al modelo de lenguaje, que con un modelo chico a veces falla.
//
// "un / uno / una" SOLOS no se convierten (suelen ser el artículo: "una botella"); solo
// cuentan dentro de un número compuesto ("treinta y uno", "veintiuno").

const sinTildes = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

const UNIDADES = {
  cero: 0, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
  catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21,
  veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29,
}
const DECENAS = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 }
const CENTENAS = {
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400,
  quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800,
  ochocientas: 800, novecientos: 900, novecientas: 900,
}
const UNO = new Set(['uno', 'un', 'una'])

// Lee un número < 1000 empezando en `i`. Devuelve { valor, hasta } (hasta = índice siguiente) o null.
function leerMenorAMil(palabras, i) {
  let j = i
  let valor = 0
  let leyo = false
  if (j < palabras.length && palabras[j] in CENTENAS) { valor += CENTENAS[palabras[j]]; j++; leyo = true }
  if (j < palabras.length && palabras[j] in DECENAS) {
    valor += DECENAS[palabras[j]]; j++; leyo = true
    if (palabras[j] === 'y' && j + 1 < palabras.length && (palabras[j + 1] in UNIDADES || UNO.has(palabras[j + 1])) && (UNIDADES[palabras[j + 1]] ?? 1) < 10) {
      valor += UNO.has(palabras[j + 1]) ? 1 : UNIDADES[palabras[j + 1]]; j += 2
    }
  } else if (j < palabras.length && palabras[j] in UNIDADES) {
    valor += UNIDADES[palabras[j]]; j++; leyo = true
  }
  return leyo ? { valor, hasta: j } : null
}

export function numerosEnPalabras(texto) {
  const partes = String(texto ?? '').split(/(\s+)/) // conserva los separadores
  const idxPalabras = []
  const palabras = []
  partes.forEach((p, k) => {
    if (/^\s+$/.test(p) || p === '') return
    idxPalabras.push(k)
    palabras.push(sinTildes(p.toLowerCase()).replace(/[.,;:!?¡¿()"]+$/g, '').replace(/^[¡¿("]+/g, ''))
  })
  const salida = [...partes]
  let i = 0
  while (i < palabras.length) {
    let valor = null
    let hasta = i
    // "mil" solo o precedido de un número: "mil", "dos mil", "dos mil quinientos"
    const antes = leerMenorAMil(palabras, i)
    if (antes && palabras[antes.hasta] === 'mil') {
      const resto = leerMenorAMil(palabras, antes.hasta + 1)
      valor = antes.valor * 1000 + (resto ? resto.valor : 0)
      hasta = resto ? resto.hasta : antes.hasta + 1
    } else if (palabras[i] === 'mil') {
      const resto = leerMenorAMil(palabras, i + 1)
      valor = 1000 + (resto ? resto.valor : 0)
      hasta = resto ? resto.hasta : i + 1
    } else if (antes) {
      valor = antes.valor
      hasta = antes.hasta
    }
    if (valor === null) { i++; continue }
    // conserva la puntuación final de la última palabra ("cien." → "100.")
    const ultima = partes[idxPalabras[hasta - 1]]
    const puntuacion = (ultima.match(/[.,;:!?)"]+$/) || [''])[0]
    salida[idxPalabras[i]] = String(valor) + puntuacion
    for (let k = i + 1; k < hasta; k++) {
      salida[idxPalabras[k]] = ''
      // borra también el espacio que quedó entre las palabras absorbidas
      if (idxPalabras[k] - 1 >= 0 && /^\s+$/.test(salida[idxPalabras[k] - 1])) salida[idxPalabras[k] - 1] = ''
    }
    i = hasta
  }
  return salida.join('').replace(/\s{2,}/g, ' ').trim()
}
