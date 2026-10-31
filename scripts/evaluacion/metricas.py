"""Métricas de lectura de documentos (Sprint 2, paso 1.4). Todo determinista y sin red.

Coincidencia de nombre: normalizada (minúsculas, sin tildes, espacios colapsados) con similitud >= 0,85 (difflib).
Cantidad: exacta.
"""
import re
import statistics
import unicodedata
from difflib import SequenceMatcher

UMBRAL = 0.85


def norm(s):
    s = unicodedata.normalize("NFD", str(s or "")).lower()
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).strip(" .,:;-_")


def sim(a, b):
    a, b = norm(a), norm(b)
    return SequenceMatcher(None, a, b).ratio() if a and b else 0.0


def num(x):
    try:
        return float(str(x).replace(",", ".").strip())
    except (TypeError, ValueError):
        return None


def _en_texto(esperado, crudo):
    """¿El nombre esperado está en el texto crudo de una fila de revisión? Cada palabra del esperado debe aparecer (sim >= 0,85)
    entre las palabras del crudo; se exige el 80 % de las palabras."""
    pe = [w for w in norm(esperado).split() if w]
    pc = norm(crudo).split()
    if not pe or not pc:
        return False
    hit = sum(1 for w in pe if any(SequenceMatcher(None, w, c).ratio() >= UMBRAL for c in pc))
    return hit / len(pe) >= 0.8


def evaluar(etiqueta, resultado):
    """Compara UN documento. Devuelve contadores y el detalle de fallos."""
    esperados = etiqueta["items"]
    resueltos = resultado.get("resueltos") or []
    revision = resultado.get("requiere_revision") or []
    no_inv = etiqueta.get("no_inventario") or []

    # 1) resueltos automáticos ↔ esperados (asignación voraz: primero cantidad igual, luego mayor similitud)
    pares = []
    for i, r in enumerate(resueltos):
        for j, e in enumerate(esperados):
            s = sim(r.get("nombre"), e["nombre"])
            if s >= UMBRAL:
                pares.append((num(r.get("cantidad")) == num(e["cantidad"]), s, i, j))
    pares.sort(key=lambda p: (not p[0], -p[1]))
    usado_r, usado_e, asign = set(), set(), {}
    for qok, s, i, j in pares:
        if i in usado_r or j in usado_e:
            continue
        usado_r.add(i); usado_e.add(j); asign[i] = (j, qok)

    correctos = sum(1 for (_, q) in asign.values() if q)
    err_cant = sum(1 for (_, q) in asign.values() if not q)
    sin_par = [i for i in range(len(resueltos)) if i not in asign]
    libres = [j for j in range(len(esperados)) if j not in usado_e]
    err_nombre = 0
    basura = 0
    detalle = []
    for i in sin_par:
        r = resueltos[i]
        es_basura = any(sim(r.get("nombre"), t) >= UMBRAL or norm(t) in norm(r.get("nombre")) and len(norm(t)) >= 4 for t in no_inv)
        basura += 1 if es_basura else 0
        if any(num(r.get("cantidad")) == num(esperados[j]["cantidad"]) and sim(r.get("nombre"), esperados[j]["nombre"]) >= 0.5 for j in libres):
            err_nombre += 1
        detalle.append({"tipo": "inventado" + ("/basura" if es_basura else ""), "nombre": r.get("nombre"), "cantidad": r.get("cantidad")})
    for i, (j, q) in asign.items():
        if not q:
            detalle.append({"tipo": "error_cantidad", "nombre": resueltos[i].get("nombre"), "cantidad": resueltos[i].get("cantidad"), "esperado": esperados[j]["cantidad"]})

    # 2) esperados que no salieron resueltos: ¿están en revisión? (por nombre sugerido o por el texto crudo de la fila)
    en_rev, omision = 0, []
    cubiertos_rev = set()
    for j in libres:
        e = esperados[j]
        ok = False
        for k, rv in enumerate(revision):
            if sim(rv.get("nombre_sugerido"), e["nombre"]) >= UMBRAL or _en_texto(e["nombre"], " ".join(map(str, rv.get("texto_ocr_crudo") or []))):
                ok = True; cubiertos_rev.add(k); break
        if ok:
            en_rev += 1
        else:
            omision.append(e["nombre"])
            detalle.append({"tipo": "omision_silenciosa", "nombre": e["nombre"], "cantidad": e["cantidad"]})
    revision_ruido = len(revision) - len(cubiertos_rev)

    auto_indebido = sum(1 for i, (j, q) in asign.items() if esperados[j].get("revision_esperada"))
    return {
        "esperados": len(esperados), "resueltos": len(resueltos), "correctos": correctos, "err_cantidad": err_cant, "err_nombre": err_nombre,
        "inventados": len(sin_par), "basura": basura, "en_revision": en_rev, "omision": len(omision), "filas_revision": len(revision),
        "revision_ruido": revision_ruido, "auto_indebido": auto_indebido, "detalle": detalle,
    }


