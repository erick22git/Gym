# Cierre de sprint: lanza la app empaquetada (D:\Erick\GymApp) en entorno de PC limpia con proxy trampa + monitor de
# conexiones, la deja corriendo $Segundos, comprueba que los servicios locales respondan y que no haya NINGUNA conexion externa.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\empaquetado\prueba-red.ps1 [-Segundos 150]
param([int]$Segundos = 150, [string]$App = 'D:\Erick\GymApp', [string]$Dir = 'D:\Erick\GymClean')
$aqui = $PSScriptRoot
$parar = "$Dir\parar_cierre.flag"; Remove-Item $parar -ErrorAction SilentlyContinue
$trampaLog = "$Dir\trampa_cierre.log"; $monLog = "$Dir\conexiones_cierre.log"
$trampa = Start-Process node -ArgumentList "`"$aqui\trampa.cjs`" `"$trampaLog`"" -WindowStyle Hidden -PassThru
$mon = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$aqui\monitor.ps1`" -Carpeta `"$App`" -Log `"$monLog`" -Parar `"$parar`"" -WindowStyle Hidden -PassThru
Start-Sleep 2
$pidFile = "$Dir\lanzador_cierre.pid"
Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$aqui\lanzar-limpio.ps1`" -Exe `"$App\Gimnasio.exe`" -Salida `"$Dir\app_cierre.log`" -PidFile `"$pidFile`"" -WindowStyle Hidden   # sin -Wait: esperaria a toda la app
Start-Sleep 3
"app lanzada; esperando $Segundos s"
Start-Sleep $Segundos
$resp = @{}
foreach ($u in 'http://127.0.0.1:8420/health', 'http://127.0.0.1:11434/api/tags') { try { $resp[$u] = (Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 5).StatusCode } catch { $resp[$u] = 'sin respuesta' } }
$resp.GetEnumerator() | ForEach-Object { "$($_.Key) -> $($_.Value)" }
New-Item $parar -ItemType File | Out-Null
Start-Sleep 2
# apagado: solo procesos cuyo ejecutable esta dentro de la carpeta de la app
Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($App, [StringComparison]::OrdinalIgnoreCase) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Stop-Process -Id $trampa.Id -Force -ErrorAction SilentlyContinue
$ext = @(Get-Content $monLog | Where-Object { $_ -match '^\d{4}-' })
$tr = @(Get-Content $trampaLog | Where-Object { $_ })
"conexiones externas (monitor): $($ext.Count)"; $ext
"intentos en la trampa: $($tr.Count)"; $tr
Get-Content $monLog | Select-Object -Last 1
$huerf = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($App, [StringComparison]::OrdinalIgnoreCase) })
"procesos de la app que siguen vivos: $($huerf.Count)"
