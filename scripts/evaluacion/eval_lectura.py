"""Arnés de evaluación de lectura de documentos (Sprint 2, paso 1.4).

  npm run eval:lectura -- --lector actual                 # todo el set (sintéticos + reales con etiqueta)
  npm run eval:lectura -- --lector actual --solo tabla_compleja,excel
  npm run eval:lectura -- --lector actual --muestra        # solo la muestra de modelos lentos (4 tablas, 4 multilínea, 4 degradadas)
  npm run eval:lectura -- --lector actual --rehacer        # ignora la caché

· Reanudación y caché por documento Y lector: datos-evaluacion/cache/<lector>/<sha>.json (la clave es el contenido del archivo).
· Tiempo límite por documento (15 min por defecto): se mata el trabajador y se registra «timeout» (documento fallido, no omisión).
· Salida: datos-evaluacion/resultados/<lector>.jsonl (una línea por documento) y una tabla Markdown por consola.
· Reales (datos-evaluacion/reales): con <nombre>.etiqueta.csv/json cuentan; con solo el pre-etiquetado .csv se reportan «sin etiqueta».
"""
import argparse
import csv
import hashlib
import json
import subprocess
import sys
import threading
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
sys.path.insert(0, str(AQUI))
import metricas  # noqa: E402

DATOS = RAIZ / "datos-evaluacion"
EXT = {".png", ".jpg", ".jpeg", ".xlsx", ".docx", ".pdf"}
MUESTRA = {"tabla_limpia": 4, "tabla_compleja": 4, "degradada": 4}  # muestra de 12 para modelos lentos


def leer_etiqueta_csv(ruta):
    items, no_inv = [], []
    with open(ruta, encoding="utf-8-sig", newline="") as f:
        for fila in csv.DictReader(f):
            if (fila.get("tipo") or "item").strip().lower() == "no_inventario":
                no_inv.append(fila["nombre"].strip())
                continue
            if not (fila.get("nombre") or "").strip():
                continue
            c = (fila.get("cantidad") or "").replace(",", ".").strip()
            it = {"nombre": fila["nombre"].strip(), "cantidad": float(c) if "." in c else int(c)}
            if (fila.get("unidad") or "").strip():
                it["unidad"] = fila["unidad"].strip()
            items.append(it)
    return {"items": items, "no_inventario": no_inv}


def descubrir():
    """→ (documentos con etiqueta, reales sin etiqueta)."""
    docs, sin_etiqueta = [], []
    for carpeta, origen in ((DATOS / "sinteticos", "sintetico"), (DATOS / "reales", "real")):
        if not carpeta.exists():
            continue
        for p in sorted(carpeta.iterdir()):
            if p.suffix.lower() not in EXT:
                continue
            et = None
            j = p.with_suffix(".json")
            c = p.with_suffix(".etiqueta.csv")
            if j.exists():
                et = json.loads(j.read_text(encoding="utf-8"))
            elif c.exists():
                et = leer_etiqueta_csv(c)
            if et is None:
                if origen == "real":
                    sin_etiqueta.append(p)
                continue
            et.setdefault("id", p.stem)
            et.setdefault("tipo", "real" if origen == "real" else "otro")
            et["ruta"] = p
            et["origen"] = origen
            docs.append(et)
    return docs, sin_etiqueta


def sha(p):
    return hashlib.sha1(p.read_bytes()).hexdigest()[:16]


