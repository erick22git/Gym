/*============================================================

    GLASS ENGINE
    UTILS.JS

    Funciones puras compartidas por todo el motor.
    Sin estado, sin dependencias de otros módulos.

============================================================*/

/* ============================================================
 * [GLASS ENGINE — CORE] — COPIAR TAL CUAL, NO MODIFICAR
 * Motor genérico, independiente del número de ítems o de los
 * íconos usados. Al portar a otra app, se copia completo, sin
 * cambios de lógica.
 * ============================================================ */

class Utils {

    /*======================================================
    DOM — CREAR ELEMENTO
    ======================================================*/

    static create(tag, className) {

        const el = document.createElement(tag);

        if (className) {

            el.className = className;

        }

        return el;

    }

    /*======================================================
    MATEMÁTICA — CLAMP
    ======================================================*/

    static clamp(value, min, max) {

        return Math.min(Math.max(value, min), max);

    }

    /*======================================================
    MATEMÁTICA — INTERPOLACIÓN LINEAL
    ======================================================*/

    static lerp(start, end, t) {

        return start + (end - start) * t;

    }

    /*======================================================
    MATEMÁTICA — MAPEAR RANGO
    ======================================================*/

    static mapRange(value, inMin, inMax, outMin, outMax, shouldClamp = true) {

        const t = (value - inMin) / (inMax - inMin);

        const result = outMin + t * (outMax - outMin);

        if (!shouldClamp) {

            return result;

        }

        const low = Math.min(outMin, outMax);

        const high = Math.max(outMin, outMax);

        return Utils.clamp(result, low, high);

    }

    /*======================================================
    MATEMÁTICA — DISTANCIA ENTRE DOS PUNTOS
    ======================================================*/

    static distance(x1, y1, x2, y2) {

        const dx = x2 - x1;

        const dy = y2 - y1;

        return Math.sqrt(dx * dx + dy * dy);

    }

    /*======================================================
    MATEMÁTICA — ÁNGULO ENTRE DOS PUNTOS (grados)
    ======================================================*/

    static angle(x1, y1, x2, y2) {

        return Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

    }

    /*======================================================
    MATEMÁTICA — REDONDEO A N DECIMALES
    ======================================================*/

    static round(value, decimals = 3) {

        const factor = 10 ** decimals;

        return Math.round(value * factor) / factor;

    }

    /*======================================================
    RENDIMIENTO — DEBOUNCE
    ======================================================*/

    static debounce(fn, wait = 150) {

        let timeout = null;

        return (...args) => {

            clearTimeout(timeout);

            timeout = setTimeout(() => fn(...args), wait);

        };

    }

    /*======================================================
    ACCESIBILIDAD — PREFERS REDUCED MOTION
    ======================================================*/

    static prefersReducedMotion() {

        return window.matchMedia(

            "(prefers-reduced-motion: reduce)"

        ).matches;

    }

}

/*============================================================

    VECTOR 2D

    Estructura ligera usada por el motor de física y el
    cursor para representar posición, velocidad y aceleración.

============================================================*/

class Vector2 {

    constructor(x = 0, y = 0) {

        this.x = x;

        this.y = y;

    }

    set(x, y) {

        this.x = x;

        this.y = y;

        return this;

    }

    copy(vector) {

        this.x = vector.x;

        this.y = vector.y;

        return this;

    }

    get length() {

        return Math.sqrt(this.x * this.x + this.y * this.y);

    }

}

export default Utils;

export { Vector2 };
