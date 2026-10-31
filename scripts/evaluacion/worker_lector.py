"""Proceso trabajador de un lector (Sprint 2). Carga el lector UNA vez y atiende documentos por stdin (una línea JSON por documento).
El arnés (eval_lectura.py) lo mata y relanza si un documento pasa del tiempo límite. Respuesta: una línea «@@RES@@ {json}» en stdout.

Uso: python worker_lector.py <lector>        (los lectores viven en scripts/evaluacion/lectores/<lector>.py y exponen procesar(path))
"""
import ctypes
import importlib
import json
import os
import sys
import time
from ctypes import wintypes
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI)); sys.path.insert(0, str(AQUI.parent))


def ram_pico_mb():
    class PMC(ctypes.Structure):
        _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD), ("PeakWorkingSetSize", ctypes.c_size_t), ("WorkingSetSize", ctypes.c_size_t),
                    ("QuotaPeakPagedPoolUsage", ctypes.c_size_t), ("QuotaPagedPoolUsage", ctypes.c_size_t), ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaNonPagedPoolUsage", ctypes.c_size_t), ("PagefileUsage", ctypes.c_size_t), ("PeakPagefileUsage", ctypes.c_size_t)]
    c = PMC(); c.cb = ctypes.sizeof(PMC)
    k = ctypes.windll.kernel32
    k.GetCurrentProcess.restype = wintypes.HANDLE
    ctypes.windll.psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(PMC), wintypes.DWORD]
    ctypes.windll.psapi.GetProcessMemoryInfo(k.GetCurrentProcess(), ctypes.byref(c), c.cb)
    return round(c.PeakWorkingSetSize / 1048576)


def main():
    nombre = sys.argv[1]
    real_out = sys.stdout
    real_out.reconfigure(encoding="utf-8")
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout = sys.stderr   # todo print() del lector va a stderr; solo el protocolo usa el stdout real
    lector = importlib.import_module("lectores." + nombre)
    print("@@LISTO@@", file=real_out, flush=True)
    for linea in sys.stdin:
        linea = linea.strip()
        if not linea:
            continue
        pedido = json.loads(linea)
        t0 = time.perf_counter()
        try:
            res = lector.procesar(Path(pedido["path"]))
            res["error"] = None
        except Exception as e:  # el arnés lo cuenta como documento fallido, no como omisión silenciosa
            res = {"resueltos": [], "requiere_revision": [], "error": f"{type(e).__name__}: {e}"[:300]}
        res["tiempo_seg"] = round(time.perf_counter() - t0, 2)
        res["ram_mb"] = ram_pico_mb()
        print("@@RES@@ " + json.dumps(res, ensure_ascii=True, default=str), file=real_out, flush=True)


if __name__ == "__main__":
    main()
