const path = require('path')
const fs = require('fs')
const { app } = require('electron')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')

const DB_FILE = 'urbanfitness.db'
const DB_PATH = app.isPackaged
  ? path.join(app.getPath('userData'), DB_FILE)
  : path.join(__dirname, '../dev_data', DB_FILE)

if (!app.isPackaged) {
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

let db = null

// ─── Helpers ─────────────────────────────────────────────────────────────────

function saveDB() {
  const data = db.export()
  fs.writeFileSync(DB_PATH, Buffer.from(data))
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

function queryOne(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  let row = null
  if (stmt.step()) row = stmt.getAsObject()
  stmt.free()
  return row
}

function run(sql, params = []) {
  db.run(sql, params)
  const meta = db.exec('SELECT last_insert_rowid() as lid, changes() as ch')
  const lid = meta.length ? meta[0].values[0][0] : 0
  saveDB()
  return { lastInsertRowid: lid }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function initDB() {
  const initSqlJs = require('sql.js')
  const SQL = await initSqlJs({
    locateFile: () => path.join(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm')
  })

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  // ─── Tablas de Facturación Electrónica ────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS configuracion_empresa (
      id INTEGER PRIMARY KEY,
      nit TEXT, razon_social TEXT, nombre_comercial TEXT, direccion TEXT,
      telefono TEXT, departamento TEXT, municipio TEXT,
      codigo_sucursal INTEGER DEFAULT 0, punto_venta INTEGER DEFAULT 0,
      actividad_economica TEXT, leyenda TEXT, updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS credenciales_sfe (
      id INTEGER PRIMARY KEY,
      ambiente TEXT DEFAULT 'piloto', token TEXT, codigo_sistema TEXT,
      cuis TEXT, cuis_fecha_emision TEXT, cuis_fecha_vigencia TEXT,
      cufd TEXT, cufd_codigo_control TEXT, cufd_fecha_emision TEXT, cufd_fecha_vigencia TEXT,
      modalidad INTEGER DEFAULT 2, tipo_emision INTEGER DEFAULT 1, tipo_factura INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS certificado_digital (
      id INTEGER PRIMARY KEY,
      ruta_archivo TEXT, password_encriptado TEXT,
      fecha_emision TEXT, fecha_vencimiento TEXT, cargado_at TEXT
    );
    CREATE TABLE IF NOT EXISTS configuracion_correo (
      id INTEGER PRIMARY KEY,
      smtp_host TEXT, smtp_port INTEGER DEFAULT 587, smtp_user TEXT,
      smtp_pass_encriptado TEXT, use_ssl INTEGER DEFAULT 0,
      remitente TEXT, asunto_plantilla TEXT, cuerpo_plantilla TEXT
    );
    CREATE TABLE IF NOT EXISTS facturas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_factura INTEGER UNIQUE,
      cuf TEXT, cufd_uso TEXT,
      fecha_emision TEXT,
      cliente_id INTEGER, cliente_nombre TEXT, cliente_documento TEXT,
      cliente_tipo_doc TEXT DEFAULT 'CI', cliente_correo TEXT,
      concepto TEXT, cantidad INTEGER DEFAULT 1,
      precio_unitario REAL, descuento REAL DEFAULT 0, monto_total REAL,
      metodo_pago TEXT DEFAULT 'efectivo',
      estado TEXT DEFAULT 'PENDIENTE_ENVIO',
      xml_generado TEXT, respuesta_sfe TEXT, pdf_path TEXT,
      enviado_correo INTEGER DEFAULT 0, fecha_envio_correo TEXT,
      motivo_anulacion TEXT, es_simulacion INTEGER DEFAULT 0,
      es_prueba INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS log_facturacion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      factura_id INTEGER, accion TEXT, resultado TEXT, detalle TEXT,
      fecha TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS config_recibos (
      id INTEGER PRIMARY KEY,
      activo INTEGER DEFAULT 1,
      formato TEXT DEFAULT 'media',
      mostrar_logo INTEGER DEFAULT 1,
      mostrar_datos_gym INTEGER DEFAULT 1,
      mostrar_datos_cliente INTEGER DEFAULT 1,
      mostrar_detalle INTEGER DEFAULT 1,
      mostrar_metodo_pago INTEGER DEFAULT 1,
      mostrar_numero INTEGER DEFAULT 1,
      mostrar_fecha INTEGER DEFAULT 1,
      mostrar_cajero INTEGER DEFAULT 1,
      mostrar_mensaje INTEGER DEFAULT 0,
      mensaje_pie TEXT DEFAULT 'Gracias por tu preferencia',
      updated_at TEXT
    );
  `)
  // Migraciones para columnas opcionales (por si la DB ya existe)
  try { db.run("ALTER TABLE facturas ADD COLUMN es_simulacion INTEGER DEFAULT 0") } catch {}
  try { db.run("ALTER TABLE facturas ADD COLUMN es_prueba INTEGER DEFAULT 0") } catch {}

  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      carnet TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      telefono TEXT,
      email TEXT,
      fecha_nacimiento TEXT,
      foto_path TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS planes_catalogo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      duracion_dias INTEGER NOT NULL,
      precio REAL NOT NULL,
      descripcion TEXT,
      activo INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS membresias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL REFERENCES clientes(id),
      plan_id INTEGER NOT NULL REFERENCES planes_catalogo(id),
      fecha_inicio TEXT NOT NULL,
      fecha_fin TEXT NOT NULL,
      monto_pagado REAL NOT NULL,
      estado TEXT NOT NULL DEFAULT 'activa',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS asistencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL REFERENCES clientes(id),
      fecha_hora TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS pagos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL REFERENCES clientes(id),
      membresia_id INTEGER REFERENCES membresias(id),
      monto REAL NOT NULL,
      metodo TEXT NOT NULL DEFAULT 'efectivo',
      concepto TEXT,
      fecha TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `)

  // ─── Tablas Sistema de Roles y Permisos ───────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT UNIQUE NOT NULL,
      descripcion TEXT,
      es_sistema INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS permisos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      modulo TEXT NOT NULL,
      nombre TEXT NOT NULL,
      descripcion TEXT
    );

    CREATE TABLE IF NOT EXISTS rol_permisos (
      rol_id INTEGER,
      permiso_id INTEGER,
      PRIMARY KEY (rol_id, permiso_id),
      FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permiso_id) REFERENCES permisos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      nombre_completo TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      rol_id INTEGER NOT NULL,
      email TEXT,
      telefono TEXT,
      activo INTEGER DEFAULT 1,
      primer_login INTEGER DEFAULT 1,
      ultimo_login TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (rol_id) REFERENCES roles(id)
    );

    CREATE TABLE IF NOT EXISTS sesiones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      token TEXT UNIQUE,
      inicio TEXT DEFAULT (datetime('now','localtime')),
      fin TEXT,
      ip_local TEXT,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS auditoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      usuario_nombre TEXT,
      accion TEXT,
      modulo TEXT,
      detalle TEXT,
      registro_afectado_id INTEGER,
      registro_afectado_tipo TEXT,
      ip_local TEXT,
      fecha TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS configuracion_modulos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      modulo TEXT UNIQUE,
      activo INTEGER DEFAULT 0,
      configurado_por INTEGER,
      fecha_cambio TEXT
    );
  `)

  // ─── Seeds ────────────────────────────────────────────────────────────────

  const planCount = queryOne('SELECT COUNT(*) as n FROM planes_catalogo')
  if (!planCount || planCount.n === 0) {
    db.run("INSERT INTO planes_catalogo (nombre, duracion_dias, precio, descripcion) VALUES (?, ?, ?, ?)", ['Mensual', 30, 150, 'Acceso completo por 1 mes'])
    db.run("INSERT INTO planes_catalogo (nombre, duracion_dias, precio, descripcion) VALUES (?, ?, ?, ?)", ['Trimestral', 90, 400, 'Acceso completo por 3 meses'])
    db.run("INSERT INTO planes_catalogo (nombre, duracion_dias, precio, descripcion) VALUES (?, ?, ?, ?)", ['Semestral', 180, 750, 'Acceso completo por 6 meses'])
    db.run("INSERT INTO planes_catalogo (nombre, duracion_dias, precio, descripcion) VALUES (?, ?, ?, ?)", ['Anual', 365, 1400, 'Acceso completo por 1 año'])
  }

  const adminRow = queryOne("SELECT value FROM config WHERE key='admin_password'")
  if (!adminRow) {
    db.run("INSERT INTO config (key, value) VALUES (?, ?)", ['admin_password', '1234'])
  }

  // Seed módulos (siempre asegurar que existan)
  const modulosSeed = [
    ['facturacion', 0], ['inventario', 0], ['caja', 1], ['ventas', 0], ['promociones', 0],
  ]
  for (const [modulo, activo] of modulosSeed) {
    db.run("INSERT OR IGNORE INTO configuracion_modulos (modulo, activo) VALUES (?, ?)", [modulo, activo])
  }

  // Seed roles, permisos y usuario admin (solo si es primera vez)
  const rolesCount = queryOne('SELECT COUNT(*) as n FROM roles')
  if (!rolesCount || rolesCount.n === 0) {
    // Roles base del sistema
    db.run("INSERT INTO roles (id, nombre, descripcion, es_sistema) VALUES (1, 'Administrador', 'Acceso total al sistema', 1)")
    db.run("INSERT INTO roles (id, nombre, descripcion, es_sistema) VALUES (2, 'Empleado', 'Recepcionista con acceso operativo', 1)")
    db.run("INSERT INTO roles (id, nombre, descripcion, es_sistema) VALUES (3, 'Cajero', 'Acceso a caja y ventas', 1)")

    // Catálogo completo de permisos
    const permisosSeed = [
      // dashboard
      ['dashboard.ver', 'dashboard', 'Ver Dashboard', 'Acceso al panel principal'],
      // clientes
      ['clientes.ver', 'clientes', 'Ver Clientes', 'Listar y buscar clientes'],
      ['clientes.crear', 'clientes', 'Crear Clientes', 'Registrar nuevos clientes'],
      ['clientes.editar', 'clientes', 'Editar Clientes', 'Modificar datos de clientes'],
      ['clientes.eliminar', 'clientes', 'Eliminar Clientes', 'Dar de baja clientes'],
      ['clientes.ver_factura', 'clientes', 'Ver Factura Cliente', 'Ver facturas del cliente'],
      ['clientes.editar_factura', 'clientes', 'Editar Factura Cliente', 'Editar datos de facturación del cliente'],
      // asistencia
      ['asistencia.registrar', 'asistencia', 'Registrar Asistencia', 'Registrar entrada de miembros'],
      ['asistencia.ver', 'asistencia', 'Ver Asistencia', 'Ver asistencias del día'],
      ['asistencia.ver_historial', 'asistencia', 'Ver Historial Asistencia', 'Historial completo de asistencias'],
      // membresias
      ['membresias.ver', 'membresias', 'Ver Membresías', 'Listar membresías'],
      ['membresias.crear_plan', 'membresias', 'Crear Plan', 'Crear planes de membresía'],
      ['membresias.editar_plan', 'membresias', 'Editar Plan', 'Editar planes de membresía'],
      ['membresias.eliminar_plan', 'membresias', 'Eliminar Plan', 'Eliminar planes de membresía'],
      ['membresias.asignar', 'membresias', 'Asignar Membresía', 'Asignar membresía a cliente'],
      ['membresias.renovar', 'membresias', 'Renovar Membresía', 'Renovar membresías vencidas'],
      ['membresias.cobrar', 'membresias', 'Cobrar Membresía', 'Registrar cobros de membresías'],
      ['membresias.pausar', 'membresias', 'Pausar Membresía', 'Pausar membresías activas'],
      ['membresias.aplicar_descuento', 'membresias', 'Aplicar Descuento', 'Aplicar descuentos en membresías'],
      // facturacion
      ['facturacion.ver', 'facturacion', 'Ver Facturación', 'Acceder al módulo de facturación'],
      ['facturacion.configurar', 'facturacion', 'Configurar SFE', 'Configurar facturación electrónica'],
      ['facturacion.emitir', 'facturacion', 'Emitir Factura', 'Emitir facturas electrónicas'],
      ['facturacion.anular', 'facturacion', 'Anular Factura', 'Anular facturas emitidas'],
      ['facturacion.ver_historial', 'facturacion', 'Ver Historial Facturas', 'Ver historial de facturas'],
      ['facturacion.descargar_pdf', 'facturacion', 'Descargar PDF', 'Descargar facturas en PDF'],
      ['facturacion.enviar_email', 'facturacion', 'Enviar Email', 'Enviar facturas por correo'],
      ['facturacion.activar_desactivar', 'facturacion', 'Activar/Desactivar Módulo', 'Activar o desactivar facturación'],
      // inventario
      ['inventario.ver', 'inventario', 'Ver Inventario', 'Acceder al inventario'],
      ['inventario.crear_producto', 'inventario', 'Crear Producto', 'Agregar productos al inventario'],
      ['inventario.editar_producto', 'inventario', 'Editar Producto', 'Modificar productos del inventario'],
      ['inventario.eliminar_producto', 'inventario', 'Eliminar Producto', 'Eliminar productos del inventario'],
      ['inventario.gestionar_categorias', 'inventario', 'Gestionar Categorías', 'Administrar categorías de productos'],
      ['inventario.gestionar_proveedores', 'inventario', 'Gestionar Proveedores', 'Administrar proveedores'],
      ['inventario.ajustar_stock', 'inventario', 'Ajustar Stock', 'Realizar ajustes de inventario'],
      ['inventario.activar_desactivar', 'inventario', 'Activar/Desactivar Módulo', 'Activar o desactivar inventario'],
      // ventas
      ['ventas.realizar', 'ventas', 'Realizar Venta', 'Registrar ventas'],
      ['ventas.ver', 'ventas', 'Ver Ventas', 'Ver registro de ventas'],
      ['ventas.anular', 'ventas', 'Anular Venta', 'Anular ventas registradas'],
      // caja
      ['caja.abrir', 'caja', 'Abrir Caja', 'Abrir sesión de caja'],
      ['caja.cerrar', 'caja', 'Cerrar Caja', 'Cerrar sesión de caja'],
      ['caja.ver', 'caja', 'Ver Caja', 'Ver estado de caja'],
      ['caja.ver_historial', 'caja', 'Ver Historial Caja', 'Ver historial de cajas'],
      // reportes
      ['reportes.ver', 'reportes', 'Ver Reportes', 'Acceder a reportes'],
      ['reportes.exportar', 'reportes', 'Exportar Reportes', 'Exportar reportes a archivo'],
      ['reportes.ventas', 'reportes', 'Reporte Ventas', 'Ver reporte de ventas'],
      ['reportes.inventario', 'reportes', 'Reporte Inventario', 'Ver reporte de inventario'],
      ['reportes.asistencia', 'reportes', 'Reporte Asistencia', 'Ver reporte de asistencias'],
      ['reportes.ingresos', 'reportes', 'Reporte Ingresos', 'Ver reporte de ingresos'],
      ['reportes.bajas', 'reportes', 'Reporte Bajas', 'Ver reporte de bajas'],
      // alertas
      ['alertas.ver', 'alertas', 'Ver Alertas', 'Ver alertas del sistema'],
      // ingresos
      ['ingresos.ver', 'ingresos', 'Ver Ingresos', 'Ver registro de ingresos'],
      ['ingresos.exportar', 'ingresos', 'Exportar Ingresos', 'Exportar registros de ingresos'],
      // papelera
      ['papelera.ver', 'papelera', 'Ver Papelera', 'Acceder a la papelera'],
      ['papelera.restaurar', 'papelera', 'Restaurar Elementos', 'Restaurar elementos eliminados'],
      ['papelera.eliminar_permanente', 'papelera', 'Eliminar Permanente', 'Eliminar definitivamente'],
      // configuracion
      ['configuracion.ver', 'configuracion', 'Ver Configuración', 'Acceder a configuración'],
      ['configuracion.editar_gym', 'configuracion', 'Editar Datos Gym', 'Editar datos del gimnasio'],
      ['configuracion.gestionar_usuarios', 'configuracion', 'Gestionar Usuarios', 'Administrar usuarios del sistema'],
      ['configuracion.gestionar_roles', 'configuracion', 'Gestionar Roles', 'Administrar roles y permisos'],
      ['configuracion.respaldos_crear', 'configuracion', 'Crear Respaldo', 'Crear respaldos de la base de datos'],
      ['configuracion.respaldos_restaurar', 'configuracion', 'Restaurar Respaldo', 'Restaurar desde respaldo'],
      ['configuracion.modulos_activar', 'configuracion', 'Activar Módulos', 'Activar/desactivar módulos del sistema'],
      // auditoria
      ['auditoria.ver', 'auditoria', 'Ver Auditoría', 'Acceder al registro de auditoría'],
    ]

    for (const [codigo, modulo, nombre, descripcion] of permisosSeed) {
      db.run("INSERT INTO permisos (codigo, modulo, nombre, descripcion) VALUES (?, ?, ?, ?)", [codigo, modulo, nombre, descripcion])
    }

    // Admin: todos los permisos
    const todosPermisos = queryAll("SELECT id FROM permisos")
    for (const p of todosPermisos) {
      db.run("INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id) VALUES (1, ?)", [p.id])
    }

    // Empleado: permisos operativos
    const empleadoPermisos = [
      'dashboard.ver', 'clientes.ver', 'clientes.crear', 'clientes.editar',
      'asistencia.registrar', 'asistencia.ver', 'membresias.ver', 'membresias.renovar', 'alertas.ver',
    ]
    for (const codigo of empleadoPermisos) {
      const p = queryOne("SELECT id FROM permisos WHERE codigo=?", [codigo])
      if (p) db.run("INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id) VALUES (2, ?)", [p.id])
    }

    // Cajero: permisos de caja
    const cajeroPermisos = [
      'clientes.ver', 'clientes.crear', 'asistencia.registrar',
      'membresias.ver', 'membresias.cobrar',
      'caja.abrir', 'caja.cerrar', 'caja.ver', 'facturacion.emitir',
    ]
    for (const codigo of cajeroPermisos) {
      const p = queryOne("SELECT id FROM permisos WHERE codigo=?", [codigo])
      if (p) db.run("INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id) VALUES (3, ?)", [p.id])
    }

    // Usuario admin por defecto
    const passwordHash = bcrypt.hashSync('admin123', 10)
    db.run(
      "INSERT INTO usuarios (username, nombre_completo, password_hash, rol_id, activo, primer_login) VALUES ('admin', 'Administrador del Sistema', ?, 1, 1, 1)",
      [passwordHash]
    )
  }

  // Garantizar los 3 roles base siempre existan (INSERT OR IGNORE es seguro si ya están)
  db.run("INSERT OR IGNORE INTO roles (id, nombre, descripcion, es_sistema) VALUES (1, 'Administrador', 'Acceso total al sistema', 1)")
  db.run("INSERT OR IGNORE INTO roles (id, nombre, descripcion, es_sistema) VALUES (2, 'Empleado', 'Recepcionista con acceso operativo', 1)")
  db.run("INSERT OR IGNORE INTO roles (id, nombre, descripcion, es_sistema) VALUES (3, 'Cajero', 'Acceso a caja y ventas', 1)")

  // ─── Migraciones de columnas extendidas en clientes ──────────────────────
  const colsExtra = ['direccion', 'genero', 'contacto_emergencia', 'telefono_emergencia', 'tipo_sangre', 'alergias', 'condiciones_medicas', 'notas']
  for (const col of colsExtra) {
    try { db.run(`ALTER TABLE clientes ADD COLUMN ${col} TEXT`) } catch (_) {}
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS notas_cliente (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL REFERENCES clientes(id),
      contenido TEXT NOT NULL,
      tipo TEXT DEFAULT 'general',
      usuario_id INTEGER,
      usuario_nombre TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `)

  // ─── Migraciones FASE 3 ───────────────────────────────────────────────────
  const clientesCols3 = ['codigo', 'extension_ci', 'profesion']
  for (const col of clientesCols3) {
    try { db.run(`ALTER TABLE clientes ADD COLUMN ${col} TEXT`) } catch (_) {}
  }

  const planesTxtCols = ['color', 'icono', 'caracteristicas', 'tag', 'imagen', 'updated_at']
  for (const col of planesTxtCols) {
    try { db.run(`ALTER TABLE planes_catalogo ADD COLUMN ${col} TEXT`) } catch (_) {}
  }
  const planesIntCols = ['orden', 'acceso_sauna', 'acceso_piscina', 'acceso_clases', 'acceso_pt']
  for (const col of planesIntCols) {
    try { db.run(`ALTER TABLE planes_catalogo ADD COLUMN ${col} INTEGER DEFAULT 0`) } catch (_) {}
  }
  try { db.run(`ALTER TABLE planes_catalogo ADD COLUMN visible_cliente INTEGER DEFAULT 1`) } catch (_) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS descuentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      tipo TEXT DEFAULT 'porcentaje',
      valor REAL,
      activo INTEGER DEFAULT 1,
      aplicable_a TEXT DEFAULT 'todos',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER,
      usuario_id INTEGER,
      tipo TEXT DEFAULT 'membresia',
      subtotal REAL,
      descuento_id INTEGER,
      descuento_valor REAL DEFAULT 0,
      total REAL,
      metodo_pago TEXT DEFAULT 'efectivo',
      metodo_pago_detalle TEXT,
      monto_recibido REAL,
      vuelto REAL DEFAULT 0,
      factura_id INTEGER,
      estado TEXT DEFAULT 'completada',
      notas TEXT,
      fecha TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (cliente_id) REFERENCES clientes(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );
    CREATE TABLE IF NOT EXISTS configuracion_pos (
      id INTEGER PRIMARY KEY,
      gym_nombre TEXT DEFAULT 'Urban Fitness Club',
      gym_direccion TEXT, gym_telefono TEXT, gym_email TEXT, gym_logo TEXT,
      qr_imagen TEXT, qr_banco TEXT, qr_cuenta TEXT, qr_descripcion TEXT,
      metodos_pago_activos TEXT DEFAULT 'efectivo,qr,tarjeta,transferencia,mixto',
      facturacion_activa INTEGER DEFAULT 0,
      descuento_maximo REAL DEFAULT 50,
      sonidos_activos INTEGER DEFAULT 0
    );
  `)

  // Seeds FASE 3
  const descuentosN = queryOne('SELECT COUNT(*) as n FROM descuentos')
  if (!descuentosN || descuentosN.n === 0) {
    for (const [nombre, tipo, valor] of [
      ['Cumpleaños del mes', 'porcentaje', 10],
      ['Pago anual', 'porcentaje', 15],
      ['Estudiante', 'porcentaje', 5],
      ['Familiar', 'porcentaje', 8],
      ['Personal médico', 'porcentaje', 10],
    ]) {
      db.run('INSERT INTO descuentos (nombre, tipo, valor, activo) VALUES (?,?,?,1)', [nombre, tipo, valor])
    }
  }

  const posConf = queryOne('SELECT id FROM configuracion_pos WHERE id=1')
  if (!posConf) {
    db.run("INSERT INTO configuracion_pos (id, gym_nombre) VALUES (1, 'Urban Fitness Club')")
  }

  // Update existing plan seeds with visual fields
  db.run(`UPDATE planes_catalogo SET caracteristicas='["Acceso completo al gym","Horario completo"]',color='oklch(0.74 0.13 250)',visible_cliente=1,orden=1 WHERE nombre='Mensual' AND (caracteristicas IS NULL OR caracteristicas='')`)
  db.run(`UPDATE planes_catalogo SET caracteristicas='["Todo del plan Mensual","Clases grupales","Descuento especial"]',color='oklch(0.82 0.14 75)',tag='POPULAR',visible_cliente=1,orden=2 WHERE nombre='Trimestral' AND (caracteristicas IS NULL OR caracteristicas='')`)
  db.run(`UPDATE planes_catalogo SET caracteristicas='["Todo del plan Trimestral","Evaluación física mensual","1 sesión PT"]',color='oklch(0.78 0.16 155)',visible_cliente=1,orden=3 WHERE nombre='Semestral' AND (caracteristicas IS NULL OR caracteristicas='')`)
  db.run(`UPDATE planes_catalogo SET caracteristicas='["Todo del plan Semestral","Entrenador personal","Clases VIP"]',color='oklch(0.66 0.22 25)',tag='RECOMENDADO',visible_cliente=1,orden=4 WHERE nombre='Anual' AND (caracteristicas IS NULL OR caracteristicas='')`)

  // ─── Migraciones FASE 4 ───────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS categorias_productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      color TEXT,
      activo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS proveedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      contacto TEXT,
      telefono TEXT,
      email TEXT,
      direccion TEXT,
      notas TEXT,
      activo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      codigo TEXT,
      descripcion TEXT,
      categoria_id INTEGER REFERENCES categorias_productos(id),
      proveedor_id INTEGER REFERENCES proveedores(id),
      precio_compra REAL DEFAULT 0,
      precio_venta REAL DEFAULT 0,
      stock INTEGER DEFAULT 0,
      stock_minimo INTEGER DEFAULT 5,
      unidad TEXT DEFAULT 'unidad',
      imagen TEXT,
      activo INTEGER DEFAULT 1,
      eliminado INTEGER DEFAULT 0,
      eliminado_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT
    );
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS movimientos_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      tipo TEXT NOT NULL,
      cantidad INTEGER NOT NULL,
      stock_anterior INTEGER,
      stock_nuevo INTEGER,
      motivo TEXT,
      usuario_id INTEGER,
      usuario_nombre TEXT,
      venta_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS detalle_ventas_productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER REFERENCES ventas(id),
      producto_id INTEGER REFERENCES productos(id),
      nombre_producto TEXT,
      cantidad INTEGER NOT NULL,
      precio_unitario REAL NOT NULL,
      subtotal REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS caja_sesiones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      usuario_nombre TEXT,
      fecha_apertura TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      monto_inicial REAL DEFAULT 0,
      fecha_cierre TEXT,
      monto_calculado REAL,
      monto_cierre REAL,
      diferencia REAL DEFAULT 0,
      estado TEXT DEFAULT 'abierta',
      notas_apertura TEXT,
      notas_cierre TEXT
    );
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS caja_movimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sesion_id INTEGER NOT NULL REFERENCES caja_sesiones(id),
      tipo TEXT NOT NULL,
      concepto TEXT NOT NULL,
      monto REAL NOT NULL,
      metodo_pago TEXT DEFAULT 'efectivo',
      referencia_id INTEGER,
      referencia_tipo TEXT,
      usuario_id INTEGER,
      usuario_nombre TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS caja_notas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sesion_id INTEGER NOT NULL REFERENCES caja_sesiones(id),
      texto TEXT NOT NULL,
      usuario_id INTEGER,
      usuario_nombre TEXT,
      fecha TEXT DEFAULT (datetime('now','localtime'))
    );
  `)

  // Seed categorías por defecto
  const catN = queryOne('SELECT COUNT(*) as n FROM categorias_productos')
  if (!catN || catN.n === 0) {
    for (const [nombre, color] of [
      ['Suplementos', 'oklch(0.74 0.13 250)'],
      ['Bebidas', 'oklch(0.78 0.16 155)'],
      ['Snacks', 'oklch(0.82 0.14 75)'],
      ['Ropa deportiva', 'oklch(0.66 0.22 25)'],
      ['Accesorios', 'oklch(0.80 0.12 200)'],
    ]) {
      db.run('INSERT INTO categorias_productos (nombre, color) VALUES (?,?)', [nombre, color])
    }
  }

  // Asegurar papelera y recibos en configuracion_modulos
  db.run("INSERT OR IGNORE INTO configuracion_modulos (modulo, activo) VALUES ('papelera', 1)")
  db.run("INSERT OR IGNORE INTO configuracion_modulos (modulo, activo) VALUES ('recibos', 1)")
  // Recibos debe estar activo por defecto (es función básica, no integración externa)
  db.run("UPDATE configuracion_modulos SET activo=1 WHERE modulo='recibos'")

  // ─── Columnas es_prueba (datos de prueba identificables) ─────────────────
  const tablasPrueba = [
    ['clientes', 'es_prueba BOOLEAN DEFAULT 0'],
    ['membresias', 'es_prueba BOOLEAN DEFAULT 0'],
    ['asistencias', 'es_prueba BOOLEAN DEFAULT 0'],
    ['pagos', 'es_prueba BOOLEAN DEFAULT 0'],
    ['ventas', 'es_prueba BOOLEAN DEFAULT 0'],
    ['productos', 'es_prueba BOOLEAN DEFAULT 0'],
    ['proveedores', 'es_prueba BOOLEAN DEFAULT 0'],
    ['caja_sesiones', 'es_prueba BOOLEAN DEFAULT 0'],
    ['movimientos_stock', 'es_prueba BOOLEAN DEFAULT 0'],
  ]
  for (const [tabla, col] of tablasPrueba) {
    try { db.run(`ALTER TABLE ${tabla} ADD COLUMN ${col}`) } catch (_) {}
  }

  // ─── Migración FASE 6A — sesion_caja_id en ventas ────────────────────────
  try { db.run('ALTER TABLE ventas ADD COLUMN sesion_caja_id INTEGER') } catch (_) {}

  // ─── Migración FASE 6H — columnas nuevas primero, luego seeds ────────────
  try { db.run('ALTER TABLE clientes ADD COLUMN facturador_habitual TEXT') } catch (_) {}
  try { db.run('ALTER TABLE categorias_productos ADD COLUMN imagen TEXT') } catch (_) {}

  // ─── Migración: columnas de usuarios (foto, carnet) ──────────────────────
  try { db.run('ALTER TABLE usuarios ADD COLUMN foto TEXT') } catch (_) {}
  try { db.run('ALTER TABLE usuarios ADD COLUMN carnet TEXT') } catch (_) {}
  try { db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_carnet ON usuarios(carnet) WHERE carnet IS NOT NULL') } catch (_) {}

  // ─── Migración v2: permisos correctos para Empleado y Cajero ─────────────
  const permV2Done = queryOne("SELECT value FROM config WHERE key='permisos_roles_v2'")
  if (!permV2Done) {
    try {
      const empleadoPermisos = [
        'dashboard.ver',
        'asistencia.registrar', 'asistencia.ver', 'asistencia.ver_historial',
        'clientes.ver', 'clientes.crear', 'clientes.editar',
        'membresias.ver', 'membresias.asignar', 'membresias.renovar', 'membresias.cobrar', 'membresias.aplicar_descuento',
        'ventas.realizar', 'ventas.ver',
        'inventario.ver', 'inventario.ajustar_stock',
        'caja.abrir', 'caja.cerrar', 'caja.ver', 'caja.ver_historial',
        'facturacion.ver', 'facturacion.emitir', 'facturacion.ver_historial', 'facturacion.descargar_pdf', 'facturacion.enviar_email',
        'alertas.ver',
      ]
      const cajeroPermisos = [
        'dashboard.ver',
        'asistencia.registrar',
        'clientes.ver',
        'membresias.ver',
        'ventas.realizar', 'ventas.ver',
        'caja.abrir', 'caja.cerrar', 'caja.ver',
        'facturacion.emitir',
      ]
      db.run('DELETE FROM rol_permisos WHERE rol_id=2')
      for (const c of empleadoPermisos) {
        const p = queryOne('SELECT id FROM permisos WHERE codigo=?', [c])
        if (p) db.run('INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id) VALUES (2, ?)', [p.id])
      }
      db.run('DELETE FROM rol_permisos WHERE rol_id=3')
      for (const c of cajeroPermisos) {
        const p = queryOne('SELECT id FROM permisos WHERE codigo=?', [c])
        if (p) db.run('INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id) VALUES (3, ?)', [p.id])
      }
      db.run("INSERT OR IGNORE INTO config (key, value) VALUES ('permisos_roles_v2', '1')")
    } catch (_) {}
  }

  // Asegurar que el admin siempre esté activo
  try { db.run("UPDATE usuarios SET activo=1 WHERE username='admin'") } catch (_) {}
  try { db.run("ALTER TABLE planes_catalogo ADD COLUMN tipo_plan TEXT DEFAULT 'individual'") } catch (_) {}
  try { db.run('ALTER TABLE planes_catalogo ADD COLUMN capacidad INTEGER DEFAULT 1') } catch (_) {}
  // Seeds de planes grupales (solo si no existen — DEBE ir DESPUÉS de los ALTER TABLE)
  const planesGrupalesExisten = queryOne("SELECT id FROM planes_catalogo WHERE tipo_plan IN ('pareja','familiar','grupal') LIMIT 1")
  if (!planesGrupalesExisten) {
    db.run(`INSERT OR IGNORE INTO planes_catalogo (nombre, duracion_dias, precio, descripcion, color, tipo_plan, capacidad, activo, visible_cliente, orden)
      VALUES ('Plan Pareja', 30, 250, '2 personas con el mismo vencimiento', 'oklch(0.80 0.12 200)', 'pareja', 2, 1, 1, 10)`)
    db.run(`INSERT OR IGNORE INTO planes_catalogo (nombre, duracion_dias, precio, descripcion, color, tipo_plan, capacidad, activo, visible_cliente, orden)
      VALUES ('Plan Familiar', 30, 350, 'Hasta 4 personas, mismo vencimiento', 'oklch(0.82 0.14 75)', 'familiar', 4, 1, 1, 11)`)
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS membresia_miembros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      membresia_id INTEGER NOT NULL REFERENCES membresias(id),
      cliente_id INTEGER NOT NULL REFERENCES clientes(id),
      es_titular INTEGER DEFAULT 0,
      fecha_agregado TEXT DEFAULT (datetime('now','localtime'))
    );
  `)

  saveDB()
  console.log('[DB] Initialized at', DB_PATH)
}

// ─── Clientes ─────────────────────────────────────────────────────────────────

const clientes = {
  getAll() {
    return queryAll(`
      SELECT c.*,
        (SELECT fecha_fin FROM membresias WHERE cliente_id=c.id ORDER BY fecha_fin DESC LIMIT 1) as vigencia,
        (SELECT estado FROM membresias WHERE cliente_id=c.id ORDER BY fecha_fin DESC LIMIT 1) as mem_estado
      FROM clientes c WHERE c.activo=1 ORDER BY c.nombre, c.apellido
    `)
  },
  getById(id) {
    return queryOne(`
      SELECT c.*,
        (SELECT fecha_fin FROM membresias WHERE cliente_id=c.id ORDER BY fecha_fin DESC LIMIT 1) as vigencia,
        (SELECT estado FROM membresias WHERE cliente_id=c.id ORDER BY fecha_fin DESC LIMIT 1) as mem_estado
      FROM clientes c WHERE c.id=?
    `, [id])
  },
  getByCarnet(carnet) {
    return queryOne('SELECT id, nombre, apellido, carnet, telefono, email FROM clientes WHERE carnet=? AND activo=1', [carnet])
  },
  search(query) {
    const q = `%${query}%`
    return queryAll(`
      SELECT c.*,
        (SELECT fecha_fin FROM membresias WHERE cliente_id=c.id ORDER BY fecha_fin DESC LIMIT 1) as vigencia,
        (SELECT estado FROM membresias WHERE cliente_id=c.id ORDER BY fecha_fin DESC LIMIT 1) as mem_estado
      FROM clientes c
      WHERE c.activo=1 AND (c.carnet LIKE ? OR c.nombre LIKE ? OR c.apellido LIKE ? OR c.telefono LIKE ?)
      ORDER BY c.nombre, c.apellido LIMIT 50
    `, [q, q, q, q])
  },
  create(data) {
    if (data.carnet) {
      const existente = queryOne('SELECT id FROM clientes WHERE carnet=?', [data.carnet])
      if (existente) return clientes.getById(existente.id)
    }
    const r = run(
      'INSERT INTO clientes (carnet, nombre, apellido, telefono, email, fecha_nacimiento, foto_path) VALUES (?,?,?,?,?,?,?)',
      [data.carnet, data.nombre, data.apellido, data.telefono || null, data.email || null, data.fecha_nacimiento || null, data.foto_path || null]
    )
    return clientes.getById(r.lastInsertRowid)
  },
  update(id, data) {
    run(
      'UPDATE clientes SET carnet=?, nombre=?, apellido=?, telefono=?, email=?, fecha_nacimiento=?, foto_path=? WHERE id=?',
      [data.carnet, data.nombre, data.apellido, data.telefono || null, data.email || null, data.fecha_nacimiento || null, data.foto_path || null, id]
    )
    return clientes.getById(id)
  },
  delete(id) {
    run('UPDATE clientes SET activo=0 WHERE id=?', [id])
    return { ok: true }
  },
  getNextCodigo() {
    const last = queryOne("SELECT codigo FROM clientes WHERE codigo IS NOT NULL AND codigo!='' ORDER BY id DESC LIMIT 1")
    if (!last || !last.codigo) return 'UFC0001'
    const num = parseInt(last.codigo.replace('UFC', '')) + 1
    return 'UFC' + String(num).padStart(4, '0')
  },
  createCompleto(data) {
    const existente = queryOne('SELECT id FROM clientes WHERE carnet=?', [data.carnet])
    if (existente) return clientes.getById(existente.id)
    const codigo = clientes.getNextCodigo()
    const r = run(
      `INSERT INTO clientes (carnet, nombre, apellido, telefono, email, fecha_nacimiento, foto_path,
       genero, direccion, contacto_emergencia, telefono_emergencia, profesion, codigo, extension_ci, activo)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
      [data.carnet, data.nombre, data.apellido, data.telefono || null, data.email || null,
       data.fecha_nacimiento || null, data.foto_path || null,
       data.genero || null, data.direccion || null,
       data.contacto_emergencia || null, data.telefono_emergencia || null,
       data.profesion || null, codigo, data.extension_ci || 'LP']
    )
    return clientes.getById(r.lastInsertRowid)
  },
  checkCarnetExiste(carnet, excludeId = null) {
    if (excludeId) {
      return !!queryOne('SELECT id FROM clientes WHERE carnet=? AND id!=? AND activo=1', [carnet, excludeId])
    }
    return !!queryOne('SELECT id FROM clientes WHERE carnet=? AND activo=1', [carnet])
  },
  buscarPOS(query) {
    const q = `%${query}%`
    return queryAll(`
      SELECT c.*,
        m.id as mem_id, m.fecha_inicio as mem_inicio, m.fecha_fin, m.estado as mem_estado, m.plan_id,
        p.nombre as plan_nombre, p.precio as plan_precio, p.color as plan_color,
        p.duracion_dias, p.caracteristicas as plan_caracteristicas,
        CAST(julianday(m.fecha_fin) - julianday('now','localtime') AS INTEGER) as dias_restantes
      FROM clientes c
      LEFT JOIN membresias m ON m.id=(SELECT id FROM membresias WHERE cliente_id=c.id ORDER BY fecha_fin DESC LIMIT 1)
      LEFT JOIN planes_catalogo p ON m.plan_id=p.id
      WHERE c.activo=1 AND (c.carnet LIKE ? OR c.nombre LIKE ? OR c.apellido LIKE ? OR c.codigo LIKE ? OR c.telefono LIKE ?)
      ORDER BY c.nombre, c.apellido LIMIT 10
    `, [q, q, q, q, q])
  },
  buscarPOSById(id) {
    return queryOne(`
      SELECT c.*,
        m.id as mem_id, m.fecha_inicio as mem_inicio, m.fecha_fin, m.estado as mem_estado, m.plan_id,
        p.nombre as plan_nombre, p.precio as plan_precio, p.color as plan_color,
        p.duracion_dias, p.caracteristicas as plan_caracteristicas,
        CAST(julianday(m.fecha_fin) - julianday('now','localtime') AS INTEGER) as dias_restantes
      FROM clientes c
      LEFT JOIN membresias m ON m.id=(SELECT id FROM membresias WHERE cliente_id=c.id ORDER BY fecha_fin DESC LIMIT 1)
      LEFT JOIN planes_catalogo p ON m.plan_id=p.id
      WHERE c.id=?
    `, [id])
  },
  getPaginated(filtros = {}) {
    const page = Math.max(1, filtros.page || 1)
    const pageSize = filtros.pageSize || 10
    const offset = (page - 1) * pageSize
    const baseFields = `
      SELECT c.*,
        (SELECT fecha_fin FROM membresias WHERE cliente_id=c.id ORDER BY fecha_fin DESC LIMIT 1) as vigencia,
        (SELECT estado FROM membresias WHERE cliente_id=c.id ORDER BY fecha_fin DESC LIMIT 1) as mem_estado
      FROM clientes c WHERE c.activo=1`
    const params = []
    let where = ''
    if (filtros.busqueda) {
      const q = `%${filtros.busqueda}%`
      where = ' AND (c.carnet LIKE ? OR c.nombre LIKE ? OR c.apellido LIKE ? OR c.telefono LIKE ?)'
      params.push(q, q, q, q)
    }
    if (filtros.estado === 'activos') {
      where += ` AND EXISTS (SELECT 1 FROM membresias WHERE cliente_id=c.id AND estado='activa' AND date(fecha_fin)>=date('now','localtime'))`
    } else if (filtros.estado === 'vencidos') {
      where += ` AND NOT EXISTS (SELECT 1 FROM membresias WHERE cliente_id=c.id AND estado='activa' AND date(fecha_fin)>=date('now','localtime'))`
    } else if (filtros.estado === 'por_vencer') {
      where += ` AND EXISTS (SELECT 1 FROM membresias WHERE cliente_id=c.id AND estado='activa' AND date(fecha_fin)>=date('now','localtime') AND CAST(julianday(fecha_fin)-julianday('now','localtime') AS INTEGER)<=7)`
    }
    const totalRow = queryOne(`SELECT COUNT(*) as n FROM clientes c WHERE c.activo=1${where}`, params)
    const total = totalRow ? totalRow.n : 0
    const data = queryAll(`${baseFields}${where} ORDER BY c.nombre, c.apellido LIMIT ? OFFSET ?`, [...params, pageSize, offset])
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  },

  getFacturadorHabitual(clienteId) {
    const row = queryOne('SELECT facturador_habitual FROM clientes WHERE id=?', [clienteId])
    if (!row || !row.facturador_habitual) return null
    try { return JSON.parse(row.facturador_habitual) } catch { return null }
  },

  setFacturadorHabitual(clienteId, data) {
    run('UPDATE clientes SET facturador_habitual=? WHERE id=?', [data ? JSON.stringify(data) : null, clienteId])
    return { ok: true }
  },
}

