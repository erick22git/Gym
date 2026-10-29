# Diseño — apariencias del módulo de IA y la mascota

> Estado: **3.0–3.4 (3.4 pendiente de tu OK en ALTO 2)**. Fuente de diseño: `refero.md` (rangos indicados). Los colores
> `#1a2ffb` y `#c1ff00` de Lusion **no se usan en ningún sitio** (verificación al final).

## 1. Alcance (qué cambia y qué no)

- Tres apariencias seleccionables, en español: **Transparente** (el diseño glass ACTUAL, intacto), **Lusion Oscuro**
  y **Lusion Claro**. Valores internos: `transparente`, `lusion-oscuro`, `lusion-claro` (atributo `data-ia-tema`).
- Las apariencias Lusion afectan **solo** a la página de IA (con sus modales y panel de historial), la mascota y el visor de
  recorridos: todo lo que cuelga de la clase `.ia-scope`. Login, navegación, Ventas, Caja, Inventario, Clientes y
  Configuración **no cambian** con ninguna selección. Nada se migró.
- **Transparente no define ninguna regla nueva** de color/forma: sigue siendo el CSS de hoy. Lo único que añade es
  la opción **«Video de fondo»** (activado = comportamiento actual; desactivado = el último frame que existe en disco, estático).
- Lusion Oscuro/Claro son **100 % opacas**: sin `backdrop-filter`, sin fondos translúcidos, sin degradados, y mientras la
  página de IA está en Lusion **no se reproducen frames** (el canvas queda oculto; al salir vuelve el fondo con su flujo normal).
- Cambio en caliente (sin recargar) por: Configuración → «Apariencia del módulo de IA», comando `/tema`, y la
  acción de la mascota (con tarjeta de aprobación). Se guarda en la BD (`ia_tema`, `ia_video_fondo`).

## 2. Lectura de las referencias (3.0)

| Rango | Qué se tomó | Qué NO se tomó |
|---|---|---|
| **Lusion** 2508–3512 | Toda la piel: lienzo Lavender Mist, Paper White, Ink, Graphite, Haze, Slate Hollow; tipografía (pesos 400/500, tracking −0,02 em); radios 3/15/18/87,5/100; sombra única al 4 %; botón píldora Graphite; hover por opacidad/subrayado; superficies planas. | `#1a2ffb` y `#c1ff00` (regla 2504–2507). El anillo de foco indigo → anillo Ink/Paper White de 2 px. Aeonik (propietaria) → Inter. |
| **Cursor** 1220–2502 | Estructura del módulo: «Terminal Input Field» (compositor con borde fino, texto mono, `$`/`>` como prompt), metadatos mono (`Mono Metadata Tag`: tiempos, tokens, rutas), densidad compacta (4 px base), jerarquía botón oscuro + botón claro, estado verde/rojo/ámbar. | Paleta cálida (Parchment, Ember…), radio de 4 px, «sin píldoras», sombras grandes. |
| **ChatGPT** 2–608 | Anatomía: historial lateral con filas fantasma, columna de mensajes centrada (~720–820 px), hairline como único separador, tooltips en negro. | Paleta, radio de 10 px, pesos 600. |
| **Perplexity** 609–1219 | Selector de modelo como texto con chevron, chip de modo, tarjeta de estado con **esqueletos de carga** (barras con shimmer), compositor central. | Paleta cálida/teal, radios de 12/16 px. |

### Conflictos entre referencias y cómo se resolvieron

1. **Radios:** Cursor 4 px, ChatGPT 10 px, Perplexity 12/16/9999 vs Lusion 3/15/18/87,5/100 → **manda Lusion** (precedencia 1):
   botones y chips 87,5 px; tarjetas y burbujas 15 px; campos 18 px; detalles (código) 3 px; avatares 100 px.
2. **Sombras:** Cursor (28/70 px cálida), ChatGPT (ninguna, solo hairline), Perplexity (8 %) vs Lusion (única al 4 %) → Lusion;
   el *hairline* de ChatGPT se conserva como borde de 1 px en **Haze** (claro) / **Slate Hollow** (oscuro).
