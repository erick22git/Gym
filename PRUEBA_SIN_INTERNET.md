# Cómo probar tú mismo que la app funciona SIN internet

Sirve para comprobar, con tus propios ojos, que el programa instalado no necesita conexión para nada de lo
que hace la IA (fotos, chat, dictado, voz).

## 1. Dónde está el programa

| Qué | Ruta |
|---|---|
| Programa "instalado" de prueba | `C:\GymApp\Gimnasio.exe` (doble clic para abrirlo) |
| Carpeta con todos sus motores | `C:\GymApp\resources\` (Ollama, servicio OCR, modelos, modelo de dictado) |
| Logs si algo falla | `%APPDATA%\gimnasio\logs\` → `ollama.log` y `ocr-service.log` |

> Esta carpeta se armó a mano (no es el instalador `.exe` final, que todavía NO se generó). Se comporta como la
> app instalada: mismos archivos, mismo arranque.
>
> Si usas el Ollama de tu PC, no importa: la app usa el suyo propio (puerto 11439) y no toca el tuyo.

## 2. Pasos exactos

1. **Cierra todo lo de la app** si estaba abierta (si ves `Gimnasio.exe` en el Administrador de tareas, ciérralo).
2. **Desconecta la red de verdad**: apaga el Wi-Fi (icono de red de la barra de tareas → Wi-Fi apagado) **y**
   desenchufa el cable de red si lo hay. Comprueba que el icono muestre "sin conexión" y que
   `https://www.google.com` no abre en el navegador.
3. Abre `C:\GymApp\Gimnasio.exe`. Inicia sesión con tu usuario.
4. **Espera a que la IA esté lista**: al abrir *Importar con IA* verás un aviso "iniciando…". Tarda entre
   **15 segundos y ~1 minuto** la primera vez (carga los modelos en memoria). Cuando el aviso desaparezca, ya se puede usar.
5. **Prueba A – Foto de inventario**: en *Importar con IA* adjunta una foto de una lista de productos.
   Debe aparecer la tabla de productos leídos (en esta PC tarda ~1 minuto por foto; en equipos más nuevos, menos).
6. **Prueba B – Chat de texto**: escribe "hola, ¿cómo agrego un producto al inventario?". Debe responder en
   español en pocos segundos.
7. **Prueba C – Dictado**: pulsa el micrófono, di una frase corta ("Agrega tres botellas de agua de seiscientos
   mililitros"), vuelve a pulsar. Debe aparecer el texto en el campo. Tarda unos **10 segundos** en esta PC
   (la primera vez, unos segundos más porque carga el modelo).
8. **Prueba D – Modo voz** (opcional): activa "Modo voz" y comprueba que la IA responde hablando.
9. **Al terminar**: cierra la ventana normal (X). Abre el Administrador de tareas: en unos segundos no debe
   quedar ningún `ollama.exe`, `llama-server.exe`, `ocr-service.exe` ni `Gimnasio.exe`.
10. Reconecta la red cuando termines.

Todo debe responder **igual que con internet**. La única diferencia esperada es ninguna.

## 3. Qué señales indican un problema real

| Lo que ves | Qué significa |
|---|---|
| El aviso "iniciando…" no desaparece tras **3 minutos** | Un servicio no arrancó. Mira `%APPDATA%\gimnasio\logs\ocr-service.log` y `ollama.log`. No es por falta de internet, es un fallo local. |
| Mensaje "El motor de dictado no está disponible todavía" | El servicio de IA aún está cargando (espera) o no arrancó (ver logs). |
| Mensaje "Falta el modelo de dictado…" | Falta la carpeta `C:\GymApp\resources\whisper-model\` (o su `model.bin`). |
| Algo se queda "cargando" para siempre o un error de red (`fetch failed`, `ECONNREFUSED`, `ENOTFOUND`) | **Esto SÍ indicaría que algo intenta usar internet o un servicio local caído.** Anota el mensaje exacto y en qué paso pasó. |
| Texto sin tildes/ñ o con letras raras | Problema de fuentes/codificación, no de red. |
| Quedan procesos (`llama-server.exe`, etc.) tras cerrar | Fallo de cierre; avísame. |

**Lo que NO es un fallo:** que la facturación electrónica (SIAT) o el envío de correos no funcionen sin
internet. Esas dos funciones usan internet a propósito y son lo único que lo necesita.

## 4. Cómo verificar además que no sale NADA a internet (opcional, sin desconectar nada)

Con la app abierta, en PowerShell:

```powershell
Get-NetTCPConnection -OwningProcess (Get-Process Gimnasio,ollama,ocr-service,llama-server -ErrorAction SilentlyContinue).Id |
  Where-Object { $_.RemoteAddress -notin '127.0.0.1','::1','0.0.0.0','::' -and $_.State -eq 'Established' }
```

Si no imprime nada, ninguno de los procesos de la app tiene conexiones a otras máquinas. (En la sesión de
pruebas hecha con un monitor así, el resultado fue vacío.)
