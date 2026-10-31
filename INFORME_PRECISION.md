# Informe de precisión de lectura — Sprint 2

Rama `feat/sprint2-lectura` (desde `feat/fase3-diseno`). Sin merge a main. Todo medido por código sobre 39 documentos sintéticos con respuesta conocida (277 productos).
`datos-evaluacion/reales/` está **vacío**: no hay fotos reales etiquetadas, así que **nada de esto está medido con fotos reales** (el arnés quedó listo: ver `datos-evaluacion/LEEME.md`).

## 1. Resultado final por tipo (ANTES → DESPUÉS)

Antes = línea base del pipeline de `5614306`. Después = rama actual. Tiempo p50/p95 por documento: 67/211 s → 72/133 s (CPU, Ollama en CPU).

| tipo | precisión antes → después | recall antes → después | omisión silenciosa | inventados |
|---|---|---|---|---|
| degradada | 83 % → 100 % | 81 % → 98 % | 0 → 0 | 1 → 0 |
| excel | 96 % → 100 % | 100 % → 92 % | 0 → 0 | 1 → 0 |
| lista_simple | 100 % → 100 % | 90 % → 86 % | 0 → 0 | 0 → 0 |
| manuscrito | 100 % → 100 % | 97 % → 97 % | 0 → 0 | 0 → 0 |
| pdf | 100 % → 100 % | 100 % → 100 % | 0 → 0 | 0 → 0 |
| tabla_compleja | 43 % → 100 % | 45 % → 83 % | **21 → 0** | 25 → 0 |
| tabla_limpia | 96 % → 100 % | 100 % → 100 % | 0 → 0 | 2 → 0 |
| word | 100 % → 100 % | 72 % → 72 % | 0 → 0 | 0 → 0 |
| **GLOBAL** | **87 % → 100 %** (255/255) | **85 % → 92 %** | **21 → 0** | **29 → 0** |

**Omisión silenciosa: 0** en todos los tipos. El error confiado (productos «listos» equivocados) pasó de 13 % a 0 % en este set.
Que el recall baje en excel/lista_simple es esperado: los duplicados dentro del archivo (3.3) y las unidades/decimales ahora van a revisión en vez de pasar como listos.

## 2. Comparación de lectores (misma muestra de 12: 4 tablas limpias, 4 compleja, 4 degradada)

Todos con el MISMO analizador determinista de producción; solo cambia quién lee. Pipeline actual medido con los 3 primeros arreglos de lectura (encabezados, celdas de 2 líneas, TOTAL), ANTES de 3.1; con 3.1 sube aún más en las degradadas.

