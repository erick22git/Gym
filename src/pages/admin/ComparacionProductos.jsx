// ─── Antes → Después de productos (panel tipo "log técnico") ───────────────
// Adaptación de un diff de código a filas de producto. Decisiones de diseño:
//  · Fondo NEGRO FIJO (#0d1117): es un panel de log, no parte del glass UI, y
//    no cambia con el tema. Por eso no lleva backdrop-filter ni capas glass.
//  · Único código de color: VERDE (nuevo / subió), ROJO (eliminado / bajó),
//    ÁMBAR (requiere atención: nombre parecido, falta elegir modo, rechazo).
//    Sin acentos morados. Lo que no cambió va en gris neutro, sin tinte.
//  · Revelado fila por fila con stagger, con tope de retraso para que una
//    lista larga no tarde: a partir de cierta fila todas entran juntas.
//  · Respeta prefers-reduced-motion (sin animación, contenido directo).
//  · El revelado es CSS puro (keyframes + animation-delay), NO framer-motion:
//    dentro del chat, el <AnimatePresence initial={false}> hace que los
//    `motion` descendientes se monten ya en su estado final y nunca animen.

const C = {
  bg: '#0d1117',
  borde: '#30363d',
  texto: '#e6edf3',
  tenue: '#8b949e',
  verde: '#3fb950',
  rojo: '#f85149',
  ambar: '#d29922',
}

const ESTILOS = {
  nuevo:     { color: C.verde, tinte: 'rgba(63,185,80,.10)',  simbolo: '+', etiqueta: 'NUEVO' },
  sube:      { color: C.verde, tinte: 'rgba(63,185,80,.10)',  simbolo: '~', etiqueta: 'SUBE' },
  baja:      { color: C.rojo,  tinte: 'rgba(248,81,73,.10)',  simbolo: '~', etiqueta: 'BAJA' },
  eliminado: { color: C.rojo,  tinte: 'rgba(248,81,73,.10)',  simbolo: '−', etiqueta: 'ELIMINADO' },
  atencion:  { color: C.ambar, tinte: 'rgba(210,153,34,.12)', simbolo: '!', etiqueta: 'REVISAR' },
  igual:     { color: C.tenue, tinte: 'transparent',          simbolo: '=', etiqueta: 'IGUAL' },
}

// Dirección del cambio de una fila que ya existía.
export function estadoDeCambio(antes, despues) {
  if (despues > antes) return 'sube'
  if (despues < antes) return 'baja'
  return 'igual'
}

// Filas de un lote YA guardado (los `resultados` de importarLote / lo que
// guarda la auditoría): un producto creado es "nuevo", uno actualizado va de
// stock_anterior a stock_nuevo (o al stock real leído después, si existe).
export function filasDeLote(guardado) {
  // Los actualizados primero: son los que cambian un stock real.
  const ordenado = [...(guardado || [])].sort((a, b) => (a.accion === 'crear') - (b.accion === 'crear'))
  return ordenado.map((g, i) => {
    const despues = g.stock_real ?? g.stock_nuevo
    if (g.accion === 'crear') return { key: `l-${g.producto_id ?? i}`, nombre: g.nombre, antes: null, despues, estado: 'nuevo' }
    return {
      key: `l-${g.producto_id ?? i}`, nombre: g.nombre, antes: g.stock_anterior, despues,
      estado: estadoDeCambio(g.stock_anterior, despues),
      nota: g.modo === 'sumar' ? `sumado: ${g.stock_anterior} + ${g.cantidad_archivo}` : g.modo === 'reemplazar' ? 'reemplazado' : null,
    }
  })
}

// Lo que pasará (o pasó) al revertir ese lote: lo creado se elimina; lo
// actualizado vuelve a su stock anterior.
export function filasDeshacer(items) {
  return (items || []).map((g, i) => (g.accion === 'crear'
    ? { key: `u-${g.producto_id ?? i}`, nombre: g.nombre, antes: g.stock_nuevo, despues: null, estado: 'eliminado' }
    : { key: `u-${g.producto_id ?? i}`, nombre: g.nombre, antes: g.stock_nuevo, despues: g.stock_anterior, estado: estadoDeCambio(g.stock_nuevo, g.stock_anterior) }))
}

