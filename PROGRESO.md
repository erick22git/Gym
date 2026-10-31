# PROGRESO — Sprint 2 (lectura de documentos)

Rama `feat/sprint2-lectura` (desde 5614306 sobre feat/fase3-diseno; el motor de vidrio es idéntico a 7498b6a). Sin merge a main.

| Paso | Estado | Nota |
|---|---|---|
| 0a Transparente idéntico (atribución) | pendiente | herramienta lista (`transparente-identico.mjs`, `atribuir-diferencias.py`); falta clasificar y revertir lo inesperado |
| 0b Ventas «Ver detalle» | pendiente | prueba `UI_SOLO=ventas-detalle` ya escrita; falta el arreglo en `src/pages/admin/Ventas.jsx` |
| 1 Set + arnés + línea base | HECHO | 39 sintéticos, `npm run eval:lectura`; línea base en `datos-evaluacion/resultados/LINEA_BASE.*` |
| 1.5 Omisión silenciosa = 0 | HECHO (tabla_compleja 21 → 0) | columnas por encabezado, celdas de 2 líneas, TOTAL fuera de «listos» |
| Guardia `vidrio-intacto` | escrita en `test:ui` (UI_SOLO=vidrio-intacto) | falta ejecutarla con la CPU libre (en la 1.ª vez Vite no cargó el login por la carga de la evaluación) |
| 2 Comparar lectores | pendiente | |
| 3 Mejoras 3.1–3.5 | pendiente | |
| 4 Regresión + informe final | pendiente | |

Reanudar evaluación: `npm run eval:lectura -- --lector actual` (usa caché; `--rehacer` para ignorarla). Ollama CPU: `GYM_OLLAMA_URL=http://127.0.0.1:11500`.
Reanudar pruebas de UI: `UI_SOLO=vidrio-intacto node scripts/pruebas/ui-auto.mjs`.
