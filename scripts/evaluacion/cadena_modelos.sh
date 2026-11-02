#!/bin/bash
# Evalúa en cadena los candidatos de lenguaje (Sprint 3, paso 2): descarga -> evalúa los mismos grupos -> borra el modelo.
# Uso: bash scripts/evaluacion/cadena_modelos.sh gemma4:e4b phi4-mini smollm3:3b   (Ollama CPU en :11500)
export OLLAMA_HOST=127.0.0.1:11500 GYM_OLLAMA_URL=http://127.0.0.1:11500 PYTHONIOENCODING=utf-8
cd "$(dirname "$0")/../.." || exit 1
for m in "$@"; do
  echo "=== $m: descarga"
  if ! ollama pull "$m" > "/tmp/pull_${m//[:\/]/_}.txt" 2>&1; then echo "=== $m: NO SE PUDO DESCARGAR (omitido)"; tail -c 200 "/tmp/pull_${m//[:\/]/_}.txt"; continue; fi
  ollama list | grep -F "${m%%:*}"
  ./venv-ocr/Scripts/python.exe scripts/evaluacion/eval_modelos.py evaluar "$m" > "/tmp/ev_${m//[:\/]/_}.txt" 2>&1
  tail -1 "/tmp/ev_${m//[:\/]/_}.txt" | cut -c1-400
  ollama rm "$m"
done
echo "=== CADENA TERMINADA"
