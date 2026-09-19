"""
Aplica los 2 filtros de calidad de contenido (ademas de la cobertura ya
existente) sobre:
  (a) el batch original (formato compacto, 10 grupos en 1 prompt) - dataset
      ya usado en pipeline_final.txt / retest_coverage_only.py
  (b) la corrida "individual por grupo" (10 prompts separados) - dataset de
      per_group_run.txt

No se vuelve a llamar al LLM: se reusan las respuestas ya obtenidas para
aislar el efecto de la logica de verificacion del no-determinismo del modelo.
"""
import json
import re

with open(r"C:\Erick\Gym\scripts\test_images\1.positional.json", "r", encoding="utf-8") as f:
    pos = json.load(f)
rows_raw = pos["rows_raw"]

ratio = pos["n_lines"] / pos["n_rows"]
name_word_limit = 5 if ratio > 4.0 else 7
EXTREME_FUSION_THRESHOLD = 5


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


table = pos["table"]
moderate_idx = [i for i, row in enumerate(table)
                 if is_ambiguous(row, name_word_limit) and len(rows_raw[i]) <= EXTREME_FUSION_THRESHOLD]
assert len(moderate_idx) == 10


def is_informative(text):
    return bool(re.search(r"[A-Za-z0-9]", text))


def filtro1_nombre_valido(nombre):
    """Rechaza: solo simbolos, numero puro, o generico tipo SIN_IDENTIFICAR."""
    if not nombre:
        return False, "nombre vacio"
    n = nombre.strip()
    if re.fullmatch(r"[\W_]+", n):
        return False, "solo simbolos/puntuacion"
    if re.fullmatch(r"\d+(\.\d+)?", n):
        return False, "numero puro"
    if n.upper() in ("SIN_IDENTIFICAR", "N/A", "DESCONOCIDO", "SIN IDENTIFICAR"):
        return False, "generico tipo SIN_IDENTIFICAR"
    return True, None


def filtro2_no_reuso_sospechoso(item, raw_lines):
    """Si cantidad no es None, debe estar respaldada por una linea PURAMENTE
    numerica citada en lineas_origen (no un numero embebido dentro del texto
    del nombre, ej. 'de 4 pzs' o 'DE 50 PZAS')."""
    cantidad = item.get("cantidad")
    if cantidad is None:
        return True, None  # no aplica
    origenes = item.get("lineas_origen", []) or []
    for idx in origenes:
        if idx < 0 or idx >= len(raw_lines):
            continue
        text = raw_lines[idx]["text"].strip()
        # linea "puramente numerica" (permite $ opcional pegado, ej. "3 $")
        m = re.fullmatch(r"(\d+(?:\.\d+)?)\s*\$?", text)
        if m and float(m.group(1)) == float(cantidad):
            return True, None
    return False, f"cantidad {cantidad} no respaldada por ninguna linea puramente numerica citada (probable numero embebido en el nombre)"


def evaluar_grupo(items, raw_lines):
    """items: lista de productos que el LLM devolvio para este grupo.
    Devuelve (cobertura_ok, productos_genuinamente_resueltos, detalle_por_item)"""
    n_raw = len(raw_lines)
    covered = set()
    for it in items:
        for idx in it.get("lineas_origen", []) or []:
            covered.add(idx)
    expected = {idx for idx in range(n_raw) if is_informative(raw_lines[idx]["text"])}
    cobertura_ok = not (expected - covered) and bool(items)

    genuinos = []
    detalle = []
    for it in items:
        ok1, motivo1 = filtro1_nombre_valido(it.get("nombre"))
        ok2, motivo2 = filtro2_no_reuso_sospechoso(it, raw_lines)
        tiene_cantidad = it.get("cantidad") is not None
        es_genuino = ok1 and ok2 and tiene_cantidad
        detalle.append({
            "nombre": it.get("nombre"), "cantidad": it.get("cantidad"),
            "filtro1_ok": ok1, "filtro1_motivo": motivo1,
            "filtro2_ok": ok2, "filtro2_motivo": motivo2,
            "tiene_cantidad": tiene_cantidad,
            "genuino": es_genuino,
        })
        if es_genuino:
            genuinos.append(it)
    return cobertura_ok, genuinos, detalle


# --- Dataset (a): BATCH original (formato compacto, 1 prompt para 10 grupos) ---
batch_response = [
    {"grupo": 0, "nombre": "Botella de agua mineral perrier de 4 pzs", "cantidad": None, "lineas_origen": [0, 1, 2, 3]},
    {"grupo": 1, "nombre": "Coca cola lightde 12 pzas 355 ml", "cantidad": None, "lineas_origen": [0, 1]},
    {"grupo": 2, "nombre": "Coca cola lightde pieza 355 ml", "cantidad": None, "lineas_origen": [0, 1, 2]},
    {"grupo": 3, "nombre": "SURTIDO DE BOTANA DE 50 PZAS", "cantidad": 1, "lineas_origen": [0]},
    {"grupo": 4, "nombre": "SEMILLAS VARIOS 850 GR", "cantidad": None, "lineas_origen": [0, 1, 2]},
    {"grupo": 5, "nombre": "CUCHARAS GREAT VALUE DE 30 PIEZAS", "cantidad": None, "lineas_origen": [1]},
    {"grupo": 6, "nombre": "VASOS DESECHABLES PRREMIUM", "cantidad": None, "lineas_origen": [1]},
    {"grupo": 7, "nombre": "TOTAL", "cantidad": None, "lineas_origen": [0]},
    {"grupo": 8, "nombre": "jjego)", "cantidad": None, "lineas_origen": [0]},
    {"grupo": 9, "nombre": "decobvertos", "cantidad": None, "lineas_origen": [0]},
]
batch_by_group = {}
for it in batch_response:
    batch_by_group.setdefault(it["grupo"], []).append(it)

