"""Lector PP-StructureV3 (PaddleOCR 3.x, reconocimiento de tablas). Solo imágenes; requiere venv-eval (--python venv-eval/Scripts/python.exe)."""
import re
from html.parser import HTMLParser
from pathlib import Path

from ._comun import IMAGENES, procesar_imagen_con, recon_desde_celdas

_pipe = None


class _Tabla(HTMLParser):
    def __init__(self):
        super().__init__(); self.filas, self._fila, self._celda, self._span = [], None, None, 1

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self._fila = []
        elif tag in ("td", "th"):
            self._celda = []
            self._span = int(dict(attrs).get("colspan", 1) or 1)

    def handle_data(self, d):
        if self._celda is not None:
            self._celda.append(d)

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._celda is not None:
            self._fila.append(("".join(self._celda).strip(), self._span)); self._celda = None
        elif tag == "tr" and self._fila is not None:
            self.filas.append(self._fila); self._fila = None


def _pipeline():
    global _pipe
    if _pipe is None:
        from paddleocr import PPStructureV3
        _pipe = PPStructureV3(use_doc_orientation_classify=False, use_doc_unwarping=False, use_chart_recognition=False,
                              use_formula_recognition=False, use_seal_recognition=False, device="cpu")
    return _pipe


def _recon(path):
    out = _pipeline().predict(str(path))[0]
    filas_html = []
    cajas = []
    for tb in out["table_res_list"]:
        p = _Tabla(); p.feed(tb["pred_html"]); filas_html += p.filas
        cajas += [list(map(float, b)) for b in tb["cell_box_list"]]
    n_cols = max((sum(s for _, s in f) for f in filas_html), default=0)
    k, filas = 0, []
    for f in filas_html:
        fila = []
        for texto, span in f:
            caja = tuple(cajas[k][:4]) if k < len(cajas) and len(cajas[k]) >= 4 else None
            k += 1
            fila.append((texto, caja))
            fila += [("", None)] * (span - 1)
        fila += [("", None)] * (n_cols - len(fila))
        filas.append(fila)
    return recon_desde_celdas(filas)


def procesar(path: Path):
    if path.suffix.lower() not in IMAGENES:
        raise ValueError("este lector solo evalúa imágenes")
    return procesar_imagen_con(path, _recon)
