/*============================================================

    GLASS ENGINE
    MENU.JS

    GlassMenu — burbuja selectora estilo WhatsApp / iOS Liquid
    Glass.

    No es visual, es de comportamiento: cuando cambia el item
    activo, la burbuja de vidrio se desliza hasta la nueva
    posición usando dos resortes independientes (x, width) en
    vez de una transición lineal. Eso produce desaceleración
    natural y una ligera elasticidad (overshoot) — nunca un
    movimiento robótico.

    La burbuja en sí ES un GlassMaterial (canal "menu"): tiene
    blur, highlight, fresnel, reflejo especular y refracción
    real, y reacciona al cursor igual que cualquier otro vidrio
    del motor. GlassMenu añade dos cosas que un GlassMaterial
    genérico no sabe hacer por sí solo:

        1. La física de posición (los resortes x/width).
        2. El SOBRETAMAÑO — la burbuja se dibuja más ancha y
           más alta que el botón que envuelve (BUBBLE_OVERSIZE_*),
           para que se sienta como una gota de cristal posada
           sobre la barra y no como un fondo de botón a medida.
           Se aplica como transform:scale() adicional sobre la
           misma caja, así que compone gratis con el stretch/
           squash por velocidad que ya existía.

    IMPORTANTE — .selector no cambia su `width` de layout nunca
    (eso fue lo que causaba el "doble marco fantasma": cambiar
    `width` obliga al navegador a recalcular la región del filtro
    SVG, que usa objectBoundingBox, en cada frame). Se crea con un
    ancho FIJO (baseWidth, medido una sola vez) y todo el
    movimiento real — posición Y ancho visual — se hace con
    transform:translateX() scaleX() desde transform-origin:left,
    que no dispara layout.

    NOTA — hubo un segundo elemento (.glass-warp) pensado para
    "alcanzar" ópticamente al ítem vecino desde encima de los
    botones. Se eliminó: sin su propio backdrop-filter (que
    dibujaba un blur/anillo visible, la causa del "doble anillo"),
    un `filter` sin backdrop-filter no tiene nada que desplazar —
    se verificó ocultándolo y comparando capturas, pixel-idénticas
    con y sin él. Un solo elemento con borde visible, no dos.

    MAPA DE LUPA — el filtro #glassLensDistortion (svg/filters.svg)
    necesita un <feImage id="lensMapImage"> con su `href` puesto
    por JS: un mapa de desplazamiento generado por píxel (ver
    js/lens-map.js), no ruido. Se regenera solo cuando cambia el
    ancho de la burbuja (en syncToActive, no por frame) y se
    reintenta aplicar en update() hasta que el <feImage> exista en
    el DOM — svg/filters.svg lo inyecta refraction.js de forma
    asíncrona (fetch), así que puede no estar listo todavía en el
    primer frame.

============================================================*/

/* ============================================================
 * [GLASS ENGINE — CORE] — COPIAR TAL CUAL, NO MODIFICAR
 * Motor genérico, independiente del número de ítems o de los
 * íconos usados (funciona igual con 2 botones que con 5 — ver
 * .theme-toggle). Al portar a otra app, se copia completo, sin
 * cambios de lógica.
 *
 * ÚNICA excepción — BUBBLE_OVERSIZE_X/Y (abajo): son constantes
 * de AJUSTE VISUAL, no de lógica. Si el diseño de la nueva app
 * pide una burbuja más/menos "oversized" respecto al botón, se
 * tocan estos dos números — nada más de este archivo debería
 * necesitar cambios.
 * ============================================================ */

import Utils from "./utils.js";

import Spring from "./spring.js";

import renderer from "./renderer.js";

import GlassMaterial from "./glass.js";

import buildLensDisplacementMap from "./lens-map.js";

// [CONSUMIDOR — únicos números de este archivo pensados para tocar,
// ver GLASS_ENGINE_PORTABILIDAD.md] Subidos de 1.15/1.05: el ítem
// activo ahora aplica un zoom propio (transform:scale(1.15) en
// .menu-item-content, ver index.css) que no cambia la caja del botón
// (solo su contenido visual) — la burbuja necesita margen extra para
// no quedar más chica que el ícono+texto ya agrandado (se veía
// "recortada" arriba del escudo antes de este ajuste).
const BUBBLE_OVERSIZE_X = 1.2;

