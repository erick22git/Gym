// Mascota flotante: la misma conversación y el mismo cerebro que la página de IA, en un widget que vive DENTRO
// de la app (no es una ventana del sistema). Se expande con un resorte tipo "Island": ancho, alto, radio y
// posición se animan por separado. Siempre oscura. Respeta prefers-reduced-motion y el «Modo rendimiento».
import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'
import { BotAvatar } from 'bot-avatars'
import { ThinkingOrb } from 'thinking-orbs'
import { BorderBeam } from 'border-beam'
import { X, Send, Square, Mic, ExternalLink, Volume2, VolumeX } from 'lucide-react'
import { useChat, chatStore } from '../../ia/chatStore'
import { enviarTexto, detener, regenerar, aprobarAcciones, rechazarAcciones, manejarOpcion, cargarPrefs, guardarPref } from '../../ia/motorChat'
import { sugerirComandos } from '../../ia/resolver'
import { MODOS } from '../../ia/registroAcciones'
import { TextoIA, TarjetaAcciones, TarjetaPasos } from './MensajeIA'
import OpcionesRapidas from './OpcionesRapidas'
import useDictado from '../../hooks/useDictado'
import useVozHabilitada from '../../hooks/useVozHabilitada'
import useModoVoz, { guardarModoVoz } from '../../hooks/useModoVoz'
import { hablar, detenerHabla, estaHablando, hablaSoportada } from '../../utils/voz'
import { PAGES } from '../../constants'
import { DESTINOS } from '../../ia/registroAcciones'
import { useGuia } from '../../ia/guiaStore'
import '../../ia/ia.css'

const BURBUJA = 64
const PANEL_W = 380
const PANEL_H = 540
const MARGEN = 12
const clamp = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b))

export function useModoRendimiento() {
  const [m, setM] = useState(false)
  useEffect(() => {
    const leer = () => cargarPrefs().then(p => setM(p.rendimiento === '1'))
    leer()
    window.addEventListener('ia:rendimiento', leer)
    return () => window.removeEventListener('ia:rendimiento', leer)
  }, [])
  return m
}

function TypingPuntos() {
  return <span className="ia-puntos" aria-label="Escribiendo"><i /><i /><i /></span>
}

function Mensaje({ m, idUltimoIA, generando, alAbrirIA }) {
  const esUsuario = m.role === 'user'
  let cuerpo
  if (m.type === 'typing') cuerpo = <TypingPuntos />
  else if (m.type === 'text' && !esUsuario) cuerpo = <TextoIA msg={m} esUltimo={m.id === idUltimoIA} puedeRegenerar={!generando} onRegenerar={regenerar} />
  else if (m.type === 'text' || m.type === 'success') cuerpo = <div className="ia-md" style={{ whiteSpace: 'pre-wrap' }}>{m.texto}{m.archivos?.length ? ` (${m.archivos.length} archivo/s)` : ''}</div>
  else if (m.type === 'acciones') cuerpo = <TarjetaAcciones msg={m} onAprobar={aprobarAcciones} onRechazar={rechazarAcciones} />
  else if (m.type === 'pasos') cuerpo = <TarjetaPasos msg={m} />
  else if (m.type === 'opciones') cuerpo = <div><div className="ia-md">{m.texto}</div><OpcionesRapidas opciones={m.opciones} elegida={m.elegida ?? null} onElegir={op => manejarOpcion(m.id, op)} /></div>
  else cuerpo = (
    <button className="ia-barra-btn" onClick={alAbrirIA}>
      <ExternalLink size={11} /> Abre la pantalla de IA para ver este resultado
    </button>
  )
  return (
    <div className={`ia-msg ${esUsuario ? 'ia-msg-usuario' : ''}`}>
      <div className={`ia-burbuja ${esUsuario ? 'ia-burbuja-usuario' : ''}`}>{cuerpo}</div>
    </div>
  )
}


