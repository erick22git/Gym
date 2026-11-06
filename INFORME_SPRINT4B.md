# INFORME — Sprint 4B: implementación de la propuesta de inventario (v2)

Rama: `feat/sprint4b-inventario-impl` (desde `feat/sprint4-inventario`). Documento base: `INVENTARIO_PROPUESTA_v2.md`.
Detalle técnico, decisiones y reservas de cada fase: `PROGRESO_4B.md`. Qué cambia para quien usa el sistema: `GUIA_QUE_CAMBIA_4B.md`.

## 1. Resumen en una línea
Las fases 0 a 11 se implementaron, probaron y commitearon **una por una**; ninguna se revirtió. No se tocó el efecto de vidrio (la prueba `vidrio-intacto` dio 7/7 al cierre de cada fase). Las fases 12 y 13 y el multi-local **no se implementaron** a propósito (ver §8). Varias pantallas nuevas **nunca se usaron con clics reales** (ver §7): las pruebas automáticas cubren los datos y los canales, no toda la interfaz.

## 2. Estado por fase

| Fase | Qué es | Estado | Commit |
|---|---|---|---|
| 0 | Migración versionada con respaldo previo y verificación de conteos | Hecha | `5432ef5` |
| 1 | Permisos en el proceso principal, anular con stock y caja, venta atómica, stock negativo configurable, archivar | Hecha | `87cb632` |
| 2 | Producto «pendiente de completar» y conciliación del kardex | Hecha | `2400def` |
| 3 | Inventario físico guiado (conteo ciego) | Hecha (con parte de la interfaz sin ejercitar) | `29378cd` |
| 4 | Unidades y decimales por producto (opción C mínima) | Hecha | `adc5aa6` |
| 5 | Compras, recepciones y costo promedio ponderado | Hecha | `094457f` |
| 6 | Devolución parcial de venta | Hecha | `05d9f4b` |
| 7 | Historial de precios y alertas de stock/reorden | Hecha | `09b39ee` |
| 8 | Aprobación por umbral (desactivada por defecto) y motivos de lista fija | Hecha | `7b765f8` |
| 9 | Importar / exportar CSV determinista con vista previa, todo o nada y deshacer | Hecha (solo CSV, sin XLSX) | `70d552a` |
| 10 | Reportes de inventario | Hecha | `9c5896b` |
| 11 | Códigos de barras, índice único de códigos, escáner en el POS, etiquetas | Hecha | `e727de7` |
| 12 | Variantes / kits | **No implementada** (decisión previa) | — |
| 13 | Facturación de productos | **No implementada** (decisión previa) | — |

Revertidas: **ninguna** (no hay `DECISIONES_PENDIENTES.md` porque no hizo falta).

## 3. Pruebas ejecutadas y resultados

Al cierre de la fase 11 (árbol final, commit `e727de7`):

| Prueba | Resultado |
|---|---|
| `npm run test:inv` (Node puro, copias de `dev_data` en `D:`) | **596 comprobaciones, 0 fallos** (fase0 20 · fase1 58 · fase2 36 · fase3 43 · fase4 50 · fase5 70 · fase6 56 · fase7 33 · fase8 47 · fase9 71 · fase10 51 · fase11 61) |
| `npm run test:e2e-ia` (Electron real por CDP, login real) | **Todo correcto** (incluye comprobaciones por el canal real de importar, reportes y códigos) |
| `npm run test:ui` (26 áreas, incluye `vidrio-intacto`) | **Todo correcto** en la 2.ª corrida, `vidrio-intacto` 7/7 |
| Migración (fase 0 y fase 11 sobre una BD «antigua» con duplicados) | Idempotente, con respaldo y verificación de conteos |

Qué NO fue limpio (honestidad):
- En la fase 11, la **1.ª corrida de `test:ui` tuvo 1 fallo de `foco-visible` en la página Casilleros** (que no se tocó); no se repitió en la 2.ª. Se trató como intermitencia, no se investigó más. Antes de eso, una corrida terminó con `no apareció el login` porque mezclé procesos propios; se repitió sola y salió completa.
- En fases 3 y 4, el menú con rueda al 200 % y los FPS de Inventario fallaron de forma intermitente mientras la máquina estaba saturada por otra sesión (llama-server); con la máquina más libre pasaron. **Los FPS y el menú al 200 % no se verificaron con la máquina completamente libre en todas las fases.**
- Un fallo real que encontró `test:e2e-ia` en la fase 9 (productos antiguos con `unidad_medida` vacía daban un «cambio falso» al exportar→importar) se corrigió y quedó con prueba propia.

## 4. Diferencias históricas del kardex (fase 2)
Se midió **antes** de prometer «cero diferencias»: **133 de 145 productos tenían diferencias históricas** («stock ≠ kardex»), **todas en productos de la papelera; 0 en productos vivos**. Causa: `deshacerLote` de un producto creado por importación dejaba `productos.stock` con el valor viejo; ya está corregido. Las 133 históricas **no se repararon** (no se modificó `dev_data`); en una instalación real las repara el usuario una por una con el panel de conciliación.

