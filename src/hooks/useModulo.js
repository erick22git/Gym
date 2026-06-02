import { useAuth } from '../context/AuthContext'

// Hook para verificar si un módulo está activo
export function useModulo(modulo) {
  const { esModuloActivo, modulosActivos } = useAuth()
  return {
    activo: esModuloActivo(modulo),
    modulosActivos,
  }
}
