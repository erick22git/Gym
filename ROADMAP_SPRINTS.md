# Hoja de ruta por sprints

Reglas que valen siempre: la app se instala y funciona **100 % sin internet**; no se baja la calidad de ningún modelo sin preguntar;
**no se genera el instalador `.exe`** hasta que se pida; todo cambio de UX en Ventas/Caja (dinero) se aprueba antes; la interfaz va en español.

## Sprint 1 — Diseño, apariencias y accesibilidad (rama `feat/fase3-diseno`, sin merge a `main`)

Hecho y con prueba automática (`npm run test:ui`, `node scripts/pruebas/caja-cierre.cjs`, `node scripts/pruebas/transparente-identico.mjs`):

- Cierre de caja: efectivo esperado solo en efectivo, diferencia guardada, entrada `CIERRE_CAJA` en Auditoría, confirmación explícita (opción B).
- Tipografía única en las tres apariencias.
- Apariencias **Transparente / Oscuro / Claro** para toda la app (también el login), guardadas a nivel de dispositivo; comandos directos del chat.
- Accesibilidad: tamaño de interfaz 100–200 %, alto contraste, nombres accesibles, modales con foco, registro `aria-live` del chat, movimiento reducido.
- Menú de iconos siempre visible con barra de desplazamiento.
- Efecto «goo» solo en Oscuro/Claro (mascota, Enviar, Aprobar, selector de apariencia).
- Cierre de red del programa empaquetado (`C:\GymApp`, prueba de PC limpia con trampa de proxy y monitor de conexiones).

Lo que NO se pudo comprobar de forma automática (queda para revisión humana):
- Lector de pantalla real (Narrador de Windows): solo se verificaron nombres, roles, estados y orden de foco.
- Atajo Ctrl+= en teclado en español (con Ctrl++ del teclado numérico sí).
- Nueva venta completa solo con teclado.
- Diálogo nativo «Elegir foto» del fondo propio.
- Asistente en ventanas menores de 1100 px.

## Sprint 2 — propuesta (por confirmar)

1. Revisión humana con lector de pantalla real y teclado en español de lo anterior.
2. Pagos y cobros: ajustes de UX de Ventas/Caja (requieren aprobación previa antes de tocar nada).
3. Rendimiento de Inventario con listas grandes (virtualización; hoy 26–38 fps al desplazar en esta PC).
4. Si se decide: generar el instalador y probar fuses, integridad del asar y actualización.
