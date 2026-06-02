import { useState, useEffect } from 'react'
import { DollarSign, Receipt } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { PAGES } from '../constants'

export default function Income() {
  const { navigate } = useApp()
  const [pagos, setPagos] = useState([])

  useEffect(() => { window.api.pagos.getAll().then(setPagos) }, [])

  const total = pagos.reduce((s, p) => s + (p.monto || 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="titulo-metalico">Ingresos</h1>
        <button className="btn-primary" onClick={() => navigate(PAGES.FACTURACION_EMITIR)}>
          <Receipt size={14} style={{ display: 'inline', marginRight: 6 }} />Emitir Factura
        </button>
      </div>

      <div className="gym-card p-5 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="gym-label">Total Registrado</div>
            <div className="titulo-metalico" style={{ fontSize: 34 }}>
              Bs. {total.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div style={{ background: 'oklch(0.82 0.14 75 / .14)', border: '1px solid oklch(0.82 0.14 75 / .35)', borderRadius: 14, padding: 14 }}>
            <DollarSign size={28} color="oklch(0.82 0.14 75)" />
          </div>
        </div>
      </div>

      <div className="gym-card" style={{ overflow: 'hidden' }}>
        <table className="gym-table">
          <thead>
            <tr><th>Fecha</th><th>Cliente</th><th>Concepto</th><th>Método</th><th>Monto</th><th>Factura</th></tr>
          </thead>
          <tbody>
            {pagos.map(p => (
              <tr key={p.id}>
                <td style={{ fontSize: 12 }}>{new Date(p.fecha).toLocaleDateString('es-BO')}</td>
                <td style={{ color: 'var(--ink)' }}>{p.nombre} {p.apellido}</td>
                <td>{p.concepto || '—'}</td>
                <td><span className="badge badge-gray">{p.metodo}</span></td>
                <td style={{ color: 'var(--ink)', fontWeight: 600 }}>Bs. {parseFloat(p.monto).toFixed(2)}</td>
                <td>
                  <button className="btn-ghost btn-sm" onClick={() => navigate(PAGES.FACTURACION_EMITIR)} title="Emitir factura">
                    <Receipt size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {pagos.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 48, color: 'var(--dim)' }}>Sin registros de ingresos</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
