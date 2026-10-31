# Decisiones pendientes para Erick

1. **Unidades y decimales en la BD** (esquema: cantidades enteras). Hoy «2.5 kg», «300 g», litros pasan a **revisión** con el motivo explícito; no se tocó el esquema.
   Opciones: (A) unidad dentro del nombre («Arroz extra 2.5 kg», cantidad 1) — sin cambio de esquema, la más segura; (B) unidad en notas del producto; (C) columna nueva `unidad` + cantidad decimal — requiere migración y tocar lógica de stock. Mientras decides queda la A como comportamiento seguro/reversible.
2. **Merge a main**: no se hace; la rama `feat/sprint2-lectura` queda para tu revisión.
3. **Modelo por defecto qwen2.5:3b**: no se cambia (es del Sprint 3); si las comparaciones muestran un modelo mejor, solo se propone en el informe.
