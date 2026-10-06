# Auditoría UI/UX — línea base (antes de la Fase 3)

> Estado: **línea base (3.1)**. La columna «después» y las correcciones se completan en 3.6.
> Medido en la ventana real de Electron (1280×800), en esta PC de desarrollo (i5-2400, 4 núcleos, sin GPU),
> modo desarrollo, rama `feat/ia-chat-mascota` (commit `02fea01`), BD de desarrollo.

## 1. Método y límites (leer primero)

- **Tareas:** guion automático por la interfaz real (Playwright sobre CDP). Mide el **costo mínimo de interfaz**
  (clics, teclas, segundos) de la ruta más corta; no incluye el tiempo de pensar ni de leer. Un usuario real tarda más.
- **Clics:** cada clic del guion (+ las acciones de diálogos del sistema que no se pueden automatizar: seleccionar
  archivo = 3). **Teclas:** caracteres escritos + Enter. **Segundos:** reloj del guion (incluye la espera real de la UI).
- **Dinero:** las tareas que mueven dinero (venta, cobro del cliente nuevo, cierre de turno) **se detienen antes del
  último clic** y se suma +1 clic no ejecutado. Abrir caja e importar sí se ejecutaron (BD de desarrollo restaurada después).
- **«Errores posibles»:** salen de la inspección de cada pantalla (campos obligatorios, pasos irreversibles, textos),
  no de pruebas con usuarios. No hay mediciones con personas: lo que dicen los números es *costo de interfaz*, no
  *tiempo humano*.
- **Rendimiento:** FPS = `requestAnimationFrame` durante 3 s con la página quieta, en modo desarrollo (el modo
  producción suele ser algo mejor; no se midió aquí).

## 2. Línea base — 8 tareas clave

| # | Tarea | Clics | Teclas | Seg. (guion) | Errores posibles / fricción observada |
|---|---|---:|---:|---:|---|
| 1 | Nueva venta (hasta antes de «Registrar Venta») | 5 | 4 | 2,9 | Hay que escribir para buscar y hacer clic en el producto; sin «Enter = agregar el primero». Con caja cerrada el sistema pide abrirla antes. |
| 2 | Cliente nuevo (hasta antes de «Procesar pago») | 10 | 31 | 3,0 | 4 campos obligatorios + plan + pago en 3 pasos; cada campo se enfoca con clic (Tab ahorraría ~4 clics). El alta **incluye el cobro** en el mismo flujo. |
| 3 | Abrir caja | 3 | 3 | 1,8 | El campo arranca en «0» (hay que reemplazarlo). Un solo botón, bien señalizado. |
| 4 | Cerrar caja (hasta antes de «Cerrar Turno») | 3 | 0 | 1,3 | El efectivo contado ya viene sugerido (bien, pero **puede confirmarse sin contar**: riesgo de cuadre falso). El modal ocupa casi toda la altura de la ventana (con barra de scroll interna). |
| 5 | Importar inventario con IA (Excel de 2 productos) | 8 | 0 | 3,6 | Dos confirmaciones de escritura (tarjeta + modal ámbar): seguro, a costa de 2 clics. Seleccionar archivo cuenta como 3 acciones de diálogo. |
| 6 | Buscar un producto (Inventario) | 2 | 4 | 1,2 | Filtra al escribir; sin atajo de teclado para enfocar la búsqueda. |
| 7 | Cambiar apariencia | — | — | — | **No existe**: no hay selector de apariencia (se crea en 3.2). |
| 8 | Consultar a la IA (mascota) | 2 | 28 | 24,0 | Primer token a ~10 s en frío (el modelo local carga el contexto); mientras tanto solo hay tres puntos animados, sin indicación de espera. |

## 3. Línea base — rendimiento

| Página | Hasta poder interactuar | FPS | Memoria JS |
|---|---:|---:|---:|
| Control de Acceso | 600 ms | 42,8 | 43 MB |
| Clientes | 973 ms | 39,2 | 44 MB |
| Caja | 625 ms | 35,1 | 45 MB |
| Inventario | 578 ms | 33,8 | 44 MB |
| IA | 539 ms | 59,2 | 48 MB |
| Configuración | 418 ms | 46,2 | 47 MB |

- **Bundle de producción** (`vite build`): `dist` sin frames **11,0 MB** (79 archivos); JS principal **1 773 KB**
  (495 KB gzip); CSS 79 KB. Los **frames** de fondo pesan **298 MB** aparte.
- **Memoria del proceso:** ≈ 678 MB entre todos los procesos de Electron (incluye 3 renderers de desarrollo).
- **Lectura:** Caja (35,1) e Inventario (33,8) están **a 3–5 FPS del umbral de 30**. El coste es del fondo común
  (frames + filtros de vidrio con desplazamiento); por eso en Transparente se ofrece «Video de fondo» desactivable.
  La página de IA va a 59 FPS porque no anima el fondo del mismo modo.

