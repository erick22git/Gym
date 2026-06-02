import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        style: { background: '#111', color: '#e5e5e5', border: '1px solid #333' },
        success: { iconTheme: { primary: '#22c55e', secondary: '#111' } },
        error: { iconTheme: { primary: '#e63946', secondary: '#111' } },
      }}
    />
  </React.StrictMode>
)