3. **Paletas cálidas** (Parchment `#f7f7f4`, Aged Paper `#faf8f5`) vs Lavender Mist → Lavender Mist.
4. **Negro puro:** Cursor lo prohíbe, Lusion lo exige (texto `#000`) → Lusion.
5. **Peso tipográfico:** ~~ChatGPT 600 vs Lusion ≤ 500~~ → sustituido por la decisión del Sprint 1: pesos de la app (ver §3).
6. **Hover:** ChatGPT usa un velo de relleno; Lusion prohíbe cambiar el relleno → opacidad .72 / subrayado.
7. **Verde como «acento de acción» (Cursor)** vs tu regla de usarlo **solo para estado** → solo estado (ver 5).
8. **Contradicción interna de Lusion:** el *token* Graphite dice «no promover a CTA», pero el componente *Pill Action Button* lo usa
   como relleno → se sigue el **componente** (relleno Graphite, texto Paper White), que es lo que indica la guía de prompts.
9. **Sin blur (Lusion)** vs el efecto líquido que pedirás en 3.5 → excepción explícita, solo en Lusion, con interruptor (aún no implementada).
10. **Estado de Cursor «no usar como estado»** (Forest/Crimson lo advierten) vs tu instrucción de usarlos **solo** para estado → manda tu instrucción.

## 3. Tipografía — una sola fuente de verdad (Sprint 1, Paso 2) — **sustituye a la sección de fuentes anterior**

**Decisión de Erick:** en las tres apariencias y en todas las páginas (IA, chat y mascota incluidos) se usa la **misma tipografía actual de la app**
(familias, pesos, tamaños, interlineado y tracking). Lusion solo manda en **color, forma y sombras**.

- **Fuente de verdad:** `src/index.css` → `--display` (Oxanium, títulos) y `--body` (Inter, texto), más los tamaños, pesos y tracking que ya traen las clases y estilos de cada componente. Los paquetes `@fontsource/*` ya empaquetados no cambian.
- **Descartado de Lusion:** Inter con tracking −0,02 em, tope de pesos 400/500, JetBrains Mono para metadatos/compositor/ejemplos, y los tokens `--lu-fuente` y `--lu-mono` (eliminados de `apariencias.css`).
- **Código:** conserva la regla de la app (`.ia-md-codigo`, `ui-monospace`), igual en las tres apariencias.
- **Regla para el futuro:** `apariencias.css` no debe declarar `font-family`, `font-weight`, `letter-spacing` ni `font-size` sobre elementos que ya existen en Transparente. Los pocos elementos que existen solo en Lusion (hora del mensaje, línea del modelo, origen) usan tamaños pequeños ya presentes en la app (10,5–11 px) y heredan familia, peso y tracking.
- Sin CDN ni Google Fonts.

### Diagnóstico previo (antes de unificar)

Se volcaron los estilos calculados de **todos** los textos visibles de la página de IA (324) en las tres apariencias y se emparejaron por texto y etiqueta:
**318 de 323 diferían** en Lusion respecto de Transparente. Causas: tracking −0,02 em en todo (151+151 textos), pesos forzados a 400/500 (títulos, botones, pestañas «Preguntar/Actuar»), título `h1` en Inter 500 18 px en lugar de Oxanium 800 28 px con tracking .12 em, JetBrains Mono en los chips de ejemplo, el compositor y los metadatos, y tamaños 12,5 px en los enlaces del pie.

### Resultado (mismos 324 textos, tras unificar)

**323 de 323 emparejados idénticos** en Lusion Oscuro y en Lusion Claro (1 texto sin par: solo existe en Lusion). Transparente: estilos idénticos antes y después (324 de 324) y 0,043 % de píxeles distintos en la captura de la IA (ruido de animación).

