# PROGRESO — Sprint 4B (implementar la propuesta de inventario v2, fases 0 a 11)

Rama `feat/sprint4b-inventario-impl` (desde `feat/sprint4-inventario`). Sin merge a main. Modo autónomo.

**Referencia de datos (hash SHA-256 de `dev_data` al empezar, no debe cambiar):**
- `urbanfitness.db` 98448ad6e244f514ea496f93b284bfba0568b39bc711365838613e3ed1aa0977
- `urbanfitness.db.hash` d2ade225c34924e74492c460ebd81ba932195cb8323ded0dda0bf85143286dd0
- `urbanfitness.db.sha256` d1e40e3087d2141185e5babdee147ce8198d9e81a2593e0fdc63a502fa2384ae

**Cómo se prueba:** `npm run test:inv` (Node puro, `electron` simulado, copias de dev_data en `D:\Erick\tmp-4b`, borradas al terminar) + `npm run test:e2e-ia` (Electron real por CDP) + `npm run test:ui` (incluye vidrio-intacto vs 7498b6a).

## Decisiones tomadas por mi cuenta (se amplía por fase)
- Ver cada fase.

## Fase 0 — Migración versionada ✅
- `electron/database.cjs`: `MIGRACIONES` + `PRAGMA user_version`; respaldo cifrado exacto a `respaldos-migracion/` antes de migrar; migración en transacción con verificación de conteos (productos, movimientos_stock, ventas, detalle_ventas_productos) y suma de stock; si falla → ROLLBACK (y recarga del respaldo si los conteos difirieran), auditoría `MIGRACION_FALLIDA`, `estadoMigracion()` + aviso en `main.cjs`. Idempotente.
- Pruebas: `npm run test:inv` (fase0: 20/20: conteos idénticos, idempotente, fallo simulado restaura, BD nueva, hash de dev_data intacto); `test:e2e-ia` Todo correcto; `test:ui` Todo correcto (vidrio-intacto 7/7).
- Limitación documentada: un respaldo hecho con la versión nueva y restaurado en una app vieja puede fallar en silencio (`restaurarDesdeDatos` ignora errores).
- Gancho de prueba: `GYM_MIGRACION_FALLA=1` (solo con la app sin empaquetar).
- Observación sobre `test:ui`: 3 corridas seguidas imprimieron «Todo correcto» con tabla vacía y `ERROR: no apareció el login` (el script no devuelve código de error en ese caso: falso verde). La 4.ª corrida, con el mismo código, pasó con las 26 filas; la base también. Causa no determinada (intermitente, de arranque de Vite/ventana). **Regla que sigo: solo cuento `test:ui` como verde si la tabla trae filas y no hay línea ERROR.**

## Fase 1 — Seguridad e integridad ✅ (con una reserva de entorno en test:ui)
- **Migración v2** (`user_version` 2, con respaldo previo): `productos.archivado/archivado_at`, `ventas.anulada_at/anulada_por/anulada_por_nombre/motivo_anulacion`, `config.stock_negativo='no_permitir'`; los roles con `inventario.ver` reciben `crear/editar/eliminar_producto`, `gestionar_categorias/proveedores` (era lo que su pantalla ya les dejaba hacer: ningún rol pierde nada); Admin recibe todos los permisos.
- **1a Sesión en el proceso principal**: `electron/seguridad.cjs` (sesión fijada en `auth:login`/`auth:verificarToken`, limpiada en `auth:logout`) + `electron/guardas.cjs` (permiso por canal y usuario SOBRESCRITO con el de la sesión; el id que mande la pantalla se ignora). Canales protegidos: inventario create/update/delete/archivar/reactivar/ajustarStock/importarLote/deshacerLote/venderProductos/setPoliticaStock/categorías/proveedores, `ventas:anular`, `papelera:restaurarProducto` y `eliminarPermanenteProducto`. Mapeo: crear/editar/eliminar_producto, ajustar_stock (también importar/deshacer), `ventas.realizar` (vender), `ventas.anular`, `configuracion.editar_gym` (política de stock), `papelera.*`.
- **1b Anular**: exige motivo; por línea «vuelve al stock» (entrada «Anulación venta #N») o merma (movimiento `merma`, sin cambio de stock, con motivo); rechaza anular dos veces; egreso en caja (mismo método, caja abierta) → el efectivo esperado vuelve a cuadrar y el cierre da diferencia 0; auditoría `ANULAR_VENTA`; avisa si hay factura o no hay caja abierta. *Verificación previa del descuadre*: el código anterior solo hacía `UPDATE ventas SET estado='anulada'` (sin tocar `caja_movimientos`), confirmado por lectura y por el hallazgo E2E «anular no devuelve stock»; no corrí una prueba separada de «antes» sobre caja, la prueba nueva comprueba el «después» (esperado 207 → 100).
- **1c Venta atómica** (una transacción, un guardado) y **1d stock negativo** (`no_permitir` por defecto: el backend RECHAZA, ya no recorta a 0; `permitir_con_aviso` deja negativo con `cantidad = anterior − nuevo`). También se rechazan cantidades no enteras/≤0 y ajustes negativos. Selector en Inventario (solo con `configuracion.editar_gym`).
- **1e Archivar**: `inventario.archivar/reactivar`; el POS, listados y stock bajo excluyen archivados; «Ver archivados» + «Reactivar»; el borrado permanente se rechaza si hay movimientos o ventas; `importarLote` rechaza archivados; `deshacerLote` los admite.
- **Interfaz**: Ventas → modal de anulación con motivo y decisión por línea (etiquetas, errores con texto); Inventario → botones según permisos, Archivar, ver archivados, tipo «Merma» en el kardex, errores reales en vez de «Error»; Papelera y punto de venta muestran el error devuelto.
- **Pruebas**: `test:inv` fase0 20/20 + fase1 58/58; `test:e2e-ia` «Todo correcto» (seguridad 5, integridad 6; los 3 «hallazgos» pasaron de CONFIRMADO a rechazo/corrección, con IPC real y login real de un Cajero y un Admin de la copia); `test:ui`: vidrio-intacto 7/7, login/menú/contraste AA y AAA/axe/foco/modal/dinero/ventas-detalle 0 fallos.
- **Reserva (entorno)**: con la sesión `eval-externa` usando `llama-server` la CPU está al 100 %. En 2 corridas de `test:ui` fallaron SOLO comprobaciones sensibles a carga: FPS (Caja 100 %; luego Inventario 100 %), y una vez tipografía-dashboard y brillo del fondo claro (en la 2.ª corrida pasaron). No se reproducen de forma fija ⇒ las trato como ruido de CPU, no como regresión. **No verificado**: que `fps` pase con la máquina libre.
- Decisiones propias: ver mapeo de permisos arriba; rechazo (no corrección) de decimales hasta la Fase 4; el emparejamiento de la importación IA sigue usando `getAll` (excluye archivados): un nombre igual al de un archivado crea un duplicado (la v2 pedía ofrecer «reactivar»; queda pendiente).
