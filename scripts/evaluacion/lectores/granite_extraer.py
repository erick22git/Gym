"""Etapa 1 de Granite-Docling (corre en venv-eval-hf, que tiene torch+transformers): imagen -> tabla en celdas, guardada en
datos-evaluacion/lecturas/granite/<sha>.json con tiempo y RAM. La etapa 2 (lectores/granite.py) pasa esas celdas por el analizador de producción.
Uso: granite_extraer.py <imagen>...   (con HF_HOME en datos-evaluacion/modelos/hf; solo Hugging Face)"""
import hashlib, json, os, sys, time
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]
os.environ.setdefault("HF_HOME", str(RAIZ / "datos-evaluacion" / "modelos" / "hf"))
SALIDA = RAIZ / "datos-evaluacion" / "lecturas" / "granite"
MODELO = "ibm-granite/granite-docling-258M"


def main(rutas):
    import psutil, torch
    from PIL import Image
    from docling_core.types.doc import DoclingDocument
    from docling_core.types.doc.document import DocTagsDocument
    from transformers import AutoModelForImageTextToText, AutoProcessor
    SALIDA.mkdir(parents=True, exist_ok=True)
    proc = AutoProcessor.from_pretrained(MODELO)
    modelo = AutoModelForImageTextToText.from_pretrained(MODELO, torch_dtype=torch.float32).eval()
    for r in map(Path, rutas):
        clave = hashlib.sha1(r.read_bytes()).hexdigest()[:16]
        dest = SALIDA / f"{clave}.json"
        if dest.exists():
            continue
        t0 = time.time()
        img = Image.open(r).convert("RGB")
        msgs = [{"role": "user", "content": [{"type": "image"}, {"type": "text", "text": "Convert this page to docling."}]}]
        prompt = proc.apply_chat_template(msgs, add_generation_prompt=True)
        ins = proc(text=prompt, images=[img], return_tensors="pt")
        with torch.no_grad():
            out = modelo.generate(**ins, max_new_tokens=4096)
        doctags = proc.batch_decode(out[:, ins.input_ids.shape[1]:], skip_special_tokens=False)[0].lstrip()
        doctags = doctags.replace("<end_of_utterance>", "").strip()
        filas = []
        try:
            dt = DocTagsDocument.from_doctags_and_image_pairs([doctags], [img])
            doc = DoclingDocument.load_from_doctags(dt)
            for tb in doc.tables:
                grid = tb.data.grid
                filas += [[c.text for c in fila] for fila in grid]
        except Exception as e:  # noqa: BLE001
            filas = []
            doctags += f"\n<!-- error de parseo: {e} -->"
        dest.write_text(json.dumps({"archivo": r.name, "filas": filas, "doctags": doctags, "tiempo_seg": round(time.time() - t0, 1),
                                    "ram_mb": round(psutil.Process().memory_info().rss / 1e6)}, ensure_ascii=False), encoding="utf-8")
        print(r.name, len(filas), "filas", round(time.time() - t0, 1), "s", flush=True)


if __name__ == "__main__":
    main(sys.argv[1:])
