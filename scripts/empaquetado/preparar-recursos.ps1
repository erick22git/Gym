# Prepara resources-build/ con TODO lo que viaja dentro del instalador (la app instalada no descarga
# ni instala nada). Es idempotente: lo que ya existe se salta. Ejecutar desde la raíz del proyecto:
#   powershell -ExecutionPolicy Bypass -File scripts\empaquetado\preparar-recursos.ps1
#
# Resultado (ver package.json → build.extraResources):
#   resources-build\ocr-service\      ocr_service.py congelado con PyInstaller (sin Python del sistema)
#   resources-build\ollama\           ollama.exe + lib\  (binario suelto, sin instalador de Ollama)
#   resources-build\ollama-models\    qwen2.5:3b ya descargado (nadie hace "ollama pull")
#   resources-build\paddlex-models\   modelos de PaddleOCR ya descargados (nada de red al primer uso)
#   resources-build\whisper-model\    modelo Whisper small (faster-whisper/CTranslate2) para el dictado local
#
# Requiere en ESTA máquina de desarrollo (una sola vez): Ollama instalado con qwen2.5:3b descargado,
# venv-ocr con `pip install -r scripts\requirements.txt pyinstaller`, y internet SOLO para bajar el modelo whisper (una vez).

$ErrorActionPreference = 'Stop'
$raiz = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$rb = Join-Path $raiz 'resources-build'
New-Item -ItemType Directory -Force $rb | Out-Null

function Paso($t) { Write-Host "`n== $t" -ForegroundColor Cyan }

# ── 1) Ollama (binario suelto + modelo) ──────────────────────────────────────────────────────────
Paso 'Ollama + modelo qwen2.5:3b'
$ollamaSrc = Join-Path $env:LOCALAPPDATA 'Programs\Ollama'
if (-not (Test-Path (Join-Path $rb 'ollama\ollama.exe'))) {
  if (-not (Test-Path "$ollamaSrc\ollama.exe")) { throw "No encuentro Ollama instalado en $ollamaSrc" }
  New-Item -ItemType Directory -Force (Join-Path $rb 'ollama') | Out-Null
  Copy-Item "$ollamaSrc\ollama.exe" (Join-Path $rb 'ollama\ollama.exe')
  robocopy "$ollamaSrc\lib" (Join-Path $rb 'ollama\lib') /E /NFL /NDL /NJH /NJS /NP | Out-Null   # aceleración CUDA/ROCm/Vulkan: se conserva
} else { Write-Host 'ya existe' }
if (-not (Test-Path (Join-Path $rb 'ollama-models\manifests'))) {
  $modelos = Join-Path $env:USERPROFILE '.ollama\models'
  if (-not (Test-Path "$modelos\manifests\registry.ollama.ai\library\qwen2.5\3b")) { throw 'Falta el modelo: ejecuta "ollama pull qwen2.5:3b" en esta máquina' }
  robocopy $modelos (Join-Path $rb 'ollama-models') /E /NFL /NDL /NJH /NJS /NP | Out-Null
} else { Write-Host 'ya existe' }

# ── 2) Modelos de PaddleOCR ─────────────────────────────────────────────────────────────────────
Paso 'Modelos de PaddleOCR'
$paddle = Join-Path $rb 'paddlex-models\official_models'
if (-not (Test-Path $paddle)) {
  $origen = Join-Path $env:USERPROFILE '.paddlex\official_models'
  if (-not (Test-Path $origen)) { throw 'Falta ~\.paddlex\official_models: corre una vez el servicio OCR con internet para que PaddleOCR los descargue' }
  robocopy $origen $paddle /E /NFL /NDL /NJH /NJS /NP | Out-Null
} else { Write-Host 'ya existe' }

# ── 3) Servicio OCR congelado (PyInstaller, sin Python del sistema) ─────────────────────────────
Paso 'ocr-service.exe (PyInstaller)'
if (-not (Test-Path (Join-Path $rb 'ocr-service\ocr-service.exe'))) {
  $py = Join-Path $raiz 'venv-ocr\Scripts\python.exe'
  $meta = & $py -c "import importlib.metadata as m,re; r=m.requires('paddlex') or []; n=sorted({re.split(r'[<>=!~;\[ ]',x,1)[0].strip() for x in r if 'extra == \`"ocr-core\`"' in x or 'extra' not in x}); ok=[]
for d in n:
    try: m.version(d); ok.append(d)
    except Exception: pass
print(' '.join(ok))"
  $args = @('--noconfirm', '--clean', '--onedir', '--name', 'ocr-service', '--distpath', $rb,
            '--add-data', "$raiz\scripts\conocimiento_sistema.md;.",
            '--collect-all', 'paddleocr', '--collect-all', 'paddlex', '--collect-all', 'paddle', '--collect-all', 'pypdfium2', '--collect-all', 'pdfplumber')
  foreach ($m in 'pyclipper', 'shapely', 'safetensors', 'lxml', 'bidi', 'imagesize', 'faster_whisper', 'ctranslate2', 'av', 'onnxruntime', 'tokenizers') { $args += @('--collect-all', $m) }
  foreach ($d in ($meta -split ' ') + @('paddleocr', 'paddlex', 'paddlepaddle', 'python-docx', 'pdfplumber', 'pymupdf', 'Flask', 'openpyxl', 'pdfminer.six', 'faster-whisper', 'ctranslate2', 'av', 'onnxruntime', 'tokenizers', 'huggingface-hub')) { if ($d) { $args += @('--copy-metadata', $d) } }
  $args += (Join-Path $raiz 'scripts\ocr_service.py')
  & (Join-Path $raiz 'venv-ocr\Scripts\pyinstaller.exe') @args
} else { Write-Host 'ya existe' }

# ── 4) Modelo Whisper "small" para faster-whisper (dictado local; el motor va dentro de ocr-service.exe) ──
Paso 'faster-whisper: modelo small multilingüe (CTranslate2, mismos pesos de Whisper small)'
$w = Join-Path $rb 'whisper-model'
if (-not (Test-Path (Join-Path $w 'model.bin'))) {
  # Única descarga (solo en la máquina de desarrollo, ~480 MB): el usuario final nunca descarga nada.
  & (Join-Path $raiz 'venv-ocr\Scripts\python.exe') -c "from huggingface_hub import snapshot_download; snapshot_download('Systran/faster-whisper-small', local_dir=r'$w')"
}
Get-ChildItem $w | Select-Object Name, Length | Format-Table -AutoSize | Out-String | Write-Host
# El caché oculto de la descarga no debe viajar
Remove-Item (Join-Path $w '.cache') -Recurse -Force -ErrorAction SilentlyContinue
if (-not (Test-Path (Join-Path $w 'model.bin'))) { throw 'Falta model.bin del modelo de dictado' }
Write-Host 'whisper (faster-whisper small) OK'

Paso 'Tamaños'
Get-ChildItem $rb -Directory | ForEach-Object {
  $s = (Get-ChildItem $_.FullName -Recurse -File | Measure-Object Length -Sum).Sum
  '{0,-18} {1,8:N0} MB' -f $_.Name, ($s / 1MB)
}
