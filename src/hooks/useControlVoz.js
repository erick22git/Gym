// Control por voz de una pantalla (Ventas / Caja): dictado → intérprete (LLM) → plan de acciones →
// ejecución paso a paso sobre los campos REALES de la pantalla, narrando cada paso.
//
// REGLAS DE SEGURIDAD (no negociables):
//  · Solo se ejecutan acciones que la pantalla declaró en su `catalogo` y para las que dio un
//    ejecutor; el servidor ya descarta lo demás.
//  · Toda acción marcada `irreversible` (cobrar, cerrar caja...) se frena SIEMPRE antes de
//    ejecutarse: se muestra la confirmación y solo un clic explícito en "Sí" la ejecuta. La voz nunca
//    confirma sola. Si el usuario dice que no (o cierra), no se hace nada.
//  · Si un paso falla se corta el plan: no se sigue "por si acaso".
//
// Un ejecutor: { narrar?(params), ejecutar(params) → {ok, mensaje} | {pregunta:{texto, opciones}},
//               continuar?(params, opcionId) → {ok, mensaje},
//               validar?(params) → {ok, mensaje}, confirmacion?(params) → string, etiquetaConfirmar?: string }
import { useCallback, useEffect, useRef, useState } from 'react'
import useDictado from './useDictado'
import useModoVoz from './useModoVoz'
import { interpretarComando } from '../services/comandosVoz'
import { numerosEnPalabras } from '../utils/numerosEnPalabras'
import { hablar, detenerHabla } from '../utils/voz'

const PAUSA_ENTRE_PASOS_MS = 450
let contadorPasos = 0