// Subido de 1.1 — el margen vertical contra "Control de Acceso" (el
// único ítem de 2 líneas) se sentía "justo" contra el borde inferior
// de la burbuja. IMPORTANTE: el alto REAL de la burbuja sale de
// height:calc(var(--menu-height) - var(--menu-padding)*2) en
// menu.css (CORE, fijo, igual para todos los ítems) escalado por
// scaleY = squash * BUBBLE_OVERSIZE_Y en applyTransform() — baseHeight
// (abajo) NO controla el tamaño visual, solo alimenta el cálculo de
// border-radius. Por eso este número (el multiplicador real de
// escala) es el único lugar donde tocar de verdad cambia el aire
// visible, y afecta a TODOS los ítems por igual (no hay forma de
// darle más aire solo al de 2 líneas sin un alto de burbuja por
// ítem, que no existe en este motor) — los de 1 línea quedan con
// más aire también, no menos "bien vistos".
const BUBBLE_OVERSIZE_Y = 1.25;

class GlassMenu {

    constructor(root, options = {}) {

        // TEMP-DEBUG — diagnóstico doble burbuja, quitar después de la prueba
        this._debugBirth = performance.now();
        console.log(`[GlassMenu][${this._debugBirth.toFixed(1)}ms] constructor() — .glass-selector ya en root ANTES de buildSelector:`, root.querySelectorAll(".glass-selector").length, root);

        this.root = root;

        this.items = Array.from(root.querySelectorAll(".menu-item"));

        this.activeIndex = Math.max(

            this.items.findIndex((item) => item.classList.contains("active")),

            0

        );

        this.pointerDown = false;

        // Placeholders seguros (nunca 0, evitan una división por
        // cero) hasta que syncToActive(true) mida el ancho real
        // en el primer requestAnimationFrame.

        this.baseWidth = 1;

        // Igual que baseWidth: se mide una sola vez en syncToActive
        // (la altura de la burbuja es fija, nunca se anima) y se usa
        // en applyTransform() para compensar el border-radius —
        // evita un offsetHeight (layout read síncrono) en cada frame.

        this.baseHeight = 1;

        // Piso de altura real del ítem activo (ícono + texto, con su
        // propio zoom activo ya incluido vía getBoundingClientRect) —
        // se remide en CADA syncToActive (no solo con immediate=true,
        // a diferencia de baseWidth/baseHeight) porque cambia con cada
        // click, no solo al montar o redimensionar. Ver uso en
        // applyTransform().
        this.activeContentHeight = 1;

        // Mismo piso, ahora en X — ver diagnóstico: con viajes largos
        // (de un ítem angosto lejano a "Control de Acceso", el más
        // ancho) los resortes xSpring/widthSpring (independientes,
        // cada uno con su propio stiffness/damping) pueden llegar
        // momentáneamente desincronizados durante el settle (overshoot/
        // undershoot típico de resortes subamortiguados) — medido en
        // vivo: hasta ~10px de recorte de un lado incluso ya cerca del
        // final del recorrido, aunque el ancho total en reposo sobre
        // (no es un problema del multiplicador, es un artefacto
        // transitorio). Ver uso en applyTransform().
        this.activeContentWidth = 1;

        // Ajuste puntual de posición solo para "Control de Acceso" —
        // ver syncToActive() y applyTransform().
        this.activeExtraOffsetX = 0;

        // Mapa de lupa: se regenera solo en syncToActive (cuando
        // cambia el ancho), se aplica en update() reintentando
        // hasta que #lensMapImage exista en el DOM.

        this.lensMapDataUrl = null;

        this.lensMapApplied = false;

        this.buildSelector();

        this.material = new GlassMaterial(this.selector, {

            channel: "menu",

            thickness: "thick",

            proximity: options.proximity ?? 260,

            // Dispersión cromática física: nula en reposo,
            // aparece solo por encima de un umbral de velocidad y
            // dura lo que dura el movimiento — no es una capa de
            // fondo permanente. Ver glass.js.

            chroma: "physical",

            // shine/tint/reflection (el brillo que persigue al
            // cursor) están apagados del todo para esta burbuja
            // por ahora en menu.css — ese seguimiento de cursor
            // llega en una pasada aparte más adelante. Este
            // escalador queda listo para cuando se reactiven: la
            // tarjeta no lo recibe y sigue con su 100% normal.

            lightIntensityScale: 0.45

        });

        this.xSpring = new Spring(0, {

            stiffness: options.stiffness ?? 0.24,

            damping: options.damping ?? 0.76

        });

        this.widthSpring = new Spring(0, {

            stiffness: options.stiffness ?? 0.24,

            damping: options.damping ?? 0.8

        });

        this.bindEvents();

        requestAnimationFrame(() => this.syncToActive(true));

        renderer.add(this);

    }

