import { useState, useEffect } from 'react'

export default function AttendanceLog() {
  const [asistencias, setAsistencias] = useState([])
  useEffect(() => { window.api.asistencias.getHoy().then(setAsistencias) }, [])

  return (
    <div>
      <h1 className="titulo-metalico mb-6">Registro de Asistencias</h1>
      <div className="gym-card" style={{ overflow: 'hidden' }}>
        <table className="gym-table">
          <thead><tr><th>Fecha / Hora</th><th>Carnet</th><th>Nombre</th></tr></thead>
          <tbody>
            {asistencias.map(a => (
              <tr key={a.id}>
                <td style={{ fontSize: 12 }}>{new Date(a.fecha_hora).toLocaleString('es-BO')}</td>
                <td style={{ fontFamily: 'monospace', color: 'var(--muted)' }}>{a.carnet}</td>
                <td style={{ color: 'var(--ink)' }}>{a.nombre} {a.apellido}</td>
              </tr>
            ))}
            {asistencias.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: 'center', padding: 48, color: 'var(--dim)' }}>Sin registros hoy</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
