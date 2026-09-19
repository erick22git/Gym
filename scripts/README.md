# Servicio de OCR / estructuración de inventario

Servicio HTTP local que empaqueta el pipeline validado de lectura de fotos de
listas de inventario: OCR real (PaddleOCR) + reconstrucción posicional +
estructuración con un LLM chico (qwen2.5:3b vía Ollama), con verificaciones
para no inventar ni perder datos en silencio.

## Cómo levantarlo

```bash
C:\Erick\Gym\venv-ocr\Scripts\python.exe C:\Erick\Gym\scripts\ocr_service.py
```

Queda escuchando en `http://localhost:8420`. Hace falta que **Ollama** esté
corriendo aparte (con el modelo `qwen2.5:3b` ya descargado) para que la parte
de estructuración funcione — si Ollama no responde, las imágenes con
ambigüedad simplemente van todas a `requiere_revision`.

### Puertos usados en la máquina (sin conflicto entre sí)

| Puerto | Qué es |
|---|---|
| **8420** | Este servicio (OCR + estructuración) |
| 11434 | Ollama (LLM qwen2.5:3b) |
| 5173 | Vite (servidor de desarrollo de la app Electron) |

## Endpoints

| Endpoint | Campo multipart | Formato | Pipeline |
|---|---|---|---|
| `POST /procesar-imagen` | `imagen` | jpg/png/webp | OCR (PaddleOCR) + reconstrucción posicional + LLM |
| `POST /procesar-excel` | `archivo` | .xlsx | Filas ya estructuradas → directo a `resueltos`, sin LLM |
| `POST /procesar-word` | `archivo` | .docx | Si tiene tabla(s): igual que Excel. Si es texto libre (párrafos): mismo Agente Estructurador (LLM) que las imágenes |
| `POST /procesar-pdf` | `archivo` | .pdf | Si tiene tabla(s) detectable(s): igual que Excel. Si tiene texto sin tabla: Agente Estructurador (LLM). Si no tiene texto extraíble (escaneado): se convierte a imagen página por página y reusa el pipeline de OCR completo |
| `POST /asistente-texto` | — (JSON `{"texto": "..."}`) | — | Agente Supervisor: clasifica la intención de un mensaje sin adjuntos (`importar` / `pregunta_sistema` / `charla_general`) y responde acorde. Preguntas del sistema se responden con base en `scripts/conocimiento_sistema.md` — si no está cubierto ahí, dice honestamente que no lo sabe |

### Entrada — `POST /procesar-imagen`

Una de las dos formas:

- `multipart/form-data` con campo `imagen` (el archivo de imagen), o
- JSON: `{"imagen_base64": "..."}` (con o sin el prefijo `data:image/...;base64,`)

### Entrada — Excel/Word/PDF

`multipart/form-data` con campo `archivo` (el archivo .xlsx/.docx/.pdf).

### Salida

```json
{
  "resueltos": [
    { "nombre": "Coca cola de 12 pzas 355 ml", "cantidad": 3, "confianza": "alta" }
  ],
  "requiere_revision": [
    {
      "id": "grupo_3",
      "texto_ocr_crudo": ["SURTIDO DE BOTANA DE 50 PZAS", "1 $"],
      "nombre_sugerido": "SURTIDO DE BOTANA DE 50 PZAS",
      "cantidad_sugerida": null,
      "motivo": "cobertura_incompleta"
    }
  ],
  "tiempo_procesamiento_seg": 258.31
}
```

`GET /health` devuelve `{"status": "ok", "modelo_llm": "qwen2.5:3b"}` — útil
para confirmar que el servicio está arriba antes de mandarle una imagen.

### Valores posibles de `motivo`

