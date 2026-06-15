const { app, BrowserWindow, ipcMain, dialog, session, shell, Menu } = require('electron')
const { initFacturacion, registrarHandlers: registrarHandlersFacturacion } = require('./facturacion/handlers.cjs')
const path = require('path')
const fs = require('fs')
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#0a0a0a',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,                      // Electron 28 default; explícito para claridad
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: isDev,                    // F12 deshabilitado en producción
      spellcheck: false,
    },
    title: 'URBAN FITNESS CLUB',
    icon: fs.existsSync(path.join(__dirname, '../build/icon.ico'))
      ? path.join(__dirname, '../build/icon.ico')
      : path.join(__dirname, '../public/logo.jpg'),
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))

    // Bloquear atajos de teclado de devtools en producción (defensa en profundidad)
    mainWindow.webContents.on('before-input-event', (event, input) => {
      const isDevKey = input.key === 'F12' ||
        (input.control && input.shift && ['I', 'J', 'C'].includes(input.key.toUpperCase()))
      if (isDevKey) event.preventDefault()
    })

    // Restringir navegación a URLs externas
    mainWindow.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith('file://')) event.preventDefault()
    })

    // Bloquear apertura de ventanas nuevas externas
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  }
}

app.whenReady().then(async () => {
  // Eliminar menú por defecto de Electron (tiene "View > Toggle Developer Tools")
  if (!isDev) Menu.setApplicationMenu(null)

  // CSP headers — only in production (Vite dev server needs unsafe-inline for HMR)
  if (!isDev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' https://fonts.gstatic.com data:; " +
            "img-src 'self' data: file:; " +
            "connect-src 'self';"
          ]
        }
      })
    })
  }

  // Initialize DB before window (async because sql.js loads WASM)
  const dbModule = require('./database.cjs')
  await dbModule.initDB()
  // Inicializar módulo de facturación con acceso a la BD
  initFacturacion(dbModule.getQueryHelpers())
  registrarHandlersFacturacion(null)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Save DB to disk before quitting
