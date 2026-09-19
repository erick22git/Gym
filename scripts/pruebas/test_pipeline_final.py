"""
Pipeline A+B con 3 mejoras:
1. Verificacion de cobertura: el LLM debe declarar "lineas_origen" por producto;
   si alguna linea cruda del grupo no queda referenciada, la fila completa se
   marca revisar_manualmente=True (no se descarta nada en silencio).
2. Umbral de fusion extrema: filas con mas de 5 lineas OCR crudas agrupadas van
   DIRECTO a revision humana, sin pasar por el LLM.
3. Formato compacto de prompt: "texto" @y=NNN en vez de JSON-como-texto, para
   bajar tokens en las filas moderadas que si van al LLM.

Uso:
    venv-ocr\\Scripts\\python.exe scripts\\test_pipeline_final.py <imagen.positional.json>
"""
import sys
import json
import time
import re
import urllib.request
from pathlib import Path

EXTREME_FUSION_THRESHOLD = 5


def is_ambiguous(row, name_word_limit=7):
    joined = " ".join(row)
    n_dollars = joined.count("$")
    has_digit = bool(re.search(r"\d", joined))

    if n_dollars > 1:
        return True, "multiples $ en la fila"
    if not has_digit and joined.strip() and "DESCRIPCION" not in joined and "CANTIDA" not in joined:
        return True, "sin digitos, probable nota marginal"
    for cell in row:
        numbers = re.findall(r"(?<!\S)\d+(?:\.\d+)?(?!\S)", cell)
        if len(numbers) >= 2:
            return True, f"columna con {len(numbers)} numeros sueltos: '{cell}'"
    for cell in row:
        if re.search(r"[A-Za-z]{3,}", cell):
            n_words = len(cell.split())
            if n_words > name_word_limit:
                return True, f"columna con {n_words} palabras (posible fusion de nombres): '{cell}'"
    if re.search(r"\$[^$]*[A-Za-z]{3,}[^$]*\$", joined):
        return True, "patron $...texto...$ detectado"
    return False, None


def call_ollama(prompt, model="qwen2.5:3b"):
    body = json.dumps({
        "model": model, "prompt": prompt, "stream": False,
        "options": {"temperature": 0},
    }).encode("utf-8")
    req = urllib.request.Request(
        "http://localhost:11434/api/generate", data=body,
        headers={"Content-Type": "application/json"},
    )
    t0 = time.perf_counter()
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    t1 = time.perf_counter()
    return data, t1 - t0


