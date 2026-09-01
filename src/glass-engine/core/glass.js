/*============================================================

    GLASS ENGINE
    GLASS.JS

    GlassMaterial — el primitivo óptico del motor.

    Dado un elemento, construye dentro de él un `.glass-material`
    con 3 capas — fill, specular, rainbow — y, cada frame, calcula
    las variables CSS que las alimentan.

    REDUCIDO de 10 capas a 3 (petición explícita): depth,
    highlight, border, shine, fresnel, tint, blur y lens quedaron
    consolidadas. Cada capa que se pinta por separado suma blanco
    encima de la anterior — eso es lo que impedía la transparencia
    real; con 3 capas hay menos superficies compitiendo por el
    mismo espacio de opacidad:

        - fill      → backdrop-filter (blur+saturate) + un tinte
                      translúcido parejo. Recibe además, por JS,
                      `filter:url(#glass-refraction-X)
                      url(#glass-specular-X)` en cuanto el canal
                      SVG está disponible — la refracción real y
                      la luz especular (feSpecularLighting) actúan
                      sobre este backdrop ya muestreado.
        - specular  → un solo box-shadow inset (borde superior
                      claro / inferior oscuro + un aro fino que
                      reacciona a --border-intensity). Sustituye a
                      depth+highlight+border+fresnel juntas.
        - rainbow   → dispersión cromática de borde, ver su propia
                      nota en glass.css.

    Lo que se elimina del todo (no se reemplaza, "specular" ya lo
    cubre): shine y reflection, los dos puntos de brillo blanco
    que perseguían al cursor — eran los mayores responsables del
    efecto "cápsula blanca".

============================================================*/

/* ============================================================
 * [GLASS ENGINE — CORE] — COPIAR TAL CUAL, NO MODIFICAR
 * Motor genérico, independiente del número de ítems o de los
 * íconos usados. Al portar a otra app, se copia completo, sin
 * cambios de lógica. Las opciones (channel, thickness,
 * proximity, lightIntensityScale...) las pasa el CONSUMIDOR
 * (menu.js/card.js) al instanciar — eso sí varía por app, esta
 * clase no.
 * ============================================================ */

import Utils from "./utils.js";

import Spring from "./spring.js";

import renderer from "./renderer.js";

import cursor from "./cursor.js";

import refraction from "./refraction.js";

const LAYERS = [

    "fill",

    "specular",

    "rainbow"

];

class GlassMaterial {

    constructor(root, options = {}) {

        this.root = root;

        this.channel = options.channel ?? null;

        this.thickness = options.thickness ?? "regular";

        this.proximity = options.proximity ?? 240;

        this.chroma = options.chroma ?? "motion";

        // Cuánto de la proximidad del cursor se deja pasar hacia
        // "specular"/"rainbow". 1 = comportamiento completo
        // (tarjeta). Un canal que necesite un cuerpo más
        // transparente en reposo (la burbuja del menú) puede
        // pasar un valor bajo sin afectar a otro GlassMaterial.

        this.lightIntensityScale = options.lightIntensityScale ?? 1;

        this.rect = root.getBoundingClientRect();

        this.motionSpeed = 0;

        this.intensity = new Spring(0, {

            stiffness: options.lightStiffness ?? 0.18,

            damping: options.lightDamping ?? 0.7

        });

        this.squeeze = new Spring(0, {

            stiffness: options.squeezeStiffness ?? 0.42,

            damping: options.squeezeDamping ?? 0.6

        });

        this.refractionApplied = false;

        this.wrapContent();

        this.buildLayers();

        this.root.classList.add("glass-root", `glass--${this.thickness}`);

        renderer.add(this);

    }

    /*======================================================
    ENVOLVER EL CONTENIDO EXISTENTE

    Todo lo que ya hubiera dentro del elemento (texto, iconos,
    botones...) pasa a vivir en .glass-content, que queda por
    encima de las capas ópticas (--z-content). Si el elemento
    no tenía nada (la burbuja del menú), el wrapper queda vacío
    y no afecta a nada.
    ======================================================*/

    wrapContent() {

        let content = this.root.querySelector(":scope > .glass-content");

        if (!content) {

            content = Utils.create("div", "glass-content");

            while (this.root.firstChild) {

                content.appendChild(this.root.firstChild);

            }

            this.root.appendChild(content);

        }

        this.content = content;

    }

    /*======================================================
    CONSTRUIR LAS CAPAS ÓPTICAS
    ======================================================*/

    buildLayers() {

        this.material = Utils.create("div", "glass-material");

        this.layers = {};

        LAYERS.forEach((name) => {

            const layer = Utils.create("div", `glass-layer glass-layer--${name}`);

            this.material.appendChild(layer);

            this.layers[name] = layer;

        });

        this.root.insertBefore(this.material, this.root.firstChild);

    }

    /*======================================================
    UPDATE — llamado por renderer en cada frame
    ======================================================*/