app.on('before-quit', () => {
  try { require('./database.cjs').saveDB() } catch (_) {}
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── IPC Handlers ───────────────────────────────────────────────────────────

// Window controls
ipcMain.handle('window:minimize', () => mainWindow.minimize())
ipcMain.handle('window:maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize()
  else mainWindow.maximize()
})
ipcMain.handle('window:close', () => mainWindow.close())

// Clientes
ipcMain.handle('clientes:getAll', () => require('./database.cjs').clientes.getAll())
ipcMain.handle('clientes:getPaginated', (_, filtros) => require('./database.cjs').clientes.getPaginated(filtros))
ipcMain.handle('clientes:getById', (_, id) => require('./database.cjs').clientes.getById(id))
ipcMain.handle('clientes:getByCarnet', (_, carnet) => require('./database.cjs').clientes.getByCarnet(carnet))
ipcMain.handle('clientes:search', (_, query) => require('./database.cjs').clientes.search(query))
ipcMain.handle('clientes:create', (_, data) => require('./database.cjs').clientes.create(data))
ipcMain.handle('clientes:update', (_, id, data) => require('./database.cjs').clientes.update(id, data))
ipcMain.handle('clientes:delete', (_, id) => require('./database.cjs').clientes.delete(id))

// Planes
ipcMain.handle('planes:getAll', () => require('./database.cjs').planes.getAll())
ipcMain.handle('planes:getActive', () => require('./database.cjs').planes.getActive())
ipcMain.handle('planes:create', (_, data) => require('./database.cjs').planes.create(data))
ipcMain.handle('planes:update', (_, id, data) => require('./database.cjs').planes.update(id, data))
ipcMain.handle('planes:delete', (_, id) => require('./database.cjs').planes.delete(id))

// Membresias
ipcMain.handle('membresias:getByCliente', (_, clienteId) => require('./database.cjs').membresias.getByCliente(clienteId))
ipcMain.handle('membresias:getActiva', (_, clienteId) => require('./database.cjs').membresias.getActiva(clienteId))
ipcMain.handle('membresias:create', (_, data) => require('./database.cjs').membresias.create(data))
ipcMain.handle('membresias:renovar', (_, id, data) => require('./database.cjs').membresias.renovar(id, data))
ipcMain.handle('membresias:getVencidas', () => require('./database.cjs').membresias.getVencidas())
ipcMain.handle('membresias:getPorVencer', () => require('./database.cjs').membresias.getPorVencer())

// Asistencias
ipcMain.handle('asistencias:registrar', (_, carnet) => require('./database.cjs').asistencias.registrar(carnet))
ipcMain.handle('asistencias:getByCliente', (_, clienteId) => require('./database.cjs').asistencias.getByCliente(clienteId))
ipcMain.handle('asistencias:getHoy', () => require('./database.cjs').asistencias.getHoy())

// Pagos
ipcMain.handle('pagos:getByCliente', (_, clienteId) => require('./database.cjs').pagos.getByCliente(clienteId))
ipcMain.handle('pagos:getAll', () => require('./database.cjs').pagos.getAll())
ipcMain.handle('pagos:create', (_, data) => require('./database.cjs').pagos.create(data))

// Dashboard
ipcMain.handle('dashboard:stats', () => require('./database.cjs').dashboard.stats())
ipcMain.handle('dashboard:ingresosMes', () => require('./database.cjs').dashboard.ingresosMes())

// Auth admin (legacy)
ipcMain.handle('auth:checkAdmin', (_, password) => require('./database.cjs').auth.checkAdmin(password))
ipcMain.handle('auth:setAdmin', (_, password) => require('./database.cjs').auth.setAdmin(password))

// Auth nuevo (sistema de usuarios)
ipcMain.handle('auth:login', (_, username, password) => require('./database.cjs').usuarios.login(username, password))
ipcMain.handle('auth:logout', (_, token) => require('./database.cjs').sesiones.cerrar(token))
ipcMain.handle('auth:verificarToken', (_, token) => require('./database.cjs').sesiones.verificar(token))
ipcMain.handle('auth:cambiarPassword', (_, id, passwordActual, nuevaPassword) => {
  const db = require('./database.cjs')
  const ok = db.usuarios.verificarPassword(id, passwordActual)
  if (!ok) return { ok: false, error: 'Contraseña actual incorrecta' }
  return db.usuarios.cambiarPassword(id, nuevaPassword)
})
ipcMain.handle('auth:cambiarPasswordAdmin', (_, id, nuevaPassword) => {
  // Solo para primer login o reset por admin
  return require('./database.cjs').usuarios.cambiarPassword(id, nuevaPassword)
})

// Usuarios
ipcMain.handle('usuarios:getAll', () => require('./database.cjs').usuarios.getAll())
ipcMain.handle('usuarios:getById', (_, id) => require('./database.cjs').usuarios.getById(id))
ipcMain.handle('usuarios:create', (_, data) => require('./database.cjs').usuarios.create(data))
ipcMain.handle('usuarios:update', (_, id, data) => require('./database.cjs').usuarios.update(id, data))
ipcMain.handle('usuarios:setActivo', (_, id, activo) => require('./database.cjs').usuarios.setActivo(id, activo))
ipcMain.handle('usuarios:delete', (_, id) => require('./database.cjs').usuarios.delete(id))
ipcMain.handle('usuarios:registrar', (_, data) => require('./database.cjs').usuarios.registrar(data))
ipcMain.handle('usuarios:cambiarPasswordPorCarnet', (_, carnet, pass) => require('./database.cjs').usuarios.cambiarPasswordPorCarnet(carnet, pass))

// Roles
ipcMain.handle('roles:getAll', () => require('./database.cjs').roles.getAll())
ipcMain.handle('roles:create', (_, data) => require('./database.cjs').roles.create(data))
ipcMain.handle('roles:update', (_, id, data) => require('./database.cjs').roles.update(id, data))
ipcMain.handle('roles:delete', (_, id) => require('./database.cjs').roles.delete(id))
ipcMain.handle('roles:getPermisos', (_, rolId) => require('./database.cjs').roles.getPermisos(rolId))
ipcMain.handle('roles:setPermisos', (_, rolId, permisoIds) => require('./database.cjs').roles.setPermisos(rolId, permisoIds))

// Permisos
ipcMain.handle('permisos:getAll', () => require('./database.cjs').permisos.getAll())

// Auditoría
ipcMain.handle('auditoria:log', (_, data) => require('./database.cjs').auditoria.log(data))
ipcMain.handle('auditoria:getAll', (_, filtros) => require('./database.cjs').auditoria.getAll(filtros))
ipcMain.handle('auditoria:getPaginated', (_, filtros) => require('./database.cjs').auditoria.getPaginated(filtros))

// Módulos
ipcMain.handle('modulos:getAll', () => require('./database.cjs').modulos.getAll())
ipcMain.handle('modulos:setActivo', (_, modulo, activo, usuarioId) => require('./database.cjs').modulos.setActivo(modulo, activo, usuarioId))

// clientesExtra — perfil completo y campos extendidos
ipcMain.handle('clientesExtra:getPerfilCompleto', (_, id) => require('./database.cjs').clientesExtra.getPerfilCompleto(id))
ipcMain.handle('clientesExtra:getHeatmap', (_, clienteId, dias) => require('./database.cjs').clientesExtra.getHeatmap(clienteId, dias))
ipcMain.handle('clientesExtra:getStats', (_, clienteId) => require('./database.cjs').clientesExtra.getStats(clienteId))
ipcMain.handle('clientesExtra:updateExtra', (_, id, data) => require('./database.cjs').clientesExtra.updateExtra(id, data))
ipcMain.handle('clientesExtra:getAsistenciasPorMes', (_, clienteId) => require('./database.cjs').clientesExtra.getAsistenciasPorMes(clienteId))
ipcMain.handle('clientesExtra:getAsistenciasRecientes', (_, clienteId, n) => require('./database.cjs').clientesExtra.getAsistenciasRecientes(clienteId, n))

// notasCliente
ipcMain.handle('notasCliente:getByCliente', (_, clienteId) => require('./database.cjs').notasCliente.getByCliente(clienteId))
ipcMain.handle('notasCliente:create', (_, data) => require('./database.cjs').notasCliente.create(data))
ipcMain.handle('notasCliente:delete', (_, id) => require('./database.cjs').notasCliente.delete(id))

// dashboard2
ipcMain.handle('dashboard2:distribucionPlanes', () => require('./database.cjs').dashboard2.distribucionPlanes())
ipcMain.handle('dashboard2:asistenciasPorHora', () => require('./database.cjs').dashboard2.asistenciasPorHora())
ipcMain.handle('dashboard2:asistenciasHoyRecientes', (_, n) => require('./database.cjs').dashboard2.asistenciasHoyRecientes(n))
ipcMain.handle('dashboard2:cumpleanosProximos', (_, dias) => require('./database.cjs').dashboard2.cumpleanosProximos(dias))
ipcMain.handle('dashboard2:clientesInactivos', (_, dias) => require('./database.cjs').dashboard2.clientesInactivos(dias))
ipcMain.handle('dashboard2:topClientes', (_, n) => require('./database.cjs').dashboard2.topClientes(n))
ipcMain.handle('dashboard2:ingresosPorRango', (_, inicio, fin) => require('./database.cjs').dashboard2.ingresosPorRango(inicio, fin))
ipcMain.handle('dashboard2:resumenRapido', () => require('./database.cjs').dashboard2.resumenRapido())

// Clientes POS (nuevas funciones)
ipcMain.handle('clientes:createCompleto', (_, data) => require('./database.cjs').clientes.createCompleto(data))
ipcMain.handle('clientes:checkCarnetExiste', (_, carnet, excludeId) => require('./database.cjs').clientes.checkCarnetExiste(carnet, excludeId))
ipcMain.handle('clientes:buscarPOS', (_, query) => require('./database.cjs').clientes.buscarPOS(query))
ipcMain.handle('clientes:buscarPOSById', (_, id) => require('./database.cjs').clientes.buscarPOSById(id))

// Planes con conteo de clientes
ipcMain.handle('planes:getWithClientCount', () => require('./database.cjs').planes.getWithClientCount())

// Asistencias por ID
ipcMain.handle('asistencias:registrarById', (_, clienteId) => require('./database.cjs').asistencias.registrarById(clienteId))

// Ventas (POS)
ipcMain.handle('ventas:procesarPagoMembresia', (_, data) => require('./database.cjs').ventas.procesarPagoMembresia(data))
ipcMain.handle('ventas:getByCliente', (_, clienteId) => require('./database.cjs').ventas.getByCliente(clienteId))
ipcMain.handle('ventas:getAll', (_, filtros) => require('./database.cjs').ventas.getAll(filtros))
ipcMain.handle('ventas:getPaginated', (_, filtros) => require('./database.cjs').ventas.getPaginated(filtros))
ipcMain.handle('ventas:getById', (_, id) => require('./database.cjs').ventas.getById(id))
ipcMain.handle('ventas:getKPIs', (_, filtros) => require('./database.cjs').ventas.getKPIs(filtros))
ipcMain.handle('ventas:anular', (_, id) => require('./database.cjs').ventas.anular(id))

// Descuentos
ipcMain.handle('descuentos:getAll', () => require('./database.cjs').descuentos.getAll())
ipcMain.handle('descuentos:getActive', () => require('./database.cjs').descuentos.getActive())
ipcMain.handle('descuentos:create', (_, data) => require('./database.cjs').descuentos.create(data))
ipcMain.handle('descuentos:update', (_, id, data) => require('./database.cjs').descuentos.update(id, data))
ipcMain.handle('descuentos:delete', (_, id) => require('./database.cjs').descuentos.delete(id))

// Configuración POS
ipcMain.handle('pos:getConfig', () => require('./database.cjs').configuracionPOS.get())
ipcMain.handle('pos:saveConfig', (_, data) => require('./database.cjs').configuracionPOS.save(data))
ipcMain.handle('pos:getPrinters', (event) => event.sender.getPrinters())
ipcMain.handle('pos:testPrint', (_, printerName) => new Promise(resolve => {
  const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } })
  win.loadURL('data:text/html,<!DOCTYPE html><html><body style="font-family:monospace;padding:20px"><h2>Test de Impresión</h2><p>Urban Fitness Club</p><p>Si ves esto, la impresora funciona correctamente.</p><p>' + new Date().toLocaleString('es-BO') + '</p></body></html>')
  win.webContents.once('did-finish-load', () => {
    win.webContents.print({ silent: true, deviceName: printerName, printBackground: false }, (success, reason) => {
      win.destroy()
      resolve({ ok: success, reason: reason || null })
    })
  })
}))

