# Propuesta de inventario — versión 2 (nivel sistema maduro)

**Solo documento.** No se cambió código, esquema ni interfaz. Amplía `INVENTARIO_PROPUESTA.md` (v1) y reordena sus fases. Lo que depende del gimnasio o de la normativa está marcado **«a confirmar con el cliente»** (o con el contador); no se inventan requisitos. Ante dudas se eligió la opción más segura y se anotó (§5).

Leyenda — complejidad: **B** baja · **M** media · **A** alta. Rutas: `db` = `electron/database.cjs`; `inv` = `src/pages/admin/Inventario.jsx`. Toda la migración es compatible hacia atrás (solo `ADD COLUMN` con valor por defecto o tablas nuevas; nada se borra ni se renombra) y cada fase lleva respaldo previo, versión (`PRAGMA user_version`) y la puerta **vidrio-intacto** (vs `7498b6a`).

## 0. Hallazgos nuevos del código (se suman a los 3 de la v1)

1. **Los permisos solo se aplican en la interfaz.** Los manejadores IPC de `electron/main.cjs` (`inventario:ajustarStock`, `inventario:update`, `ventas:anular`…) no comprueban permiso alguno; `tienePermiso` (`src/context/AuthContext.jsx:70`) se usa en pantalla. En `inv` solo se usa `inventario.ver` (menú, `TopNav.jsx:40`); `inventario.crear_producto`, `editar_producto`, `eliminar_producto`, `ajustar_stock` existen en `db:470-476` pero **ninguna acción de Inventario los consulta**. Solo `ventas.anular` se aplica en pantalla (`Ventas.jsx:747`).
2. **No hay historial de precios**: `inventario.update` (`db:2360`) sobrescribe `precio_compra`/`precio_venta` sin dejar rastro, y no escribe en `auditoria`.
3. **Las claves foráneas no se hacen cumplir**: no hay `PRAGMA foreign_keys` en `db`, y `papelera.eliminarPermanenteProducto` (`db:2900`) hace `DELETE FROM productos` dejando `movimientos_stock` y `detalle_ventas_productos` huérfanos.
4. **El kardex no es sumable tal cual**: en `ajustarStock` (`db:2396`) el tipo `ajuste` guarda en `cantidad` el **stock objetivo**, no la diferencia (igual `deshacerLote`, `db:2576`); y en una venta con stock insuficiente `cantidad` ≠ `stock_anterior − stock_nuevo`. La regla correcta de conciliación es por `stock_nuevo − stock_anterior` y continuidad de la cadena, no `SUM(cantidad)`.
5. **Anular una venta no toca la caja**: `ventas.anular` (`db:2110`) solo cambia `estado`; los reportes filtran `estado='completada'` (`db:1405, 1414, 2009`), pero el `ingreso` en `caja_movimientos` creado por `venderProductos` (`db:2450`) no se revierte. *Por verificar con una prueba de cierre de caja; no se ejecutó.* Tampoco anula la factura (`facturacion.anular` es otro flujo).
6. **No hay librería de Excel ni de código de barras en la app**: `package.json` solo trae `qrcode`; la lectura de Excel la hace el servicio Python de la importación IA. Existe selección de foto de producto (`inventario:pickImage`, `main.cjs:448`), funcional sin conexión.
7. **Reportes**: `reportes.inventario` existe como permiso (`db:491`) pero ninguna pantalla lo usa; `Reportes.jsx` no tiene inventario.
8. **Impuestos**: `ventas` y `detalle_ventas_productos` no tienen campos de impuesto; `facturas` guarda `monto_total`, `descuento` y, desde una migración, `items` (`db:211-253`).

## 1. Los 16 puntos

### 1. Variantes de producto (tamaño, sabor, talla) con producto padre — **Opcional · a confirmar con el cliente** · cmpl. **A**
- *Código:* hoy cada variante sería un producto suelto («Whey 1kg Chocolate»); el emparejamiento por nombre de la importación IA (`ImportarIA.jsx`, clasificación nuevos/existentes) no distingue sabores.
- *Esquema:* `productos + producto_padre_id INTEGER NULL`, `+ atributos TEXT` (JSON: sabor, talla). Padre sin stock propio; la variante es el producto vendible. Filas existentes: `NULL` = producto simple.
- *Ventas:* el buscador muestra variantes agrupadas bajo el padre; el detalle de venta sigue apuntando al producto variante (sin cambio de tabla).
- *Importación IA:* riesgo mayor: «Whey choco» vs «Whey vainilla» no deben fusionarse; se mandan a revisión si hay hermanos con nombre similar. *Deshacer:* igual que hoy (por producto). *Reportes:* agregan por padre o por variante.
- *Prueba:* E2E: crear padre + 2 variantes, vender una, comprobar que solo baja su stock y que la IA no fusiona dos sabores.
- *Fase:* 11. Solo si el gimnasio vende ropa/suplementos con variantes.

