// ─── Mapeo de transiciones de video de fondo (ver public/frames/video{1,2,3}/
// para los JPG y src/components/background/VideoBackground.jsx para la
// lógica de reproducción) ──────────────────────────────────────────────────

import { PAGES } from '../constants'

//
// Fuente: D:\Saas\imagenes\Salud & Bienestar\Gimnasio\{1-5,6-10,6-11-12}.mp4
// Extraídos con ffmpeg a JPG numerados (frame_0000.jpg...), 1916x1080,
// 24fps nativo (sin resamplear), -start_number 0 → el número de frame acá
// coincide 1:1 con el nombre de archivo. Sirven desde public/ (no
// src/assets/) para poder construir la ruta por string simple
// (/frames/video1/frame_0143.jpg), mismo patrón que login.png/logo.png.
//
// video1 (1-5.mp4)     → 361 frames (frame_0000–frame_0360)
// video2 (6-10.mp4)    → 361 frames (frame_0000–frame_0360)
// video3 (6-11-12.mp4) → 217 frames (frame_0000–frame_0216)
//
// COMPORTAMIENTO DE REPRODUCCIÓN (sin reversa): cada página tiene su
// propio rango fijo frameStart..frameEnd en su propio video, independiente
// de las demás páginas. Al entrar a una página, VideoBackground.jsx corta
// DIRECTO a su frameStart (se pinta ese frame de inmediato, sin frame
// intermedio) y reproduce siempre hacia adelante hasta frameEnd — nunca
// hacia atrás, y sin ninguna noción de "volver al anchor" del video en el
// que se estaba antes. No hay continuidad entre páginas: cada entrada a
// página arranca su propia animación desde cero. `frameStart` SÍ se usa en
// runtime (a diferencia del esquema viejo, donde era solo documentación).
//
// Rangos duplicados a propósito (mismo video+frameStart+frameEnd en 2
// páginas distintas): Papelera/Auditoría (video1, 348-360),
// Dashboard/Configuración (video3, 0-67) y Ventas/Casilleros (video2,
// 223-360) — no es un error de solapamiento, están así por decisión
// explícita.
//
// ⚠⚠ video3 tiene 11 archivos de frame FALTANTES en disco (no es un
// problema de este mapeo, es que faltan los JPG): frame_0068 a frame_0070,
// y frame_0143 a frame_0150. Cualquier rango de video3 que incluya esos
// números va a "congelarse" en el último frame válido anterior durante el
// tramo faltante (drawCover no dibuja si la imagen no cargó), en vez de
// seguir avanzando visualmente — el contador interno sigue llegando a
// frameEnd igual, pero no se ve. dashboard-to-reportes (71-150) YA incluía
// el hueco 143-150 desde el mapeo anterior a este mensaje.

