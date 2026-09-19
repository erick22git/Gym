"""
Re-corre SOLO la verificacion de cobertura (con el ajuste de ignorar simbolos
sueltos) sobre la MISMA respuesta del LLM ya obtenida en la corrida anterior
(pipeline_final.txt), para comparar antes/despues sin introducir varianza de
una nueva llamada al modelo.
"""
import json
import re
from pathlib import Path

llm_moderate_idx = [1, 3, 4, 5, 6, 12, 15, 20, 24, 25, 27, 28]
# nota: se reconstruye abajo desde el propio positional.json + misma logica
# de deteccion para no hardcodear mal; ver bloque de abajo.

with open(r"C:\Erick\Gym\scripts\test_images\1.positional.json", "r", encoding="utf-8") as f:
    data = json.load(f)

table = data["table"]
rows_raw = data["rows_raw"]
n_lines = data.get("n_lines", len(table))
n_rows = data.get("n_rows", len(table))
ratio = n_lines / n_rows if n_rows else 0
RATIO_THRESHOLD = 4.0
global_suspicion = ratio > RATIO_THRESHOLD
name_word_limit = 5 if global_suspicion else 7
EXTREME_FUSION_THRESHOLD = 5


def is_ambiguous(row, name_word_limit=7):
    joined = " ".join(row)
    n_dollars = joined.count("$")
    has_digit = bool(re.search(r"\d", joined))
    if n_dollars > 1:
        return True
    if not has_digit and joined.strip() and "DESCRIPCION" not in joined and "CANTIDA" not in joined:
        return True
    for cell in row:
        numbers = re.findall(r"(?<!\S)\d+(?:\.\d+)?(?!\S)", cell)
        if len(numbers) >= 2:
            return True
    for cell in row:
        if re.search(r"[A-Za-z]{3,}", cell):
            if len(cell.split()) > name_word_limit:
                return True
    if re.search(r"\$[^$]*[A-Za-z]{3,}[^$]*\$", joined):
        return True
    return False


llm_moderate_idx = []
extreme_idx = []
clear_idx = []
for i, row in enumerate(table):
    if not is_ambiguous(row, name_word_limit=name_word_limit):
        clear_idx.append(i)
        continue
    if len(rows_raw[i]) > EXTREME_FUSION_THRESHOLD:
        extreme_idx.append(i)
    else:
        llm_moderate_idx.append(i)

print(f"Claras: {len(clear_idx)}  Extremas: {len(extreme_idx)}  Moderadas->LLM: {len(llm_moderate_idx)}")
assert len(llm_moderate_idx) == 10, f"esperaba 10 grupos moderados, hay {len(llm_moderate_idx)}: {llm_moderate_idx}"

# Respuesta CRUDA ya obtenida del LLM en la corrida anterior (pipeline_final.txt), sin cambios.
llm_response_raw = """
[
  {
    "grupo": 0,
    "nombre": "Botella de agua mineral perrier de 4 pzs",
    "cantidad": null,
    "lineas_origen": [0, 1, 2, 3]
  },
  {
    "grupo": 1,
    "nombre": "Coca cola lightde 12 pzas 355 ml",
    "cantidad": null,
    "lineas_origen": [0, 1]
  },
  {
    "grupo": 2,
    "nombre": "Coca cola lightde pieza 355 ml",
    "cantidad": null,
    "lineas_origen": [0, 1, 2]
  },
  {
    "grupo": 3,
    "nombre": "SURTIDO DE BOTANA DE 50 PZAS",
    "cantidad": 1,
    "lineas_origen": [0]
  },
  {
    "grupo": 4,
    "nombre": "SEMILLAS VARIOS 850 GR",
    "cantidad": null,
    "lineas_origen": [0, 1, 2]
  },
  {
    "grupo": 5,
    "nombre": "CUCHARAS GREAT VALUE DE 30 PIEZAS",
    "cantidad": null,
    "lineas_origen": [1]
  },
  {
    "grupo": 6,
    "nombre": "VASOS DESECHABLES PRREMIUM",
    "cantidad": null,
    "lineas_origen": [1]
  },
  {
    "grupo": 7,
    "nombre": "TOTAL",
    "cantidad": null,
    "lineas_origen": [0]
  },
  {
    "grupo": 8,
    "nombre": "jjego)",
    "cantidad": null,
    "lineas_origen": [0]
  },
  {
    "grupo": 9,
    "nombre": "decobvertos",
    "cantidad": null,
    "lineas_origen": [0]
  }
]
"""
parsed = json.loads(llm_response_raw)

by_group = {}
for item in parsed:
    by_group.setdefault(item.get("grupo"), []).append(item)


def is_informative(text):
    return bool(re.search(r"[A-Za-z0-9]", text))


print("\n=== VERIFICACION DE COBERTURA (ajustada: ignora simbolos sueltos) ===")
newly_passing = []
still_failing = []
resolved_items = []

for gi, i in enumerate(llm_moderate_idx):
    n_raw = len(rows_raw[i])
    items = by_group.get(gi, [])
    covered = set()
    for it in items:
        for idx in it.get("lineas_origen", []) or []:
            covered.add(idx)
    expected = {idx for idx in range(n_raw) if is_informative(rows_raw[i][idx]["text"])}
    ignored = n_raw - len(expected)
    missing = expected - covered

    if missing:
        missing_texts = [rows_raw[i][m]["text"] for m in sorted(missing)]
        print(f"Grupo {gi} (fila {i}): *** SIGUE FALLANDO *** faltan (informativos) {missing_texts}")
        still_failing.append((gi, i, missing_texts))
    else:
        print(f"Grupo {gi} (fila {i}): cobertura OK "
              f"({len(covered & expected)}/{len(expected)} informativos referenciados, "
              f"{ignored} simbolos sueltos ignorados)")
        newly_passing.append((gi, i))
        resolved_items.extend(items)

print("\n" + "=" * 70)
print(f"ANTES (estricto, contaba simbolos): 3/10 grupos pasaban cobertura")
print(f"AHORA (ignora simbolos sueltos):     {len(newly_passing)}/10 grupos pasan cobertura")
print(f"Grupos que pasaron gracias al ajuste: {[gi for gi, i in newly_passing if gi not in (7, 8, 9)]}")
print(f"Grupos que siguen fallando (por texto/numero real faltante): {[gi for gi, i, _ in still_failing]}")

n_clear = len(clear_idx)
n_extreme = len(extreme_idx)
n_llm_ok = len(newly_passing)
n_human = n_extreme + len(still_failing)

print(f"\nRESUMEN FINAL AJUSTADO:")
print(f"  Claras (sin LLM): {n_clear}")
print(f"  Resueltas por LLM (cobertura OK): {n_llm_ok} grupos -> {len(resolved_items)} productos")
print(f"  A revision humana: {n_human}  ({n_extreme} por fusion extrema + {len(still_failing)} por cobertura incompleta real)")
print(f"  Total filas: {n_clear + n_llm_ok + n_human} (deberia ser 29)")
