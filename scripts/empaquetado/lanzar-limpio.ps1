# Lanza un ejecutable en un entorno "PC limpia": variables de entorno VACIAS salvo las minimas de
# Windows, sin Python ni nada del proyecto en el PATH, HOME/AppData recien creados y vacios,
# y proxy trampa para cualquier intento de salir a internet. Escribe el PID del proceso lanzador
# en $PidFile (no por stdout: un hijo que hereda el pipe de captura bloquea al llamador).
param([string]$Exe, [string]$Salida, [string]$PidFile, [string]$ArgsExe = '', [string]$ExtraJson = '{}')
$limpio = 'C:\GymClean\perfil'
New-Item -ItemType Directory -Force "$limpio\AppData\Roaming", "$limpio\AppData\Local", "$limpio\tmp" | Out-Null
# Este powershell es desechable: se vacia SU entorno y el hijo hereda solo lo que se define abajo.
Get-ChildItem Env: | ForEach-Object { Remove-Item ("Env:\" + $_.Name) -ErrorAction SilentlyContinue }
$base = @{
  SystemRoot = 'C:\Windows'; windir = 'C:\Windows'; ComSpec = 'C:\Windows\System32\cmd.exe'; PATHEXT = '.COM;.EXE;.BAT;.CMD'
  PATH = 'C:\Windows\System32;C:\Windows'
  USERPROFILE = $limpio; HOME = $limpio; APPDATA = "$limpio\AppData\Roaming"; LOCALAPPDATA = "$limpio\AppData\Local"
  TEMP = "$limpio\tmp"; TMP = "$limpio\tmp"; USERNAME = 'cliente'; COMPUTERNAME = 'PC-CLIENTE'
  HTTP_PROXY = 'http://127.0.0.1:9'; HTTPS_PROXY = 'http://127.0.0.1:9'; ALL_PROXY = 'http://127.0.0.1:9'
  NO_PROXY = '127.0.0.1,localhost,::1'
}
foreach ($k in $base.Keys) { Set-Item -Path ("Env:\" + $k) -Value $base[$k] }
$extra = $ExtraJson | ConvertFrom-Json
foreach ($p in $extra.PSObject.Properties) { Set-Item -Path ("Env:\" + $p.Name) -Value ([string]$p.Value) }
$argumentos = "/c `"`"$Exe`" $ArgsExe > `"$Salida`" 2>&1`""
$proc = Start-Process -FilePath 'C:\Windows\System32\cmd.exe' -ArgumentList $argumentos -WorkingDirectory (Split-Path $Exe) -WindowStyle Hidden -PassThru
$proc.Id | Set-Content $PidFile
