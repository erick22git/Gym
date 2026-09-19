# Conocimiento del sistema (Gimnasio)

Este documento resume las funciones principales del sistema, en lenguaje simple,
para que el Asistente IA pueda responder preguntas de uso sin inventar
funciones que no existen. No es exhaustivo — cubre lo más visible del panel
actual. Si una pregunta no está cubierta acá, el asistente debe decirlo
honestamente en vez de adivinar.

## Clientes y ventas rápidas (Control de Acceso)

- La pantalla de **Control de Acceso** es donde se registra la llegada de
  clientes con el buscador de arriba (por carnet, código o nombre).
- Ahí mismo hay dos botones: **"Nueva Venta"** (para vender un producto o
  plan rápido a alguien que ya está en el sistema) y **"Nuevo Cliente"**
  (para dar de alta a una persona nueva, con un asistente paso a paso que
  también permite abrir caja si hace falta).
- Si la caja del día todavía no está abierta, el sistema pide **"Abrir
  Caja"** antes de poder registrar la venta.

## Clientes (lista completa)

- La sección **Clientes** muestra el listado completo de clientes
  registrados, con su información y estado de membresía.

## Membresías

- La sección **Membresías** muestra los planes contratados por cada
  cliente: cuáles están activos, cuáles vencidos, y permite renovar o
  gestionar el plan de un cliente.

## Ventas y Caja

- **Ventas** (dentro de "Ventas y Caja") registra las ventas de productos o
  servicios realizadas.
- **Caja Diaria** es donde se abre y se cierra la caja del día:
  - **Abrir Caja**: se registra el monto inicial con el que arranca el día.
  - **Cerrar Caja**: al final del día, se cuenta el dinero real en caja y
    el sistema compara contra lo que debería haber según las ventas
    registradas, mostrando la diferencia si la hay.

## Inventario

- La sección **Inventario** muestra los productos disponibles (por
  ejemplo, suplementos, bebidas, insumos) con su cantidad en stock.
- Desde ahí se pueden agregar productos nuevos o ajustar cantidades a mano.
- La sección **IA / Importar Datos** (donde está este mismo asistente)
  permite cargar inventario de forma masiva adjuntando una foto de una
  lista escrita a mano o impresa, o un archivo Excel, Word o PDF — el
  sistema lee el contenido automáticamente y arma una lista de productos
  para revisar antes de agregarlos.

## Casilleros

- La sección **Casilleros** controla las llaves/casilleros del gimnasio:
  cuáles están en uso, a qué cliente están asignados, y permite
  asignar o liberar una llave.

## Reportes y Auditoría

- **Reportes** muestra estadísticas del negocio (ventas, ingresos, etc.).
- **Auditoría** lleva un registro de las acciones importantes hechas por
  los usuarios del sistema (quién hizo qué y cuándo).

## Configuración

- La sección **Configuración** agrupa el resto de los ajustes
  administrativos: gestión de usuarios y roles, gestión de planes,
  descuentos, respaldos de la base de datos, y la sección de IA.
- **Gestión de Usuarios** permite crear cuentas para el personal del
  gimnasio y asignarles un rol (Administrador, Empleado, Cajero) con
  distintos permisos.
- **Respaldos** permite crear una copia de seguridad de la base de datos
  o restaurar una anterior.

## Preguntas que este documento TODAVÍA no cubre

(el asistente debe admitir honestamente que no lo sabe si preguntan esto,
en vez de inventar una respuesta — ver PASO 2 del pedido original)

- Detalle paso a paso de cómo usar el asistente "Nuevo Cliente" (qué pide
  en cada pantalla del wizard).
- Cómo funciona la facturación (existe una sección de Facturación en el
  menú, pero no está documentada acá todavía).
- Cómo configurar el Punto de Venta y Pagos (existe la sección, sin
  documentar en detalle).
- Qué hace exactamente cada permiso dentro de Gestión de Usuarios.
- Cómo funcionan los descuentos (existe la sección, sin documentar).
- Detalles de qué información exacta muestra cada Reporte.
