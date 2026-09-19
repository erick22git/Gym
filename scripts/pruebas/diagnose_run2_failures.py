"""
Diagnostico de por que fallaron los 10 grupos moderados en la corrida real del
endpoint (service_result2.json). No tenemos el "lineas_origen" crudo de esa
llamada (el servicio no lo persiste), pero las lineas OCR crudas por grupo son
deterministas (mismo positional.json), asi que comparamos nombre_sugerido /
cantidad_sugerida contra lo que existia en cada grupo para inferir el patron.
"""
import json
import re

with open(r"C:\Erick\Gym\scripts\test_images\1.positional.json", "r", encoding="utf-8") as f:
    pos = json.load(f)
with open(r"C:\Erick\Gym\scripts\test_images\service_result2.json", "r", encoding="utf-8") as f:
    result = json.load(f)

table = pos["table"]
rows_raw = pos["rows_raw"]
n_lines = pos["n_lines"]
n_rows = pos["n_rows"]
ratio = n_lines / n_rows
name_word_limit = 5 if ratio > 4.0 else 7


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


moderate_idx = [i for i, row in enumerate(table)
                 if is_ambiguous(row, name_word_limit) and len(rows_raw[i]) <= 5]

rev_by_id = {r["id"]: r for r in result["requiere_revision"]}

print(f"{len(moderate_idx)} grupos moderados en esta imagen (deben ser 10)\n")

categories = {"no_se_autocita": 0, "cantidad_no_asignada": 0, "cantidad_probablemente_incorrecta": 0, "otro": 0}

for gi, i in enumerate(moderate_idx):
    key = f"grupo_{gi}"
    rev = rev_by_id.get(key)
    raw_texts = [it["text"] for it in rows_raw[i]]
    print(f"--- {key} (fila {i}) ---")
    print(f"  Lineas crudas: {raw_texts}")
    if not rev:
        print("  (no aparece en requiere_revision => paso cobertura OK)")
        continue

    nombre = rev["nombre_sugerido"]
    cantidad = rev["cantidad_sugerida"]
    print(f"  Salida LLM: nombre='{nombre}', cantidad={cantidad}")

    # Heuristica de clasificacion:
    numeric_lines = [t for t in raw_texts if re.fullmatch(r"[\d.\s$]+", t) and re.search(r"\d", t)]
    text_lines = [t for t in raw_texts if re.search(r"[A-Za-z]{2,}", t)]

    if nombre and any(nombre.strip() == t.strip() for t in text_lines) and cantidad is None and numeric_lines:
        cat = "no_se_autocita"
        motivo = f"nombre coincide EXACTO con una linea cruda de texto, pero no se refirio a la(s) linea(s) numerica(s) {numeric_lines} para la cantidad"
    elif nombre and cantidad is None and not numeric_lines:
        cat = "otro"
        motivo = "no hay ninguna linea numerica en el grupo (posible nota/encabezado, cantidad null es razonable pero igual falto autocitarse)"
    elif nombre and cantidad is not None:
        cat = "cantidad_probablemente_incorrecta"
        motivo = f"si devolvio cantidad ({cantidad}) pero igual fallo cobertura => no cito alguna linea (posible $ o duplicado)"
    else:
        cat = "otro"
        motivo = "patron no reconocido automaticamente, revisar manualmente"

    categories[cat] += 1
    print(f"  Categoria: {cat}  ({motivo})")
    print()

print("=" * 60)
print("RESUMEN DE CATEGORIAS (10 grupos):")
for cat, n in categories.items():
    print(f"  {cat}: {n}  ({n*10}%)")
