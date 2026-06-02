import { useAuth } from '../context/AuthContext'

/**
 * Renderiza hijos solo si el usuario tiene el/los permiso(s) requerido(s).
 *
 * Uso:
 *   <Protected permiso="clientes.crear">
 *     <button>Nuevo Cliente</button>
 *   </Protected>
 *
 *   <Protected permisos={['inventario.ver', 'ventas.ver']}>
 *     ...
 *   </Protected>
 *
 * Props:
 *   permiso      — string, un solo permiso
 *   permisos     — string[], requiere al menos uno
 *   showMessage  — si true, muestra mensaje en lugar de nada
 *   fallback     — nodo alternativo si no tiene permiso
 */
export default function Protected({ permiso, permisos, showMessage = false, fallback = null, children }) {
  const { tienePermiso, tieneAlgunPermiso } = useAuth()

  let tiene = false
  if (permiso) {
    tiene = tienePermiso(permiso)
  } else if (permisos && permisos.length > 0) {
    tiene = tieneAlgunPermiso(permisos)
  } else {
    tiene = true
  }

  if (tiene) return children

  if (showMessage) {
    return (
      <div style={{
        padding: '12px 16px',
        borderRadius: 8,
        background: 'oklch(0.66 0.22 25 / .08)',
        border: '1px solid oklch(0.66 0.22 25 / .2)',
        color: 'oklch(0.78 0.02 250 / .6)',
        fontSize: 13,
      }}>
        No tienes permiso para esta acción
      </div>
    )
  }

  return fallback
}