| Motivo | Qué significa |
|---|---|
| `fusion_extrema` | La línea agrupaba demasiados fragmentos de OCR (más de 5) — huele a que hay varios productos mezclados en una sola fila. Nunca llega a pasar por el LLM, va directo a revisión. |
| `cobertura_incompleta` | El LLM no logró dar cuenta de todos los fragmentos de texto de esa línea (algo se quedó sin usar). Antes que perder ese dato en silencio, se manda todo a revisión. |
| `origen_sospechoso` | El LLM devolvió una cantidad, pero esa cantidad no está respaldada por ningún fragmento puramente numérico — típicamente porque el número venía embebido en el nombre del producto (ej. "de 4 pzs") y se reusó por error como si fuera la cantidad real. |
| `nombre_invalido` | El nombre que devolvió el LLM es solo un símbolo suelto, un número puro, o un genérico tipo `SIN_IDENTIFICAR` — no es un nombre de producto real. |
| `sin_cantidad` | El nombre parece válido, pero no hay ninguna cantidad numérica asociada. |

## Qué significa "resuelto" acá (importante)

Un producto entra a `resueltos` únicamente si pasa **los tres controles
juntos**, no solo si "el LLM respondió algo":

1. **Cobertura** — todos los fragmentos de OCR de esa línea quedaron
   justificados por algún producto de salida (nada se descarta en silencio).
2. **Nombre válido** — no es un símbolo suelto, un número puro, ni un
   genérico tipo `SIN_IDENTIFICAR`.
3. **Cantidad real y no reciclada** — la cantidad es un número, y viene de
   una línea de OCR puramente numérica (no de un número que en realidad era
   parte del nombre del producto).

Esto quedó así después de encontrar, en pruebas reales, que un LLM chico
como qwen2.5:3b **satisface fácilmente una verificación de cobertura floja**
inventando productos-basura (`"nombre": "$"`) o reciclando el mismo número
para el nombre y la cantidad — pasar la cobertura NO es sinónimo de que el
dato sea correcto. En el peor caso probado (foto real con letra cursiva y
anotaciones a mano), esto dio **55% de resolución automática confiable**,
con el resto yendo a revisión humana en vez de arriesgar un dato inventado.
No hay un documento "Brief 1" separado — esta nota y el historial de la
sesión donde se construyó el pipeline son la referencia.

## Limitaciones actuales

- Procesa **imágenes, Excel, Word y PDF**. Cualquier otro formato sigue
  usando datos de ejemplo en la app (no debería llegar nunca, `ACCEPT_ARCHIVOS`
  en `ImportarIA.jsx` ya filtra las extensiones aceptadas).
- No compara contra el inventario real de la base de datos — todo lo que
  sale de acá se trata como "nuevo" del lado de la app hasta que se conecte
  esa comparación.
- El tiempo de procesamiento de imágenes varía bastante según cuántas
  líneas ambiguas tenga (puede ir de ~1 minuto a ~5 minutos en este
  hardware, i5-2400 sin GPU) — cada línea ambigua moderada implica una
  llamada separada al LLM. Excel/Word-con-tabla/PDF-con-tabla son casi
  instantáneos (sin LLM); Word/PDF de texto libre tardan según cuántas
  líneas tengan (se procesan en bloques de 10).
- **Word**: si el documento no tiene tablas, se descartan los párrafos con
  estilo "Heading"/"Title" antes de mandarlos al LLM (si no, el título del
  documento contamina el bloque y tumba todo a revisión). **PDF** no tiene
  esa misma señal disponible (no hay metadata de estilo en el texto plano
  extraído) — un título en un PDF de texto libre puede hacer que ese bloque
  entero caiga a revisión. No se intentó resolver con heurísticas de tamaño
  de fuente por ahora.
- **PDF escaneado (sin texto extraíble)**: el código para convertirlo a
  imagen y reusar el pipeline de OCR está escrito (usa PyMuPDF, sin
  depender de Poppler), pero **no se probó con un PDF escaneado real**
  porque no había uno a mano. Debería funcionar dado que reutiliza
  `process_image()` tal cual, pero queda marcado como // TODO sin
  confirmar end-to-end.
