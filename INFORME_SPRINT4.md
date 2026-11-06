# Informe Sprint 4 — inventario profesional (auditoría + propuesta)

Rama `feat/sprint4-inventario` (desde `feat/sprint3-modelo`). Sin merge a main. **No se cambió el esquema ni la lógica de stock.** No se tocó GlassEngine ni el efecto vidrio. Los cambios de código son solo dos: pruebas E2E nuevas (C.1) y la marca «FALTA PRECIO» en la tarjeta de revisión (C.2). La propuesta completa está en `INVENTARIO_PROPUESTA.md`.

## 1. Auditoría del inventario actual (Fase A)

### A.1 Tablas (en `electron/database.cjs`)
| tabla | columnas relevantes |
|---|---|
| `productos` | id, nombre, codigo, descripcion, categoria_id, proveedor_id, precio_compra, precio_venta, **stock INTEGER**, stock_minimo (5), **unidad** (texto, 'unidad'), imagen, activo, eliminado, eliminado_at, es_prueba, created_at, updated_at |
| `movimientos_stock` (kardex) | producto_id, tipo (entrada/salida/ajuste/venta), **cantidad INTEGER**, stock_anterior, stock_nuevo, motivo (texto libre), usuario_id, usuario_nombre, venta_id, es_prueba, created_at |
| `categorias_productos` | nombre, descripcion, color, imagen, activo |
| `proveedores` | nombre, contacto, telefono, email, direccion, notas, activo |
| `ventas` + `detalle_ventas_productos` | la venta de productos guarda producto_id, nombre_producto, cantidad INTEGER, precio_unitario, subtotal (sin costo) |
| `ia_importaciones` | auditoría de cada importación (crudo, ediciones, final, resultado: …/agregado/deshecho) |
| `promociones`, `promocion_productos` | promociones por producto |

No existen: lotes, vencimiento, compras, activos/equipos, versión de esquema (`PRAGMA user_version` sin uso).

**Pantallas** (`Inventario.jsx`, pestañas): Productos (lista/cuadrícula, búsqueda, categoría, alta/edición, ajuste de stock), Categorías, Proveedores, Movimientos (kardex paginado, sin filtros), Promociones. Aparte: Importar IA (`ImportarIA.jsx`), Papelera (restaurar productos), Control de Acceso (venta de productos en el punto de venta), Ventas (historial, anular).

**Flujos**
- *Venta* (`inventario.venderProductos`): inserta `ventas`, por ítem inserta el detalle, descuenta `stock` (recortado a 0) y escribe un movimiento `venta` con `venta_id` y usuario; registra ingreso en caja si hay sesión. El punto de venta (Control de Acceso) limita la cantidad al stock en la **interfaz**; el backend no lo valida. Cada `run()` guarda el archivo cifrado; no hay transacción.
- *Compra*: no existe como tal; la entrada se hace con «Ajustar stock → Entrada» (sin documento ni costo).
- *Ajuste* (`ajustarStock`): tipos entrada / salida / ajuste (valor absoluto); motivo opcional libre; salida mayor que el stock se recorta a 0.
- *Importación IA* (`importarLote`): todo o nada en transacción; `sumar` (entrada) o `reemplazar` (ajuste, conteo); rechaza decimales; crea productos con precio 0 y mínimo 5.
- *Deshacer* (`deshacerLote`): todo o nada, rechaza si el producto cambió después (comparación exacta de stock), no se puede deshacer dos veces; lo creado va a la papelera.