    /*======================================================
    CONSTRUIR LA BURBUJA — se inserta antes que los items
    para quedar detrás en el eje z
    ======================================================*/

    buildSelector() {

        this.selector = Utils.create("div", "glass-selector");

        this.root.prepend(this.selector);

        // TEMP-DEBUG — diagnóstico doble burbuja, quitar después de la prueba
        console.log(`[GlassMenu][${performance.now().toFixed(1)}ms] buildSelector() — total .glass-selector en root DESPUÉS de prepend:`, this.root.querySelectorAll(".glass-selector").length);

    }

    /*======================================================
    EVENTOS
    ======================================================*/

    bindEvents() {

        this.items.forEach((item, index) => {

            item.addEventListener("click", () => this.select(index));

        });

        /*==================================================
        PRESIÓN DEL TACTO — la burbuja se comprime al bajar
        el dedo/click, sin esperar a que termine de moverse
        (feedback inmediato, tipo gel). El release real no
        ocurre aquí: se decide en update(), que solo suelta
        la presión cuando el puntero ya se levantó Y la
        burbuja terminó de viajar — así se queda "hinchada"
        durante todo el trayecto, no solo en el instante del
        toque.
        ==================================================*/

        this.root.addEventListener("pointerdown", (event) => {

            if (event.target.closest(".menu-item")) {

                this.pointerDown = true;

                this.material.press();

            }

        });

        window.addEventListener("pointerup", () => {

            this.pointerDown = false;

        });

        window.addEventListener("pointercancel", () => {

            this.pointerDown = false;

        });

        window.addEventListener(

            "resize",

            Utils.debounce(() => this.syncToActive(true), 120)

        );

    }

    select(index) {

        if (index === this.activeIndex) {

            return;

        }

        this.items[this.activeIndex]?.classList.remove("active");

        this.activeIndex = index;

        this.items[index].classList.add("active");

        // Refuerza la presión justo al iniciar el viaje, incluso
        // si el cambio de item se disparó sin pointerdown previo
        // (teclado, foco programático) — la burbuja siempre se
        // "hincha" al arrancar el desplazamiento.

        this.material.press();

        this.syncToActive(false);

    }

    /*======================================================
    [FIX/EXTENSIÓN — no estaba en el original] HOVER — mueve la
    burbuja a un ítem SIN cambiar activeIndex ni la clase .active.
    select() (arriba) mezcla dos cosas: "esta es la página actual"
    (clase .active, permisos de texto permanente en el consumidor)
    y "la burbuja va acá" — para que el hover pueda mover la
    burbuja de forma puramente visual, sin tocar cuál página es
    la activa, hacía falta separar ese segundo efecto en un método
    aparte. No reutiliza select() a propósito: activeIndex/.active
    quedan intactos durante todo el hover.
    ======================================================*/

    hoverAt(index) {

        const item = this.items[index];

        if (!item) {

            return;

        }

        const rootRect = this.root.getBoundingClientRect();

        const itemRect = item.getBoundingClientRect();

        this.xSpring.setTarget(itemRect.left - rootRect.left);

        this.widthSpring.setTarget(itemRect.width);

    }

    hoverRelease() {

        this.syncToActive(false);

    }

    /*======================================================
    SINCRONIZAR RESORTES CON EL ITEM ACTIVO
    ======================================================*/

