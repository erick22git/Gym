# Empaquetado e instalador — estado y guía

> Estado: **todo el contenido está listo y probado como carpeta "instalada" de prueba. El instalador `.exe`
> NO se ha generado** (a propósito: Erick quiere revisar la interfaz antes). Este documento deja claro qué hay,
> cómo regenerarlo, cómo se probó y qué falta decidir.

## Regla de diseño

La app instalada funciona **100 % sin internet** y sin que el usuario instale nada externo (ni Python, ni Ollama,
ni modelos). Nada se degrada para aligerar el instalador: los modelos van completos (`qwen2.5:3b`, `whisper small`
multilingüe, modelos de PaddleOCR).

## Qué viaja dentro (build.extraResources en `package.json`)

| Carpeta en `resources/` | Qué es | Tamaño aprox. |
|---|---|---|
| `ocr-service/` | `ocr_service.py` congelado con PyInstaller (PaddleOCR, faster-whisper/CTranslate2, Flask, openpyxl, python-docx, pdfplumber, pymupdf) — sin Python del sistema | 872 MB |
| `ollama/` | `ollama.exe` + `lib/` (CUDA 12/13, ROCm, Vulkan: aceleración por GPU si existe), **sin** el instalador de Ollama | 2 794 MB |
| `ollama-models/` | `qwen2.5:3b` ya descargado (1,84 GB): nadie hace `ollama pull` | 1 841 MB |
| `paddlex-models/` | 5 modelos de PaddleOCR ya descargados: sin descarga al primer uso | 160 MB |
| `whisper-model/` | Modelo Whisper **small** multilingüe en formato CTranslate2 (mismos pesos; lo usa el motor que va dentro de `ocr-service`) | 464 MB |
| (app) | runtime de Electron + `app.asar` (front + bytecode de `main`) | ~380 MB |

**Total descomprimido de la carpeta instalada de prueba: ≈ 6,8 GB (6 803 MB).**
Comprimido dentro de un instalador se estima en **≈ 4–5 GB** (los modelos casi no comprimen). Es una estimación:
no se generó el instalador.

## Cómo arranca todo (electron/servicios-locales.cjs)

Al iniciar la app (no bajo demanda) `main` lanza como procesos hijos, con puertos propios:

- **Ollama** en `127.0.0.1:11439` (`OLLAMA_MODELS` apunta a `resources/ollama-models`; `OLLAMA_NO_CLOUD=1`,
  `OLLAMA_NOPRUNE=1`). Precarga el modelo en memoria.
- **Servicio OCR** en `127.0.0.1:8420` (`GYM_OLLAMA_URL` → el Ollama de arriba; temporales en
  `userData/ia-tmp`; `PADDLE_PDX_CACHE_HOME` → modelos empaquetados).
- La UI consulta `window.api.servicios` y **bloquea el envío** en la pantalla de IA hasta que ambos estén listos.
- Al salir mata el árbol de procesos **y todo lo que cuelgue de la carpeta empaquetada** (el runner
  `llama-server.exe` puede sobrevivir a un `taskkill /T`). Si la app muere de golpe, el servicio OCR tiene un
  vigilante del proceso padre que apaga Ollama y se apaga; al volver a arrancar, la app limpia restos. (Ojo: Node mete a los hijos en un Job Object que Windows cierra con el padre, por eso el servicio OCR se lanza `detached`; si no, moriria al instante sin poder limpiar. Verificado: cierre brusco -> 0 procesos en ~5 s; cierre normal -> ~6 s.)
- Logs: `%APPDATA%\gimnasio\logs\{ollama,ocr-service}.log`.

El dictado (`electron/voz.cjs`) manda el WAV al servicio local (`POST 127.0.0.1:8420/transcribir`), que lo transcribe con **faster-whisper** (modelo small, `float32`, sin cuantizar). Whisper.cpp se retiró: tardaba 206–260 s por frase en la PC de desarrollo; faster-whisper, ~7–12 s (mismo modelo, mismo texto).

## Cero tráfico saliente (verificado)

- CSP de producción: `connect-src 'self' http://localhost:8420`, `img-src … blob:`, sin fuentes externas
  (Oxanium/Inter van empaquetadas con `@fontsource`).
- Chromium en producción **no puede resolver nombres que no sean localhost** (`host-resolver-rules`), sin DNS
  seguro y sin networking de fondo (`electron/main.cjs`). En la prueba de PC limpia, sin esto, el proceso
  `NetworkService` sondeaba DNS-over-HTTPS hacia `8.8.4.4:443` (el DNS de esa PC era el de Google).
- Ollama sin funciones cloud (`OLLAMA_NO_CLOUD`): antes intentaba llegar a `ollama.com`.
- Lo que usa internet a propósito (facturación SIAT, correo) corre en Node en el proceso principal y no se ve
  afectado; **la facturación electrónica necesita internet cuando se use**.

