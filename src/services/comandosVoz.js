// Cliente del intérprete de comandos por voz (scripts/ocr_service.py → /interpretar-comando).
// El servicio local usa el mismo modelo (qwen2.5) y el mismo patrón supervisor + agente que el chat
// de importación; acá solo se le manda lo dicho, el catálogo de acciones REALES de la pantalla y
// un resumen del estado, y devuelve acciones ya validadas contra ese catálogo.

const BASE = 'http://localhost:8420'

export async function interpretarComando({ texto, pantalla, catalogo, ejemplos, contexto, signal }) {
  const resp = await fetch(`${BASE}/interpretar-comando`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto, pantalla, catalogo, ejemplos, contexto }),
    signal,
  })
  if (!resp.ok) throw new Error(`El servicio de IA respondió ${resp.status}`)
  const data = await resp.json()
  if (data.error) throw new Error(data.error)
  return data
}
