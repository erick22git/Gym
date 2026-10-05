// Configuración → Asistente IA: modelo y perfil de hardware. Lista los modelos instalados en el Ollama local
// (sin internet), muestra el micro-benchmark de este equipo y permite cambiar de modelo/perfil.
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Cpu, Gauge, RefreshCw, Zap } from 'lucide-react'
import { cargarPrefs, guardarPref } from '../../ia/motorChat'
import '../../ia/ia.css'

const BASE = 'http://localhost:8420'

export default function ConfigModeloIA() {
  const [info, setInfo] = useState(null)
  const [prefs, setPrefs] = useState(null)
  const [midiendo, setMidiendo] = useState(false)
  const [error, setError] = useState('')

  async function cargar() {
    setPrefs(await cargarPrefs(true))
    try { setInfo(await (await fetch(`${BASE}/modelos`)).json()) } catch { setError('El asistente local todavía no está listo; reintenta en unos segundos.') }
  }
  useEffect(() => { cargar() }, [])

  async function elegirModelo(m) { await guardarPref('ia_modelo', m); setPrefs(await cargarPrefs(true)); toast.success(`Modelo: ${m}`) }
  async function elegirPerfil(p) { await guardarPref('ia_perfil', p); setPrefs(await cargarPrefs(true)); toast.success(`Perfil: ${info?.perfiles?.[p]?.etiqueta || p}`) }
  async function medir() {
    setMidiendo(true)
    try {
      const r = await (await fetch(`${BASE}/benchmark`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modelo: prefs?.modelo || info?.modelo_por_defecto }) })).json()
      if (r.error) throw new Error(r.error)
      await guardarPref('ia_benchmark', JSON.stringify({ ...r, fecha: Date.now() }))
      setPrefs(await cargarPrefs(true))
    } catch (e) { toast.error(`No se pudo medir: ${e.message}`) }
    setMidiendo(false)
  }

  async function alternarRendimiento() {
    await guardarPref('ia_modo_rendimiento', prefs.rendimiento === '1' ? '0' : '1')
    setPrefs(await cargarPrefs(true))
    window.dispatchEvent(new Event('ia:rendimiento'))
  }

  if (!prefs) return <div style={{ color: 'var(--dim)', fontSize: 13 }}>Cargando…</div>
  let bench = null
  try { bench = prefs.benchmark ? JSON.parse(prefs.benchmark) : null } catch { /* sin medición */ }
  const modeloActual = prefs.modelo || info?.modelo_por_defecto
  const perfilActual = prefs.perfil || info?.perfil_por_defecto

  const caja = { padding: '14px 16px', borderRadius: 12, background: 'oklch(0.13 0.02 250 / .34)', border: '1px solid var(--line)' }
  const etiqueta = { fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }
  const selector = { width: '100%', padding: '9px 12px', borderRadius: 10, fontSize: 13, background: 'oklch(0.2 0.02 250 / .5)', color: 'var(--ink)', border: '1px solid oklch(1 0 0 / .18)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 680 }} data-testid="config-modelo-ia">
      <p style={{ fontSize: 13, color: 'oklch(0.88 0.01 250 / .85)', lineHeight: 1.6, margin: 0 }}>
        El asistente corre 100 % en este equipo, sin internet. Aquí eliges qué modelo usa. Los comandos <code className="ia-md-codigo">/modelo</code> y <code className="ia-md-codigo">/tema</code> del chat hacen lo mismo.
      </p>
      {error && <div style={{ ...caja, color: 'var(--ia-aviso)', fontSize: 13 }}>{error}</div>}

      <div style={caja}>
        <div style={etiqueta}><Cpu size={14} /> Modelo de lenguaje</div>
        <select style={selector} value={modeloActual || ''} onChange={e => elegirModelo(e.target.value)} data-testid="selector-modelo" disabled={!info?.modelos?.length}>
          {(info?.modelos?.length ? info.modelos : [modeloActual || 'qwen2.5:3b']).map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <div style={{ fontSize: 11.5, color: 'oklch(0.88 0.01 250 / .7)', marginTop: 6 }}>Solo aparecen los modelos ya instalados en este equipo. Instalar otros modelos requiere internet y no forma parte de la app.</div>
      </div>

      <div style={caja}>
        <div style={etiqueta}><Gauge size={14} /> Perfil de rendimiento</div>
        <select style={selector} value={perfilActual || ''} onChange={e => elegirPerfil(e.target.value)} data-testid="selector-perfil">
          {['basico', 'medio', 'alto'].filter(id => info?.perfiles?.[id]).map(id => [id, info.perfiles[id]]).map(([id, p]) => <option key={id} value={id}>{p.etiqueta}</option>)}
        </select>
        <div style={{ fontSize: 12.5, color: 'oklch(0.88 0.01 250 / .85)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {bench
            ? <span data-testid="resultado-benchmark">Medición de este equipo: <b>{bench.tokens_por_segundo} tokens por segundo</b> · primer token en {(bench.ms_primer_token / 1000).toFixed(1)} s → perfil recomendado: <b>{info?.perfiles?.[bench.perfil_recomendado]?.etiqueta || bench.perfil_recomendado}</b></span>
            : <span>Todavía no se ha medido este equipo (se mide solo la primera vez que el asistente está listo).</span>}
          <button className="ia-barra-btn" onClick={medir} disabled={midiendo} data-testid="medir-equipo">
            <RefreshCw size={11} className={midiendo ? 'ia-giro' : ''} /> {midiendo ? 'Midiendo (~5 s)…' : 'Medir de nuevo'}
          </button>
        </div>
      </div>

      <div style={{ ...caja, display: 'flex', alignItems: 'center', gap: 14 }}>
        <Zap size={18} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Modo rendimiento</div>
          <div style={{ fontSize: 12, color: 'oklch(0.88 0.01 250 / .75)', marginTop: 2 }}>Simplifica las animaciones de la mascota (sin avatar animado, sin resorte ni brillos). Útil en equipos lentos.</div>
        </div>
        <button type="button" role="switch" aria-checked={prefs.rendimiento === '1'} aria-label="Modo rendimiento" data-testid="interruptor-rendimiento" onClick={alternarRendimiento}
          style={{ width: 46, height: 26, borderRadius: 999, border: '1px solid oklch(1 0 0 / .25)', cursor: 'pointer', position: 'relative', flexShrink: 0, background: prefs.rendimiento === '1' ? 'oklch(0.78 0.16 155 / .55)' : 'oklch(0.2 0.02 250 / .6)' }}>
          <span style={{ position: 'absolute', top: 2, left: prefs.rendimiento === '1' ? 22 : 2, width: 20, height: 20, borderRadius: 999, background: '#fff', transition: 'left .15s' }} />
        </button>
      </div>
    </div>
  )
}
