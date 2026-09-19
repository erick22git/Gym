"""
Script de diagnostico (no forma parte de la app).
Prueba PaddleOCR (PP-OCRv5) sobre una imagen real y reporta texto,
confianza y tiempo de procesamiento.

Uso:
    venv-ocr\\Scripts\\python.exe scripts\\test_paddleocr.py ruta\\a\\imagen.jpg
"""
import sys
import time
import json
from pathlib import Path


def main():
    if len(sys.argv) < 2:
        print("Uso: python test_paddleocr.py <ruta_imagen>")
        sys.exit(1)

    image_path = Path(sys.argv[1])
    if not image_path.exists():
        print(f"ERROR: no existe la imagen: {image_path}")
        sys.exit(1)

    print(f"Cargando PaddleOCR (PP-OCRv5)... imagen: {image_path}")
    t_load_start = time.perf_counter()

    from paddleocr import PaddleOCR

    use_mobile = "--mobile" in sys.argv
    if use_mobile:
        ocr = PaddleOCR(
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=True,
            text_detection_model_name="PP-OCRv5_mobile_det",
            text_recognition_model_name="PP-OCRv5_mobile_rec",
        )
    else:
        ocr = PaddleOCR(
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=True,
            lang="es",
        )
    t_load_end = time.perf_counter()
    print(f"Modelo cargado en {t_load_end - t_load_start:.2f}s")

    t_start = time.perf_counter()
    result = ocr.predict(str(image_path))
    t_end = time.perf_counter()

    print(f"\nTiempo de inferencia (deteccion + reconocimiento): {t_end - t_start:.2f}s\n")
    print("=" * 60)
    print("TEXTO DETECTADO:")
    print("=" * 60)

    all_lines = []
    for res in result:
        texts = res.get("rec_texts", [])
        scores = res.get("rec_scores", [])
        for text, score in zip(texts, scores):
            all_lines.append((text, score))
            print(f"[{score:.3f}] {text}")

    if not all_lines:
        print("(No se detecto texto)")

    print("\n" + "=" * 60)
    print(f"Total de lineas detectadas: {len(all_lines)}")
    if all_lines:
        avg_conf = sum(s for _, s in all_lines) / len(all_lines)
        print(f"Confianza promedio: {avg_conf:.3f}")

    out_json = image_path.with_suffix(".ocr.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(
            {"lines": [{"text": t, "score": s} for t, s in all_lines]},
            f,
            ensure_ascii=False,
            indent=2,
        )
    print(f"\nResultado guardado en: {out_json}")

    raw_text = "\n".join(t for t, _ in all_lines)
    raw_txt_path = image_path.with_suffix(".ocr.txt")
    with open(raw_txt_path, "w", encoding="utf-8") as f:
        f.write(raw_text)
    print(f"Texto crudo guardado en: {raw_txt_path}")


if __name__ == "__main__":
    main()