// Inventario
ipcMain.handle('inventario:getCategorias', () => require('./database.cjs').inventario.getCategorias())
ipcMain.handle('inventario:createCategoria', (_, data) => require('./database.cjs').inventario.createCategoria(data))
ipcMain.handle('inventario:updateCategoria', (_, id, data) => require('./database.cjs').inventario.updateCategoria(id, data))
ipcMain.handle('inventario:deleteCategoria', (_, id) => require('./database.cjs').inventario.deleteCategoria(id))
ipcMain.handle('inventario:getProveedores', () => require('./database.cjs').inventario.getProveedores())
ipcMain.handle('inventario:createProveedor', (_, data) => require('./database.cjs').inventario.createProveedor(data))
ipcMain.handle('inventario:updateProveedor', (_, id, data) => require('./database.cjs').inventario.updateProveedor(id, data))
ipcMain.handle('inventario:deleteProveedor', (_, id) => require('./database.cjs').inventario.deleteProveedor(id))
ipcMain.handle('inventario:getAll', (_, filtros) => require('./database.cjs').inventario.getAll(filtros))
ipcMain.handle('inventario:getPaginated', (_, filtros) => require('./database.cjs').inventario.getPaginated(filtros))
ipcMain.handle('inventario:getAllMovimientosPaginated', (_, filtros) => require('./database.cjs').inventario.getAllMovimientosPaginated(filtros))
ipcMain.handle('inventario:getById', (_, id) => require('./database.cjs').inventario.getById(id))
ipcMain.handle('inventario:create', (_, data) => require('./database.cjs').inventario.create(data))
ipcMain.handle('inventario:update', (_, id, data) => require('./database.cjs').inventario.update(id, data))
ipcMain.handle('inventario:delete', (_, id) => require('./database.cjs').inventario.delete(id))
ipcMain.handle('inventario:getStockBajo', () => require('./database.cjs').inventario.getStockBajo())
ipcMain.handle('inventario:buscarPOS', (_, query) => require('./database.cjs').inventario.buscarPOS(query))
ipcMain.handle('inventario:ajustarStock', (_, data) => require('./database.cjs').inventario.ajustarStock(data))
ipcMain.handle('inventario:getMovimientos', (_, productoId) => require('./database.cjs').inventario.getMovimientos(productoId))
ipcMain.handle('inventario:getAllMovimientos', () => require('./database.cjs').inventario.getAllMovimientos())
ipcMain.handle('inventario:venderProductos', (_, items, meta) => require('./database.cjs').inventario.venderProductos(items, meta))
ipcMain.handle('inventario:pickImage', async () => {
  const { dialog } = require('electron')
  const fs = require('fs')
  const pathMod = require('path')
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar imagen del producto',
    filters: [{ name: 'Imágenes', extensions: ['jpg','jpeg','png','webp','gif'] }],
    properties: ['openFile'],
  })
  if (r.canceled || !r.filePaths.length) return { cancelado: true }
  const filePath = r.filePaths[0]
  const ext = pathMod.extname(filePath).toLowerCase().slice(1)
  const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }
  const mime = mimeMap[ext] || 'image/jpeg'
  const buffer = fs.readFileSync(filePath)
  const base64 = buffer.toString('base64')
  return { dataUrl: `data:${mime};base64,${base64}` }
})

