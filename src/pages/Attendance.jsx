import { useState, useRef, useEffect } from 'react'
import { Scan, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Attendance() {
  const [carnet, setCarnet] = useState('')
  const [resultado, setResultado] = useState(null)
  const [asistenciasHoy, setAsistenciasHoy] = useState([])
  const inputRef = useRef(null)

  useEffect(() => {
    cargarAsistencias()
    inputRef.current?.focus()
  }, [])

  async function cargarAsistencias() {
    const data = await window.api.asistencias.getHoy()
    setAsistenciasHoy(data)
  }

  async function handleRegistrar(e) {
    e.preventDefault()
    if (!carnet.trim()) return
    const res = await window.api.asistencias.registrar(carnet.trim())
    setResultado(res)
    setCarnet('')
    if (res.ok && res.tieneMembresia) {
      toast.success(`${res.cliente.nombre} ${res.cliente.apellido} — Acceso permitido`)
      cargarAsistencias()
    } else if (res.ok && !res.tieneMembresia) {
      toast.error(`${res.cliente.nombre} — Sin membresía activa`)
    } else {
      toast.error(res.message || 'Carnet no encontrado')
    }
    setTimeout(() => setResultado(null), 4000)
    inputRef.current?.focus()
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <h1 className="titulo-metalico mb-6">Control de Acceso</h1>

      <div className="gym-card p-6 mb-4">
        <form onSubmit={handleRegistrar} className="flex gap-3">
          <div style={{ position: 'relative', flex: 1 }}>
            <Scan size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--dim)' }} />
            <input
              ref={inputRef}
              type="text"
              className="gym-input"
              placeholder="Escanear o ingresar número de carnet..."
              value={carnet}
              onChange={e => setCarnet(e.target.value)}
              style={{ paddingLeft: 40 }}
              autoComplete="off"
            />
          </div>
          <button type="submit" className="btn-primary">Registrar</button>
        </form>

        {resultado && (
          <div style={{
            marginTop: 16, padding: 16, borderRadius: 12,
            background: resultado.ok && resultado.tieneMembresia
              ? 'oklch(0.78 0.16 155 / .10)'
              : resultado.ok
                ? 'oklch(0.82 0.14 75 / .10)'
                : 'oklch(0.66 0.22 25 / .10)',
            border: `1px solid ${resultado.ok && resultado.tieneMembresia
              ? 'oklch(0.78 0.16 155 / .35)'
              : resultado.ok
                ? 'oklch(0.82 0.14 75 / .35)'
                : 'oklch(0.66 0.22 25 / .35)'}`,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            {resultado.ok && resultado.tieneMembresia
              ? <CheckCircle size={28} color="oklch(0.78 0.16 155)" />
              : resultado.ok
                ? <AlertCircle size={28} color="oklch(0.82 0.14 75)" />
                : <XCircle size={28} color="oklch(0.75 0.18 25)" />}
            <div>
              {resultado.ok
                ? <>
                    <strong style={{ color: 'var(--ink)' }}>{resultado.cliente.nombre} {resultado.cliente.apellido}</strong>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                      {resultado.tieneMembresia
                        ? `Plan: ${resultado.cliente.plan_nombre} · Visitas hoy: ${resultado.visitasHoy}`
                        : 'Sin membresía activa'}
                    </div>
                  </>
                : <strong style={{ color: 'oklch(0.75 0.18 25)' }}>{resultado.message}</strong>}
            </div>
          </div>
        )}
      </div>

      <div className="gym-card">
        <div style={{ padding: '14px 20px', borderBottom: '1px solid oklch(1 0 0 / .08)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Clock size={15} color="var(--dim)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
            Asistencias de hoy — {asistenciasHoy.length}
          </span>
        </div>
        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          {asistenciasHoy.length === 0
            ? <p style={{ padding: 28, textAlign: 'center', color: 'var(--dim)' }}>Sin registros hoy</p>
            : asistenciasHoy.map(a => (
              <div key={a.id} style={{
                padding: '10px 20px',
                borderBottom: '1px solid oklch(1 0 0 / .05)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{a.nombre} {a.apellido}</span>
                <span style={{ fontSize: 11, color: 'var(--dim)', fontFamily: 'monospace' }}>
                  {new Date(a.fecha_hora).toLocaleTimeString('es-BO')}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
