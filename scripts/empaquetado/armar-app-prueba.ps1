# Arma una carpeta "instalada" de PRUEBA (NO es el instalador .exe): el runtime de Electron renombrado a
# Gimnasio.exe + resources\app.asar (front de producción + bytecode de main) + los recursos empaquetados
# (ocr-service, ollama, modelos, modelo whisper). Así la app corre con app.isPackaged = true y con sus
# servicios saliendo de resources\, igual que instalada, sin descargar nada (electron-builder necesita
# bajar herramientas de firma en el primer uso; esto no).
#
# NO ejercita: el instalador NSIS, las electron fuses (afterPack) ni la integridad del asar.
#
#   powershell -ExecutionPolicy Bypass -File scripts\empaquetado\armar-app-prueba.ps1 [-Destino C:\GymApp]
#   -SoloApp: solo recompila el bytecode y reemplaza resources\app.asar en un $Destino ya armado
#             (para iterar sobre el código de Electron sin volver a copiar 6 GB de recursos).
param([string]$Destino = 'C:\GymApp', [switch]$SoloApp)
$ErrorActionPreference = 'Stop'
$raiz = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$rb = Join-Path $raiz 'resources-build'
function Paso($t) { Write-Host "`n== $t" -ForegroundColor Cyan }

Paso 'Front de producción (vite build → dist/)'
Push-Location $raiz
if (-not $SoloApp) { npx vite build; if ($LASTEXITCODE) { throw 'vite build falló' } }
Paso 'Bytecode de main.cjs (→ electron/main.jsc, con el V8 de Electron)'
node scripts\run-bytecode-compile.cjs; if ($LASTEXITCODE) { throw 'bytecode falló' }

Paso 'Staging de resources\app (solo dependencias de producción)'
$stage = Join-Path $env:TEMP 'gym-app-stage'
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory $stage | Out-Null
Copy-Item package.json $stage
robocopy dist "$stage\dist" /E /NFL /NDL /NJH /NJS /NP | Out-Null
robocopy electron "$stage\electron" /E /XF main.cjs /NFL /NDL /NJH /NJS /NP | Out-Null   # main.cjs NO viaja: va el .jsc
$prod = npm ls --omit=dev --all --parseable 2>$null | Where-Object { $_ -and ($_ -like "$raiz\node_modules\*") }
foreach ($p in $prod) { $rel = $p.Substring($raiz.Length + 1); robocopy $p (Join-Path $stage $rel) /E /NFL /NDL /NJH /NJS /NP | Out-Null }
Pop-Location

if ($SoloApp) {
  Paso 'Re-empaquetando solo resources\app.asar'
  Remove-Item "$Destino\resources\app.asar" -Force
  & (Join-Path $raiz 'node_modules\.bin\asar.cmd') pack $stage "$Destino\resources\app.asar"
  Remove-Item $stage -Recurse -Force
  'Listo: app.asar actualizado en ' + $Destino
  return
}
Paso "Runtime de Electron → $Destino"
Remove-Item $Destino -Recurse -Force -ErrorAction SilentlyContinue
robocopy "$raiz\node_modules\electron\dist" $Destino /E /XF electron.exe /XD resources /NFL /NDL /NJH /NJS /NP | Out-Null
Copy-Item "$raiz\node_modules\electron\dist\electron.exe" "$Destino\Gimnasio.exe"
New-Item -ItemType Directory "$Destino\resources" | Out-Null
& (Join-Path $raiz 'node_modules\.bin\asar.cmd') pack $stage "$Destino\resources\app.asar"
Copy-Item "$raiz\node_modules\sql.js\dist\sql-wasm.wasm" "$Destino\resources\sql-wasm.wasm"   # build.extraFiles

Paso 'Recursos empaquetados (build.extraResources)'
foreach ($d in 'ocr-service', 'ollama', 'ollama-models', 'paddlex-models', 'whisper-model') {
  robocopy (Join-Path $rb $d) "$Destino\resources\$d" /E /NFL /NDL /NJH /NJS /NP | Out-Null
}
Remove-Item $stage -Recurse -Force
$m = Get-ChildItem $Destino -Recurse -File | Measure-Object Length -Sum
'Listo: {0} — {1:N0} MB en {2} archivos' -f "$Destino\Gimnasio.exe", ($m.Sum / 1MB), $m.Count