// Caja
ipcMain.handle('caja:getSesionActual', () => require('./database.cjs').caja.getSesionActual())
ipcMain.handle('caja:isAbierta', () => require('./database.cjs').caja.isAbierta())
ipcMain.handle('caja:abrir', (_, data) => require('./database.cjs').caja.abrir(data))
ipcMain.handle('caja:cerrar', (_, data) => require('./database.cjs').caja.cerrar(data))
ipcMain.handle('caja:addMovimiento', (_, data) => require('./database.cjs').caja.addMovimiento(data))
ipcMain.handle('caja:getMovimientos', (_, sesionId) => require('./database.cjs').caja.getMovimientos(sesionId))
ipcMain.handle('caja:getResumen', (_, sesionId) => require('./database.cjs').caja.getResumen(sesionId))
ipcMain.handle('caja:getHistorial', (_, limit) => require('./database.cjs').caja.getHistorial(limit))
ipcMain.handle('caja:getHistorialPaginated', (_, filtros) => require('./database.cjs').caja.getHistorialPaginated(filtros))
ipcMain.handle('caja:getSesionById', (_, id) => require('./database.cjs').caja.getSesionById(id))
ipcMain.handle('caja:addNota', (_, data) => require('./database.cjs').caja.addNota(data))
ipcMain.handle('caja:getNotas', (_, sesionId) => require('./database.cjs').caja.getNotas(sesionId))
ipcMain.handle('ventas:getBySesion', (_, sesionId) => require('./database.cjs').ventas.getBySesion(sesionId))

// Clientes — facturador habitual
ipcMain.handle('clientes:getFacturadorHabitual', (_, clienteId) => require('./database.cjs').clientes.getFacturadorHabitual(clienteId))
ipcMain.handle('clientes:setFacturadorHabitual', (_, clienteId, data) => require('./database.cjs').clientes.setFacturadorHabitual(clienteId, data))

// Membresía miembros (grupales)
ipcMain.handle('membresiaMiembros:getMiembros', (_, membresiaId) => require('./database.cjs').membresiaMiembros.getMiembros(membresiaId))
ipcMain.handle('membresiaMiembros:addMiembro', (_, membresiaId, clienteId, esTitular) => require('./database.cjs').membresiaMiembros.addMiembro(membresiaId, clienteId, esTitular))
ipcMain.handle('membresiaMiembros:removeMiembro', (_, membresiaId, clienteId) => require('./database.cjs').membresiaMiembros.removeMiembro(membresiaId, clienteId))
ipcMain.handle('membresiaMiembros:getMembresiaDeCliente', (_, clienteId) => require('./database.cjs').membresiaMiembros.getMembresiaDeCliente(clienteId))
ipcMain.handle('membresiaMiembros:sincronizarTitular', (_, membresiaId, clienteId) => require('./database.cjs').membresiaMiembros.sincronizarTitular(membresiaId, clienteId))