    syncToActive(immediate) {

        const item = this.items[this.activeIndex];

        if (!item) {

            return;

        }

        const rootRect = this.root.getBoundingClientRect();

        const itemRect = item.getBoundingClientRect();

        const x = itemRect.left - rootRect.left;

        const width = itemRect.width;

        this.xSpring.setTarget(x);

        this.widthSpring.setTarget(width);

        // Medido en CADA llamada (no solo immediate=true): un
        // multiplicador global (BUBBLE_OVERSIZE_Y) no puede darle más
        // aire SOLO al ítem de 2 líneas sin sobre-inflar también a los
        // de 1 línea — en vez de eso, applyTransform() usa este valor
        // como PISO real, así la burbuja nunca queda más baja que el
        // contenido que cubre sin importar cuál ítem esté activo.
        const content = item.querySelector(".menu-item-content") || item;

        const contentRect = content.getBoundingClientRect();

        this.activeContentHeight = contentRect.height;

        this.activeContentWidth = contentRect.width;

        // Posición real (no animada) del contenido activo, relativa a
        // .root — el contenido en sí nunca se mueve (solo .glass-
        // selector lo hace), así que esto queda fijo mientras dure el
        // viaje. Se usa en applyTransform() como referencia dura de
        // contención SOLO cerca del final del recorrido (ver
        // "llegando" ahí) — durante el viaje a toda velocidad esta
        // referencia queda lejos a propósito y no debe usarse, o la
        // burbuja "saltaría" hacia el destino en vez de deslizarse.
        this.activeContentLeft = contentRect.left - rootRect.left;

        // [AJUSTE PUNTUAL — solo "Control de Acceso"] Después de varias
        // vueltas ajustando el cálculo general de ancho/centrado sin
        // resultado consistente en la app real, se pidió un parche
        // directo y simple: correr la burbuja unos px a la derecha
        // SOLO sobre este ítem específico, sin tocar el cálculo que
        // afecta a los demás. 6px de prueba inicial — ver
        // applyTransform() para dónde se suma.
        const label = item.textContent.replace(/\s+/g, " ").trim();

        this.activeExtraOffsetX = label === "Control de Acceso" ? 6 : 0;

        if (immediate) {

            this.xSpring.jumpTo(x);

            this.widthSpring.jumpTo(width);

            // Único lugar donde `width` (layout) se escribe — solo
            // al construir o al redimensionar la ventana, nunca
            // durante la animación de cada frame. BUBBLE_OVERSIZE_X
            // entra en la base para que el rango de scaleX que hace
            // falta en applyTransform() se mantenga cercano a 1
            // (mejor precisión de subpíxel).

            this.baseWidth = width * BUBBLE_OVERSIZE_X;

            this.baseHeight = itemRect.height;

            this.selector.style.width = `${this.baseWidth.toFixed(2)}px`;

            this.applyTransform(x, width);

            // [FIX — "marco fantasma" al cargar] .glass-selector nace en
            // opacity:0 (ver menu.css) porque hasta esta línea no tiene
            // un width/transform reales todavía — recién ahora, en el
            // mismo paso donde ya se aplicó el ancho y la posición
            // correctos (arriba), se hace visible. En resize también
            // pasa por acá (immediate=true), pero ahí ya estaba en 1:
            // asignarlo de nuevo es inofensivo (idempotente).
            this.selector.style.opacity = "1";

            // TEMP-DEBUG — diagnóstico doble burbuja, quitar después de la prueba
            console.log(`[GlassMenu][${performance.now().toFixed(1)}ms] syncToActive(immediate=true) — opacity→1, ${(performance.now() - this._debugBirth).toFixed(1)}ms desde el constructor, .glass-selector en root ahora:`, this.root.querySelectorAll(".glass-selector").length);

            // Regenera el mapa de lupa para el nuevo tamaño (no en
            // cada frame — solo aquí, cuando el ancho realmente
            // cambió) y marca que hay que reaplicarlo en update().

            const map = buildLensDisplacementMap(this.baseWidth, itemRect.height);

            this.lensMapDataUrl = map.dataUrl;

            this.lensMapApplied = false;

        }

    }

    /*======================================================
    UPDATE — llamado por renderer en cada frame
    ======================================================*/

