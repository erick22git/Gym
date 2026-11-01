"""Comparación de modelos de lenguaje SOLO para los grupos ambiguos (Sprint 3, paso 2).

  1) Cosechar (una vez, con el modelo por defecto): corre el pipeline sobre el set y guarda cada grupo que llega al LLM junto con lo esperado.
       GYM_OLLAMA_URL=http://127.0.0.1:11500 venv-ocr/Scripts/python.exe scripts/evaluacion/eval_modelos.py cosechar
  2) Evaluar un modelo (Ollama en CPU) sobre los MISMOS grupos, sin repetir el OCR:
       GYM_OLLAMA_URL=http://127.0.0.1:11500 venv-ocr/Scripts/python.exe scripts/evaluacion/eval_modelos.py evaluar qwen2.5:3b
  3) Tabla comparativa de todo lo evaluado:  ... eval_modelos.py tabla

Qué mide por modelo y por parte (ajuste / validación): grupos bien resueltos, error confiado (resuelto pero equivocado), a revisión (bien derivado),
omisión silenciosa (esperado que no sale ni resuelto ni en revisión), inventados, mezcla de idiomas (portugués), tiempo hasta el primer token, tiempo
total y RAM pico del proceso de Ollama. Mismo prompt, mismas verificaciones (cobertura, filtros 1 y 2) que producción: solo cambia el modelo.
"""
import json
import re
import sys
import time
import unicodedata
import urllib.request
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
sys.path.insert(0, str(AQUI))
sys.path.insert(0, str(RAIZ / "scripts"))
import metricas  # noqa: E402

DATOS = RAIZ / "datos-evaluacion"
GRUPOS = DATOS / "grupos" / "grupos.jsonl"
SALIDA = DATOS / "resultados" / "modelos"
PT = re.compile(r"[ãõç]|\b(leite|queijo|feijão|feijao|óleo|manteiga|açúcar|acucar|sabão|sabao|farinha|ovos|carne|peixe|frango|arroz integral|não|nao|você|voce|obrigado)\b", re.I)


def _svc():
    import ocr_service as svc
    return svc


def cosechar():
    svc = _svc()
    registro, doc_actual = [], {"id": None}
    original = svc.resolver_grupo_llm

    def espiar(raw_lines, id_label):
        registro.append({"doc": doc_actual["id"], "id": id_label, "lineas": [{"text": l["text"], "x1": l.get("x1", 0), "y1": l.get("y1", 0)} for l in raw_lines]})
        return original(raw_lines, id_label)
    svc.resolver_grupo_llm = espiar
    sys.path.insert(0, str(AQUI))
    import eval_lectura as ev
    docs, _ = ev.descubrir()
    GRUPOS.parent.mkdir(parents=True, exist_ok=True)
    part = json.loads((DATOS / "particion.json").read_text(encoding="utf-8"))
    hechos = set()
    if GRUPOS.exists():   # reanuda tras un corte: no repite los documentos ya cosechados
        hechos = {json.loads(l)["doc"] for l in open(GRUPOS, encoding="utf-8") if l.strip()}
    with open(GRUPOS, "a", encoding="utf-8") as out:
        for d in docs:
            ext = d["ruta"].suffix.lower()
            if ext in (".xlsx",) or d["id"] in hechos:
                continue
            doc_actual["id"] = d["id"]
            n0 = len(registro)
            try:
                if ext in (".png", ".jpg", ".jpeg"):
                    svc.process_image(d["ruta"])
                elif ext == ".docx":
                    svc.procesar_word_archivo(d["ruta"])
                elif ext == ".pdf":
                    svc.procesar_pdf_archivo(d["ruta"])
            except Exception as e:  # noqa: BLE001
                print(d["id"], "ERROR", e, flush=True)
            for g in registro[n0:]:
                g["tipo"] = d["tipo"]
                g["parte"] = "validacion" if d["id"] in part["validacion"] else "ajuste"
                texto = " ".join(l["text"] for l in g["lineas"])
                g["esperado"] = [{"nombre": e["nombre"], "cantidad": e["cantidad"]} for e in d["items"] if metricas._en_texto(e["nombre"], texto)]
                out.write(json.dumps(g, ensure_ascii=False) + "\n")
            out.flush()
            print(f"{d['id']:<18} grupos={len(registro) - n0}", flush=True)
    print("TOTAL grupos", len(registro))


def _ram_ollama_mb():
    """Memoria que Ollama reporta para el modelo cargado (/api/ps, campo size). El RSS del proceso NO sirve: los pesos van mapeados a disco y subestima."""
    try:
        url = svc_url().replace("/api/generate", "/api/ps")
        with urllib.request.urlopen(url, timeout=10) as r:
            return sum(m.get("size", 0) for m in json.load(r).get("models", [])) / 1e6
    except Exception:  # noqa: BLE001
        return None


def svc_url():
    return _svc().OLLAMA_URL


