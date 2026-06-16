# Escalabilidad — Urban Fitness Club

## Estado actual (2026)

- Motor: sql.js (SQLite cargado en memoria, persistido a archivo .enc cifrado)
- 36 tablas con `CREATE TABLE IF NOT EXISTS` (migraciones seguras)
- 29 índices en todas las foreign keys y columnas de fecha/estado consultadas frecuentemente
- Capacidad práctica sin degradación: hasta ~200-300 MB de archivo de BD
- Proyección a 20 años para este gimnasio: ~60-100 MB (cómodo, sin riesgo)

## Por qué sql.js es suficiente para este caso

sql.js carga toda la base en RAM al iniciar la app. Esto es excelente para velocidad (todo es instantáneo, sin latencia de red ni disco en consultas) mientras el archivo se mantenga en un rango razonable (decenas de MB).

El cuello de botella aparece solo si el archivo crece a varios cientos de MB, lo cual no es esperable para un gimnasio de tamaño normal incluso en 20+ años, dado el volumen de transacciones diarias típico de este negocio:
- ~10-30 asistencias/día → ~20 MB en 20 años solo por asistencias
- ~5-15 ventas/día → ~15 MB en 20 años por ventas
- Clientes, planes, caja, auditoría: despreciables comparados

## Señales de alerta (monitorear, no es necesario actuar ahora)

Verificar el tamaño del archivo `.enc` cada 6 meses en Configuración → Respaldos:

- El archivo de backup (.enc) supera los **250 MB**
- La app tarda más de **4-5 segundos en abrir** (hoy abre en menos de 1 segundo)
- Aparecen errores de memoria insuficiente al iniciar la app
- Se necesita **acceso simultáneo desde varias computadoras** a la vez (sql.js es de un solo proceso, no soporta multi-acceso concurrente)

## Mantenimiento recomendado

| Frecuencia | Acción |
|-----------|--------|
| Cada cierre de la app | Backup automático generado en `userData/backups_auto/` (automático) |
| Cada 1-2 meses | Copiar los backups automáticos a un pendrive como capa externa |
| Cada 3-6 meses | Ejecutar "Optimizar base de datos" en Configuración → Respaldos |
| Cada 6 meses | Revisar el tamaño del archivo `.enc` y comparar con las señales de alerta |

## Plan de migración cuando alguna señal se cumpla

### Opción 1 — Migrar a better-sqlite3 (cambio menor, recomendada primera)

`better-sqlite3` usa la misma sintaxis SQL pero **NO carga todo en RAM**: lee directo del disco con caché inteligente. Es el camino más simple cuando el archivo crece y el arranque empieza a notarse lento.

**Pasos:**
1. Exportar todos los datos con la función de backup existente (genera un `.enc` descifrable)
2. Instalar `better-sqlite3` y ajustar las pocas diferencias de API:
   - `db.run()` → `db.prepare(sql).run(...params)`
   - `db.exec()` → `db.exec(sql)`
   - La carga inicial cambia: en vez de `new SQL.Database(buffer)` se abre un archivo directamente
3. Importar los datos desde el `.enc`
4. La UI, los handlers IPC y todas las queries SQL **no necesitan cambios** — solo la capa de conexión a la BD cambia

### Opción 2 — Migrar a PostgreSQL (solo si hay múltiples sucursales)

Solo necesario si Urban Fitness Club abre más de una sucursal y necesita centralizar datos o consultarlos desde varias computadoras simultáneamente.

**Pasos:**
1. Exportar datos a JSON (función de backup existente)
2. Levantar PostgreSQL local o en un servidor
3. Adaptar las queries (la sintaxis SQL es muy similar; las diferencias son mínimas)
4. La UI no cambia — solo la capa de datos

## Contacto para migración futura

Si en el futuro se necesita ejecutar este plan de migración, contactar al desarrollador original (Erick — arancibiafloreserickmanuel@gmail.com) con este documento como referencia.

La arquitectura del proyecto fue diseñada para que esta migración sea de bajo riesgo: la lógica de negocio, la UI y los handlers IPC están completamente separados de la capa de acceso a la BD. Cambiar el motor de BD no requiere tocar React ni la lógica de negocio.