### 2. Kits/combos que descuentan cada componente — **Opcional · a confirmar** · cmpl. **A**
- *Código:* `venderProductos` (`db:2424`) descuenta solo el `producto_id` de cada línea; no hay composición.
- *Esquema:* tabla nueva `kit_componentes(kit_id, componente_id, cantidad)`; `productos + es_kit INTEGER DEFAULT 0` (el kit no tiene stock propio; su disponibilidad = mínimo de componentes). Nada se altera en filas existentes.
- *Ventas:* al vender un kit se escriben movimientos `venta` por cada componente (con el mismo `venta_id`); el detalle conserva la línea del kit con su precio. Si falta un componente, se rechaza (según punto 10).
- *IA:* los kits no se crean por importación. *Deshacer/anular/devolver:* debe devolver cada componente (depende del punto 6). *Reportes:* el costo del kit = suma del costo de componentes (punto 3).
- *Prueba:* vender un kit de 2 componentes → ambos bajan; anular → ambos suben; kit con componente agotado → se rechaza sin tocar nada.
- *Fase:* 11. **A confirmar:** ¿el gimnasio vende combos?

### 3. Método de costo — **Imprescindible (decisión de método)** · cmpl. **M**
- *Código:* `productos.precio_compra` guarda un solo costo que se pisa a mano (`db:2360`); `detalle_ventas_productos` no guarda costo, así que el margen pasado se recalcularía con el costo de hoy y sería falso.

| | promedio ponderado móvil | último costo |
|---|---|---|
| valor del inventario | estable; refleja lo pagado por lo que hay | sobrevalora/subvalora si el último precio fue atípico |
| margen real de una venta | costo promedio al vender | costo de la última compra |
| complejidad | recalcular en cada entrada | trivial |
| auditabilidad | requiere guardar el promedio en cada movimiento | simple |
| ante inflación | suaviza | refleja reposición (sirve para fijar precio) |

- **Recomendación: promedio ponderado móvil** para valorar el inventario y calcular el margen real, **guardando también el último costo** como referencia para sugerir precio. *Motivo:* es el más estable con compras irregulares de pocos productos y no exige lotes. **A confirmar con el contador:** qué método se acepta fiscalmente.
- *Esquema:* `productos + costo_promedio REAL DEFAULT 0, + ultimo_costo REAL DEFAULT 0` (se inicializan con `precio_compra`); `movimientos_stock + costo_unitario REAL`; `detalle_ventas_productos + costo_unitario REAL` (foto del costo al vender). Ventas antiguas quedan con `NULL` y se reportan «sin costo registrado», no con un costo inventado.
- *Ventas:* la venta toma `costo_promedio` al momento. *IA:* una importación `sumar` sin precio no cambia el promedio (la entrada sin costo se marca y no promedia). *Deshacer:* debe revertir el promedio al valor previo (se guarda en el movimiento). *Reportes:* valor = Σ stock × costo_promedio; margen = precio − costo congelado.
- *Prueba:* compra 10 a 5 y 10 a 7 → promedio 6; venta congela 6; deshacer la última compra vuelve a 5.
- *Fase:* 4 (junto con compras, porque el costo nace en la compra).

### 4. Kardex como fuente de verdad: conciliación — **Imprescindible** · cmpl. **M**
- *Código:* ver hallazgo 4: `cantidad` es ambiguo en `ajuste`; `create` con `stock=0` no deja movimiento; datos de prueba (`db:3142`) crean stock con movimiento «Stock inicial de prueba».
- *Esquema:* sin cambio obligatorio. Opcional: `movimientos_stock + delta REAL` (siempre `stock_nuevo − stock_anterior`, calculado al escribir) para que sumar sea trivial; las filas viejas se rellenan con esa resta en la migración.
- *Regla:* para cada producto, (a) el primer `stock_anterior` es 0 o hay un movimiento «saldo inicial»; (b) cada `stock_anterior` = `stock_nuevo` del movimiento anterior; (c) el último `stock_nuevo` = `productos.stock`.
- *Herramienta:* reporte de diferencias (producto, stock real, stock según kardex, primer movimiento que rompe la cadena) y **reparación guiada**: nunca corrige en silencio; propone un movimiento `ajuste` «conciliación» con motivo, requiere permiso (punto 8) y queda auditado.
- *Impacto:* *Ventas* ninguno directo; *IA* y *deshacer* se vuelven verificables (el E2E comprueba la cadena); *reportes* confiables.
- *Prueba:* sobre una copia de `dev_data`, crear una discrepancia a propósito (UPDATE directo) y comprobar que se detecta y se repara con un movimiento; y que una BD sana da 0 diferencias. **Importante:** se debe correr primero sobre los datos reales para ver cuántas diferencias históricas existen antes de prometer «0».
- *Fase:* 2.

