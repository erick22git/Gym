# Informe de contraste (WCAG AA) — apariencias Lusion

> Medido automáticamente en la ventana real (Electron, 1280×800) con un script que recorre **todo nodo de texto visible**
> de la página de IA, sus modales y paneles, la mascota y el visor de recorridos, y compara su color contra el **fondo opaco
> real** que tiene detrás (sube por los ancestros hasta el primer fondo sólido). Umbral: 4,5:1 (3:1 para texto ≥ 24 px); los
> controles desactivados están exentos (WCAG 1.4.3). Los pares de *tokens* están en DISENO.md §6
> (`node scripts/pruebas/contraste-tokens.cjs`).

## Lusion Oscuro

| Estado de pantalla | Textos revisados | Fallos |
|---|---:|---:|
| ia con conversacion | 12 | 0 |
| ia resultado importacion | 54 | 0 |
| modal confirmar escritura | 59 | 0 |
| panel historial | 54 | 0 |
| panel actividad | 54 | 0 |
| mascota con tarjeta | 25 | 0 |

## Lusion Claro

| Estado de pantalla | Textos revisados | Fallos |
|---|---:|---:|
| ia con conversacion | 12 | 0 |
| ia resultado importacion | 54 | 0 |
| modal confirmar escritura | 59 | 0 |
| panel historial | 54 | 0 |
| panel actividad | 54 | 0 |
| mascota con tarjeta | 25 | 0 |

**Total: 516 textos revisados, 0 fallos.**

## Hallazgos corregidos durante la medición

1. **Botón principal ilegible tras hacer clic** (blanco sobre blanco en Claro, negro sobre Graphite en Oscuro): el CSS de las
   páginas (`Clients.css`) pone el botón principal en transparente al enfocarlo o pulsarlo, con `!important`. En Lusion el
   relleno del botón principal no cambia nunca (hover / foco / activo), así que se repitió la regla con esos estados. Lo detectó la
   propia verificación (contraste medido 1,0:1 y 1,55:1) y después de corregirlo dio 0 fallos.
2. **Telón de los modales** pasó a ser **opaco** (el lienzo del tema) y el panel lateral de historial recibió la superficie del
   tema; antes quedaban grises translúcidos.
3. **Estado verde / rojo / ámbar:** como texto o icono varios pares no llegan a AA (DISENO.md §6); se usan solo como relleno de
   una chapa con texto Paper White o Ink.

## Límites

- Solo se miden nodos de texto y marcadores de posición; no imágenes ni iconos sueltos (los iconos heredan el color de texto del tema).
- Se midieron los estados listados; no todos los modales posibles (p. ej. el visor de imágenes ampliadas).
- No se midió «Transparente» (diseño existente, sin cambios; su contraste depende de la foto de fondo).
