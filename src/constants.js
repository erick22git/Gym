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
}

// Páginas que requieren autenticación de administrador (sistema legacy)
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