| # | Elemento | Transparente | Lusion Oscuro ANTES | Lusion Oscuro DESPUÉS | Lusion Claro DESPUÉS | Idéntico |
|---|---|---|---|---|---|---|
| 1 | IA / IMPORTAR DATOS (<h1>) | Oxanium 800 28px/42px ls 3.36px | Inter 500 18px/27px ls -0.36px | Oxanium 800 28px/42px ls 3.36px | Oxanium 800 28px/42px ls 3.36px | sí |
| 2 | Preguntar (<p>) | Inter 400 12px/18px ls normal | Inter 400 12px/18px ls -0.24px | Inter 400 12px/18px ls normal | Inter 400 12px/18px ls normal | sí |
| 3 | Actuar (<button>) | Inter 700 11.5px/17.25px ls normal | Inter 500 11.5px/17.25px ls -0.23px | Inter 700 11.5px/17.25px ls normal | Inter 700 11.5px/17.25px ls normal | sí |
| 4 | Preguntar: solo respondo (<p>) | Inter 400 12px/18px ls normal | Inter 400 12px/18px ls -0.24px | Inter 400 12px/18px ls normal | Inter 400 12px/18px ls normal | sí |
| 5 | Historial de conversaciones (<span>) | Inter 700 14px/21px ls normal | Inter 400 14px/21px ls -0.28px | Inter 700 14px/21px ls normal | Inter 700 14px/21px ls normal | sí |
| 6 | Nueva conversación (<span>) | Inter 600 13px/19.5px ls normal | Inter 400 13px/19.5px ls -0.26px | Inter 600 13px/19.5px ls normal | Inter 600 13px/19.5px ls normal | sí |
| 7 | Anteriores (<div>) | Inter 700 10px/15px ls 0.8px | Inter 400 10px/15px ls -0.2px | Inter 700 10px/15px ls 0.8px | Inter 700 10px/15px ls 0.8px | sí |
| 8 | Archivos adjuntos (<button>) | Inter 400 16px/24px ls normal | Inter 500 12.5px/18.75px ls -0.25px | Inter 400 16px/24px ls normal | Inter 400 16px/24px ls normal | sí |
| 9 | Actividad de IA (<button>) | Inter 400 16px/24px ls normal | Inter 500 12.5px/18.75px ls -0.25px | Inter 400 16px/24px ls normal | Inter 400 16px/24px ls normal | sí |
| 10 | Asistente de inventario (<div>) | Inter 700 15px/22.5px ls normal | Inter 400 15px/22.5px ls -0.3px | Inter 700 15px/22.5px ls normal | Inter 700 15px/22.5px ls normal | sí |
| 11 | Voz apagada (<button>) | Inter 600 12px/18px ls normal | Inter 500 12px/18px ls -0.24px | Inter 600 12px/18px ls normal | Inter 600 12px/18px ls normal | sí |
| 12 | sube esta foto (<div>) | Inter 400 12.5px/18.75px ls normal | Inter 400 12.5px/18.75px ls -0.25px | Inter 400 12.5px/18.75px ls normal | Inter 400 12.5px/18.75px ls normal | sí |
| 13 | 06-oct, 09:56 (<div>) | Inter 400 10.5px/15.75px ls normal | Inter 400 10.5px/15.75px ls -0.21px | Inter 400 10.5px/15.75px ls normal | Inter 400 10.5px/15.75px ls normal | sí |
| 14 | Quiero cargar mi inventario (<button>) | Inter 400 16px/24px ls normal | JetBrains Mono 500 12.5px/18.75px ls normal | Inter 400 16px/24px ls normal | Inter 400 16px/24px ls normal | sí |

### Lista de conflictos tipográficos (resueltos)

1. Peso tipográfico (§2, conflicto 5): ya no hay tope de 500; manda el peso de la app.
2. Mono de Cursor/Lusion para metadatos: descartada; los metadatos usan la familia de la app.
3. Tracking −0,02 em de Lusion: descartado.
4. Título de página: vuelve a Oxanium (`titulo-metalico`); en Lusion solo cambia su color (sin degradado).

## 4. Tokens

### 4.1 Tokens crudos de Lusion usados (solo los permitidos)

| Token | Valor | Uso |
|---|---|---|
| `--lu-lavender` | `#f0f1fa` | lienzo (claro) |
| `--lu-paper` | `#ffffff` | superficies (claro), texto (oscuro), texto del botón principal (claro) |
| `--lu-ink` | `#000000` | texto (claro), lienzo (oscuro), texto del botón principal (oscuro) |
| `--lu-graphite` | `#2b2e3a` | relleno del botón principal y texto suave (claro); superficies (oscuro) |
| `--lu-haze` | `#e4e6ef` | bordes y superficie 2 (claro); texto suave (oscuro) |
| `--lu-slate` | `#34393f` | bordes y superficie 2 (oscuro) |
| `--lu-forest` / `--lu-crimson` / `--lu-amber` | `#34785c` / `#cf2d56` / `#c08532` | **solo estado** (de Cursor), ver 5 |
| `--lu-sombra` | `0 6px 10px rgba(0,0,0,.04), 0 2px 4px rgba(0,0,0,.04)` | única sombra |
| radios | 3 / 15 / 18 / 87,5 / 100 px | detalle / tarjeta / campo / botón / imagen |

