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


## Actualización (Paso 2)
- Paso 0a/0b: hecho. `vidrio-intacto` en `test:ui`: 7/7.
- Lectura con el pipeline actual + 3 arreglos: precisión 87 % -> 97 %, omisión silenciosa 21 -> 0 (set sintético completo).
- Paso 2(b) PP-StructureV3, muestra de 12 (tablas limpias 4, compleja 4, degradada 4): precisión 73 %, recall 55 %, omisión 34, inventados 17, p50 205 s.
  Pipeline actual en los mismos 12: precisión 92 %, recall 88 %, omisión 0, inventados 1, p50 76 s. PP-StructureV3 pierde y NO se adopta.
  Fallos: en fotos degradadas no detecta tabla (salida vacía) y con filas de categoría desfasa las columnas.
- Siguiente: (d) Granite-Docling, (c) PaddleOCR-VL, (e) DeepSeek-OCR (tope 10 GB; ya usados 1,4 GB); luego Paso 3 y 4.
- Reanudar: `python scripts/evaluacion/comparar.py ppstructure fix2_total` compara lectores.
- Paso 2(d) Granite-Docling-258M (CPU, torch en venv-eval-hf): MUESTRA PARCIAL de 3/12 (degradada_01..03; se cortó por lentitud: 800-1070 s/doc).
  Resultado en esas 3: 13/21 correctos (igual que el pipeline actual, 13/21) pero omisión 4 e inventados 7 (actual: 0 y 1). No se adopta.
  Etapas: `lectores/granite_extraer.py` (venv-eval-hf) -> `lectores/granite.py` (analizador de producción). Español/tildes/ñ: sin problemas visibles en las 3 lecturas.
