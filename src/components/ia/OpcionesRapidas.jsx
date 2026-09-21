// Burbuja de opciones clicables: la forma de "preguntarle algo rápido" al usuario dentro de un
// chat cuando NO se usa la voz (con el modo voz activo, la misma pregunta también se lee en voz
// alta y se puede contestar dictando; los botones siguen ahí). Reutilizable: cualquier pantalla
// (IA, Ventas, Caja) puede pintarla con sus propias opciones.
//
//   <OpcionesRapidas
//     opciones={[{ id: 'recibo', etiqueta: 'Recibo' }, { id: 'factura', etiqueta: 'Factura' }]}
//     elegida={null}                      // id ya elegido (queda resaltado; el resto se apaga)
//     onElegir={op => ...}
//   />
//
// `tono="peligro"` pinta la opción en ámbar/rojo para acciones que no se pueden deshacer.

const TONOS = {
  normal: { borde: 'oklch(1 0 0 / .22)', fondo: 'oklch(0.2 0.02 250 / .5)', fondoElegida: 'oklch(1 0 0 / .16)', bordeElegida: 'oklch(1 0 0 / .7)' },
  principal: { borde: 'oklch(0.78 0.16 155 / .55)', fondo: 'oklch(0.78 0.16 155 / .10)', fondoElegida: 'oklch(0.78 0.16 155 / .25)', bordeElegida: 'oklch(0.78 0.16 155)' },
  peligro: { borde: 'oklch(0.82 0.14 75 / .55)', fondo: 'oklch(0.82 0.14 75 / .10)', fondoElegida: 'oklch(0.82 0.14 75 / .25)', bordeElegida: 'oklch(0.82 0.14 75)' },
}

export default function OpcionesRapidas({ opciones, elegida = null, onElegir, deshabilitado = false }) {
  if (!opciones?.length) return null
  const resuelta = elegida !== null && elegida !== undefined
  return (
    <div role="group" data-testid="opciones-rapidas" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
      {opciones.map(op => {
        const t = TONOS[op.tono] || TONOS.normal
        const esta = resuelta && elegida === op.id
        return (
          <button
            key={op.id}
            data-opcion={op.id}
            aria-pressed={esta}
            disabled={resuelta || deshabilitado}
            onClick={() => onElegir?.(op)}
            style={{
              padding: '9px 18px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: resuelta || deshabilitado ? 'default' : 'pointer',
              color: 'var(--ink)', textShadow: '0 1px 2px rgba(0,0,0,.6)',
              background: esta ? t.fondoElegida : t.fondo,
              border: `1.5px solid ${esta ? t.bordeElegida : t.borde}`,
              opacity: resuelta && !esta ? 0.35 : 1, transition: 'all .15s',
            }}
          >
            {op.etiqueta}
          </button>
        )
      })}
    </div>
  )
}
