# Auditoría — Sistema de fondo de video (frames)

Auditoría de solo lectura. No se modificó ningún archivo de código.

**Fuente de la configuración:**
- Mapeo página → transición: `src/config/videoTransitions.ts` (`PAGE_TO_TRANSITION`, `VIDEO_TRANSITIONS`)
- Lógica de reproducción: `src/components/background/VideoBackground.jsx`
- Archivos de frame: `public/frames/video1/`, `public/frames/video2/`, `public/frames/video3/`
- Nombres de página según menú: `src/components/layout/TopNav.jsx` (`NAV_ITEMS`)

**Videos fuente** (según comentario en `videoTransitions.ts`):
- video1 = `1-5.mp4` → 361 frames documentados (frame_0000–frame_0360)
- video2 = `6-10.mp4` → 361 frames documentados (frame_0000–frame_0360)
- video3 = `6-11-12.mp4` → 217 frames documentados (frame_0000–frame_0216)

**Conteo real en disco** (verificado con filesystem, no asumido):

| Video | Frames esperados | Frames presentes en disco | Faltantes |
|---|---|---|---|
| video1 | 361 (0–360) | 355 | 6 → `220, 221, 222, 308, 309, 310` |
| video2 | 361 (0–360) | 359 | 2 → `221, 222` |
| video3 | 217 (0–216) | 206 | 11 → `068, 069, 070, 143, 144, 145, 146, 147, 148, 149, 150` |

Los faltantes de video3 SÍ están documentados en el comentario del archivo de config. Los de video1 y video2 (8 archivos en total) **no están documentados en ningún comentario** — ver Observaciones.

---

## Tabla página → video → frame final

| Página/Módulo | Video | Rango de frames | Frame final (índice) | Ruta del archivo | Comparte frame con |
|---|---|---|---|---|---|
| Dashboard | video3 | 0 → 67 | 67 | `D:\Saas\Gimnasio\public\frames\video3\frame_0067.jpg` | Configuración |
| Configuración | video3 | 0 → 67 | 67 | `D:\Saas\Gimnasio\public\frames\video3\frame_0067.jpg` | Dashboard |
| Control de Acceso | video1 | 143 → 219 | 219 | `D:\Saas\Gimnasio\public\frames\video1\frame_0219.jpg` | — (único) |
| Clientes | video1 | 271 → 310 | 310 | `D:\Saas\Gimnasio\public\frames\video1\frame_0310.jpg` ⚠ **NO EXISTE** | — (único) |
| Membresías (GestionPlanes) | video3 | 71 → 150 | 150 | `D:\Saas\Gimnasio\public\frames\video3\frame_0150.jpg` ⚠ **NO EXISTE** | Reportes |
| Reportes | video3 | 71 → 150 | 150 | `D:\Saas\Gimnasio\public\frames\video3\frame_0150.jpg` ⚠ **NO EXISTE** | Membresías |
| Inventario | video2 | 151 → 222 | 222 | `D:\Saas\Gimnasio\public\frames\video2\frame_0222.jpg` ⚠ **NO EXISTE** | — (único) |
| Ventas | video2 | 223 → 360 | 360 | `D:\Saas\Gimnasio\public\frames\video2\frame_0360.jpg` | — (único) |
| Caja | video3 | 151 → 216 | 216 | `D:\Saas\Gimnasio\public\frames\video3\frame_0216.jpg` | — (único) |
| Papelera | video1 | 348 → 360 | 360 | `D:\Saas\Gimnasio\public\frames\video1\frame_0360.jpg` | Auditoría |
| Auditoría | video1 | 348 → 360 | 360 | `D:\Saas\Gimnasio\public\frames\video1\frame_0360.jpg` | Papelera |
| Facturación (FacturacionEmitir) | video1 (estático, sin animación) | — (corte directo, no reproduce rango) | 0 | `D:\Saas\Gimnasio\public\frames\video1\frame_0000.jpg` | — (único) |

**Página del menú sin fondo de video propio:** Casilleros (`PAGES.CASILLEROS`) no tiene entrada en `PAGE_TO_TRANSITION` — al navegar ahí el canvas conserva el último frame que ya estaba pintado, no toca nada. El resto de páginas admin sin menú propio (GestionModulos, Respaldos, GestionUsuarios, PerfilCliente, ConfiguracionPOS, Descuentos, etc.) tampoco tienen mapeo — se accede a ellas como subpáginas y heredan el fondo de la página desde la que se navegó.

---

## Frames finales únicos a mejorar

9 rutas de archivo distintas cubren las 12 entradas de la tabla (3 pares comparten imagen). De esas 9, **3 no existen en disco todavía** — no se pueden mandar a mejorar calidad hasta que se resuelva la falta del archivo fuente (no es tarea de esta auditoría, solo se reporta).