| lector | docs | precisión | recall | omisión | inventados | tiempo p50 | notas |
|---|---|---|---|---|---|---|---|
| **Actual** (PaddleOCR PP-OCR + parser) | 12 | 92 % | 88 % | **0** | 1 | 76 s | lector de producción |
| PP-StructureV3 (PaddleOCR 3.x) | 12 | 73 % | 55 % | 34 | 17 | 205 s | pierde tablas en fotos degradadas (salida vacía) y desfasa columnas con filas de categoría |
| Granite-Docling-258M | **3 de 12** (muestra parcial, se cortó por lentitud) | 13/21 correctos (igual al actual) | — | 4 | 7 | ~900 s/doc | español y tildes bien; más omisión e inventados que el actual |
| PaddleOCR-VL-1.6 | **sonda de 1 doc** | — | — | — | — | no terminó en 25 min | no viable en CPU |
| DeepSeek-OCR | **no evaluado** | — | — | — | — | — | habría pasado el tope de 10 GB (ver DECISIONES_PENDIENTES #4) |

**Recomendación: mantener el lector actual como principal.** Ninguna alternativa lo supera en precisión, omisión ni tiempo en CPU. El pipeline de producción no se cambió de lector.

## 3. Efecto de cada mejora (ablación, una a la vez)

| mejora | efecto medido |
|---|---|
| Encabezado manda en las columnas (Producto/Cantidad) | `tabla_compleja` omisión 21 → 0 y precisión 43 % → 100 % (efecto conjunto de las tres primeras filas; se midieron por pasos en `fix1_compleja` y `fix2_compleja`) |
| Celdas de 2 líneas unidas (`unir_filas_continuacion`) | nombres partidos en dos líneas dejan de salir como dos filas |
| TOTAL/SUBTOTAL no es producto | desaparecen «inventados» tipo TOTAL |
| 3.1 enderezar la inclinación antes de agrupar filas (`estimar_pendiente`, apagable con `GYM_DESKEW=0`) | `degradada`: precisión 83 % → 100 %, recall 81 % → 98 %; errores de cantidad 6 → 0. Sin regresión en los demás tipos |
| 3.3 duplicados dentro del archivo → revisión (`duplicado_en_archivo`, opciones sumar / dejar uno) | ningún duplicado se fusiona ni pasa en silencio; recall baja ligeramente por diseño |
| 3.4 cortar palabras pegadas | **no adoptado**: el set no tiene casos y un cortador arriesga dañar nombres legítimos (p. ej. «Hierbabuena»). Sin evidencia, no se toca |
| 3.5 precarga de la tarjeta de revisión + recorte | la precarga (nombre/cantidad sugeridos) ya existía; se agregó `caja` [x1,y1,x2,y2] de la fila original a cada ítem de revisión de imagen. **El recorte visible en la tarjeta NO se dibujó** (cambio de UI sin probar en la app real) |
| 3.2 cantidad vs números en el nombre; unidades/decimales | «2.5 kg», «300 g», litros ya van a revisión con motivo explícito; no se tocó el esquema. Opciones A/B/C en `DECISIONES_PENDIENTES.md` #1 |

## 4. Qué sigue fallando y por qué

- **Word 72 % recall (28 % a revisión)** y **lista_simple 86 %**: unidades («2.5 kg») y decimales; la BD solo guarda cantidades enteras → decisión pendiente #1.
- **tabla_compleja 83 %**: filas con nombre partido y número dentro del nombre («Coca cola light de 12 pzas 355 ml») terminan en revisión (`fusion_extrema`), correcto pero con trabajo humano.
- Nombres de 2 letras («Té») los rechaza el filtro de nombre válido; no se bajó esa red de seguridad.

## 5. No se pudo verificar

- **Fotos reales**: `datos-evaluacion/reales/` vacío. Los números son de documentos sintéticos; con fotos reales pueden ser peores.
- **E2E de importar / deshacer / restaurar**: el repo no tiene prueba automática de ese flujo y no se creó una (habría tocado lógica de importación). Pendiente.
- **Texto «~7 % más grande» en Transparente** (Paso 0a): sospecha NO verificada. Las diferencias medidas son el canvas animado, el menú/barra (aprobados) y el contenido desplazado por el menú (`docs/ATRIBUCION_TRANSPARENTE.md`).
- Granite-Docling solo en 3/12; PaddleOCR-VL solo una sonda; DeepSeek-OCR no.
- Recorte de la fila original en la UI (3.5): backend listo, UI sin dibujar.

## 6. vidrio-intacto (regla de oro del vidrio)

`test:ui` sección `vidrio-intacto`: **7/7**. Archivos del motor idénticos a `7498b6a`; en Transparente existen `.glass-selector`, los 3 filtros SVG (`glass-refraction-menu`, `glass-specular-menu`, `glassLensDistortion`) y `.glass-layer--fill` con backdrop-filter; la burbuja se mueve en las 3 apariencias. No se modificó ningún archivo del efecto vidrio. Para estabilizar la prueba (arranque de Vite en frío) se agregó reintento con recargas y 8 s de espera a la inyección de los filtros; la condición evaluada no cambió.

## 7. Datos y modelos fuera del repo

Confirmado: ningún dato de `datos-evaluacion/`, modelo, `venv-*`, `.db` ni `.env` está versionado. `package-lock.json` y `refero.md` quedan sin commitear.

## 8. Commits (rama `feat/sprint2-lectura`)

`4c2f6de` Paso 1 (set, arnés, guardia vidrio-intacto, arreglos de lectura) · `d27fefc` PROGRESO/DECISIONES · `3fd4746` Ventas «Ver detalle» · `b3625fc` atribución Transparente · `1db109a` PP-StructureV3 · `81411ab` Granite-Docling · `a81aa56` PaddleOCR-VL/DeepSeek · `2d525dd` 3.1 enderezar inclinación · `62b0dd5` 3.3 duplicados + prueba robusta · (siguiente: 3.5 `caja` + informe).

## 9. Decisiones pendientes para Erick

Ver `DECISIONES_PENDIENTES.md`: (1) unidades y decimales en la BD (A/B/C; hoy rige A, la más segura), (2) merge a main, (3) modelo por defecto qwen2.5:3b sin cambios (Sprint 3), (4) DeepSeek-OCR fuera del tope de 10 GB.
