import { useMemo } from 'react'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function getColor(count) {
  if (!count) return 'oklch(0.18 0.01 250)'
  if (count === 1) return 'oklch(0.50 0.14 25 / .5)'
  if (count === 2) return 'oklch(0.58 0.18 25 / .7)'
  return 'oklch(0.66 0.22 25)'
}

export default function AttendanceHeatmap({ data = [], dias = 90 }) {
  const cells = useMemo(() => {
    const map = {}
    for (const row of data) map[row.fecha] = row.visitas

    const result = []
    const today = new Date()
    // Go back `dias` days
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      result.push({ date: key, count: map[key] || 0, dayOfWeek: d.getDay() })
    }
    return result
  }, [data, dias])

  // Group into weeks (columns)
  const weeks = useMemo(() => {
    const w = []
    let cur = []
    if (cells.length > 0) {
      // Pad start so first day is in the right column
      const firstDow = cells[0].dayOfWeek
      for (let i = 0; i < firstDow; i++) cur.push(null)
    }
    for (const cell of cells) {
      cur.push(cell)
      if (cell.dayOfWeek === 6) { w.push(cur); cur = [] }
    }
    if (cur.length > 0) {
      while (cur.length < 7) cur.push(null)
      w.push(cur)
    }
    return w
  }, [cells])

  const CELL = 13
  const GAP = 3

  return (
    <div>
      {/* Day labels */}
      <div style={{ display: 'flex', gap: GAP, marginBottom: GAP, paddingLeft: 0 }}>
        {DAYS.map(d => (
          <div key={d} style={{
            width: CELL, fontSize: 9, color: 'oklch(0.78 0.02 250 / .35)',
            textAlign: 'center', flexShrink: 0,
          }}>{d[0]}</div>
        ))}
      </div>

      {/* Grid: rows = days of week, columns = weeks */}
      <div style={{ display: 'flex', gap: GAP }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
            {week.map((cell, di) => (
              <div
                key={di}
                title={cell ? `${cell.date}: ${cell.count} visita${cell.count !== 1 ? 's' : ''}` : ''}
                style={{
                  width: CELL,
                  height: CELL,
                  borderRadius: 3,
                  background: cell ? getColor(cell.count) : 'oklch(0.18 0.01 250)',
                  opacity: cell === null ? 0 : 1,
                  transition: 'background 0.2s',
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Leyenda */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 10, color: 'oklch(0.78 0.02 250 / .4)' }}>Menos</span>
        {[0, 1, 2, 3].map(n => (
          <div key={n} style={{ width: CELL, height: CELL, borderRadius: 3, background: getColor(n) }} />
        ))}
        <span style={{ fontSize: 10, color: 'oklch(0.78 0.02 250 / .4)' }}>Más</span>
      </div>
    </div>
  )
}
