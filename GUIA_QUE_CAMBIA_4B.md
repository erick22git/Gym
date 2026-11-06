# Qué cambia para quien usa el sistema (Sprint 4B)

Todo sigue funcionando sin internet y en español. Los temas Transparente, Oscuro y Claro no cambian de aspecto.

**Fase 0 — Actualizaciones seguras.** Antes de actualizar la base de datos, el sistema guarda una copia de seguridad y comprueba que no se perdió nada. Si algo falla, vuelve a como estaba y te avisa.

**Fase 1 — Más seguro y más ordenado.** Cada acción de inventario y de ventas pide el permiso correcto y queda a nombre de quien inició sesión. Al anular una venta puedes decidir si el producto vuelve al stock. Vender es todo o nada: si algo falla, no queda una venta a medias. En Inventario (para quien puede configurar) eliges si se permite o no sacar con stock negativo (por defecto, no). Los productos se pueden **archivar** (dejan de venderse pero conservan su historia) y reactivar.

**Fase 2 — «Pendiente de completar» y revisión del kardex.** Los productos creados por importación quedan marcados hasta que completes su precio, y no se venden mientras tanto. Hay un panel para ver si el kardex (historial de movimientos) cuadra con el stock y repararlo con una entrada visible, nunca en silencio.

**Fase 3 — Conteo físico.** Una pestaña «Conteo físico» para contar sin ver el stock del sistema (conteo ciego). Al cerrar, ves las diferencias y se ajustan con un movimiento, quedando todo registrado.

**Fase 4 — Cantidades con decimales.** Cada producto puede venderse por kilo, litro, etc., con 0 a 3 decimales. Los productos de siempre siguen siendo en unidades enteras. En el POS, esos productos tienen un campo para escribir la cantidad exacta.

**Fase 5 — Compras y costo.** Nueva pestaña «Compras»: registras o pides mercadería a un proveedor y la recibes (total o en partes). El sistema calcula el **costo promedio** y el último costo. Puedes poner un punto de reorden y se sugiere qué reponer. Quien no tiene permiso de «ver costos» no los ve.

**Fase 6 — Devolución parcial.** En el detalle de una venta, «Devolver productos (parcial)»: eliges cuánto de qué producto, si vuelve al stock o es merma, y el motivo. Se descuenta de la caja y se muestra «Devuelto» y «Total neto». El total original no se altera.

**Fase 7 — Precios y alertas.** En la ficha de cada producto puedes ver el historial de cambios de precio (quién, cuándo y por qué). En el Dashboard y en Inventario aparece cuántos productos están sin stock, bajo el mínimo o por reponer.

**Fase 8 — Motivos y aprobación.** Toda salida o ajuste pide un motivo de una lista (merma, vencimiento, conteo, etc.). Opcionalmente, un administrador puede fijar un tamaño (en unidades) desde el cual un ajuste necesita **aprobación**; viene desactivado. Los pendientes aparecen en Movimientos, donde un administrador aprueba o rechaza.

**Fase 9 — Importar y exportar en CSV.** Pestaña «Importar / exportar»: descargas la **plantilla**, el **inventario actual** o el **kardex**, que abren bien en Excel. Para importar eliges un archivo, ves **qué cambiaría (antes → después)** y, si todo está bien, lo aplicas. Si una sola fila tiene error, no se importa nada y se te dice en qué línea. Una importación se puede **deshacer** mientras no haya movimientos posteriores. Las columnas se leen por su nombre y una celda vacía significa «no cambiar».

**Fase 10 — Reportes.** Pestaña «Reportes»: valor del inventario, más vendidos, rotación, días de cobertura, stock sin movimiento (por defecto 90 días, editable), clasificación ABC (80/15/5, editable) y margen por categoría. No cuentan las ventas anuladas y se restan las devoluciones. Si falta el costo de algún producto, el reporte lo dice en vez de inventar el dato. Cada reporte se puede descargar en CSV.

**Fase 11 — Códigos de barras.** Cada código de producto debe ser único (si ya tienes repetidos, el sistema te los muestra y no te bloquea). En la ficha del producto ves su código de barras. En el POS, **escribe o escanea el código y pulsa Enter**: se agrega ese producto exacto. En «Importar / exportar» puedes elegir productos y cuántas etiquetas de cada uno, y guardar una hoja PDF para imprimir.

**Qué NO cambia ni se hizo todavía:** variantes y kits, facturación de productos y varias sucursales quedan para más adelante, cuando se aclaren las preguntas pendientes con el contador.
