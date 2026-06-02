import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authService } from '../services/authService'
import { auditoriaService, ACCIONES } from '../services/auditoriaService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [permisos, setPermisos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modulosActivos, setModulosActivos] = useState({})

  // Cargar estado de módulos
  const cargarModulos = useCallback(async () => {
    try {
      const lista = await window.api.modulos.getAll()
      const mapa = {}
      for (const m of lista) mapa[m.modulo] = m.activo === 1
      setModulosActivos(mapa)
    } catch (_) {}
  }, [])

  // Verificar sesión al iniciar
  useEffect(() => {
    const verificar = async () => {
      const token = authService.obtenerToken()
      if (token) {
        const u = await authService.verificarToken(token)
        if (u) {
          setUsuario(u)
          setPermisos(u.permisos || [])
          auditoriaService.setUsuario(u)
        } else {
          authService.eliminarToken()
        }
      }
      await cargarModulos()
      setCargando(false)
    }
    verificar()
  }, [cargarModulos])

  const login = useCallback(async (username, password) => {
    const resultado = await authService.login(username, password)
    if (resultado.ok) {
      authService.guardarToken(resultado.token)
      setUsuario(resultado.usuario)
      setPermisos(resultado.usuario.permisos || [])
      auditoriaService.setUsuario(resultado.usuario)
      await auditoriaService.log(ACCIONES.LOGIN_EXITOSO, 'auth', `Usuario ${username} inició sesión`)
      await cargarModulos()
    } else {
      await auditoriaService.log(ACCIONES.LOGIN_FALLIDO, 'auth', `Intento fallido para usuario: ${username}`)
    }
    return resultado
  }, [cargarModulos])

  const logout = useCallback(async () => {
    const token = authService.obtenerToken()
    if (token) {
      await auditoriaService.log(ACCIONES.LOGOUT, 'auth', `Usuario ${usuario?.username} cerró sesión`)
      await authService.logout(token)
      authService.eliminarToken()
    }
    auditoriaService.setUsuario(null)
    setUsuario(null)
    setPermisos([])
  }, [usuario])

  const tienePermiso = useCallback((codigo) => {
    if (!usuario) return false
    return permisos.includes(codigo)
  }, [permisos, usuario])

  const tieneAlgunPermiso = useCallback((codigos) => {
    if (!usuario) return false
    return codigos.some(c => permisos.includes(c))
  }, [permisos, usuario])

  const cambiarPassword = useCallback(async (passwordActual, nuevaPassword) => {
    if (!usuario) return { ok: false, error: 'No hay sesión activa' }
    const resultado = await authService.cambiarPassword(usuario.id, passwordActual, nuevaPassword)
    if (resultado.ok) {
      await auditoriaService.log(ACCIONES.PASSWORD_CAMBIADO, 'auth', 'Contraseña actualizada')
      setUsuario(u => u ? { ...u, primer_login: false } : u)
    }
    return resultado
  }, [usuario])

  const marcarPasswordCambiado = useCallback(() => {
    setUsuario(u => u ? { ...u, primer_login: false } : u)
  }, [])

  const actualizarModulos = useCallback(async () => {
    await cargarModulos()
  }, [cargarModulos])

  const esModuloActivo = useCallback((modulo) => {
    return modulosActivos[modulo] === true
  }, [modulosActivos])

  return (
    <AuthContext.Provider value={{
      usuario,
      permisos,
      cargando,
      modulosActivos,
      login,
      logout,
      tienePermiso,
      tieneAlgunPermiso,
      cambiarPassword,
      marcarPasswordCambiado,
      esModuloActivo,
      actualizarModulos,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
