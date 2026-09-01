/*============================================================

    GLASS ENGINE
    PHYSICS.JS

    Composición de dos resortes (Spring) en un valor 2D,
    y lectura de la configuración de física por defecto
    desde las variables CSS (--spring-*) para que el motor
    y las hojas de estilo compartan una sola fuente de verdad.

============================================================*/

/* ============================================================
 * [GLASS ENGINE — CORE] — COPIAR TAL CUAL, NO MODIFICAR
 * Motor genérico, independiente del número de ítems o de los
 * íconos usados. Al portar a otra app, se copia completo, sin
 * cambios de lógica.
 * ============================================================ */

import Spring from "./spring.js";

/*============================================================

    CONFIGURACIÓN POR DEFECTO — LEÍDA DE variables.css

============================================================*/

class PhysicsConfig {

    static cached = null;

    static read() {

        if (PhysicsConfig.cached) {

            return PhysicsConfig.cached;

        }

        const style = getComputedStyle(document.documentElement);

        const numberOf = (name, fallback) => {

            const raw = style.getPropertyValue(name).trim();

            const value = parseFloat(raw);

            return Number.isFinite(value) ? value : fallback;

        };

        PhysicsConfig.cached = {

            stiffness: numberOf("--spring-stiffness", 0.16),

            damping: numberOf("--spring-damping", 0.78),

            mass: numberOf("--spring-mass", 1),

            precision: numberOf("--spring-precision", 0.001)

        };

        return PhysicsConfig.cached;

    }

}

/*============================================================

    SPRING VECTOR 2 — un par de Spring (x, y)

============================================================*/

class SpringVector2 {

    constructor(x = 0, y = 0, config = {}) {

        const defaults = PhysicsConfig.read();

        const merged = { ...defaults, ...config };

        this.x = new Spring(x, merged);

        this.y = new Spring(y, merged);

    }

    setTarget(x, y) {

        this.x.setTarget(x);

        this.y.setTarget(y);

        return this;

    }

    jumpTo(x, y) {

        this.x.jumpTo(x);

        this.y.jumpTo(y);

        return this;

    }

    update(deltaMs) {

        return {

            x: this.x.update(deltaMs),

            y: this.y.update(deltaMs)

        };

    }

    isResting() {

        return this.x.isResting() && this.y.isResting();

    }

}

export default SpringVector2;

export { PhysicsConfig };