### 4.2 Tokens semánticos por apariencia (`--ia-*`)

| Token | Transparente (actual, sin tocar) | Lusion Claro | Lusion Oscuro |
|---|---|---|---|
| `--ia-lienzo` | video + vidrio | `#f0f1fa` | `#000000` |
| `--ia-superficie` | vidrio `oklch(0.15 0.02 250 / .55)` | `#ffffff` | `#2b2e3a` |
| `--ia-superficie-2` | — | `#e4e6ef` | `#34393f` |
| `--ia-borde` | `oklch(1 0 0 / .14)` | `#e4e6ef` | `#34393f` |
| `--ia-texto` | `oklch(0.97 0.01 250)` | `#000000` | `#ffffff` |
| `--ia-texto-suave` | `oklch(0.88 0.01 250 / .85)` | `#2b2e3a` | `#e4e6ef` |
| `--ia-accion` (relleno del botón principal) | borde verde translúcido | `#2b2e3a` | `#ffffff` |
| `--ia-accion-texto` | — | `#ffffff` | `#000000` |
| `--ia-foco` (anillo de 2 px) | (el de hoy) | `#000000` | `#ffffff` |
| `--ia-acento` | `oklch(0.78 0.16 250)` | `#000000` | `#ffffff` |
| `--ia-ok / --ia-error / --ia-aviso` | oklch de hoy | `#34785c / #cf2d56 / #c08532` (solo relleno de chapa) | idem |

### 4.3 Derivación de **Lusion Oscuro** (Lusion solo existe en claro) — espera tu aprobación

Se deriva **solo** con Ink, Graphite, Slate Hollow, Lavender Mist, Paper White y Haze. Idea: invertir la escalera de superficies
que Lusion ya define (Canvas → Paper → Haze → Graphite → Slate) y mantener su gramática (planos, sin sombra visible).

| Elemento | Valor | Por qué sale de Lusion |
|---|---|---|
| Lienzo | **Ink** `#000` | Pedido: «fondo negro». Es el negro puro que Lusion ya usa para texto; análogo del Lavender Mist. |
| Superficie (tarjetas, burbujas, campos) | **Graphite** `#2b2e3a` | Lusion lo define como «superficie oscura de UI». Sustituye a Paper White como nivel 1. |
| Superficie 2 (chips, filas activas) | **Slate Hollow** `#34393f` | Lusion: «capa más oscura para bandas/overlays». Sustituye a Haze como nivel 2. |
| Borde | **Slate Hollow** | Equivale al Haze del claro (hairline un escalón sobre la superficie). Es discreto (1,16–1,8 : 1) a propósito, como el Haze de Lusion. |
| Texto principal | **Paper White** `#fff` | Inversión del Ink. |
| Texto suave / marcador de posición | **Haze** `#e4e6ef` | Inversión de Graphite (texto atenuado). Lusion pide jerarquía por tamaño, no por grises: la diferencia con el principal es pequeña a propósito. |
| Botón principal | relleno **Paper White**, texto **Ink** | Inversión del Pill Action Button (Graphite + blanco). |
| Foco | anillo **Paper White** 2 px | Sustituye al indigo (prohibido); Ink no se vería sobre fondo oscuro. |
| Sombra | la misma al 4 % | Sobre negro es casi invisible: la separación la dan Graphite vs Ink, como pide Lusion («la profundidad no viene de la sombra»). |
| Lavender Mist | no se usa en el oscuro | Es el lienzo claro; su inversión es el Ink. |

## 5. Estado (verde / rojo / ámbar) — desviación documentada

Verde/rojo/ámbar de Cursor (`#34785c`, `#cf2d56`, `#c08532`) solo indican estado (listo / error / esperando). **Desviación:** no se usan como
color de **texto ni de icono**, porque varios pares no llegan a AA (ver 6). Se usan como **relleno de una chapa pequeña** con
texto Paper White (verde, rojo) o Ink (ámbar). El estado nunca depende solo del color: lleva texto («listo», «error»…).