def evaluar(modelo, limite=None):
    svc = _svc()
    grupos = [json.loads(l) for l in open(GRUPOS, encoding="utf-8")]
    if limite:
        grupos = grupos[:limite]
    medidas = {"ttft": [], "total": [], "ram": [], "pt": 0, "llamadas": 0}

    def llamar(prompt, model=modelo, formato=None):
        body = {"model": modelo, "prompt": prompt, "stream": True, "think": False, "options": {"temperature": 0}}
        if formato:
            body["format"] = formato
        req = urllib.request.Request(svc.OLLAMA_URL, data=json.dumps(body).encode("utf-8"), headers={"Content-Type": "application/json"})
        t0, ttft, partes = time.perf_counter(), None, []
        with urllib.request.urlopen(req, timeout=900) as resp:
            for linea in resp:
                if not linea.strip():
                    continue
                d = json.loads(linea)
                if d.get("response"):
                    if ttft is None:
                        ttft = time.perf_counter() - t0
                    partes.append(d["response"])
                if d.get("done"):
                    break
        medidas["ttft"].append(ttft if ttft is not None else time.perf_counter() - t0)
        medidas["total"].append(time.perf_counter() - t0)
        ram = _ram_ollama_mb()
        if ram:
            medidas["ram"].append(ram)
        texto = "".join(partes)
        medidas["llamadas"] += 1
        if PT.search(texto):
            medidas["pt"] += 1
        return {"response": texto}
    svc.call_ollama = llamar

    SALIDA.mkdir(parents=True, exist_ok=True)
    archivo = SALIDA / (re.sub(r"[^a-z0-9._-]+", "_", modelo.lower()) + ".jsonl")
    filas = []
    with open(archivo, "w", encoding="utf-8") as out:
        for k, g in enumerate(grupos, 1):
            raw = [{"text": l["text"], "x1": l["x1"], "y1": l["y1"]} for l in g["lineas"]]
            try:
                resueltos, revision = svc.resolver_grupo_llm(raw, g["id"])
                error = None
            except Exception as e:  # noqa: BLE001
                resueltos, revision, error = [], [], str(e)[:200]
            m = metricas.evaluar({"items": g["esperado"], "no_inventario": []}, {"resueltos": resueltos, "requiere_revision": revision})
            fila = {"doc": g["doc"], "id": g["id"], "tipo": g["tipo"], "parte": g["parte"], "esperados": len(g["esperado"]), "correctos": m["correctos"],
                    "err_cantidad": m["err_cantidad"], "en_revision": m["en_revision"], "omision": m["omision"], "inventados": m["inventados"], "error": error}
            filas.append(fila)
            out.write(json.dumps(fila, ensure_ascii=False) + "\n")
            print(f"[{k}/{len(grupos)}] {g['doc']:<16} {g['id']:<8} ok={m['correctos']}/{len(g['esperado'])} rev={m['en_revision']} omis={m['omision']} inv={m['inventados']} "
                  f"t={medidas['total'][-1]:.0f}s" + (f" ERROR {error}" if error else ""), flush=True)
    med = lambda xs: sorted(xs)[len(xs) // 2] if xs else None
    resumen = {"modelo": modelo, "grupos": len(filas), "ttft_p50": med(medidas["ttft"]), "total_p50": med(medidas["total"]), "total_max": max(medidas["total"]) if medidas["total"] else None,
               "ram_pico_mb": max(medidas["ram"]) if medidas["ram"] else None, "respuestas_con_portugues": medidas["pt"], "llamadas": medidas["llamadas"]}
    (SALIDA / (archivo.stem + ".resumen.json")).write_text(json.dumps(resumen, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(resumen, ensure_ascii=False))


def tabla():
    print("| modelo | parte | grupos | esperados | correctos | err. cantidad | a revisión | omisión silenciosa | inventados | t 1.er token p50 | t total p50 | RAM pico | portugués |")
    print("|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    for res in sorted(SALIDA.glob("*.resumen.json")):
        r = json.loads(res.read_text(encoding="utf-8"))
        filas = [json.loads(l) for l in open(res.with_suffix("").with_suffix(".jsonl"), encoding="utf-8")]
        for parte in ("ajuste", "validacion"):
            fs = [f for f in filas if f["parte"] == parte]
            s = lambda k: sum(f[k] for f in fs)
            f1 = lambda x: "—" if x is None else f"{x:.1f}"
            print(f"| {r['modelo']} | {parte} | {len(fs)} | {s('esperados')} | {s('correctos')} | {s('err_cantidad')} | {s('en_revision')} | **{s('omision')}** | {s('inventados')} | "
                  f"{f1(r['ttft_p50'])} s | {f1(r['total_p50'])} s | {f1(r['ram_pico_mb'])} MB | {r['respuestas_con_portugues']}/{r['llamadas']} |")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "tabla"
    if cmd == "cosechar":
        cosechar()
    elif cmd == "evaluar":
        evaluar(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else None)
    else:
        tabla()
