# Diagnóstico — efectivo sugerido al cerrar caja (pendiente de tu decisión)

> **No se cambió nada de esta lógica.** Solo se tocó el **diseño** del modal de cierre (tamaño y posición, ver el final).
> Esto es un diagnóstico y 2 opciones para que decidas tú, porque afecta a dinero.

## 1. Qué hace hoy

`src/pages/admin/Caja.jsx` → `ModalCerrarCaja`:

```js
const [montoCierre, setMontoCierre] = useState(
  prefill?.monto_cierre != null ? String(prefill.monto_cierre) : efectivoEsperado.toFixed(2))
...
monto_cierre: parseFloat(montoCierre) || 0,
```

- El campo **«Efectivo contado»** abre **ya rellenado con el efectivo esperado** (en la prueba: `100,00` con apertura de Bs. 100).
- Con el campo así, el bloque «Resultado» muestra **«✓ Cuadra»** y el resumen dice «La caja cuadra perfectamente» **sin que nadie haya contado nada**.
- Se puede cerrar el turno con **3 clics y 0 teclas** (medido en `AUDITORIA_UIUX.md`, tarea «cerrar caja»: 1,3 s).
- Si la persona **borra** el campo y cierra, `parseFloat('') || 0` registra un conteo de **Bs. 0** (faltante por todo el efectivo) sin ninguna advertencia.

## 2. Por qué importa

El arqueo existe para **comparar lo contado con lo esperado**. Si lo contado viene pre-llenado con lo esperado, el control
solo detecta diferencias cuando la persona se acuerda de corregirlo; lo cómodo (pulsar «Cerrar») siempre da «cuadra».
Un faltante real queda oculto y el sistema lo registra como si no hubiera pasado.

## 3. Opciones

### Opción A — Campo vacío y obligatorio
- El campo abre **vacío** (con la pista «Cuenta el efectivo y escribe el total»).
- «Cerrar Turno e Imprimir Corte» queda **desactivado** hasta que haya un número válido (≥ 0; el 0 vale si se escribe a propósito).
- El bloque «Resultado» y el aviso «cuadra» aparecen **solo después** de escribir el conteo.
- Corrige también el caso `|| 0`: un campo vacío ya no se puede enviar.
- Voz: «cierra la caja, conté 850» sigue rellenando el campo (cuenta como conteo explícito); la persona igualmente confirma.
- **Costo:** ≈ +5 teclas por cierre (3 clics + ~5 teclas, en lugar de 3 clics + 0).
- **Ventaja:** el conteo es un acto real; es el control más fuerte.

### Opción B — Mantener la sugerencia, pero con confirmación explícita
- El campo sigue abriendo con el esperado, pero el cierre exige marcar **«Conté el efectivo y coincide con lo esperado»** mientras el valor no se haya tocado.
- Si la persona edita el número, no hace falta marcar nada.
- También bloquea el campo vacío.
- **Costo:** +1 clic solo cuando coincide (4 clics, 0 teclas).
- **Ventaja:** casi igual de rápido; deja constancia de que se afirmó haber contado.
- **Límite:** se puede marcar por costumbre sin contar; el control es más débil que la Opción A.

## 4. Recomendación

**Opción A** si lo prioritario es controlar faltantes; **Opción B** si pesa más la velocidad del cierre y confías en el hábito del equipo.
En ambos casos conviene guardar en el registro si el conteo fue **escrito** o **sugerido sin tocar** (no se hizo; sería otro cambio de dinero).

## 5. Lo que sí se cambió (solo diseño, sin lógica)

- Tarjeta del modal: alto máximo `min(82vh, 660px)` (antes casi toda la ventana: ~92 vh), centrada con ≥ 72 px de margen arriba y abajo.
- El contenido se desplaza **dentro** de la tarjeta; los botones «Cancelar» y «Cerrar Turno e Imprimir Corte» quedan **fijos abajo, siempre visibles**, separados por una línea y a 24 px del borde (antes iban al final de un contenido largo, pegados al borde de la ventana).
- Texto del botón principal a 14 px para que quepa en una línea.
- Medido en la ventana real (1280×800): tarjeta 480×656 en (400, 72); botones a 24 px del borde inferior de la tarjeta.
