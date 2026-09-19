param([string]$OcrFile = "C:\Erick\Gym\scripts\test_images\imgprueba.ocr.txt")
$ocrText = Get-Content -Raw -Encoding UTF8 $OcrFile

$prompt = @"
Este es texto extraido por OCR de una lista de inventario, puede tener errores de orden o de lectura.
Organizalo como una lista JSON con campos "nombre" y "cantidad". Responde SOLO con el JSON, sin explicaciones.

Texto OCR:
$ocrText
"@

$body = @{
    model = "qwen2.5:3b"
    prompt = $prompt
    stream = $false
} | ConvertTo-Json

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$r = Invoke-RestMethod -Uri "http://localhost:11434/api/generate" -Method Post -Body $body -ContentType "application/json; charset=utf-8"
$sw.Stop()

Write-Output "=== RESPUESTA DEL MODELO ==="
Write-Output $r.response
Write-Output ""
Write-Output "=== TIEMPOS ==="
Write-Output "Total: $([math]::Round($r.total_duration/1e9,2)) s"
Write-Output "Eval (generacion): $([math]::Round($r.eval_duration/1e9,2)) s"
Write-Output "Tokens generados: $($r.eval_count)"