export const VIDEO_TRANSITIONS = {
  // Dashboard — mismo rango que Configuración, a propósito (ver arriba).
  anchor: {
    video: 'video3',
    frameStart: 0,
    frameEnd: 67,
    staticFrame: 'video3/frame_0067.jpg',
  },

  // ── Video 1 ──────────────────────────────────────────────────────────
  'dashboard-to-control-acceso': {
    video: 'video1',
    frameStart: 143,
    frameEnd: 219,
    staticFrame: 'video1/frame_0219.jpg',
  },
  'dashboard-to-clientes': {
    video: 'video1',
    frameStart: 271,
    frameEnd: 310,
    staticFrame: 'video1/frame_0310.jpg',
  },
  papelera: {
    video: 'video1',
    frameStart: 348,
    frameEnd: 360,
    staticFrame: 'video1/frame_0360.jpg',
  },
  // Auditoría — mismo rango que Papelera, a propósito (ver arriba).
  'dashboard-to-auditoria': {
    video: 'video1',
    frameStart: 348,
    frameEnd: 360,
    staticFrame: 'video1/frame_0360.jpg',
  },

  // ── Video 2 — Membresía se movió a video3 (ver esa sección). Inventario
  // (151-222) → Ventas(223-360) siguen acá; 0-150 quedó libre. ─────────
  'dashboard-to-inventario': {
    video: 'video2',
    frameStart: 151,
    frameEnd: 222,
    staticFrame: 'video2/frame_0222.jpg',
  },
  'dashboard-to-ventas': {
    video: 'video2',
    frameStart: 223,
    frameEnd: 360,
    staticFrame: 'video2/frame_0360.jpg',
  },
  // Casilleros — mismo rango EXACTO que Ventas, a propósito (pedido
  // explícito, no un duplicado accidental como el de Membresías/Reportes).
  'dashboard-to-casilleros': {
    video: 'video2',
    frameStart: 223,
    frameEnd: 360,
    staticFrame: 'video2/frame_0360.jpg',
  },

  // ── Video 3 ──────────────────────────────────────────────────────────
  'dashboard-to-configuracion': {
    video: 'video3',
    frameStart: 0,
    frameEnd: 67,
    staticFrame: 'video3/frame_0067.jpg',
  },
  // Membresía — mismo rango que Reportes (71-150), EXACTO duplicado sin
  // confirmar como intencional (a diferencia de Papelera/Auditoría, que sí
  // se pidieron explícitamente iguales) — avisado, no resuelto solo.
  // También incluye el hueco de archivos faltantes 143-150 (ver nota
  // arriba): en la práctica se va a quedar congelada en el frame_0142
  // durante ese tramo en vez de seguir hasta 150.
  'dashboard-to-membresias': {
    video: 'video3',
    frameStart: 71,
    frameEnd: 150,
    staticFrame: 'video3/frame_0150.jpg',
  },
  'dashboard-to-reportes': {
    video: 'video3',
    frameStart: 71,
    frameEnd: 150,
    staticFrame: 'video3/frame_0150.jpg',
  },
  // Caja — rango completo, sin archivos faltantes (verificado 151-216).
  'dashboard-to-caja': {
    video: 'video3',
    frameStart: 151,
    frameEnd: 216,
    staticFrame: 'video3/frame_0216.jpg',
  },

  // Facturación: sin transición — fondo fijo, sin reproducir nada.
  facturacion: {
    static: true,
    staticFrame: 'video1/frame_0000.jpg',
  },
} as const

export type VideoTransitionKey = keyof typeof VIDEO_TRANSITIONS

// Mapeo página (PAGES.*) → clave de VIDEO_TRANSITIONS. Solo están acá las
// páginas con fondo de video propio — cualquier página ausente de este
// mapa no toca el fondo (queda el que ya estaba puesto).
export const PAGE_TO_TRANSITION = {
  [PAGES.DASHBOARD]: 'anchor',
  [PAGES.GESTION_PLANES]: 'dashboard-to-membresias',
  [PAGES.CONTROL_ACCESO]: 'dashboard-to-control-acceso',
  [PAGES.VENTAS]: 'dashboard-to-ventas',
  [PAGES.CASILLEROS]: 'dashboard-to-casilleros',
  [PAGES.CAJA]: 'dashboard-to-caja',
  [PAGES.INVENTARIO]: 'dashboard-to-inventario',
  [PAGES.REPORTES]: 'dashboard-to-reportes',
  [PAGES.AUDITORIA]: 'dashboard-to-auditoria',
  [PAGES.CLIENTS]: 'dashboard-to-clientes',
  // [AGREGADO — pedido explícito, "en el ojo está mostrando otros frames
  // de fondo"] Perfil de Cliente no estaba en este mapa — el comentario
  // de arriba explica qué pasa en ese caso: "cualquier página ausente...
  // no toca el fondo (queda el que ya estaba puesto)". O sea que al
  // entrar por el ícono del ojo, el fondo se quedaba con lo que hubiera
  // ANTES de navegar (Dashboard, Caja, donde sea que vinieras), no con
  // los frames de Clientes. Mismo rango que PAGES.CLIENTS — mismos
  // frames afuera y adentro del perfil.
  [PAGES.PERFIL_CLIENTE]: 'dashboard-to-clientes',
  [PAGES.CONFIGURACION]: 'dashboard-to-configuracion',
  [PAGES.FACTURACION_EMITIR]: 'facturacion',
  [PAGES.PAPELERA]: 'papelera',
  // IA / Importar datos — sin frames propios extraídos todavía, comparte
  // el MISMO frame final que Configuración (misma decisión ya tomada acá
  // para Dashboard/Configuración) en vez de duplicar ningún JPG.
  [PAGES.IA_IMPORTAR]: 'dashboard-to-configuracion',
} as const
