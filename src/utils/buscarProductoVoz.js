// Encuentra el producto real de un nombre DICHO en voz alta ("botellas de agua de 600 mililitros").
// Lo dictado casi nunca coincide letra por letra con el inventario, y un producto equivocado en una
// venta es plata mal cobrada, así que es conservador: solo elige solo cuando TODAS las palabras
// significativas de lo dicho están en un único producto; si hay varios o ninguno claro, devuelve
// las opciones para que el usuario elija.

import { normalizarNombre } from './coincidenciasInventario'

const RELLENO = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'al', 'en', 'con', 'y', 'para', 'por', 'que', 'mi', 'tu',
  'botella', 'botellas', 'unidad', 'unidades', 'producto', 'productos', 'paquete', 'paquetes', 'bolsa', 'bolsas', 'carrito', 'venta',
])

const UNIDAD_CANON = {
  mililitro: 'ml', mililitros: 'ml', ml: 'ml', cc: 'ml', litro: 'l', litros: 'l', lt: 'l', lts: 'l', l: 'l',
  gramo: 'g', gramos: 'g', gr: 'g', grs: 'g', g: 'g', kilo: 'kg', kilos: 'kg', kilogramo: 'kg', kilogramos: 'kg', kg: 'kg', kgs: 'kg',
  miligramo: 'mg', miligramos: 'mg', mg: 'mg',
}

// Palabras clave normalizadas: sin tildes, sin plural simple, número+unidad pegados ("600 mililitros" → "600ml").
export function tokensDeProducto(texto) {
  const crudos = normalizarNombre(texto).split(' ').filter(Boolean)
  const out = []
  for (let i = 0; i < crudos.length; i++) {
    let t = crudos[i]
    if (/^\d+$/.test(t) && UNIDAD_CANON[crudos[i + 1]]) { out.push(t + UNIDAD_CANON[crudos[i + 1]]); i++; continue }
    const m = t.match(/^(\d+)([a-z]+)$/)
    if (m && UNIDAD_CANON[m[2]]) { out.push(m[1] + UNIDAD_CANON[m[2]]); continue }
    if (RELLENO.has(t)) continue
    if (t.length > 3 && t.endsWith('s')) t = t.slice(0, -1)
    out.push(t)
  }
  return out
}

function coincide(a, b) {
  if (a === b) return true
  // Un número suelto vale por la medida completa: "600" ≈ "600ml" (se suele omitir la unidad al hablar).
  const numeroContraMedida = (n, m) => /^\d+$/.test(n) && m.startsWith(n) && /^[a-z]+$/.test(m.slice(n.length))
  if (numeroContraMedida(a, b) || numeroContraMedida(b, a)) return true
  if (/\d/.test(a) || /\d/.test(b)) return false // el resto de las medidas deben ser exactas
  const corto = a.length <= b.length ? a : b
  const largo = a.length <= b.length ? b : a
  return corto.length >= 4 && largo.startsWith(corto)
}

// Cobertura: qué fracción de las palabras dichas aparecen en el nombre del producto.
export function puntajeProducto(dicho, nombreProducto) {
  const dichas = tokensDeProducto(dicho)
  const producto = tokensDeProducto(nombreProducto)
  if (dichas.length === 0 || producto.length === 0) return { cobertura: 0, sobrantes: producto.length }
  const usados = new Set()
  let hallados = 0
  for (const d of dichas) {
    const idx = producto.findIndex((p, k) => !usados.has(k) && coincide(d, p))
    if (idx >= 0) { usados.add(idx); hallados++ }
  }
  return { cobertura: hallados / dichas.length, sobrantes: producto.length - usados.size }
}

// `buscar(consulta)` es la búsqueda real del inventario (window.api.inventario.buscarPOS).
// Devuelve { tipo: 'unico', producto } | { tipo: 'ambiguo', candidatos } | { tipo: 'ninguno' }
export async function buscarProductoPorVoz(dicho, buscar) {
  const tokens = tokensDeProducto(dicho)
  if (tokens.length === 0) return { tipo: 'ninguno' }
  const consultas = [String(dicho).trim(), tokens.join(' '), ...tokens.filter(t => t.length >= 3 && !/^\d/.test(t))]
  const vistos = new Map()
  for (const q of [...new Set(consultas)].slice(0, 5)) {
    if (q.length < 2) continue
    let res = []
    try { res = (await buscar(q)) || [] } catch (_) { res = [] }
    res.forEach(p => { if (!vistos.has(p.id)) vistos.set(p.id, p) })
  }
  const evaluados = [...vistos.values()]
    .map(p => ({ producto: p, ...puntajeProducto(dicho, p.nombre) }))
    .filter(e => e.cobertura > 0)
    .sort((a, b) => b.cobertura - a.cobertura || a.sobrantes - b.sobrantes)
  if (evaluados.length === 0) return { tipo: 'ninguno' }
  const completos = evaluados.filter(e => e.cobertura === 1)
  if (completos.length === 1) return { tipo: 'unico', producto: completos[0].producto }
  if (completos.length > 1) {
    // Varios productos contienen todo lo dicho: solo se elige solo si lo dicho ES el nombre completo de uno
    // (sin palabras de más); "agua" con dos aguas en el inventario se le pregunta al usuario.
    if (completos[0].sobrantes === 0 && completos[1].sobrantes > 0) return { tipo: 'unico', producto: completos[0].producto }
    return { tipo: 'ambiguo', candidatos: completos.slice(0, 4).map(e => e.producto) }
  }
  const parciales = evaluados.filter(e => e.cobertura >= 0.5).slice(0, 4).map(e => e.producto)
  return parciales.length ? { tipo: 'ambiguo', candidatos: parciales } : { tipo: 'ninguno' }
}