## 4. Auditoría heurística (Nielsen) — hallazgos priorizados

Gravedad: **A** alta · **M** media · **B** baja. «Tocar» indica si exige tu aprobación (dinero/Ventas/Caja).

| ID | Área | Heurística | Hallazgo | Grav. | Propuesta | Tocar |
|---|---|---|---|:-:|---|---|
| U1 | Caja | H8 Diseño minimalista / H5 Prevención de errores | El modal «Arqueo y Cierre de Turno» ocupa casi toda la altura de la ventana (1280×800) y necesita barra de scroll interna; el botón «Cerrar Turno e Imprimir Corte» queda pegado al borde inferior y su etiqueta se parte en dos líneas. | A | Compactar el modal para que quepa sin scroll y acortar la etiqueta. | **Sí (Caja)** |
| U2 | Caja / Ventas | H5 Prevención de errores | El efectivo contado viene sugerido con el esperado: se puede cerrar sin contar. | M | Dejarlo vacío o exigir confirmar «Conté el efectivo». | **Sí (dinero)** |
| U3 | Mascota | H1 Visibilidad / H4 Consistencia | La burbuja (abajo a la derecha) tapa la píldora «Control por voz» de Caja y Ventas. | M | Posición por defecto sin solapar y avisar si se solapa; `title` con el atajo. | No (mascota) |
| U4 | IA | H4 Consistencia (textos) | Voseo («Cargá», «Escribí o adjuntá», «Verificá», «querés»; «por vos» en Configuración) frente al tuteo del resto del sistema («Busca», «Selecciona»). | M | Unificar en tuteo (5 textos). | No (solo textos de IA) |
| U5 | IA | H1 Visibilidad del estado | Con el modelo en frío hay ~10 s sin más señal que tres puntos. | M | Indicador «Pensando… N s» + esqueleto de carga (Perplexity). | No |
| U6 | IA | H6 Reconocimiento vs. recuerdo | Los modos «Preguntar / Actuar» no explican su diferencia hasta pasar el cursor. | M | Texto de ayuda de una línea y chip con el modo activo en el compositor. | No |
| U7 | Todo | H7 Flexibilidad y eficiencia | Sin atajos de teclado para lo frecuente (buscar producto, enfocar compositor). | B | Atajo `/` para enfocar búsquedas (solo IA ahora). | No (IA) |
| U8 | Todo | H4 Consistencia | Contraste bajo de títulos y subtítulos sobre fotos claras (p. ej. «CAJA DIARIA», «Caja cerrada») y distorsión del vidrio sobre listas (Inventario). | A | En **Transparente no se toca** (diseño intacto); la opción «Video de fondo: apagado» (último frame estático) lo mitiga. En Lusion no aplica (opaco). | No |
| U9 | Clientes nuevos | H7 Eficiencia | 10 clics + 31 teclas; el flujo mezcla alta de cliente y cobro. | M | Orden de tabulación + Enter para avanzar de paso. | **Sí (cobro)** |
| U10 | Ventas | H7 Eficiencia | Sin «Enter agrega el primer resultado». | B | Añadirlo. | **Sí (Ventas)** |
| U11 | IA | H9 Ayuda a recuperarse de errores | Los avisos de «servicio no listo» y los errores del modelo están redactados con detalle técnico en algún caso. | B | Reescribir con lo que puede hacer la persona. | No |
| U12 | Login | — | Auditado solo con una captura (sin flujo completo): formulario simple, un único CTA. No se detectan problemas con esa evidencia. | — | — | — |

Cobertura: IA, mascota, Ventas, Caja, Inventario, Clientes y Configuración se recorrieron en la ventana; login
solo por captura (ver U12). **No** se hicieron pruebas con usuarios reales.

## 5. Metas (para 3.6)

| Meta | Línea base | Objetivo |
|---|---|---|
| Solapes de la mascota con controles | 2 pantallas | 0 |
| Textos con voseo en IA/Configuración | 5 | 0 |
| Feedback de espera de la IA en frío | ninguno | < 100 ms hasta «Pensando… N s» |
| Cambiar apariencia | no existe | ≤ 3 clics, sin recargar |
| FPS en Caja/Inventario con «Video de fondo» apagado | 35,1 / 33,8 | ≥ 45 (medir) |
| FPS de la IA y la mascota en Lusion | — | ≥ 30 (todas las páginas de IA) |
| Cambios en Ventas/Caja/dinero | — | **0 sin tu aprobación** |