// ─── Planes ───────────────────────────────────────────────────────────────────

const planes = {
  getAll() { return queryAll('SELECT * FROM planes_catalogo ORDER BY COALESCE(orden,0), duracion_dias') },
  getActive() { return queryAll('SELECT * FROM planes_catalogo WHERE activo=1 ORDER BY COALESCE(orden,0), duracion_dias') },
  getWithClientCount() {
    return queryAll(`
      SELECT p.*,
        (SELECT COUNT(*) FROM membresias WHERE plan_id=p.id AND estado='activa' AND date(fecha_fin)>=date('now','localtime')) as clientes_activos
      FROM planes_catalogo p ORDER BY COALESCE(p.orden,0), p.duracion_dias
    `)
  },
  create(data) {
    const caract = Array.isArray(data.caracteristicas) ? JSON.stringify(data.caracteristicas) : (data.caracteristicas || null)
    const r = run(
      `INSERT INTO planes_catalogo (nombre, duracion_dias, precio, descripcion, color, icono, caracteristicas, tag, orden, acceso_sauna, acceso_piscina, acceso_clases, acceso_pt, visible_cliente, activo, tipo_plan, capacidad)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`,
      [data.nombre, data.duracion_dias, data.precio, data.descripcion || null,
       data.color || null, data.icono || null, caract, data.tag || null,
       data.orden || 0, data.acceso_sauna ? 1 : 0, data.acceso_piscina ? 1 : 0,
       data.acceso_clases ? 1 : 0, data.acceso_pt ? 1 : 0,
       data.visible_cliente !== false ? 1 : 0,
       data.tipo_plan || 'individual', data.capacidad || 1]
    )
    return { id: r.lastInsertRowid, ...data }
  },
  update(id, data) {
    const caract = Array.isArray(data.caracteristicas) ? JSON.stringify(data.caracteristicas) : (data.caracteristicas || null)
    run(
      `UPDATE planes_catalogo SET nombre=?, duracion_dias=?, precio=?, descripcion=?, activo=?,
       color=?, icono=?, caracteristicas=?, tag=?, orden=?,
       acceso_sauna=?, acceso_piscina=?, acceso_clases=?, acceso_pt=?, visible_cliente=?,
       tipo_plan=?, capacidad=?,
       updated_at=datetime('now','localtime') WHERE id=?`,
      [data.nombre, data.duracion_dias, data.precio, data.descripcion || null, data.activo ?? 1,
       data.color || null, data.icono || null, caract, data.tag || null, data.orden || 0,
       data.acceso_sauna ? 1 : 0, data.acceso_piscina ? 1 : 0,
       data.acceso_clases ? 1 : 0, data.acceso_pt ? 1 : 0,
       data.visible_cliente !== false ? 1 : 0,
       data.tipo_plan || 'individual', data.capacidad || 1,
       id]
    )
    return { ok: true }
  },
  delete(id) {
    run('UPDATE planes_catalogo SET activo=0 WHERE id=?', [id])
    return { ok: true }
  }
}

