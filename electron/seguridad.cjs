// Sesión del usuario en el PROCESO PRINCIPAL (Sprint 4B · Fase 1).
// Se llena al iniciar sesión / verificar el token y se vacía al cerrar sesión. Las acciones sensibles
// (inventario, anular ventas…) se autorizan con ESTA sesión, nunca con el id de usuario que mande la pantalla.
let _sesion = null

function establecer(usuario) {
  _sesion = usuario ? {
    id: usuario.id,
    username: usuario.username || null,
    nombre: usuario.nombre_completo || usuario.username || null,
    rol_id: usuario.rol_id,
    permisos: new Set(usuario.permisos || []),
  } : null
}
function limpiar() { _sesion = null }
function usuario() { return _sesion ? { usuario_id: _sesion.id, usuario_nombre: _sesion.nombre } : { usuario_id: null, usuario_nombre: null } }
function tiene(codigo) { return !!_sesion && _sesion.permisos.has(codigo) }

// Devuelve null si está autorizado, o el objeto de error listo para devolver a la pantalla.
function exigir(codigo) {
  if (!_sesion) return { ok: false, sin_permiso: true, error: 'Tu sesión no está activa. Inicia sesión de nuevo.' }
  if (!_sesion.permisos.has(codigo)) return { ok: false, sin_permiso: true, permiso: codigo, error: 'No tienes permiso para realizar esta acción.' }
  return null
}

module.exports = { establecer, limpiar, usuario, tiene, exigir }
