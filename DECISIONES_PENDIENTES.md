# Decisiones pendientes para Erick

1. **Unidades y decimales en la BD** (esquema: cantidades enteras). Hoy «2.5 kg», «300 g», litros pasan a **revisión** con el motivo explícito; no se tocó el esquema.
   Opciones: (A) unidad dentro del nombre («Arroz extra 2.5 kg», cantidad 1) — sin cambio de esquema, la más segura; (B) unidad en notas del producto; (C) columna nueva `unidad` + cantidad decimal — requiere migración y tocar lógica de stock. Mientras decides queda la A como comportamiento seguro/reversible.
2. **Merge a main**: no se hace; la rama `feat/sprint2-lectura` queda para tu revisión.
3. **Modelo por defecto qwen2.5:3b**: no se cambia (es del Sprint 3); si las comparaciones muestran un modelo mejor, solo se propone en el informe.
4. **DeepSeek-OCR no evaluado (tope de 10 GB)**: pesa ~6,7 GB y ya hay 4,0 GB de modelos de evaluación (PP-StructureV3, PaddleOCR-VL, Granite-Docling); descargarlo pasaría de 10 GB. No se descargó. Si lo quieres medir, autoriza ampliar el tope o borra `datos-evaluacion/modelos/` de lo ya descartado. Con la evidencia de PaddleOCR-VL (no termina 1 documento en 25 min) y Granite (~15 min/doc) es poco probable que un VLM sea viable en CPU.
5. **Modelo de lenguaje (Sprint 3, paso 2): NO se cambia el predeterminado; ningún candidato queda «recomendado» todavía.**
   Misma entrada para todos: los 57 grupos ambiguos que el pipeline manda al modelo (39 documentos sintéticos, particion.json), temperatura 0, sin modo «thinking», Ollama en CPU, mismo prompt y mismas verificaciones que producción.
   Cifras (parte de **ajuste**: 14 ítems esperados en 38 grupos; la parte de **validación** tiene 19 grupos y **0** ítems esperados, así que no puede discriminar):

   | modelo | correctos (de 14) | a revisión | omisión silenciosa | inventados | portugués | 1.er token p50 | total p50 |
   |---|---|---|---|---|---|---|---|
   | qwen2.5:3b (actual) | 8 | 6 | 0 | 0 | 0/57 | 12,2 s | 16,2 s |
   | Qwen3.5 4B | 5 | 9 | 0 | 0 | 0/57 | 21,8 s | 28,6 s |
   | Phi-4-mini | 13 | 1 | 0 | 0 | 0/57 | 14,3 s | 26,5 s |
   | Gemma 4 E4B | 13 | 1 | 0 | 0 | 0/57 | 19,5 s | 39,3 s |
   | SmolLM3 3B (Q4_K_M, vía hf.co/unsloth) | 8 | 6 | 0 | 0 | 0/57 | 12,3 s | 17,4 s |

   Lectura honesta: Phi-4-mini y Gemma 4 E4B resuelven 13/14 contra 8/14 del actual, sin omisión silenciosa, sin inventados y sin mezcla de portugués. Pero la regla del sprint exige que supere al actual **en validación**, y la validación no tiene ítems esperados en estos grupos: con 14 ítems en ajuste tampoco hay tamaño para afirmar significancia. **No lo recomiendo aún.** Para decidir hace falta un set más grande de grupos ambiguos (fotos reales o más sintéticos difíciles).
   Si más adelante se confirma, el candidato más razonable es **Phi-4-mini** (mismas 13/14 que Gemma, ~1,5 veces el tiempo del actual contra ~2,4 veces; Gemma pesa 6,6 GB en disco).
   RAM (memoria del modelo cargado según Ollama, /api/ps): qwen2.5:3b ≈ 2,2 GB (medido aparte en medir_equipo), Qwen3.5 4B ≈ 3,2 GB, Phi-4-mini ≈ 3,2 GB, SmolLM3 ≈ 2,3 GB. **Gemma 4 E4B: no medido de forma fiable** (la lectura dio 0,2 GB, inválida; en disco son 6,6 GB). La columna «RAM pico» de qwen2.5:3b en la tabla bruta (184 MB) usó otro método (RSS) y se descarta.
   Tiempos: son de esta CPU (4 núcleos, sin GPU). El «total máx.» de qwen2.5:3b (8007 s) es una suspensión del equipo, no una medición; se usan las medianas.
   Los modelos descargados se borraron después de evaluarlos (fueron a D:\Erick\Gym\datos-evaluacion\ollama-modelos, ya vacío).
6. **App de prueba y perfil limpio movidos a D** (C se quedó sin espacio): `D:\Erick\GymApp` y `D:\Erick\GymClean` en lugar de `C:\GymApp` / `C:\GymClean`; los scripts ya apuntan ahí.
7. **LoRA (paso 4): no se entrena.** Criterio para hacerlo: solo si un fallo concreto y medido del modelo (error confiado o omisión silenciosa > 0 en validación, o mezcla de idiomas repetida) persiste tras corregir el prompt y las verificaciones, y se dispone de ≥ 200 grupos reales etiquetados. En esta evaluación: omisión silenciosa 0, inventados 0, portugués 0 en los 5 modelos; el único déficit (más grupos a revisión con qwen2.5:3b) se resuelve cambiando de modelo, no entrenando.
