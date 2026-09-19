"""
PRUEBA B: reutiliza la tabla reconstruida posicionalmente (Prueba A) y manda
SOLO las filas ambiguas al LLM (qwen2.5:3b), en vez del texto OCR completo.

Uso:
    venv-ocr\\Scripts\\python.exe scripts\\test_llm_ambiguous.py <imagen.positional.json>
"""
import sys
import json
import time
import re
import urllib.request
from pathlib import Path


def is_ambiguous(row, name_word_limit=7, multi_number_in_col=True):
    joined = " ".join(row)
    n_dollars = joined.count("$")
    has_digit = bool(re.search(r"\d", joined))

    # Regla original 1: mas de un precio => probablemente varios productos fusionados
    if n_dollars > 1:
        return True, "multiples $ en la fila"

    # Regla original 2: sin ningun digito y no es encabezado conocido => nota marginal / ruido
    if not has_digit and joined.strip() and "DESCRIPCION" not in joined and "CANTIDA" not in joined:
        return True, "sin digitos, probable nota marginal"

    # Regla nueva 1: alguna columna individual tiene 2+ numeros sueltos separados por espacio
    # (ej. "1 5 5 3 3 3 3" => varias cantidades de distintos productos en una sola celda)
    if multi_number_in_col:
        for cell in row:
            numbers = re.findall(r"(?<!\S)\d+(?:\.\d+)?(?!\S)", cell)
            if len(numbers) >= 2:
                return True, f"columna con {len(numbers)} numeros sueltos: '{cell}'"

    # Regla nueva 2: nombre reconstruido sospechosamente largo => fusion de varios productos
    for cell in row:
        # solo columnas con texto (no solo numeros/simbolos)
        if re.search(r"[A-Za-z]{3,}", cell):
            n_words = len(cell.split())
            if n_words > name_word_limit:
                return True, f"columna con {n_words} palabras (posible fusion de nombres): '{cell}'"

    # Regla nueva 3: patron "$...texto...$" con texto de producto entre dos $ NO consecutivos
    # (indica 2+ precios separados por el nombre de un producto => fusion)
    if re.search(r"\$[^$]*[A-Za-z]{3,}[^$]*\$", joined):
        return True, "patron $...texto...$ detectado (precios con producto entre medio)"

    return False, None


def call_ollama(prompt, model="qwen2.5:3b"):
    body = json.dumps({
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0},
    }).encode("utf-8")
    req = urllib.request.Request(
        "http://localhost:11434/api/generate",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    t0 = time.perf_counter()
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    t1 = time.perf_counter()
    return data, t1 - t0


def main():
    if len(sys.argv) < 2:
        print("Uso: python test_llm_ambiguous.py <imagen.positional.json>")
        sys.exit(1)

    json_path = Path(sys.argv[1])
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    table = data["table"]
    rows_raw = data.get("rows_raw")
    n_lines = data.get("n_lines", len(table))
    n_rows = data.get("n_rows", len(table))
    ratio = n_lines / n_rows if n_rows else 0

    # Regla 4 (red de seguridad global): si la proporcion lineas-crudas/filas-reconstruidas
    # es muy alta, sospechamos que hubo fusiones de mas en TODA la imagen, y bajamos el
    # umbral de sensibilidad (mas estricto) para todas las filas de esta imagen.
    RATIO_THRESHOLD = 4.0
    global_suspicion = ratio > RATIO_THRESHOLD
    name_word_limit = 5 if global_suspicion else 7

    print(f"Lineas OCR crudas: {n_lines}  |  Filas reconstruidas: {n_rows}  |  Ratio: {ratio:.2f}")
    if global_suspicion:
        print(f"ALERTA GLOBAL: ratio > {RATIO_THRESHOLD} -> sensibilidad aumentada para toda la imagen "
              f"(limite de palabras por nombre bajado a {name_word_limit})")
    print()

    ambiguous_indices = []
    clear_rows = []
    reasons = []
    for i, row in enumerate(table):
        amb, reason = is_ambiguous(row, name_word_limit=name_word_limit)
        if amb:
            ambiguous_indices.append(i)
            reasons.append(reason)
        else:
            clear_rows.append(row)

    print(f"Filas totales: {len(table)}")
    print(f"Filas AMBIGUAS (van al LLM): {len(ambiguous_indices)}")
    print(f"Filas CLARAS (se resuelven sin LLM, ya estan en formato tabla): {len(clear_rows)}")
    print()
    print("Filas ambiguas (con motivo):")
    for i, reason in zip(ambiguous_indices, reasons):
        print(f" - [{reason}] {table[i]}")

    # En vez de mandar la celda ya fusionada (que perdio orden/posicion), mandamos
    # las lineas OCR crudas originales que Prueba A agrupo para formar esa fila,
    # con sus coordenadas x,y, para que el LLM pueda usarlas para des-mezclar productos.
    groups_text = []
    for gi, i in enumerate(ambiguous_indices):
        raw_lines = rows_raw[i] if rows_raw else []
        lines_repr = "\n".join(
            f'    {{"texto": "{it["text"]}", "x": {int(it["x1"])}, "y": {int(it["y1"])}}}'
            for it in raw_lines
        )
        groups_text.append(f"Grupo {gi+1}:\n{lines_repr}")

    groups_block = "\n\n".join(groups_text)

    prompt = f"""Estos son grupos de fragmentos de texto detectados por OCR en una foto de una
lista de inventario (tienda de abarrotes/bebidas). El sistema no pudo determinar automaticamente
si cada grupo corresponde a UN solo producto o a VARIOS productos mezclados por error.

Cada fragmento tiene su texto y su posicion en la imagen: "x" (columna, de izquierda a derecha)
e "y" (fila, de arriba hacia abajo, en pixeles). Usa la posicion para razonar: fragmentos con
"y" parecido y "x" creciente suelen pertenecer a la MISMA fila/producto (nombre, luego cantidad,
luego precio). Si dentro de un grupo hay fragmentos con "y" claramente distinto (saltos grandes),
probablemente son PRODUCTOS DISTINTOS que quedaron agrupados por error.

Para cada grupo, devuelve los productos que puedas identificar con confianza razonable. Si un
grupo esta demasiado mezclado como para separar los productos y sus cantidades con confianza,
NO inventes valores: devuelve ese producto con "cantidad": null y "revisar_manualmente": true.

Devuelve SOLO un JSON: una lista de objetos con "nombre", "cantidad" (numero o null) y
"revisar_manualmente" (true/false). No expliques nada, solo el JSON.

{groups_block}
"""

    print("\nLlamando a qwen2.5:3b con lineas crudas + coordenadas (temperature=0)...")
    result, elapsed = call_ollama(prompt)

    print("\n=== RESPUESTA DEL MODELO ===")
    print(result["response"])
    print("\n=== TIEMPOS ===")
    print(f"Total (medido externamente): {elapsed:.2f}s")
    print(f"Total (reportado por ollama): {result['total_duration']/1e9:.2f}s")
    print(f"Eval (generacion): {result['eval_duration']/1e9:.2f}s")
    print(f"Tokens generados: {result['eval_count']}")


if __name__ == "__main__":
    main()