export default function Mascota({ page, navigate }) {
  const habilitada = useVozHabilitada('mascota')
  const micHabilitado = useVozHabilitada('ia')
  const { mensajes, generando, modo } = useChat()
  const modoVoz = useModoVoz()
  const reducida = useReducedMotion()
  const rendimiento = useModoRendimiento()
  const sinAnimar = reducida || rendimiento

  const [abierta, setAbierta] = useState(false)
  const [pos, setPos] = useState(null) // {x,y} de la burbuja (esquina superior izquierda)
  const [texto, setTexto] = useState('')
  const [hablando, setHablando] = useState(false)
  const [indiceCmd, setIndiceCmd] = useState(0)
  const guia = useGuia()
  const arrastre = useRef(null)
  const listaRef = useRef(null)
  const hablados = useRef(new Set())
  const dictado = useDictado({ onTexto: t => setTexto(prev => (prev.trim() ? `${prev.trimEnd()} ${t}` : t)) })

  // Posición recordada (o esquina inferior derecha)
  useEffect(() => {
    cargarPrefs().then(p => {
      let guardada = null
      try { guardada = p.mascotaPos ? JSON.parse(p.mascotaPos) : null } catch { /* sin posición guardada */ }
      const x = guardada?.x ?? window.innerWidth - BURBUJA - 24
      const y = guardada?.y ?? window.innerHeight - BURBUJA - 24
      setPos({ x: clamp(x, MARGEN, window.innerWidth - BURBUJA - MARGEN), y: clamp(y, MARGEN, window.innerHeight - BURBUJA - MARGEN) })
    })
    const alRedim = () => setPos(p => p && ({ x: clamp(p.x, MARGEN, window.innerWidth - BURBUJA - MARGEN), y: clamp(p.y, MARGEN, window.innerHeight - BURBUJA - MARGEN) }))
    window.addEventListener('resize', alRedim)
    return () => window.removeEventListener('resize', alRedim)
  }, [])

  // Atajo de teclado: Ctrl+Mayús+A abre/cierra; Esc cierra
  useEffect(() => {
    const tecla = e => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') { e.preventDefault(); setAbierta(a => !a) }
      else if (e.key === 'Escape' && abierta && !document.querySelector('[data-testid="visor-guia"]')) setAbierta(false)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [abierta])

  // Modo voz: lee en voz alta lo nuevo que responde la IA (solo con el panel abierto: nunca relee el historial)
  useEffect(() => {
    if (!abierta) { mensajes.forEach(m => hablados.current.add(m.id)); return }
    if (!modoVoz) { mensajes.forEach(m => hablados.current.add(m.id)); return }
    for (const m of mensajes) {
      if (m.role !== 'ai' || hablados.current.has(m.id) || m.streaming) continue
      if ((m.type === 'text' || m.type === 'opciones') && m.texto) { hablados.current.add(m.id); hablar(m.texto) }
    }
  }, [mensajes, modoVoz, abierta])
  useEffect(() => {
    const iv = setInterval(() => setHablando(estaHablando()), 400)
    return () => { clearInterval(iv); detenerHabla() }
  }, [])

  useEffect(() => { if (guia.guiaId) setAbierta(false) }, [guia.guiaId]) // un recorrido no debe quedar tapado por el panel
  useEffect(() => { listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight }) }, [mensajes, abierta])

  if (!habilitada || !pos || page === PAGES.IA_IMPORTAR) return null

  const estado = dictado.estado === 'grabando' ? 'escuchando' : generando ? 'pensando' : hablando ? 'hablando' : 'reposo'

  // ── Arrastrar (burbuja o cabecera del panel). Un arrastre corto es un clic. ──
  function alPresionar(e) {
    if (e.button !== 0) return
    arrastre.current = { x0: e.clientX, y0: e.clientY, px: pos.x, py: pos.y, movido: false }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  function alMover(e) {
    const a = arrastre.current
    if (!a) return
    const dx = e.clientX - a.x0
    const dy = e.clientY - a.y0
    if (!a.movido && Math.hypot(dx, dy) < 5) return
    a.movido = true
    setPos({ x: clamp(a.px + dx, MARGEN, window.innerWidth - BURBUJA - MARGEN), y: clamp(a.py + dy, MARGEN, window.innerHeight - BURBUJA - MARGEN) })
  }
  function alSoltar(e, esBurbuja) {
    const a = arrastre.current
    arrastre.current = null
    if (!a) return
    if (a.movido) guardarPref('mascota_pos', JSON.stringify(pos))
    else if (esBurbuja) setAbierta(true)
  }

  // Geometría del panel expandido: crece hacia el lado con más espacio y siempre queda dentro de la ventana
  const w = Math.min(PANEL_W, window.innerWidth - MARGEN * 2)
  const h = Math.min(PANEL_H, window.innerHeight - MARGEN * 2)
  const panelX = clamp(pos.x + BURBUJA - w, MARGEN, window.innerWidth - w - MARGEN)
  const panelY = clamp(pos.y + BURBUJA - h, MARGEN, window.innerHeight - h - MARGEN)
  const geom = abierta
    ? { left: panelX, top: panelY, width: w, height: h, borderRadius: 22 }
    : { left: pos.x, top: pos.y, width: BURBUJA, height: BURBUJA, borderRadius: BURBUJA / 2 }
  // Island: cada propiedad con su propio resorte (el ancho "late" distinto al alto y al radio)
  const transicion = sinAnimar
    ? { duration: abierta ? 0.12 : 0.08 }
    : {
        width: { type: 'spring', stiffness: 380, damping: 32 },
        height: { type: 'spring', stiffness: 300, damping: 30 },
        borderRadius: { type: 'spring', stiffness: 420, damping: 38 },
        left: { type: 'spring', stiffness: 340, damping: 34 },
        top: { type: 'spring', stiffness: 340, damping: 34 },
      }

  const sugerencias = sugerirComandos(texto)
  const puedeEnviar = texto.trim().length > 0 && !generando
  async function enviar() {
    if (!puedeEnviar) return
    const t = texto
    setTexto('')
    detenerHabla()
    await enviarTexto(t)
  }
  const idUltimoIA = [...mensajes].reverse().find(m => m.role === 'ai' && m.type === 'text')?.id

  return (
    <motion.div
      className="mascota"
      data-testid="mascota"
      data-estado={estado}
      data-abierta={abierta}
      initial={false}
      animate={geom}
      transition={transicion}
      style={{ position: 'fixed', zIndex: 9400, overflow: 'hidden' }}
    >
      {!abierta && (
        <div
          className="mascota-burbuja"
          role="button"
          tabIndex={0}
          aria-label="Abrir el asistente (Ctrl+Mayús+A)"
          data-testid="mascota-burbuja"
          onPointerDown={alPresionar}
          onPointerMove={alMover}
          onPointerUp={e => alSoltar(e, true)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setAbierta(true) }}
        >
          <BotAvatar type="droid" state={estado === 'pensando' || estado === 'hablando' ? 'working' : 'default'} face={estado === 'hablando' ? 'mouth' : undefined} size={52} paused={rendimiento || reducida} interactive={false} />
          {estado !== 'reposo' && !rendimiento && (
            <span className="mascota-orbe"><ThinkingOrb size={20} state={estado === 'escuchando' ? 'listening' : estado === 'pensando' ? 'working' : 'composing'} paused={reducida} /></span>
          )}
        </div>
      )}

      {abierta && (
        <div className="mascota-panel" data-testid="mascota-panel">
          <div className="mascota-cab" onPointerDown={alPresionar} onPointerMove={alMover} onPointerUp={e => alSoltar(e, false)}>
            <div style={{ width: 28, height: 28, flexShrink: 0 }}><BotAvatar type="droid" size={28} paused interactive={false} state="default" /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>Asistente</div>
              <div style={{ fontSize: 10.5, opacity: .7 }}>{estado === 'reposo' ? 'Estás en: ' + (Object.values(DESTINOS).find(d => d.page === page)?.etiqueta || page) : estado}</div>
            </div>
            <div className="ia-modo" onPointerDown={e => e.stopPropagation()}>
              {Object.entries(MODOS).map(([id, m]) => (
                <button key={id} className={modo === id ? 'activo' : ''} title={m.detalle} aria-pressed={modo === id} onClick={() => chatStore.setModo(id)}>{m.etiqueta}</button>
              ))}
            </div>
            {hablaSoportada() && (
              <button className="mascota-icono" title={modoVoz ? 'Modo voz activado' : 'Activar modo voz'} aria-pressed={modoVoz} onPointerDown={e => e.stopPropagation()} onClick={() => { guardarModoVoz(!modoVoz); if (modoVoz) detenerHabla() }}>
                {modoVoz ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
            )}
            <button className="mascota-icono" aria-label="Cerrar" data-testid="mascota-cerrar" onPointerDown={e => e.stopPropagation()} onClick={() => setAbierta(false)}><X size={16} /></button>
          </div>

          <div className="mascota-lista" ref={listaRef}>
            {mensajes.length === 0 && (
              <div className="ia-md" style={{ opacity: .75, padding: '6px 4px' }}>
                Pregúntame cómo usar el sistema, pídeme que te guíe paso a paso («guíame para abrir la caja») o escribe <code className="ia-md-codigo">/ayuda</code>.
              </div>
            )}
            {mensajes.map(m => <Mensaje key={m.id} m={m} idUltimoIA={idUltimoIA} generando={generando} alAbrirIA={() => { setAbierta(false); navigate(PAGES.IA_IMPORTAR) }} />)}
          </div>

          {(dictado.estado !== 'inactivo' || dictado.error) && (
            <div className="mascota-estado" role="status">
              {dictado.estado === 'grabando' && `Escuchando… ${Math.floor(dictado.segundos / 60)}:${String(dictado.segundos % 60).padStart(2, '0')} — toca el cuadrado para terminar`}
              {dictado.estado === 'transcribiendo' && 'Transcribiendo en este equipo (sin internet)…'}
              {dictado.estado === 'inactivo' && dictado.error}
            </div>
          )}

          <div className="mascota-compositor">
            {sugerencias.length > 0 && (
              <div className="ia-comandos" role="listbox">
                {sugerencias.map((c, i) => (
                  <button key={c.cmd} role="option" aria-selected={i === indiceCmd} className={`ia-comando ${i === indiceCmd ? 'activo' : ''}`} onMouseDown={e => { e.preventDefault(); setTexto(`${c.cmd} `); setIndiceCmd(0) }}>
                    <b>{c.cmd}</b><span>{c.detalle}</span>
                  </button>
                ))}
              </div>
            )}
            <BorderBeam size="sm" colorVariant="mono" theme="dark" strength={0.7} active={!sinAnimar && (estado === 'escuchando' || estado === 'pensando')}>
              <div className="mascota-caja">
                <textarea
                  data-testid="mascota-texto"
                  value={texto}
                  rows={1}
                  placeholder="Escribe o usa el micrófono…"
                  onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => {
                    if (sugerencias.length > 0) {
                      if (e.key === 'ArrowDown') { e.preventDefault(); setIndiceCmd(i => (i + 1) % sugerencias.length); return }
                      if (e.key === 'ArrowUp') { e.preventDefault(); setIndiceCmd(i => (i - 1 + sugerencias.length) % sugerencias.length); return }
                      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey && texto.trim().toLowerCase() !== sugerencias[indiceCmd]?.cmd)) { e.preventDefault(); setTexto(`${(sugerencias[indiceCmd] || sugerencias[0]).cmd} `); setIndiceCmd(0); return }
                    }
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
                  }}
                />
                {dictado.disponible && micHabilitado && (
                  <button className="mascota-icono" data-testid="mascota-mic" aria-label={dictado.estado === 'grabando' ? 'Terminar de grabar' : 'Dictar por voz'} disabled={dictado.estado === 'transcribiendo'} onClick={() => { detenerHabla(); dictado.alternar() }}>
                    {dictado.estado === 'grabando' ? <Square size={15} /> : <Mic size={16} />}
                  </button>
                )}
                {generando
                  ? <button className="mascota-icono mascota-enviar" aria-label="Detener" data-testid="mascota-detener" onClick={detener}><Square size={15} /></button>
                  : <button className="mascota-icono mascota-enviar" aria-label="Enviar" data-testid="mascota-enviar" disabled={!puedeEnviar} onClick={enviar}><Send size={15} /></button>}
              </div>
            </BorderBeam>
          </div>
        </div>
      )}
    </motion.div>
  )
}
