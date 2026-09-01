/*============================================================

    GLASS ENGINE
    CARD.JS

    GlassCard — tarjeta de vidrio con inclinación 3D.

    Reacciona al cursor con un tilt sutil (rotateX/rotateY)
    hacia el punto donde está el puntero, un ligero
    acercamiento a cámara (translateZ) y un parallax del
    contenido interior — todo animado con resortes, todo
    apagándose suavemente cuando el cursor se aleja.

    El material óptico (blur, highlight, fresnel, reflejo
    especular, refracción) es el mismo GlassMaterial que usa
    el menú, con canal "card". GlassCard reutiliza el rect y
    la intensidad de proximidad que GlassMaterial ya calcula
    cada frame, en vez de volver a medir el DOM.

============================================================*/

/* ============================================================
 * [GLASS ENGINE — CORE] — COPIAR TAL CUAL, NO MODIFICAR
 * Motor genérico, independiente del contenido que envuelva. Al
 * portar a otra app, se copia completo, sin cambios de lógica
 * — el contenido HTML de la tarjeta (texto, título) es lo único
 * que varía, y eso vive fuera de este archivo (ver
 * GLASS_ENGINE_PORTABILIDAD.md).
 * ============================================================ */

import Utils from "./utils.js";

import Spring from "./spring.js";

import SpringVector2 from "./physics.js";

import renderer from "./renderer.js";

import cursor from "./cursor.js";

import GlassMaterial from "./glass.js";

const ROOT_TILT_STRENGTH = "--rotation-strength";

const ROOT_PARALLAX_STRENGTH = "--parallax-strength";

class GlassCard {

    constructor(root, options = {}) {

        this.root = root;

        this.material = new GlassMaterial(root, {

            channel: "card",

            thickness: options.thickness ?? "thick",

            proximity: options.proximity ?? 280,

            // "que no alumbre tanto": glow = intensity * lightIntensityScale
            // alimenta --border-intensity (glow exterior de .glass-root +
            // aro de .glass-layer--specular, glass.css) — bajar esto a la
            // mitad baja el PICO de ambos proporcionalmente, sin tocar la
            // fórmula compartida en glass.js (que seguiría afectando al
            // menú si se tocara ahí). El menú ya tiene su propio
            // lightIntensityScale:0.45 independiente — esto no lo toca.

            lightIntensityScale: options.lightIntensityScale ?? 0.5

        });

        this.content = this.material.content;

        this.maxTilt = options.maxTilt ?? this.readRootVariable(ROOT_TILT_STRENGTH, 5);

        this.parallax = options.parallax ?? this.readRootVariable(ROOT_PARALLAX_STRENGTH, 16);

        this.rotation = new SpringVector2(0, 0, {

            stiffness: options.stiffness ?? 0.14,

            damping: options.damping ?? 0.82

        });

        this.lift = new Spring(0, { stiffness: 0.16, damping: 0.8 });

        this.parallaxSpring = new SpringVector2(0, 0, {

            stiffness: 0.14,

            damping: 0.82

        });

        renderer.add(this);

    }

    /*======================================================
    LEER UN TOKEN NUMÉRICO DE variables.css
    ======================================================*/

    readRootVariable(name, fallback) {

        const raw = getComputedStyle(document.documentElement)

            .getPropertyValue(name)

            .trim();

        const value = parseFloat(raw);

        return Number.isFinite(value) ? value : fallback;

    }

    /*======================================================
    UPDATE — llamado por renderer en cada frame

    GlassMaterial (this.material) ya se registró antes que
    esta instancia, así que su update() de este mismo frame
    ya corrió: this.material.rect y this.material.intensity
    están frescos y se reutilizan aquí sin volver a medir.
    ======================================================*/

    update(deltaMs) {

        const rect = this.material.rect;

        const proximity = this.material.intensity.current;

        const local = cursor.localPosition(rect);

        const tiltX = Utils.mapRange(local.y, 0, 1, this.maxTilt, -this.maxTilt, true);

        const tiltY = Utils.mapRange(local.x, 0, 1, -this.maxTilt, this.maxTilt, true);

        this.rotation.setTarget(tiltX * proximity, tiltY * proximity);

        const rotation = this.rotation.update(deltaMs);

        this.lift.setTarget(proximity);

        const lift = this.lift.update(deltaMs);

        const parallaxX = Utils.mapRange(local.x, 0, 1, -this.parallax, this.parallax, true);

        const parallaxY = Utils.mapRange(local.y, 0, 1, -this.parallax, this.parallax, true);

        this.parallaxSpring.setTarget(parallaxX * proximity, parallaxY * proximity);

        const parallax = this.parallaxSpring.update(deltaMs);

        this.applyTransform(rotation, lift, parallax);

    }

    /*======================================================
    APLICAR TRANSFORMS
    ======================================================*/

    applyTransform(rotation, lift, parallax) {

        // "que no se mueva": el acercamiento de cámara (translateZ)
        // se apaga — multiplicador en 0. El tilt (rotateX/rotateY)
        // es ahora el ÚNICO movimiento que queda en la tarjeta.

        this.root.style.transform =

            `perspective(1000px) ` +

            `rotateX(${rotation.x.toFixed(2)}deg) ` +

            `rotateY(${rotation.y.toFixed(2)}deg) ` +

            `translateZ(${(lift * 0).toFixed(2)}px)`;

        if (this.content) {

            this.content.style.transform =

                `translate(${parallax.x.toFixed(2)}px, ${parallax.y.toFixed(2)}px)`;

        }

    }

    /*======================================================
    DESTROY
    ======================================================*/

    destroy() {

        renderer.remove(this);

        this.material.destroy();

    }

}

export default GlassCard;