// ─── Membresias ───────────────────────────────────────────────────────────────

const membresias = {
  getByCliente(clienteId) {
    return queryAll(`
      SELECT m.*, p.nombre as plan_nombre, p.duracion_dias
      FROM membresias m JOIN planes_catalogo p ON m.plan_id=p.id
      WHERE m.cliente_id=? ORDER BY m.fecha_fin DESC
    `, [clienteId])
  },
  getActiva(clienteId) {
    return queryOne(`
      SELECT m.*, p.nombre as plan_nombre, p.duracion_dias, p.precio
      FROM membresias m JOIN planes_catalogo p ON m.plan_id=p.id
      WHERE m.cliente_id=? AND m.estado='activa' AND date(m.fecha_fin) >= date('now','localtime')
      ORDER BY m.fecha_fin DESC LIMIT 1
    `, [clienteId])
  },
  create(data) {
    const r = run(
      "INSERT INTO membresias (cliente_id, plan_id, fecha_inicio, fecha_fin, monto_pagado, estado) VALUES (?,?,?,?,?,'activa')",
      [data.cliente_id, data.plan_id, data.fecha_inicio, data.fecha_fin, data.monto_pagado]
    )
    const memId = r.lastInsertRowid
    run(
      'INSERT INTO pagos (cliente_id, membresia_id, monto, metodo, concepto) VALUES (?,?,?,?,?)',
      [data.cliente_id, memId, data.monto_pagado, data.metodo || 'efectivo', `Membresía - Plan ${data.plan_nombre || ''}`]
    )
    return { id: memId }
  },
  renovar(id, data) {
    run(
      'UPDATE membresias SET fecha_inicio=?, fecha_fin=?, monto_pagado=?, estado=? WHERE id=?',
      [data.fecha_inicio, data.fecha_fin, data.monto_pagado, data.estado || 'activa', id]
    )
    return { ok: true }
  },
  getVencidas() {
    return queryAll(`
      SELECT m.*, c.nombre, c.apellido, c.carnet, c.telefono, p.nombre as plan_nombre
      FROM membresias m
      JOIN clientes c ON m.cliente_id=c.id
      JOIN planes_catalogo p ON m.plan_id=p.id
      WHERE m.estado='activa' AND date(m.fecha_fin) < date('now','localtime')
      AND c.activo=1 ORDER BY m.fecha_fin DESC
    `)
  },
  getPorVencer() {
    return queryAll(`
      SELECT m.*, c.nombre, c.apellido, c.carnet, c.telefono, p.nombre as plan_nombre,
        CAST(julianday(m.fecha_fin) - julianday('now','localtime') AS INTEGER) as dias_restantes
      FROM membresias m
      JOIN clientes c ON m.cliente_id=c.id
      JOIN planes_catalogo p ON m.plan_id=p.id
      WHERE m.estado='activa'
        AND date(m.fecha_fin) >= date('now','localtime')
        AND CAST(julianday(m.fecha_fin) - julianday('now','localtime') AS INTEGER) <= 5
      AND c.activo=1 ORDER BY dias_restantes ASC
    `)
  }
}

// ─── Membresía Miembros (grupales/familiares) ─────────────────────────────────

const membresiaMiembros = {
  getMiembros(membresiaId) {
    return queryAll(`
      SELECT mm.*, c.nombre, c.apellido, c.carnet, c.codigo
      FROM membresia_miembros mm
      JOIN clientes c ON mm.cliente_id = c.id
      WHERE mm.membresia_id = ?
      ORDER BY mm.es_titular DESC, c.nombre
    `, [membresiaId])
  },

  addMiembro(membresiaId, clienteId, esTitular = 0) {
    const existe = queryOne('SELECT id FROM membresia_miembros WHERE membresia_id=? AND cliente_id=?', [membresiaId, clienteId])
    if (existe) return { ok: false, error: 'El cliente ya es miembro' }
    run('INSERT INTO membresia_miembros (membresia_id, cliente_id, es_titular) VALUES (?,?,?)', [membresiaId, clienteId, esTitular ? 1 : 0])
    return { ok: true }
  },

  removeMiembro(membresiaId, clienteId) {
    run('DELETE FROM membresia_miembros WHERE membresia_id=? AND cliente_id=?', [membresiaId, clienteId])
    return { ok: true }
  },

  getMembresiaDeCliente(clienteId) {
    return queryOne(`
      SELECT mm.membresia_id, mm.es_titular, m.*, p.nombre as plan_nombre, p.tipo_plan, p.capacidad
      FROM membresia_miembros mm
      JOIN membresias m ON mm.membresia_id = m.id
      JOIN planes_catalogo p ON m.plan_id = p.id
      WHERE mm.cliente_id = ? AND m.estado = 'activa' AND date(m.fecha_fin) >= date('now','localtime')
      LIMIT 1
    `, [clienteId])
  },

  sincronizarTitular(membresiaId, clienteId) {
    const membresia = queryOne('SELECT * FROM membresias WHERE id=?', [membresiaId])
    if (!membresia) return { ok: false, error: 'Membresía no encontrada' }
    const existe = queryOne('SELECT id FROM membresia_miembros WHERE membresia_id=? AND cliente_id=?', [membresiaId, clienteId])
    if (!existe) {
      run('INSERT INTO membresia_miembros (membresia_id, cliente_id, es_titular) VALUES (?,?,1)', [membresiaId, clienteId])
    } else {
      run('UPDATE membresia_miembros SET es_titular=1 WHERE membresia_id=? AND cliente_id=?', [membresiaId, clienteId])
    }
    return { ok: true }
  },
}

// ─── Asistencias ──────────────────────────────────────────────────────────────

const asistencias = {
  registrar(carnet) {
    const cliente = queryOne(`
      SELECT c.*,
        (SELECT fecha_fin FROM membresias WHERE cliente_id=c.id AND estado='activa' ORDER BY fecha_fin DESC LIMIT 1) as vigencia,
        (SELECT id FROM membresias WHERE cliente_id=c.id AND estado='activa' AND date(fecha_fin) >= date('now','localtime') ORDER BY fecha_fin DESC LIMIT 1) as mem_activa_id,
        (SELECT nombre FROM planes_catalogo WHERE id=(SELECT plan_id FROM membresias WHERE cliente_id=c.id AND estado='activa' ORDER BY fecha_fin DESC LIMIT 1)) as plan_nombre
      FROM clientes c WHERE c.carnet=? AND c.activo=1
    `, [carnet])

    if (!cliente) return { error: 'no_encontrado', message: 'Carnet no registrado' }
    const tieneMembresia = !!cliente.mem_activa_id
    if (tieneMembresia) run('INSERT INTO asistencias (cliente_id) VALUES (?)', [cliente.id])
    const hoy = queryOne(
      "SELECT COUNT(*) as n FROM asistencias WHERE cliente_id=? AND date(fecha_hora)=date('now','localtime')",
      [cliente.id]
    )
    return { ok: true, cliente, tieneMembresia, visitasHoy: hoy ? hoy.n : 0, warning: !tieneMembresia ? 'sin_membresia' : null }
  },
  getByCliente(clienteId) {
    return queryAll('SELECT * FROM asistencias WHERE cliente_id=? ORDER BY fecha_hora DESC LIMIT 100', [clienteId])
  },
  getHoy() {
    return queryAll(`
      SELECT a.*, c.nombre, c.apellido, c.carnet
      FROM asistencias a JOIN clientes c ON a.cliente_id=c.id
      WHERE date(a.fecha_hora)=date('now','localtime')
      ORDER BY a.fecha_hora DESC
    `)
  },
  registrarById(clienteId) {
    run('INSERT INTO asistencias (cliente_id) VALUES (?)', [clienteId])
    const hoy = queryOne(
      "SELECT COUNT(*) as n FROM asistencias WHERE cliente_id=? AND date(fecha_hora)=date('now','localtime')",
      [clienteId]
    )
    return { ok: true, visitasHoy: hoy ? hoy.n : 0 }
  }
}

// ─── Pagos ────────────────────────────────────────────────────────────────────