// Papelera
ipcMain.handle('papelera:getResumen', () => require('./database.cjs').papelera.getResumen())
ipcMain.handle('papelera:getClientes', () => require('./database.cjs').papelera.getClientes())
ipcMain.handle('papelera:getPlanes', () => require('./database.cjs').papelera.getPlanes())
ipcMain.handle('papelera:getProductos', () => require('./database.cjs').papelera.getProductos())
ipcMain.handle('papelera:restaurarCliente', (_, id) => require('./database.cjs').papelera.restaurarCliente(id))
ipcMain.handle('papelera:restaurarPlan', (_, id) => require('./database.cjs').papelera.restaurarPlan(id))
ipcMain.handle('papelera:restaurarProducto', (_, id) => require('./database.cjs').papelera.restaurarProducto(id))
ipcMain.handle('papelera:eliminarPermanenteCliente', (_, id) => require('./database.cjs').papelera.eliminarPermanenteCliente(id))
ipcMain.handle('papelera:eliminarPermanentePlan', (_, id) => require('./database.cjs').papelera.eliminarPermanentePlan(id))
ipcMain.handle('papelera:eliminarPermanenteProducto', (_, id) => require('./database.cjs').papelera.eliminarPermanenteProducto(id))

// Respaldos
ipcMain.handle('respaldos:info', () => require('./database.cjs').respaldosDB.info())

ipcMain.handle('respaldos:listar', () => {
  const db = require('./database.cjs')
  const registros = db.auditoria.getAll({ accion: 'RESPALDO_CREADO' })
  return registros.map(r => {
    let nombre = '—', tamaño = 0
    try {
      const d = JSON.parse(r.detalle || '{}')
      nombre = d.nombre || r.detalle || '—'
      tamaño = d.tamaño || 0
    } catch { nombre = r.detalle || '—' }
    return { nombre, tamaño, fecha: r.fecha }
  })
})

ipcMain.handle('respaldos:exportar', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Guardar respaldo',
    defaultPath: `urbanfitness_respaldo_${new Date().toISOString().slice(0, 10)}.enc`,
    filters: [{ name: 'Respaldo UFC', extensions: ['enc'] }],
  })
  if (result.canceled) return { cancelado: true }
  const db = require('./database.cjs')
  const encBuf = db.respaldosDB.exportarTodoCifrado()
  const fs = require('fs')
  fs.writeFileSync(result.filePath, encBuf)
  const nombre = require('path').basename(result.filePath)
  const tamaño = encBuf.length
  db.auditoria.log({
    accion: 'RESPALDO_CREADO',
    modulo: 'sistema',
    detalle: JSON.stringify({ nombre, tamaño }),
  })
  return { ok: true, nombre, tamaño }
})

ipcMain.handle('respaldos:seleccionarArchivo', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar respaldo',
    filters: [{ name: 'Respaldo UFC', extensions: ['enc', 'json'] }],
    properties: ['openFile'],
  })
  if (result.canceled) return null
  return { ruta: result.filePaths[0] }
})