class Trabajador:
    def __init__(self, lector, python):
        self.lector, self.python, self.p = lector, python, None
        self.arrancar()

    def arrancar(self):
        self.cerrar()
        self.p = subprocess.Popen([self.python, str(AQUI / "worker_lector.py"), self.lector], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                  stderr=open(DATOS / f"worker-{self.lector}.log", "ab"), text=True, encoding="utf-8", cwd=str(RAIZ))
        while True:
            linea = self.p.stdout.readline()
            if not linea:
                raise RuntimeError(f"el lector '{self.lector}' no arrancó (ver datos-evaluacion/worker-{self.lector}.log)")
            if linea.startswith("@@LISTO@@"):
                return

    def cerrar(self):
        if self.p and self.p.poll() is None:
            self.p.kill()
        self.p = None

    def pedir(self, ruta, limite):
        res = {}

        def leer():
            self.p.stdin.write(json.dumps({"path": str(ruta)}) + "\n")
            self.p.stdin.flush()
            while True:
                linea = self.p.stdout.readline()
                if not linea:
                    res["r"] = {"resueltos": [], "requiere_revision": [], "error": "el trabajador murió"}
                    return
                if linea.startswith("@@RES@@"):
                    res["r"] = json.loads(linea[len("@@RES@@"):])
                    return
        t = threading.Thread(target=leer, daemon=True)
        t.start()
        t.join(limite)
        if t.is_alive():
            self.arrancar()
            return {"resueltos": [], "requiere_revision": [], "error": f"timeout ({limite} s)", "tiempo_seg": limite}
        return res.get("r") or {"resueltos": [], "requiere_revision": [], "error": "sin respuesta"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lector", default="actual")
    ap.add_argument("--python", default=str(RAIZ / "venv-ocr" / "Scripts" / "python.exe"), help="intérprete del entorno del lector")
    ap.add_argument("--solo", help="tipos separados por coma")
    ap.add_argument("--muestra", action="store_true", help="usar la muestra de modelos lentos (12 documentos)")
    ap.add_argument("--limite", type=int, default=900, help="segundos por documento (15 min)")
    ap.add_argument("--rehacer", action="store_true")
    ap.add_argument("--salida", help="nombre del .jsonl de resultados (por defecto, el lector)")
    args = ap.parse_args()

    docs, sin_etiqueta = descubrir()
    if args.solo:
        docs = [d for d in docs if d["tipo"] in args.solo.split(",")]
    if args.muestra:
        cuenta, sel = {}, []
        for d in docs:
            if d["tipo"] in MUESTRA and cuenta.get(d["tipo"], 0) < MUESTRA[d["tipo"]]:
                cuenta[d["tipo"]] = cuenta.get(d["tipo"], 0) + 1
                sel.append(d)
        docs = sel
    cache = DATOS / "cache" / args.lector
    cache.mkdir(parents=True, exist_ok=True)
    (DATOS / "resultados").mkdir(parents=True, exist_ok=True)
    nombre_salida = args.salida or args.lector
    trab, registros = None, []
    with open(DATOS / "resultados" / (nombre_salida + ".jsonl"), "w", encoding="utf-8") as out:
        for k, d in enumerate(docs, 1):
            ck = cache / (sha(d["ruta"]) + ".json")
            if ck.exists() and not args.rehacer:
                res = json.loads(ck.read_text(encoding="utf-8"))
                desde = "caché"
            else:
                trab = trab or Trabajador(args.lector, args.python)
                res = trab.pedir(d["ruta"], args.limite)
                desde = "ejecutado"
                if not str(res.get("error") or "").startswith("timeout"):
                    ck.write_text(json.dumps(res, ensure_ascii=False), encoding="utf-8")
            reg = {"id": d["id"], "tipo": d["tipo"], "origen": d["origen"], "lector": args.lector, "tiempo_seg": res.get("tiempo_seg"),
                   "ram_mb": res.get("ram_mb"), "error": res.get("error"), "esperados_n": len(d["items"])}
            if not res.get("error"):
                reg["metricas"] = metricas.evaluar(d, res)
            reg["resultado"] = {"resueltos": res.get("resueltos"), "requiere_revision": res.get("requiere_revision")}
            registros.append(reg)
            out.write(json.dumps(reg, ensure_ascii=False) + "\n")
            out.flush()
            m = reg.get("metricas") or {}
            print(f"[{k}/{len(docs)}] {d['id']:<20} {desde:<9} {reg['tiempo_seg']}s  ok={m.get('correctos', '-')}/{m.get('esperados', len(d['items']))} "
                  f"rev={m.get('en_revision', '-')} OMISION={m.get('omision', '-')} inv={m.get('inventados', '-')}"
                  + (f"  ERROR {reg['error']}" if reg["error"] else ""), flush=True)
    for p in sin_etiqueta:   # reales sin etiqueta: se leen y se deja un pre-etiquetado editable (no cuentan en las métricas)
        ck = cache / (sha(p) + ".json")
        if ck.exists() and not args.rehacer:
            res = json.loads(ck.read_text(encoding="utf-8"))
        else:
            trab = trab or Trabajador(args.lector, args.python)
            res = trab.pedir(p, args.limite)
            if not str(res.get("error") or "").startswith("timeout"):
                ck.write_text(json.dumps(res, ensure_ascii=False), encoding="utf-8")
        with open(p.with_suffix(".preetiqueta.csv"), "w", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f)
            w.writerow(["tipo", "nombre", "cantidad", "unidad", "origen_sistema"])
            for r in res.get("resueltos") or []:
                w.writerow(["item", r.get("nombre"), r.get("cantidad"), "", "listo"])
            for r in res.get("requiere_revision") or []:
                w.writerow(["item", r.get("nombre_sugerido") or " ".join(map(str, r.get("texto_ocr_crudo") or [])), r.get("cantidad_sugerida") or "", "", "revision:" + str(r.get("motivo"))])
    if trab:
        trab.cerrar()
    agg_s = metricas.agregar([r for r in registros if r["origen"] == "sintetico"])
    print("\n" + metricas.tabla_md(agg_s, f"### Sintéticos — lector `{args.lector}`"))
    reales = [r for r in registros if r["origen"] == "real"]
    if reales:
        print("\n" + metricas.tabla_md(metricas.agregar(reales), "### Reales con etiqueta"))
    if sin_etiqueta:
        print(f"\nReales SIN etiqueta (no cuentan): {len(sin_etiqueta)} → " + ", ".join(p.name for p in sin_etiqueta[:10]))
    (DATOS / "resultados" / (nombre_salida + ".resumen.json")).write_text(json.dumps(agg_s, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