    update(deltaMs) {

        const x = this.xSpring.update(deltaMs);

        const width = this.widthSpring.update(deltaMs);

        this.applyTransform(x, width);

        this.syncLensMap();

        // Le pasamos al material cuánto se está moviendo la
        // propia burbuja (no el cursor) — así el borde, el
        // fresnel y la aberración cromática se encienden
        // también durante el viaje entre items, aunque el
        // mouse esté quieto.

        const motion =

            Math.abs(this.xSpring.velocity) +

            Math.abs(this.widthSpring.velocity);

        this.material.setMotion(motion);

        // La lupa "flexiona" más mientras la burbuja viaja y se
        // relaja sola al llegar (isResting) — reutiliza motion,
        // que ya existe para specular/rainbow, no es física nueva.
        // Tope de +20 sobre el scale de reposo. Ese reposo es 110,
        // no 46 — con el margen de filtro ampliado (svg/filters.svg)
        // scale=46 caía al piso de ruido (medido por diff de
        // píxeles: indistinguible de "sin filtro"); 110 es el valor
        // que sí produce una distorsión real y visible a ese margen.

        const lensDisplacement = document.getElementById("glassLensDisplacement");

        if (lensDisplacement) {

            const motionBoost = Math.min(motion * 0.08, 20);

            lensDisplacement.setAttribute("scale", (110 + motionBoost).toFixed(1));

        }

        // Solo se relaja la presión cuando ya no hay dedo/click
        // sosteniendo Y la burbuja terminó de viajar — mientras
        // cualquiera de las dos cosas siga activa, sigue "bajo
        // presión".

        if (!this.pointerDown && this.xSpring.isResting() && this.widthSpring.isResting()) {

            this.material.release();

        }

    }

    /*======================================================
    APLICAR EL MAPA DE LUPA AL <feImage> DEL FILTRO

    svg/filters.svg lo inyecta refraction.js de forma asíncrona
    (fetch), así que #lensMapImage puede no existir todavía en
    los primeros frames — se reintenta cada frame hasta que
    aparece. No regenera el mapa (eso solo pasa en syncToActive),
    solo aplica el que ya esté calculado.
    ======================================================*/

    syncLensMap() {

        if (this.lensMapApplied || !this.lensMapDataUrl) {

            return;

        }

        const image = document.getElementById("lensMapImage");

        if (!image) {

            return;

        }

        image.setAttributeNS(

            "http://www.w3.org/1999/xlink",

            "href",

            this.lensMapDataUrl

        );

        this.lensMapApplied = true;

    }

    /*======================================================
    APLICAR POSICIÓN + ELASTICIDAD VISUAL — SOLO transform

    El estiramiento en X es proporcional a la velocidad
    instantánea del resorte: la burbuja se alarga mientras se
    mueve rápido y recupera su forma al llegar — sensación de
    material líquido, no de bloque rígido deslizando. Encima
    de ese stretch/squash por velocidad se aplica el
    sobretamaño constante (BUBBLE_OVERSIZE_*).

    .selector no cambia su `width` aquí — tiene un ancho FIJO
    (baseWidth, fijado una sola vez en syncToActive). Lo que antes
    se lograba escribiendo `width` cada frame ahora se logra con
    scaleX: se calcula el ancho visual deseado y se convierte en
    una razón contra ese ancho fijo. transform-origin:left (puesto
    en CSS) hace que esa escala crezca hacia la derecha desde el
    propio origen, así que para mantener la burbuja centrada sobre
    el ítem hay que correr translateX la mitad de lo que el ancho
    visual excede al ancho del ítem — ver `tx` abajo.
    ======================================================*/

