// Utilidades de audio para el dictado local: arma el WAV PCM16 mono de 16 kHz que espera
// el motor de dictado a partir de las muestras crudas que captura el AudioWorklet.
//
// NO se usa MediaRecorder + decodeAudioData: en el Electron 28 de esta app, decodificar el
// webm/opus del navegador tumba el proceso del renderer (violación de acceso). Capturar el
// PCM directamente evita la decodificación por completo.

export function float32AWav(pcm, hz = 16000) {
  const bytesDatos = pcm.length * 2
  const buf = new ArrayBuffer(44 + bytesDatos)
  const v = new DataView(buf)
  const texto = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  texto(0, 'RIFF'); v.setUint32(4, 36 + bytesDatos, true); texto(8, 'WAVE')
  texto(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true); v.setUint32(24, hz, true); v.setUint32(28, hz * 2, true)
  v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  texto(36, 'data'); v.setUint32(40, bytesDatos, true)
  for (let i = 0; i < pcm.length; i++) {
    const m = Math.max(-1, Math.min(1, pcm[i]))
    v.setInt16(44 + i * 2, m < 0 ? m * 0x8000 : m * 0x7fff, true)
  }
  return new Uint8Array(buf)
}

// Une los bloques que entrega el worklet en un solo Float32Array.
export function unirBloques(bloques) {
  const total = bloques.reduce((a, b) => a + b.length, 0)
  const out = new Float32Array(total)
  let pos = 0
  for (const b of bloques) { out.set(b, pos); pos += b.length }
  return out
}

// Respaldo por si el equipo no entrega 16 kHz exactos: interpolación lineal.
export function remuestrear(pcm, desdeHz, haciaHz = 16000) {
  if (desdeHz === haciaHz) return pcm
  const razon = desdeHz / haciaHz
  const n = Math.floor(pcm.length / razon)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = i * razon
    const i0 = Math.floor(x)
    const i1 = Math.min(i0 + 1, pcm.length - 1)
    out[i] = pcm[i0] + (pcm[i1] - pcm[i0]) * (x - i0)
  }
  return out
}