const pagos = {
  getByCliente(clienteId) {
    return queryAll('SELECT * FROM pagos WHERE cliente_id=? ORDER BY fecha DESC', [clienteId])
  },
  getAll() {
    return queryAll(`
      SELECT p.*, c.nombre, c.apellido, c.carnet
      FROM pagos p JOIN clientes c ON p.cliente_id=c.id
      ORDER BY p.fecha DESC LIMIT 200
    `)
  },
  create(data) {
    const r = run(
      'INSERT INTO pagos (cliente_id, membresia_id, monto, metodo, concepto) VALUES (?,?,?,?,?)',
      [data.cliente_id, data.membresia_id || null, data.monto, data.metodo || 'efectivo', data.concepto || null]
    )
    return { id: r.lastInsertRowid }
  }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

const dashboard = {
  stats() {
    const totalClientes = queryOne('SELECT COUNT(*) as n FROM clientes WHERE activo=1').n
    const memActivas = queryOne("SELECT COUNT(*) as n FROM membresias WHERE estado='activa' AND date(fecha_fin)>=date('now','localtime')").n
    const asistenciasHoy = queryOne("SELECT COUNT(*) as n FROM asistencias WHERE date(fecha_hora)=date('now','localtime')").n
    // Use ventas table (estado=completada) so it matches the Ventas page KPIs
    const ingRow = queryOne("SELECT COALESCE(SUM(total),0) as total FROM ventas WHERE estado='completada' AND strftime('%Y-%m',fecha)=strftime('%Y-%m','now','localtime')")
    const ingresosMes = ingRow ? ingRow.total : 0
    const porVencer = queryOne(`SELECT COUNT(*) as n FROM membresias WHERE estado='activa' AND date(fecha_fin)>=date('now','localtime') AND CAST(julianday(fecha_fin)-julianday('now','localtime') AS INTEGER)<=5`).n
    const vencidas = queryOne("SELECT COUNT(*) as n FROM membresias WHERE estado='activa' AND date(fecha_fin)<date('now','localtime')").n
    return { totalClientes, memActivas, asistenciasHoy, ingresosMes, porVencer, vencidas }
  },
  ingresosMes() {
    return queryAll(`
      SELECT strftime('%Y-%m', fecha) as mes, SUM(total) as total, COUNT(*) as pagos
      FROM ventas WHERE estado='completada' AND fecha >= datetime('now','localtime','-6 months')
      GROUP BY mes ORDER BY mes DESC LIMIT 6
    `)
  }
}

// ─── Auth (legacy) ────────────────────────────────────────────────────────────

const auth = {
  checkAdmin(password) {
    const row = queryOne("SELECT value FROM config WHERE key='admin_password'")
    return { ok: row && row.value === password }
  },
  setAdmin(password) {
    run("UPDATE config SET value=? WHERE key='admin_password'", [password])
    return { ok: true }
  }
}

// ─── Usuarios ─────────────────────────────────────────────────────────────────

const usuarios = {
  getAll() {
    return queryAll(`
      SELECT u.id, u.username, u.nombre_completo, u.email, u.telefono,
        u.activo, u.primer_login, u.ultimo_login, u.created_at, u.rol_id,
        u.foto, u.carnet, COALESCE(r.nombre, 'Sin rol') as rol_nombre
      FROM usuarios u
      LEFT JOIN roles r ON u.rol_id = r.id
      ORDER BY u.nombre_completo
    `)
  },
  getById(id) {
    return queryOne(`
      SELECT u.id, u.username, u.nombre_completo, u.email, u.telefono,
        u.activo, u.primer_login, u.ultimo_login, u.created_at, u.rol_id,
        u.foto, u.carnet, COALESCE(r.nombre, 'Sin rol') as rol_nombre
      FROM usuarios u LEFT JOIN roles r ON u.rol_id = r.id WHERE u.id=?
    `, [id])
  },
  create(data) {
    const hash = bcrypt.hashSync(data.password, 10)
    const r = run(
      "INSERT INTO usuarios (username, nombre_completo, password_hash, rol_id, email, telefono, activo, primer_login, foto, carnet) VALUES (?,?,?,?,?,?,?,1,?,?)",
      [data.username, data.nombre_completo, hash, data.rol_id, data.email || null, data.telefono || null, data.activo ?? 1, data.foto || null, data.carnet || null]
    )
    return usuarios.getById(r.lastInsertRowid)
  },
  update(id, data) {
    // No se puede desactivar al admin
    if (data.activo === 0) {
      const u = queryOne("SELECT username FROM usuarios WHERE id=?", [id])
      if (u?.username === 'admin') data = { ...data, activo: 1 }
    }
    run(
      "UPDATE usuarios SET username=?, nombre_completo=?, rol_id=?, email=?, telefono=?, activo=?, foto=?, carnet=?, updated_at=datetime('now','localtime') WHERE id=?",
      [data.username, data.nombre_completo, data.rol_id, data.email || null, data.telefono || null, data.activo ?? 1, data.foto || null, data.carnet || null, id]
    )
    return usuarios.getById(id)
  },
  setActivo(id, activo) {
    // Admin siempre debe permanecer activo
    const u = queryOne("SELECT username FROM usuarios WHERE id=?", [id])
    if (u?.username === 'admin') return { ok: false, error: 'El administrador no puede desactivarse' }
    run("UPDATE usuarios SET activo=?, updated_at=datetime('now','localtime') WHERE id=?", [activo ? 1 : 0, id])
    return { ok: true }
  },
  registrar(data) {
    if (!data.carnet) return { ok: false, error: 'El carnet es obligatorio para registrarse' }
    if (!data.password) return { ok: false, error: 'La contraseña es obligatoria' }

    // Carnet único
    const existe = queryOne("SELECT id FROM usuarios WHERE TRIM(carnet)=TRIM(?)", [data.carnet])
    if (existe) return { ok: false, error: 'Ya existe un usuario con ese carnet' }

    // Username único (el carnet se usa como username)
    const existeUser = queryOne("SELECT id FROM usuarios WHERE username=?", [data.carnet.trim()])
    if (existeUser) return { ok: false, error: 'Ya existe un usuario con ese carnet' }

    // Obtener rol Cajero dinámicamente (fallback a 3 si no se encuentra)
    const rolCajero = queryOne("SELECT id FROM roles WHERE LOWER(nombre)='cajero' LIMIT 1")
    const rolId = rolCajero?.id || 3

    const hash = bcrypt.hashSync(data.password, 10)
    const r = run(
      "INSERT INTO usuarios (username, nombre_completo, password_hash, rol_id, telefono, activo, primer_login, carnet) VALUES (?,?,?,?,?,1,0,?)",
      [data.carnet.trim(), data.nombre_completo.trim(), hash, rolId, data.telefono || null, data.carnet.trim()]
    )

    // Guardado explícito a disco (run() ya lo hace, pero lo repetimos por seguridad)
    saveDB()

    const nuevo = usuarios.getById(r.lastInsertRowid)
    return { ok: true, id: r.lastInsertRowid, usuario: nuevo }
  },
  cambiarPasswordPorCarnet(carnet, nuevaPassword) {
    const u = queryOne("SELECT id, nombre_completo FROM usuarios WHERE TRIM(carnet)=TRIM(?)", [carnet])
    if (!u) return { ok: false, error: 'No se encontró ningún usuario con ese carnet' }
    const hash = bcrypt.hashSync(nuevaPassword, 10)
    run("UPDATE usuarios SET password_hash=?, primer_login=0, updated_at=datetime('now','localtime') WHERE id=?", [hash, u.id])
    return { ok: true, nombre: u.nombre_completo }
  },
  cambiarPassword(id, nuevaPassword) {
    const hash = bcrypt.hashSync(nuevaPassword, 10)
    run(
      "UPDATE usuarios SET password_hash=?, primer_login=0, updated_at=datetime('now','localtime') WHERE id=?",
      [hash, id]
    )
    return { ok: true }
  },
  verificarPassword(id, password) {
    const u = queryOne("SELECT password_hash FROM usuarios WHERE id=?", [id])
    if (!u) return false
    return bcrypt.compareSync(password, u.password_hash)
  },
  delete(id) {
    // No eliminar el admin principal (id=1)
    const u = queryOne("SELECT username FROM usuarios WHERE id=?", [id])
    if (u && u.username === 'admin') return { ok: false, error: 'No se puede eliminar el administrador principal' }
    run("DELETE FROM usuarios WHERE id=?", [id])
    return { ok: true }
  },
  login(username, password) {
    const busqueda = String(username || '').trim().toLowerCase()
    const u = queryOne(`
      SELECT u.id, u.username, u.nombre_completo, u.password_hash,
        u.activo, u.primer_login, u.rol_id, u.foto,
        COALESCE(r.nombre, 'Sin rol') as rol_nombre
      FROM usuarios u LEFT JOIN roles r ON u.rol_id = r.id
      WHERE TRIM(LOWER(u.username))=?
         OR TRIM(LOWER(u.nombre_completo))=?
         OR (u.carnet IS NOT NULL AND TRIM(CAST(u.carnet AS TEXT))=TRIM(CAST(? AS TEXT)))
    `, [busqueda, busqueda, busqueda])

    if (!u) return { ok: false, error: 'Usuario no encontrado' }
    if (!u.activo) return { ok: false, error: 'Usuario desactivado' }
    if (!bcrypt.compareSync(password, u.password_hash)) return { ok: false, error: 'Contraseña incorrecta' }

    // Cargar permisos del rol
    const permisosList = queryAll(`
      SELECT p.codigo FROM permisos p
      JOIN rol_permisos rp ON p.id = rp.permiso_id
      WHERE rp.rol_id = ?
    `, [u.rol_id])

    const permisosArray = permisosList.map(p => p.codigo)

    // Actualizar último login
    run("UPDATE usuarios SET ultimo_login=datetime('now','localtime') WHERE id=?", [u.id])

    // Crear sesión
    const token = crypto.randomBytes(32).toString('hex')
    run(
      "INSERT INTO sesiones (usuario_id, token, inicio) VALUES (?, ?, datetime('now','localtime'))",
      [u.id, token]
    )

    return {
      ok: true,
      token,
      primer_login: u.primer_login === 1,
      usuario: {
        id: u.id,
        username: u.username,
        nombre_completo: u.nombre_completo,
        rol_id: u.rol_id,
        rol_nombre: u.rol_nombre,
        primer_login: u.primer_login === 1,
        foto: u.foto || null,
        permisos: permisosArray,
      }
    }
  }
}

// ─── Sesiones ─────────────────────────────────────────────────────────────────

const sesiones = {
  verificar(token) {
    if (!token) return null
    const sesion = queryOne(`
      SELECT s.usuario_id, s.token, s.fin,
        u.username, u.nombre_completo, u.activo, u.primer_login, u.rol_id, u.foto,
        COALESCE(r.nombre, 'Sin rol') as rol_nombre
      FROM sesiones s
      JOIN usuarios u ON s.usuario_id = u.id
      LEFT JOIN roles r ON u.rol_id = r.id
      WHERE s.token=? AND s.fin IS NULL
    `, [token])

    if (!sesion) return null
    if (!sesion.activo) return null

    const permisosList = queryAll(`
      SELECT p.codigo FROM permisos p
      JOIN rol_permisos rp ON p.id = rp.permiso_id
      WHERE rp.rol_id = ?
    `, [sesion.rol_id])

    return {
      id: sesion.usuario_id,
      username: sesion.username,
      nombre_completo: sesion.nombre_completo,
      rol_id: sesion.rol_id,
      rol_nombre: sesion.rol_nombre,
      primer_login: sesion.primer_login === 1,
      foto: sesion.foto || null,
      permisos: permisosList.map(p => p.codigo),
    }
  },
  cerrar(token) {
    if (!token) return { ok: false }
    run("UPDATE sesiones SET fin=datetime('now','localtime') WHERE token=?", [token])
    return { ok: true }
  }
}

// ─── Roles ────────────────────────────────────────────────────────────────────

const roles = {
  getAll() {
    return queryAll(`
      SELECT r.*, COUNT(u.id) as total_usuarios
      FROM roles r LEFT JOIN usuarios u ON r.id = u.rol_id AND u.activo=1
      GROUP BY r.id ORDER BY r.id
    `)
  },
  getById(id) {
    return queryOne("SELECT * FROM roles WHERE id=?", [id])
  },
  create(data) {
    const r = run(
      "INSERT INTO roles (nombre, descripcion, es_sistema) VALUES (?,?,0)",
      [data.nombre, data.descripcion || null]
    )
    return roles.getById(r.lastInsertRowid)
  },
  update(id, data) {
    const rol = queryOne("SELECT es_sistema FROM roles WHERE id=?", [id])
    if (rol && rol.es_sistema) {
      // Solo actualizar descripción en roles del sistema
      run("UPDATE roles SET descripcion=?, updated_at=datetime('now','localtime') WHERE id=?", [data.descripcion || null, id])
    } else {
      run(
        "UPDATE roles SET nombre=?, descripcion=?, updated_at=datetime('now','localtime') WHERE id=?",
        [data.nombre, data.descripcion || null, id]
      )
    }
    return { ok: true }
  },
  delete(id) {
    const rol = queryOne("SELECT es_sistema, nombre FROM roles WHERE id=?", [id])
    if (!rol) return { ok: false, error: 'Rol no encontrado' }
    if (rol.es_sistema) return { ok: false, error: 'No se puede eliminar un rol del sistema' }
    const usuariosConRol = queryOne("SELECT COUNT(*) as n FROM usuarios WHERE rol_id=?", [id])
    if (usuariosConRol && usuariosConRol.n > 0) return { ok: false, error: 'El rol tiene usuarios asignados' }
    run("DELETE FROM roles WHERE id=?", [id])
    return { ok: true }
  },
  getPermisos(rolId) {
    return queryAll(`
      SELECT p.id, p.codigo, p.modulo, p.nombre, p.descripcion,
        CASE WHEN rp.rol_id IS NOT NULL THEN 1 ELSE 0 END as asignado
      FROM permisos p
      LEFT JOIN rol_permisos rp ON p.id=rp.permiso_id AND rp.rol_id=?
      ORDER BY p.modulo, p.nombre
    `, [rolId])
  },
  setPermisos(rolId, permisoIds) {
    db.run("DELETE FROM rol_permisos WHERE rol_id=?", [rolId])
    for (const pid of permisoIds) {
      db.run("INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id) VALUES (?,?)", [rolId, pid])
    }
    saveDB()
    return { ok: true }
  }
}

// ─── Permisos ─────────────────────────────────────────────────────────────────

const permisos = {
  getAll() {
    return queryAll("SELECT * FROM permisos ORDER BY modulo, nombre")
  }
}

// ─── Auditoría ────────────────────────────────────────────────────────────────

const auditoria = {
  log(data) {
    run(
      "INSERT INTO auditoria (usuario_id, usuario_nombre, accion, modulo, detalle, registro_afectado_id, registro_afectado_tipo, ip_local) VALUES (?,?,?,?,?,?,?,?)",
      [
        data.usuario_id || null,
        data.usuario_nombre || 'Sistema',
        data.accion,
        data.modulo || null,
        data.detalle || null,
        data.registro_afectado_id || null,
        data.registro_afectado_tipo || null,
        data.ip_local || null,
      ]
    )
    return { ok: true }
  },
  getAll(filtros = {}) {
    let sql = `
      SELECT a.*, u.username
      FROM auditoria a LEFT JOIN usuarios u ON a.usuario_id = u.id
      WHERE 1=1
    `
    const params = []
    if (filtros.modulo) { sql += ' AND a.modulo=?'; params.push(filtros.modulo) }
    if (filtros.accion) { sql += ' AND a.accion=?'; params.push(filtros.accion) }
    if (filtros.usuario_id) { sql += ' AND a.usuario_id=?'; params.push(filtros.usuario_id) }
    if (filtros.desde) { sql += ' AND date(a.fecha)>=?'; params.push(filtros.desde) }
    if (filtros.hasta) { sql += ' AND date(a.fecha)<=?'; params.push(filtros.hasta) }
    if (filtros.busqueda) {
      sql += ' AND (a.usuario_nombre LIKE ? OR a.detalle LIKE ?)'
      const b = `%${filtros.busqueda}%`
      params.push(b, b)
    }
    sql += ' ORDER BY a.fecha DESC LIMIT 1000'
    return queryAll(sql, params)
  },
  getPaginated(filtros = {}) {
    const page = Math.max(1, filtros.page || 1)
    const pageSize = filtros.pageSize || 10
    const offset = (page - 1) * pageSize
    let where = ' WHERE 1=1'
    const params = []
    if (filtros.modulo) { where += ' AND a.modulo=?'; params.push(filtros.modulo) }
    if (filtros.accion) { where += ' AND a.accion=?'; params.push(filtros.accion) }
    if (filtros.usuario_id) { where += ' AND a.usuario_id=?'; params.push(filtros.usuario_id) }
    if (filtros.desde) { where += ' AND date(a.fecha)>=?'; params.push(filtros.desde) }
    if (filtros.hasta) { where += ' AND date(a.fecha)<=?'; params.push(filtros.hasta) }
    if (filtros.busqueda) {
      where += ' AND (a.usuario_nombre LIKE ? OR a.detalle LIKE ? OR a.accion LIKE ?)'
      const b = `%${filtros.busqueda}%`
      params.push(b, b, b)
    }
    const total = (queryOne(`SELECT COUNT(*) as n FROM auditoria a${where}`, params) || {}).n || 0
    const data = queryAll(`SELECT a.*, u.username FROM auditoria a LEFT JOIN usuarios u ON a.usuario_id=u.id${where} ORDER BY a.fecha DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset])
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }
}

// ─── Módulos ──────────────────────────────────────────────────────────────────

const modulos = {
  getAll() {
    return queryAll("SELECT * FROM configuracion_modulos ORDER BY modulo")
  },
  isActivo(modulo) {
    const row = queryOne("SELECT activo FROM configuracion_modulos WHERE modulo=?", [modulo])
    return row ? row.activo === 1 : false
  },
  setActivo(modulo, activo, usuarioId) {
    run(
      "UPDATE configuracion_modulos SET activo=?, configurado_por=?, fecha_cambio=datetime('now','localtime') WHERE modulo=?",
      [activo ? 1 : 0, usuarioId || null, modulo]
    )
    return { ok: true }
  }
}

// ─── Clientes extendido ───────────────────────────────────────────────────────

const clientesExtra = {
  getPerfilCompleto(id) {
    return queryOne(`
      SELECT c.*,
        (SELECT fecha_fin FROM membresias WHERE cliente_id=c.id ORDER BY fecha_fin DESC LIMIT 1) as vigencia,
        (SELECT estado FROM membresias WHERE cliente_id=c.id ORDER BY fecha_fin DESC LIMIT 1) as mem_estado,
        (SELECT nombre FROM planes_catalogo WHERE id=(SELECT plan_id FROM membresias WHERE cliente_id=c.id AND estado='activa' ORDER BY fecha_fin DESC LIMIT 1)) as plan_nombre,
        (SELECT plan_id FROM membresias WHERE cliente_id=c.id AND estado='activa' ORDER BY fecha_fin DESC LIMIT 1) as plan_id_activo,
        (SELECT fecha_inicio FROM membresias WHERE cliente_id=c.id AND estado='activa' ORDER BY fecha_fin DESC LIMIT 1) as mem_inicio,
        (SELECT fecha_fin FROM membresias WHERE cliente_id=c.id AND estado='activa' ORDER BY fecha_fin DESC LIMIT 1) as mem_fin,
        (SELECT monto_pagado FROM membresias WHERE cliente_id=c.id AND estado='activa' ORDER BY fecha_fin DESC LIMIT 1) as mem_monto,
        (SELECT COUNT(*) FROM asistencias WHERE cliente_id=c.id AND strftime('%Y-%m', fecha_hora)=strftime('%Y-%m','now','localtime')) as asistencias_mes,
        (SELECT COUNT(*) FROM asistencias WHERE cliente_id=c.id) as asistencias_total,
        (SELECT fecha_hora FROM asistencias WHERE cliente_id=c.id ORDER BY fecha_hora DESC LIMIT 1) as ultima_asistencia
      FROM clientes c WHERE c.id=?
    `, [id])
  },

  getHeatmap(clienteId, dias = 90) {
    return queryAll(`
      SELECT date(fecha_hora) as fecha, COUNT(*) as visitas
      FROM asistencias
      WHERE cliente_id=? AND fecha_hora >= datetime('now','localtime','-${dias} days')
      GROUP BY fecha
      ORDER BY fecha ASC
    `, [clienteId])
  },

  getStats(clienteId) {
    const total = queryOne('SELECT COUNT(*) as n FROM asistencias WHERE cliente_id=?', [clienteId])
    const estesMes = queryOne(
      "SELECT COUNT(*) as n FROM asistencias WHERE cliente_id=? AND strftime('%Y-%m',fecha_hora)=strftime('%Y-%m','now','localtime')",
      [clienteId]
    )
    const estaSemana = queryOne(
      "SELECT COUNT(*) as n FROM asistencias WHERE cliente_id=? AND fecha_hora >= datetime('now','localtime','-7 days')",
      [clienteId]
    )
    const ultima = queryOne(
      'SELECT fecha_hora FROM asistencias WHERE cliente_id=? ORDER BY fecha_hora DESC LIMIT 1',
      [clienteId]
    )
    // Mejor racha: calcula en JS desde la BD (simple: días consecutivos)
    const dias90 = queryAll(`
      SELECT DISTINCT date(fecha_hora) as dia FROM asistencias
      WHERE cliente_id=? AND fecha_hora >= datetime('now','localtime','-90 days')
      ORDER BY dia ASC
    `, [clienteId])

    let mejorRacha = 0, rachaActual = 0, prevDia = null
    for (const { dia } of dias90) {
      if (prevDia) {
        const diff = (new Date(dia) - new Date(prevDia)) / 86400000
        if (diff === 1) rachaActual++
        else rachaActual = 1
      } else {
        rachaActual = 1
      }
      if (rachaActual > mejorRacha) mejorRacha = rachaActual
      prevDia = dia
    }

    return {
      total: total?.n || 0,
      mes: estesMes?.n || 0,
      semana: estaSemana?.n || 0,
      ultimaVisita: ultima?.fecha_hora || null,
      mejor_racha: mejorRacha,
    }
  },

  updateExtra(id, data) {
    run(
      `UPDATE clientes SET
        direccion=?, genero=?, contacto_emergencia=?, telefono_emergencia=?,
        tipo_sangre=?, alergias=?, condiciones_medicas=?, notas=?
      WHERE id=?`,
      [
        data.direccion || null, data.genero || null,
        data.contacto_emergencia || null, data.telefono_emergencia || null,
        data.tipo_sangre || null, data.alergias || null,
        data.condicion_medica || data.condiciones_medicas || null,
        data.notas_internas || data.notas || null, id,
      ]
    )
    return { ok: true }
  },

  getAsistenciasPorMes(clienteId) {
    return queryAll(`
      SELECT strftime('%Y-%m', fecha_hora) as mes, COUNT(*) as cantidad
      FROM asistencias WHERE cliente_id=?
      AND fecha_hora >= datetime('now','localtime','-6 months')
      GROUP BY mes ORDER BY mes ASC
    `, [clienteId])
  },

  getAsistenciasRecientes(clienteId, n = 15) {
    return queryAll(
      'SELECT * FROM asistencias WHERE cliente_id=? ORDER BY fecha_hora DESC LIMIT ?',
      [clienteId, n]
    )
  },
}

// ─── Notas de cliente ────────────────────────────────────────────────────────

const notasCliente = {
  getByCliente(clienteId) {
    return queryAll(
      'SELECT * FROM notas_cliente WHERE cliente_id=? ORDER BY created_at DESC',
      [clienteId]
    )
  },
  create(data) {
    const contenido = data.texto || data.contenido
    const r = run(
      "INSERT INTO notas_cliente (cliente_id, contenido, tipo, usuario_id, usuario_nombre) VALUES (?,?,?,?,?)",
      [data.cliente_id, contenido, data.tipo || 'general', data.usuario_id || null, data.usuario_nombre || null]
    )
    return { id: r.lastInsertRowid, ...data }
  },
  delete(id) {
    run('DELETE FROM notas_cliente WHERE id=?', [id])
    return { ok: true }
  },
}

// ─── Dashboard 2 (métricas enriquecidas) ─────────────────────────────────────

const dashboard2 = {
  distribucionPlanes() {
    return queryAll(`
      SELECT p.nombre, p.id, COUNT(m.id) as cantidad, p.precio
      FROM planes_catalogo p
      LEFT JOIN membresias m ON m.plan_id=p.id
        AND m.estado='activa'
        AND date(m.fecha_fin) >= date('now','localtime')
      GROUP BY p.id, p.nombre, p.precio
      ORDER BY cantidad DESC
    `)
  },

  asistenciasPorHora() {
    return queryAll(`
      SELECT CAST(strftime('%H', fecha_hora) AS INTEGER) as hora, COUNT(*) as cantidad
      FROM asistencias
      WHERE date(fecha_hora) = date('now','localtime')
      GROUP BY hora ORDER BY hora ASC
    `)
  },

  asistenciasHoyRecientes(n = 8) {
    return queryAll(`
      SELECT a.*, c.nombre, c.apellido, c.carnet,
        (SELECT nombre FROM planes_catalogo WHERE id=(
          SELECT plan_id FROM membresias WHERE cliente_id=c.id AND estado='activa' ORDER BY fecha_fin DESC LIMIT 1
        )) as plan_nombre,
        (SELECT CASE WHEN date(fecha_fin)>=date('now','localtime') THEN 'activa' ELSE 'vencida' END
          FROM membresias WHERE cliente_id=c.id ORDER BY fecha_fin DESC LIMIT 1) as mem_estado
      FROM asistencias a JOIN clientes c ON a.cliente_id=c.id
      WHERE date(a.fecha_hora)=date('now','localtime')
      ORDER BY a.fecha_hora DESC LIMIT ?
    `, [n])
  },

  cumpleanosProximos(dias = 7) {
    // Busca clientes cuyo cumpleaños cae en los próximos N días (cualquier año)
    return queryAll(`
      SELECT id, nombre, apellido, carnet, telefono, fecha_nacimiento,
        CAST(strftime('%Y','now','localtime') AS INTEGER) -
        CAST(strftime('%Y', fecha_nacimiento) AS INTEGER) as edad
      FROM clientes
      WHERE activo=1 AND fecha_nacimiento IS NOT NULL
        AND (
          CASE
            WHEN strftime('%m-%d', fecha_nacimiento) >= strftime('%m-%d','now','localtime')
            THEN CAST(julianday(strftime('%Y','now','localtime') || '-' || strftime('%m-%d', fecha_nacimiento)) - julianday('now','localtime') AS INTEGER)
            ELSE CAST(julianday(CAST(strftime('%Y','now','localtime') AS INTEGER)+1 || '-' || strftime('%m-%d', fecha_nacimiento)) - julianday('now','localtime') AS INTEGER)
          END
        ) BETWEEN 0 AND ?
      ORDER BY strftime('%m-%d', fecha_nacimiento) ASC
      LIMIT 10
    `, [dias])
  },

  clientesInactivos(dias = 14) {
    return queryAll(`
      SELECT c.id, c.nombre, c.apellido, c.carnet, c.telefono,
        (SELECT fecha_hora FROM asistencias WHERE cliente_id=c.id ORDER BY fecha_hora DESC LIMIT 1) as ultima_visita,
        CAST(julianday('now','localtime') - julianday(
          COALESCE((SELECT fecha_hora FROM asistencias WHERE cliente_id=c.id ORDER BY fecha_hora DESC LIMIT 1), c.created_at)
        ) AS INTEGER) as dias_inactivo,
        (SELECT nombre FROM planes_catalogo WHERE id=(
          SELECT plan_id FROM membresias WHERE cliente_id=c.id AND estado='activa' ORDER BY fecha_fin DESC LIMIT 1
        )) as plan_nombre
      FROM clientes c
      WHERE c.activo=1
        AND (
          (SELECT fecha_hora FROM asistencias WHERE cliente_id=c.id ORDER BY fecha_hora DESC LIMIT 1) < datetime('now','localtime','-' || ? || ' days')
          OR (SELECT COUNT(*) FROM asistencias WHERE cliente_id=c.id) = 0
        )
        AND (SELECT COUNT(*) FROM membresias WHERE cliente_id=c.id AND estado='activa' AND date(fecha_fin)>=date('now','localtime')) > 0
      ORDER BY dias_inactivo DESC LIMIT 10
    `, [dias])
  },

  topClientes(n = 5) {
    return queryAll(`
      SELECT c.id, c.nombre, c.apellido, c.carnet, COUNT(a.id) as visitas
      FROM clientes c
      JOIN asistencias a ON a.cliente_id=c.id
      WHERE strftime('%Y-%m', a.fecha_hora) = strftime('%Y-%m','now','localtime')
      GROUP BY c.id ORDER BY visitas DESC LIMIT ?
    `, [n])
  },

  ingresosPorRango(inicio, fin) {
    return queryAll(`
      SELECT date(fecha) as dia, SUM(total) as total
      FROM ventas WHERE estado='completada' AND date(fecha) BETWEEN ? AND ?
      GROUP BY dia ORDER BY dia ASC
    `, [inicio, fin])
  },

  resumenRapido() {
    const semana = queryOne(
      "SELECT COUNT(*) as n FROM asistencias WHERE fecha_hora >= datetime('now','localtime','-7 days')"
    )
    const promedioMes = queryOne(
      "SELECT AVG(monto) as avg FROM pagos WHERE strftime('%Y-%m',fecha)=strftime('%Y-%m','now','localtime')"
    )
    const planPopular = queryOne(`
      SELECT p.nombre, COUNT(m.id) as cantidad
      FROM planes_catalogo p
      JOIN membresias m ON m.plan_id=p.id
        AND m.estado='activa' AND date(m.fecha_fin)>=date('now','localtime')
      GROUP BY p.id ORDER BY cantidad DESC LIMIT 1
    `)
    const clienteMes = queryOne(`
      SELECT c.nombre, c.apellido, COUNT(a.id) as visitas
      FROM clientes c
      JOIN asistencias a ON a.cliente_id=c.id
      WHERE strftime('%Y-%m',a.fecha_hora)=strftime('%Y-%m','now','localtime')
      GROUP BY c.id ORDER BY visitas DESC LIMIT 1
    `)
    return {
      visitasSemana: semana?.n || 0,
      promedioIngreso: promedioMes?.avg || 0,
      planPopular: planPopular?.nombre || '—',
      clienteMes: clienteMes ? `${clienteMes.nombre} ${clienteMes.apellido}` : '—',
    }
  },
}

// ─── Ventas ───────────────────────────────────────────────────────────────────

const ventas = {
  getByCliente(clienteId) {
    return queryAll(`
      SELECT v.*, d.nombre as descuento_nombre
      FROM ventas v LEFT JOIN descuentos d ON v.descuento_id=d.id
      WHERE v.cliente_id=? ORDER BY v.fecha DESC
    `, [clienteId])
  },

  getAll(filtros = {}) {
    const conditions = []
    const params = []
    if (filtros.tipo && filtros.tipo !== 'todos') { conditions.push('v.tipo=?'); params.push(filtros.tipo) }
    if (filtros.estado && filtros.estado !== 'todos') { conditions.push('v.estado=?'); params.push(filtros.estado) }
    if (filtros.metodo_pago && filtros.metodo_pago !== 'todos') { conditions.push('v.metodo_pago=?'); params.push(filtros.metodo_pago) }
    if (filtros.desde) { conditions.push("date(v.fecha)>=date(?)"); params.push(filtros.desde) }
    if (filtros.hasta) { conditions.push("date(v.fecha)<=date(?)"); params.push(filtros.hasta) }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
    return queryAll(`
      SELECT v.*,
        c.nombre||' '||c.apellido as cliente_nombre, c.carnet as cliente_carnet,
        u.nombre_completo as usuario_nombre
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id=c.id
      LEFT JOIN usuarios u ON v.usuario_id=u.id
      ${where}
      ORDER BY v.fecha DESC LIMIT 500
    `, params)
  },

  getById(id) {
    const venta = queryOne(`
      SELECT v.*,
        c.nombre||' '||c.apellido as cliente_nombre, c.carnet as cliente_carnet,
        u.nombre_completo as usuario_nombre
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id=c.id
      LEFT JOIN usuarios u ON v.usuario_id=u.id
      WHERE v.id=?
    `, [id])
    if (!venta) return null
    const detalle = queryAll('SELECT * FROM detalle_ventas_productos WHERE venta_id=?', [id])
    return { ...venta, detalle }
  },

  getKPIs(filtros = {}) {
    const mes = filtros.mes || new Date().toISOString().slice(0, 7)
    const rows = queryAll(`
      SELECT tipo, estado, COUNT(*) as cnt, COALESCE(SUM(total),0) as total
      FROM ventas WHERE strftime('%Y-%m',fecha)=? GROUP BY tipo, estado
    `, [mes])
    let totalVentas = 0, totalIngresos = 0, ventasMembresia = 0, ventasProductos = 0
    for (const r of rows) {
      if (r.estado === 'completada') {
        totalVentas += r.cnt; totalIngresos += r.total
        if (r.tipo === 'membresia') ventasMembresia += r.cnt
        if (r.tipo === 'productos') ventasProductos += r.cnt
      }
    }
    return { totalVentas, totalIngresos, ventasMembresia, ventasProductos }
  },

  anular(id) {
    const v = queryOne('SELECT estado FROM ventas WHERE id=?', [id])
    if (!v) return { ok: false, error: 'Venta no encontrada' }
    if (v.estado === 'anulada') return { ok: false, error: 'Ya está anulada' }
    run("UPDATE ventas SET estado='anulada' WHERE id=?", [id])
    return { ok: true }
  },

  procesarPagoMembresia(data) {
    const memR = run(
      "INSERT INTO membresias (cliente_id, plan_id, fecha_inicio, fecha_fin, monto_pagado, estado) VALUES (?,?,?,?,?,'activa')",
      [data.cliente_id, data.plan_id, data.fecha_inicio, data.fecha_fin, data.total]
    )
    const memId = memR.lastInsertRowid
    run(
      'INSERT INTO pagos (cliente_id, membresia_id, monto, metodo, concepto) VALUES (?,?,?,?,?)',
      [data.cliente_id, memId, data.total, data.metodo_pago, `Membresía - ${data.plan_nombre || 'Plan'}`]
    )
    const ventaR = run(
      `INSERT INTO ventas (cliente_id, usuario_id, tipo, subtotal, descuento_id, descuento_valor, total, metodo_pago, metodo_pago_detalle, monto_recibido, vuelto, sesion_caja_id, estado)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'completada')`,
      [data.cliente_id, data.usuario_id || null, 'membresia',
       data.subtotal, data.descuento_id || null, data.descuento_valor || 0,
       data.total, data.metodo_pago, JSON.stringify(data.metodo_pago_detalle || {}),
       data.monto_recibido || data.total, data.vuelto || 0, data.sesion_caja_id || null]
    )
    const ventaId = ventaR.lastInsertRowid
    if (data.sesion_caja_id) {
      run(
        `INSERT INTO caja_movimientos (sesion_id, tipo, concepto, monto, metodo_pago, referencia_id, referencia_tipo, usuario_id, usuario_nombre) VALUES (?,?,?,?,?,?,?,?,?)`,
        [data.sesion_caja_id, 'ingreso', `Membresía - ${data.plan_nombre || 'Plan'}`, data.total,
         data.metodo_pago || 'efectivo', ventaId, 'venta', data.usuario_id || null, null]
      )
    }
    run('INSERT INTO asistencias (cliente_id) VALUES (?)', [data.cliente_id])
    return { ok: true, membresia_id: memId, venta_id: ventaId }
  },

  getPaginated(filtros = {}) {
    const page = Math.max(1, filtros.page || 1)
    const pageSize = filtros.pageSize || 10
    const offset = (page - 1) * pageSize
    const conditions = []
    const params = []
    if (filtros.tipo && filtros.tipo !== 'todos') { conditions.push('v.tipo=?'); params.push(filtros.tipo) }
    if (filtros.estado && filtros.estado !== 'todos') { conditions.push('v.estado=?'); params.push(filtros.estado) }
    if (filtros.metodo_pago && filtros.metodo_pago !== 'todos') { conditions.push('v.metodo_pago=?'); params.push(filtros.metodo_pago) }
    if (filtros.desde) { conditions.push('date(v.fecha)>=date(?)'); params.push(filtros.desde) }
    if (filtros.hasta) { conditions.push('date(v.fecha)<=date(?)'); params.push(filtros.hasta) }
    if (filtros.busqueda) {
      const q = `%${filtros.busqueda}%`
      conditions.push('(c.nombre||" "||c.apellido LIKE ? OR c.carnet LIKE ? OR CAST(v.id AS TEXT) LIKE ?)')
      params.push(q, q, q)
    }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
    const countSql = `SELECT COUNT(*) as n FROM ventas v LEFT JOIN clientes c ON v.cliente_id=c.id ${where}`
    const total = (queryOne(countSql, params) || {}).n || 0
    const data = queryAll(`
      SELECT v.*, c.nombre||' '||c.apellido as cliente_nombre, c.carnet as cliente_carnet, u.nombre_completo as usuario_nombre
      FROM ventas v LEFT JOIN clientes c ON v.cliente_id=c.id LEFT JOIN usuarios u ON v.usuario_id=u.id
      ${where} ORDER BY v.fecha DESC LIMIT ? OFFSET ?
    `, [...params, pageSize, offset])
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  },

  getBySesion(sesionId) {
    return queryAll(`
      SELECT v.*, c.nombre||' '||c.apellido as cliente_nombre, u.nombre_completo as usuario_nombre
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id=c.id
      LEFT JOIN usuarios u ON v.usuario_id=u.id
      WHERE v.sesion_caja_id=?
      ORDER BY v.fecha DESC
    `, [sesionId])
  },
}

// ─── Descuentos ───────────────────────────────────────────────────────────────

const descuentos = {
  getAll() { return queryAll('SELECT * FROM descuentos ORDER BY nombre') },
  getActive() { return queryAll('SELECT * FROM descuentos WHERE activo=1 ORDER BY nombre') },
  create(data) {
    const r = run(
      'INSERT INTO descuentos (nombre, tipo, valor, activo, aplicable_a) VALUES (?,?,?,?,?)',
      [data.nombre, data.tipo || 'porcentaje', data.valor, data.activo ?? 1, data.aplicable_a || 'todos']
    )
    return { id: r.lastInsertRowid, ...data }
  },
  update(id, data) {
    run(
      'UPDATE descuentos SET nombre=?, tipo=?, valor=?, activo=?, aplicable_a=? WHERE id=?',
      [data.nombre, data.tipo || 'porcentaje', data.valor, data.activo ?? 1, data.aplicable_a || 'todos', id]
    )
    return { ok: true }
  },
  delete(id) {
    run('DELETE FROM descuentos WHERE id=?', [id])
    return { ok: true }
  }
}

// ─── Configuración POS ────────────────────────────────────────────────────────

const configuracionPOS = {
  get() {
    return queryOne('SELECT * FROM configuracion_pos WHERE id=1') || {}
  },
  save(data) {
    const existing = queryOne('SELECT id FROM configuracion_pos WHERE id=1')
    if (existing) {
      run(
        `UPDATE configuracion_pos SET gym_nombre=?, gym_direccion=?, gym_telefono=?, gym_email=?,
         gym_logo=?, qr_imagen=?, qr_banco=?, qr_cuenta=?, qr_descripcion=?,
         metodos_pago_activos=?, facturacion_activa=?, descuento_maximo=?, sonidos_activos=? WHERE id=1`,
        [data.gym_nombre || 'Urban Fitness Club', data.gym_direccion || null, data.gym_telefono || null,
         data.gym_email || null, data.gym_logo || null, data.qr_imagen || null,
         data.qr_banco || null, data.qr_cuenta || null, data.qr_descripcion || null,
         data.metodos_pago_activos || 'efectivo,qr,tarjeta,transferencia,mixto',
         data.facturacion_activa ? 1 : 0, data.descuento_maximo || 50, data.sonidos_activos ? 1 : 0]
      )
    } else {
      run(
        `INSERT INTO configuracion_pos (id,gym_nombre,gym_direccion,gym_telefono,gym_email,gym_logo,qr_imagen,qr_banco,qr_cuenta,qr_descripcion,metodos_pago_activos,facturacion_activa,descuento_maximo,sonidos_activos)
         VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [data.gym_nombre || 'Urban Fitness Club', data.gym_direccion || null, data.gym_telefono || null,
         data.gym_email || null, data.gym_logo || null, data.qr_imagen || null,
         data.qr_banco || null, data.qr_cuenta || null, data.qr_descripcion || null,
         data.metodos_pago_activos || 'efectivo,qr,tarjeta,transferencia,mixto',
         data.facturacion_activa ? 1 : 0, data.descuento_maximo || 50, data.sonidos_activos ? 1 : 0]
      )
    }
    return { ok: true }
  }
}