# --- Dataset (b): INDIVIDUAL por grupo (de per_group_run.txt) ---
individual_by_group = {
    0: [{"nombre": "Botella de agua mineral perrier", "cantidad": 4, "lineas_origen": [0]},
        {"nombre": "SIN_IDENTIFICAR", "cantidad": None, "lineas_origen": [1, 2, 3, 4]}],
    1: [{"nombre": "Coca cola light", "cantidad": 2, "lineas_origen": [0, 1]},
        {"nombre": "SIN_IDENTIFICAR", "cantidad": None, "lineas_origen": [2]}],
    2: [{"nombre": "Coca cola lightde pieza 355 ml", "cantidad": 6, "lineas_origen": [0, 2]},
        {"nombre": "SIN_IDENTIFICAR", "cantidad": None, "lineas_origen": [1]}],
    3: [{"nombre": "SURTIDO DE BOTANA DE 50 PZAS", "cantidad": 50, "lineas_origen": [0]},
        {"nombre": "$", "cantidad": None, "lineas_origen": [1]}],
    4: [{"nombre": "SEMILLAS VARIOS", "cantidad": 3, "lineas_origen": [0, 1, 2, 3]},
        {"nombre": "SIN_IDENTIFICAR", "cantidad": None, "lineas_origen": [1, 2]}],
    5: [{"nombre": "CUCHARAS GREAT VALUE DE 30 PIEZAS", "cantidad": 30, "lineas_origen": [0]},
        {"nombre": "VASOS DESECHABLES PRREMIUM", "cantidad": None, "lineas_origen": [1]},
        {"nombre": "5", "cantidad": 5, "lineas_origen": [2]},
        {"nombre": "$", "cantidad": None, "lineas_origen": [3]}],
    6: [{"nombre": "TOTAL", "cantidad": None, "lineas_origen": [0]}],
    7: [{"nombre": "agua", "cantidad": None, "lineas_origen": [0]}],
    8: [{"nombre": "jjego)", "cantidad": None, "lineas_origen": [0]}],
    9: [{"nombre": "decobvertos", "cantidad": None, "lineas_origen": [0]}],
}


def run_eval(name, by_group):
    print(f"\n{'='*70}\n{name}\n{'='*70}")
    n_cobertura_ok = 0
    n_genuinos_total_grupos = 0
    for gi, i in enumerate(moderate_idx):
        raw_lines = rows_raw[i]
        items = by_group.get(gi, [])
        cobertura_ok, genuinos, detalle = evaluar_grupo(items, raw_lines)
        if cobertura_ok:
            n_cobertura_ok += 1
        grupo_genuino = len(genuinos) > 0
        if grupo_genuino:
            n_genuinos_total_grupos += 1

        estado = "GENUINO" if grupo_genuino else ("cobertura OK pero sin producto genuino" if cobertura_ok else "FALLA cobertura")
        print(f"grupo_{gi} (fila {i}): {estado}")
        for d in detalle:
            marcas = []
            if not d["filtro1_ok"]:
                marcas.append(f"FILTRO1:{d['filtro1_motivo']}")
            if not d["filtro2_ok"]:
                marcas.append(f"FILTRO2:{d['filtro2_motivo']}")
            if not d["tiene_cantidad"]:
                marcas.append("sin_cantidad")
            flag = f"  [{'; '.join(marcas)}]" if marcas else "  [OK]"
            print(f"    - {d['nombre']!r} cantidad={d['cantidad']}{flag}")

    print(f"\nCobertura OK (formal): {n_cobertura_ok}/10")
    print(f"GRUPOS con al menos 1 producto GENUINAMENTE resuelto (cobertura + filtro1 + filtro2 + cantidad real): {n_genuinos_total_grupos}/10")
    return n_cobertura_ok, n_genuinos_total_grupos


batch_cov, batch_genuine = run_eval("BATCH (10 grupos en 1 prompt, formato compacto)", batch_by_group)
ind_cov, ind_genuine = run_eval("INDIVIDUAL (1 prompt por grupo)", individual_by_group)

print(f"\n{'='*70}\nRESUMEN COMPARATIVO\n{'='*70}")
print(f"{'Metrica':<45}{'Batch':<10}{'Individual':<10}")
print(f"{'Cobertura formal (pasa el check original)':<45}{batch_cov}/10{'':<7}{ind_cov}/10")
print(f"{'Genuinamente resueltos (3 filtros + cantidad real)':<45}{batch_genuine}/10{'':<7}{ind_genuine}/10")