## 6. Contraste (WCAG AA)

**Pares de tokens** (`node scripts/pruebas/contraste-tokens.cjs`):

| Par | Lusion Claro | Lusion Oscuro | Mínimo |
|---|---:|---:|---:|
| texto / lienzo | 18,67 | 21,00 | 4,5 |
| texto / superficie | 21,00 | 13,51 | 4,5 |
| texto / superficie 2 | 16,86 | 11,65 | 4,5 |
| texto suave / lienzo | 12,01 | 16,86 | 4,5 |
| texto suave / superficie | 13,51 | 10,85 | 4,5 |
| texto suave / superficie 2 | 10,85 | 9,35 | 4,5 |
| texto del botón / relleno del botón | 13,51 | 21,00 | 4,5 |
| foco / lienzo | 18,67 | 21,00 | 3 |
| Forest como **texto** sobre superficie | 5,27 ✓ | 2,56 ✗ | 4,5 |
| Crimson como **texto** sobre superficie | 5,04 ✓ | 2,68 ✗ | 4,5 |
| Amber como **texto** sobre superficie | 3,16 ✗ | 4,27 ✗ | 4,5 |
| Paper sobre Forest / Crimson (chapa) | 5,27 / 5,04 ✓ | igual | 4,5 |
| Ink sobre Amber (chapa) | 6,64 ✓ | igual | 4,5 |

Los pares de estado como texto que fallan **no se usan** (por eso la chapa rellena). Los bordes son decorativos (1,1–1,8 : 1), como el Haze de Lusion.

**Verificación automática en vivo** (ventana real): todo nodo de texto visible de la página de IA, su panel de historial, la mascota
y el visor de recorridos se compara contra el fondo opaco real que tiene detrás. Resultado: `INFORME_CONTRASTE.md`
(0 fallos en Lusion Oscuro y Lusion Claro; los controles desactivados están exentos por WCAG).

## 7. Verificación de colores prohibidos

`grep -rniE "1a2ffb|c1ff00"` sobre `src/`, `public/`, `index.html` (CSS/JS/JSX/TS/SVG/HTML/JSON), los documentos del repo (excepto `refero.md`, que es la fuente)
y los paquetes de efectos (`border-beam`, `thinking-orbs`, `bot-avatars`): **0 resultados**.
(`refero.md` los menciona porque es el documento que los define y los excluye.)

## 8. Archivos

- `src/ia/apariencia.js` — tienda de apariencia (3 valores, migra `clasico/oscuro/claro` viejos, persiste, aplica `data-ia-tema`).
- `src/ia/apariencias.css` — tokens y piel Lusion (solo bajo `.ia-scope`).
- `src/pages/admin/ConfigApariencia.jsx` — selector + «Video de fondo» (solo en Transparente).
- `src/components/background/VideoBackground.jsx` — «Video de fondo» y pausa mientras IA está en Lusion (sin borrar frames ni lógica).

## 9. Nombre del negocio y fondo propio (3.3)

- **Nombre:** se usa el campo que ya existía, `configuracion_pos.gym_nombre` (Configuración → Negocio, rotulado ahora «Nombre del negocio»; también en «Punto de Venta y Pagos»). `src/ia/negocio.js` lo expone en caliente y fija `document.title`.
  Sustituye a «Gimnasio» en: título de la ventana, diálogo de cierre, cabecera del login (y su `alt`), «Sobre el Sistema» (Configuración y Ajustes) y encabezado del cobro del asistente de cliente nuevo.
- **No se tocaron** (se reportan): factura (`VistaFactura.jsx`, `electron/facturacion/handlers.cjs` PDF/correo/carpeta `Documents\Gimnasio\Facturas`, datos de prueba), recibo (`VistaRecibo.jsx` marca de agua y valor por defecto `GIMNASIO`; el nombre real ya salía de `gym_nombre`), `ConfiguracionFacturacion.jsx` (ejemplos y plantilla de correo), diálogos de guardado de respaldo, título nativo `GIMNASIO` de `electron/main.cjs` (se sobrescribe al cargar la página), `index.html` (título previo a cargar React) y textos descriptivos «del gimnasio» (la app sigue siendo de gimnasio).
- **Fondo propio:** Configuración → «Apariencia del módulo de IA» → «Fondo propio» (Elegir foto / Restaurar fondo original). IPC `fondo:elegir|obtener|restaurar`: `sharp` reduce a 1920×1080 máx. y guarda `userData/fondo/fondo.webp` (calidad 82). La foto reemplaza al video en todo el sistema (una sola imagen, sin frames); «Restaurar» borra el archivo y vuelve el video. Todo local.