ipcMain.handle('respaldos:restaurar', async (_, ruta) => {
  try {
    const fs = require('fs')
    const fileBuf = fs.readFileSync(ruta)
    const resultado = require('./database.cjs').respaldosDB.restaurarDesdeArchivo(fileBuf)
    return resultado
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// Datos de Prueba
ipcMain.handle('datosPrueba:contar', () => require('./database.cjs').datosPrueba.contar())
ipcMain.handle('datosPrueba:generar', () => require('./database.cjs').datosPrueba.generar())
ipcMain.handle('datosPrueba:eliminar', () => require('./database.cjs').datosPrueba.eliminar())
ipcMain.handle('datosPrueba:resetear', () => require('./database.cjs').datosPrueba.resetear())

// Recibos
ipcMain.handle('recibos:getConfig', () => {
  const db = require('./database.cjs')
  try {
    return db.queryOne ? db.queryOne('SELECT * FROM config_recibos WHERE id=1') || {} : {}
  } catch { return {} }
})
ipcMain.handle('recibos:saveConfig', (_, data) => {
  const { run, queryOne } = require('./database.cjs').getQueryHelpers()
  const existe = queryOne('SELECT id FROM config_recibos WHERE id=1')
  if (existe) {
    run('UPDATE config_recibos SET activo=?,formato=?,mostrar_logo=?,mostrar_datos_gym=?,mostrar_datos_cliente=?,mostrar_detalle=?,mostrar_metodo_pago=?,mostrar_numero=?,mostrar_fecha=?,mostrar_cajero=?,mostrar_mensaje=?,mensaje_pie=? WHERE id=1',
      [data.activo?1:0, data.formato||'media', data.mostrar_logo?1:0, data.mostrar_datos_gym?1:0,
       data.mostrar_datos_cliente?1:0, data.mostrar_detalle?1:0, data.mostrar_metodo_pago?1:0,
       data.mostrar_numero?1:0, data.mostrar_fecha?1:0, data.mostrar_cajero?1:0,
       data.mostrar_mensaje?1:0, data.mensaje_pie||''])
  } else {
    run('INSERT INTO config_recibos (id,activo,formato,mostrar_logo,mostrar_datos_gym,mostrar_datos_cliente,mostrar_detalle,mostrar_metodo_pago,mostrar_numero,mostrar_fecha,mostrar_cajero,mostrar_mensaje,mensaje_pie) VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?)',
      [data.activo?1:0, data.formato||'media', data.mostrar_logo?1:0, data.mostrar_datos_gym?1:0,
       data.mostrar_datos_cliente?1:0, data.mostrar_detalle?1:0, data.mostrar_metodo_pago?1:0,
       data.mostrar_numero?1:0, data.mostrar_fecha?1:0, data.mostrar_cajero?1:0,
       data.mostrar_mensaje?1:0, data.mensaje_pie||''])
  }
  return { ok: true }
})
ipcMain.handle('recibos:generarPDF', async (_, venta) => {
  const PDFDocument = require('pdfkit')
  const { queryOne } = require('./database.cjs').getQueryHelpers()
  const config = queryOne('SELECT * FROM config_recibos WHERE id=1') || {}
  const posConfig = queryOne('SELECT * FROM configuracion_pos WHERE id=1') || {}
  const PDFS_DIR = path.join(app.getPath('userData'), 'recibos_pdf')
  if (!fs.existsSync(PDFS_DIR)) fs.mkdirSync(PDFS_DIR, { recursive: true })
  const formato = config.formato || 'media'
  const isTicket = formato === 'ticket'
  const W = isTicket ? 226 : (formato === 'carta' ? 612 : 396)
  const H = isTicket ? 600 : (formato === 'carta' ? 792 : 540)
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: [W, H], margin: 0 })
      const pdfPath = path.join(PDFS_DIR, `recibo_${venta.numero||Date.now()}.pdf`)
      const stream = fs.createWriteStream(pdfPath)
      doc.pipe(stream)
      const M = isTicket ? 10 : 24
      let y = M
      const gymNombre = posConfig.gym_nombre || 'Urban Fitness Club'
      const logoPath = path.join(__dirname, '../public/logo.jpg')
      if ((config.mostrar_logo !== 0) && fs.existsSync(logoPath)) {
        try { doc.image(logoPath, W/2 - 20, y, { height: 30 }); y += 34 } catch { y += 8 }
      }
      doc.fillColor('#111').fontSize(isTicket ? 11 : 14).font('Helvetica-Bold')
        .text(gymNombre, M, y, { width: W - M*2, align: 'center' })
      y += isTicket ? 14 : 18
      if (config.mostrar_datos_gym !== 0 && posConfig.gym_direccion) {
        doc.fontSize(isTicket ? 8 : 9).font('Helvetica').fillColor('#555')
          .text(posConfig.gym_direccion || '', M, y, { width: W - M*2, align: 'center' })
        y += isTicket ? 10 : 13
        if (posConfig.gym_telefono) {
          doc.text(`Tel: ${posConfig.gym_telefono}`, M, y, { width: W - M*2, align: 'center' })
          y += isTicket ? 10 : 13
        }
      }
      doc.moveTo(M, y).lineTo(W-M, y).strokeColor('#ccc').lineWidth(0.5).stroke(); y += 6
      if (config.mostrar_numero !== 0) {
        doc.fillColor('#111').fontSize(isTicket ? 10 : 13).font('Helvetica-Bold')
          .text(`RECIBO DE PAGO N° ${String(venta.numero||1).padStart(4,'0')}`, M, y, { width: W-M*2, align: 'center' })
        y += isTicket ? 13 : 16
      }
      if (config.mostrar_fecha !== 0) {
        doc.fontSize(isTicket ? 8 : 9).font('Helvetica').fillColor('#555')
          .text(`Fecha: ${venta.fecha || new Date().toLocaleString('es-BO')}`, M, y, { width: W-M*2, align: 'center' })
        y += isTicket ? 11 : 13
      }
      doc.moveTo(M, y).lineTo(W-M, y).strokeColor('#ccc').lineWidth(0.5).stroke(); y += 6
      if (config.mostrar_datos_cliente !== 0 && venta.cliente_nombre) {
        doc.fontSize(isTicket ? 8 : 10).font('Helvetica').fillColor('#333')
          .text(`Cliente: ${venta.cliente_nombre}`, M, y)
        y += isTicket ? 10 : 13
        if (venta.cliente_doc) { doc.text(`CI: ${venta.cliente_doc}`, M, y); y += isTicket?10:13 }
      }
      doc.moveTo(M, y).lineTo(W-M, y).strokeColor('#ccc').lineWidth(0.5).stroke(); y += 6
      if (config.mostrar_detalle !== 0 && venta.items?.length) {
        doc.fontSize(isTicket ? 8 : 9).font('Helvetica-Bold').fillColor('#111')
        venta.items.forEach(item => {
          doc.text(`${item.nombre}`, M, y, { width: (W-M*2)*0.6 })
          doc.text(`${item.cantidad}`, M + (W-M*2)*0.6, y, { width: 30, align: 'center' })
          doc.text(`Bs.${Number(item.total).toFixed(2)}`, M + (W-M*2)*0.6 + 30, y, { width: (W-M*2)*0.4 - 30, align: 'right' })
          y += isTicket ? 11 : 14
        })
      }
      doc.moveTo(M, y).lineTo(W-M, y).strokeColor('#ccc').lineWidth(0.5).stroke(); y += 6
      doc.fontSize(isTicket ? 10 : 13).font('Helvetica-Bold').fillColor('#111')
        .text(`TOTAL:`, M, y)
        .text(`Bs. ${Number(venta.total||0).toFixed(2)}`, M, y, { width: W-M*2, align: 'right' })
      y += isTicket ? 14 : 18
      if (config.mostrar_metodo_pago !== 0) {
        doc.fontSize(isTicket?8:9).font('Helvetica').fillColor('#555')
          .text(`Método: ${venta.metodo_pago || 'Efectivo'}`, M, y)
        y += isTicket?10:13
        if (venta.recibido) { doc.text(`Recibido: Bs. ${Number(venta.recibido).toFixed(2)}`, M, y); y+=isTicket?10:13 }
        if (venta.vuelto > 0) { doc.text(`Cambio: Bs. ${Number(venta.vuelto).toFixed(2)}`, M, y); y+=isTicket?10:13 }
      }
      if (config.mostrar_cajero !== 0 && venta.cajero) {
        doc.moveTo(M, y).lineTo(W-M, y).strokeColor('#ccc').lineWidth(0.5).stroke(); y += 6
        doc.text(`Atendido por: ${venta.cajero}`, M, y, { width: W-M*2, align: 'center' }); y += isTicket?10:13
      }
      if (config.mostrar_mensaje !== 0 && config.mensaje_pie) {
        doc.moveTo(M, y).lineTo(W-M, y).strokeColor('#ccc').lineWidth(0.5).stroke(); y += 6
        doc.fontSize(isTicket?8:9).font('Helvetica-Bold')
          .text(config.mensaje_pie, M, y, { width: W-M*2, align: 'center' }); y += isTicket?12:15
      }
      doc.moveTo(M, y).lineTo(W-M, y).strokeColor('#ccc').lineWidth(0.5).stroke(); y += 6
      doc.fontSize(isTicket?7:8).font('Helvetica').fillColor('#999')
        .text('Este recibo no es válido como factura', M, y, { width: W-M*2, align: 'center' })
      doc.end()
      stream.on('finish', () => resolve({ ok: true, pdfPath }))
      stream.on('error', reject)
    } catch (err) { reject(err) }
  })
})
ipcMain.handle('recibos:guardarPDF', async (_, venta) => {
  try {
    const { shell } = require('electron')
    const PDFDocument = require('pdfkit')
    const { queryOne } = require('./database.cjs').getQueryHelpers()
    const config = queryOne('SELECT * FROM config_recibos WHERE id=1') || {}
    const posConfig = queryOne('SELECT * FROM configuracion_pos WHERE id=1') || {}
    const PDFS_DIR = path.join(app.getPath('userData'), 'recibos_pdf')
    if (!fs.existsSync(PDFS_DIR)) fs.mkdirSync(PDFS_DIR, { recursive: true })
    const formato = config.formato || 'media'
    const isTicket = formato === 'ticket'
    const W = isTicket ? 226 : (formato === 'carta' ? 612 : 396)
    const M = isTicket ? 10 : 24
    let y = M
    const gymNombre = posConfig.gym_nombre || 'Urban Fitness Club'
    const logoPath = path.join(__dirname, '../public/logo.jpg')
    const pdfPath = path.join(PDFS_DIR, `recibo_${venta.numero||Date.now()}.pdf`)
    await new Promise((res, rej) => {
      const doc = new PDFDocument({ size: [W, 800], margin: 0 })
      const stream = fs.createWriteStream(pdfPath)
      doc.pipe(stream)
      if ((config.mostrar_logo !== 0) && fs.existsSync(logoPath)) {
        try { doc.image(logoPath, W/2-20, y, { height: 28 }); y += 32 } catch { y += 8 }
      }
      doc.fillColor('#111').fontSize(isTicket?11:14).font('Helvetica-Bold')
        .text(gymNombre, M, y, { width: W-M*2, align: 'center' }); y += isTicket?14:18
      if (config.mostrar_datos_gym !== 0 && posConfig.gym_direccion) {
        doc.fontSize(isTicket?8:9).font('Helvetica').fillColor('#555')
          .text(posConfig.gym_direccion, M, y, { width: W-M*2, align: 'center' }); y += isTicket?10:13
      }
      doc.moveTo(M,y).lineTo(W-M,y).strokeColor('#ccc').lineWidth(0.5).stroke(); y+=6
      if (config.mostrar_numero !== 0) {
        doc.fillColor('#111').fontSize(isTicket?10:13).font('Helvetica-Bold')
          .text(`RECIBO N° ${String(venta.numero||1).padStart(4,'0')}`, M, y, { width: W-M*2, align: 'center' }); y+=isTicket?13:16
      }
      if (config.mostrar_fecha !== 0) {
        doc.fontSize(isTicket?8:9).font('Helvetica').fillColor('#555')
          .text(`Fecha: ${venta.fecha||new Date().toLocaleString('es-BO')}`, M, y, { width: W-M*2, align: 'center' }); y+=isTicket?11:13
      }
      doc.moveTo(M,y).lineTo(W-M,y).strokeColor('#ccc').lineWidth(0.5).stroke(); y+=6
      if (config.mostrar_datos_cliente !== 0 && venta.cliente_nombre) {
        doc.fontSize(isTicket?8:10).font('Helvetica').fillColor('#333')
          .text(`Cliente: ${venta.cliente_nombre}`, M, y); y+=isTicket?10:13
      }
      doc.moveTo(M,y).lineTo(W-M,y).strokeColor('#ccc').lineWidth(0.5).stroke(); y+=6
      if (config.mostrar_detalle !== 0 && venta.items?.length) {
        doc.fontSize(isTicket?8:9).font('Helvetica').fillColor('#111')
        venta.items.forEach(item => {
          doc.text(item.nombre, M, y, { width: (W-M*2)*0.55 })
          doc.text(`Bs.${Number(item.total).toFixed(2)}`, M, y, { width: W-M*2, align: 'right' }); y+=isTicket?11:14
        })
      }
      doc.moveTo(M,y).lineTo(W-M,y).strokeColor('#ccc').lineWidth(0.5).stroke(); y+=6
      doc.fontSize(isTicket?10:13).font('Helvetica-Bold').fillColor('#111')
        .text(`TOTAL: Bs. ${Number(venta.total||0).toFixed(2)}`, M, y, { width: W-M*2, align: 'right' }); y+=isTicket?14:18
      if (config.mostrar_metodo_pago !== 0) {
        doc.fontSize(isTicket?8:9).font('Helvetica').fillColor('#555')
          .text(`Método: ${venta.metodo_pago||'Efectivo'}`, M, y); y+=isTicket?10:13
        if (venta.vuelto > 0) { doc.text(`Cambio: Bs. ${Number(venta.vuelto).toFixed(2)}`, M, y); y+=isTicket?10:13 }
      }
      if (config.mostrar_cajero !== 0 && venta.cajero) {
        doc.moveTo(M,y).lineTo(W-M,y).strokeColor('#ccc').lineWidth(0.5).stroke(); y+=6
        doc.text(`Atendido por: ${venta.cajero}`, M, y, { width: W-M*2, align: 'center' }); y+=isTicket?10:13
      }
      if (config.mostrar_mensaje !== 0 && config.mensaje_pie) {
        doc.moveTo(M,y).lineTo(W-M,y).strokeColor('#ccc').lineWidth(0.5).stroke(); y+=6
        doc.fontSize(isTicket?8:9).font('Helvetica-Bold')
          .text(config.mensaje_pie, M, y, { width: W-M*2, align: 'center' }); y+=isTicket?12:15
      }
      doc.moveTo(M,y).lineTo(W-M,y).strokeColor('#ccc').lineWidth(0.5).stroke(); y+=6
      doc.fontSize(isTicket?7:8).font('Helvetica').fillColor('#999')
        .text('Este recibo no es válido como factura', M, y, { width: W-M*2, align: 'center' })
      doc.end()
      stream.on('finish', res); stream.on('error', rej)
    })
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Guardar Recibo PDF',
      defaultPath: path.join(app.getPath('documents'), `Recibo_${venta.numero||'001'}.pdf`),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (result.canceled) return { ok: false, cancelado: true }
    fs.copyFileSync(pdfPath, result.filePath)
    shell.openPath(result.filePath)
    return { ok: true, ruta: result.filePath }
  } catch (err) { return { ok: false, error: err.message } }
})

