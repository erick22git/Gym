"""Piezas comunes de los lectores alternativos (Sprint 2, paso 2): cada lector solo produce la tabla reconstruida ({n_lines,n_rows,n_cols,table,rows_raw})
y se le pasa por el MISMO analizador/validador determinista de producción (ocr_service.process_image), cambiando únicamente run_ocr_and_reconstruct."""
import os
from pathlib import Path

MODELOS = Path(__file__).resolve().parents[3] / "datos-evaluacion" / "modelos"
os.environ.setdefault("PADDLE_PDX_MODEL_SOURCE", "huggingface")   # solo Hugging Face (autorizado); nunca hosts de Baidu
os.environ.setdefault("PADDLE_PDX_CACHE_HOME", str(MODELOS / "paddlex"))
os.environ.setdefault("HF_HOME", str(MODELOS / "hf"))
os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")

import ocr_service as svc  # noqa: E402

IMAGENES = (".png", ".jpg", ".jpeg", ".webp", ".bmp")


def procesar_imagen_con(path, recon_fn):
    """Reemplaza el lector OCR de producción por recon_fn(path) y corre el resto del pipeline sin cambios."""
    original = svc.run_ocr_and_reconstruct
    svc.run_ocr_and_reconstruct = recon_fn
    try:
        return svc.process_image(path)
    finally:
        svc.run_ocr_and_reconstruct = original


def recon_desde_celdas(filas):
    """filas: lista de filas, cada una [(texto, (x1,y1,x2,y2) | None), ...] con una entrada por columna (texto '' si vacía)."""
    table, rows_raw, y = [], [], 0.0
    for fila in filas:
        table.append([t for t, _ in fila])
        items = []
        for t, b in fila:
            if t.strip():
                x1, y1, x2, y2 = b if b else (0.0, y, 1.0, y + 20.0)
                items.append({"text": t, "score": 1.0, "x1": x1, "y1": y1, "x2": x2, "y2": y2})
        rows_raw.append(items or [{"text": "", "score": 1.0, "x1": 0.0, "y1": y, "x2": 1.0, "y2": y + 20.0}])
        y += 30.0
    n_lines = sum(len([c for c in f if c[0].strip()]) for f in filas)
    return {"n_lines": n_lines, "n_rows": len(table), "n_cols": max((len(f) for f in filas), default=0), "table": table, "rows_raw": rows_raw}
