// Dictado por voz local: captura el micrófono como PCM (AudioWorklet), lo empaqueta como WAV
// 16 kHz y lo manda al proceso principal, que lo transcribe con faster-whisper (empaquetado,
// sin internet). El texto se entrega con `onTexto`; el usuario lo revisa/edita antes de enviar.
import { useCallback, useEffect, useRef, useState } from 'react'
import { float32AWav, unirBloques, remuestrear } from '../utils/audioWav'

const MAX_SEGUNDOS = 120
const HZ = 16000

function mensajeDeError(e) {
  if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') return 'No tengo permiso para usar el micrófono (revisa Configuración de Windows → Privacidad → Micrófono).'
  if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') return 'No se detectó ningún micrófono.'
  return e?.message || 'No se pudo grabar.'
}

export default function useDictado({ onTexto }) {
  const [estado, setEstado] = useState('inactivo') // 'inactivo' | 'grabando' | 'transcribiendo'
  const [error, setError] = useState(null)
  const [segundos, setSegundos] = useState(0)
  const [disponible, setDisponible] = useState(null) // null = comprobando
  const r = useRef({ stream: null, ctx: null, nodo: null, bloques: [], reloj: null, grabando: false })
  const onTextoRef = useRef(onTexto)
  onTextoRef.current = onTexto

  useEffect(() => {
    let vivo = true
    if (!window.api?.voz) { setDisponible(false); return undefined }
    window.api.voz.disponible().then(ok => { if (vivo) setDisponible(!!ok) }).catch(() => { if (vivo) setDisponible(false) })
    return () => { vivo = false }
  }, [])

  // Suelta micrófono y contexto de audio; devuelve la frecuencia real con la que se grabó.
  const liberar = useCallback(async () => {
    const s = r.current
    clearInterval(s.reloj)
    s.grabando = false
    const hz = s.ctx?.sampleRate || HZ
    try { s.nodo?.disconnect() } catch (_) { /* ya desconectado */ }
    s.stream?.getTracks().forEach(t => t.stop())
    try { await s.ctx?.close() } catch (_) { /* ya cerrado */ }
    s.stream = null; s.ctx = null; s.nodo = null
    return hz
  }, [])

  // Al salir de la pantalla mientras graba: suelta el micrófono sin transcribir.
  useEffect(() => () => { r.current.bloques = []; liberar() }, [liberar])

  const detener = useCallback(async () => {
    if (!r.current.grabando) return
    const bloques = r.current.bloques
    r.current.bloques = []
    setEstado('transcribiendo')
    try {
      const hz = await liberar()
      const pcm = remuestrear(unirBloques(bloques), hz, HZ)
      if (pcm.length < HZ * 0.3) throw new Error('No se escuchó nada: mantén el micrófono un poco más.')
      const res = await window.api.voz.transcribir(float32AWav(pcm, HZ))
      if (!res?.ok) throw new Error(res?.error || 'No se pudo transcribir.')
      if (!res.texto) throw new Error('No se entendió ninguna palabra. Intenta de nuevo, más cerca del micrófono.')
      onTextoRef.current?.(res.texto)
    } catch (e) {
      setError(mensajeDeError(e))
    }
    setEstado('inactivo')
  }, [liberar])

  const iniciar = useCallback(async () => {
    setError(null)
    try {
      // Primero se prepara TODO lo lento (contexto + carga del worklet) y recién después se abre el
      // micrófono: así el audio empieza a capturarse en cuanto el micrófono se abre y no se pierde
      // el comienzo de la frase (probado: cargando el worklet después, "Quiero" salía como "pero").
      const ctx = new AudioContext({ sampleRate: HZ })
      await ctx.audioWorklet.addModule(new URL('captura-pcm.js', document.baseURI).href)
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
      } catch (e) {
        try { await ctx.close() } catch (_) { /* ya cerrado */ }
        throw e
      }
      const fuente = ctx.createMediaStreamSource(stream)
      const nodo = new AudioWorkletNode(ctx, 'captura-pcm', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 })
      const bloques = []
      nodo.port.onmessage = e => { bloques.push(e.data) }
      const mudo = ctx.createGain() // el nodo debe llegar al destino para que el navegador lo procese; en silencio
      mudo.gain.value = 0
      fuente.connect(nodo); nodo.connect(mudo); mudo.connect(ctx.destination)
      r.current = { stream, ctx, nodo, bloques, reloj: null, grabando: true }
      setSegundos(0)
      setEstado('grabando')
      r.current.reloj = setInterval(() => {
        setSegundos(s => {
          if (s + 1 >= MAX_SEGUNDOS) detener()
          return s + 1
        })
      }, 1000)
    } catch (e) {
      await liberar()
      setError(mensajeDeError(e))
      setEstado('inactivo')
    }
  }, [detener, liberar])

  const alternar = useCallback(() => {
    if (estado === 'grabando') detener()
    else if (estado === 'inactivo') iniciar()
  }, [estado, detener, iniciar])

  return { estado, error, segundos, disponible, alternar, iniciar, detener }
}
