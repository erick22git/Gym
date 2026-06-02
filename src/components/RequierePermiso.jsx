import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { PAGES } from '../constants'
import toast from 'react-hot-toast'

/**
 * Guard de ruta — redirige a Dashboard si el usuario no tiene permiso.
 *
 * Uso:
 *   <RequierePermiso permiso="clientes.ver">
 *     <Clientes />
 *   </RequierePermiso>
 */
export default function RequierePermiso({ permiso, permisos, children }) {
  const { tienePermiso, tieneAlgunPermiso } = useAuth()
  const { navigate } = useApp()

  let tiene = false
  if (permiso) {
    tiene = tienePermiso(permiso)
  } else if (permisos && permisos.length > 0) {
    tiene = tieneAlgunPermiso(permisos)
  } else {
    tiene = true
  }

  useEffect(() => {
    if (!tiene) {
      toast.error('No tienes permiso para acceder a esta sección')
      navigate(PAGES.DASHBOARD)
    }
  }, [tiene, navigate])

  if (!tiene) return null
  return children
}
