# Informe Sprint 3 — seguridad, modelo y perfiles de hardware

Rama `feat/sprint3-modelo` (desde `feat/sprint2-lectura`). Sin merge a main. No se tocó GlassEngine ni el efecto vidrio; `vidrio-intacto` (vs `7498b6a`) pasa 7/7 dentro de `npm run test:ui`. App 100 % offline. No se comprimió ni degradó ningún modelo. El modelo por defecto sigue siendo `qwen2.5:3b`.

## 1. Resumen

| paso | resultado |
|---|---|
| 0.1 / 0.2 E2E importar → antes/después → confirmar (sumar y reemplazar) → deshacer → restaurar, y duplicados (sumar / dejar uno) | `npm run test:e2e-ia`: 20/20 sobre una copia de la BD |
| 0.3 vidrio-intacto estable | espera explícita a que `#glass-menu-filters-container` tenga los `<filter>` del SVG; condición evaluada sin cambios |
| 0.4 recorte de la fila (`caja`) en la tarjeta de revisión | hecho y verificado en la ventana real con `tabla_compleja_01.png` |
| 1.1 ajuste / validación | semilla 20261031, 26 / 13 documentos |
| 1.2 fotos reales | `datos-evaluacion/reales/` vacío: **no medido** |
| 2 modelos de lenguaje | 5 modelos × 57 grupos; **no se recomienda cambio** (ver §3) |
| 3 perfiles de hardware | benchmark por RAM + velocidad, tiempos medidos, aviso de equipo lento |
| 4 LoRA | no se entrena; criterio documentado |
| 5 cierre | `test:ui` completo y `test:e2e-ia` pasan; app empaquetada: 0 conexiones externas |

## 2. Ajuste vs validación (lectura de documentos, pipeline final)

| parte | docs | esperados | precisión | recall | a revisión | omisión silenciosa | inventados |
|---|---|---|---|---|---|---|---|
| línea base, ajuste | 26 | 184 | 87 % (157/180) | 85 % | 5 % | 12 | 17 |
| línea base, validación | 13 | 93 | 87 % (79/91) | 85 % | 5 % | 9 | 12 |
| **final, ajuste** | 26 | 184 | **100 %** (171/171) | 93 % | 7 % | **0** | 0 |
| **final, validación** | 13 | 93 | **100 %** (84/84) | 90 % | 10 % | **0** | 0 |

No hay señal de sobreajuste (validación igual de precisa, recall 3 puntos menor). **Advertencia:** los arreglos del Sprint 2 se hicieron viendo los 39 documentos, así que esta partición no prueba generalización de lo ya hecho; protege los cambios futuros (se ajusta con `ajuste` y se confirma en `validacion`). Todo es sintético: nada está medido con fotos reales.

## 3. Comparación de modelos de lenguaje (solo grupos ambiguos)

Entrada idéntica: 57 grupos que el pipeline manda al modelo, temperatura 0, sin «thinking», Ollama en CPU, mismo prompt y verificaciones que producción. Detalle y notas en `DECISIONES_PENDIENTES.md` §5.

| modelo | correctos (de 14) | a revisión | omisión silenciosa | inventados | portugués | 1.er token p50 | total p50 | RAM del modelo (Ollama) |
|---|---|---|---|---|---|---|---|---|
| qwen2.5:3b (actual) | 8 | 6 | 0 | 0 | 0/57 | 12,2 s | 16,2 s | ≈ 2,2 GB |
| Qwen3.5 4B | 5 | 9 | 0 | 0 | 0/57 | 21,8 s | 28,6 s | ≈ 3,2 GB |
| Phi-4-mini | 13 | 1 | 0 | 0 | 0/57 | 14,3 s | 26,5 s | ≈ 3,2 GB |
| Gemma 4 E4B | 13 | 1 | 0 | 0 | 0/57 | 19,5 s | 39,3 s | no medido de forma fiable (6,6 GB en disco) |
| SmolLM3 3B (Q4_K_M, `hf.co/unsloth`) | 8 | 6 | 0 | 0 | 0/57 | 12,3 s | 17,4 s | ≈ 2,3 GB |

**Recomendación: no cambiar.** Phi-4-mini y Gemma 4 E4B resolverían 13/14 contra 8/14 sin aumentar la omisión silenciosa, pero la regla exige superar al actual en **validación** y los 19 grupos de validación tienen **0** ítems esperados: no se puede confirmar; con 14 ítems en ajuste tampoco hay tamaño para afirmar significancia. Hace falta un set mayor de grupos ambiguos (fotos reales). Si se confirma, el candidato razonable es Phi-4-mini.

## 4. Perfiles de hardware (Fase 4)

