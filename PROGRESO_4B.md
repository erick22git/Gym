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
