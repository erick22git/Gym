/*============================================================

    GLASS ENGINE
    REFRACTION.JS

    Controla los <filter> SVG definidos en svg/filters.svg
    (feTurbulence, feGaussianBlur, feDisplacementMap,
    feMorphology, feSpecularLighting, feComposite).

    DECISIÓN DE ARQUITECTURA — por qué se inyecta el SVG en
    línea en vez de cargarlo con <object>: para que CSS pueda
    aplicar `filter: url(#glass-refraction-menu)` los nodos
    del filtro deben vivir en EL MISMO documento que los
    elementos que lo usan. Un <object data="filters.svg">
    carga el SVG en un documento separado (accesible por
    `contentDocument`); si este motor mutara los atributos ahí
    dentro, esos cambios no afectarían al filtro que el CSS del
    documento principal está usando para renderizar — serían
    dos instancias distintas del mismo archivo. Por eso se
    hace fetch() del archivo y se inyecta su marcado tal cual
    dentro de <body>: un solo nodo, leído por CSS y mutado por
    JS en cada frame.

    Requiere servir la carpeta con un servidor estático — NO
    abrir index.html con file://. El catch() de abajo maneja con
    elegancia el caso en que ESTE fetch puntual falle (ej. el
    archivo no existe, 404): el material sigue funcionando solo
    con CSS, sin refracción ni luz especular.

    OJO — eso NO es lo que pasa bajo file://: ahí Chrome bloquea
    por CORS la carga del propio `<script type="module">` de
    main.js ANTES de que una sola línea de este archivo se
    ejecute (confirmado empíricamente, ver GLASS_ENGINE_PORTABILIDAD.md).
    Sin JS corriendo, no se crea un solo `.glass-material` — no
    hay "degradado a CSS", no hay vidrio en absoluto, la página
    se ve completamente plana. El catch() de aquí nunca llega a
    correr en ese caso; el aviso real vive en el atributo
    onerror del <script type="module"> en index.html.

============================================================*/

/* ============================================================
 * [GLASS ENGINE — CORE] — COPIAR TAL CUAL, NO MODIFICAR
 * Motor genérico, independiente del número de ítems o de los
 * íconos usados. Al portar a otra app, se copia completo, sin
 * cambios de lógica.
 * ============================================================ */

import Utils from "./utils.js";

import renderer from "./renderer.js";

const SOURCE_PATH = "svg/filters.svg";

class RefractionEngine {

    constructor() {

        this.ready = false;

        this.root = null;

        this.channels = new Map();

        this.inject();

        renderer.add(this);

    }

    /*======================================================
    CARGA E INYECCIÓN EN EL DOCUMENTO PRINCIPAL
    ======================================================*/

    inject() {

        fetch(SOURCE_PATH)

            .then((response) => {

                if (!response.ok) {

                    throw new Error(response.statusText);

                }

                return response.text();

            })

            .then((markup) => this.mount(markup))

            .catch(() => {

                console.warn(

                    "[GlassEngine] No se pudieron cargar los filtros SVG " +

                    "(sirve la carpeta con un servidor estático, no con " +

                    "file://). El material seguirá funcionando solo con CSS."

                );

            });

    }

    mount(markup) {

        const wrapper = document.createElement("div");

        wrapper.innerHTML = markup.trim();

        const svg = wrapper.querySelector("svg");

        if (!svg) {

            return;

        }

        document.body.prepend(svg);

        this.root = svg;

        this.ready = true;

        this.cacheChannel("menu");

        this.cacheChannel("card");

        // [LOGIN — CONSUMIDOR] Canal propio para los botones de vidrio del
        // login (INICIAR SESIÓN / Registrarse / Olvidé mi contraseña) — ver
        // GLASS_ENGINE_PORTABILIDAD.md, sección "riesgo latente": varias
        // instancias no pueden compartir el canal "card" sin pisarse el
        // fePointLight/scale en vivo cada frame. Requiere el filtro
        // #glass-refraction-button / #glass-specular-button en filters.svg.
        this.cacheChannel("button");

    }

    /*======================================================
    CACHÉ DE REFERENCIAS A PRIMITIVAS DEL FILTRO
    ======================================================*/

    cacheChannel(name) {

        const displacement = this.root.querySelector(

            `#glass-refraction-${name} feDisplacementMap`

        );

        const light = this.root.querySelector(

            `#glass-specular-${name} fePointLight`

        );

        if (!displacement && !light) {

            return;

        }

        this.channels.set(name, {

            displacement,

            light,

            baseScale: displacement

                ? parseFloat(displacement.getAttribute("scale"))

                : 0,

            speed: 0,

            nx: 0.5,

            ny: 0.5

        });

    }

    /*======================================================
    API PÚBLICA — usada por GlassMaterial cada frame
    ======================================================*/

    isAvailable(name) {

        return this.ready && this.channels.has(name);

    }

    feed(name, { speed, nx, ny }) {

        const channel = this.channels.get(name);

        if (!channel) {

            return;

        }

        channel.speed = speed;

        channel.nx = nx;

        channel.ny = ny;

    }

    /*======================================================
    ACTUALIZAR — llamado por renderer en cada frame
    ======================================================*/

    update() {

        if (!this.ready) {

            return;

        }

        this.channels.forEach((channel) => this.applyChannel(channel));

    }

    applyChannel(channel) {

        if (channel.displacement) {

            const boost = Utils.clamp(channel.speed * 0.6, 0, 26);

            channel.displacement.setAttribute(

                "scale",

                (channel.baseScale + boost).toFixed(2)

            );

        }

        if (channel.light) {

            channel.light.setAttribute("x", Utils.clamp(channel.nx, 0, 1).toFixed(3));

            channel.light.setAttribute("y", Utils.clamp(channel.ny, 0, 1).toFixed(3));

        }

    }

}

/*============================================================

    SINGLETON

============================================================*/

const refraction = new RefractionEngine();

export default refraction;
