"""Verificacion retroactiva: compara las lineas OCR crudas del grupo
'PIZZAS...METALICAS' contra los nombres de producto que salieron en el
JSON de las corridas anteriores (run1/run2), para confirmar si una
verificacion de cobertura habria detectado la omision de
'10 kg de fruta varia de mano'.
"""
import json
import re
import unicodedata


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


with open(r"C:\Erick\Gym\scripts\test_images\1.positional.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# La fila de fusion catastrofica es el indice cuyo texto contiene "PIZZAS HAWAINA"
target_idx = None
for i, row in enumerate(data["table"]):
    if "PIZZAS HAWAINA" in " ".join(row):
        target_idx = i
        break

raw_lines = [it["text"] for it in data["rows_raw"][target_idx]]
print(f"Fila objetivo: indice {target_idx}")
print("Lineas OCR crudas de este grupo:")
for i, t in enumerate(raw_lines):
    print(f"  [{i}] {t}")

outputs = {
    "run1": [
        "Botella de agua mineral topo", "CANTIDA", "PR", "Coca cola de 12 pzas 355 ml",
        "Coca cola de 355 ml pieza", "Agu a santa maria de 6 pzas",
        "Coca cola lightde 12 pzas 355 ml", "Coca cola lightde pieza 355 ml",
        "SURTIDO DE BOTANA DE 50 PZAS", "SEMILLAS VARIOS 850 GR",
        "CUCHARAS GREAT VALUE DE 30 PIEZAS", "VASOS DESECHABLES PRREMIUM",
        "PIZZAS HAWAINA TAMAÑO ITALIANA", "DOMO FRAMBUESA", "DOMO FRESAS",
        "DOMO DE UVA", "BOLSA DE HIELO", "SERVILLETA KLEENEX ELEGANCE",
        "METALICAS", "PlatSno", "CAJA DE 24 BOTELLAS CORONA DE 210 ML·",
        "PIZZA MEXICANA TAMAÑO ITALIANA", "TOTAL",
    ],
    "run2": [
        "Botella de agua mineral topo", "CANTIDA", "PR", "Coca cola de 12 pzas 355 ml",
        "Coca cola de 355 ml pieza", "Agu a santa maria de 6 pzas",
        "Coca cola lightde 12 pzas 355 ml", "Coca cola lightde pieza 355 ml",
        "SURTIDO DE BOTANA DE 50 PZAS", "SEMILLAS VARIOS 850 GR",
        "CUCHARAS GREAT VALUE DE 30 PIEZAS", "VASOS DESECHABLES PRREMIUM",
        "PIZZAS HAWAINA TAMAÑO ITALIANA", "DOMO FRAMBUESA", "DOMO FRESAS",
        "DOMO DE UVA", "BOLSA DE HIELO", "SERVILLETA KLEENEX ELEGANCE",
        "METALICAS", "PlatSno", "CAJA DE 24 BOTELLAS CORONA DE 210 ML·",
        "PAQUETE DE BONELESS DE 50 PZ", "PIZZA MEXICANA TAMAÑO ITALIANA", "TOTAL",
    ],
}

for run_name, out_names in outputs.items():
    print(f"\n=== Cobertura para {run_name} (solo relevante para el grupo PIZZAS...METALICAS) ===")
    normed_out = [norm(n) for n in out_names]
    for i, line in enumerate(raw_lines):
        nline = norm(line)
        # Un fragmento crudo se considera "cubierto" si aparece como substring
        # (en cualquier direccion) de algun nombre de salida.
        covered = any(nline in no or no in nline for no in normed_out if len(nline) > 2 and len(no) > 2)
        status = "CUBIERTA" if covered else "*** NO CUBIERTA ***"
        print(f"  [{i}] '{line}' -> {status}")
