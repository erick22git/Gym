// Hoja de etiquetas imprimible (PDF, A4) con código de barras, nombre y precio. 100 % local (pdfkit + codigobarras.cjs).
'use strict'
const PDFDocument = require('pdfkit')
const barras = require('./codigobarras.cjs')

const MAX_COPIAS = 1000, MAX_TOTAL = 5000

// items: [{ nombre, codigo, precio, copias }] · opts: { columnas (1–6, def. 3), filas (1–14, def. 8) }
// → { buffer, paginas, etiquetas, omitidos: [{ nombre, motivo }] }. Lo que no se puede imprimir se OMITE y se informa.
async function generarPdf(items, opts = {}) {
  const columnas = opts.columnas === undefined ? 3 : Number(opts.columnas)
  const filas = opts.filas === undefined ? 8 : Number(opts.filas)
  if (!Number.isInteger(columnas) || columnas < 1 || columnas > 6) throw new Error('Las columnas de la hoja deben ser un número entre 1 y 6.')
  if (!Number.isInteger(filas) || filas < 1 || filas > 14) throw new Error('Las filas de la hoja deben ser un número entre 1 y 14.')
  if (!Array.isArray(items) || items.length === 0) throw new Error('No hay productos para imprimir.')
  const omitidos = [], lista = []
  for (const it of items) {
    const nombre = String(it?.nombre ?? '').trim() || 'Producto'
    const copias = it?.copias === undefined ? 1 : Number(it.copias)
    if (!Number.isInteger(copias) || copias < 1 || copias > MAX_COPIAS) throw new Error(`Las copias de «${nombre}» deben ser un número entero entre 1 y ${MAX_COPIAS}.`)
    const codigo = String(it?.codigo ?? '').trim()
    if (!codigo) { omitidos.push({ nombre, motivo: 'no tiene código' }); continue }
    let b
    try { b = barras.generar(codigo) } catch (e) { omitidos.push({ nombre, motivo: e.message }); continue }
    for (let i = 0; i < copias; i++) lista.push({ nombre, precio: it.precio, b })
  }
  if (lista.length === 0) return { buffer: null, paginas: 0, etiquetas: 0, omitidos }
  if (lista.length > MAX_TOTAL) throw new Error(`Son ${lista.length} etiquetas; el máximo por archivo es ${MAX_TOTAL}.`)

  const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: 'Etiquetas de productos' } })
  const trozos = []
  doc.on('data', t => trozos.push(t))
  const fin = new Promise((res, rej) => { doc.on('end', res); doc.on('error', rej) })
  const M = 20, W = doc.page.width - M * 2, H = doc.page.height - M * 2
  const cw = W / columnas, ch = H / filas, porHoja = columnas * filas
  let paginas = 1
  lista.forEach((et, i) => {
    if (i > 0 && i % porHoja === 0) { doc.addPage(); paginas++ }
    const k = i % porHoja
    const x = M + (k % columnas) * cw, y = M + Math.floor(k / columnas) * ch
    doc.save()
    doc.lineWidth(0.3).strokeColor('#bbbbbb').rect(x + 1, y + 1, cw - 2, ch - 2).stroke()
    // nombre en una línea, recortado con «…»
    doc.font('Helvetica').fontSize(7).fillColor('#000000')
    let nombre = et.nombre
    while (nombre.length > 1 && doc.widthOfString(nombre) > cw - 10) nombre = nombre.slice(0, -1)
    if (nombre !== et.nombre) nombre = nombre.slice(0, -1) + '…'
    doc.text(nombre, x + 5, y + 4, { width: cw - 10, lineBreak: false })
    // barras (zona de silencio de 10 módulos dentro de la etiqueta)
    const bits = et.b.bits
    const modulo = Math.min(1.3, (cw - 10) / (bits.length + 20))
    const x0 = x + (cw - bits.length * modulo) / 2, alto = Math.max(12, ch - 36)
    doc.fillColor('#000000')
    for (let a = 0; a < bits.length;) {
      if (bits[a] === '1') { let z = a; while (z < bits.length && bits[z] === '1') z++; doc.rect(x0 + a * modulo, y + 14, (z - a) * modulo, alto).fill(); a = z } else a++
    }
    doc.font('Helvetica').fontSize(7).fillColor('#000000').text(et.b.texto, x + 5, y + 14 + alto + 2, { width: cw - 10, align: 'center', lineBreak: false })
    if (et.precio !== undefined && et.precio !== null && Number.isFinite(Number(et.precio))) {
      doc.font('Helvetica-Bold').fontSize(9).text(`Bs. ${Number(et.precio).toFixed(2)}`, x + 5, y + ch - 14, { width: cw - 10, align: 'right', lineBreak: false })
    }
    doc.restore()
  })
  doc.end()
  await fin
  return { buffer: Buffer.concat(trozos), paginas, etiquetas: lista.length, omitidos }
}

module.exports = { generarPdf, MAX_COPIAS, MAX_TOTAL }
