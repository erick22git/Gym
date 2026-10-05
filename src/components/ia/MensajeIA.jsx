// Piezas de mensaje del asistente compartidas por la página de IA y la mascota flotante:
// texto con markdown y streaming, tarjeta de aprobación de acciones y tarjetas de pasos del pipeline.
import { useState } from 'react'
import { Copy, Check, RefreshCw, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronRight, ShieldCheck, Clock } from 'lucide-react'
import Markdown from './Markdown'
import { describirAccion } from '../../ia/registroAcciones'
import '../../ia/ia.css'

export function TextoIA({ msg, esUltimo, puedeRegenerar, onRegenerar }) {
  const [copiado, setCopiado] = useState(false)
  async function copiar() {
    try { await navigator.clipboard.writeText(msg.texto || ''); setCopiado(true); setTimeout(() => setCopiado(false), 1500) } catch { /* sin portapapeles */ }
  }
  return (
    <div>
      <Markdown texto={msg.texto} />
      {msg.streaming && <span className="ia-cursor" aria-hidden="true" />}
      {!msg.streaming && msg.texto && (
        <div className="ia-barra">
          <button className="ia-barra-btn" onClick={copiar} title="Copiar respuesta">
            {copiado ? <Check size={11} /> : <Copy size={11} />} {copiado ? 'Copiado' : 'Copiar'}
          </button>
          {esUltimo && puedeRegenerar && (
            <button className="ia-barra-btn" onClick={onRegenerar} title="Volver a generar la respuesta"><RefreshCw size={11} /> Regenerar</button>
          )}
          {msg.metricas && (
            <span className="ia-metricas" title="Tiempo hasta el primer token / total">
              {(msg.metricas.primerTokenMs / 1000).toFixed(1)} s · {(msg.metricas.totalMs / 1000).toFixed(1)} s
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// Tarjeta de aprobación: lo que el asistente PROPONE hacer. No ejecuta nada hasta «Aprobar».
export function TarjetaAcciones({ msg, onAprobar, onRechazar }) {
  const pendiente = msg.estado === 'pendiente'
  return (
    <div data-testid="tarjeta-acciones">
      {msg.texto && <Markdown texto={msg.texto} />}
      <div className={`ia-tarjeta ${pendiente ? 'ia-tarjeta-aviso' : ''}`}>
        <div className="ia-tarjeta-titulo"><ShieldCheck size={14} color="var(--ia-aviso)" /> {pendiente ? 'Necesita tu aprobación' : msg.estado === 'rechazada' ? 'Rechazada' : msg.estado === 'ejecutando' ? 'Ejecutando…' : 'Hecho'}</div>
        <ul className="ia-tarjeta-lista">
          {msg.acciones.map((a, i) => <li key={i}>• {describirAccion(a)}</li>)}
        </ul>
        {pendiente && (
          <div className="ia-botones">
            <button className="ia-boton ia-boton-principal" data-testid="aprobar-accion" onClick={() => onAprobar(msg.id)}>Aprobar</button>
            <button className="ia-boton" data-testid="rechazar-accion" onClick={() => onRechazar(msg.id)}>Rechazar</button>
          </div>
        )}
        {msg.resultado && !pendiente && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ia-texto-suave)' }}>{msg.resultado}</div>}
      </div>
    </div>
  )
}

const ICONO_ESTADO = {
  curso: <Loader2 size={14} className="ia-giro ia-estado-curso" />,
  listo: <CheckCircle2 size={14} className="ia-estado-listo" />,
  error: <XCircle size={14} className="ia-estado-error" />,
  espera: <Clock size={14} className="ia-estado-espera" />,
}
const TXT_ESTADO = { curso: 'en curso', listo: 'listo', error: 'error', espera: 'esperando tu confirmación' }

// Pipeline de importación (Lector → Estructurador → Validador → Importador) como tarjetas colapsables.
export function TarjetaPasos({ msg }) {
  const [abiertos, setAbiertos] = useState({})
  return (
    <div className="ia-tarjeta" data-testid="tarjeta-pasos">
      {msg.titulo && <div className="ia-tarjeta-titulo" style={{ marginBottom: 4 }}>{msg.titulo}</div>}
      {msg.pasos.map((p, i) => {
        const abierto = abiertos[i] ?? p.estado === 'error'
        return (
          <div key={p.id || i} className="ia-paso">
            <button className="ia-paso-cab" aria-expanded={abierto} onClick={() => setAbiertos(a => ({ ...a, [i]: !abierto }))}>
              {abierto ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              {ICONO_ESTADO[p.estado] || null}
              <span style={{ flex: 1 }}>{p.nombre}</span>
              <span className={`ia-estado-${p.estado}`} style={{ fontSize: 11 }}>
                {TXT_ESTADO[p.estado] || p.estado}{p.ms != null ? ` · ${(p.ms / 1000).toFixed(1)} s` : ''}
              </span>
            </button>
            {abierto && <div className="ia-paso-detalle">{p.detalle || 'Sin detalle.'}</div>}
          </div>
        )
      })}
    </div>
  )
}
