/*============================================================

GLASS ENGINE
RENDERER.JS

Single Render Loop

============================================================*/

/* ============================================================
 * [GLASS ENGINE — CORE] — COPIAR TAL CUAL, NO MODIFICAR
 * Motor genérico, independiente del número de ítems o de los
 * íconos usados. Al portar a otra app, se copia completo, sin
 * cambios de lógica.
 * ============================================================ */

class Renderer {

    constructor() {

        this.modules = [];

        this.running = false;

        this.lastTime = performance.now();

        this.delta = 0;

        this.time = 0;

        this.fps = 0;

        this.frame = 0;

        this.maxDelta = 32;

        this.boundLoop = this.loop.bind(this);

    }

    /*==========================================================
    ADD MODULE
    ==========================================================*/

    add(module) {

        if (!module) return;

        if (this.modules.includes(module)) return;

        this.modules.push(module);

        if (!this.running) this.start();

    }

    /*==========================================================
    REMOVE MODULE
    ==========================================================*/

    remove(module) {

        this.modules = this.modules.filter(

            m => m !== module

        );

    }

    /*==========================================================
    START
    ==========================================================*/

    start() {

        if (this.running) return;

        this.running = true;

        this.lastTime = performance.now();

        requestAnimationFrame(this.boundLoop);

    }

    /*==========================================================
    STOP
    ==========================================================*/

    stop() {

        this.running = false;

    }

    /*==========================================================
    LOOP
    ==========================================================*/

    loop(now) {

        if (!this.running) return;

        let delta = now - this.lastTime;

        if (delta > this.maxDelta)

            delta = this.maxDelta;

        this.delta = delta / 16.666;

        this.time = now;

        this.fps = Math.round(

            1000 / Math.max(delta, 0.0001)

        );

        this.frame++;

        this.lastTime = now;

        for (const module of this.modules) {

            if (

                module &&

                typeof module.update === "function"

            ) {

                // Los módulos (Spring, GlassMaterial, GlassMenu,
                // GlassCard, Cursor...) esperan milisegundos reales
                // transcurridos, no el "frames equivalentes" que usa
                // this.delta internamente para fps/getInfo() — cada
                // Spring ya hace su propia normalización a 60fps.

                module.update(

                    delta,

                    now

                );

            }

        }

        requestAnimationFrame(

            this.boundLoop

        );

    }

    /*==========================================================
    CLEAR
    ==========================================================*/

    clear() {

        this.modules.length = 0;

    }

    /*==========================================================
    INFO
    ==========================================================*/

    getInfo() {

        return {

            fps: this.fps,

            delta: this.delta,

            frame: this.frame,

            modules: this.modules.length,

            time: this.time

        };

    }

}

const renderer = new Renderer();

export default renderer;