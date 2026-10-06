# Diseño — apariencias del módulo de IA y la mascota

> Estado: **3.0–3.2 (pendiente de tu OK)**. Fuente de diseño: `refero.md` (rangos indicados). Los colores
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
5. **Peso tipográfico:** ChatGPT 600 en titulares vs Lusion ≤ 500 → 500 como máximo (Inter 400/500).
6. **Hover:** ChatGPT usa un velo de relleno; Lusion prohíbe cambiar el relleno → opacidad .72 / subrayado.
7. **Verde como «acento de acción» (Cursor)** vs tu regla de usarlo **solo para estado** → solo estado (ver 5).
8. **Contradicción interna de Lusion:** el *token* Graphite dice «no promover a CTA», pero el componente *Pill Action Button* lo usa
   como relleno → se sigue el **componente** (relleno Graphite, texto Paper White), que es lo que indica la guía de prompts.
9. **Sin blur (Lusion)** vs el efecto líquido que pedirás en 3.5 → excepción explícita, solo en Lusion, con interruptor (aún no implementada).
10. **Estado de Cursor «no usar como estado»** (Forest/Crimson lo advierten) vs tu instrucción de usarlos **solo** para estado → manda tu instrucción.

## 3. Fuentes

- **Inter** (ya empaquetada, `@fontsource/inter`, OFL) sustituye a Aeonik (propietaria; Lusion sugiere Inter). Se usan solo los pesos **400 y 500**.
- **JetBrains Mono** (OFL, `@fontsource/jetbrains-mono`, pesos 400/500, **empaquetada en la app**) sustituye a berkeleyMono/CursorGothic
  para metadatos, código y tiempos. CursorGothic y Aeonik son propietarias y **no** se usan.
- Sin CDN ni Google Fonts. Tracking `-0.02em` en todo el texto Lusion (mono: 0).

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
