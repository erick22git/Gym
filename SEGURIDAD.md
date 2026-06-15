# SEGURIDAD — Urban Fitness Club

## Capas de protección implementadas

### Capa 1 — webPreferences seguros (commit a6e714d)
`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, `devTools: isDev`.
El renderer (React/UI) no tiene acceso a Node.js. En producción, las DevTools están completamente deshabilitadas a nivel de Chromium.
CSP via `session.webRequest.onHeadersReceived`: restringe `script-src` y `connect-src` a `'self'`.

### Capa 2 — Electron Fuses (commit 4be216e)
Aplicados con `@electron/fuses` via hook `afterPack`:
- `RunAsNode: false` — el .exe no puede convertirse en un proceso Node arbitrario (bloquea el vector de ELECTRON_RUN_AS_NODE).
- `OnlyLoadAppFromAsar: true` — la app sólo carga código desde el `app.asar` sellado.
- `EnableEmbeddedAsarIntegrityValidation: true` — Electron valida el hash del asar al arrancar.
- `EnableCookieEncryption: true` — cookies cifradas en disco.

### Capa 3 — V8 Bytecode (commit cacb65b)
El main process se compila a `.jsc` (bytecode V8) con `bytecodePlugin` de `electron-vite`. El código fuente de la lógica de negocio, consultas SQL y manejo de BD no es legible como JS plano en el ejecutable.

**Limitación**: el bytecode es V8-específico (versión de Node/Chromium del Electron instalado). No protege el renderer (React), que va minificado en el ASAR.

### Capa 4 — ASAR Integrity (activada por Capa 2)
Con `EnableEmbeddedAsarIntegrityValidation: true` + `OnlyLoadAppFromAsar: true`, Electron genera y valida un hash del `app.asar` al construir. Si alguien modifica cualquier archivo dentro del ASAR después del build, la app rechaza arrancar.

### Capa 5 — Protección de la base de datos (commit 03a8b66)

#### BD operativa (`urbanfitness.db`)
- Cifrada con **AES-256-GCM** (clave de 256 bits, IV aleatorio por escritura, AuthTag de integridad).
- Clave derivada con **PBKDF2 (60 000 iteraciones, SHA-256)** a partir del **machine-id de la PC** (UUID de hardware via `node-machine-id`).
- **Consecuencia**: copiar el archivo `.db` a otra PC no permite descifrarlo. Los datos están atados a la máquina donde se instaló la app.
- Migración automática: al primer arranque con la nueva versión, una BD sin cifrar se re-guarda cifrada inmediatamente.
- Formato: `MAGIC(4) | IV(16) | AuthTag(16) | Ciphertext(N)` — el MAGIC `UFC1` detecta si ya está cifrado.

#### Backups exportables (`.enc`)
- Cifrados con **AES-256-GCM** usando una clave derivada de una passphrase **fija embebida en el código** (PBKDF2, 60 000 iter), idéntica en todas las instalaciones.
- **Consecuencia**: los backups `.enc` son **portables** — se pueden restaurar en cualquier PC con la misma versión de la app.
- Compatibilidad: si se importa un respaldo `.json` antiguo (sin cifrar), se detecta por ausencia del MAGIC `UFCB` y se procesa como JSON plano.

#### Verificación de integridad
- Al guardar la BD: se escribe un hash SHA-256 del archivo cifrado en `urbanfitness.db.hash`.
- Al arrancar: se compara el hash del archivo actual con el guardado. Si no coincide, se registra un evento `INTEGRIDAD_SOSPECHOSA` en la tabla `auditoria` pero la app **no se bloquea** (sólo alerta).

### Capa 6 — Anti-debugging y hardening (commit bc95642)
- `Menu.setApplicationMenu(null)` en producción: elimina el menú de Electron que incluía "View > Toggle Developer Tools".
- `before-input-event`: bloquea F12, Ctrl+Shift+I, Ctrl+Shift+J y Ctrl+Shift+C en producción (defensa en profundidad).
- `will-navigate`: previene navegación a URLs externas (sólo `file://` está permitido).
- `setWindowOpenHandler({ action: 'deny' })`: bloquea apertura de ventanas externas.
- Verificado: no hay `eval()` ni `new Function()` dinámicos en el código fuente.

---

## Qué NO está protegido (limitaciones honestas)

- **El renderer (React/UI)**: el código queda minificado pero legible con un deobfuscador. Las capas 1-6 protegen el backend, no el UI.
- **Memoria en tiempo de ejecución**: un atacante con acceso físico y herramientas como `x64dbg` puede inspeccionar la RAM del proceso mientras corre.
- **La passphrase de backups**: está embebida en el bytecode (.jsc). El bytecode no es reversible a JS plano, pero con suficiente esfuerzo (análisis de memoria) podría extraerse. Para casos de muy alta sensibilidad, reemplazar por una passphrase que el usuario introduce manualmente.
- **El machine-id como única defensa de la BD**: si el atacante clona el disco entero (incluyendo el registro de Windows que contiene el machine-id), podría reconstruir la clave. La combinación de PBKDF2 + machine-id eleva mucho la barrera, pero no es equivalente a un HSM.
- **ASAR integrity en Electron**: efectiva contra modificaciones post-build, pero Electron actualmente no tiene firma de código del ASAR en la misma forma que macOS verifica los bundles con notarización.

---

## Procedimientos operativos

### Si el cliente cambia de PC

La BD operativa (`urbanfitness.db`) está atada al machine-id de la PC actual y **no se puede mover directamente**.

**Procedimiento correcto:**
1. Desde la PC original (con la app funcionando), ir a Configuración > Respaldos > **Crear Respaldo** → genera un archivo `.enc`.
2. Instalar la app en la PC nueva.
3. En la PC nueva: Configuración > Respaldos > **Restaurar Respaldo** → seleccionar el `.enc`.
4. El `.enc` usa la clave portable (misma en todas las instalaciones) y se restaurará correctamente.

### Si se sospecha modificación de la BD

1. Revisar la tabla `auditoria` filtrando `accion = 'INTEGRIDAD_SOSPECHOSA'`.
2. El registro incluye fecha y hora exacta del arranque sospechoso.
3. Si el evento existe: comparar el último backup válido con el estado actual de los datos para identificar qué cambió.
4. Como medida preventiva: restaurar desde el último backup `.enc` conocido como íntegro.

---

## Nivel de protección alcanzado

Esta combinación de capas eleva enormemente la barrera de entrada para:
- **Leer el código fuente**: bytecode V8 + ASAR integrity.
- **Modificar la app**: fuses + ASAR integrity rechazan binarios alterados.
- **Acceder a los datos sin la app**: AES-256-GCM con clave derivada de machine-id.
- **Ejecutar Node arbitrario**: RunAsNode=false.
- **Abrir DevTools**: webPreferences + menú eliminado + bloqueo de atajos.

**No es un sistema 100% seguro** (ninguno lo es). Un atacante con acceso físico prolongado, herramientas especializadas y tiempo suficiente puede superar estas capas. El objetivo es que el costo/tiempo supere ampliamente el valor de los datos para la inmensa mayoría de escenarios reales.
