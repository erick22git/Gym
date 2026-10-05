// Recorridos guiados ("alumbrar el botón"): 100 % código, sin IA. Cada paso apunta a un elemento por su
// atributo estable data-guide-id (no por clases ni textos, que cambian). El recorrido SOLO resalta: nunca
// hace clic por el usuario. Si el elemento no existe (permiso, módulo apagado, caja ya abierta…) el paso
// cae a su texto de respaldo y se registra para poder corregir el recorrido.
//
// Los pasos que cambian de pantalla (p. ej. entrar a Caja) se resuelven solos: el visor espera a que
// aparezca el elemento del paso siguiente cuando la persona hace clic en el resaltado.
//
// Recorridos iniciales = los que ya cubre scripts/conocimiento_sistema.md.
export const GUIAS = {
  nueva_venta: {
    titulo: 'Hacer una nueva venta',
    palabras: ['nueva venta', 'vender', 'registrar una venta', 'hacer una venta', 'venta rapida'],
    pasos: [
      { id: 'nav-ControlAcceso', texto: 'Entra a «Control de acceso» desde el menú de arriba.', respaldo: 'Abre «Control de acceso» desde el menú superior.' },
      { id: 'btn-nueva-venta', texto: 'Pulsa «Nueva Venta». Si la caja está cerrada, el sistema te pedirá abrirla primero.', respaldo: 'En «Control de acceso» está el botón «Nueva Venta». Si no lo ves, tu usuario puede no tener permiso de vender.' },
    ],
  },
  agregar_cliente: {
    titulo: 'Agregar un cliente nuevo',
    palabras: ['agregar cliente', 'nuevo cliente', 'cliente nuevo', 'dar de alta', 'registrar cliente', 'crear cliente', 'agregar un cliente'],
    pasos: [
      { id: 'nav-ControlAcceso', texto: 'Entra a «Control de acceso» desde el menú de arriba.', respaldo: 'Abre «Control de acceso» desde el menú superior.' },
      { id: 'btn-nuevo-cliente', texto: 'Pulsa «Nuevo Cliente»: se abre un asistente paso a paso para registrarlo.', respaldo: 'En «Control de acceso» está el botón «Nuevo Cliente».' },
    ],
  },
  abrir_caja: {
    titulo: 'Abrir la caja del día',
    palabras: ['abrir caja', 'abrir la caja', 'apertura de caja', 'abro la caja', 'abro caja'],
    pasos: [
      { id: 'nav-Caja', texto: 'Entra a «Caja» desde el menú de arriba.', respaldo: 'Abre «Caja» desde el menú superior (necesita el módulo de caja activo).' },
      { id: 'caja-abrir', texto: 'Escribe el monto inicial y pulsa «Abrir Caja».', respaldo: 'Si no ves «Abrir Caja», la caja de hoy ya está abierta.' },
    ],
  },
  cerrar_caja: {
    titulo: 'Cerrar la caja del día',
    palabras: ['cerrar caja', 'cerrar la caja', 'cierre de caja', 'cierro la caja', 'cierro caja'],
    pasos: [
      { id: 'nav-Caja', texto: 'Entra a «Caja» desde el menú de arriba.', respaldo: 'Abre «Caja» desde el menú superior.' },
      { id: 'caja-cerrar', texto: 'Pulsa «Cerrar Caja», cuenta el dinero real y el sistema te mostrará la diferencia.', respaldo: 'Si no ves «Cerrar Caja», la caja de hoy todavía no está abierta.' },
    ],
  },
  importar_inventario: {
    titulo: 'Importar inventario con IA',
    palabras: ['importar inventario', 'cargar inventario', 'importar productos', 'subir una foto', 'subir foto', 'subir una lista', 'inventario con ia', 'importar con ia'],
    pasos: [
      { id: 'nav-IAImportar', texto: 'Entra a «IA» desde el menú de arriba.', respaldo: 'Abre «IA» desde el menú superior.' },
      { id: 'ia-adjuntar', texto: 'Pulsa el «+» para adjuntar una foto, Excel, Word o PDF de tu inventario.', respaldo: 'En la pantalla de IA está el botón «+» (abajo a la izquierda) para adjuntar archivos.' },
      { id: 'ia-compositor', texto: 'Luego pulsa enviar. Revisarás todo antes de que se agregue nada al inventario.', respaldo: 'Envía el archivo desde el cuadro de texto de la pantalla de IA.' },
    ],
  },
  ver_inventario: {
    titulo: 'Ver el inventario',
    palabras: ['ver inventario', 'ver el inventario', 'ver mi inventario', 'ver productos', 'ver el stock', 'ver stock'],
    pasos: [
      { id: 'nav-Inventario', texto: 'Entra a «Inventario» desde el menú de arriba.', respaldo: 'Abre «Inventario» desde el menú superior (necesita el módulo de inventario activo).' },
      { id: 'inventario-lista', texto: 'Aquí ves los productos con su stock; desde aquí también puedes agregar o ajustar.', respaldo: 'La lista de productos está en la pantalla de Inventario.' },
    ],
  },
}

// ¿Qué recorrido corresponde a este texto? (código determinista: la frase más larga que coincida gana)
export function guiaDesdeTexto(textoNormalizado) {
  let mejor = null
  let largo = 0
  for (const [id, g] of Object.entries(GUIAS)) {
    for (const p of g.palabras) {
      if (textoNormalizado.includes(p) && p.length > largo) { mejor = id; largo = p.length }
    }
  }
  return mejor
}
