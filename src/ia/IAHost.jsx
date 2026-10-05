// Anfitrión del asistente: vive una sola vez dentro de la app (después de iniciar sesión), registra las
// acciones que el asistente puede ejecutar (navegar, guías, tema, importar…) y, más adelante, monta la
// mascota flotante y el visor de recorridos.
import { useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { PAGES } from '../constants'
import { registrarEjecutores, cargarPrefs, guardarPref } from './motorChat'
import { DESTINOS } from './registroAcciones'
import { guiaStore } from './guiaStore'
import Mascota from '../components/ia/Mascota'
import VisorGuia from '../components/ia/VisorGuia'

const ETIQUETA_PAGINA = Object.fromEntries(Object.values(DESTINOS).map(d => [d.page, d.etiqueta]))

export function aplicarTema(tema) {
  document.documentElement.setAttribute('data-ia-tema', tema)
}

export default function IAHost() {
  const { page, navigate } = useApp()

  useEffect(() => {
    const quitar = registrarEjecutores({
      navegar: destinoPage => navigate(destinoPage),
      getRuta: () => ETIQUETA_PAGINA[page] || String(page),
      aplicarTema,
      iniciarGuia: id => guiaStore.iniciar(id),
      importarArchivo: () => {
        if (page === PAGES.IA_IMPORTAR) window.dispatchEvent(new Event('ia:abrir-selector'))
        else { window.__iaAbrirSelector = true; navigate(PAGES.IA_IMPORTAR) }
      },
    })
    return quitar
  }, [page, navigate])

  // Tema guardado (solo la preferencia: los temas completos llegan con el rediseño)
  useEffect(() => { cargarPrefs().then(p => aplicarTema(p.tema || 'clasico')) }, [])

  // Micro-benchmark de ~5 s la primera vez que el asistente local está listo: recomienda un perfil.
  useEffect(() => {
    let vivo = true
    let intentos = 0
    const intentar = async () => {
      const p = await cargarPrefs()
      if (!vivo || p.benchmark) return
      try {
        const h = await (await fetch('http://localhost:8420/health')).json()
        if (!h.ollama) throw new Error('aún no')
        const r = await (await fetch('http://localhost:8420/benchmark', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json()
        if (r.error) throw new Error(r.error)
        await guardarPref('ia_benchmark', JSON.stringify({ ...r, fecha: Date.now() }))
        if (!p.perfil) await guardarPref('ia_perfil', r.perfil_recomendado)
      } catch {
        if (vivo && ++intentos < 20) setTimeout(intentar, 15000)
      }
    }
    const t = setTimeout(intentar, 20000)
    return () => { vivo = false; clearTimeout(t) }
  }, [])

  return (
    <>
      <Mascota page={page} navigate={navigate} />
      <VisorGuia />
    </>
  )
}
