# Propuesta de inventario profesional (Sprint 4, Fase B)

Solo propuesta: **no se ha cambiado el esquema ni la lógica de stock**. Requiere aprobación antes de implementarse. La auditoría que la sostiene está en `INFORME_SPRINT4.md` §1. Cada punto indica si es una necesidad **observada en el código** o **a confirmar con el cliente** (depende de cada gimnasio; no se inventa).

## B.1 Priorización

Complejidad: **B** baja (columna + UI simple) · **M** media (lógica nueva + pruebas) · **A** alta (tablas nuevas, pantallas nuevas).

### Imprescindible

| # | punto | motivo (evidencia) | cmpl. |
|---|---|---|---|
| 1 | **Producto «pendiente de completar»** (importación IA) | La IA crea productos con precio $0 y mínimo 5; hoy se pueden vender a $0 y solo un texto del chat lo advierte (`ImportarIA.jsx`). Riesgo directo de ventas a $0 | B |
| 2 | **Anular venta devuelve el stock** | Hallazgo E2E confirmado: `ventas.anular` solo cambia `estado`; el stock queda descontado y el kardex sin contrapartida | B |
| 3 | **Venta atómica y sin stock negativo silencioso** | `venderProductos` no usa transacción (si falla a mitad queda venta sin todos los descuentos) y recorta el stock a 0 sin avisar; el kardex registra `cantidad=5` con `2→0`. Hoy solo la interfaz de Control de Acceso lo impide | M |
| 4 | **Cantidades decimales + unidad de medida real** (decisión #1, ver B.4) | Hoy «2,5 kg», «300 g», litros pasan a revisión. `productos.unidad` ya existe pero no gobierna nada | M |
| 5 | **Respaldo automático antes de migrar** + migración versionada | Las migraciones actuales son `ALTER … try/catch` sin versión ni respaldo (B.2) | M |
| 6 | **Alerta de stock bajo visible** fuera de la pestaña Inventario | `getStockBajo` existe en el backend, pero solo la pestaña Productos calcula «bajo»; Dashboard/Alertas no lo muestran | B |

### Útil

| # | punto | motivo | cmpl. |
|---|---|---|---|
| 7 | **Margen** (costo vs precio) visible y aviso si `precio_venta ≤ precio_compra` | Ya existen `precio_compra` y `precio_venta`; no se calcula ni se avisa | B |
| 8 | **Kardex filtrable y exportable** (producto, tipo, fecha, usuario) | `movimientos_stock` ya guarda tipo, motivo, usuario y venta; la pantalla solo lista paginado, sin filtros por producto, tipo, fecha ni usuario | B |
| 9 | **Motivos de merma/ajuste en lista fija** (rotura, vencido, robo, consumo interno, conteo) + obligatorio en salida/ajuste | Hoy el motivo es texto libre opcional; no se puede reportar «merma» | B |
| 10 | **Valor del inventario, más vendidos, rotación** (reporte) | Calculable con datos existentes (`stock×precio_compra`; `detalle_ventas_productos`) | M |
| 11 | **Compras a proveedor** (cabecera + líneas, entrada de stock, costo) | `proveedores` existe pero no hay compras: la entrada es un ajuste suelto sin documento. Mejor para costos reales | M |
| 12 | **Código de barras/SKU**: unicidad y búsqueda por lector | `productos.codigo` existe, sin índice único; el lector USB teclea en el buscador | B |

### Opcional / a confirmar con el cliente

| # | punto | por qué a confirmar | cmpl. |
|---|---|---|---|
| 13 | **Lotes y vencimiento** (suplementos, bebidas) | Depende de si el gimnasio vende perecederos y quiere trazabilidad; obliga a descontar por lote (FEFO) y toca ventas y deshacer | A |
| 14 | **Caja con factor** (compro por caja de 12, vendo por unidad) | Depende de cómo compre el cliente; se puede cubrir con `factor_compra` en un producto | M |
| 15 | **Equipos y activos con mantenimiento** | Es un módulo distinto del stock de venta (sin precio ni venta); a confirmar si lo quiere dentro de Inventario | A |
| 16 | **Inventario físico (conteo guiado)** | Hoy se hace con «ajuste» o importando un conteo; una hoja de conteo con diferencias es más cómoda | M |
| 17 | **Stock mínimo sugerido por rotación** | Requiere historial suficiente de ventas | M |

## B.2 Esquema: migración compatible hacia atrás

Principios: solo `ADD COLUMN` con valor por defecto; nada se borra ni se renombra; las filas viejas se comportan **igual que hoy** mientras no se active una función nueva; las lecturas del código actual siguen funcionando (`SELECT *`).

```
productos
  + unidad_medida      TEXT    DEFAULT 'unidad'  -- reutiliza el sentido de `unidad` (no se toca `unidad`; se copia al migrar)
  + permite_decimal    INTEGER DEFAULT 0         -- 0 = entero (comportamiento actual)
  + decimales          INTEGER DEFAULT 0         -- 0..3
  + pendiente_completar INTEGER DEFAULT 0        -- 1 = no vendible hasta tener precio
  + factor_compra      REAL    DEFAULT 1         -- (opcional #14) unidades por caja
  + requiere_vencimiento INTEGER DEFAULT 0       -- (opcional #13)
movimientos_stock
  + motivo_codigo      TEXT                      -- lista fija (#9); `motivo` libre se conserva
  + costo_unitario     REAL                      -- (#11) costo al momento del movimiento
ventas  (sin cambios)
detalle_ventas_productos
  + costo_unitario     REAL                      -- foto del costo para margen real (#10)
-- tablas nuevas, solo si se aprueban: compras, compra_detalle (#11); lotes_stock (#13); activos, mantenimientos (#15)
```

Notas técnicas verificadas en el código:
- `productos.stock` está declarado `INTEGER`, pero SQLite es de tipado dinámico: un `2.5` se guarda como real. **No hace falta cambiar el tipo de la columna**; lo que impide los decimales hoy es la validación (`Number.isInteger` en `importarLote`, `parseInt` en la interfaz).
- Para evitar errores de coma flotante (0,1+0,2): redondear siempre a `decimales` al escribir y comparar con tolerancia; en productos con `permite_decimal=0` se exige entero (como hoy).
- `restaurarDesdeDatos` / `exportarTodo` hacen `SELECT *` e `INSERT … (cols del respaldo)`: un respaldo viejo (sin columnas nuevas) se restaura bien porque las nuevas toman el valor por defecto. Un respaldo nuevo en una app vieja fallaría en silencio (`catch (_)`) — **limitación a documentar**.

**Respaldo y versión.** Añadir `PRAGMA user_version` (hoy no se usa). Al arrancar, si `user_version < N`: (1) copiar el archivo cifrado de la BD a `respaldos-migracion/urbanfitness.db.pre-vN.<fecha>` **antes** de cualquier `ALTER`; (2) migrar dentro de una transacción; (3) verificar que el conteo de filas de `productos`, `movimientos_stock`, `ventas`, `detalle_ventas_productos` y `SUM(stock)` no cambió; (4) si algo falla, restaurar la copia y arrancar con ella avisando. Solo entonces fijar `user_version`.

**Prueba de la migración** (en `test:e2e-ia` o un `test:migracion` nuevo): partir de una copia de `dev_data` con datos, capturar conteos por tabla y `SUM(stock)`, migrar, comparar idéntico; reabrir (idempotente, no re-respalda); simular fallo a mitad y comprobar que se restaura.

## B.3 Plan por fases (cada una con su prueba)

| fase | contenido | prueba | interfaz |
|---|---|---|---|
| 0 | Migración versionada + respaldo previo (#5) | conteos y stock idénticos; idempotente; fallo simulado restaura | ninguna |
| 1 | Seguridad de la venta: anular devuelve stock (#2), venta atómica, rechazo de stock insuficiente en el backend (#3) | E2E de ventas ya existente + casos: anular restaura, oversell se rechaza, fallo a mitad no deja nada | mensaje claro si se rechaza |
| 2 | «Pendiente de completar» (#1): `importarLote` crea con `pendiente_completar=1`; `buscarPOS`/`venderProductos` los excluyen; se limpia al guardar precio > 0; deshacer sigue funcionando | E2E: importar crea pendiente → no aparece en POS ni se vende → completar precio → vendible | etiqueta «Falta precio» (ya en la tarjeta de revisión), filtro y aviso «N productos por completar» en Inventario |
| 3 | Unidades y decimales (#4) según B.4 | E2E: 2,5 kg suma/reemplaza/deshace sin deriva; entero sigue rechazando decimales; venta fraccionada | selector de unidad y «permite decimales» en el formulario; cantidades con formato según `decimales` |
| 4 | Alertas y kardex (#6, #8, #9, #7) | UI-auto: alerta en panel y filtros; motivos obligatorios | tarjeta de stock bajo en panel, filtros/exportar en Movimientos, margen en la lista |
| 5 | Reportes (#10) y compras (#11) | cuadre: valor del inventario = suma por producto; compra suma stock y costo | pestañas nuevas «Reportes» y «Compras» |
| 6 | Opcionales aprobados (#13–#17) | según cada uno | según cada uno |

**Interfaz — reglas comunes:** reutilizar los componentes existentes (`clientes-glass-btn`, `Modal`, `FormField`, `gym-input`) y las variables de tema, de modo que las **tres apariencias** y el modo de contraste apliquen sin código nuevo; todo control con etiqueta y `aria-label`, estado de error con texto (no solo color), foco visible y teclado completo; **no se toca `GlassEngine` ni el efecto vidrio de Transparente** (se mantiene `vidrio-intacto` contra `7498b6a` como puerta de cada fase). Toda la interfaz en español y 100 % sin conexión.

## B.4 Decisión #1 (unidades y decimales): recomendación

| opción | BD | Ventas | Importación IA | Deshacer/restaurar | Reportes |
|---|---|---|---|---|---|
| **A** unidad dentro del nombre («Arroz 2,5 kg», cantidad 1) | sin cambio | sin cambio | sin cambio; ya funciona (va a revisión lo decimal) | sin cambio | no se puede sumar kilos, ni costo por kilo; «Arroz 1 kg» y «Arroz 2,5 kg» son productos distintos |
| **B** unidad en notas | sin cambio | sin cambio | sin cambio | sin cambio | peor que A: el dato queda en texto libre |
| **C** `unidad` + cantidad decimal | 4 columnas con defecto (B.2) | cantidades fraccionadas; validar por producto | admitir decimales solo si el producto lo permite y la unidad coincide; conversión g↔kg solo con regla explícita | comparaciones de stock con redondeo a `decimales` (hoy `prod.stock !== it.stock_nuevo` exacto) | sumas correctas por unidad; valor del inventario exacto |

**Recomendación: C, en su forma mínima y por producto** (`permite_decimal`, `decimales`, `unidad_medida`), con migración de la fase 0 y **sin conversiones automáticas entre unidades** (no se convierte g↔kg a ciegas; si el archivo trae «300 g» y el producto está en kg, va a revisión). Mientras no se apruebe, **A sigue siendo el comportamiento seguro y reversible** (ya vigente). Riesgos de C: deriva de coma flotante (mitigada redondeando) y que `deshacerLote` compare stock exacto (se cambia a comparar redondeado); ambos cubiertos por la prueba de la fase 3.

## B.5 Importación IA: flujo seguro para productos nuevos (A.3)

Hoy `importarLote` inserta `precio_compra=0, precio_venta=0, stock_minimo=5, unidad='unidad'`. Propuesta (fase 2): crear con `pendiente_completar=1`; no aparecen en el buscador del punto de venta ni se pueden vender; Inventario los lista primero con «Falta precio» y un contador; al guardar un precio de venta > 0 el producto pasa a vendible. No cambia el deshacer (sigue eliminando lo creado). Mientras no se apruebe, la tarjeta de revisión ya marca **«FALTA PRECIO»** en cada producto nuevo (Fase C.2) y el mensaje final lo recuerda.

## Qué necesito que decidas
1. ¿Apruebas la fase 0 (migración versionada con respaldo) y la 1 (anular devuelve stock, venta atómica)? Corrigen fallos reales ya reproducidos.
2. Decisión #1: ¿A (se queda) o C mínima (recomendada)?
3. ¿Qué de «opcional» necesita **el gimnasio real** (lotes/vencimiento, equipos, caja con factor)? No se implementa nada de eso sin confirmarlo.