// ─── Inventario ───────────────────────────────────────────────────────────────

const inventario = {
  getCategorias() {
    return queryAll('SELECT * FROM categorias_productos WHERE activo=1 ORDER BY nombre')
  },
  createCategoria(data) {
    const r = run('INSERT INTO categorias_productos (nombre, descripcion, color) VALUES (?,?,?)',
      [data.nombre, data.descripcion || null, data.color || null])
    if (data.imagen) {
      try { db.run('UPDATE categorias_productos SET imagen=? WHERE id=?', [data.imagen, r.lastInsertRowid]); saveDB() } catch (_) {}
    }
    return { id: r.lastInsertRowid, ...data }
  },
  updateCategoria(id, data) {
    // Actualizar campos base (siempre funciona)
    run('UPDATE categorias_productos SET nombre=?, descripcion=?, color=? WHERE id=?',
      [data.nombre, data.descripcion || null, data.color || null, id])
    // Actualizar imagen por separado (puede fallar en DBs sin columna imagen)
    if (data.imagen !== undefined) {
      try { db.run('UPDATE categorias_productos SET imagen=? WHERE id=?', [data.imagen || null, id]); saveDB() } catch (_) {}
    }
    return { ok: true }
  },
  deleteCategoria(id) {
    run('UPDATE categorias_productos SET activo=0 WHERE id=?', [id])
    return { ok: true }
  },

  getProveedores() {
    return queryAll('SELECT * FROM proveedores WHERE activo=1 ORDER BY nombre')
  },
  createProveedor(data) {
    const r = run('INSERT INTO proveedores (nombre, contacto, telefono, email, direccion, notas) VALUES (?,?,?,?,?,?)',
      [data.nombre, data.contacto || null, data.telefono || null, data.email || null, data.direccion || null, data.notas || null])
    return { id: r.lastInsertRowid, ...data }
  },
  updateProveedor(id, data) {
    run('UPDATE proveedores SET nombre=?, contacto=?, telefono=?, email=?, direccion=?, notas=? WHERE id=?',
      [data.nombre, data.contacto || null, data.telefono || null, data.email || null, data.direccion || null, data.notas || null, id])
    return { ok: true }
  },
  deleteProveedor(id) {
    run('UPDATE proveedores SET activo=0 WHERE id=?', [id])
    return { ok: true }
  },

  getAll(filtros = {}) {
    let sql = `
      SELECT p.*, c.nombre as categoria_nombre, c.color as categoria_color, c.imagen as categoria_imagen, pv.nombre as proveedor_nombre
      FROM productos p
      LEFT JOIN categorias_productos c ON p.categoria_id=c.id
      LEFT JOIN proveedores pv ON p.proveedor_id=pv.id
      WHERE p.activo=1 AND p.eliminado=0
    `
    const params = []
    if (filtros.categoria_id) { sql += ' AND p.categoria_id=?'; params.push(filtros.categoria_id) }
    if (filtros.busqueda) {
      const q = `%${filtros.busqueda}%`
      sql += ' AND (p.nombre LIKE ? OR p.codigo LIKE ?)'
      params.push(q, q)
    }
    sql += ' ORDER BY p.nombre'
    return queryAll(sql, params)
  },
  getById(id) {
    return queryOne(`
      SELECT p.*, c.nombre as categoria_nombre, pv.nombre as proveedor_nombre
      FROM productos p
      LEFT JOIN categorias_productos c ON p.categoria_id=c.id
      LEFT JOIN proveedores pv ON p.proveedor_id=pv.id
      WHERE p.id=?
    `, [id])
  },
  create(data) {
    const r = run(
      `INSERT INTO productos (nombre, codigo, descripcion, categoria_id, proveedor_id,
       precio_compra, precio_venta, stock, stock_minimo, unidad, imagen)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [data.nombre, data.codigo || null, data.descripcion || null,
       data.categoria_id || null, data.proveedor_id || null,
       data.precio_compra || 0, data.precio_venta || 0,
       data.stock || 0, data.stock_minimo ?? 5, data.unidad || 'unidad', data.imagen || null]
    )
    const id = r.lastInsertRowid
    if (data.stock > 0) {
      run(`INSERT INTO movimientos_stock (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, usuario_id, usuario_nombre) VALUES (?,?,?,?,?,?,?,?)`,
        [id, 'entrada', data.stock, 0, data.stock, 'Stock inicial', data.usuario_id || null, data.usuario_nombre || null])
    }
    return inventario.getById(id)
  },
  update(id, data) {
    run(
      `UPDATE productos SET nombre=?, codigo=?, descripcion=?, categoria_id=?, proveedor_id=?,
       precio_compra=?, precio_venta=?, stock_minimo=?, unidad=?, imagen=?,
       updated_at=datetime('now','localtime') WHERE id=?`,
      [data.nombre, data.codigo || null, data.descripcion || null,
       data.categoria_id || null, data.proveedor_id || null,
       data.precio_compra || 0, data.precio_venta || 0,
       data.stock_minimo ?? 5, data.unidad || 'unidad', data.imagen || null, id]
    )
    return { ok: true }
  },
  delete(id) {
    run("UPDATE productos SET eliminado=1, eliminado_at=datetime('now','localtime'), activo=0 WHERE id=?", [id])
    return { ok: true }
  },
  getStockBajo() {
    return queryAll(`
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias_productos c ON p.categoria_id=c.id
      WHERE p.activo=1 AND p.eliminado=0 AND p.stock <= p.stock_minimo
      ORDER BY p.stock ASC
    `)
  },
  buscarPOS(query) {
    const q = `%${query}%`
    return queryAll(`
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias_productos c ON p.categoria_id=c.id
      WHERE p.activo=1 AND p.eliminado=0 AND p.stock > 0
        AND (p.nombre LIKE ? OR p.codigo LIKE ? OR c.nombre LIKE ?)
      ORDER BY p.nombre LIMIT 20
    `, [q, q, q])
  },
  ajustarStock(data) {
    const prod = queryOne('SELECT stock FROM productos WHERE id=?', [data.producto_id])
    if (!prod) return { ok: false, error: 'Producto no encontrado' }
    const stockAnterior = prod.stock
    let stockNuevo
    if (data.tipo === 'ajuste') {
      stockNuevo = Math.max(0, data.cantidad)
    } else if (data.tipo === 'entrada') {
      stockNuevo = stockAnterior + data.cantidad
    } else {
      stockNuevo = Math.max(0, stockAnterior - data.cantidad)
    }
    run("UPDATE productos SET stock=?, updated_at=datetime('now','localtime') WHERE id=?", [stockNuevo, data.producto_id])
    run(`INSERT INTO movimientos_stock (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, usuario_id, usuario_nombre) VALUES (?,?,?,?,?,?,?,?)`,
      [data.producto_id, data.tipo, data.cantidad, stockAnterior, stockNuevo, data.motivo || null, data.usuario_id || null, data.usuario_nombre || null])
    return { ok: true, stock_anterior: stockAnterior, stock_nuevo: stockNuevo }
  },
  getMovimientos(productoId) {
    return queryAll('SELECT * FROM movimientos_stock WHERE producto_id=? ORDER BY created_at DESC LIMIT 100', [productoId])
  },
  getAllMovimientos() {
    return queryAll(`
      SELECT m.*, p.nombre as producto_nombre
      FROM movimientos_stock m
      LEFT JOIN productos p ON m.producto_id=p.id
      ORDER BY m.created_at DESC LIMIT 300
    `)
  },
  venderProductos(items, meta) {
    const subtotal = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0)
    const ventaR = run(
      `INSERT INTO ventas (cliente_id, usuario_id, tipo, subtotal, total, metodo_pago, estado)
       VALUES (?,?,?,?,?,?,'completada')`,
      [meta.cliente_id || null, meta.usuario_id || null, 'productos', subtotal, subtotal, meta.metodo_pago || 'efectivo']
    )
    const ventaId = ventaR.lastInsertRowid
    for (const item of items) {
      run(`INSERT INTO detalle_ventas_productos (venta_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal) VALUES (?,?,?,?,?,?)`,
        [ventaId, item.producto_id, item.nombre_producto, item.cantidad, item.precio_unitario, item.cantidad * item.precio_unitario])
      const prod = queryOne('SELECT stock FROM productos WHERE id=?', [item.producto_id])
      if (prod) {
        const stockNuevo = Math.max(0, prod.stock - item.cantidad)
        run("UPDATE productos SET stock=? WHERE id=?", [stockNuevo, item.producto_id])
        run(`INSERT INTO movimientos_stock (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, venta_id, usuario_id, usuario_nombre) VALUES (?,?,?,?,?,?,?,?,?)`,
          [item.producto_id, 'venta', item.cantidad, prod.stock, stockNuevo, 'Venta', ventaId, meta.usuario_id || null, meta.usuario_nombre || null])
      }
    }
    if (meta.sesion_id) {
      run(`INSERT INTO caja_movimientos (sesion_id, tipo, concepto, monto, metodo_pago, referencia_id, referencia_tipo, usuario_id, usuario_nombre) VALUES (?,?,?,?,?,?,?,?,?)`,
        [meta.sesion_id, 'ingreso', 'Venta de productos', subtotal, meta.metodo_pago || 'efectivo', ventaId, 'venta', meta.usuario_id || null, meta.usuario_nombre || null])
    }
    return { ok: true, venta_id: ventaId, total: subtotal }
  },

  getPaginated(filtros = {}) {
    const page = Math.max(1, filtros.page || 1)
    const pageSize = filtros.pageSize || 10
    const offset = (page - 1) * pageSize
    let sql = `
      SELECT p.*, c.nombre as categoria_nombre, c.color as categoria_color, c.imagen as categoria_imagen, pv.nombre as proveedor_nombre
      FROM productos p
      LEFT JOIN categorias_productos c ON p.categoria_id=c.id
      LEFT JOIN proveedores pv ON p.proveedor_id=pv.id
      WHERE p.activo=1 AND p.eliminado=0`
    const params = []
    if (filtros.categoria_id) { sql += ' AND p.categoria_id=?'; params.push(filtros.categoria_id) }
    if (filtros.busqueda) {
      const q = `%${filtros.busqueda}%`
      sql += ' AND (p.nombre LIKE ? OR p.codigo LIKE ?)'
      params.push(q, q)
    }
    const countSql = `SELECT COUNT(*) as n FROM productos p WHERE p.activo=1 AND p.eliminado=0` +
      (filtros.categoria_id ? ' AND p.categoria_id=?' : '') +
      (filtros.busqueda ? ' AND (p.nombre LIKE ? OR p.codigo LIKE ?)' : '')
    const countParams = []
    if (filtros.categoria_id) countParams.push(filtros.categoria_id)
    if (filtros.busqueda) { const q = `%${filtros.busqueda}%`; countParams.push(q, q) }
    const total = (queryOne(countSql, countParams) || {}).n || 0
    const data = queryAll(`${sql} ORDER BY p.nombre LIMIT ? OFFSET ?`, [...params, pageSize, offset])
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  },

  getAllMovimientosPaginated(filtros = {}) {
    const page = Math.max(1, filtros.page || 1)
    const pageSize = filtros.pageSize || 10
    const offset = (page - 1) * pageSize
    const total = (queryOne('SELECT COUNT(*) as n FROM movimientos_stock') || {}).n || 0
    const data = queryAll(`
      SELECT m.*, p.nombre as producto_nombre
      FROM movimientos_stock m LEFT JOIN productos p ON m.producto_id=p.id
      ORDER BY m.created_at DESC LIMIT ? OFFSET ?
    `, [pageSize, offset])
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  },
}

// ─── Caja ─────────────────────────────────────────────────────────────────────

const caja = {
  getSesionActual() {
    return queryOne("SELECT * FROM caja_sesiones WHERE estado='abierta' ORDER BY id DESC LIMIT 1")
  },
  isAbierta() {
    return !!queryOne("SELECT id FROM caja_sesiones WHERE estado='abierta' LIMIT 1")
  },
  abrir(data) {
    if (caja.isAbierta()) return { ok: false, error: 'Ya hay una sesión de caja abierta' }
    const r = run(
      "INSERT INTO caja_sesiones (usuario_id, usuario_nombre, monto_inicial, notas_apertura) VALUES (?,?,?,?)",
      [data.usuario_id, data.usuario_nombre || null, data.monto_inicial || 0, data.notas || null]
    )
    const sesionId = r.lastInsertRowid
    run(`INSERT INTO caja_movimientos (sesion_id, tipo, concepto, monto, usuario_id, usuario_nombre) VALUES (?,?,?,?,?,?)`,
      [sesionId, 'apertura', 'Apertura de caja', data.monto_inicial || 0, data.usuario_id, data.usuario_nombre || null])
    return { ok: true, sesion_id: sesionId }
  },
  cerrar(data) {
    const sesion = caja.getSesionActual()
    if (!sesion) return { ok: false, error: 'No hay sesión de caja abierta' }
    const movs = queryAll("SELECT tipo, SUM(monto) as total FROM caja_movimientos WHERE sesion_id=? GROUP BY tipo", [sesion.id])
    const totalIngresos = movs.filter(m => ['ingreso', 'apertura'].includes(m.tipo)).reduce((s, m) => s + m.total, 0)
    const totalEgresos = movs.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.total, 0)
    const montoCalculado = totalIngresos - totalEgresos
    const montoCierre = data.monto_cierre ?? montoCalculado
    const diferencia = montoCierre - montoCalculado
    run(
      "UPDATE caja_sesiones SET estado='cerrada', fecha_cierre=datetime('now','localtime'), monto_calculado=?, monto_cierre=?, diferencia=?, notas_cierre=? WHERE id=?",
      [montoCalculado, montoCierre, diferencia, data.notas || null, sesion.id]
    )
    run(`INSERT INTO caja_movimientos (sesion_id, tipo, concepto, monto, usuario_id, usuario_nombre) VALUES (?,?,?,?,?,?)`,
      [sesion.id, 'cierre', 'Cierre de caja', montoCierre, data.usuario_id, data.usuario_nombre || null])
    return { ok: true, monto_calculado: montoCalculado, monto_cierre: montoCierre, diferencia }
  },
  addMovimiento(data) {
    const sesion = caja.getSesionActual()
    if (!sesion) return { ok: false, error: 'No hay sesión de caja abierta' }
    run(`INSERT INTO caja_movimientos (sesion_id, tipo, concepto, monto, metodo_pago, usuario_id, usuario_nombre) VALUES (?,?,?,?,?,?,?)`,
      [sesion.id, data.tipo, data.concepto, data.monto, data.metodo_pago || 'efectivo', data.usuario_id, data.usuario_nombre || null])
    return { ok: true }
  },
  getMovimientos(sesionId) {
    return queryAll('SELECT * FROM caja_movimientos WHERE sesion_id=? ORDER BY created_at ASC', [sesionId])
  },
  getResumen(sesionId) {
    const sesion = queryOne('SELECT * FROM caja_sesiones WHERE id=?', [sesionId])
    if (!sesion) return null
    const movs = queryAll('SELECT * FROM caja_movimientos WHERE sesion_id=? ORDER BY created_at ASC', [sesionId])
    const ingresosAll = movs.filter(m => m.tipo === 'ingreso')
    const totalIngresos = ingresosAll.reduce((s, m) => s + m.monto, 0)
    const totalEgresos = movs.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0)
    // Solo efectivo cuenta como dinero físico en caja
    const ingresosEfectivo = ingresosAll.filter(m => !m.metodo_pago || m.metodo_pago === 'efectivo').reduce((s, m) => s + m.monto, 0)
    const efectivoEsperado = sesion.monto_inicial + ingresosEfectivo - totalEgresos
    // Desglose por método de pago
    const porMetodo = {}
    for (const m of ingresosAll) {
      const met = m.metodo_pago || 'efectivo'
      porMetodo[met] = (porMetodo[met] || 0) + m.monto
    }
    return {
      ...sesion,
      movimientos: movs,
      total_ingresos: totalIngresos,
      total_egresos: totalEgresos,
      saldo_actual: sesion.monto_inicial + totalIngresos - totalEgresos,
      efectivo_esperado: efectivoEsperado,
      por_metodo: porMetodo,
    }
  },
  getHistorial(limit = 30) {
    return queryAll(`
      SELECT s.*,
        (SELECT SUM(monto) FROM caja_movimientos WHERE sesion_id=s.id AND tipo='ingreso') as total_ingresos,
        (SELECT SUM(monto) FROM caja_movimientos WHERE sesion_id=s.id AND tipo='egreso') as total_egresos
      FROM caja_sesiones s ORDER BY s.fecha_apertura DESC LIMIT ?
    `, [limit])
  },
  getSesionById(id) {
    return queryOne('SELECT * FROM caja_sesiones WHERE id=?', [id])
  },
  getHistorialPaginated(filtros = {}) {
    const page = Math.max(1, filtros.page || 1)
    const pageSize = Math.min(filtros.pageSize || 10, 100)
    const offset = (page - 1) * pageSize
    const conditions = []
    const params = []
    if (filtros.busqueda) {
      conditions.push('s.usuario_nombre LIKE ?')
      params.push(`%${filtros.busqueda}%`)
    }
    if (filtros.desde) { conditions.push("date(s.fecha_apertura)>=date(?)"); params.push(filtros.desde) }
    if (filtros.hasta) { conditions.push("date(s.fecha_apertura)<=date(?)"); params.push(filtros.hasta) }
    if (filtros.estado === 'abierta') conditions.push("s.estado='abierta'")
    else if (filtros.estado === 'cerrada') conditions.push("s.estado='cerrada'")
    if (filtros.resultado === 'cuadra') conditions.push('ABS(COALESCE(s.diferencia,0)) < 0.01')
    else if (filtros.resultado === 'faltante') conditions.push('s.diferencia < -0.01')
    else if (filtros.resultado === 'sobrante') conditions.push('s.diferencia > 0.01')
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
    const countSql = `SELECT COUNT(*) as n FROM caja_sesiones s ${where}`
    const total = (queryOne(countSql, params) || {}).n || 0
    const data = queryAll(`
      SELECT s.*,
        (SELECT SUM(monto) FROM caja_movimientos WHERE sesion_id=s.id AND tipo='ingreso') as total_ingresos,
        (SELECT SUM(monto) FROM caja_movimientos WHERE sesion_id=s.id AND tipo='egreso') as total_egresos,
        (SELECT COUNT(*) FROM caja_notas WHERE sesion_id=s.id) as notas_count
      FROM caja_sesiones s ${where} ORDER BY s.fecha_apertura DESC LIMIT ? OFFSET ?
    `, [...params, pageSize, offset])
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  },

  addNota(data) {
    const sesion = queryOne('SELECT id FROM caja_sesiones WHERE id=?', [data.sesion_id])
    if (!sesion) return { ok: false, error: 'Sesión no encontrada' }
    run('INSERT INTO caja_notas (sesion_id, texto, usuario_id, usuario_nombre) VALUES (?,?,?,?)',
      [data.sesion_id, data.texto, data.usuario_id || null, data.usuario_nombre || null])
    return { ok: true }
  },

  getNotas(sesionId) {
    return queryAll('SELECT * FROM caja_notas WHERE sesion_id=? ORDER BY fecha ASC', [sesionId])
  },
}

// ─── Papelera ─────────────────────────────────────────────────────────────────

const papelera = {
  getResumen() {
    const cl = queryOne('SELECT COUNT(*) as n FROM clientes WHERE activo=0').n
    const pl = queryOne('SELECT COUNT(*) as n FROM planes_catalogo WHERE activo=0').n
    const pr = queryOne('SELECT COUNT(*) as n FROM productos WHERE eliminado=1').n
    return { clientes: cl, planes: pl, productos: pr, total: cl + pl + pr }
  },
  getClientes() {
    return queryAll("SELECT * FROM clientes WHERE activo=0 ORDER BY nombre, apellido")
  },
  getPlanes() {
    return queryAll("SELECT * FROM planes_catalogo WHERE activo=0 ORDER BY nombre")
  },
  getProductos() {
    return queryAll(`
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias_productos c ON p.categoria_id=c.id
      WHERE p.eliminado=1 ORDER BY p.nombre
    `)
  },
  restaurarCliente(id) {
    run('UPDATE clientes SET activo=1 WHERE id=?', [id])
    return { ok: true }
  },
  restaurarPlan(id) {
    run('UPDATE planes_catalogo SET activo=1 WHERE id=?', [id])
    return { ok: true }
  },
  restaurarProducto(id) {
    run("UPDATE productos SET eliminado=0, eliminado_at=NULL, activo=1 WHERE id=?", [id])
    return { ok: true }
  },
  eliminarPermanenteCliente(id) {
    run('DELETE FROM clientes WHERE id=? AND activo=0', [id])
    return { ok: true }
  },
  eliminarPermanentePlan(id) {
    run('DELETE FROM planes_catalogo WHERE id=? AND activo=0', [id])
    return { ok: true }
  },
  eliminarPermanenteProducto(id) {
    run('DELETE FROM productos WHERE id=? AND eliminado=1', [id])
    return { ok: true }
  },
}

// ─── Respaldos ────────────────────────────────────────────────────────────────

const respaldosDB = {
  exportarTodo() {
    const tablas = [
      'clientes', 'planes_catalogo', 'membresias', 'asistencias', 'pagos',
      'usuarios', 'roles', 'permisos', 'roles_permisos',
      'categorias_productos', 'proveedores', 'productos', 'movimientos_stock',
      'caja_sesiones', 'caja_movimientos',
      'descuentos', 'configuracion_modulos', 'configuracion_empresa',
      'notas_cliente',
    ]
    const data = { version: 1, fecha: new Date().toISOString(), tablas: {} }
    for (const tabla of tablas) {
      try { data.tablas[tabla] = queryAll(`SELECT * FROM ${tabla}`) } catch { data.tablas[tabla] = [] }
    }
    return data
  },
  restaurarDesdeDatos(data) {
    if (!data || !data.tablas) throw new Error('Formato de respaldo inválido')
    const orden = [
      'roles', 'permisos', 'roles_permisos', 'usuarios',
      'clientes', 'planes_catalogo', 'membresias', 'asistencias', 'pagos',
      'notas_cliente', 'categorias_productos', 'proveedores', 'productos',
      'movimientos_stock', 'caja_sesiones', 'caja_movimientos',
      'descuentos', 'configuracion_modulos', 'configuracion_empresa',
    ]
    for (const tabla of orden) {
      const filas = data.tablas[tabla]
      if (!filas || !filas.length) continue
      try {
        db.run(`DELETE FROM ${tabla}`)
        for (const fila of filas) {
          const cols = Object.keys(fila)
          const vals = Object.values(fila)
          const placeholders = cols.map(() => '?').join(',')
          db.run(`INSERT OR REPLACE INTO ${tabla} (${cols.join(',')}) VALUES (${placeholders})`, vals)
        }
      } catch (_) {}
    }
    saveDB()
    return { ok: true }
  },
  info() {
    return { tamaño: fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0, ruta: DB_PATH }
  },
}

// ─── Datos de Prueba ─────────────────────────────────────────────────────────

const datosPrueba = {
  contar() {
    const safe = (sql) => { try { return queryOne(sql)?.n || 0 } catch { return 0 } }
    return {
      clientes: safe('SELECT COUNT(*) as n FROM clientes WHERE es_prueba=1'),
      membresias: safe('SELECT COUNT(*) as n FROM membresias WHERE es_prueba=1'),
      asistencias: safe('SELECT COUNT(*) as n FROM asistencias WHERE es_prueba=1'),
      productos: safe('SELECT COUNT(*) as n FROM productos WHERE es_prueba=1'),
      ventas: safe('SELECT COUNT(*) as n FROM ventas WHERE es_prueba=1'),
      cajas: safe('SELECT COUNT(*) as n FROM caja_sesiones WHERE es_prueba=1'),
      pagos: safe('SELECT COUNT(*) as n FROM pagos WHERE es_prueba=1'),
      facturas: safe('SELECT COUNT(*) as n FROM facturas WHERE es_prueba=1'),
    }
  },

  generar() {
    const ya = queryOne('SELECT COUNT(*) as n FROM clientes WHERE es_prueba=1')
    if (ya && ya.n > 0) return { ok: false, error: 'Ya existen datos de prueba. Elimínalos primero.' }

    const addDays = (base, d) => {
      const dt = new Date(base)
      dt.setDate(dt.getDate() + d)
      return dt.toISOString().split('T')[0]
    }
    const addDaysFromNow = (d) => addDays(new Date(), d)
    const fmtDateTime = (dateStr, hour) => `${dateStr} ${String(hour).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`
    const today = new Date().toISOString().split('T')[0]
    const month = today.slice(0, 7)

    // ─── Clientes ────────────────────────────────────────────────────────
    const clientesData = [
      { nombre:'Juan Carlos', apellido:'Mamani Quispe', carnet:'7234891', ext:'LP', tel:'71234567', email:'jcmamani@gmail.com', nac:'1990-03-15', gen:'M', prof:'Contador' },
      { nombre:'María Fernanda', apellido:'Choque Apaza', carnet:'8134562', ext:'CB', tel:'62345678', email:'mfchoque@gmail.com', nac:'1995-05-22', gen:'F', prof:'Estudiante' },
      { nombre:'Luis Alberto', apellido:'Flores Condori', carnet:'6523478', ext:'LP', tel:'75678901', email:'laflores@gmail.com', nac:'1988-11-08', gen:'M', prof:'Ingeniero' },
      { nombre:'Ana Gabriela', apellido:'Vargas Mendoza', carnet:'9012345', ext:'SC', tel:'68901234', email:'agvargas@hotmail.com', nac:'1997-05-18', gen:'F', prof:'Diseñadora' },
      { nombre:'Carlos Eduardo', apellido:'Rojas Gutiérrez', carnet:'7456123', ext:'CB', tel:'72345890', email:'cerojas@gmail.com', nac:'1985-07-30', gen:'M', prof:'Médico' },
      { nombre:'Patricia Isabel', apellido:'Cruz Villca', carnet:'8901234', ext:'LP', tel:'65432190', email:'picruz@gmail.com', nac:'1992-01-12', gen:'F', prof:'Profesora' },
      { nombre:'Roberto Daniel', apellido:'Colque Ramos', carnet:'6789012', ext:'CH', tel:'76543210', email:'rdcolque@outlook.com', nac:'1983-09-25', gen:'M', prof:'Abogado' },
      { nombre:'Daniela Andrea', apellido:'Ticona Mamani', carnet:'9234567', ext:'LP', tel:'69876543', email:'daticona@gmail.com', nac:'1999-05-05', gen:'F', prof:'Estudiante' },
      { nombre:'José Miguel', apellido:'Aruquipa Yujra', carnet:'7890123', ext:'LP', tel:'73456789', email:'jmaruquipa@gmail.com', nac:'1991-12-20', gen:'M', prof:'Empresario' },
      { nombre:'Lucía Beatriz', apellido:'Sandoval Paredes', carnet:'8345678', ext:'SC', tel:'64321098', email:'lbsandoval@gmail.com', nac:'1994-04-07', gen:'F', prof:'Nutricionista' },
      { nombre:'Miguel Ángel', apellido:'Quispe Huanca', carnet:'7012345', ext:'LP', tel:'77654321', email:'maquispeh@gmail.com', nac:'1987-06-14', gen:'M', prof:'Arquitecto' },
      { nombre:'Carmen Rosa', apellido:'Apaza Morales', carnet:'9456789', ext:'CB', tel:'61234567', email:'crapaazm@hotmail.com', nac:'1993-10-03', gen:'F', prof:'Farmacéutica' },
      { nombre:'Diego Fernando', apellido:'Mamani Chura', carnet:'6234567', ext:'LP', tel:'74567890', email:'dfmamani@gmail.com', nac:'1996-02-28', gen:'M', prof:'Técnico' },
      { nombre:'Sofía Alejandra', apellido:'Lima Cáceres', carnet:'8567890', ext:'SC', tel:'67890123', email:'salima@gmail.com', nac:'2000-08-16', gen:'F', prof:'Universitaria' },
      { nombre:'Andrés Sebastián', apellido:'Torrez Balcázar', carnet:'7123456', ext:'LP', tel:'71098765', email:'astorrez@gmail.com', nac:'1989-05-30', gen:'M', prof:'Economista' },
      { nombre:'Valeria Nicole', apellido:'Soria Heredia', carnet:'9678901', ext:'LP', tel:'63210987', email:'vnsoria@gmail.com', nac:'1998-03-09', gen:'F', prof:'Comunicadora' },
      { nombre:'Ricardo Iván', apellido:'Condori Poma', carnet:'6890123', ext:'CB', tel:'75432109', email:'ricondori@gmail.com', nac:'1986-11-22', gen:'M', prof:'Docente' },
      { nombre:'Natalia Paola', apellido:'Gutiérrez Ríos', carnet:'8012345', ext:'LP', tel:'68765432', email:'npgutierrez@gmail.com', nac:'1995-07-11', gen:'F', prof:'Psicóloga' },
      { nombre:'Fernando Abel', apellido:'Alvarado Vásquez', carnet:'7567890', ext:'SC', tel:'72109876', email:'faalvarado@outlook.com', nac:'1984-04-19', gen:'M', prof:'Contador' },
      { nombre:'Claudia Beatriz', apellido:'Mercado Salinas', carnet:'9123456', ext:'LP', tel:'65098765', email:'cbmercado@gmail.com', nac:'1991-09-01', gen:'F', prof:'Administradora' },
    ]

    // Fechas de registro variadas (últimos 6 meses)
    const registros = [-175,-155,-140,-120,-105,-90,-80,-70,-60,-50,-45,-40,-35,-30,-25,-20,-15,-10,-5,-2]
    const clienteIds = []
    for (let i = 0; i < clientesData.length; i++) {
      const c = clientesData[i]
      const codigo = 'UFCP' + String(i + 1).padStart(4, '0')
      const fechaReg = fmtDateTime(addDaysFromNow(registros[i]), 9 + Math.floor(Math.random() * 4))
      db.run(
        `INSERT INTO clientes (carnet, nombre, apellido, telefono, email, fecha_nacimiento, genero, profesion, extension_ci, codigo, activo, es_prueba, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,1,1,?)`,
        [c.carnet, c.nombre, c.apellido, c.tel, c.email, c.nac, c.gen, c.prof, c.ext, codigo, fechaReg]
      )
      const row = queryOne('SELECT last_insert_rowid() as id')
      clienteIds.push(row.id)
    }

    // ─── Planes — verificar/crear los 3 principales ──────────────────────
    const planesDisp = queryAll("SELECT id, nombre, precio, duracion_dias FROM planes_catalogo WHERE activo=1 ORDER BY precio ASC")
    const planBasico = planesDisp.find(p => p.precio <= 160) || planesDisp[0]
    const planEstand = planesDisp.find(p => p.precio > 160 && p.precio <= 280) || planesDisp[Math.min(1, planesDisp.length-1)]
    const planPremium = planesDisp.find(p => p.precio > 280) || planesDisp[planesDisp.length-1]

    // ─── Membresías ──────────────────────────────────────────────────────
    // 0-11: activos, 12-15: por vencer (1-7 días), 16-18: vencidos, 19: pausado
    const memConfig = [
      // activos (inicio hace 15-28 días, fin en 15-44 días)
      { i:0,  plan:planPremium, dInicio:-20, dFin:10,  metodo:'efectivo' },
      { i:1,  plan:planEstand,  dInicio:-15, dFin:15,  metodo:'qr' },
      { i:2,  plan:planBasico,  dInicio:-10, dFin:20,  metodo:'efectivo' },
      { i:3,  plan:planPremium, dInicio:-25, dFin:5,   metodo:'tarjeta' },
      { i:4,  plan:planEstand,  dInicio:-8,  dFin:22,  metodo:'efectivo' },
      { i:5,  plan:planBasico,  dInicio:-5,  dFin:25,  metodo:'qr' },
      { i:6,  plan:planPremium, dInicio:-28, dFin:2,   metodo:'efectivo' },
      { i:7,  plan:planEstand,  dInicio:-12, dFin:18,  metodo:'efectivo' },
      { i:8,  plan:planBasico,  dInicio:-18, dFin:12,  metodo:'transferencia' },
      { i:9,  plan:planPremium, dInicio:-3,  dFin:27,  metodo:'qr' },
      { i:10, plan:planEstand,  dInicio:-22, dFin:8,   metodo:'efectivo' },
      { i:11, plan:planBasico,  dInicio:-7,  dFin:23,  metodo:'efectivo' },
      // por vencer
      { i:12, plan:planPremium, dInicio:-29, dFin:1,   metodo:'efectivo' },
      { i:13, plan:planEstand,  dInicio:-28, dFin:2,   metodo:'qr' },
      { i:14, plan:planBasico,  dInicio:-27, dFin:3,   metodo:'efectivo' },
      { i:15, plan:planPremium, dInicio:-23, dFin:7,   metodo:'tarjeta' },
      // vencidos
      { i:16, plan:planEstand,  dInicio:-40, dFin:-10, metodo:'efectivo' },
      { i:17, plan:planBasico,  dInicio:-35, dFin:-5,  metodo:'efectivo' },
      { i:18, plan:planPremium, dInicio:-45, dFin:-15, metodo:'qr' },
      // pausado
      { i:19, plan:planEstand,  dInicio:-20, dFin:10,  metodo:'efectivo', pausado:true },
    ]

    const membresiaIds = []
    for (const m of memConfig) {
      const cid = clienteIds[m.i]
      const fi = addDaysFromNow(m.dInicio)
      const ff = addDaysFromNow(m.dFin)
      const estado = m.pausado ? 'pausada' : 'activa'
      db.run(
        "INSERT INTO membresias (cliente_id, plan_id, fecha_inicio, fecha_fin, monto_pagado, estado, es_prueba) VALUES (?,?,?,?,?,?,1)",
        [cid, m.plan.id, fi, ff, m.plan.precio, estado]
      )
      const mrow = queryOne('SELECT last_insert_rowid() as id')
      membresiaIds.push({ id: mrow.id, cliente_id: cid, monto: m.plan.precio, metodo: m.metodo, fi })

      db.run(
        "INSERT INTO pagos (cliente_id, membresia_id, monto, metodo, concepto, es_prueba, fecha) VALUES (?,?,?,?,?,1,?)",
        [cid, mrow.id, m.plan.precio, m.metodo, `Membresía - ${m.plan.nombre}`, fmtDateTime(fi, 10)]
      )
    }

    // ─── Asistencias — 90 días ────────────────────────────────────────────
    // Frecuencia por cliente (visitas/semana aproximado)
    const frecuencias = [5,4,5,3,4,2,3,5,4,3,4,2,5,3,4,2,3,4,2,3]
    // Solo clientes activos (índices 0-15, los vencidos y pausado no vienen)
    const clientesActivos = clienteIds.slice(0, 16)
    const horariosPico = [18,19,20,7,8,9,17,21,6]

    for (let daysAgo = 90; daysAgo >= 0; daysAgo--) {
      const fecha = addDaysFromNow(-daysAgo)
      const diaSemana = new Date(fecha).getDay() // 0=dom, 6=sab
      for (let ci = 0; ci < clientesActivos.length; ci++) {
        const freq = frecuencias[ci]
        // Mayor probabilidad días entre semana
        const prob = diaSemana === 0 ? freq / 14 : diaSemana === 6 ? freq / 10 : freq / 7
        if (Math.random() < prob) {
          const hora = horariosPico[Math.floor(Math.random() * horariosPico.length)]
          const min = Math.floor(Math.random() * 60)
          const dt = `${fecha} ${String(hora).padStart(2,'0')}:${String(min).padStart(2,'0')}:00`
          db.run("INSERT INTO asistencias (cliente_id, fecha_hora, es_prueba) VALUES (?,?,1)", [clientesActivos[ci], dt])
        }
      }
    }

    // ─── Proveedores de prueba ─────────────────────────────────────────────
    db.run("INSERT INTO proveedores (nombre, contacto, telefono, email, direccion, notas, es_prueba) VALUES (?,?,?,?,?,?,1)",
      ['Distribuidora FitNutrition', 'Marco Quispe', '72345001', 'ventas@fitnutrition.com.bo', 'Av. América #340, Cochabamba', 'Suplementos y proteínas'])
    const prov1 = queryOne('SELECT last_insert_rowid() as id').id

    db.run("INSERT INTO proveedores (nombre, contacto, telefono, email, direccion, notas, es_prueba) VALUES (?,?,?,?,?,?,1)",
      ['Comercial El Deportista', 'Sandra Mamani', '65432100', 'info@eldeportista.com.bo', 'Calle Comercio #512, La Paz', 'Accesorios y ropa deportiva'])
    const prov2 = queryOne('SELECT last_insert_rowid() as id').id

    // ─── Obtener IDs de categorías ─────────────────────────────────────────
    const catSupl = queryOne("SELECT id FROM categorias_productos WHERE nombre='Suplementos'")?.id || 1
    const catBeb  = queryOne("SELECT id FROM categorias_productos WHERE nombre='Bebidas'")?.id || 2
    const catSnack= queryOne("SELECT id FROM categorias_productos WHERE nombre='Snacks'")?.id || 3
    const catAcc  = queryOne("SELECT id FROM categorias_productos WHERE nombre='Accesorios'")?.id || 5

    // ─── Productos de prueba ──────────────────────────────────────────────
    const productosData = [
      { nombre:'Proteína Whey 1kg',    codigo:'SUPL001', cat:catSupl, prov:prov1, pc:120, pv:250, stock:23, smin:5 },
      { nombre:'Creatina 300g',        codigo:'SUPL002', cat:catSupl, prov:prov1, pc:60,  pv:120, stock:15, smin:5 },
      { nombre:'BCAA 250g',            codigo:'SUPL003', cat:catSupl, prov:prov1, pc:45,  pv:90,  stock:8,  smin:10 },
      { nombre:'Pre-entreno 300g',     codigo:'SUPL004', cat:catSupl, prov:prov1, pc:70,  pv:150, stock:12, smin:5 },
      { nombre:'Agua 600ml',           codigo:'BEB001',  cat:catBeb,  prov:prov2, pc:2,   pv:5,   stock:100,smin:20 },
      { nombre:'Bebida Isotónica 500ml',codigo:'BEB002', cat:catBeb,  prov:prov2, pc:6,   pv:12,  stock:45, smin:10 },
      { nombre:'Bebida Proteica 330ml',codigo:'BEB003',  cat:catBeb,  prov:prov1, pc:8,   pv:18,  stock:3,  smin:10 },
      { nombre:'Barra Proteica',       codigo:'SNK001',  cat:catSnack,prov:prov1, pc:7,   pv:15,  stock:30, smin:10 },
      { nombre:'Frutos Secos Mix 100g',codigo:'SNK002',  cat:catSnack,prov:prov2, pc:10,  pv:20,  stock:18, smin:5 },
      { nombre:'Guantes de Gym',       codigo:'ACC001',  cat:catAcc,  prov:prov2, pc:35,  pv:80,  stock:10, smin:5 },
      { nombre:'Shaker 700ml',         codigo:'ACC002',  cat:catAcc,  prov:prov2, pc:15,  pv:35,  stock:25, smin:5 },
      { nombre:'Toalla Deportiva',     codigo:'ACC003',  cat:catAcc,  prov:prov2, pc:20,  pv:45,  stock:0,  smin:5 },
    ]

    const productoIds = []
    for (const p of productosData) {
      db.run(
        `INSERT INTO productos (nombre, codigo, categoria_id, proveedor_id, precio_compra, precio_venta, stock, stock_minimo, activo, es_prueba, created_at)
         VALUES (?,?,?,?,?,?,?,?,1,1,datetime('now','localtime'))`,
        [p.nombre, p.codigo, p.cat, p.prov, p.pc, p.pv, p.stock, p.smin]
      )
      const pid = queryOne('SELECT last_insert_rowid() as id').id
      productoIds.push({ id: pid, ...p })
      if (p.stock > 0) {
        db.run(
          "INSERT INTO movimientos_stock (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, usuario_nombre, es_prueba) VALUES (?,?,?,?,?,?,?,1)",
          [pid, 'entrada', p.stock, 0, p.stock, 'Stock inicial de prueba', 'Sistema']
        )
      }
    }

    // ─── Cajas de los últimos 15 días ─────────────────────────────────────
    const cajaIds = []
    for (let day = 15; day >= 1; day--) {
      const fecha = addDaysFromNow(-day)
      const montoInicial = 200 + Math.floor(Math.random() * 300)
      const montoCalculado = montoInicial + 300 + Math.floor(Math.random() * 800)
      const diferencia = Math.random() > 0.7 ? (Math.random() > 0.5 ? 10 : -10) : 0
      db.run(
        `INSERT INTO caja_sesiones (usuario_id, usuario_nombre, fecha_apertura, monto_inicial, fecha_cierre, monto_calculado, monto_cierre, diferencia, estado, es_prueba)
         VALUES (1,'Administrador del Sistema',?,?,?,?,?,?,'cerrada',1)`,
        [
          `${fecha} 07:30:00`, montoInicial,
          `${fecha} 21:00:00`, montoCalculado,
          montoCalculado + diferencia, diferencia
        ]
      )
      const csid = queryOne('SELECT last_insert_rowid() as id').id
      cajaIds.push({ id: csid, fecha })
      db.run("INSERT INTO caja_movimientos (sesion_id, tipo, concepto, monto, usuario_nombre) VALUES (?,?,?,?,?)",
        [csid, 'apertura', 'Apertura de caja', montoInicial, 'Administrador del Sistema'])
      db.run("INSERT INTO caja_movimientos (sesion_id, tipo, concepto, monto, usuario_nombre) VALUES (?,?,?,?,?)",
        [csid, 'ingreso', 'Ingresos del día', montoCalculado - montoInicial, 'Administrador del Sistema'])
      db.run("INSERT INTO caja_movimientos (sesion_id, tipo, concepto, monto, usuario_nombre) VALUES (?,?,?,?,?)",
        [csid, 'cierre', 'Cierre de caja', montoCalculado + diferencia, 'Administrador del Sistema'])
    }

    // ─── Ventas de productos (últimos 30 días) ────────────────────────────
    const metodosPago = ['efectivo','efectivo','efectivo','qr','tarjeta']
    const ventasProducto = [
      [0, 1], [1, 2], [0, 1], [4, 2], [5, 1], [7, 3], [0, 1],
      [6, 1], [4, 3], [8, 2], [1, 1], [7, 2], [3, 1], [4, 5],
      [5, 2], [0, 2], [2, 1], [8, 1], [7, 3], [4, 2], [0, 1],
      [9, 1], [10, 2], [5, 3], [7, 1], [4, 2], [1, 1], [0, 2],
      [8, 1], [3, 1], [5, 2], [7, 2], [4, 1], [0, 3], [1, 1],
    ]

    for (let vi = 0; vi < ventasProducto.length; vi++) {
      const [prodIdx, qty] = ventasProducto[vi]
      const prod = productoIds[prodIdx]
      if (!prod) continue
      const subtotal = prod.pv * qty
      const daysAgo = Math.floor(vi * 30 / ventasProducto.length)
      const fechaV = fmtDateTime(addDaysFromNow(-daysAgo), 10 + Math.floor(Math.random() * 10))
      const metodo = metodosPago[Math.floor(Math.random() * metodosPago.length)]
      const cid = Math.random() > 0.4 ? clienteIds[Math.floor(Math.random() * 12)] : null

      db.run(
        "INSERT INTO ventas (cliente_id, usuario_id, tipo, subtotal, total, metodo_pago, estado, es_prueba, fecha) VALUES (?,1,'productos',?,?,?,'completada',1,?)",
        [cid, subtotal, subtotal, metodo, fechaV]
      )
      const vid = queryOne('SELECT last_insert_rowid() as id').id
      db.run(
        "INSERT INTO detalle_ventas_productos (venta_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal) VALUES (?,?,?,?,?,?)",
        [vid, prod.id, prod.nombre, qty, prod.pv, subtotal]
      )
    }

    // ─── Facturas simuladas (6) ───────────────────────────────────────────
    const fakeCUF = (n) => crypto.createHash('sha256').update(`123456789${n}SIMULACION`).digest('hex').toUpperCase()
    const factClienteData = [
      [clienteIds[0], 'Juan Carlos Mamani Quispe', '7234891', 'CI', 250.00, 'Membresía Premium'],
      [clienteIds[1], 'María Fernanda Choque Apaza', '8134562', 'CI', 150.00, 'Membresía Básica'],
      [clienteIds[2], 'Luis Alberto Flores Condori', '6523478', 'CI', 200.00, 'Membresía Estándar'],
      [clienteIds[3], 'Ana Gabriela Vargas Mendoza', '9012345', 'CI', 250.00, 'Membresía Premium'],
      [clienteIds[4], 'Carlos Eduardo Rojas Gutiérrez', '7456123', 'CI', 120.00, 'Proteína Whey 1kg'],
      [clienteIds[5], 'Patricia Isabel Cruz Villca', '8901234', 'CI', 90.00, 'BCAA + Creatina'],
    ]
    for (let fi = 0; fi < factClienteData.length; fi++) {
      const [cid, nombre, doc, tdoc, monto, concepto] = factClienteData[fi]
      const nFact = 9000 + fi + 1
      const diasAtras = -(fi * 5 + 2)
      const fechaE = addDaysFromNow(diasAtras) + ' ' + String(9 + fi).padStart(2,'0') + ':30:00'
      const cuf = fakeCUF(nFact)
      db.run(
        `INSERT INTO facturas (numero_factura,cuf,cufd_uso,fecha_emision,cliente_nombre,cliente_documento,
         cliente_tipo_doc,concepto,cantidad,precio_unitario,descuento,monto_total,metodo_pago,
         estado,es_simulacion,es_prueba,created_at)
         VALUES (?,?,?,?,?,?,?,?,1,?,0,?,'efectivo','SIMULADA',1,1,datetime('now','localtime'))`,
        [nFact, cuf, '1A2B3C4D5E6F7G8H9I0J', fechaE, nombre, doc, tdoc, concepto, monto, monto]
      )
    }

    // ─── Descuentos de prueba ─────────────────────────────────────────────
    const descuentosData = [
      { nombre:'Cumpleaños', tipo:'porcentaje', valor:15, aplica_en:'membresia', activo:1, descripcion:'15% de descuento en tu mes de cumpleaños' },
      { nombre:'Anual', tipo:'porcentaje', valor:10, aplica_en:'membresia', activo:1, descripcion:'10% descuento en planes anuales' },
      { nombre:'Estudiante', tipo:'porcentaje', valor:20, aplica_en:'membresia', activo:1, descripcion:'20% descuento con carnet estudiantil' },
      { nombre:'Referido', tipo:'monto_fijo', valor:50, aplica_en:'membresia', activo:1, descripcion:'Bs. 50 de descuento por traer un amigo' },
    ]
    for (const d of descuentosData) {
      try {
        db.run(
          "INSERT OR IGNORE INTO descuentos (nombre,tipo,valor,aplica_en,activo,descripcion,created_at) VALUES (?,?,?,?,?,?,datetime('now','localtime'))",
          [d.nombre, d.tipo, d.valor, d.aplica_en, d.activo, d.descripcion]
        )
      } catch {}
    }

    // ─── Auditoría de generación ──────────────────────────────────────────
    const auditAcciones = [
      ['Juan Mamani', 'ACCESO', 'auth', 'Login exitoso desde Control de Acceso'],
      ['María Choque', 'VENTA_CREADA', 'ventas', 'Venta de membresía Premium Bs. 250'],
      ['Admin', 'CLIENTE_CREADO', 'clientes', 'Nuevo cliente registrado: Luis Flores'],
      ['Admin', 'STOCK_AJUSTADO', 'inventario', 'Entrada de stock: Proteína Whey 1kg +20'],
      ['Admin', 'CAJA_ABIERTA', 'caja', 'Apertura de caja con Bs. 350'],
      ['Admin', 'FACTURA_EMITIDA', 'facturacion', 'Factura N° 9001 emitida (simulada)'],
    ]
    for (const [unom, accion, modulo, detalle] of auditAcciones) {
      db.run("INSERT INTO auditoria (usuario_nombre, accion, modulo, detalle) VALUES (?,?,?,?)",
        [unom, accion, modulo, detalle])
    }
    db.run(
      "INSERT INTO auditoria (usuario_nombre, accion, modulo, detalle) VALUES ('Sistema','DATOS_PRUEBA_GENERADOS','configuracion','Datos de prueba generados exitosamente')"
    )

    saveDB()
    const conteo = datosPrueba.contar()
    return { ok: true, conteo }
  },

  eliminar() {
    try {
      db.run("DELETE FROM detalle_ventas_productos WHERE venta_id IN (SELECT id FROM ventas WHERE es_prueba=1)")
      db.run("DELETE FROM caja_movimientos WHERE sesion_id IN (SELECT id FROM caja_sesiones WHERE es_prueba=1)")
      db.run("DELETE FROM movimientos_stock WHERE es_prueba=1")
      db.run("DELETE FROM asistencias WHERE es_prueba=1")
      db.run("DELETE FROM pagos WHERE es_prueba=1")
      db.run("DELETE FROM ventas WHERE es_prueba=1")
      db.run("DELETE FROM membresias WHERE es_prueba=1")
      db.run("DELETE FROM notas_cliente WHERE cliente_id IN (SELECT id FROM clientes WHERE es_prueba=1)")
      db.run("DELETE FROM clientes WHERE es_prueba=1")
      db.run("DELETE FROM productos WHERE es_prueba=1")
      db.run("DELETE FROM proveedores WHERE es_prueba=1")
      db.run("DELETE FROM caja_sesiones WHERE es_prueba=1")
      try { db.run("DELETE FROM facturas WHERE es_prueba=1") } catch {}
      db.run("INSERT INTO auditoria (usuario_nombre, accion, modulo, detalle) VALUES ('Sistema','DATOS_PRUEBA_ELIMINADOS','configuracion','Datos de prueba eliminados. Sistema listo para producción.')")
      saveDB()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  },

  resetear() {
    try {
      db.run("DELETE FROM detalle_ventas_productos")
      db.run("DELETE FROM caja_movimientos")
      db.run("DELETE FROM movimientos_stock")
      db.run("DELETE FROM asistencias")
      db.run("DELETE FROM pagos")
      db.run("DELETE FROM ventas")
      db.run("DELETE FROM membresias")
      db.run("DELETE FROM notas_cliente")
      db.run("DELETE FROM clientes")
      db.run("DELETE FROM productos")
      db.run("DELETE FROM proveedores")
      db.run("DELETE FROM caja_sesiones")
      db.run("DELETE FROM facturas")
      db.run("DELETE FROM log_facturacion")
      db.run("INSERT INTO auditoria (usuario_nombre, accion, modulo, detalle) VALUES ('Administrador','SISTEMA_RESETEADO','configuracion','Sistema reseteado completamente. Todos los datos operativos eliminados.')")
      saveDB()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  },
}

// Exponer helpers para el módulo de facturación
function getQueryHelpers() { return { queryAll, queryOne, run } }

module.exports = {
  initDB, saveDB,
  clientes, planes, membresias, asistencias, pagos, dashboard,
  auth, usuarios, sesiones, roles, permisos, auditoria, modulos,
  clientesExtra, notasCliente, dashboard2,
  ventas, descuentos, configuracionPOS,
  inventario, caja, papelera,
  membresiaMiembros,
  respaldosDB, datosPrueba,
  getQueryHelpers
}
