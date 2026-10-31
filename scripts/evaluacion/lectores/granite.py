"""Etapa 2 de Granite-Docling: lee las celdas extraídas por granite_extraer.py y las pasa por el analizador de producción. Solo imágenes."""
import hashlib
import json
from pathlib import Path

from ._comun import IMAGENES, procesar_imagen_con, recon_desde_celdas

LECTURAS = Path(__file__).resolve().parents[3] / "datos-evaluacion" / "lecturas" / "granite"


def _leer(path):
    f = LECTURAS / (hashlib.sha1(Path(path).read_bytes()).hexdigest()[:16] + ".json")
    if not f.exists():
        raise FileNotFoundError(f"falta la extracción de Granite para {Path(path).name}: correr granite_extraer.py")
    return json.loads(f.read_text(encoding="utf-8"))


def procesar(path: Path):
    if path.suffix.lower() not in IMAGENES:
        raise ValueError("este lector solo evalúa imágenes")
    d = _leer(path)
    n = max((len(f) for f in d["filas"]), default=0)
    filas = [[(t, None) for t in f] + [("", None)] * (n - len(f)) for f in d["filas"]]
    res = procesar_imagen_con(path, lambda _p: recon_desde_celdas(filas))
    res["tiempo_seg"] = d["tiempo_seg"]   # tiempo de extracción del modelo (la etapa 2 es despreciable)
    res["ram_mb"] = d["ram_mb"]
    return res
