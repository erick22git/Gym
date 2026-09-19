"""
Prueba: en vez de mandar los 10 grupos ambiguos en UN solo prompt (batch), se
manda UNA llamada por grupo (10 llamadas separadas), cada una solo con las
lineas OCR crudas de ESE grupo (sin numero de grupo, no hace falta).
Elimina por diseño la posibilidad de desalineacion de indice de grupo.

Uso:
    venv-ocr\\Scripts\\python.exe scripts\\test_llm_per_group.py
"""
import json
import re
import time
import urllib.request

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "qwen2.5:3b"


def call_ollama(prompt):
    body = json.dumps({
        "model": OLLAMA_MODEL, "prompt": prompt, "stream": False,
        "options": {"temperature": 0},
    }).encode("utf-8")
    req = urllib.request.Request(OLLAMA_URL, data=body, headers={"Content-Type": "application/json"})
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=300) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    t1 = time.perf_counter()
    return data, t1 - t0


def extract_json_obj_or_array(text):
    m = re.search(r"(\[.*\]|\{.*\})", text, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


def is_informative(text):
    return bool(re.search(r"[A-Za-z0-9]", text))


def is_ambiguous(row, name_word_limit=7):
    joined = " ".join(row)
    if joined.count("$") > 1:
        return True
    has_digit = bool(re.search(r"\d", joined))
    if not has_digit and joined.strip() and "DESCRIPCION" not in joined and "CANTIDA" not in joined:
        return True
    for cell in row:
        if len(re.findall(r"(?<!\S)\d+(?:\.\d+)?(?!\S)", cell)) >= 2:
            return True
    for cell in row:
        if re.search(r"[A-Za-z]{3,}", cell) and len(cell.split()) > name_word_limit:
            return True
    if re.search(r"\$[^$]*[A-Za-z]{3,}[^$]*\$", joined):
        return True
    return False


with open(r"C:\Erick\Gym\scripts\test_images\1.positional.json", "r", encoding="utf-8") as f:
    pos = json.load(f)

table = pos["table"]
rows_raw = pos["rows_raw"]
ratio = pos["n_lines"] / pos["n_rows"]
name_word_limit = 5 if ratio > 4.0 else 7
EXTREME_FUSION_THRESHOLD = 5

moderate_idx = [i for i, row in enumerate(table)
                 if is_ambiguous(row, name_word_limit) and len(rows_raw[i]) <= EXTREME_FUSION_THRESHOLD]

print(f"Grupos moderados a probar: {len(moderate_idx)} (filas {moderate_idx})\n")

results = []
total_time = 0.0
total_tokens = 0
pass_count = 0
categories = {"ok": 0, "no_se_autocita": 0, "otro": 0}

for gi, i in enumerate(moderate_idx):
    raw_lines = rows_raw[i]
    n_raw = len(raw_lines)
    lines_repr = "\n".join(
        f'  [{li}] "{it["text"]}" @x={int(it["x1"])},y={int(it["y1"])}'
        for li, it in enumerate(raw_lines)
    )

    prompt = f"""Estos son fragmentos de texto detectados por OCR en una foto de una lista de
inventario (tienda de abarrotes/bebidas). Podrian ser un solo producto o varios productos
mezclados por error. Formato de cada fragmento: "texto" @x=columna,y=fila (pixeles).

Fragmentos (indices de 0 a {n_raw-1}):
{lines_repr}

Identifica el/los producto(s) que representan estos fragmentos, con su cantidad si se puede
determinar. Para CADA producto que devuelvas, DEBES incluir "lineas_origen": la lista de
TODOS los indices de fragmentos que usaste para llegar a ese producto (nombre y cantidad),
incluyendo los que sean solo numeros o "$" si los usaste. Si un fragmento no lo pudiste usar
para nada, igual debes decidir a que producto pertenece o marcarlo aparte con "nombre":
"SIN_IDENTIFICAR". No inventes cantidades sin respaldo en un fragmento.

Devuelve SOLO un JSON: una lista de objetos con "nombre", "cantidad" (numero o null) y
"lineas_origen" (lista de numeros). No expliques nada, solo el JSON.
"""

    result, elapsed = call_ollama(prompt)
    total_time += elapsed
    total_tokens += result.get("eval_count", 0)

    parsed = extract_json_obj_or_array(result.get("response", "")) or []
    if isinstance(parsed, dict):
        parsed = [parsed]

    covered = set()
    for it in parsed:
        for idx in it.get("lineas_origen", []) or []:
            covered.add(idx)
    expected = {idx for idx in range(n_raw) if is_informative(raw_lines[idx]["text"])}
    missing = expected - covered

    status = "OK" if not missing and parsed else "FALLA"
    if status == "OK":
        pass_count += 1
        categories["ok"] += 1
        cat = "ok"
    else:
        # clasificar tipo de falla
        names_out = [it.get("nombre", "") for it in parsed]
        text_lines = [t["text"] for t in raw_lines if re.search(r"[A-Za-z]{2,}", t["text"])]
        if parsed and any(n and any(n.strip() == t.strip() for t in text_lines) for n in names_out):
            cat = "no_se_autocita"
        else:
            cat = "otro"
        categories[cat] += 1

    print(f"--- grupo_{gi} (fila {i}) [{elapsed:.1f}s] -> {status} ({cat if status=='FALLA' else ''}) ---")
    print(f"  Lineas: {[t['text'] for t in raw_lines]}")
    print(f"  Respuesta: {parsed}")
    if missing:
        print(f"  Faltan (informativos): {[raw_lines[m]['text'] for m in sorted(missing)]}")
    print()

    results.append({"grupo": gi, "fila": i, "status": status, "categoria": cat if status == "FALLA" else None,
                     "tiempo": elapsed, "parsed": parsed})

print("=" * 70)
print(f"TOTAL: {pass_count}/{len(moderate_idx)} grupos pasan cobertura")
print(f"Tiempo total (suma de {len(moderate_idx)} llamadas): {total_time:.2f}s")
print(f"Tokens totales: {total_tokens}")
print(f"Categorias de fallo: {categories}")

with open(r"C:\Erick\Gym\scripts\test_images\per_group_results.json", "w", encoding="utf-8") as f:
    json.dump({"pass_count": pass_count, "total": len(moderate_idx), "total_time": total_time,
               "total_tokens": total_tokens, "categories": categories, "results": results},
              f, ensure_ascii=False, indent=2)
