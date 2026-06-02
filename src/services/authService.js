// Servicio de autenticación — wrapper sobre window.api.authUsuarios

const TOKEN_KEY = 'uf_auth_token'

export const authService = {
  async login(username, password) {
    return window.api.authUsuarios.login(username, password)
  },

  async logout(token) {
    return window.api.authUsuarios.logout(token)
  },

  async verificarToken(token) {
    return window.api.authUsuarios.verificarToken(token)
  },

  async cambiarPassword(id, passwordActual, nuevaPassword) {
    return window.api.authUsuarios.cambiarPassword(id, passwordActual, nuevaPassword)
  },

  async cambiarPasswordAdmin(id, nuevaPassword) {
    return window.api.authUsuarios.cambiarPasswordAdmin(id, nuevaPassword)
  },

  guardarToken(token) {
    localStorage.setItem(TOKEN_KEY, token)
  },

  obtenerToken() {
    return localStorage.getItem(TOKEN_KEY)
  },

  eliminarToken() {
    localStorage.removeItem(TOKEN_KEY)
  },
}
