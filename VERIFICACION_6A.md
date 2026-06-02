# VERIFICACIÓN FASE 6A — Estado Real del Código

**Fecha de revisión:** 2026-05-22  
**Revisión:** código real, archivo por archivo

---

## APERTURA AUTOMÁTICA DE CAJA

| Item | Estado | Detalle |
|------|--------|---------|
| Al vender sin caja abierta, aparece modal de apertura | ❌ | Ambos flujos (Wizard + Carrito) simplemente pasan `sesion_caja_id: null` silenciosamente |
| El modal pide monto inicial y observaciones | ❌ | No existe — se arregla en esta revisión |
| Muestra cajero actual automáticamente | ❌ | No existe — se arregla en esta revisión |
| Tras abrir caja, CONTINÚA con la venta | ❌ | No existe — se arregla en esta revisión |
| Si ya hay caja abierta, no vuelve a preguntar | ✅ | Se consulta `getSesionActual()` antes de pagar |
| Caja vinculada al usuario que la abrió | ✅ | `usuario_id` y `usuario_nombre` se pasan al abrir |

---

## INTEGRACIÓN VENTA → CAJA

| Item | Estado | Detalle |
|------|--------|---------|
| Venta de membresía crea movimiento en caja | ✅ | `procesarPagoMembresia` inserta en `caja_movimientos` si hay `sesion_caja_id` |
| Venta de producto crea movimiento en caja | ✅ | `venderProductos` ya usaba `meta.sesion_id` |
| Solo efectivo afecta conteo físico | ❌ | `saldo_actual` suma TODOS los métodos — se arregla en esta revisión |
| QR/tarjeta se registran pero no suman a efectivo | ❌ | No hay separación por método — se arregla en esta revisión |
| Caja actualiza totales en tiempo real | ⚠️ | Requiere refresh manual (botón ↻) — aceptable |
| Totales por método separados | ❌ | No existe — se arregla en esta revisión |

---

## PÁGINA DE VENTAS

| Item | Estado | Detalle |
|------|--------|---------|
| Existe ruta/página Ventas | ✅ | `src/pages/admin/Ventas.jsx` |
| Aparece en menú lateral (si módulo activo) | ✅ | Sidebar.jsx con `modulo:'ventas'` |
| KPIs del mes (ventas, ingreso, membresías, productos) | ✅ | 4 KPI cards con selector de mes |
| Filtros funcionan (período, tipo, método, buscador) | ✅ | Funcional completo |
| Tabla de ventas con datos correctos | ✅ | JOIN con clientes y usuarios |
| Detalle de venta (modal) funciona | ✅ | Incluye productos de la venta |
| Anular venta (con confirmación) | ✅ | Con doble confirmación |
| Reimprimir / Factura | ⚠️ | No implementado (fuera del scope de 6A según spec) |

---

## BOTÓN NUEVA VENTA

| Item | Estado | Detalle |
|------|--------|---------|
| Aparece "+ Nueva Venta" en Control de Acceso | ✅ | En el header |
| Solo visible si módulos Inventario+Ventas activos | ✅ | `esModuloActivo('ventas') && esModuloActivo('inventario')` |
| Abre el carrito de productos | ✅ | `ModalVentaRapida` |
| Si no hay caja, pide abrirla primero | ❌ | Se arregla en esta revisión |

---

## CARRITO DE PRODUCTOS

| Item | Estado | Detalle |
|------|--------|---------|
| Búsqueda por nombre/código | ✅ | `inventario.buscarPOS` con ≥2 chars |
| Filtro por categoría | ❌ | No implementado (menor, pendiente) |
| Click agrega al carrito | ✅ | Funcional |
| Productos sin stock deshabilitados | ✅ | `disabled={p.stock <= 0}` |
| Botones +/- ajustan cantidad | ✅ | Con validación de stock máximo |
| Calcula subtotal y total | ✅ | Cálculo en tiempo real |
| Permite descuento | ❌ | No implementado (menor, pendiente) |
| Permite cliente opcional | ❌ | No implementado (menor, pendiente) |
| Procesa pago correctamente | ✅ | `inventario.venderProductos` |
| Descuenta stock al vender | ✅ | Manejado en `venderProductos` |

