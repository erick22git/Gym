export const PAGES = {
  ATTENDANCE: 'Attendance',
  CONTROL_ACCESO: 'ControlAcceso',
  CLIENTS: 'Clients',
  MEMBERSHIPS: 'Memberships',
  DASHBOARD: 'Dashboard',
  ATTENDANCE_LOG: 'AttendanceLog',
  ALERTS: 'Alerts',
  INCOME: 'Income',
  SETTINGS: 'Settings',
  // Facturación SFE
  FACTURACION_EMITIR: 'FacturacionEmitir',
  FACTURACION_HISTORIAL: 'FacturacionHistorial',
  FACTURACION_CONFIG: 'FacturacionConfig',
  // Nuevos módulos
  CAJA: 'Caja',
  INVENTARIO: 'Inventario',
  VENTAS: 'Ventas',
  REPORTES: 'Reportes',
  PAPELERA: 'Papelera',
  AUDITORIA: 'Auditoria',
  // Nuevas páginas FASE 5
  GESTION_MODULOS: 'GestionModulos',
  RESPALDOS: 'Respaldos',
  // Administración de sistema
  GESTION_USUARIOS: 'GestionUsuarios',
  // Perfil de cliente
  PERFIL_CLIENTE: 'PerfilCliente',
  // POS / Admin
  GESTION_PLANES: 'GestionPlanes',
  CONFIG_POS: 'ConfiguracionPOS',
  DESCUENTOS: 'Descuentos',
  // Configuración hub
  CONFIGURACION: 'Configuracion',
  // Casilleros
  CASILLEROS: 'Casilleros',
  // IA / Importar datos — asistente que lee documentos/fotos de
  // inventario y los carga al sistema (HOY 100% mock, ver ImportarIA.jsx)
  IA_IMPORTAR: 'IAImportar',
}

// ─── SISTEMA LEGACY: modal de contraseña admin ────────────────────────────────
// ADMIN_PAGES controla el modal de PIN de administrador (AppContext → unlockAdmin).
// Solo las páginas de esta lista disparan ese modal cuando !isAdmin.
//
// Las demás páginas admin (Caja, Inventario, Ventas, Reportes, Auditoria,
// Papelera, Respaldos, Configuracion, GestionPlanes, ConfiguracionPOS,
// Descuentos, GestionModulos, PerfilCliente) NO están aquí porque usan el
// sistema de login de usuarios con permisos por rol (auth:login / sesiones /
// roles / permisos en DB). Son accesibles para cualquier usuario logueado
// con el rol/permiso correspondiente, independientemente del modal admin.
//
// NO mezclar ambos sistemas: agregar una página aquí NO la protege con roles,
// y quitarla de aquí NO la hace pública si el usuario no tiene sesión activa.
// ──────────────────────────────────────────────────────────────────────────────
export const ADMIN_PAGES = [
  PAGES.CLIENTS,
  PAGES.MEMBERSHIPS,
  PAGES.ATTENDANCE_LOG,
  PAGES.ALERTS,
  PAGES.INCOME,
  PAGES.SETTINGS,
  PAGES.FACTURACION_EMITIR,
  PAGES.FACTURACION_HISTORIAL,
  PAGES.FACTURACION_CONFIG,
  PAGES.GESTION_USUARIOS,
]
