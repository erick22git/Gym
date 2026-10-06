// Configuración → Apariencia del módulo de IA. Tres apariencias seleccionables (como un fondo de pantalla) que
// cambian al instante, sin recargar. Solo afectan a la página de IA y a la mascota; el resto del sistema
// mantiene el diseño Transparente. El «Video de fondo» solo existe en Transparente.
import toast from 'react-hot-toast'
import { Palette, Film } from 'lucide-react'
import { APARIENCIAS, useApariencia, setApariencia, setVideoFondo } from '../../ia/apariencia'
import '../../ia/ia.css'

// Miniaturas con los colores reales de cada apariencia (Transparente: aproximación del vidrio sobre foto oscura)
const MINI = {
  'transparente': { fondo: 'oklch(0.2 0.02 250)', panel: 'oklch(0.3 0.02 250 / .6)', texto: 'oklch(0.97 0.01 250)', borde: 'oklch(1 0 0 / .25)' },
  'lusion-oscuro': { fondo: '#000000', panel: '#2b2e3a', texto: '#ffffff', borde: '#34393f' },
  'lusion-claro': { fondo: '#f0f1fa', panel: '#ffffff', texto: '#000000', borde: '#e4e6ef' },
}

function Miniatura({ id }) {
  const m = MINI[id]
  return (
    <div aria-hidden="true" style={{ height: 78, borderRadius: 12, background: m.fondo, border: `1px solid ${m.borde}`, padding: 8, display: 'flex', flexDirection: 'column', gap: 5, justifyContent: 'flex-end' }}>
      <div style={{ alignSelf: 'flex-start', width: '62%', height: 16, borderRadius: 8, background: m.panel, border: `1px solid ${m.borde}` }} />
      <div style={{ alignSelf: 'flex-end', width: '48%', height: 16, borderRadius: 8, background: m.texto, opacity: .9 }} />
      <div style={{ height: 14, borderRadius: 999, background: m.panel, border: `1px solid ${m.borde}` }} />
    </div>
  )
}

export default function ConfigApariencia() {
  const { apariencia, videoFondo } = useApariencia()

  async function elegir(id) {
    if (id === apariencia) return
    await setApariencia(id)
    toast.success(`Apariencia: ${APARIENCIAS[id].etiqueta}`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760 }} data-testid="config-apariencia">
      <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6, margin: 0, padding: '12px 14px', borderRadius: 12, background: 'oklch(0.13 0.02 250 / .34)', border: '1px solid var(--line)' }}>
        <Palette size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        Elige cómo se ve el <b>módulo de IA</b> y la <b>mascota</b>. El resto del sistema mantiene el diseño Transparente.
      </p>

      <div role="radiogroup" aria-label="Apariencia del módulo de IA" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        {Object.entries(APARIENCIAS).map(([id, a]) => {
          const activa = apariencia === id
          return (
            <button
              key={id} type="button" role="radio" aria-checked={activa} data-testid={`apariencia-${id}`} onClick={() => elegir(id)}
              style={{ textAlign: 'left', padding: 12, borderRadius: 14, cursor: 'pointer', color: 'var(--ink)',
                background: 'oklch(0.13 0.02 250 / .34)', border: `2px solid ${activa ? 'oklch(1 0 0 / .85)' : 'var(--line)'}` }}
            >
              <Miniatura id={id} />
              <div style={{ marginTop: 10, fontSize: 14, fontWeight: 700 }}>{a.etiqueta}{activa ? ' ✓' : ''}</div>
              <div style={{ marginTop: 2, fontSize: 12, color: 'oklch(0.88 0.01 250 / .75)' }}>{a.detalle}</div>
            </button>
          )
        })}
      </div>

      {apariencia === 'transparente' && (
        <div data-testid="bloque-video-fondo" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, background: 'oklch(0.13 0.02 250 / .34)', border: '1px solid var(--line)' }}>
          <Film size={20} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Video de fondo</div>
            <div style={{ fontSize: 12, color: 'oklch(0.88 0.01 250 / .75)', marginTop: 2 }}>
              Activado: el fondo se anima al cambiar de pantalla (como siempre). Desactivado: muestra solo el último cuadro, quieto. Aplica a todo el sistema y ayuda en equipos lentos.
            </div>
          </div>
          <button type="button" role="switch" aria-checked={videoFondo} aria-label="Video de fondo" data-testid="interruptor-video-fondo"
            onClick={() => setVideoFondo(!videoFondo)}
            style={{ width: 46, height: 26, borderRadius: 999, border: '1px solid oklch(1 0 0 / .25)', cursor: 'pointer', position: 'relative', flexShrink: 0, background: videoFondo ? 'oklch(0.78 0.16 155 / .55)' : 'oklch(0.2 0.02 250 / .6)' }}>
            <span style={{ position: 'absolute', top: 2, left: videoFondo ? 22 : 2, width: 20, height: 20, borderRadius: 999, background: '#fff', transition: 'left .15s' }} />
          </button>
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--ink)', padding: '10px 14px', borderRadius: 12, background: 'oklch(0.13 0.02 250 / .34)', border: '1px solid var(--line)' }}>También puedes cambiarla escribiendo <code className="ia-md-codigo">/tema oscuro</code>, <code className="ia-md-codigo">/tema claro</code> o <code className="ia-md-codigo">/tema transparente</code> en el chat.</div>
    </div>
  )
}
