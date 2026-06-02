import { useAuth } from '../context/AuthContext'

// Hook para verificar un permiso específico
export function usePermiso(codigo) {
  const { tienePermiso } = useAuth()
  return tienePermiso(codigo)
}

// Hook para verificar si tiene al menos uno de varios permisos
export function useAlgunPermiso(codigos) {
  const { tieneAlgunPermiso } = useAuth()
  return tieneAlgunPermiso(codigos)
}