const CSS = `
@keyframes cp-fila { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: none; } }
.cp-fila { animation: cp-fila .22s ease-out both; animation-delay: var(--cp-delay, 0s); }
@media (prefers-reduced-motion: reduce) { .cp-fila { animation: none; } }
`

const STAGGER = 0.045
const MAX_DELAY = 0.9 // una lista de 15 o de 500 filas termina de revelarse en ≤ ~1 s

// filas: [{ key, nombre, antes: number|null, despues: number|null, estado, nota? }]
export default function ComparacionProductos({ filas, titulo = 'Antes → Después', subtitulo, maxHeight = 320 }) {
  if (!filas?.length) return null

  const cuenta = e => filas.filter(f => f.estado === e).length
  const resumen = [
    cuenta('nuevo') && { texto: `+${cuenta('nuevo')} nuevos`, color: C.verde },
    (cuenta('sube') + cuenta('baja') + cuenta('igual')) > 0 && { texto: `~${cuenta('sube') + cuenta('baja') + cuenta('igual')} existentes`, color: C.tenue },
    cuenta('eliminado') && { texto: `−${cuenta('eliminado')} eliminados`, color: C.rojo },
    cuenta('atencion') && { texto: `!${cuenta('atencion')} a revisar`, color: C.ambar },
  ].filter(Boolean)

  return (
    <div
      role="table"
      aria-label={titulo}
      data-testid="comparacion-productos"
      style={{
        background: C.bg, border: `1px solid ${C.borde}`, borderRadius: 10, overflow: 'hidden',
        fontFamily: 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
        color: C.texto, textShadow: 'none', margin: '10px 0 12px',
      }}
    >
      <style>{CSS}</style>
      {/* Cabecera estilo terminal (los puntos son solo decoración) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: `1px solid ${C.borde}`, flexWrap: 'wrap' }}>
        <div aria-hidden style={{ display: 'flex', gap: 5 }}>
          {[C.rojo, C.ambar, C.verde].map(c => <span key={c} style={{ width: 9, height: 9, borderRadius: 999, background: c, opacity: 0.75 }} />)}
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: C.texto }}>{titulo}</span>
        {subtitulo && <span style={{ fontSize: 11, color: C.ambar }}>{subtitulo}</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, fontSize: 10.5 }}>
          {resumen.map(r => <span key={r.texto} style={{ color: r.color }}>{r.texto}</span>)}
        </span>
      </div>

      <div role="rowgroup" style={{ maxHeight, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: `${C.borde} ${C.bg}` }}>
        {filas.map((f, i) => {
          const est = ESTILOS[f.estado] || ESTILOS.igual
          return (
            <div
              role="row"
              key={f.key ?? i}
              data-estado={f.estado}
              className="cp-fila"
              style={{
                '--cp-delay': `${Math.min(i * STAGGER, MAX_DELAY).toFixed(3)}s`,
                background: est.tinte, borderLeft: `3px solid ${f.estado === 'igual' ? 'transparent' : est.color}`,
                padding: '5px 12px 5px 9px', fontSize: 12, lineHeight: 1.5,
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '14px minmax(0,1fr) auto', gap: 8, alignItems: 'center' }}>
                <span aria-hidden style={{ color: est.color, fontWeight: 700 }}>{est.simbolo}</span>
                <span role="cell" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: f.estado === 'eliminado' ? C.rojo : C.texto, textDecoration: f.estado === 'eliminado' ? 'line-through' : 'none' }} title={f.nombre}>
                  {f.nombre}
                </span>
                <span role="cell" style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                  <span style={{ color: C.tenue, minWidth: 18, textAlign: 'right' }}>{f.antes ?? '—'}</span>
                  <span aria-label="pasa a" style={{ color: est.color }}>→</span>
                  <span style={{ color: est.color, fontWeight: 700, minWidth: 18 }}>{f.despues ?? '—'}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.06em', color: est.color, border: `1px solid ${est.color}`, borderRadius: 999, padding: '0 6px', opacity: 0.9 }}>
                    {est.etiqueta}
                  </span>
                </span>
              </div>
              {f.nota && <div style={{ fontSize: 10.5, color: C.ambar, paddingLeft: 22 }}>{f.nota}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