export default function useControlVoz({ pantalla, catalogo, ejemplos, getContexto, ejecutores, habilitado = true }) {
  const modoVoz = useModoVoz()
  const [estado, setEstado] = useState('inactivo') // inactivo | interpretando | ejecutando | esperando
  const [transcripcion, setTranscripcion] = useState('')
  const [pasos, setPasos] = useState([]) // { id, texto, estado: 'ejecutando' | 'ok' | 'error' | 'info' }
  const [pendiente, setPendiente] = useState(null) // { tipo: 'confirmar' | 'elegir', texto, opciones }
  const [respuesta, setRespuesta] = useState(null)
  const [error, setError] = useState(null)

  const ref = useRef({})
  ref.current = { catalogo, ejemplos, getContexto, ejecutores, modoVoz, pantalla }
  const token = useRef(0) // subir el token cancela cualquier plan en curso
  const resolver = useRef(null)

  const decir = useCallback(texto => { if (ref.current.modoVoz && texto) hablar(texto) }, [])

  const agregarPaso = useCallback(p => {
    const id = ++contadorPasos
    setPasos(prev => [...prev, { id, ...p }])
    return id
  }, [])
  const marcarPaso = useCallback((id, cambios) => setPasos(prev => prev.map(p => (p.id === id ? { ...p, ...cambios } : p))), [])

  // Espera una decisión del usuario (clic en una opción). Devuelve el id elegido o null si se cancela.
  const pedirDecision = useCallback(datos => new Promise(res => {
    resolver.current = res
    setPendiente(datos)
    setEstado('esperando')
  }), [])

  const decidir = useCallback(opcionId => {
    const r = resolver.current
    resolver.current = null
    setPendiente(null)
    r?.(opcionId)
  }, [])

  const cancelar = useCallback(() => {
    token.current++
    detenerHabla()
    if (resolver.current) { const r = resolver.current; resolver.current = null; r(null) }
    setPendiente(null)
    setEstado('inactivo')
  }, [])

  const correrPlan = useCallback(async (acciones, mio) => {
    setEstado('ejecutando')
    for (const a of acciones) {
      if (token.current !== mio) return
      const spec = ref.current.catalogo[a.accion]
      const ej = ref.current.ejecutores[a.accion]
      if (!spec || !ej) {
        agregarPaso({ texto: 'Eso no lo puedo hacer en esta pantalla.', estado: 'error' })
        break
      }
      const id = agregarPaso({ texto: ej.narrar ? ej.narrar(a) : (spec.descripcion || a.accion), estado: 'ejecutando' })
      let textoFinal = ''
      try {
        if (spec.irreversible) {
          // FRENO: nunca se ejecuta sin un "Sí" explícito del usuario.
          const val = ej.validar ? await ej.validar(a) : { ok: true }
          if (token.current !== mio) return
          if (!val.ok) { marcarPaso(id, { texto: val.mensaje, estado: 'error' }); decir(val.mensaje); break }
          const pregunta = ej.confirmacion ? ej.confirmacion(a) : `¿Confirmas: ${spec.descripcion}?`
          marcarPaso(id, { texto: pregunta, estado: 'info' })
          decir(pregunta)
          const dec = await pedirDecision({
            tipo: 'confirmar', texto: pregunta,
            opciones: [{ id: 'si', etiqueta: ej.etiquetaConfirmar || 'Sí, continuar', tono: 'principal' }, { id: 'no', etiqueta: 'No, cancelar' }],
          })
          if (token.current !== mio) return
          if (dec !== 'si') { marcarPaso(id, { texto: 'Cancelado: no se hizo nada.', estado: 'info' }); decir('Cancelado. No hice nada.'); break }
          setEstado('ejecutando')
          marcarPaso(id, { texto: ej.narrar ? ej.narrar(a) : spec.descripcion, estado: 'ejecutando' })
        } else {
          decir(ej.narrar ? ej.narrar(a) : '')
        }
        let r = await ej.ejecutar(a)
        if (token.current !== mio) return
        if (r?.pregunta) {
          decir(r.pregunta.texto)
          const dec = await pedirDecision({ tipo: 'elegir', texto: r.pregunta.texto, opciones: [...r.pregunta.opciones, { id: '__cancelar', etiqueta: 'Ninguno', tono: 'peligro' }] })
          if (token.current !== mio) return
          if (!dec || dec === '__cancelar') { marcarPaso(id, { texto: 'Cancelado: no se hizo nada.', estado: 'info' }); break }
          setEstado('ejecutando')
          r = await ej.continuar(a, dec)
          if (token.current !== mio) return
        }
        textoFinal = r?.mensaje || 'Hecho.'
        marcarPaso(id, { texto: textoFinal, estado: r?.ok ? 'ok' : 'error' })
        decir(textoFinal)
        if (!r?.ok) break
      } catch (e) {
        marcarPaso(id, { texto: `No pude hacerlo: ${e.message}`, estado: 'error' })
        break
      }
      await new Promise(res => setTimeout(res, PAUSA_ENTRE_PASOS_MS))
    }
    if (token.current === mio) { setEstado('inactivo'); setPendiente(null) }
  }, [agregarPaso, marcarPaso, pedirDecision, decir])

  // Punto de entrada: lo dictado (o escrito) ya como texto.
  const procesarTexto = useCallback(async textoCrudo => {
    const mio = ++token.current
    detenerHabla()
    setError(null); setRespuesta(null); setPasos([]); setPendiente(null)
    const texto = numerosEnPalabras(textoCrudo)
    setTranscripcion(texto)
    setEstado('interpretando')
    try {
      const r = await interpretarComando({
        texto, pantalla: ref.current.pantalla, catalogo: ref.current.catalogo, ejemplos: ref.current.ejemplos,
        contexto: ref.current.getContexto?.(),
      })
      if (token.current !== mio) return
      if (r.tipo === 'comando') {
        if (!r.acciones?.length) {
          const m = r.aclaracion || 'No entendí qué quieres hacer en esta pantalla.'
          setRespuesta(m); decir(m); setEstado('inactivo')
          return
        }
        await correrPlan(r.acciones, mio)
      } else {
        setRespuesta(r.respuesta || 'Puedo ayudarte con esta pantalla por voz.')
        decir(r.respuesta)
        setEstado('inactivo')
      }
    } catch (e) {
      if (token.current !== mio) return
      setError(`No pude interpretar el comando: ${e.message}. ¿Está encendido el motor de IA?`)
      setEstado('inactivo')
    }
  }, [correrPlan, decir])

  const dictado = useDictado({ onTexto: procesarTexto })
  useEffect(() => () => { token.current++; detenerHabla() }, [])

  return {
    habilitado, estado, transcripcion, pasos, pendiente, respuesta, error: error || dictado.error,
    ocupado: estado !== 'inactivo' || dictado.estado !== 'inactivo',
    dictado, procesarTexto, decidir, cancelar,
  }
}