    applyTransform(x, width) {

        const stretch = Utils.clamp(

            1 + Math.abs(this.xSpring.velocity) * 0.014,

            1,

            1.45

        );

        // Conservación de volumen aproximada: al estirarse en X
        // mientras se mueve rápido, se comprime un poco en Y —
        // así se lee como gel/líquido y no como un bloque rígido
        // que solo cambia de ancho.

        const squash = Utils.clamp(1 - (stretch - 1) * 0.7, 0.8, 1);

        const scaleX = stretch * BUBBLE_OVERSIZE_X;

        let scaleY = squash * BUBBLE_OVERSIZE_Y;

        // PISO real de altura — sin esto, squash puede bajar el
        // multiplicador efectivo hasta 1.0 durante un viaje rápido
        // (squash mínimo 0.8 * BUBBLE_OVERSIZE_Y), momento en el que
        // la burbuja mide exactamente this.selector.offsetHeight (su
        // altura CSS sin sobretamaño) — para "Control de Acceso" (el
        // único ítem de 2 líneas) eso deja casi sin margen contra su
        // contenido real, y en la app real (métricas de fuente algo
        // distintas) alcanza a recortarlo. Subir BUBBLE_OVERSIZE_Y no
        // alcanza porque afecta a TODOS los ítems por igual mientras
        // que squash sigue pudiendo pisarlo hacia abajo; acá se mide
        // el contenido REAL del ítem activo (activeContentHeight, ver
        // syncToActive) y se garantiza que la burbuja nunca renderice
        // más baja que eso + 8px de aire, sin importar stretch/squash.
        const boxHeight = this.selector.offsetHeight;

        if (boxHeight > 0 && this.activeContentHeight > 0) {

            const minScaleY = (this.activeContentHeight + 8) / boxHeight;

            scaleY = Math.max(scaleY, minScaleY);

        }

        let visualWidth = width * scaleX;

        // Piso de ancho real — mismo patrón que la altura, pero esto
        // por sí solo NO alcanza (medido en vivo, ver corrección de
        // centrado más abajo): garantiza que la burbuja nunca sea más
        // angosta que el contenido real + 8px en TOTAL, pero no
        // corrige si ese ancho está mal CENTRADO.
        const minVisualWidth = this.activeContentWidth + 8;

        if (visualWidth < minVisualWidth) {

            visualWidth = minVisualWidth;

        }

        let tx = x + width / 2 - visualWidth / 2;

        // Corrección de contención — la causa real del recorte no es
        // que falte ancho (medido en vivo: BUBBLE_OVERSIZE_X en reposo
        // ya sobra), es que xSpring/widthSpring son DOS resortes
        // independientes (distinto stiffness/damping) que pueden
        // llegar momentáneamente desincronizados cerca del final del
        // recorrido — overshoot/undershoot típico de resortes
        // subamortiguados — y `x + width/2` implica un centro que por
        // un instante no coincide con el centro real del ítem, aunque
        // el ancho total ya sea suficiente. Medido en vivo: hasta
        // ~10px de recorte de un lado incluso ya cerca de asentarse.
        //
        // Solo se corrige cuando la burbuja ya está CERCA del ítem
        // activo espacialmente (su rango [tx, tx+visualWidth] se
        // superpone o casi con [contentLeft, contentRight]) —
        // activeContentLeft es la posición REAL del contenido activo
        // (fija, no animada, ver syncToActive), así que compararla
        // contra la burbuja solo tiene sentido cuando esta ya está en
        // las cercanías. Un umbral de "cerca del target" en px de
        // resorte (ej. |x - xSpring.target| < 30) resultó demasiado
        // ajustado en la práctica — medido en vivo, el recorte seguía
        // apareciendo en frames donde esa distancia todavía superaba
        // el umbral. Comparar SOLAPAMIENTO ESPACIAL directo (con
        // margen) es más robusto: si la burbuja está lejos (mitad del
        // viaje a través de la barra), no se toca y desliza normal;
        // si ya está cerca o superpuesta con el destino, se corrige.
        const contentLeft = this.activeContentLeft;

        const contentRight = this.activeContentLeft + this.activeContentWidth;

        const NEARBY_MARGIN = 60;

        const nearby =
            tx < contentRight + NEARBY_MARGIN &&
            tx + visualWidth > contentLeft - NEARBY_MARGIN;

        if (nearby && this.activeContentWidth > 0) {

            if (tx > contentLeft - 4) {

                tx = contentLeft - 4;

            }

            if (tx + visualWidth < contentRight + 4) {

                tx = contentRight + 4 - visualWidth;

            }

        }

        // [AJUSTE PUNTUAL — solo "Control de Acceso"] Se suma DESPUÉS
        // de la corrección de contención de arriba, no en vez de ella
        // — ver activeExtraOffsetX en syncToActive().
        tx += this.activeExtraOffsetX;

        // cssScaleX/cssScaleY son los factores REALES que el
        // navegador aplica (los mismos que van al `transform` de
        // abajo) — no `scaleX`/`scaleY` tal cual, porque cssScaleX
        // está expresado como razón contra baseWidth (el ancho FIJO
        // de la caja), no contra el ancho del ítem.

        const cssScaleX = visualWidth / this.baseWidth;

        const cssScaleY = scaleY;

        this.selector.style.transform =

            `translateX(${tx.toFixed(2)}px) ` +

            `scaleX(${cssScaleX.toFixed(4)}) ` +

            `scaleY(${cssScaleY.toFixed(3)})`;

        // FIX 1 — border-radius deformado por escala no uniforme.
        // .glass-selector se estira con scaleX != scaleY (para el
        // efecto stretch/squash tipo gel), y un mismo border-radius
        // aplicado ANTES de esa transformación se convierte en una
        // elipse en los extremos en vez de un semicírculo — eso es
        // lo que se percibía como "rectángulo fantasma" durante el
        // movimiento.
        //
        // El radio objetivo es la mitad de la altura REAL renderizada
        // (baseHeight * cssScaleY), no la mitad de baseHeight a secas
        // — usar baseHeight/2 directo (la versión original de este
        // fix) da un círculo válido pero de radio más chico que la
        // mitad de la altura real cada vez que BUBBLE_OVERSIZE_Y > 1,
        // así que los extremos quedaban más "rounded-rect" que
        // "pastilla" (no se notaba con BUBBLE_OVERSIZE_Y=1.62 porque
        // el error se disimulaba en una burbuja ya grande, pero con
        // valores cercanos a 1 hay que apuntar al valor exacto).
        // Se despeja el radio PRE-transform necesario en cada eje
        // para que, multiplicado de vuelta por su propio factor de
        // escala (la transformación), dé ese mismo objetivo en
        // ambos ejes — círculo perfecto, del tamaño correcto.

        const renderedHeight = this.baseHeight * cssScaleY;

        const targetRadius = renderedHeight / 2;

        const compensatedRadiusX = targetRadius / cssScaleX;

        const compensatedRadiusY = targetRadius / cssScaleY;

        this.selector.style.borderRadius =

            `${compensatedRadiusX.toFixed(2)}px / ${compensatedRadiusY.toFixed(2)}px`;

    }