def extract_json(text):
    m = re.search(r"\[.*\]", text, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


def main():
    if len(sys.argv) < 2:
        print("Uso: python test_pipeline_final.py <imagen.positional.json>")
        sys.exit(1)

    json_path = Path(sys.argv[1])
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    table = data["table"]
    rows_raw = data["rows_raw"]
    n_lines = data.get("n_lines", len(table))
    n_rows = data.get("n_rows", len(table))
    ratio = n_lines / n_rows if n_rows else 0

    RATIO_THRESHOLD = 4.0
    global_suspicion = ratio > RATIO_THRESHOLD
    name_word_limit = 5 if global_suspicion else 7

    print(f"Lineas OCR crudas: {n_lines}  |  Filas reconstruidas: {n_rows}  |  Ratio: {ratio:.2f}")
    if global_suspicion:
        print(f"ALERTA GLOBAL activa (limite palabras={name_word_limit})")

    clear_rows = []          # ya resueltas por posicion, sin ambiguedad
    human_review = []        # van directo a cola humana (nunca al LLM, o fallaron cobertura)
    llm_moderate_idx = []    # indices que se mandan al LLM (grupos <=5 lineas)

    for i, row in enumerate(table):
        amb, reason = is_ambiguous(row, name_word_limit=name_word_limit)
        if not amb:
            clear_rows.append((i, row))
            continue
        n_raw = len(rows_raw[i])
        if n_raw > EXTREME_FUSION_THRESHOLD:
            human_review.append({
                "fila_idx": i, "motivo": f"fusion extrema ({n_raw} lineas crudas > {EXTREME_FUSION_THRESHOLD})",
                "lineas_crudas": [it["text"] for it in rows_raw[i]],
            })
        else:
            llm_moderate_idx.append(i)

    print(f"\nFilas totales: {len(table)}")
    print(f"  - Claras (sin LLM, ya en tabla): {len(clear_rows)}")
    print(f"  - Fusion extrema -> revision humana directa (sin pasar por LLM): {len(human_review)}")
    print(f"  - Moderadas -> se mandan al LLM ({EXTREME_FUSION_THRESHOLD} lineas o menos): {len(llm_moderate_idx)}")

    print("\nFilas de fusion extrema (NO pasan por LLM):")
    for hr in human_review:
        print(f"  Fila {hr['fila_idx']}: {hr['motivo']}")
        print(f"    lineas: {hr['lineas_crudas']}")

    llm_results = []
    total_llm_time = 0.0
    total_tokens = 0

    if llm_moderate_idx:
        # Formato compacto: "texto" @y=NNN,x=NNN, una linea por fragmento,
        # con indice local dentro del grupo para poder pedir "lineas_origen".
        groups_text = []
        for gi, i in enumerate(llm_moderate_idx):
            raw_lines = rows_raw[i]
            lines_repr = "\n".join(
                f'  [{li}] "{it["text"]}" @x={int(it["x1"])},y={int(it["y1"])}'
                for li, it in enumerate(raw_lines)
            )
            groups_text.append(f"Grupo {gi} (indices de linea 0 a {len(raw_lines)-1}):\n{lines_repr}")
        groups_block = "\n\n".join(groups_text)

        prompt = f"""Fragmentos de texto de OCR de una lista de inventario (tienda de abarrotes),
agrupados en grupos que podrian ser 1 o varios productos mezclados por error. Formato de cada
fragmento: "texto" @x=columna,y=fila (pixeles).

Para cada grupo, identifica los productos y sus cantidades. Para CADA producto que devuelvas,
DEBES incluir "lineas_origen": la lista de indices [entre corchetes] de los fragmentos de ESE
grupo que usaste para armar ese producto (nombre y cantidad). Es obligatorio: toda linea del
grupo debe quedar referenciada por al menos un producto, incluidas las lineas que sean solo
numeros o "$" si las usaste para inferir una cantidad o si no supiste que hacer con ellas
(en ese caso, agrupalas en un producto con "nombre": "SIN_IDENTIFICAR" y "cantidad": null).

No inventes cantidades que no esten respaldadas por una linea del grupo.

Devuelve SOLO un JSON: lista de objetos con "grupo" (numero de grupo), "nombre", "cantidad"
(numero o null) y "lineas_origen" (lista de numeros). No expliques nada, solo el JSON.

{groups_block}
"""

        print("\nLlamando a qwen2.5:3b (formato compacto, temperature=0)...")
        result, elapsed = call_ollama(prompt)
        total_llm_time += elapsed
        total_tokens += result.get("eval_count", 0)

        print(f"Tiempo de esta llamada: {elapsed:.2f}s | tokens: {result.get('eval_count')}")
        print("\n=== RESPUESTA CRUDA ===")
        print(result["response"])

        parsed = extract_json(result["response"]) or []

        # --- Verificacion de cobertura por grupo ---
        by_group = {}
        for item in parsed:
            g = item.get("grupo")
            by_group.setdefault(g, []).append(item)

        print("\n=== VERIFICACION DE COBERTURA ===")

        def is_informative(text):
            # Solo exigimos cobertura para fragmentos con al menos un digito o letra.
            # Simbolos sueltos ($ , - . etc) no aportan informacion y no cuentan como "perdidos".
            return bool(re.search(r"[A-Za-z0-9]", text))

        for gi, i in enumerate(llm_moderate_idx):
            n_raw = len(rows_raw[i])
            items = by_group.get(gi, [])
            covered = set()
            for it in items:
                for idx in it.get("lineas_origen", []) or []:
                    covered.add(idx)
            expected = {idx for idx in range(n_raw) if is_informative(rows_raw[i][idx]["text"])}
            missing = expected - covered

            if missing:
                missing_texts = [rows_raw[i][m]["text"] for m in sorted(missing)]
                print(f"Grupo {gi} (fila {i}): *** COBERTURA INCOMPLETA *** "
                      f"faltan indices {sorted(missing)} = {missing_texts}")
                print(f"  -> Fila {i} marcada COMPLETA como revisar_manualmente (no se confia en el resultado parcial)")
                human_review.append({
                    "fila_idx": i,
                    "motivo": f"cobertura incompleta: faltan lineas {missing_texts}",
                    "lineas_crudas": [it["text"] for it in rows_raw[i]],
                })
            else:
                print(f"Grupo {gi} (fila {i}): cobertura OK "
                      f"({len(covered & expected)}/{len(expected)} lineas informativas referenciadas, "
                      f"{n_raw - len(expected)} simbolos sueltos ignorados)")
                for it in items:
                    llm_results.append(it)

    print("\n" + "=" * 70)
    print("RESUMEN FINAL")
    print("=" * 70)
    print(f"Filas claras (sin LLM):            {len(clear_rows)}")
    print(f"Filas resueltas por LLM (cobertura OK): {len(set(r.get('grupo') for r in llm_results)) if llm_results else 0} grupos "
          f"-> {len(llm_results)} productos")
    print(f"Filas a revision humana directa:   {len(human_review)}")
    print(f"Tiempo total LLM:                  {total_llm_time:.2f}s")
    print(f"Tokens generados:                  {total_tokens}")

    out = {
        "clear_rows": [row for _, row in clear_rows],
        "llm_results": llm_results,
        "human_review": human_review,
        "total_llm_time": total_llm_time,
        "total_tokens": total_tokens,
    }
    out_path = json_path.with_suffix(".pipeline_final.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"\nGuardado en: {out_path}")


if __name__ == "__main__":
    main()
