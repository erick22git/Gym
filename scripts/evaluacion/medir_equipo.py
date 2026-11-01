"""Mide ESTE equipo (Sprint 3, paso 3.2): tiempo por tipo de documento y RAM pico (servicio de análisis + Ollama).

  GYM_OLLAMA_URL=http://127.0.0.1:11500 venv-ocr/Scripts/python.exe scripts/evaluacion/medir_equipo.py [--repeticiones 1]

Escribe scripts/tiempos_referencia.json con lo MEDIDO; lo que no se mide queda como null («no medido»). No se extrapola ni se inventa nada.
Debe correr sin otra carga pesada (si no, los tiempos salen inflados). Un documento por tipo, el primero del set, repetido `--repeticiones` veces.
"""
import argparse
import json
import platform
import subprocess
import sys
import threading
import time
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
sys.path.insert(0, str(AQUI))
sys.path.insert(0, str(RAIZ / "scripts"))

TIPOS = ["tabla_limpia", "tabla_compleja", "lista_simple", "manuscrito", "degradada", "excel", "word", "pdf"]


def _cpu():
    try:
        out = subprocess.run(["wmic", "cpu", "get", "name,numberofcores,numberoflogicalprocessors", "/format:list"], capture_output=True, text=True, timeout=20).stdout
        d = dict(l.strip().split("=", 1) for l in out.splitlines() if "=" in l)
        return {"nombre": d.get("Name", "").strip(), "nucleos": int(d.get("NumberOfCores", 0) or 0) or None, "hilos": int(d.get("NumberOfLogicalProcessors", 0) or 0)}
    except Exception:  # noqa: BLE001
        import psutil
        return {"nombre": platform.processor(), "nucleos": psutil.cpu_count(logical=False), "hilos": psutil.cpu_count(logical=True)}


class Muestreo(threading.Thread):
    """Pico de RAM (MB) de este proceso (servicio de análisis) y de todos los procesos de Ollama."""

    def __init__(self):
        super().__init__(daemon=True)
        import psutil
        self.ps, self.yo, self.parar = psutil, psutil.Process(), threading.Event()
        self.pico_servicio = self.pico_ollama = 0.0

    def run(self):
        while not self.parar.is_set():
            self.pico_servicio = max(self.pico_servicio, self.yo.memory_info().rss / 1e6)
            suma = 0.0
            try:   # memoria del modelo cargado según Ollama (el RSS subestima: pesos mapeados)
                import urllib.request, json as _j, os
                url = os.environ.get("GYM_OLLAMA_URL", "http://127.0.0.1:11434").split("/api/")[0].rstrip("/") + "/api/ps"
                with urllib.request.urlopen(url, timeout=3) as r:
                    suma = sum(m.get("size", 0) for m in _j.load(r).get("models", [])) / 1e6
            except Exception:  # noqa: BLE001
                pass
            self.pico_ollama = max(self.pico_ollama, suma)
            time.sleep(0.5)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repeticiones", type=int, default=1)
    args = ap.parse_args()
    import psutil
    import eval_lectura as ev
    t0 = time.time()
    import ocr_service as svc   # carga PaddleOCR (el tiempo de arranque del servicio)
    arranque = round(time.time() - t0, 1)
    docs, _ = ev.descubrir()
    muestreo = Muestreo()
    muestreo.start()
    ram_tras_carga = round(psutil.Process().memory_info().rss / 1e6)
    por_tipo = {}
    for tipo in TIPOS:
        d = next((x for x in docs if x["tipo"] == tipo), None)
        if not d:
            por_tipo[tipo] = None   # no medido
            continue
        tiempos = []
        for _ in range(args.repeticiones):
            t = time.perf_counter()
            ext = d["ruta"].suffix.lower()
            if ext in (".png", ".jpg", ".jpeg"):
                svc.process_image(d["ruta"])
            elif ext == ".xlsx":
                svc.procesar_excel_archivo(d["ruta"])
            elif ext == ".docx":
                svc.procesar_word_archivo(d["ruta"])
            elif ext == ".pdf":
                svc.procesar_pdf_archivo(d["ruta"])
            tiempos.append(round(time.perf_counter() - t, 1))
            print(f"{tipo:<15} {d['id']:<18} {tiempos[-1]} s", flush=True)
        por_tipo[tipo] = {"documento": d["id"], "segundos": tiempos, "items": len(d["items"])}
    muestreo.parar.set()
    mem = psutil.virtual_memory()
    res = {
        "equipo": {"cpu": _cpu(), "ram_total_gb": round(mem.total / 1e9, 1), "so": platform.platform()},
        "medido_el": time.strftime("%Y-%m-%d"),
        "arranque_servicio_seg": arranque,
        "ram_mb": {"servicio_tras_cargar": ram_tras_carga, "servicio_pico": round(muestreo.pico_servicio), "ollama_pico": round(muestreo.pico_ollama) or None},
        "por_tipo": por_tipo,
        "nota": "Medido en el equipo de referencia (un documento por tipo). null = no medido. Los demás equipos no se extrapolan: se mide su velocidad con el micro-benchmark.",
    }
    (RAIZ / "scripts" / "tiempos_referencia.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(res, ensure_ascii=False))


if __name__ == "__main__":
    main()