def agregar(registros):
    """registros: [{tipo, tiempo_seg, ram_mb, metricas, error?}] → métricas por tipo y global, con n visible."""
    def suma(rs):
        t = {k: 0 for k in ("esperados", "resueltos", "correctos", "err_cantidad", "err_nombre", "inventados", "basura", "en_revision", "omision",
                            "filas_revision", "revision_ruido", "auto_indebido")}
        for r in rs:
            m = r.get("metricas")
            if m:
                for k in t:
                    t[k] += m[k]
        n_docs = len(rs)
        esperados_total = sum(r.get("esperados_n", 0) for r in rs)
        tiempos = sorted(r["tiempo_seg"] for r in rs if r.get("tiempo_seg") is not None and not r.get("error"))
        p = lambda q: tiempos[min(len(tiempos) - 1, int(round(q * (len(tiempos) - 1))))] if tiempos else None
        rams = [r["ram_mb"] for r in rs if r.get("ram_mb")]
        return {
            "docs": n_docs, "docs_fallidos": sum(1 for r in rs if r.get("error")), "esperados": esperados_total,
            "precision_auto": (t["correctos"] / t["resueltos"]) if t["resueltos"] else None,
            "error_confiado": (1 - t["correctos"] / t["resueltos"]) if t["resueltos"] else None,
            "recall_sin_humano": t["correctos"] / esperados_total if esperados_total else None,
            "tasa_revision": t["en_revision"] / esperados_total if esperados_total else None,
            "omision_silenciosa": t["omision"], "inventados": t["inventados"], "basura": t["basura"],
            "err_nombre": t["err_nombre"], "err_cantidad": t["err_cantidad"], "auto_indebido": t["auto_indebido"],
            "filas_revision": t["filas_revision"], "revision_ruido": t["revision_ruido"], "resueltos": t["resueltos"], "correctos": t["correctos"],
            "t_p50": p(0.5), "t_p95": p(0.95), "ram_mb_max": max(rams) if rams else None,
        }
    por_tipo = {}
    for r in registros:
        por_tipo.setdefault(r["tipo"], []).append(r)
    return {"global": suma(registros), "por_tipo": {k: suma(v) for k, v in sorted(por_tipo.items())}}


def tabla_md(agg, titulo=""):
    def f(x, pct=False):
        if x is None:
            return "—"
        return f"{100 * x:.0f} %" if pct else (f"{x:.1f}" if isinstance(x, float) else str(x))
    cab = "| tipo | docs | esperados | precisión auto | recall sin humano | revisión | omisión silenciosa | inventados | err. nombre | err. cantidad | t p50 / p95 (s) |\n|---|---|---|---|---|---|---|---|---|---|---|\n"
    filas = []
    for nombre, m in list(agg["por_tipo"].items()) + [("**GLOBAL**", agg["global"])]:
        filas.append(f"| {nombre} | {m['docs']}{' (' + str(m['docs_fallidos']) + ' fallidos)' if m['docs_fallidos'] else ''} | {m['esperados']} | {f(m['precision_auto'], True)} ({m['correctos']}/{m['resueltos']}) | "
                     f"{f(m['recall_sin_humano'], True)} | {f(m['tasa_revision'], True)} | **{m['omision_silenciosa']}** | {m['inventados']} | {m['err_nombre']} | {m['err_cantidad']} | {f(m['t_p50'])} / {f(m['t_p95'])} |")
    return (titulo + "\n\n" if titulo else "") + cab + "\n".join(filas)
