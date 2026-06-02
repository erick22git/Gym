import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: 320, padding: 40, gap: 16, textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'oklch(0.66 0.22 25 / .12)', border: '1px solid oklch(0.66 0.22 25 / .3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <AlertTriangle size={24} color="oklch(0.75 0.18 25)" />
        </div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
            Ocurrió un error al cargar esta sección
          </p>
          <p style={{ fontSize: 12, color: 'var(--dim)', maxWidth: 320 }}>
            {this.state.error?.message || 'Error desconocido'}
          </p>
        </div>
        <button
          onClick={() => this.setState({ hasError: false, error: null })}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 18px', borderRadius: 9, fontSize: 13, fontWeight: 600,
            background: 'oklch(0.66 0.22 25 / .15)', border: '1px solid oklch(0.66 0.22 25 / .4)',
            color: 'oklch(0.85 0.12 25)', cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} /> Recargar sección
        </button>
      </div>
    )
  }
}