---

## PANEL DE CAJA (Caja.jsx)

| Item | Estado | Detalle |
|------|--------|---------|
| Muestra estado (abierta/cerrada) | ✅ | Página completa con `CajaCerrada`/`CajaAbierta` |
| Muestra cajero y tiempo activo | ✅ | Info bar con duración en tiempo real |
| Cards de resumen | ✅ | 3 cards: saldo, ingresos, egresos |
| Desglose por método de pago | ❌ | Se arregla en esta revisión |
| Gestión efectivo (ingreso/egreso manual) | ✅ | Modales funcionales |
| Timeline de movimientos del turno | ✅ | Lista completa invertida |

---

## CIERRE DE CAJA

| Item | Estado | Detalle |
|------|--------|---------|
| Calcula efectivo esperado correctamente | ❌ | Mezcla todos los métodos — se arregla en esta revisión |
| Separa efectivo de QR/tarjeta | ❌ | Se arregla en esta revisión |
| Campo de conteo físico | ✅ | Input `monto_cierre` |
| Diferencia calculada automáticamente | ✅ | `montoCierre - saldo` en tiempo real |
| Verde si cuadra, rojo si hay diferencia | ✅ | Colores dinámicos |
| Genera corte PDF | ❌ | No implementado — pendiente |
| Registra en auditoría/DB | ✅ | `caja.cerrar` guarda todo |

---

## INTEGRACIÓN CON REPORTES

| Item | Estado | Detalle |
|------|--------|---------|
| Tab Caja en reportes | ❌ | Se arregla en esta revisión |
| Tab Ventas en reportes | ✅ | Existe (usa `pagos.getAll`) |
| Reportes por método de pago | ✅ | Pie chart por método |
| Reportes por cajero | ❌ | No implementado — pendiente |
| Productos más vendidos | ❌ | No implementado — pendiente |

---

## MÓDULO VENTAS

| Item | Estado | Detalle |
|------|--------|---------|
| Toggle ON/OFF en GestionModulos | ✅ | Card con descripción y features |
| Depende de Inventario | ✅ | `moduloDep:'inventario'` en Sidebar |
| Si OFF oculta menú Ventas | ✅ | Gateado por `modulo:'ventas'` |
| Si OFF oculta botón Nueva Venta | ✅ | `esModuloActivo('ventas')` en ControlAcceso |

---

## ERRORES TÉCNICOS

| Item | Estado |
|------|--------|
| Build Vite sin errores | ✅ |
| Sintaxis database.cjs | ✅ |
| `ventas.sesion_caja_id` columna existe | ✅ |
| Imports correctos en todos los archivos | ✅ |
| No hay crashes de componentes | ✅ |

---

## RESUMEN DE ARREGLOS APLICADOS

### 🔧 Arreglado en esta revisión:
1. **Auto apertura de caja** — Modal inline en `ModalVentaRapida` y `NuevoClienteWizard` cuando no hay caja abierta
2. **Separación efectivo/digital** — `caja.getResumen` ahora retorna `efectivo_esperado` y `por_metodo`
3. **ModalCerrarCaja** — Muestra efectivo esperado por separado del saldo total
4. **Desglose por método en CajaAbierta** — Cards con efectivo vs digital
5. **Tab Caja en Reportes** — Historial de sesiones con totales

### ⚠️ Pendiente (funcional sin ser bloqueante):
- PDF de corte de caja (requiere jsPDF u otra librería)
- Filtro por categoría en carrito
- Descuento en carrito de productos rápidos
- Cliente opcional en venta rápida
- Reportes por cajero
- Top productos más vendidos
