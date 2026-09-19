// ─── Coincidencia de nombres de producto contra el inventario real ────────
// El OCR nunca devuelve el nombre idéntico letra por letra a lo ya guardado
// (tildes, mayúsculas, espacios, una letra mal leída), así que la búsqueda
// exacta no sirve. Pero fusionar con el producto EQUIVOCADO es peor que
// duplicar (el error sería silencioso), así que este comparador es
// deliberadamente conservador: ante cualquier duda devuelve `null` y el
// producto se trata como nuevo (el usuario puede corregir un duplicado a
// mano; una fusión incorrecta no se ve).
//
// Reglas (todas deben cumplirse para considerar "mismo producto"):
//   1. Mismas medidas. "Whey 1kg" ≠ "Whey 2kg", "Agua 600ml" ≠ "Agua 500ml".
//      Si una tiene medida y la otra no, tampoco coinciden.
//   2. Misma cantidad de palabras. "Toalla deportiva" ≠ "Toalla deportiva
//      microfibra" (podrían ser dos productos distintos).
//   3. Cada palabra tiene su par en el otro nombre (sin importar el orden);
//      se tolera 1 letra distinta solo en palabras de 5+ letras (typo de OCR).
//   4. Si más de un producto del inventario empata como mejor candidato, es
//      ambiguo → null.

const UNIDADES = {
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg',
  g: 'g', gr: 'g', grs: 'g', gramo: 'g', gramos: 'g',
  mg: 'mg',
  l: 'l', lt: 'l', lts: 'l', litro: 'l', litros: 'l',
  ml: 'ml', cc: 'ml',
  oz: 'oz', lb: 'lb', lbs: 'lb',
  cm: 'cm', mm: 'mm', m: 'm',
}

export function normalizarNombre(nombre) {
  return String(nombre ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Separa un nombre en { palabras, medidas }. Pega número + unidad ("700 ml"
// → "700ml") y unifica variantes de unidad ("1 kilo", "1kgs" → "1kg").
function tokenizar(nombre) {
  const crudos = normalizarNombre(nombre).split(' ').filter(Boolean)
  const palabras = []
  const medidas = []
  for (let i = 0; i < crudos.length; i++) {
    let t = crudos[i]
    const m = t.match(/^(\d+)([a-z]+)$/)            // "700ml", "1kg", "x20" no (empieza con letra)
    if (m && UNIDADES[m[2]]) { medidas.push(m[1] + UNIDADES[m[2]]); continue }
    if (/^\d+$/.test(t) && UNIDADES[crudos[i + 1]]) { // "700" + "ml"
      medidas.push(t + UNIDADES[crudos[i + 1]]); i++; continue
    }
    if (/\d/.test(t)) { medidas.push(t); continue }   // cualquier otro token con dígitos ("x20", "500")
    if (t.length > 3 && t.endsWith('s')) t = t.slice(0, -1) // guantes/guante
    palabras.push(t)
  }
  return { palabras, medidas: medidas.sort() }
}

function distancia(a, b) {
  if (a === b) return 0
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
  }
  return dp[a.length][b.length]
}

// Puntaje 0..1 entre dos nombres, o 0 si no cumplen las reglas de arriba.
export function puntajeCoincidencia(a, b) {
  const ta = tokenizar(a)
  const tb = tokenizar(b)
  if (ta.palabras.length === 0 || tb.palabras.length === 0) return 0
  if (ta.medidas.join('|') !== tb.medidas.join('|')) return 0
  if (ta.palabras.length !== tb.palabras.length) return 0

  const libres = [...tb.palabras]
  let errores = 0
  for (const p of ta.palabras) {
    let idx = libres.indexOf(p)
    if (idx === -1) {
      idx = libres.findIndex(q => Math.min(p.length, q.length) >= 5 && distancia(p, q) === 1)
      if (idx === -1) return 0
      errores += 1
    }
    libres.splice(idx, 1)
  }
  return errores === 0 ? 1 : 0.9
}

// Devuelve { producto, puntaje, exacta } o null. `inventario` es la lista de
// window.api.inventario.getAll().
export function buscarCoincidencia(nombre, inventario) {
  if (!nombre?.toString().trim()) return null
  const candidatos = []
  for (const p of inventario || []) {
    const puntaje = puntajeCoincidencia(nombre, p.nombre)
    if (puntaje > 0) candidatos.push({ producto: p, puntaje })
  }
  if (candidatos.length === 0) return null
  candidatos.sort((x, y) => y.puntaje - x.puntaje)
  // Empate en el mejor puntaje entre productos distintos → ambiguo.
  if (candidatos.length > 1 && candidatos[1].puntaje === candidatos[0].puntaje) return null
  const mejor = candidatos[0]
  return { producto: mejor.producto, puntaje: mejor.puntaje, exacta: mejor.puntaje === 1 }
}
