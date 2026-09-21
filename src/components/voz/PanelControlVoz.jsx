// Panel del control por voz de una pantalla (Ventas, Caja): micrófono, caja de texto alternativa,
// lo que se entendió, los pasos ejecutándose con su estado, y la confirmación obligatoria antes de
// cualquier acción irreversible. Se alimenta del hook useControlVoz.
import { useState } from 'react'
import { Mic, Square, Send, Check, X, Info, Loader2 } from 'lucide-react'
import OpcionesRapidas from '../ia/OpcionesRapidas'
import './voz.css'

const COLOR = { ok: 'oklch(0.78 0.16 155)', error: 'oklch(0.72 0.18 25)', info: 'oklch(0.82 0.14 75)', ejecutando: 'oklch(0.78 0.16 250)' }

export default function PanelControlVoz({ voz, ayuda }) {
  const [texto, setTexto] = useState('')
  if (!voz?.habilitado) return null
  const { dictado } = voz
  const grabando = dictado.estado === 'grabando'
  const transcribiendo = dictado.estado === 'transcribiendo'

  function enviarTexto() {
    const t = texto.trim()
    if (!t || voz.ocupado) return
    setTexto('')
    voz.procesarTexto(t)
  }

  return (
    <div data-testid="panel-control-voz" style={{ margin: '0 0 12px', padding: '10px 12px', borderRadius: 12, border: '1px solid var(--line, oklch(1 0 0 / .14))', background: 'oklch(0.13 0.02 250 / .5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {dictado.disponible && (
          <button
            type="button"
            data-testid="voz-mic"
            data-estado={dictado.estado}
            onClick={() => (grabando ? dictado.detener() : dictado.iniciar())}
            disabled={transcribiendo || (voz.ocupado && !grabando)}
            title={grabando ? 'Terminar de grabar' : 'Hablar (funciona sin internet)'}
            aria-label={grabando ? 'Terminar de grabar' : 'Hablar'}
            aria-pressed={grabando}
            className={`clientes-action-icon ia-mic ${grabando ? 'ia-mic--grabando' : ''}`}
            style={{ flexShrink: 0, width: 38, height: 38, opacity: transcribiendo ? 0.5 : 1 }}
          >
            {grabando ? <Square size={15} color="oklch(0.97 0.01 250)" /> : <Mic size={17} color="oklch(0.97 0.01 250)" />}
          </button>
        )}
        <input
          data-testid="voz-texto"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); enviarTexto() } }}
          placeholder={ayuda || 'Di o escribe un comando…'}
          disabled={voz.ocupado}
          style={{ flex: 1, minWidth: 0, background: 'oklch(0.2 0.02 250 / .5)', border: '1px solid oklch(1 0 0 / .18)', borderRadius: 9, padding: '7px 11px', fontSize: 12.5, color: 'oklch(0.97 0.01 250)', outline: 'none' }}
        />
        <button type="button" data-testid="voz-enviar" onClick={enviarTexto} disabled={!texto.trim() || voz.ocupado} className="clientes-action-icon" title="Enviar comando" style={{ flexShrink: 0, width: 34, height: 34, opacity: !texto.trim() || voz.ocupado ? 0.4 : 1 }}>
          <Send size={14} color="oklch(0.97 0.01 250)" />
        </button>
      </div>

      <div role="status" aria-live="polite" data-testid="voz-estado" style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5, color: 'var(--ink, oklch(0.97 0.01 250))' }}>
        {grabando && <div style={{ color: COLOR.info }}>Grabando… {Math.floor(dictado.segundos / 60)}:{String(dictado.segundos % 60).padStart(2, '0')} — habla y toca el cuadrado para terminar</div>}
        {transcribiendo && <div style={{ color: COLOR.ejecutando }}>Transcribiendo en este equipo (sin internet)…</div>}
        {voz.estado === 'interpretando' && <div style={{ color: COLOR.ejecutando }}>Interpretando lo que pediste…</div>}

        {voz.transcripcion && <div data-testid="voz-transcripcion" style={{ opacity: 0.85 }}>Entendí: «{voz.transcripcion}»</div>}

        {voz.pasos.map(p => (
          <div key={p.id} data-testid="voz-paso" data-estado={p.estado} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, color: COLOR[p.estado] || 'inherit' }}>
            <span style={{ flexShrink: 0, marginTop: 2, display: 'flex' }}>
              {p.estado === 'ok' && <Check size={13} />}
              {p.estado === 'error' && <X size={13} />}
              {p.estado === 'info' && <Info size={13} />}
              {p.estado === 'ejecutando' && <Loader2 size={13} style={{ animation: 'ia-giro 1s linear infinite' }} />}
            </span>
            <span>{p.texto}</span>
          </div>
        ))}

        {voz.pendiente && (
          <div data-testid="voz-pendiente" style={{ marginTop: 4, padding: '10px 12px', borderRadius: 10, border: `1px solid ${voz.pendiente.tipo === 'confirmar' ? 'oklch(0.82 0.14 75 / .6)' : 'oklch(1 0 0 / .2)'}`, background: voz.pendiente.tipo === 'confirmar' ? 'oklch(0.82 0.14 75 / .08)' : 'transparent' }}>
            <div style={{ fontWeight: 700 }}>{voz.pendiente.texto}</div>
            <OpcionesRapidas opciones={voz.pendiente.opciones} onElegir={op => voz.decidir(op.id)} />
          </div>
        )}

        {voz.respuesta && <div data-testid="voz-respuesta" style={{ color: COLOR.info }}>{voz.respuesta}</div>}
        {voz.error && <div data-testid="voz-error" style={{ color: COLOR.error }}>{voz.error}</div>}
        {voz.estado !== 'inactivo' && !voz.pendiente && (
          <button type="button" onClick={voz.cancelar} data-testid="voz-cancelar" style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--dim, oklch(0.88 0.01 250 / .7))', cursor: 'pointer', fontSize: 11.5, textDecoration: 'underline', padding: 0 }}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}
