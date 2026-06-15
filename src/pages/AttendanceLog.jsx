import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

const tbodyV = { hidden: {}, show: { transition: { staggerChildren: 0.025 } } }
const rowV   = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.18 } } }

export default function AttendanceLog() {
  const [asistencias, setAsistencias] = useState([])
  useEffect(() => { window.api.asistencias.getHoy().then(setAsistencias) }, [])

  return (
    <div>
      <h1 className="titulo-metalico mb-6">Registro de Asistencias</h1>
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="gym-card" style={{ overflow: 'hidden' }}
      >
        <table className="gym-table">
          <thead><tr><th>Fecha / Hora</th><th>Carnet</th><th>Nombre</th></tr></thead>
          <motion.tbody variants={tbodyV} initial="hidden" animate="show">
            {asistencias.map(a => (
              <motion.tr key={a.id} variants={rowV}>
                <td style={{ fontSize: 12 }}>{new Date(a.fecha_hora).toLocaleString('es-BO')}</td>
                <td style={{ fontFamily: 'monospace', color: 'var(--muted)' }}>{a.carnet}</td>
                <td style={{ color: 'var(--ink)' }}>{a.nombre} {a.apellido}</td>
              </motion.tr>
            ))}
            {asistencias.length === 0 && (
              <motion.tr initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
                <td colSpan={3} style={{ textAlign: 'center', padding: 48, color: 'var(--dim)' }}>Sin registros hoy</td>
              </motion.tr>
            )}
          </motion.tbody>
        </table>
      </motion.div>
    </div>
  )
}
