// Servicio de auditoría — registra acciones del sistema

let _usuarioActual = null

export const auditoriaService = {
  setUsuario(usuario) {
    _usuarioActual = usuario
  },

  async log(accion, modulo, detalle = null, registroId = null, registroTipo = null) {
    try {
      await window.api.auditoria.log({
        usuario_id: _usuarioActual?.id || null,
        usuario_nombre: _usuarioActual?.nombre_completo || 'Sistema',
        accion,
        modulo,
        detalle,
        registro_afectado_id: registroId,
        registro_afectado_tipo: registroTipo,
        ip_local: null,
      })
    } catch (err) {
      console.warn('[Auditoría] Error al registrar:', err)
    }
  },

  async getAll(filtros = {}) {
    return window.api.auditoria.getAll(filtros)
  },
}

// Constantes de acciones de auditoría
export const ACCIONES = {
  LOGIN_EXITOSO: 'LOGIN_EXITOSO',
  LOGIN_FALLIDO: 'LOGIN_FALLIDO',
  LOGOUT: 'LOGOUT',
  USUARIO_CREADO: 'USUARIO_CREADO',
  USUARIO_EDITADO: 'USUARIO_EDITADO',
  USUARIO_ELIMINADO: 'USUARIO_ELIMINADO',
  USUARIO_ACTIVADO: 'USUARIO_ACTIVADO',
  USUARIO_DESACTIVADO: 'USUARIO_DESACTIVADO',
  PASSWORD_CAMBIADO: 'PASSWORD_CAMBIADO',
  USUARIO_REGISTRADO: 'USUARIO_REGISTRADO',
  CAMBIO_CONTRASENA_RECUPERACION: 'CAMBIO_CONTRASENA_RECUPERACION',
  ROL_CREADO: 'ROL_CREADO',
  ROL_EDITADO: 'ROL_EDITADO',
  ROL_ELIMINADO: 'ROL_ELIMINADO',
  PERMISOS_MODIFICADOS: 'PERMISOS_MODIFICADOS',
  MODULO_ACTIVADO: 'MODULO_ACTIVADO',
  MODULO_DESACTIVADO: 'MODULO_DESACTIVADO',
  RESPALDO_CREADO: 'RESPALDO_CREADO',
  DATOS_PRUEBA_GENERADOS: 'DATOS_PRUEBA_GENERADOS',
  DATOS_PRUEBA_ELIMINADOS: 'DATOS_PRUEBA_ELIMINADOS',
  SISTEMA_RESETEADO: 'SISTEMA_RESETEADO',
}
