/*============================================================

GLASS ENGINE
CURSOR.JS

============================================================*/

/* ============================================================
 * [GLASS ENGINE — CORE] — COPIAR TAL CUAL, NO MODIFICAR
 * Motor genérico, independiente del número de ítems o de los
 * íconos usados. Al portar a otra app, se copia completo, sin
 * cambios de lógica.
 * ============================================================ */

import renderer from "./renderer.js";
import SpringVector2 from "./physics.js";
import Utils from "./utils.js";

class Cursor {

    constructor() {

        this.position = {
            x: window.innerWidth * 0.5,
            y: window.innerHeight * 0.5
        };

        this.previous = {
            x: this.position.x,
            y: this.position.y
        };

        this.velocity = {
            x: 0,
            y: 0,
            speed: 0
        };

        this.direction = {
            x: 0,
            y: 0
        };

        this.normalized = {
            x: 0.5,
            y: 0.5
        };

        this.spring = new SpringVector2(

            this.position.x,

            this.position.y,

            {

                stiffness:0.16,

                damping:0.80

            }

        );

        this.bind();

    }

    /*==========================================================
    EVENTS
    ==========================================================*/

    bind() {

        window.addEventListener(

            "pointermove",

            this.onMove.bind(this),

            { passive:true }

        );

        window.addEventListener(

            "resize",

            this.onResize.bind(this)

        );

    }

    /*==========================================================
    MOVE
    ==========================================================*/

    onMove(event) {

        this.position.x = event.clientX;

        this.position.y = event.clientY;

        this.spring.setTarget(

            this.position.x,

            this.position.y

        );

    }

    /*==========================================================
    RESIZE
    ==========================================================*/

    onResize(){

        this.normalized.x =

            this.position.x / window.innerWidth;

        this.normalized.y =

            this.position.y / window.innerHeight;

    }

    /*==========================================================
    UPDATE
    ==========================================================*/

    update(delta){

        const { x, y } = this.spring.update(delta);

        this.velocity.x =

            x - this.previous.x;

        this.velocity.y =

            y - this.previous.y;

        this.velocity.speed =

            Math.hypot(

                this.velocity.x,

                this.velocity.y

            );

        if(this.velocity.speed > 0.0001){

            this.direction.x =

                this.velocity.x /

                this.velocity.speed;

            this.direction.y =

                this.velocity.y /

                this.velocity.speed;

        }

        this.previous.x = x;

        this.previous.y = y;

        this.normalized.x =

            x / window.innerWidth;

        this.normalized.y =

            y / window.innerHeight;

    }

    /*==========================================================
    GETTERS
    ==========================================================*/

    get x(){

        return this.spring.x.current;

    }

    get y(){

        return this.spring.y.current;

    }

    get speed(){

        return this.velocity.speed;

    }

    /*==========================================================
    POSICIÓN LOCAL — 0..1 dentro de un rect dado (getBoundingClientRect)
    Usada por componentes que necesitan "dónde, dentro de mí,
    está el cursor" sin volver a leer window.innerWidth/Height.
    ==========================================================*/

    localPosition(rect){

        const x = rect.width > 0

            ? (this.x - rect.left) / rect.width

            : 0.5;

        const y = rect.height > 0

            ? (this.y - rect.top) / rect.height

            : 0.5;

        return {

            x: Utils.clamp(x, 0, 1),

            y: Utils.clamp(y, 0, 1)

        };

    }

    get data(){

        return{

            x:this.x,

            y:this.y,

            nx:this.normalized.x,

            ny:this.normalized.y,

            vx:this.velocity.x,

            vy:this.velocity.y,

            speed:this.velocity.speed,

            dx:this.direction.x,

            dy:this.direction.y

        };

    }

}

const cursor = new Cursor();

renderer.add(cursor);

export default cursor;