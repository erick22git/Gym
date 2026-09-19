"""Diagnostico: inspecciona que campos posicionales trae el resultado de PaddleOCR."""
import sys
from paddleocr import PaddleOCR

image_path = sys.argv[1]

ocr = PaddleOCR(
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=True,
    lang="es",
)
result = ocr.predict(image_path)

for res in result:
    print("KEYS:", list(res.keys()))
    if "rec_boxes" in res:
        print("rec_boxes[0:3]:", res["rec_boxes"][:3])
        print("type:", type(res["rec_boxes"]))
    if "dt_polys" in res:
        print("dt_polys[0:2]:", res["dt_polys"][:2])
    if "rec_polys" in res:
        print("rec_polys[0:2]:", res["rec_polys"][:2])
    print("num texts:", len(res.get("rec_texts", [])))
