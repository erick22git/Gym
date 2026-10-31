"""Compara lectores sobre los mismos documentos (los que tiene el primero). Uso: comparar.py ppstructure [base=LINEA_BASE|actual]"""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import metricas
R = Path(__file__).resolve().parents[2] / "datos-evaluacion" / "resultados"
def cargar(n): return [json.loads(l) for l in open(R / f"{n}.jsonl", encoding="utf-8")]
a = sys.argv[1]; bases = sys.argv[2:] or ["actual"]
ra = cargar(a); ids = {r["id"] for r in ra}
for n in [a] + bases:
    rs = [r for r in (ra if n == a else cargar(n)) if r["id"] in ids]
    g = metricas.agregar(rs)["global"]
    print(f"{n:<14} docs={g['docs']} prec={100*g['precision_auto']:.0f}% recall={100*g['recall_sin_humano']:.0f}% rev={100*g['tasa_revision']:.0f}% omision={g['omision_silenciosa']} inv={g['inventados']} t_p50={g['t_p50']:.0f}s p95={g['t_p95']:.0f}s")