Rutas a mejorar (con al menos un archivo válido en disco):

- `D:\Saas\Gimnasio\public\frames\video1\frame_0000.jpg` — Facturación
- `D:\Saas\Gimnasio\public\frames\video1\frame_0219.jpg` — Control de Acceso
- `D:\Saas\Gimnasio\public\frames\video1\frame_0360.jpg` — Papelera, Auditoría
- `D:\Saas\Gimnasio\public\frames\video2\frame_0360.jpg` — Ventas
- `D:\Saas\Gimnasio\public\frames\video3\frame_0067.jpg` — Dashboard, Configuración
- `D:\Saas\Gimnasio\public\frames\video3\frame_0216.jpg` — Caja

Rutas referenciadas por el código que **no existen en disco** (bloquean el trabajo de mejora hasta resolverse — ver Observaciones):

- `D:\Saas\Gimnasio\public\frames\video1\frame_0310.jpg` — Clientes
- `D:\Saas\Gimnasio\public\frames\video2\frame_0222.jpg` — Inventario
- `D:\Saas\Gimnasio\public\frames\video3\frame_0150.jpg` — Membresías, Reportes

---

## Observaciones

1. **3 frames finales referenciados en el código no existen en disco.** Confirmado con filesystem, no asumido:
   - `video1/frame_0310.jpg` (Clientes) — falta, junto con `frame_0308.jpg` y `frame_0309.jpg`.
   - `video2/frame_0222.jpg` (Inventario) — falta, junto con `frame_0221.jpg`.
   - `video3/frame_0150.jpg` (Membresías/Reportes) — falta; este caso SÍ está documentado en el comentario de `videoTransitions.ts` (líneas 34–41 y 101–106), que explica que la animación se va a "congelar" visualmente en `frame_0142` en vez de llegar a 150.

2. **Los huecos de video1 y video2 no están documentados en el código.** El comentario de cabecera de `videoTransitions.ts` solo advierte del hueco de video3 (`68-70, 143-150`). En disco también faltan `220, 221, 222, 308, 309, 310` en video1 y `221, 222` en video2 — 8 archivos adicionales sin mencionar en ningún comentario. Esto afecta directamente a 2 de los 12 mapeos (Clientes e Inventario), cuyo frame final configurado no existe.

3. **Comportamiento en runtime cuando el frame final falta:** en `VideoBackground.jsx`, `drawFrame()` solo llama a `drawCover()` si `img.complete` es true y la imagen cargó con `naturalWidth` válido (`drawCover` corta temprano si no). Un JPG faltante devuelve 404 → `onerror` resuelve la promesa de precarga, pero `drawCover` nunca dibuja ese frame — el canvas se queda con el último frame válido anterior al hueco. Efecto práctico:
   - Clientes: el fondo queda fijo en `frame_0307.jpg` en vez de `frame_0310.jpg`.
   - Inventario: el fondo queda fijo en `frame_0220.jpg` en vez de `frame_0222.jpg`.
   - Membresías/Reportes: ya documentado en el código, queda fijo en `frame_0142.jpg` en vez de `frame_0150.jpg`.
   
   Es decir, la "imagen final real" que ve el usuario en estas 3 páginas hoy NO es la que indica `staticFrame` en la config, sino el último frame válido antes del hueco.

4. **Duplicados intencionales confirmados por el propio código** (comentario explícito en `videoTransitions.ts` líneas 29-32): Papelera/Auditoría (video1, 348–360) y Dashboard/Configuración (video3, 0–67). Verificado que ambos rangos están completos en disco (sin huecos) para esos tramos exactos — no afectan al frame final compartido.

5. **Duplicado sin confirmar como intencional:** Membresías y Reportes comparten el rango exacto video3 71–150. El propio comentario del código (líneas 101-103) dice explícitamente que este duplicado "no está confirmado como intencional" y que fue avisado sin resolver — se reporta acá de nuevo, no se decide nada al respecto en esta auditoría.

6. **Ningún rango de frames excede la duración real documentada de su video** (todos caen dentro de 0–360 para video1/video2 y 0–216 para video3) — el único problema de "rango vs. duración" real es la falta de archivos individuales dentro de rangos por lo demás válidos, cubierto en los puntos 1 y 2.

7. **"Ver ventas de este turno" / Facturación no reproduce rango**, es un corte directo y fijo a `video1/frame_0000.jpg` (`static: true` en la config) — no tiene `frameStart`/`frameEnd` real, se listó con rango "—" en la tabla para no inventar un dato que el código no tiene.
