// Registro de acciones del asistente: UNA sola descripción (esquema JSON) que sirve para
//   · el resolutor por código (comandos con barra y palabras clave),
//   · el LLM como último recurso (se manda como catálogo al servicio; su salida se valida allá y acá),
//   · la tarjeta de aprobación (qué se le muestra al usuario antes de ejecutar).
// Ninguna acción escribe inventario ni dinero: lo que cambia datos sigue pasando por sus propias
// confirmaciones (modal de agregar/deshacer, cobro, cierre de caja). Acá solo se navega, se guía, se cambia
// la apariencia o se abre el selector de archivos.
import { PAGES } from '../constants'
import { GUIAS } from './guias'

export const DESTINOS = {
  control_acceso: { page: PAGES.CONTROL_ACCESO, etiqueta: 'Control de acceso', alias: ['control de acceso', 'acceso', 'recepcion', 'inicio'] },
  clientes: { page: PAGES.CLIENTS, etiqueta: 'Clientes', alias: ['clientes', 'cliente', 'socios'] },
  membresias: { page: PAGES.MEMBERSHIPS, etiqueta: 'Membresías', alias: ['membresias', 'membresia', 'planes contratados'] },
  ventas: { page: PAGES.VENTAS, etiqueta: 'Ventas', alias: ['ventas', 'las ventas'] },
  caja: { page: PAGES.CAJA, etiqueta: 'Caja', alias: ['caja', 'caja diaria'] },
  inventario: { page: PAGES.INVENTARIO, etiqueta: 'Inventario', alias: ['inventario', 'productos', 'stock'] },
  casilleros: { page: PAGES.CASILLEROS, etiqueta: 'Casilleros', alias: ['casilleros', 'casillero', 'llaves'] },
  reportes: { page: PAGES.REPORTES, etiqueta: 'Reportes', alias: ['reportes', 'reporte', 'estadisticas'] },
  ia: { page: PAGES.IA_IMPORTAR, etiqueta: 'IA / Importar datos', alias: ['ia', 'importar datos', 'asistente'] },
  configuracion: { page: PAGES.CONFIGURACION, etiqueta: 'Configuración', alias: ['configuracion', 'ajustes'] },
}

export const TEMAS = ['oscuro', 'claro', 'clasico']

export const MODOS = {
  preguntar: { etiqueta: 'Preguntar', detalle: 'Solo explica y responde. No hace nada en el sistema.' },
  actuar: { etiqueta: 'Actuar', detalle: 'Puede proponer acciones; siempre las confirmas tú.' },
}

// Catálogo en el formato que entiende el servicio (ver _esquema_acciones en scripts/ocr_service.py).
export const CATALOGO = {
  navegar: {
    descripcion: 'Llevar al usuario a una pantalla del sistema.',
    params: { destino: { tipo: 'enum', valores: Object.keys(DESTINOS) } },
  },
  iniciar_guia: {
    descripcion: 'Iniciar un recorrido guiado que ilumina, paso a paso, los botones a usar.',
    params: { guia: { tipo: 'enum', valores: Object.keys(GUIAS) } },
  },
  cambiar_tema: {
    descripcion: 'Cambiar el tema visual del asistente.',
    params: { tema: { tipo: 'enum', valores: TEMAS } },
  },
  importar_archivo: {
    descripcion: 'Abrir el selector para adjuntar una foto, Excel, Word o PDF de inventario.',
    params: {},
  },
  limpiar_chat: { descripcion: 'Empezar una conversación nueva.', params: {} },
}

export const EJEMPLOS_LLM = [
  { frase: 'quiero ir a ver mis clientes', acciones: [{ accion: 'navegar', destino: 'clientes' }] },
  { frase: 'enséñame a cerrar la caja', acciones: [{ accion: 'iniciar_guia', guia: 'cerrar_caja' }] },
  { frase: 'ponlo en modo oscuro', acciones: [{ accion: 'cambiar_tema', tema: 'oscuro' }] },
  { frase: 'quiero subir una foto de mi lista de productos', acciones: [{ accion: 'importar_archivo' }] },
]

// Texto legible de una acción (tarjeta de aprobación y registro).
export function describirAccion(a) {
  switch (a.accion) {
    case 'navegar': return `Ir a la pantalla «${DESTINOS[a.destino]?.etiqueta || a.destino}»`
    case 'iniciar_guia': return `Mostrarte paso a paso: ${GUIAS[a.guia]?.titulo || a.guia}`
    case 'cambiar_tema': return `Cambiar el tema a «${a.tema}»`
    case 'importar_archivo': return 'Abrir el selector para adjuntar un archivo de inventario'
    case 'limpiar_chat': return 'Empezar una conversación nueva'
    default: return a.accion
  }
}

// Validación en el cliente (defensa en profundidad: lo del LLM ya se validó en el servicio).
export function validarAccion(a) {
  if (!a || typeof a !== 'object' || !CATALOGO[a.accion]) return false
  for (const [pn, ps] of Object.entries(CATALOGO[a.accion].params || {})) {
    if (ps.tipo === 'enum' && !ps.valores.includes(a[pn])) return false
  }
  return true
}