    update(deltaMs) {

        this.rect = this.root.getBoundingClientRect();

        const data = cursor.data;

        const distance = this.distanceToRect(data.x, data.y, this.rect);

        this.intensity.setTarget(

            Utils.mapRange(distance, 0, this.proximity, 1, 0, true)

        );

        const intensity = this.intensity.update(deltaMs);

        // "glow" es la proximidad ya atenuada por canal.

        const glow = intensity * this.lightIntensityScale;

        const press = this.squeeze.update(deltaMs);

        // lx/ly (posición local del cursor, 0..1) ya no alimentan
        // ninguna variable CSS — "specular" no sigue al cursor,
        // es un bisel fijo — pero refraction.js sigue
        // necesitándolas para mover el fePointLight real del
        // filtro especular SVG.

        const lx = this.rect.width > 0

            ? Utils.clamp((data.x - this.rect.left) / this.rect.width, 0, 1)

            : 0.5;

        const ly = this.rect.height > 0

            ? Utils.clamp((data.y - this.rect.top) / this.rect.height, 0, 1)

            : 0.5;

        // Velocidad "óptica" del material: la mayor entre la del
        // cursor y la del propio elemento (setMotion).

        const speedFactor = Utils.clamp(

            Math.max(data.speed, this.motionSpeed) / 34,

            0,

            1

        );

        // "physical": dispersión cromática real, no decoración.
        // Nula en reposo; solo aparece pasado un umbral de
        // velocidad y con un tope bajo — aberración cromática de
        // lente, no un arcoíris de fondo. Decae solo, al mismo
        // ritmo que decae speedFactor cuando el vidrio deja de
        // moverse.

        let rainbowOpacity;

        if (this.chroma === "off") {

            rainbowOpacity = 0;

        } else if (this.chroma === "physical") {

            const physicalFactor = Utils.clamp((speedFactor - 0.22) / 0.78, 0, 1);

            rainbowOpacity = physicalFactor * 0.26;

        } else {

            const chromaBase = this.chroma === "always" ? 0.2 : 0.02;

            rainbowOpacity = Utils.clamp(chromaBase + speedFactor * 0.5, 0, 0.62);

        }

        const rainbowOffset = data.dx * speedFactor * 9;

        // border-intensity alimenta ahora "specular" (el aro fino
        // que reacciona) y el glow externo de .glass-root — antes
        // también alimentaba border/fresnel, ya eliminadas.

        const borderIntensity = Utils.clamp(glow * 0.3 + speedFactor * 0.75, 0, 1);

        this.applyVariables({

            lightIntensity: glow.toFixed(3),

            rainbowOpacity: rainbowOpacity.toFixed(3),

            rainbowOffset: `${rainbowOffset.toFixed(2)}px`,

            borderIntensity: borderIntensity.toFixed(3),

            press: press.toFixed(3)

        });

        if (this.channel) {

            refraction.feed(this.channel, { speed: data.speed, nx: lx, ny: ly });

            this.syncRefractionFilters();

        }

    }

    /*======================================================
    DISTANCIA DEL CURSOR AL RECTÁNGULO (0 si está dentro)
    ======================================================*/

    distanceToRect(px, py, rect) {

        const dx = Math.max(rect.left - px, 0, px - rect.right);

        const dy = Math.max(rect.top - py, 0, py - rect.bottom);

        return Math.hypot(dx, dy);

    }

    /*======================================================
    ESCRIBIR LAS VARIABLES CSS QUE LEE glass.css
    ======================================================*/

    applyVariables(vars) {

        const style = this.root.style;

        style.setProperty("--light-intensity", vars.lightIntensity);

        style.setProperty("--rainbow-opacity", vars.rainbowOpacity);

        style.setProperty("--rainbow-offset", vars.rainbowOffset);

        style.setProperty("--border-intensity", vars.borderIntensity);

        style.setProperty("--press", vars.press);

    }

    /*======================================================
    ACTIVAR LOS FILTROS SVG EN CUANTO EL CANAL ESTÉ LISTO

    refraction.js inyecta svg/filters.svg de forma asíncrona
    (fetch), así que el canal puede no estar disponible todavía
    en el primer frame — se reintenta cada frame hasta que lo
    esté y luego se aplica una sola vez. Antes se repartía entre
    dos capas (blur/lens); ahora "fill" es la única que existe,
    así que recibe la cadena completa.
    ======================================================*/

    syncRefractionFilters() {

        if (this.refractionApplied || !refraction.isAvailable(this.channel)) {

            return;

        }

        this.layers.fill.style.filter =

            `url(#glass-refraction-${this.channel}) url(#glass-specular-${this.channel})`;

        this.refractionApplied = true;

    }

    /*======================================================
    INTERACCIÓN — PRESIÓN DEL TACTO

    press()/release() los llama el compositor (GlassMenu,
    GlassCard) en pointerdown/pointerup o al iniciar un
    desplazamiento. El resorte de "squeeze" empuja --press hacia
    1 (comprimido) o 0 (relajado); su propio rebote (damping < 1
    con stiffness alta) es lo que da la sensación de gel al
    soltar.
    ======================================================*/

    press() {

        this.squeeze.setTarget(1);

    }

    release() {

        this.squeeze.setTarget(0);

    }

    /*======================================================
    INTERACCIÓN — VELOCIDAD PROPIA DEL ELEMENTO

    Un compositor con física de posición (GlassMenu) llama a
    esto cada frame con la velocidad de SU PROPIO movimiento
    (no la del cursor). GlassMaterial la usa junto a la
    velocidad del cursor para decidir cuánto se enciende
    specular/rainbow — así la burbuja "flarea" también mientras
    viaja sola entre items.
    ======================================================*/

    setMotion(speed) {

        this.motionSpeed = speed;

    }

    /*======================================================
    DESTROY
    ======================================================*/

    destroy() {

        renderer.remove(this);

        this.material?.remove();

        this.root.classList.remove("glass-root", `glass--${this.thickness}`);

    }

}

export default GlassMaterial;
