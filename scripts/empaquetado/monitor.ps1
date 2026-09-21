# Muestrea cada 250 ms las conexiones TCP y endpoints UDP de TODO proceso cuyo ejecutable esté
# dentro de $Carpeta, y anota cualquier destino que NO sea loopback. Corre hasta que exista $Parar.
param([string]$Carpeta, [string]$Log, [string]$Parar)
"" | Set-Content $Log
$vistos = @{}
$loop = @('127.0.0.1', '::1', '0.0.0.0', '::', 'localhost')
$muestras = 0
while (-not (Test-Path $Parar)) {
  $pids = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($Carpeta, [StringComparison]::OrdinalIgnoreCase) } | Select-Object -ExpandProperty ProcessId)
  if ($pids.Count -gt 0) {
    $muestras++
    Get-NetTCPConnection -ErrorAction SilentlyContinue | Where-Object { $pids -contains $_.OwningProcess -and $loop -notcontains $_.RemoteAddress } | ForEach-Object {
      $k = "TCP $($_.OwningProcess) $($_.RemoteAddress):$($_.RemotePort) $($_.State)"
      if (-not $vistos.ContainsKey($k)) { $vistos[$k] = 1; "$(Get-Date -Format o) $k" | Add-Content $Log }
    }
    # UDP no tiene "remoto": si un proceso de la prueba abre UDP en una interfaz NO loopback (DNS, mDNS...) se anota
    Get-NetUDPEndpoint -ErrorAction SilentlyContinue | Where-Object { $pids -contains $_.OwningProcess -and $loop -notcontains $_.LocalAddress } | ForEach-Object {
      $k = "UDP $($_.OwningProcess) local=$($_.LocalAddress):$($_.LocalPort)"
      if (-not $vistos.ContainsKey($k)) { $vistos[$k] = 1; "$(Get-Date -Format o) $k" | Add-Content $Log }
    }
  }
  Start-Sleep -Milliseconds 250
}
"FIN monitor: $muestras muestras con procesos de la prueba vivos" | Add-Content $Log
