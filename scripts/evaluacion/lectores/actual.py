"""Lector «actual»: el pipeline de producción tal cual (scripts/ocr_service.py), sin cambios. Es la línea base."""
from pathlib import Path

import ocr_service as svc  # carga PaddleOCR una vez (import con efectos, como en producción)


def procesar(path: Path):
    ext = path.suffix.lower()
    if ext in (".png", ".jpg", ".jpeg", ".webp", ".bmp"):
        return svc.process_image(path)
    if ext == ".xlsx":
        return svc.procesar_excel_archivo(path)
    if ext == ".docx":
        return svc.procesar_word_archivo(path)
    if ext == ".pdf":
        return svc.procesar_pdf_archivo(path)
    raise ValueError("formato no soportado: " + ext)
