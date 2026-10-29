// Configuración → Accesibilidad. Los ajustes son del dispositivo (valen también antes de iniciar sesión).
import { SelectorTamano } from '../../components/accesibilidad/SelectorTamano'

export default function ConfigAccesibilidad() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>
      <section aria-labelledby="acc-tamano">
        <h3 id="acc-tamano" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Tamaño de la interfaz</h3>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
          Agranda todo el sistema (menús, tablas, chat y mascota). Vale para esta PC, también en la pantalla de inicio de sesión.
          Atajos: Ctrl + = más grande, Ctrl + − más pequeño, Ctrl + 0 vuelve a 100 %.
        </p>
        <SelectorTamano etiquetadoPor="acc-tamano" />
      </section>
    </div>
  )
}
