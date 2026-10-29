// Color de texto (negro o blanco) con mejor contraste sobre un fondo cualquiera (etiquetas con color elegido por la persona).
let ctx = null
const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
export function textoSobre(fondo) {
  try {
    if (!ctx) { const cv = document.createElement('canvas'); cv.width = cv.height = 1; ctx = cv.getContext('2d', { willReadFrequently: true }) }
    ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = fondo; ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? '#000' : '#fff'   // contraste con negro vs con blanco
  } catch { return '#000' }
}