### A.2 Qué falta para un gimnasio real
Resumen (detalle, motivo y complejidad en `INVENTARIO_PROPUESTA.md` B.1):
| necesidad | estado actual |
|---|---|
| unidad de medida | existe `unidad` como texto, no gobierna nada |
| cantidades decimales | no (entero en BD/validaciones/interfaz) |
| costo vs precio, margen | existen ambos precios; margen no se calcula; el detalle de venta no guarda costo |
| código de barras / SKU | `codigo` existe, sin unicidad |
| categorías | sí |
| stock mínimo por producto | sí (5 por defecto) |
| proveedores | sí (catálogo); **sin compras** |
| lotes y vencimiento | no |
| kardex con motivo y usuario | sí, pero motivo libre y sin filtros |
| merma/ajuste | solo como «salida» con texto libre |
| equipos y mantenimiento | no |
| alerta de stock bajo | solo marca visual en la pestaña Productos; `getStockBajo` sin uso en panel/alertas |
| por vencer | no aplica (no hay vencimiento) |
| reportes (valor, rotación, más vendidos) | no |

### A.3 Importación IA y productos nuevos
Se crean con precio $0, mínimo 5 y unidad «unidad»; son **vendibles de inmediato a $0**. Propuesta: estado «pendiente de completar» no vendible hasta tener precio (`INVENTARIO_PROPUESTA.md` B.5).

### A.4 Decisión #1
Recomendación: **opción C mínima por producto** (unidad + decimales opcionales), con migración versionada; A se mantiene mientras tanto. Tabla de impacto en BD / Ventas / importación / deshacer / reportes en `INVENTARIO_PROPUESTA.md` B.4. Hallazgo técnico: `stock` ya es de tipado dinámico en SQLite; el bloqueo de decimales está en la validación, no en el tipo.

## 2. Fase C

### C.1 E2E de ventas y ajuste manual (sin cambiar esquema ni lógica)
Añadido a `scripts/pruebas/e2e-ia.mjs` (copia descartable de la BD, Electron real). `npm run test:e2e-ia`: **todo correcto** (ventas 3/3, ajuste 5/5, más los 20 anteriores).
- Venta de dos productos: total 45 correcto; stock 20→17 y 6→4; movimiento `venta` con anterior/nuevo, `venta_id` y usuario.
- Ajuste manual: entrada 17→27, salida →23, conteo →21; cada uno en el kardex con su motivo y usuario; producto inexistente se rechaza.

**Hallazgos confirmados con la prueba** (registrados sin fallar la suite; el código no se cambió):
1. **Anular una venta de productos no devuelve el stock** (anular → ok, stock sigue descontado).
2. **El backend acepta vender más que el stock**: se vendieron 5 con stock 2; el stock queda 0 y el kardex dice `cantidad=5` pero `2→0` (no cuadra). La interfaz del punto de venta sí lo impide; el backend no.
3. **Una salida mayor que el stock se recorta a 0 sin avisar** (salida de 50 con stock 5 → ok, stock 0).

### C.2 Tarjeta de revisión
Cada producto nuevo muestra una etiqueta **«FALTA PRECIO»** (`data-testid="falta-precio"`, con texto, no solo color; ayuda: «Se creará con precio $0: complétalo en Inventario antes de venderlo»). Sin cambio de BD.

## 3. Cierre
- `npm run test:e2e-ia`: todo correcto (arriba).
- `npm run test:ui`: ver §4.

## 4. Lo que NO se pudo verificar
- La etiqueta «FALTA PRECIO» **no se vio en la ventana real**: la tarjeta de revisión requiere una importación completa con el servicio de análisis y modelo, que no se ejecutó en este sprint; está compilada por `test:ui` pero no verificada visualmente en las tres apariencias.
- **Nada de la propuesta está implementado ni probado**: migración, respaldo previo, «pendiente de completar», decimales. La migración con conteos idénticos está solo diseñada.
- Lo que cada gimnasio necesita (lotes/vencimiento, equipos, caja con factor, compras) es **a confirmar con el cliente**; no hay datos de uso real.
- La afirmación de que un respaldo nuevo en una app vieja falla en silencio sale de leer `restaurarDesdeDatos` (`catch (_)`), no se probó.
- Los hallazgos se confirmaron sobre la capa de datos real (IPC), no recorriendo la pantalla de Ventas.

## 5. Commits
Ver `git log feat/sprint4-inventario` (auditoría y propuesta · E2E de ventas y ajuste · «FALTA PRECIO» · informe).