// Recibos persistidos
ipcMain.handle('recibos:guardar',        (_, data) => require('./database.cjs').recibosDB.guardar(data))
ipcMain.handle('recibos:getByCliente',   (_, clienteId, page, pageSize) => require('./database.cjs').recibosDB.getByClientePaginado(clienteId, page, pageSize))
ipcMain.handle('recibos:getById',        (_, id) => require('./database.cjs').recibosDB.getById(id))

// App control
ipcMain.handle('app:reiniciar', () => { app.relaunch(); app.exit(0) })

// Promociones
ipcMain.handle('promociones:getAll',    () => require('./database.cjs').promociones.getAll())
ipcMain.handle('promociones:getActive', () => require('./database.cjs').promociones.getActive())
ipcMain.handle('promociones:create',    (_, data) => require('./database.cjs').promociones.create(data))
ipcMain.handle('promociones:update',    (_, id, data) => require('./database.cjs').promociones.update(id, data))
ipcMain.handle('promociones:delete',    (_, id) => require('./database.cjs').promociones.delete(id))
ipcMain.handle('promociones:setActivo',    (_, id, activo) => require('./database.cjs').promociones.setActivo(id, activo))
ipcMain.handle('promociones:getProductos', (_, id) => require('./database.cjs').promociones.getProductos(id))

// Open file dialog for photo
ipcMain.handle('dialog:openImage', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar foto',
    filters: [{ name: 'Imágenes', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    properties: ['openFile'],
  })
  return result.canceled ? null : result.filePaths[0].replace(/\\/g, '/')
})