### 5. Inventario físico guiado (conteo ciego) — **sube a Imprescindible** · cmpl. **M**
- *Justificación:* hoy el único conteo es `ajustarStock` tipo `ajuste` (teclear el total, `inv:340`) o importar un conteo con «reemplazar» (`db:2465`). No hay lista de qué contar, ni conteo ciego (se ve el stock esperado), ni vista de diferencias, ni aprobación: cualquiera con acceso a la pantalla pisa el stock. Es la herramienta que corrige la deriva que el resto del sistema no puede evitar.
- *Esquema:* tablas nuevas `conteos(id, fecha, estado[borrador|contado|aprobado|cancelado], usuario_id, aprobado_por, nota)` y `conteo_lineas(conteo_id, producto_id, stock_sistema_congelado, contado, diferencia)`. Al aprobar se generan movimientos `ajuste` con motivo «Inventario físico #N». Nada existente cambia.
- *Ventas:* ventas durante el conteo: se guarda el stock del sistema al abrir y se ajusta por movimientos posteriores (o se avisa que conviene contar con ventas pausadas — **a confirmar** cómo trabaja el gimnasio). *IA:* un archivo con cantidades puede **alimentar un conteo** (borrador) en vez de «reemplazar» directo: es la forma segura de usar el modo reemplazar. *Deshacer:* un conteo aprobado se revierte con un movimiento inverso, no borrando. *Reportes:* informe de diferencias por conteo (valor de la merma).
- *Prueba:* E2E: abrir conteo ciego → contar → ver diferencias → aprobar → stock y kardex correctos; cancelar no cambia nada; aprobación exige permiso.
- *Fase:* 3.

