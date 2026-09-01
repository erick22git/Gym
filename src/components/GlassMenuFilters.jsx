import { useEffect } from 'react'

// Vidrio ESTÁTICO del TopNav — cadena de filtros SVG puros (feDiffuseLighting
// + feDisplacementMap + fresnel, public/filters-menu-glass.svg), aplicado
// vía backdrop-filter en TitleBar.jsx/index.css. Sistema DELIBERADAMENTE
// separado del motor GlassEngine (glass-engine/core/cursor.js + glass.js,
// el que sí sigue el cursor y se usa en el login) — no importa nada de ahí
// ni depende de renderer.js, solo un fetch + inyección de marcado una vez,
// oculto, en <body>. Mismo motivo que refraction.js para inyectar en línea
// en vez de <object>: backdrop-filter:url(#id) necesita el <filter> en el
// MISMO documento que lo usa.
const SOURCE_PATH = '/filters-menu-glass.svg'
const CONTAINER_ID = 'glass-menu-filters-container'
let injected = false

// [DEV — pedido explícito, tras varias rondas de "el cambio de filtro no
// se ve"] `injected` es una bandera a nivel de MÓDULO: sobrevive al hot
// reload de React (Vite solo reemplaza el módulo del componente, no este
// archivo si no cambió), así que en producción el SVG se pide UNA vez por
// carga de página — correcto, evita refetch innecesario. El problema es
// en desarrollo: cada vez que se edita public/filters-menu-glass.svg (un
// archivo estático, no un módulo JS) nada le avisa a React que hay que
// re-pedirlo, así que la app seguía usando la versión vieja ya inyectada
// hasta un reinicio completo del proceso de Electron. En dev, saltamos la
// bandera y volvemos a buscar el SVG en cada montaje (con un query param
// que invalida cualquier caché HTTP), reemplazando el contenido de un
// contenedor con id FIJO en vez de agregar uno nuevo cada vez (evitar
// <filter id="..."> duplicados, que dejarían url(#id) apuntando a
// cualquiera de los duplicados de forma ambigua). Producción no cambia:
// sigue siendo un solo fetch, guardado por la bandera de siempre.
const isDev = import.meta.env.DEV

export default function GlassMenuFilters() {
  useEffect(() => {
    if (injected && !isDev) return
    injected = true

    const url = isDev ? `${SOURCE_PATH}?t=${Date.now()}` : SOURCE_PATH

    fetch(url)
      .then((res) => (res.ok ? res.text() : Promise.reject(res.statusText)))
      .then((markup) => {
        let container = document.getElementById(CONTAINER_ID)
        if (!container) {
          container = document.createElement('div')
          container.id = CONTAINER_ID
          container.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'
          document.body.appendChild(container)
        }
        container.innerHTML = markup
      })
      .catch(() => {
        console.warn(
          '[GlassMenuFilters] No se pudieron cargar los filtros SVG del menú ' +
          '(sirve la carpeta con un servidor estático, no con file://).'
        )
      })
  }, [])

  return null
}
