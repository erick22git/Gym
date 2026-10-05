// ¿Este texto puede ser el nombre de un producto, o es un encabezado / total / fecha que el OCR
// confundió con uno? Si no lo es, las tarjetas de revisión dejan el nombre VACÍO en vez de
// precargarlo (cargar "Total" como producto confunde y se confirma sin querer).
const NO_PRODUCTO = new Set([
  'todo', 'todos', 'todas', 'otro', 'otros', 'otra', 'otras', 'total', 'totales', 'subtotal', 'observacion',
  'observaciones', 'obs', 'cantidad', 'cant', 'valor', 'precio', 'importe', 'monto', 'descripcion', 'detalle',
  'producto', 'productos', 'item', 'items', 'nro', 'numero', 'fecha', 'hora', 'unidad', 'unidades', 'codigo',
  'cod', 'stock', 'saldo', 'firma', 'nota', 'notas', 'inventario', 'lista', 'pagina', 'sin', 'nombre',
])
const MESES = '(ene|enero|feb|febrero|mar|marzo|abr|abril|may|mayo|jun|junio|jul|julio|ago|agosto|sep|sept|septiembre|oct|octubre|nov|noviembre|dic|diciembre)'

function normalizar(t) {
  return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[:.\-_*#]+$/g, '').trim()
}

export function esNombreDeProducto(texto) {
  const n = normalizar(texto)
  if (n.length < 2) return false
  if (!/[a-z]/.test(n)) return false                               // solo números / símbolos
  if (NO_PRODUCTO.has(n)) return false
  const palabras = n.split(/\s+/)
  if (palabras.every(p => NO_PRODUCTO.has(p.replace(/[:.]+$/g, '')))) return false
  if (/^\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4}$/.test(n)) return false // 12/05/2026
  if (new RegExp(String.raw`^(\d{1,2}\s+(de\s+)?)?${MESES}\b(\s+(de\s+)?\d{2,4})?$`).test(n)) return false // "10 agosto 2026"
  if (/^total\b/.test(n) && palabras.length <= 3) return false      // "Total general"
  if (/^(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.test(n) && /\d/.test(n)) return false
  return true
}