- Perfiles básico / medio / alto en `scripts/modelos_perfiles.json`, con umbrales de RAM (0 / 6 / 12 GB) y de velocidad (0 / 4 / 12 tokens/s).
- `/benchmark` (micro-benchmark de ~5 s, se ejecuta solo la primera vez que el asistente está listo, `IAHost.jsx`): el perfil recomendado es el más limitante entre el medido por velocidad y el medido por RAM; devuelve `equipo_lento`.
- Aviso «equipo lento» en Configuración → Asistente IA (`AvisoEquipoLento`): cita solo tiempos medidos en el equipo de referencia y dice expresamente que en el equipo del usuario no se ha medido.
- Medido en esta PC (4 núcleos, 4 hilos, 17,2 GB RAM, sin GPU para el modelo) con 1 documento por tipo, una sola repetición (`scripts/tiempos_referencia.json`):

| tipo | tiempo |
|---|---|
| tabla limpia | 71,6 s |
| tabla compleja | 117,2 s |
| lista simple | 51,1 s |
| manuscrito | 41,7 s |
| degradada | 48,3 s |
| PDF | 84,0 s |
| Excel | 0,0 s |
| Word | 0,2 s |

Arranque del servicio 9,2 s; RAM del servicio 479 MB al cargar y 609 MB de pico; modelo cargado ≈ 2,2 GB.

## 5. LoRA

No se entrenó. Criterio (en `DECISIONES_PENDIENTES.md` §7): solo ante un fallo medido y persistente (error confiado u omisión silenciosa > 0 en validación, o mezcla de idiomas repetida) que no se corrija con prompt y verificaciones, y con ≥ 200 grupos reales etiquetados. Aquí: omisión 0, inventados 0, portugués 0 en los cinco modelos.

## 6. Cierre

- `npm run test:ui` completo: «Todo correcto» (vidrio-intacto 7/7).
- `npm run test:e2e-ia`: «Todo correcto» (20/20).
- App empaquetada (`D:\Erick\GymApp\Gimnasio.exe`, entorno de PC limpia con proxy trampa y monitor): 651 muestras con procesos vivos, **0 conexiones externas**, 0 intentos en la trampa; el servicio de análisis empaquetado respondió 200 en `/health`. Al terminar, 0 procesos de la app vivos.
- Procesos míos detenidos: Ollama de pruebas (:11500), servicio de análisis, vite y Electron de las pruebas. Quedan solo el Ollama propio del usuario (`ollama app.exe` / `ollama serve`) y las terminales de la app.

## 7. Lo que NO se pudo verificar

- **Fotos reales**: no hay; todo lo de lectura es sintético.
- **Validación del modelo**: sin ítems esperados en la parte de validación de los grupos ambiguos; la recomendación de modelo queda abierta.
- **RAM de Gemma 4 E4B** y la RAM de qwen2.5:3b en la tabla bruta de la cosecha (método anterior, descartado): usé `/api/ps` y el medidor de equipo.
- **Ejecutable congelado `ocr-service.exe` NO se regeneró**: la app empaquetada usa el servicio de análisis anterior a los cambios del Sprint 2/3 (se reconstruyó solo `app.asar` con el front y Electron nuevos). La prueba de red cubre el arranque y la inactividad de la app empaquetada, no una importación completa con el servicio nuevo.
- **Aviso de equipo lento**: compila y está cableado, pero no lo vi en la ventana real (esta PC no se clasificó lenta en una medición real; no se forzó).
- **Benchmark por RAM + velocidad** en `/benchmark`: el código compila y la lógica es simple, pero no se llamó a la ruta en vivo en este cierre.
- **Medidas de tiempo**: una sola repetición por tipo, un documento por tipo; los tiempos de otros equipos no se extrapolaron.
- **Instalador NSIS, electron fuses e integridad del asar**: la carpeta de prueba no los ejercita (ya documentado en `INSTALADOR.md`). Tampoco se cortó el Wi-Fi físicamente.
- **Ubicación**: la app de prueba quedó en `D:\Erick\GymApp` (no `C:\GymApp`) porque C se quedó sin espacio.
- Disco: durante la evaluación de modelos C llegó a 0 GB libres por mis descargas; se limpiaron los parciales y desde entonces los modelos de prueba van a D.
- Persiste la intermitencia ocasional del SVG de filtros en `vidrio-intacto` descrita en INFORME_PRECISION §10; en este cierre no se repitió.

## 8. Commits (feat/sprint3-modelo)

890f23b E2E importar/deshacer/restaurar/duplicados · 4a19f5d partición · 6edfc3c vidrio-intacto espera el SVG · f46fbf1 recorte de la fila · e7bf574 botones sumar / dejar uno · 04f4e0d modelos + benchmark · 88aebe4 tiempos medidos · aeb02e9 aviso de equipo lento · 39306ba y 3845d81 rutas a D · 7d18210 comparación de modelos y criterio LoRA · y el commit de este informe.
