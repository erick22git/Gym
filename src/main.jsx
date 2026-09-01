import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App'
import GlassMenuFilters from './components/GlassMenuFilters'
import './index.css'
import './glass-engine/variables.css'
import './glass-engine/glass.css'
import './glass-engine/menu.css'
// responsive.css SIEMPRE al final — sus @media sobrescriben tokens/
// reglas de los archivos de arriba (--menu-height de variables.css,
// .app-layout de index.css, etc.) con la MISMA especificidad; si
// cargara antes, esas bases (sin @media, siempre activas) ganarían
// por orden de aparición pese a que el breakpoint sí matchea.
import './styles/responsive.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GlassMenuFilters />
    <App />
    <Toaster
      position="top-right"
      gutter={8}
      toastOptions={{
        duration: 3500,
        style: {
          background: 'oklch(0.18 0.015 250 / .96)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          color: 'oklch(0.92 0.01 250)',
          border: '1px solid oklch(1 0 0 / .12)',
          borderRadius: '10px',
          fontSize: '13px',
          fontFamily: 'Inter, system-ui, sans-serif',
          boxShadow: '0 8px 32px oklch(0 0 0 / .5)',
          padding: '10px 14px',
        },
        success: {
          style: {
            background: 'oklch(0.18 0.04 155 / .96)',
            border: '1px solid oklch(0.55 0.16 155 / .45)',
            color: 'oklch(0.92 0.01 250)',
          },
          iconTheme: { primary: 'oklch(0.72 0.18 155)', secondary: 'oklch(0.18 0.04 155)' },
        },
        error: {
          style: {
            background: 'oklch(0.22 0.06 25 / .96)',
            border: '1px solid oklch(0.55 0.18 25 / .5)',
            color: 'oklch(0.92 0.01 250)',
          },
          iconTheme: { primary: 'oklch(0.72 0.20 25)', secondary: 'oklch(0.22 0.06 25)' },
        },
      }}
    />
  </React.StrictMode>
)
