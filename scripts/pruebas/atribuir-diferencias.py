"""Atribuye las diferencias «Transparente actual vs base» (capturas de transparente-identico.mjs con GUARDAR=1) a causas medibles.
  1) Franja superior (barra de título + menú): cambio aprobado (menú siempre visible con barra de desplazamiento).
  2) Resto de la página: se busca el desplazamiento vertical dy que mejor alinea actual con base (el menú más alto empuja todo el contenido);
     lo que sigue distinto TRAS alinear es residual (cambio inesperado o aprobado en esa página).
  3) Residual: regiones (celdas de 24 px conexas) con su caja y el elemento del DOM más pequeño que la contiene (dom-<pagina>.json, si existe).
Uso: venv-ocr\Scripts\python.exe scripts\pruebas\atribuir-diferencias.py [carpeta-ab] [carpeta-ruido]
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
AB = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "docs" / "capturas-sprint1" / "ab"
PAGS = ["control-acceso", "caja", "dashboard", "clientes", "membresias", "inventario", "ventas", "casilleros", "reportes", "auditoria", "ia", "configuracion"]
TOP = 130   # franja de barra de título + menú
C = 24


def cargar(p):
    return np.array(Image.open(p).convert("RGB")).astype(np.int16)


def distinto(a, b):
    return np.abs(a - b).sum(2) > 24


def regiones(mask, dom, dy):
    h, w = mask.shape
    gh, gw = -(-h // C), -(-w // C)
    cel = np.zeros((gh, gw), bool)
    ys, xs = np.nonzero(mask)
    cel[ys // C, xs // C] = True
    vis = np.zeros_like(cel)
    out = []
    for y0 in range(gh):
        for x0 in range(gw):
            if not cel[y0, x0] or vis[y0, x0]:
                continue
            pila, vis[y0, x0] = [(y0, x0)], True
            xa = xb = x0; ya = yb = y0; n = 0
            while pila:
                cy, cx = pila.pop(); n += 1
                xa, xb, ya, yb = min(xa, cx), max(xb, cx), min(ya, cy), max(yb, cy)
                for dy_ in (-1, 0, 1):
                    for dx_ in (-1, 0, 1):
                        ny, nx = cy + dy_, cx + dx_
                        if 0 <= ny < gh and 0 <= nx < gw and cel[ny, nx] and not vis[ny, nx]:
                            vis[ny, nx] = True; pila.append((ny, nx))
            bx, by, bw, bh = xa * C, ya * C, (xb + 1 - xa) * C, (yb + 1 - ya) * C
            mejor = None
            for e in dom or []:
                ey = e[2]
                if e[1] <= bx + 2 and ey <= by + dy + 2 and e[1] + e[3] >= bx + bw - 2 and ey + e[4] >= by + dy + bh - 2 and (mejor is None or e[3] * e[4] < mejor[3] * mejor[4]):
                    mejor = e
            out.append({"caja": [bx, by, bw, bh], "celdas": n, "contenedor": (mejor[0] + (" «" + mejor[5] + "»" if mejor[5] else "")) if mejor else "(sin elemento)"})
    out.sort(key=lambda r: -r["celdas"])
    return out


def main():
    filas, detalle = [], {}
    for p in PAGS:
        a, b = cargar(AB / f"{p}-actual.png"), cargar(AB / f"{p}-base.png")
        h, w, _ = a.shape
        total = distinto(a, b)
        franja = total[:TOP].sum()
        # mejor desplazamiento vertical del contenido (actual[y+dy] ≈ base[y]) bajo la franja
        mejor_dy, mejor_n = 0, None
        for dy in range(0, 25):
            ca = a[TOP + dy:h - 30]
            cb = b[TOP:h - 30 - dy]
            n = distinto(ca[:cb.shape[0]], cb).sum()
            if mejor_n is None or n < mejor_n:
                mejor_dy, mejor_n = dy, n
        ca, cb = a[TOP + mejor_dy:h - 30], b[TOP:h - 30 - mejor_dy]
        resid = distinto(ca, cb)
        dom_f = AB / f"dom-{p}.json"
        dom = json.loads(dom_f.read_text(encoding="utf-8")) if dom_f.exists() else None
        regs = regiones(resid, dom, mejor_dy)
        # el residual se mapea a coordenadas de base (y+TOP); el DOM es de actual: se compensó con dy
        for r in regs:
            r["caja"][1] += TOP
        resto_antes = total[TOP:].sum()
        filas.append((p, 100 * total.sum() / total.size, 100 * franja / total.size, 100 * resto_antes / total.size, mejor_dy, 100 * resid.sum() / total.size))
        detalle[p] = regs[:5]
    print("| página | total | franja menú/título | contenido | dy (px) | contenido tras alinear |\n|---|---|---|---|---|---|")
    for f in filas:
        print(f"| {f[0]} | {f[1]:.2f} % | {f[2]:.2f} % | {f[3]:.2f} % | {f[4]} | **{f[5]:.2f} %** |")
    print("\nRegiones residuales (tras alinear), las 4 mayores por página:")
    for p, regs in detalle.items():
        for r in regs[:4]:
            print(f"- {p}: caja {r['caja']} ({r['celdas']} celdas) → {r['contenedor']}")


main()
