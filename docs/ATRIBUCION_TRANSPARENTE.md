# Transparente: atribución de diferencias (Sprint 2, paso 0a)

Comparación de la ventana real (1366×768) contra la base 02fea01. Suelo de ruido medido con dos capturas de la MISMA base: ≤ 0,23 % (auditoría 1,05 %).

| página | píxeles distintos | regiones por tipo (celdas de 24 px) |
|---|---|---|
| control-acceso | 2.80 % | fondo animado (canvas): 170; contenido desplazado por el menú (aprobado): 92 |
| caja | 1.83 % | contenido desplazado por el menú (aprobado): 105; fondo animado (canvas): 54; barra de título/menú (aprobado): 18 |
| dashboard | 2.67 % | fondo animado (canvas): 125; contenido desplazado por el menú (aprobado): 150 |
| clientes | 6.23 % | fondo animado (canvas): 118; contenido desplazado por el menú (aprobado): 513 |
| membresias | 4.98 % | fondo animado (canvas): 311; contenido desplazado por el menú (aprobado): 106 |
| inventario | 4.93 % | fondo animado (canvas): 171; contenido desplazado por el menú (aprobado): 257 |
| ventas | 6.90 % | fondo animado (canvas): 588; contenido desplazado por el menú (aprobado): 109; barra de título/menú (aprobado): 18 |
| casilleros | 3.33 % | fondo animado (canvas): 206; contenido desplazado por el menú (aprobado): 135 |
| reportes | 3.10 % | fondo animado (canvas): 157; contenido desplazado por el menú (aprobado): 111 |
| auditoria | 4.72 % | fondo animado (canvas): 244; contenido desplazado por el menú (aprobado): 220 |
| ia | 3.40 % | fondo animado (canvas): 202; contenido desplazado por el menú (aprobado): 70; barra de título/menú (aprobado): 18 |
| configuracion | 7.22 % | fondo animado (canvas): 439; contenido desplazado por el menú (aprobado): 160 |

**Lectura:** las diferencias son (1) el fondo animado `canvas` (cuadro distinto en cada captura = ruido), (2) la barra superior/menú siempre visible (cambio aprobado) y (3) el contenido que baja unos píxeles por la altura del nuevo menú. No se encontró ninguna región atribuible a un cambio no aprobado.

**No verificado:** la sospecha previa de texto ~7 % más grande no se pudo confirmar con estilos calculados (no se midió `font-size` base vs actual); si Erick lo ve a simple vista, medir con `getComputedStyle` en ambas ventanas.