## Regenerar los recursos (`resources-build/`, ignorado por git)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\empaquetado\preparar-recursos.ps1
```

Idempotente. Requiere en la máquina de desarrollo: Ollama instalado con `qwen2.5:3b`, `venv-ocr` con
`pip install -r scripts\requirements.txt pyinstaller`, e internet **solo** para bajar el modelo `Systran/faster-whisper-small` (~480 MB, una vez).
`faster-whisper` va en `scripts/requirements.txt`.

## Carpeta "instalada" de prueba (NO es el instalador)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\empaquetado\armar-app-prueba.ps1 -Destino C:\GymApp
# solo el código de Electron (sin recopiar 6 GB):  … -SoloApp
```

Arma `Gimnasio.exe` (runtime de Electron renombrado) + `resources\app.asar` (front de producción + `main.jsc`
en bytecode) + los recursos. La app corre con `app.isPackaged = true`. **No ejercita:** el instalador NSIS, las
electron fuses (`scripts/apply-fuses.cjs`) ni la integridad del asar.

## Prueba de "PC limpia"

`scripts/empaquetado/` trae el arnés: `lanzar-limpio.ps1` (entorno vacío: sin Python en el PATH, HOME/AppData
nuevos, proxy trampa), `trampa.cjs` (proxy en 127.0.0.1:9 que registra cualquier intento de salir) y
`monitor.ps1` (anota toda conexión no-loopback de los procesos de la carpeta). Uso típico: lanzar
`C:\GymApp\Gimnasio.exe` con `lanzar-limpio.ps1` y dejar corriendo `monitor.ps1` sobre `C:\GymApp`.

Limitación honesta: no se puede desconectar la red de esta PC de desarrollo (no hay administrador y cortaría la
sesión de trabajo), así que "sin internet" se verificó con proxy trampa + monitor de conexiones + resolución de
nombres bloqueada. **Falta la verificación final desconectando el Wi-Fi a mano.**

## Generar el instalador (cuando Erick decida)

```powershell
npm run build          # prebuild (bytenode) + vite build + electron-builder (NSIS)
```

Antes de hacerlo, tener en cuenta:

1. **Límite de tamaño de NSIS (riesgo real, sin verificar aquí).** NSIS tiene un tope de ~2 GB por instalador. Con
   ≈ 4–5 GB comprimidos, `electron-builder` con target `nsis` probablemente **falle** o haya que partir el
   instalador. Alternativas a decidir: instalador con otra herramienta (p. ej. Inno Setup, sin ese tope), o un ZIP
   auto-contenido + instalador pequeño, o dos instaladores (app + "motor de IA"). Quitar las librerías GPU que no
   se necesiten (ROCm ≈ 954 MB, CUDA 13 ≈ 632 MB) reduce tamaño **sin tocar ningún modelo**, pero pierde
   aceleración en esas GPU: es una decisión de producto.
2. `electron-builder` descarga herramientas de firma la primera vez (no hay caché en esta PC); hay que hacerlo con
   internet, en la máquina de desarrollo.
3. Regenerar `resources-build/` y recompilar el ejecutable OCR (`preparar-recursos.ps1`) si cambió
   `scripts/ocr_service.py`.
4. Probar el `.exe` resultante en una PC/VM realmente limpia (sin Ollama, sin Python, sin internet).

## Limitaciones conocidas del empaquetado

- **Velocidad (en el i5-2400 de desarrollo, 4 núcleos, sin AVX2):** dictado con faster-whisper *small* (float32, sin
  cuantizar) ≈ 7–12 s por frase corta con el motor solo y ≈ 17–21 s dentro de la app completa (Ollama, Electron y
  otros programas compitiendo por la CPU). Con whisper.cpp eran 206–260 s. Un comando de voz interpretado por el LLM
  ≈ 10–30 s; una foto ≈ 40–120 s. En hardware moderno será bastante menor (no medido). No se bajó a `base`.
- **Orden de carga (importante):** `ctranslate2` se importa *antes* que `paddleocr` en `ocr_service.py`; al revés
  falla con `WinError 127` por el choque de dos `libiomp5md.dll` (reproducido y corregido).
- Windows "N" sin *Media Feature Pack*: `cv2` (OpenCV) importa DLL de Media Foundation que ahí no existen.
- El asistente de texto (`qwen2.5:3b`) a veces mezcla palabras en portugués ("uma", "ou").
- Una BD nueva trae los módulos Ventas/Inventario/Casilleros/Facturación **desactivados** (Configuración → Módulos),
  y el usuario inicial es `admin` / `admin123` con cambio obligatorio de contraseña. En `database.cjs` hay además una
  contraseña de administrador por defecto `'1234'` (preexistente): conviene revisarla antes de entregar.
- Los productos importados por IA se crean con precio 0 y stock mínimo 5.
