"""Partición fija ajuste (2/3) / validación (1/3) del set sintético, estratificada por tipo (Sprint 3, paso 1.1).

  python scripts/evaluacion/particion.py                      # escribe datos-evaluacion/particion.json
  python scripts/evaluacion/particion.py final                # además reporta final.jsonl por separado en ajuste y validación

Reglas: la semilla es fija; el reparto de cada tipo es 2/3 ajuste y 1/3 validación (6 → 4+2, 3 → 2+1). La validación NO se usa para ajustar nada.
Aviso honesto: los arreglos del Sprint 2 se hicieron viendo los 39 documentos, así que esta partición, aplicada a ellos, solo detecta diferencias
de dificultad entre partes; la protección contra sobreajuste vale hacia adelante (todo cambio nuevo se ajusta con `ajuste` y se confirma en `validacion`).
"""
import json
import random
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
import metricas  # noqa: E402

DATOS = AQUI.parents[1] / "datos-evaluacion"
SEMILLA = 20261031


def particion():
    docs = {}
    for p in sorted((DATOS / "sinteticos").glob("*.json")):
        j = json.loads(p.read_text(encoding="utf-8"))
        docs.setdefault(j.get("tipo", "otro"), []).append(j.get("id", p.stem))
    rng = random.Random(SEMILLA)
    ajuste, validacion = [], []
    for tipo in sorted(docs):
        ids = sorted(docs[tipo])
        rng.shuffle(ids)
        n_val = max(1, round(len(ids) / 3))
        validacion += ids[:n_val]
        ajuste += ids[n_val:]
    return {"semilla": SEMILLA, "ajuste": sorted(ajuste), "validacion": sorted(validacion)}


def main():
    part = particion()
    (DATOS / "particion.json").write_text(json.dumps(part, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"ajuste={len(part['ajuste'])} validacion={len(part['validacion'])} (semilla {SEMILLA})")
    for nombre in sys.argv[1:]:
        regs = [json.loads(l) for l in open(DATOS / "resultados" / f"{nombre}.jsonl", encoding="utf-8")]
        for parte in ("ajuste", "validacion"):
            rs = [r for r in regs if r["id"] in part[parte]]
            g = metricas.agregar(rs)["global"]
            print(f"{nombre:<10} {parte:<10} docs={g['docs']:>2} esperados={g['esperados']:>3} precisión={100 * g['precision_auto']:.0f}% ({g['correctos']}/{g['resueltos']}) "
                  f"recall={100 * g['recall_sin_humano']:.0f}% revisión={100 * g['tasa_revision']:.0f}% omisión={g['omision_silenciosa']} inventados={g['inventados']} "
                  f"err.cant={g['err_cantidad']} err.nombre={g['err_nombre']}")


if __name__ == "__main__":
    main()