## 5. Dependencias nuevas
**Ninguna en la aplicación** (`package.json` no cambió; `package-lock.json` está modificado en el árbol de trabajo pero NO se commiteó, como se pidió).
- CSV y códigos de barras: implementación propia (`electron/csv.cjs`, `electron/codigobarras.cjs`), sin librerías.
- Hoja de etiquetas: `pdfkit` 0.14.0 (MIT), ya estaba instalado.
- Solo para pruebas (no se distribuyen, ya estaban en el Python del sistema): `zxing-cpp` (Apache-2.0) y `Pillow` (HPND) como lector independiente de códigos de barras. No agregan peso a la app.
- **XLSX no se implementó**: no había librería de planilla con licencia permitida ya instalada y no se justificó agregar una pesada. Solo CSV (UTF-8 con BOM, abre bien en Excel).

## 6. Decisiones que tomé por mi cuenta (resumen; el detalle y el porqué están en `PROGRESO_4B.md`)
- Permisos nuevos: `inventario.conciliar`, `.conteo`, `.aprobar_ajustes`, `.compras`, `.ver_costos`, `.importar`, `.exportar`, `ventas.devolver`. Admin los tiene todos; los demás roles solo reciben uno nuevo si ya tenían la acción equivalente (nadie gana ni pierde acceso). `importar` exige haber tenido crear + editar + ajustar stock.
- Aprobación de ajustes: **desactivada por defecto**; el umbral se mide en **unidades** (no en Bs.); quien puede aprobar no se frena a sí mismo (queda auditado).
- Devolución: no reajusta el costo promedio; solo para ventas de productos.
- Compras: no generan egreso de caja.
- Rotación = unidades vendidas ÷ stock actual (no costo de ventas ÷ inventario promedio). ABC: la clase se decide por el acumulado antes de sumar el producto. Stock muerto: un producto nuevo no cuenta como muerto.
- Importación CSV: tope 5000 filas / 8 MB; no cambia desde el archivo si un producto admite decimales; un nombre repetido sin código hace fallar la importación a propósito (ambiguo).
- Índice único de códigos: ignora mayúsculas/espacios, incluye archivados; **si hay duplicados no se arregla nada solo**, se avisan.
- Importación IA: no pasa por el umbral de aprobación (el conteo físico tiene su propio flujo de aprobación).

## 7. Lo que NO se pudo verificar
- **Interfaz con clics reales** (nunca ejercitada, solo compilada y revisada por las pruebas visuales de contraste/axe/foco): pestaña y flujo de conteo, pestaña de compras, panel de devolución, panel de aprobaciones y campo de umbral, selector de motivo, alertas del Dashboard y de Inventario, historial de precios, campo decimal en el POS, pestañas Importar/exportar y Reportes, vista previa del código de barras, sección de etiquetas, **Enter del escáner en el POS**.
- Diálogos del sistema (abrir/guardar archivos) y el archivo abierto en **Excel real**.
- **Impresión física**: tamaño real de etiqueta, impresora térmica y lectura con un **escáner físico**. Lo que sí se probó: los códigos se leen con un lector de software independiente, también los rectángulos que dibuja el PDF.
- Botón «enviar a conteo» en la importación IA (no se hizo); la importación IA no envía la unidad de medida.
- La importación IA solo reconoce el producto por nombre entre los no archivados (un duplicado archivado no ofrece «reactivar»).
- Rendimiento (FPS) y menú al 200 % con la máquina totalmente libre (ver §3).
- Restaurar un respaldo con códigos repetidos sobre una BD que ya tiene el índice único (no se probó ese cruce).

## 8. Pendientes del cuestionario / del contador (no implementados, sin código ni esquema)
- **Fase 12 — variantes y kits.**
- **Fase 13 — facturación de productos.**
- **Multi-local / varias ubicaciones.**
Necesitan respuestas del cuestionario y del contador antes de diseñarse; no se dejó nada a medias en el código.

## 9. Datos reales intactos y limpieza
- `dev_data` verificado por hash al terminar: `urbanfitness.db.hash` y `urbanfitness.db.sha256` coinciden con los de la referencia inicial (`PROGRESO_4B.md` líneas 7–8) y el archivo `.db` conserva su fecha anterior al sprint. Cada prueba además lo comprueba al terminar.
- Todo se probó sobre **copias** en `D:\Erick\tmp-4b` (borradas al cierre).
- Procesos propios cerrados: el servidor vite que yo había levantado (PID 14060); no queda nada en los puertos 5173, 8432 ni 11502. Los procesos de la sesión `eval-externa` son aparte y no se tocaron (solo bajé su prioridad a «por debajo de lo normal» durante el sprint, sin detenerlos).
- No se hizo merge a `main`. Solo se sube esta rama.

## 10. Commits de la rama (del más antiguo al más nuevo)
`5432ef5` fase 0 · `87cb632` fase 1 · `2400def` fase 2 · `29378cd` fase 3 · `adc5aa6` fase 4 · `094457f` fase 5 · `05d9f4b` fase 6 · `09b39ee` fase 7 · `7b765f8` fase 8 · `70d552a` fase 9 · `9c5896b` fase 10 · `e727de7` fase 11 (+ el commit de este informe).
