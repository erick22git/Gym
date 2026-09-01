/*============================================================

    GLASS ENGINE
    SPRING.JS

    Motor de física de resorte para un único valor escalar.

    No es un "lerp" — es una simulación real con masa,
    rigidez, amortiguación y detección de reposo. El
    movimiento puede sobrepasar el objetivo (overshoot) y
    volver, igual que un material físico real.

    El paso de integración se normaliza a "frames de 60fps"
    (deltaFrames) para que stiffness/damping se comporten
    igual sin importar el refresh rate de la pantalla.

============================================================*/

/* ============================================================
 * [GLASS ENGINE — CORE] — COPIAR TAL CUAL, NO MODIFICAR
 * Motor genérico, independiente del número de ítems o de los
 * íconos usados. Al portar a otra app, se copia completo, sin
 * cambios de lógica.
 * ============================================================ */

import Utils from "./utils.js";

const BASE_FRAME_MS = 1000 / 60;

const MAX_DELTA_FRAMES = 3;

class Spring {

    constructor(value = 0, config = {}) {

        this.mass = config.mass ?? 1;

        this.stiffness = config.stiffness ?? 0.16;

        this.damping = config.damping ?? 0.78;

        this.precision = config.precision ?? 0.001;

        this.current = value;

        this.target = value;

        this.velocity = 0;

        this.resting = true;

    }

    /*======================================================
    OBJETIVO
    ======================================================*/

    setTarget(value) {

        if (value !== this.target) {

            this.target = value;

            this.resting = false;

        }

        return this;

    }

    /*======================================================
    SALTAR SIN ANIMAR
    ======================================================*/

    jumpTo(value) {

        this.current = value;

        this.target = value;

        this.velocity = 0;

        this.resting = true;

        return this;

    }

    /*======================================================
    ACTUALIZAR — un paso de integración
    ======================================================*/

    update(deltaMs) {

        if (this.resting) {

            return this.current;

        }

        const deltaFrames = Utils.clamp(

            deltaMs / BASE_FRAME_MS,

            0,

            MAX_DELTA_FRAMES

        );

        const displacement = this.target - this.current;

        const force = (displacement * this.stiffness) / this.mass;

        this.velocity += force * deltaFrames;

        this.velocity *= Math.pow(this.damping, deltaFrames);

        this.current += this.velocity * deltaFrames;

        this.checkRest(displacement);

        return this.current;

    }

    /*======================================================
    DETECCIÓN DE REPOSO
    ======================================================*/

    checkRest(displacement) {

        const isSlow = Math.abs(this.velocity) < this.precision;

        const isClose = Math.abs(displacement) < this.precision;

        if (isSlow && isClose) {

            this.current = this.target;

            this.velocity = 0;

            this.resting = true;

        }

    }

    /*======================================================
    ESTADO
    ======================================================*/

    isResting() {

        return this.resting;

    }

}

export default Spring;