    /*======================================================
    DESTROY
    ======================================================*/

    destroy() {

        // TEMP-DEBUG — diagnóstico doble burbuja, quitar después de la prueba
        console.log(`[GlassMenu][${performance.now().toFixed(1)}ms] destroy() llamado — .glass-selector en root ANTES de remove:`, this.root.querySelectorAll(".glass-selector").length);

        renderer.remove(this);

        this.material.destroy();

        // [FIX — no estaba en el original] buildSelector() crea
        // this.selector y lo prepend-ea al root; GlassMaterial.destroy()
        // (glass.js) sí remueve el nodo que ELLA crea (this.material),
        // pero acá nunca se removía el propio this.selector — quedaba
        // huérfano en el DOM. Invisible en el demo vanilla original
        // (una sola instancia, nunca se destruye en su ciclo de vida),
        // pero React StrictMode monta→desmonta→vuelve a montar cada
        // componente una vez en dev: sin este remove(), la segunda
        // instancia agregaba una SEGUNDA burbuja superpuesta a la
        // primera (nunca destruida) — el "eco"/borde duplicado que se
        // veía en el ítem activo del menú no era un problema de lente/
        // refracción, era literalmente dos burbujas independientes en
        // el mismo lugar.
        this.selector.remove();

        // TEMP-DEBUG — diagnóstico doble burbuja, quitar después de la prueba
        console.log(`[GlassMenu][${performance.now().toFixed(1)}ms] destroy() — .glass-selector en root DESPUÉS de remove:`, this.root.querySelectorAll(".glass-selector").length);

    }

}

export default GlassMenu;
