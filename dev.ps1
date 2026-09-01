# Mata procesos zombie de corridas anteriores
taskkill /F /IM electron.exe /T 2>$null
Start-Sleep -Milliseconds 500

# Mata node procesos específicos de este proyecto por puerto
$pids = netstat -ano | Select-String ":5173" | ForEach-Object { ($_ -split '\s+')[-1] } | Sort-Object -Unique
foreach ($p in $pids) {
  if ($p -match '^\d+$') { taskkill /F /PID $p 2>$null }
}

Start-Sleep -Milliseconds 300

# Lanza dev limpio
npm run dev