### 6. Devolución parcial separada de la anulación — **Imprescindible** · cmpl. **M**
- *Código:* `ventas.anular` (`db:2110`) es todo o nada, no repone stock ni pregunta (hallazgo v1 nº 1); no existe devolución parcial.
- *Esquema:* tabla nueva `devoluciones(id, venta_id, fecha, usuario_id, motivo, monto)` y `devolucion_lineas(devolucion_id, producto_id, cantidad, vuelve_a_stock INTEGER, motivo_codigo)`. `movimientos_stock` ya tiene `venta_id` y `motivo`.
- *Comportamiento:* al **anular** o **devolver** se pregunta, por línea, «¿vuelve al stock?» (sí: movimiento `entrada` «Devolución venta #N»; no: se registra como merma con motivo, p. ej. «producto abierto»/«vencido») y se exige motivo. La anulación total es una devolución de todas las líneas.
- *Ventas:* el detalle muestra lo devuelto; el total neto de la venta = total − devoluciones. *Caja:* la devolución genera un `egreso` (hallazgo 5; **a verificar** y **a confirmar** cómo quiere el gimnasio devolver dinero: efectivo/nota de crédito). *Factura:* si la venta tiene factura, la anulación/nota de crédito sigue la normativa — **a confirmar con el contador** (ver punto 15). *IA/deshacer:* no interactúan. *Reportes:* ventas netas.
- *Prueba:* devolución parcial de 1 de 3 → stock +1 solo si «vuelve»; anular dos veces se rechaza; el total neto cuadra; el cierre de caja cuadra.
- *Fase:* 1 (anulación con stock) y 5 (devolución parcial).

### 7. Historial de cambios de precio — **Útil** · cmpl. **B**
- *Código:* hallazgo 2; `auditoria` existe (`db:381`, `iaAuditoria`/`auditoria.registrar` en `db:1709`) pero `inventario.update` no escribe en ella.
- *Esquema:* tabla nueva `precios_historial(id, producto_id, campo[precio_compra|precio_venta], valor_anterior, valor_nuevo, usuario_id, usuario_nombre, fecha, origen[manual|compra|importacion])`. Se escribe solo cuando el valor cambia.
- *Ventas:* ninguno (la venta ya guarda `precio_unitario`). *IA:* el producto nuevo con precio 0 que luego se completa queda como el primer registro «origen=manual». *Deshacer:* no revierte precios (la importación no los toca). *Reportes:* evolución del precio y del margen.
- *Prueba:* editar precio → una fila con anterior/nuevo/usuario; guardar sin cambiar el precio → ninguna fila.
- *Fase:* 6.

### 8. Permisos por rol y aprobación por umbral — **Imprescindible (permisos) / Útil (umbral)** · cmpl. **M**
- *Código:* hallazgo 1. Roles y permisos existen (`db:330-352`, `rol_permisos`), con 3 roles de sistema (Admin 1, Empleado 2, Cajero 3; `db:880-905`): Empleado tiene `inventario.ajustar_stock` y **no** `ventas.anular`; pero el IPC no verifica, así que la restricción es solo visual.
- *Esquema:* permisos nuevos insertados con `INSERT OR IGNORE` (`inventario.cambiar_precio`, `inventario.ver_costos`, `inventario.aprobar_ajustes`, `inventario.conteo`, `inventario.conciliar`, `ventas.devolver`); `config` (clave/valor) para `umbral_ajuste_aprobacion` (unidades o valor, **a confirmar**) y tabla `aprobaciones(id, tipo, referencia_id, solicitado_por, aprobado_por, estado, fecha)` solo para la fase de umbral. Los roles actuales conservan hoy su comportamiento (los permisos nuevos se asignan a Admin; a Empleado solo los que ya usaba).
- *Aplicación real:* verificar el permiso en el proceso principal (necesita saber el usuario de la sesión en cada llamada; hoy el IPC recibe `usuario_id` de la interfaz, que es confiable solo si la app es de uso interno — **decisión de seguridad a confirmar**; lo más seguro: el proceso principal guarda el usuario de la sesión al iniciar sesión y no acepta el id del cliente).
- *Ventas:* anular/devolver exigen permiso; ver costos oculta costo y margen a Cajero. *IA:* importar exige `inventario.ajustar_stock`; ajustes grandes de una importación pasan por aprobación. *Deshacer:* exige el mismo permiso que la acción. *Reportes:* `reportes.inventario` por fin se aplica; el costo se oculta sin `ver_costos`.
- *Prueba:* con un usuario Cajero, llamar por IPC a `inventario.ajustarStock` → rechazado; con Empleado → permitido; ajuste sobre el umbral → queda «pendiente de aprobación» y no cambia el stock hasta aprobarlo.
- *Fase:* 1 (permisos en el proceso principal) y 7 (umbral).

### 9. Órdenes de compra y reposición — **Útil** · cmpl. **M**
- *Código:* `proveedores` existe pero no hay compras; la entrada es un ajuste suelto (`inv:340`); `getStockBajo` (`db:2376`) lista bajo mínimo sin cantidad sugerida.
- *Esquema:* tablas nuevas `ordenes_compra(id, proveedor_id, estado[borrador|enviada|recibida_parcial|recibida|cancelada], fecha, nota, usuario_id)` y `orden_compra_lineas(orden_id, producto_id, cantidad_pedida, cantidad_recibida, costo_unitario)`. `productos + punto_reorden REAL NULL, + cantidad_reposicion REAL NULL` (si es NULL se usa `stock_minimo`).
- *Ventas:* ninguno. *IA:* un archivo de factura/remisión del proveedor se importa **como recepción de una orden** (mejor que «sumar» suelto), con costo. *Deshacer:* una recepción se revierte con movimiento inverso, solo si el stock no cambió (misma regla que `deshacerLote`). *Reportes:* compras por proveedor; sugerencia = lo que está bajo el punto de reorden, redondeado a la cantidad de reposición, agrupado por proveedor.
- *Prueba:* crear orden → recibir parcial → stock +recibido, costo promedio actualizado, estado «recibida_parcial»; recibir el resto → «recibida»; cancelar no toca stock.
- *Fase:* 4. **A confirmar:** ¿compran con orden formal o por llamada/WhatsApp? Si no usan órdenes, basta «registrar compra» (sin estados).

### 10. Stock negativo configurable por negocio — **Imprescindible** · cmpl. **B**
- *Código:* hallazgos v1: `Math.max(0, …)` en `db:2402, 2406, 2443` recorta en silencio; el POS bloquea por interfaz (`ControlAcceso.jsx:476, 579`).
- *Esquema:* `config` (clave `stock_negativo` = `no_permitir` | `permitir_con_aviso`); sin columnas nuevas. **Valor por defecto seguro: `no_permitir`.**
- *Ventas:* el backend rechaza la venta que deje stock < 0 (o la permite y la marca); *ajustes:* una salida mayor al stock se rechaza con mensaje. *IA:* `reemplazar` ya no puede dar negativo (valida ≥ 0). *Deshacer:* sin cambio. *Reportes:* lista de productos en negativo cuando se permite.
- *Prueba:* los 2 hallazgos de `test:e2e-ia` cambian de «CONFIRMADO» a rechazo; con la opción permitida, el stock queda negativo y el kardex cuadra (`cantidad = anterior − nuevo`).
- *Fase:* 1. **A confirmar:** ¿vende a veces productos antes de registrar la compra?

### 11. Archivar en lugar de borrar; integridad — **Imprescindible** · cmpl. **B**
- *Código:* `inventario.delete` (`db:2372`) es borrado lógico (`eliminado=1`, `activo=0`); `papelera.eliminarPermanenteProducto` (`db:2900`) borra la fila y deja el kardex y las ventas huérfanos (hallazgo 3).
- *Esquema:* `productos + archivado INTEGER DEFAULT 0` (distinto de «papelera»: archivado = ya no se vende pero se conserva con su historia; «papelera» = pendiente de borrar). Regla: **un producto con movimientos o ventas no se puede borrar permanentemente**; solo archivar. Sin cambios en filas existentes.
- *Ventas:* el buscador excluye archivados; las ventas históricas siguen mostrando el nombre (ya hay `nombre_producto` en el detalle). *IA:* un producto archivado que aparece en un archivo se ofrece «reactivar» en vez de crear duplicado. *Deshacer/restaurar:* `deshacerLote` ya soporta «eliminado»; se añade «archivado». *Reportes:* incluyen archivados con su historia.
- *Prueba:* intentar borrar permanentemente un producto con ventas → rechazado con motivo; archivar → no aparece en POS pero sí en reportes; reactivar → vuelve.
- *Fase:* 1.

### 12. Etiquetas, códigos de barras y foto — **Útil** · cmpl. **M**
- *Código:* `productos.codigo` y `imagen` existen; foto con `inventario:pickImage` (`main.cjs:448`, sin conexión); no hay generación de códigos (solo `qrcode` en dependencias) ni impresión de etiquetas; `buscarPOS` busca por `codigo LIKE` (`db:2392`), válido para lector USB que «teclea».
- *Esquema:* `productos.codigo` pasa a índice **único parcial** (`WHERE codigo IS NOT NULL AND codigo <> ''`), previa revisión de duplicados existentes (la migración **no** falla: lista los duplicados y no crea el índice hasta resolverlos). Opcional `productos + codigo_barras TEXT` si se separa SKU de barras.
- *Ventas:* Enter del lector agrega el producto exacto al carrito. *IA:* si el archivo trae código, se usa como primera clave de emparejamiento (más fiable que el nombre). *Deshacer:* sin cambio. *Reportes:* ninguno.
- *Impresión:* generar el código (Code128/EAN-13) **sin conexión** requiere una librería empaquetada (hoy no hay; se evaluaría su licencia y tamaño) y una hoja de etiquetas por la impresión del sistema. **A confirmar:** ¿qué impresora y qué tamaño de etiqueta tiene el gimnasio? ¿usa lector?
- *Prueba:* escanear (teclear + Enter) un código → agrega ese producto; código duplicado → rechazado; etiqueta generada coincide al releerla.
- *Fase:* 9.

### 13. Importar/exportar Excel/CSV con plantilla (además de la IA) — **Útil** · cmpl. **M**
- *Código:* hoy solo la importación IA lee Excel (servicio Python, `procesar_excel_archivo`, `scripts/ocr_service.py`) y es probabilística; no hay exportación del inventario ni plantilla (sin librería xlsx en el front; hallazgo 6). El respaldo es JSON cifrado (`respaldosDB`, `db:2908`), no para el usuario.
- *Esquema:* ninguno. Plantilla fija (columnas: código, nombre, categoría, unidad, costo, precio, stock mínimo, stock) con una **hoja de instrucciones y ejemplos marcados** (la plantilla entregada puede llevar filas de ejemplo; no se usan como dato).
- *Flujo:* exactamente el mismo del importador seguro (vista previa antes/después, todo o nada, deshacer), pero **determinista**: columnas por nombre, sin modelo, así que valida celda a celda con mensaje por fila. Exportar: inventario, kardex y reportes a CSV/XLSX (sin conexión; escribir XLSX desde el proceso principal con una librería empaquetada o CSV con BOM UTF-8 para Excel).
- *Ventas:* ninguno. *IA:* comparte `importarLote`. *Reportes:* exportables.
- *Prueba:* round-trip: exportar → importar el mismo archivo = 0 cambios; fila inválida rechaza el lote entero con la fila señalada.
- *Fase:* 8.

### 14. Reportes — **Útil (valor, más vendidos) / Opcional (ABC, cobertura, stock muerto)** · cmpl. **M**
- *Código:* hallazgo 7; datos disponibles: `detalle_ventas_productos` (con fecha en `created_at`), `movimientos_stock`, `productos`.
- *Definiciones (sin inventar umbrales):* **valor del inventario** = Σ stock × `costo_promedio` (punto 3; hasta entonces `precio_compra`, avisando que es aproximado); **cobertura en días** = stock ÷ venta diaria media de los últimos N días (N configurable; con poca historia se muestra «sin datos suficientes», no un número); **stock muerto** = con stock > 0 y sin ventas en N días (N a confirmar; por defecto 90, editable); **ABC** = ordenar por ventas (valor) acumuladas; A = primeros 80 %, B = siguientes 15 %, C = resto (cortes estándar editables, **a confirmar**); **margen por categoría** = (ventas − costo congelado) ÷ ventas, solo con ventas que tengan costo registrado (se informa cuántas quedaron fuera).
- *Esquema:* ninguno (calculado); si el rendimiento lo pide, índice `detalle_ventas_productos(producto_id)`.
- *Impacto:* *Ventas* excluye `estado='anulada'` y descuenta devoluciones; *IA* y *deshacer*: las entradas por importación no cuentan como ventas; *reportes* exportan (punto 13) y respetan `ver_costos` (punto 8).
- *Prueba:* con una BD sintética conocida cada reporte da el valor calculado a mano; el valor del inventario = Σ por producto (cuadre).
- *Fase:* 10.

### 15. Impuestos y facturación — **a confirmar con el cliente y con el contador** · cmpl. **A**
- *Qué hay hoy (código):* módulo de facturación electrónica: tablas `facturas` (número, CUF, CUFD, NIT del cliente, estado, XML, respuesta del servicio, `items`), `log_facturacion`, `configuracion_empresa` (NIT, razón social, sucursal, punto de venta, actividad económica), `credenciales_sfe` (ambiente, token, CUIS/CUFD), `certificado_digital` (`db:190-232`); permisos `facturacion.emitir/anular/…` (`db:463-467`); `MANUAL_FACTURACION.md`. `ventas`/`detalle_ventas_productos` **no** guardan impuesto ni código de producto fiscal; `productos` no tiene código/unidad fiscal.
- *Qué haría falta (sin asumir normativa):* saber si los productos del inventario se facturan y bajo qué clasificación; si el precio incluye impuesto; si se factura por línea; qué se hace con la factura al anular/devolver (punto 6). Posibles campos: `productos + codigo_fiscal TEXT, + unidad_fiscal TEXT, + gravado INTEGER DEFAULT 1` y `detalle_ventas_productos + impuesto REAL`. **No se propone ninguno hasta que el contador lo defina.**
- *Impacto:* *Ventas*: factura por productos; *IA*: los productos nuevos necesitarían clasificación fiscal (otro motivo para «pendiente de completar»); *deshacer*: no debe tocar productos ya facturados; *reportes*: libro de ventas.
- *Prueba:* no definible sin la normativa; se cubriría con un E2E contra el ambiente de pruebas del servicio de facturación (no verificable sin conexión ni credenciales).
- *Fase:* 12 (condicionada).

### 16. Multi-ubicación — **Recomendación: NO por ahora** · cmpl. **A**
- *Código:* el sistema es de una sola sucursal y una sola BD local (`configuracion_empresa.codigo_sucursal`, `punto_venta`; `db:190`); no hay concepto de ubicación en `productos` ni `movimientos_stock`.
- *Motivo del «no»:* un gimnasio típico tiene un solo punto de venta/bodega; multi-ubicación exige `stock_por_ubicacion`, transferencias y que cada venta/conteo/compra/reporte elija ubicación: toca todo el modelo y duplica la superficie de errores. La app es **offline y por PC**; varias sedes con stock compartido necesitarían sincronización, que no existe y contradice el diseño actual.
- *Cuándo sí:* **a confirmar** si hay más de una sede o separación bodega/mostrador con transferencias. *Camino barato si hace falta solo «bodega vs mostrador»:* un producto con `stock` (mostrador) y `stock_bodega` y un movimiento «traslado»; sin tabla de ubicaciones.
- *Esquema futuro (no ahora):* `ubicaciones`, `stock_ubicacion(producto_id, ubicacion_id, stock)`; `movimientos_stock + ubicacion_id` (defecto = la principal).
- *Fase:* ninguna (descartado salvo que el cuestionario lo pida).

## 2. Fases reordenadas (B.3 de la v1 revisado)

Criterio: primero lo que protege los datos y corrige fallos reproducidos; después lo que el kardex necesita para ser confiable; después comodidad y reportes. Cada fase es pequeña, lleva **migración versionada con respaldo previo** (conteos de filas y Σ stock idénticos antes/después en una copia de `dev_data`), su prueba nueva dentro de `test:e2e-ia`/`test:ui`, y termina con **vidrio-intacto** en verde.

| fase | contenido | puntos | prueba principal |
|---|---|---|---|
| **0** | Migración versionada (`user_version`) + respaldo previo + verificación de conteos | — | conteos idénticos; idempotente; fallo simulado restaura |
| **1** | Seguridad básica: permisos aplicados en el proceso principal; anular repone stock con motivo; venta atómica; stock negativo configurable (defecto «no permitir»); archivar y no borrar con historial | 8 (parte), 6 (parte), 10, 11 | los 3 hallazgos pasan a rechazo/corrección; IPC rechaza sin permiso; borrado permanente bloqueado |
| **2** | «Pendiente de completar» (importación IA) + conciliación del kardex (solo lectura + reparación guiada) | v1 §B.5, 4 | importar crea pendiente no vendible; conciliación detecta una discrepancia sembrada |
| **3** | Inventario físico guiado | 5 | conteo ciego → diferencias → aprobar → kardex |
| **4** | Unidades y decimales (decisión #1, opción C mínima) | v1 §B.4 | 2,5 kg suma/reemplaza/deshace sin deriva |
| **5** | Compras y costo: orden/recepción, costo promedio ponderado, costo congelado en la venta | 9, 3 | promedio 6 y margen congelado |
| **6** | Devolución parcial y caja | 6 | devolución parcial; cierre de caja cuadra |
| **7** | Historial de precios y alertas (stock bajo en panel, por reposición) | 7, v1 #6 | fila de historial; alerta visible |
| **8** | Aprobación por umbral; motivos de merma en lista fija | 8 (umbral), v1 #9 | ajuste sobre umbral queda pendiente |
| **9** | Importar/exportar con plantilla | 13 | round-trip sin cambios |
| **10** | Reportes | 14 | cuadre contra cálculo a mano |
| **11** | Códigos de barras y etiquetas | 12 | escaneo agrega el producto |
| **12** | Opcionales según el cuestionario: variantes, kits | 1, 2 | por cada uno |
| **13** | Facturación de productos | 15 | solo si el contador lo define |
| — | Multi-ubicación | 16 | descartado salvo que el cliente lo pida |

*Cambios respecto a la v1:* la seguridad (permisos reales, integridad) pasa **antes** que las funciones nuevas porque hoy cualquier cosa puede pisar el stock; el conteo físico sube de «opcional» a fase 3; las compras y el método de costo van juntos (el costo nace en la compra); la devolución se parte en dos (anular repone stock = fase 1, devolución parcial = fase 6); lotes/vencimiento, equipos y caja con factor de la v1 quedan en «a confirmar» sin fase hasta contestar el cuestionario.

**Interfaz — reglas comunes (sin cambios):** componentes existentes (`clientes-glass-btn`, `Modal`, `FormField`, `gym-input`), tres apariencias y modo de contraste por variables de tema, etiquetas/`aria-label`, error con texto (no solo color), teclado completo, español, 100 % sin conexión, y **sin tocar `GlassEngine` ni el vidrio de Transparente**.

## 3. Cuestionario para el gimnasio real (10 preguntas, lenguaje simple)

1. ¿Qué vende hoy, además de membresías? (bebidas, suplementos, snacks, ropa, accesorios, otra cosa)
2. ¿Algo se vende **suelto o por peso o medida**? (por ejemplo, proteína por scoop, o por gramos) → decide decimales y unidades.
3. ¿Hay productos con **fecha de vencimiento** que le importe controlar? ¿Cuáles? → decide lotes/vencimiento.
4. ¿Un mismo producto viene en **sabores o tallas** distintos que quiera controlar por separado? ¿Vende **combos**? → variantes y kits.
5. ¿Cómo **repone**? ¿Hace pedidos formales a proveedores o llama/escribe cuando falta? ¿Compra por caja y vende por unidad? → órdenes de compra y caja con factor.
6. ¿Cada cuánto cuenta lo que tiene en físico y quién lo hace? ¿Se vende mientras se cuenta? → inventario físico.
7. ¿Quiénes pueden **cambiar precios, ajustar stock, anular o devolver**? ¿Quiere que un ajuste grande lo apruebe el dueño? ¿A partir de cuánto? → permisos y umbral.
8. Cuando un cliente **devuelve** algo: ¿se le devuelve el dinero, se cambia por otro producto o se le da crédito? ¿Lo devuelto vuelve a la venta o se tira?
9. ¿Se **factura** lo que se vende en el mostrador? ¿Los precios ya incluyen impuestos? (esta pregunta es también **para el contador**: método de costo aceptado y tratamiento de devoluciones/anulaciones.)
10. ¿Tiene **más de una sede o bodega**? ¿Usa **lector de código de barras** o impresora de etiquetas? ¿Qué le gustaría ver de reportes primero? → multi-ubicación, códigos y reportes.

## 4. Resumen de una página

**Qué cambió respecto a la v1**
- La v1 tenía 17 puntos de una línea; la v2 trata **los 16 pedidos, cada uno con justificación en el código** (archivo/función), esquema compatible, impacto en Ventas / IA / deshacer / reportes, prueba y fase.
- **Nuevos hallazgos del código** (§0): los permisos solo existen en la pantalla (el IPC no los verifica; `inventario.*` casi no se usa); no hay historial de precios; las claves foráneas no se cumplen y el borrado permanente deja huérfanos; el kardex no se puede sumar tal cual (`ajuste` guarda el objetivo); anular no toca la caja *(por verificar)*; no hay librería de Excel ni de barras en la app.
- **Prioridades que subieron:** permisos reales, stock negativo configurable, archivar/integridad, conteo físico, devolución separada y método de costo pasan a *imprescindible*.
- **Fases reordenadas** (0–13): seguridad e integridad primero, kardex confiable después, comodidad y reportes al final; cada una pequeña, con migración versionada y respaldo previo, su prueba y la puerta vidrio-intacto.
- **Recomendaciones:** costo **promedio ponderado móvil** (+ guardar último costo); **no** multi-ubicación por ahora; stock negativo **no permitido** por defecto.

**Decisiones que necesito de ti**
1. ¿Apruebas empezar por las fases **0 y 1** (migración con respaldo + permisos reales + anular repone stock + sin stock negativo silencioso + no borrar con historial)? Corrigen fallos ya reproducidos.
2. **Decisión #1** (unidades/decimales): ¿A (queda como está) o **C mínima** (recomendada, fase 4)?
3. **Método de costo:** ¿de acuerdo con promedio ponderado? (a confirmar con el contador).
4. **Seguridad:** ¿el proceso principal debe guardar el usuario de la sesión y rechazar el id que mande la pantalla? (más seguro; cambia cómo se llaman las funciones).
5. Enviar el **cuestionario** (§3) al gimnasio real: con sus respuestas se decide qué entra de lotes/vencimiento, variantes, kits, órdenes de compra, códigos de barras y facturación.
6. Confirmar que **no** se hace multi-ubicación salvo que el cuestionario lo pida.

## 5. Notas y supuestos (opciones más seguras elegidas)
- Donde un dato no existe (umbral de aprobación, días de stock muerto, cortes ABC, formato de etiqueta) se propone un valor **configurable** y se marca «a confirmar»; no se fija ninguno como definitivo.
- Se prefirió siempre: rechazar antes que corregir en silencio, ajustar con movimiento inverso antes que borrar, y valor por defecto que mantiene el comportamiento actual.
- **No verificado:** ninguna de las propuestas está implementada ni probada; la caja tras anular (hallazgo 5) y las diferencias históricas del kardex en los datos reales no se midieron; la viabilidad de una librería de códigos de barras/XLSX sin conexión (licencia, tamaño) no se evaluó.