## 10. Estructura del módulo de IA en Lusion (3.4)

Solo con `data-ia-tema="lusion-*"` (en Transparente el DOM envuelve con `display: contents` y no cambia nada visible). El comportamiento no cambia.

| Pieza | Referencia | Implementación |
|---|---|---|
| Historial acoplado a la izquierda (≥ 1100 px; con menos ancho vuelve a ser panel) | ChatGPT | `PanelLateral` con `incrustado`; «Archivos adjuntos» y «Actividad de IA» al pie |
| Columna central de 780 px, IA sin burbuja, línea fina entre turnos, persona en píldora de superficie 2 | ChatGPT | clases `ia-fila-*`, `ia-columna`, `ia-cuerpo` |
| Compositor «terminal»: un solo campo con borde, `>` en mono, botones dentro, línea de metadatos debajo (Enter / Mayús+Enter / `/` / modelo) | Cursor | `.ia-compositor-fila`, `.ia-prompt`, `.ia-meta-linea` |
| Metadatos: hora del mensaje, modelo activo (solo lectura), origen de cada dato | Cursor | `.ia-meta*` (tipografía de la app) |
| Chip de modo + explicación visible del modo | Perplexity | `.ia-modo`, `data-testid="modo-explicacion"` |
| Esqueleto de carga (3 barras opacas que respiran, sin degradado) en vez de puntos | Perplexity | `EsqueletoCarga` (`prefers-reduced-motion`: sin animación) |
| Estado vacío con 4 ejemplos que rellenan el campo (no envían) | Perplexity | `EstadoVacio` |

**Adaptaciones por lo que no existe en esta app:**
- *Citas web de Perplexity* → **«Origen» de cada dato extraído**: nombre del archivo en cada fila de la tabla y en cada ítem de revisión (más el texto detectado donde el lector lo entrega). Visible en las tres apariencias.
- *Selector de modelo con chevron* → **etiqueta de solo lectura** del modelo activo; cambiarlo sigue siendo en Configuración → Asistente IA (no se toca la calidad del modelo desde aquí).
- *Filas fantasma del historial (ChatGPT)*: el historial es local y síncrono; no hay estado de carga que mostrar. No implementado.

**Mejoras de UX en todas las apariencias (en Transparente solo estas):** «Pensando… N s» / «Llevo N s» mientras el asistente trabaja; una línea que explica qué hace el modo activo; voseo → «tú» en toda la UI de IA y en los dos textos fijos del servicio (`scripts/ocr_service.py`); la mascota nace sobre la píldora «Control por voz» de Caja (posición por defecto 20 px más arriba; una posición guardada por la persona no se toca).

## 11. «Transparente idéntico» tras 3.3 y 3.4

Método: A/B contra el commit previo a la Fase 3 (`02fea01`, worktree `C:\Erick\GymBase`), capturas deterministas en la misma sesión y base de datos.
Diferencias medidas y su causa (control: ocultando la línea del modo y fijando la mascota en su posición antigua, **todo vuelve a ruido ≤ 0,13 %**):

| Captura | Diferencia | Causa |
|---|---:|---|
| Clientes / Caja / mascota cerrada | 0,5–1,0 % | mascota 20 px más arriba (intencionado) |
| Mascota abierta | 6,8 % | el panel crece desde la burbuja, que ahora está más arriba (intencionado) |
| IA vacía / IA con conversación | 2,0 % / 5,1 % | nueva línea «Preguntar: solo respondo…» desplaza el contenido (intencionado) + placeholder «Escribe o adjunta» |
| Configuración | 6,6–7,0 % | tarjeta nueva «Apariencia del módulo de IA» (3.2, intencionado) |
| Con control (línea oculta + mascota en la posición vieja) | IA 0,25 %; resto ≤ 0,13 % | solo el placeholder (voseo → tú) y el contador de notificaciones |
