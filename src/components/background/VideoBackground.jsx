import { useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { VIDEO_TRANSITIONS, PAGE_TO_TRANSITION } from '../../config/videoTransitions'

// ─── Fondo de video en frames, sincronizado con la navegación ──────────────
// Reemplaza a .bg-atmospheric (mismo z-index:0, detrás de .app-layout) —
// ver videoTransitions.ts para el mapeo página→toma y el porqué de cada
// rango. Reproduce a 24fps (fps nativo de los videos fuente) dibujando
// frame por frame en un <canvas>.
//
// Comportamiento (sin reversa, sin animación entre páginas): cada página
// tiene su propio rango fijo (frameStart..frameEnd) en su propio video.
// Al entrar a una página se corta DIRECTO a su frameStart (se pinta ese
// frame de inmediato, sin frame intermedio ni salto visible previo) y
// desde ahí se reproduce siempre hacia adelante hasta su frameEnd — sin
// importar en qué video/frame estaba parada la página anterior. No hay
// noción de "volver al anchor" ni de continuar una animación entre 2
// páginas del mismo video: cada entrada a página es independiente.
//
//   - página sin mapeo en PAGE_TO_TRANSITION → no se toca el fondo, queda
//     el reposo anterior (ej. una subpágina admin sin video propio).
//   - entrada `static` (ej. Facturación) → corte directo al frame fijo,
//     sin animar.
//   - entrada normal → corte directo a frameStart, después reproduce
//     frameStart → frameEnd hacia adelante.

const FPS = 24
const FRAME_MS = 1000 / FPS

function framePath(video, frame) {
  return `/frames/${video}/frame_${String(frame).padStart(4, '0')}.jpg`
}

function frameRange(from, to) {
  const frames = []
  const step = from <= to ? 1 : -1
  for (let f = from; ; f += step) {
    frames.push(f)
    if (f === to) break
  }
  return frames
}

// 'video1/frame_0143.jpg' → { video: 'video1', frame: 143 }
function parseStaticFrame(staticFrame) {
  const [video, frameFile] = staticFrame.split('/')
  return { video, frame: Number(frameFile.match(/\d+/)[0]) }
}

export default function VideoBackground() {
  const { page } = useApp()
  const canvasRef = useRef(null)
  const ctxRef = useRef(null)
  const cacheRef = useRef(new Map()) // src -> { img, promise }
  const lastDrawnRef = useRef(null) // { video, frame } — para redibujar en resize
  const tokenRef = useRef(0)

  function getImage(src) {
    let entry = cacheRef.current.get(src)
    if (entry) return entry
    const img = new Image()
    const promise = new Promise((resolve) => {
      img.onload = () => resolve()
      img.onerror = () => resolve() // no bloquear la cola por un frame faltante
    })
    img.src = src
    entry = { img, promise }
    cacheRef.current.set(src, entry)
    return entry
  }

  function preload(srcs) {
    return Promise.all(srcs.map((src) => getImage(src).promise))
  }

  function drawCover(img) {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx || !img || !img.naturalWidth) return
    const w = canvas.width
    const h = canvas.height
    const imgRatio = img.naturalWidth / img.naturalHeight
    const boxRatio = w / h
    let drawW, drawH, drawX, drawY
    if (imgRatio > boxRatio) {
      drawH = h
      drawW = drawH * imgRatio
      drawX = (w - drawW) / 2
      drawY = 0
    } else {
      drawW = w
      drawH = drawW / imgRatio
      drawX = 0
      drawY = (h - drawH) / 2
    }
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(img, drawX, drawY, drawW, drawH)
  }

  function drawFrame(video, frame) {
    lastDrawnRef.current = { video, frame }
    const { img } = getImage(framePath(video, frame))
    if (img.complete) drawCover(img)
  }

  // Reproduce frames de `from` a `to` (incluyendo ambos extremos) a FPS
  // constante. Asume que ya están precargados. Se corta sola si `token`
  // dejó de ser el vigente (llegó una navegación más nueva).
  function playRange(video, from, to, token) {
    return new Promise((resolve) => {
      let current = from
      const step = from <= to ? 1 : -1
      let lastTs = null
      function tick(ts) {
        if (token !== tokenRef.current) { resolve(); return }
        if (lastTs === null) lastTs = ts
        if (ts - lastTs >= FRAME_MS) {
          lastTs = ts
          drawFrame(video, current)
          if (current === to) { resolve(); return }
          current += step
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
  }

  // Canvas + resize (mismo patrón que LoginVidrio: redibuja el último frame
  // pintado para no perder la imagen al cambiar el tamaño de la ventana).
  useEffect(() => {
    const canvas = canvasRef.current
    ctxRef.current = canvas.getContext('2d')
    function resize() {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      if (lastDrawnRef.current) {
        const { img } = getImage(framePath(lastDrawnRef.current.video, lastDrawnRef.current.frame))
        if (img.complete) drawCover(img)
      }
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    const token = ++tokenRef.current
    const transitionKey = PAGE_TO_TRANSITION[page]

    if (!transitionKey) return // página sin fondo de video: no tocar nada

    const entry = VIDEO_TRANSITIONS[transitionKey]

    ;(async () => {
      // ── Destino estático (ej. Facturación): corte directo, sin animar.
      if (entry.static) {
        await preload([`/frames/${entry.staticFrame}`])
        if (token !== tokenRef.current) return
        const { video, frame } = parseStaticFrame(entry.staticFrame)
        drawFrame(video, frame)
        return
      }

      // ── Corte directo al frameStart propio de esta página — se pinta
      // apenas está cargado, sin esperar a que precargue todo el rango,
      // para que no haya ningún frame/salto intermedio visible. ──
      await preload([framePath(entry.video, entry.frameStart)])
      if (token !== tokenRef.current) return
      drawFrame(entry.video, entry.frameStart)

      // ── Reproduce siempre hacia adelante hasta frameEnd. ──
      await preload(frameRange(entry.frameStart, entry.frameEnd).map((f) => framePath(entry.video, f)))
      if (token !== tokenRef.current) return
      await playRange(entry.video, entry.frameStart, entry.frameEnd, token)
    })()

    return () => { tokenRef.current++ }
  }, [page])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        background: '#060709',
      }}
    />
  )
}
