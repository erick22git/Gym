"""
PRUEBA C: divide el texto OCR en bloques de ~N lineas y llama a qwen2.5:3b
una vez por bloque, sumando el tiempo total. Compara contra la llamada unica
de 235.6s sobre las 125 lineas completas.

Uso:
    venv-ocr\\Scripts\\python.exe scripts\\test_chunking.py <ocr.txt> [chunk_size]
"""
import sys
import json
import time
import urllib.request
from pathlib import Path


def call_ollama(prompt, model="qwen2.5:3b"):
    body = json.dumps({"model": model, "prompt": prompt, "stream": False}).encode("utf-8")
    req = urllib.request.Request(
        "http://localhost:11434/api/generate",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    if len(sys.argv) < 2:
        print("Uso: python test_chunking.py <ocr.txt> [chunk_size]")
        sys.exit(1)

    ocr_path = Path(sys.argv[1])
    chunk_size = int(sys.argv[2]) if len(sys.argv) > 2 else 10

    lines = [l for l in ocr_path.read_text(encoding="utf-8").splitlines() if l.strip()]
    chunks = [lines[i:i + chunk_size] for i in range(0, len(lines), chunk_size)]

    print(f"Total lineas: {len(lines)}  |  Bloques de {chunk_size}: {len(chunks)}")

    all_items = []
    total_time = 0.0
    total_tokens = 0

    for i, chunk in enumerate(chunks):
        chunk_text = "\n".join(chunk)
        prompt = f"""Este es un fragmento de texto extraido por OCR de una lista de inventario
(puede tener errores de lectura, y puede empezar o terminar a mitad de un producto).
Organiza lo que puedas identificar como una lista JSON con campos "nombre" y "cantidad".
Si un numero no tiene claro a que producto pertenece, ignoralo. Responde SOLO con el JSON.

Fragmento:
{chunk_text}
"""
        t0 = time.perf_counter()
        result = call_ollama(prompt)
        t1 = time.perf_counter()
        elapsed = t1 - t0
        total_time += elapsed
        total_tokens += result.get("eval_count", 0)

        print(f"\n--- Bloque {i+1}/{len(chunks)} ({len(chunk)} lineas) - {elapsed:.2f}s ---")
        print(result["response"])
        all_items.append(result["response"])

    print("\n" + "=" * 60)
    print(f"TIEMPO TOTAL (suma de {len(chunks)} bloques): {total_time:.2f}s")
    print(f"Tokens totales generados: {total_tokens}")


if __name__ == "__main__":
    main()
