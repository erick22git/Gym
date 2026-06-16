const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // Clientes
  clientes: {
    getAll: () => ipcRenderer.invoke('clientes:getAll'),
    getPaginated: (filtros) => ipcRenderer.invoke('clientes:getPaginated', filtros),
    getById: (id) => ipcRenderer.invoke('clientes:getById', id),
    getByCarnet: (carnet) => ipcRenderer.invoke('clientes:getByCarnet', carnet),
    search: (query) => ipcRenderer.invoke('clientes:search', query),
    create: (data) => ipcRenderer.invoke('clientes:create', data),
    update: (id, data) => ipcRenderer.invoke('clientes:update', id, data),
    delete: (id) => ipcRenderer.invoke('clientes:delete', id),
    createCompleto: (data) => ipcRenderer.invoke('clientes:createCompleto', data),
    checkCarnetExiste: (carnet, excludeId) => ipcRenderer.invoke('clientes:checkCarnetExiste', carnet, excludeId),
    buscarPOS: (query) => ipcRenderer.invoke('clientes:buscarPOS', query),
    buscarPOSById: (id) => ipcRenderer.invoke('clientes:buscarPOSById', id),
    getFacturadorHabitual: (clienteId) => ipcRenderer.invoke('clientes:getFacturadorHabitual', clienteId),
    setFacturadorHabitual: (clienteId, data) => ipcRenderer.invoke('clientes:setFacturadorHabitual', clienteId, data),
  },

  // Planes
  planes: {
    getAll: () => ipcRenderer.invoke('planes:getAll'),
    getActive: () => ipcRenderer.invoke('planes:getActive'),
    getWithClientCount: () => ipcRenderer.invoke('planes:getWithClientCount'),
    create: (data) => ipcRenderer.invoke('planes:create', data),
    update: (id, data) => ipcRenderer.invoke('planes:update', id, data),
    delete: (id) => ipcRenderer.invoke('planes:delete', id),
  },

  // Membresias
  membresias: {
    getByCliente: (clienteId) => ipcRenderer.invoke('membresias:getByCliente', clienteId),
    getActiva: (clienteId) => ipcRenderer.invoke('membresias:getActiva', clienteId),
    create: (data) => ipcRenderer.invoke('membresias:create', data),
    renovar: (id, data) => ipcRenderer.invoke('membresias:renovar', id, data),
    getVencidas: () => ipcRenderer.invoke('membresias:getVencidas'),
    getPorVencer: () => ipcRenderer.invoke('membresias:getPorVencer'),
  },

  // Asistencias
  asistencias: {
    registrar: (carnet) => ipcRenderer.invoke('asistencias:registrar', carnet),
    registrarById: (clienteId) => ipcRenderer.invoke('asistencias:registrarById', clienteId),
    getByCliente: (clienteId) => ipcRenderer.invoke('asistencias:getByCliente', clienteId),
    getHoy: () => ipcRenderer.invoke('asistencias:getHoy'),
  },

  // Pagos
  pagos: {
    getByCliente: (clienteId) => ipcRenderer.invoke('pagos:getByCliente', clienteId),
    getAll: () => ipcRenderer.invoke('pagos:getAll'),
    create: (data) => ipcRenderer.invoke('pagos:create', data),
  },

  // Dashboard
  dashboard: {
    stats: () => ipcRenderer.invoke('dashboard:stats'),
    ingresosMes: () => ipcRenderer.invoke('dashboard:ingresosMes'),
  },

  // Auth (legacy)
  auth: {
    checkAdmin: (password) => ipcRenderer.invoke('auth:checkAdmin', password),
    setAdmin: (password) => ipcRenderer.invoke('auth:setAdmin', password),
  },

  // Auth nuevo (sistema de usuarios)
  authUsuarios: {
    login: (username, password) => ipcRenderer.invoke('auth:login', username, password),
    logout: (token) => ipcRenderer.invoke('auth:logout', token),
    verificarToken: (token) => ipcRenderer.invoke('auth:verificarToken', token),
    cambiarPassword: (id, passwordActual, nuevaPassword) => ipcRenderer.invoke('auth:cambiarPassword', id, passwordActual, nuevaPassword),
    cambiarPasswordAdmin: (id, nuevaPassword) => ipcRenderer.invoke('auth:cambiarPasswordAdmin', id, nuevaPassword),
  },

  // Usuarios
  usuarios: {
    getAll: () => ipcRenderer.invoke('usuarios:getAll'),
    getById: (id) => ipcRenderer.invoke('usuarios:getById', id),
    create: (data) => ipcRenderer.invoke('usuarios:create', data),
    update: (id, data) => ipcRenderer.invoke('usuarios:update', id, data),
    setActivo: (id, activo) => ipcRenderer.invoke('usuarios:setActivo', id, activo),
    delete: (id) => ipcRenderer.invoke('usuarios:delete', id),
    registrar: (data) => ipcRenderer.invoke('usuarios:registrar', data),
    cambiarPasswordPorCarnet: (carnet, pass) => ipcRenderer.invoke('usuarios:cambiarPasswordPorCarnet', carnet, pass),
  },

  // Roles
  roles: {
    getAll: () => ipcRenderer.invoke('roles:getAll'),
    create: (data) => ipcRenderer.invoke('roles:create', data),
    update: (id, data) => ipcRenderer.invoke('roles:update', id, data),
    delete: (id) => ipcRenderer.invoke('roles:delete', id),
    getPermisos: (rolId) => ipcRenderer.invoke('roles:getPermisos', rolId),
    setPermisos: (rolId, permisoIds) => ipcRenderer.invoke('roles:setPermisos', rolId, permisoIds),
  },

  // Permisos
  permisos: {
    getAll: () => ipcRenderer.invoke('permisos:getAll'),
  },

  // Auditoría
  auditoria: {
    log: (data) => ipcRenderer.invoke('auditoria:log', data),
    getAll: (filtros) => ipcRenderer.invoke('auditoria:getAll', filtros),
    getPaginated: (filtros) => ipcRenderer.invoke('auditoria:getPaginated', filtros),
  },

  // Módulos
  modulos: {
    getAll: () => ipcRenderer.invoke('modulos:getAll'),
    setActivo: (modulo, activo, usuarioId) => ipcRenderer.invoke('modulos:setActivo', modulo, activo, usuarioId),
  },

  // clientesExtra — perfil completo y campos extendidos
  clientesExtra: {
    getPerfilCompleto: (id) => ipcRenderer.invoke('clientesExtra:getPerfilCompleto', id),
    getHeatmap: (clienteId, dias) => ipcRenderer.invoke('clientesExtra:getHeatmap', clienteId, dias),
    getStats: (clienteId) => ipcRenderer.invoke('clientesExtra:getStats', clienteId),
    updateExtra: (id, data) => ipcRenderer.invoke('clientesExtra:updateExtra', id, data),
    getAsistenciasPorMes: (clienteId) => ipcRenderer.invoke('clientesExtra:getAsistenciasPorMes', clienteId),
    getAsistenciasRecientes: (clienteId, n) => ipcRenderer.invoke('clientesExtra:getAsistenciasRecientes', clienteId, n),
  },

  // Notas de clientes
  notasCliente: {
    getByCliente: (clienteId) => ipcRenderer.invoke('notasCliente:getByCliente', clienteId),
    create: (data) => ipcRenderer.invoke('notasCliente:create', data),
    delete: (id) => ipcRenderer.invoke('notasCliente:delete', id),
  },

  // Dashboard 2
  dashboard2: {
    distribucionPlanes: () => ipcRenderer.invoke('dashboard2:distribucionPlanes'),
    asistenciasPorHora: () => ipcRenderer.invoke('dashboard2:asistenciasPorHora'),
    asistenciasHoyRecientes: (n) => ipcRenderer.invoke('dashboard2:asistenciasHoyRecientes', n),
    cumpleanosProximos: (dias) => ipcRenderer.invoke('dashboard2:cumpleanosProximos', dias),
    clientesInactivos: (dias) => ipcRenderer.invoke('dashboard2:clientesInactivos', dias),
    topClientes: (n) => ipcRenderer.invoke('dashboard2:topClientes', n),
    ingresosPorRango: (inicio, fin) => ipcRenderer.invoke('dashboard2:ingresosPorRango', inicio, fin),
    resumenRapido: () => ipcRenderer.invoke('dashboard2:resumenRapido'),
  },

  // Ventas (POS)
  ventas: {
    procesarPagoMembresia: (data) => ipcRenderer.invoke('ventas:procesarPagoMembresia', data),
    getByCliente: (clienteId) => ipcRenderer.invoke('ventas:getByCliente', clienteId),
    getAll: (filtros) => ipcRenderer.invoke('ventas:getAll', filtros),
    getPaginated: (filtros) => ipcRenderer.invoke('ventas:getPaginated', filtros),
    getById: (id) => ipcRenderer.invoke('ventas:getById', id),
    getKPIs: (filtros) => ipcRenderer.invoke('ventas:getKPIs', filtros),
    anular: (id) => ipcRenderer.invoke('ventas:anular', id),
    getBySesion: (sesionId) => ipcRenderer.invoke('ventas:getBySesion', sesionId),
  },

  // Membresía miembros (grupales/familiares)
  membresiaMiembros: {
    getMiembros: (membresiaId) => ipcRenderer.invoke('membresiaMiembros:getMiembros', membresiaId),
    addMiembro: (membresiaId, clienteId, esTitular) => ipcRenderer.invoke('membresiaMiembros:addMiembro', membresiaId, clienteId, esTitular),
    removeMiembro: (membresiaId, clienteId) => ipcRenderer.invoke('membresiaMiembros:removeMiembro', membresiaId, clienteId),
    getMembresiaDeCliente: (clienteId) => ipcRenderer.invoke('membresiaMiembros:getMembresiaDeCliente', clienteId),
    sincronizarTitular: (membresiaId, clienteId) => ipcRenderer.invoke('membresiaMiembros:sincronizarTitular', membresiaId, clienteId),
  },

  // Descuentos
  descuentos: {
    getAll: () => ipcRenderer.invoke('descuentos:getAll'),
    getActive: () => ipcRenderer.invoke('descuentos:getActive'),
    create: (data) => ipcRenderer.invoke('descuentos:create', data),
    update: (id, data) => ipcRenderer.invoke('descuentos:update', id, data),
    delete: (id) => ipcRenderer.invoke('descuentos:delete', id),
  },

  // Configuración POS
  pos: {
    getConfig: () => ipcRenderer.invoke('pos:getConfig'),
    saveConfig: (data) => ipcRenderer.invoke('pos:saveConfig', data),
    getPrinters: () => ipcRenderer.invoke('pos:getPrinters'),
    testPrint: (printerName) => ipcRenderer.invoke('pos:testPrint', printerName),
  },

  // Inventario
  inventario: {
    getCategorias: () => ipcRenderer.invoke('inventario:getCategorias'),
    createCategoria: (data) => ipcRenderer.invoke('inventario:createCategoria', data),
    updateCategoria: (id, data) => ipcRenderer.invoke('inventario:updateCategoria', id, data),
    deleteCategoria: (id) => ipcRenderer.invoke('inventario:deleteCategoria', id),
    getProveedores: () => ipcRenderer.invoke('inventario:getProveedores'),
    createProveedor: (data) => ipcRenderer.invoke('inventario:createProveedor', data),
    updateProveedor: (id, data) => ipcRenderer.invoke('inventario:updateProveedor', id, data),
    deleteProveedor: (id) => ipcRenderer.invoke('inventario:deleteProveedor', id),
    getAll: (filtros) => ipcRenderer.invoke('inventario:getAll', filtros),
    getPaginated: (filtros) => ipcRenderer.invoke('inventario:getPaginated', filtros),
    getAllMovimientosPaginated: (filtros) => ipcRenderer.invoke('inventario:getAllMovimientosPaginated', filtros),
    getById: (id) => ipcRenderer.invoke('inventario:getById', id),
    create: (data) => ipcRenderer.invoke('inventario:create', data),
    update: (id, data) => ipcRenderer.invoke('inventario:update', id, data),
    delete: (id) => ipcRenderer.invoke('inventario:delete', id),
    getStockBajo: () => ipcRenderer.invoke('inventario:getStockBajo'),
    buscarPOS: (query) => ipcRenderer.invoke('inventario:buscarPOS', query),
    ajustarStock: (data) => ipcRenderer.invoke('inventario:ajustarStock', data),
    getMovimientos: (productoId) => ipcRenderer.invoke('inventario:getMovimientos', productoId),
    getAllMovimientos: () => ipcRenderer.invoke('inventario:getAllMovimientos'),
    venderProductos: (items, meta) => ipcRenderer.invoke('inventario:venderProductos', items, meta),
    pickImage: () => ipcRenderer.invoke('inventario:pickImage'),
  },

  // Caja diaria
  caja: {
    getSesionActual: () => ipcRenderer.invoke('caja:getSesionActual'),
    isAbierta: () => ipcRenderer.invoke('caja:isAbierta'),
    abrir: (data) => ipcRenderer.invoke('caja:abrir', data),
    cerrar: (data) => ipcRenderer.invoke('caja:cerrar', data),
    addMovimiento: (data) => ipcRenderer.invoke('caja:addMovimiento', data),
    getMovimientos: (sesionId) => ipcRenderer.invoke('caja:getMovimientos', sesionId),
    getResumen: (sesionId) => ipcRenderer.invoke('caja:getResumen', sesionId),
    getHistorial: (limit) => ipcRenderer.invoke('caja:getHistorial', limit),
    getHistorialPaginated: (filtros) => ipcRenderer.invoke('caja:getHistorialPaginated', filtros),
    getSesionById: (id) => ipcRenderer.invoke('caja:getSesionById', id),
    addNota: (data) => ipcRenderer.invoke('caja:addNota', data),
    getNotas: (sesionId) => ipcRenderer.invoke('caja:getNotas', sesionId),
  },

  // Papelera
  papelera: {
    getResumen: () => ipcRenderer.invoke('papelera:getResumen'),
    getClientes: () => ipcRenderer.invoke('papelera:getClientes'),
    getPlanes: () => ipcRenderer.invoke('papelera:getPlanes'),
    getProductos: () => ipcRenderer.invoke('papelera:getProductos'),
    restaurarCliente: (id) => ipcRenderer.invoke('papelera:restaurarCliente', id),
    restaurarPlan: (id) => ipcRenderer.invoke('papelera:restaurarPlan', id),
    restaurarProducto: (id) => ipcRenderer.invoke('papelera:restaurarProducto', id),
    eliminarPermanenteCliente: (id) => ipcRenderer.invoke('papelera:eliminarPermanenteCliente', id),
    eliminarPermanentePlan: (id) => ipcRenderer.invoke('papelera:eliminarPermanentePlan', id),
    eliminarPermanenteProducto: (id) => ipcRenderer.invoke('papelera:eliminarPermanenteProducto', id),
  },

  // Respaldos
  respaldos: {
    listar: () => ipcRenderer.invoke('respaldos:listar'),
    info: () => ipcRenderer.invoke('respaldos:info'),
    exportar: () => ipcRenderer.invoke('respaldos:exportar'),
    seleccionarArchivo: () => ipcRenderer.invoke('respaldos:seleccionarArchivo'),
    restaurar: (ruta) => ipcRenderer.invoke('respaldos:restaurar', ruta),
    mantenimiento: () => ipcRenderer.invoke('db:mantenimiento'),
    listarAuto: () => ipcRenderer.invoke('respaldos:listarAuto'),
  },

  // Datos de Prueba
  datosPrueba: {
    contar: () => ipcRenderer.invoke('datosPrueba:contar'),
    generar: () => ipcRenderer.invoke('datosPrueba:generar'),
    eliminar: () => ipcRenderer.invoke('datosPrueba:eliminar'),
    resetear: () => ipcRenderer.invoke('datosPrueba:resetear'),
  },

  // App control
  app: {
    reiniciar: () => ipcRenderer.invoke('app:reiniciar'),
  },

  // File dialog
  openImage: () => ipcRenderer.invoke('dialog:openImage'),

  // ─── Facturación Electrónica SFE Bolivia ────────────────────────────────
  facturacion: {
    // Configuración de empresa
    getEmpresa: () => ipcRenderer.invoke('facturacion:getEmpresa'),
    saveEmpresa: (data) => ipcRenderer.invoke('facturacion:saveEmpresa', data),
    // Credenciales SFE
    getCredenciales: () => ipcRenderer.invoke('facturacion:getCredenciales'),
    saveCredenciales: (data) => ipcRenderer.invoke('facturacion:saveCredenciales', data),
    // Certificado digital
    cargarCertificado: () => ipcRenderer.invoke('facturacion:cargarCertificado'),
    validarCertificado: (args) => ipcRenderer.invoke('facturacion:validarCertificado', args),
    getCertificado: () => ipcRenderer.invoke('facturacion:getCertificado'),
    // Correo electrónico
    getConfigCorreo: () => ipcRenderer.invoke('facturacion:getConfigCorreo'),
    saveConfigCorreo: (data) => ipcRenderer.invoke('facturacion:saveConfigCorreo', data),
    enviarCorreoPrueba: () => ipcRenderer.invoke('facturacion:enviarCorreoPrueba'),
    // Operaciones SFE
    verificarComunicacion: () => ipcRenderer.invoke('facturacion:verificarComunicacion'),
    verificarToken: () => ipcRenderer.invoke('facturacion:verificarToken'),
    obtenerCUIS: () => ipcRenderer.invoke('facturacion:obtenerCUIS'),
    obtenerCUFD: () => ipcRenderer.invoke('facturacion:obtenerCUFD'),
    sincronizarFechaHora: () => ipcRenderer.invoke('facturacion:sincronizarFechaHora'),
    sincronizarParametricas: () => ipcRenderer.invoke('facturacion:sincronizarParametricas'),
    // Factura
    emitirFactura: (datos) => ipcRenderer.invoke('facturacion:emitirFactura', datos),
    emitirFacturaPrueba: () => ipcRenderer.invoke('facturacion:emitirFacturaPrueba'),
    anularFactura: (id, motivo) => ipcRenderer.invoke('facturacion:anularFactura', id, motivo),
    anularFacturaPrueba: (cuf) => ipcRenderer.invoke('facturacion:anularFacturaPrueba', cuf),
    verificarEstadoFactura: (cuf) => ipcRenderer.invoke('facturacion:verificarEstadoFactura', cuf),
    sincronizarPendientes: () => ipcRenderer.invoke('facturacion:sincronizarPendientes'),
    // Historial
    getFacturas: (filtros) => ipcRenderer.invoke('facturacion:getFacturas', filtros),
    getFacturaById: (id) => ipcRenderer.invoke('facturacion:getFacturaById', id),
    getStats: () => ipcRenderer.invoke('facturacion:getStats'),
    descargarPDF: (id) => ipcRenderer.invoke('facturacion:descargarPDF', id),
    reenviarCorreo: (id, email) => ipcRenderer.invoke('facturacion:reenviarCorreo', id, email),
    isConfigurado: () => ipcRenderer.invoke('facturacion:isConfigurado'),
    precargarSimulacion: () => ipcRenderer.invoke('facturacion:precargarSimulacion'),
    getQRBase64: (url) => ipcRenderer.invoke('facturacion:getQRBase64', url),
    guardarPDF: (id) => ipcRenderer.invoke('facturacion:guardarPDF', id),
  },

  // ─── Recibos ─────────────────────────────────────────────────────────────
  recibos: {
    getConfig: () => ipcRenderer.invoke('recibos:getConfig'),
    saveConfig: (data) => ipcRenderer.invoke('recibos:saveConfig', data),
    generarPDF: (data) => ipcRenderer.invoke('recibos:generarPDF', data),
    guardarPDF: (data) => ipcRenderer.invoke('recibos:guardarPDF', data),
    guardar: (data) => ipcRenderer.invoke('recibos:guardar', data),
    getByCliente: (clienteId, page, pageSize) => ipcRenderer.invoke('recibos:getByCliente', clienteId, page, pageSize),
    getById: (id) => ipcRenderer.invoke('recibos:getById', id),
  },

  // ─── Promociones ─────────────────────────────────────────────────────────
  promociones: {
    getAll:    () => ipcRenderer.invoke('promociones:getAll'),
    getActive: () => ipcRenderer.invoke('promociones:getActive'),
    create:    (data) => ipcRenderer.invoke('promociones:create', data),
    update:    (id, data) => ipcRenderer.invoke('promociones:update', id, data),
    delete:    (id) => ipcRenderer.invoke('promociones:delete', id),
    setActivo:    (id, activo) => ipcRenderer.invoke('promociones:setActivo', id, activo),
    getProductos: (id) => ipcRenderer.invoke('promociones:getProductos', id),
  },
})
