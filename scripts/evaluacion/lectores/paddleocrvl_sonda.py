"""Sonda de viabilidad de PaddleOCR-VL en CPU: lee UNA imagen y reporta tiempo, RAM y el markdown/tabla (venv-eval, solo Hugging Face)."""
import os, sys, time
from pathlib import Path
MODELOS = Path(__file__).resolve().parents[3] / "datos-evaluacion" / "modelos"
os.environ.setdefault("PADDLE_PDX_MODEL_SOURCE", "huggingface")
os.environ.setdefault("PADDLE_PDX_CACHE_HOME", str(MODELOS / "paddlex"))
os.environ.setdefault("HF_HOME", str(MODELOS / "hf"))
os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
import psutil
t0 = time.time()
from paddleocr import PaddleOCRVL
p = PaddleOCRVL(device="cpu", use_doc_orientation_classify=False, use_doc_unwarping=False)
t1 = time.time()
r = p.predict(sys.argv[1])
print("CARGA", round(t1 - t0), "s  PREDICCION", round(time.time() - t1), "s  RAM", round(psutil.Process().memory_info().rss / 1e6), "MB", flush=True)
for x in r:
    print(x.markdown["markdown_texts"][:3000] if hasattr(x, "markdown") else x)