- Ollama CPU para medir tiempos: `OLLAMA_HOST=127.0.0.1:11500 CUDA_VISIBLE_DEVICES=-1 ollama serve` y `GYM_OLLAMA_URL=http://127.0.0.1:11500`.
- Paso 2(c) PaddleOCR-VL-1.6 (CPU): SONDA de 1 documento (tabla_compleja_01). Cargó el modelo pero no terminó la predicción en 25 min (tiempo límite). No viable en CPU. No se pudo medir calidad.
- Paso 2(e) DeepSeek-OCR: NO evaluado (excede el tope de 10 GB; ver DECISIONES_PENDIENTES.md #4).
- Paso 2 CONCLUSIÓN: el lector principal sigue siendo el actual (PaddleOCR PP-OCR + analizador determinista con los 3 arreglos). Ninguna alternativa lo supera en precisión ni en tiempo.
- Siguiente: Paso 3 (3.1 a 3.5) con ablación, luego Paso 4 e INFORME_PRECISION.md.
- Paso 3.1 (ablación) enderezar inclinación de la foto antes de agrupar filas (`estimar_pendiente`, interruptor GYM_DESKEW=0 para apagar):
  degradada 83 % -> 100 % precisión, recall 81 % -> 98 %. Set completo (39 docs): precisión 100 % (261/261), recall 94 %, omisión 0, inventados 0, errores de cantidad 0. Sin regresión en ningún tipo.
- Pendiente del Paso 3: 3.2 (unidades/decimales: ya van a revisión con motivo; opciones en DECISIONES_PENDIENTES.md), 3.3 duplicados en revisión, 3.4 palabras pegadas, 3.5 precarga de tarjeta de revisión.
- Paso 3.3 duplicados dentro del archivo: ya no se fusionan ni pasan en silencio; todas sus filas van a revisión con motivo `duplicado_en_archivo` y `opciones` {sumar, dejar_uno} (`separar_duplicados` en ocr_service.py; frase en MOTIVOS_HUMANOS de ImportarIA.jsx). Medido: excel/pdf/word sin omisión; los duplicados pasan de «listos» a revisión.
- `vidrio-intacto` tras 3.1 y 3.3: 7/7. La prueba tuvo arranque irregular de Vite (página en blanco): ahora reintenta con recargas y espera hasta 8 s la inyección de los filtros SVG (la condición no cambió).
- Paso 3.5: `caja` de la fila en los items de revisión de imagen (backend). UI del recorte: pendiente. Paso 3.4 no adoptado (sin casos, riesgo de cortes falsos).
- Paso 4: evaluación final 100 % precisión (255/255), recall 92 %, omisión 0. `test:ui` completo sin fallos; vidrio-intacto 7/7 (1 corrida intermitente en filtros SVG, ver informe §10).
- ESTADO: Sprint 2 completo salvo lo listado en INFORME_PRECISION.md §5 (fotos reales, E2E importar/deshacer, recorte en UI). Informe final: INFORME_PRECISION.md.

# SPRINT 3 (rama feat/sprint3-modelo, desde feat/sprint2-lectura)
- Paso 0.1/0.2 HECHO: `npm run test:e2e-ia` (scripts/pruebas/e2e-ia.mjs), 20/20: importar sumar/reemplazar, antes/después, todo-o-nada, auditoría, deshacer (rechazado si el stock cambió), restaurar de papelera, no deshacer dos veces, duplicados del archivo (sumar / dejar uno). Corre por IPC real sobre copia de la BD; NO maneja el asistente visual de Importar.
- Pendiente de Paso 0: 0.3 espera explícita del SVG, 0.4 recorte `caja` en la tarjeta de revisión (y UI para elegir sumar/dejar uno, que hoy solo tiene frase).
- Reanudar: `git checkout feat/sprint3-modelo` y seguir este archivo.
- Paso 1.1 HECHO: `scripts/evaluacion/particion.py` (semilla 20261031, estratificado por tipo; 26 ajuste / 13 validación, guardado en datos-evaluacion/particion.json). final: ajuste 100 % precisión (171/171), recall 93 %, omisión 0; validación 100 % (84/84), recall 90 %, omisión 0. Sin señal de sobreajuste. Aviso: los arreglos de Sprint 2 se hicieron viendo los 39, así que la protección vale hacia adelante.
- Paso 1.2: `datos-evaluacion/reales/` vacío; el arnés los mide aparte (origen=real) y nunca entran a ajuste.
- Paso 0.3 HECHO: vidrio-intacto espera de forma explícita a que `#glass-menu-filters-container` tenga los <filter> (fetch de /filters-menu-glass.svg) en vez de una pausa ciega; la condición evaluada no cambió. 7/7.
- Paso 0.4 HECHO y verificado en la ventana real (Electron, foto tabla_compleja_01.png): la tarjeta de revisión dibuja el recorte de la fila original (`RecorteFila`, canvas `data-testid=recorte-fila`) a partir de `caja`. Verificación manual: `scripts/pruebas/verificar-recorte.mjs` (necesita servicio :8420 y Ollama). Nota: el recorte usa el blob de la foto cargada.
- Duplicados en la UI (cierra 0.2 del lado visual): la tarjeta `duplicado_en_archivo` muestra «Sumar las cantidades (N)» / «Dejar solo una (M)» y la cantidad NO se precarga (la persona elige). Verificado en la ventana real con tabla_compleja_05.png (vacío → 82 al elegir Sumar).
- Paso 3.1/3.2/3.3 HECHO (commits 04f4e0d, siguientes): benchmark por RAM + velocidad (`/benchmark`), `scripts/tiempos_referencia.json` medido en este equipo (4 núcleos, 17,2 GB), aviso «equipo lento» en ConfigModeloIA con tiempos de referencia. Sin verificar aún en la ventana real (se hace en el paso 5).
- Paso 2 HECHO: 5 modelos × 57 grupos, ver DECISIONES_PENDIENTES.md §5 (no se cambia el predeterminado; validación sin ítems esperados). Paso 4: solo criterio documentado (§7).
- Rutas: app de prueba en D:\Erick\GymApp, perfil en D:\Erick\GymClean (C sin espacio).
- SIGUIENTE: Paso 5 cierre (test:ui, test:e2e-ia, app empaquetada con trampa de red, sin huérfanos, INFORME_SPRINT3.md). Reanudar: `git checkout feat/sprint3-modelo` y seguir este archivo.
- Paso 5 HECHO: test:ui completo OK (vidrio-intacto 7/7), test:e2e-ia 20/20, app empaquetada en D:\Erick\GymApp con trampa + monitor: 0 conexiones externas; sin procesos huérfanos. Informe: INFORME_SPRINT3.md. ESTADO: Sprint 3 completo salvo lo listado en §7 del informe.
