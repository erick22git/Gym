/*============================================================

    GLASS ENGINE
    LENS-MAP.JS

    buildLensDisplacementMap — genera, por píxel, un mapa de
    desplazamiento de "lupa real": un campo de vectores que
    empuja hacia AFUERA desde el centro, con más fuerza cerca del
    borde (perfil convexo, dist^3). Eso es lo que hace que el
    centro apenas se mueva y el borde doble con fuerza — una
    turbulencia (feTurbulence) no puede describir esto, porque su
    ruido no tiene una dirección radial coherente, solo agitación
    local ("agua temblando" en vez de "lupa").

    Se codifica como una imagen RGB neutra en 128,128 (sin
    desplazamiento) donde el canal R guarda el empuje en X y el
    canal G el empuje en Y — el formato que espera
    feDisplacementMap con xChannelSelector="R" yChannelSelector="G".

    Se llama UNA VEZ por tamaño de burbuja (no por frame): ver
    GlassMenu.syncToActive() en menu.js, que la regenera solo
    cuando cambia el ancho del ítem activo.

============================================================*/

/* ============================================================
 * [GLASS ENGINE — CORE] — COPIAR TAL CUAL, NO MODIFICAR
 * Motor genérico, independiente del número de ítems o de los
 * íconos usados. Al portar a otra app, se copia completo, sin
 * cambios de lógica.
 * ============================================================ */

function buildLensDisplacementMap(width, height, options = {}) {

    const padding = options.padding ?? 40;

    const strength = options.strength ?? 46;

    const w = Math.round(width + padding * 2);

    const h = Math.round(height + padding * 2);

    const canvas = document.createElement("canvas");

    canvas.width = w;

    canvas.height = h;

    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "rgb(128,128,0)";

    ctx.fillRect(0, 0, w, h);

    const img = ctx.getImageData(0, 0, w, h);

    const data = img.data;

    const cx = w / 2;

    const cy = h / 2;

    const halfW = width / 2;

    const halfH = height / 2;

    for (let y = 0; y < h; y++) {

        for (let x = 0; x < w; x++) {

            const i = (y * w + x) * 4;

            const nx = (x - cx) / halfW;

            const ny = (y - cy) / halfH;

            const dist = Math.min(1.3, Math.sqrt(nx * nx + ny * ny));

            if (dist > 1.15) {

                data[i] = 128;

                data[i + 1] = 128;

                data[i + 2] = 0;

                data[i + 3] = 255;

                continue;

            }

            const falloff = Math.pow(dist, 3);

            const angle = Math.atan2(ny, nx);

            const push = falloff * strength;

            data[i] = Math.max(0, Math.min(255, 128 + Math.cos(angle) * push));

            data[i + 1] = Math.max(0, Math.min(255, 128 + Math.sin(angle) * push));

            data[i + 2] = 0;

            data[i + 3] = 255;

        }

    }

    ctx.putImageData(img, 0, 0);

    return { dataUrl: canvas.toDataURL("image/png"), w, h, padding };

}

export default buildLensDisplacementMap;
