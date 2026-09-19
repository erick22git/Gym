"""
PRUEBA A: reconstruccion de filas/columnas usando SOLO datos posicionales
de PaddleOCR (rec_boxes: x1,y1,x2,y2 por linea detectada), sin LLM.

Uso:
    venv-ocr\\Scripts\\python.exe scripts\\test_positional_reconstruct.py <imagen>
"""
import sys
import json
import time
import statistics
from pathlib import Path


def cluster_1d(values, gap_factor=2.5, min_gap_px=15):
    """Agrupa valores 1D en clusters separando por huecos grandes."""
    if not values:
        return []
    pairs = sorted(range(len(values)), key=lambda i: values[i])
    sorted_vals = [values[i] for i in pairs]
    gaps = [sorted_vals[i + 1] - sorted_vals[i] for i in range(len(sorted_vals) - 1)]
    if gaps:
        median_gap = statistics.median(gaps) if statistics.median(gaps) > 0 else 1
        threshold = max(median_gap * gap_factor, min_gap_px)
    else:
        threshold = min_gap_px

    clusters = []
    current = [pairs[0]]
    for k in range(1, len(sorted_vals)):
        if sorted_vals[k] - sorted_vals[k - 1] > threshold:
            clusters.append(current)
            current = []
        current.append(pairs[k])
    clusters.append(current)
    return clusters


def reconstruct(image_path):
    from paddleocr import PaddleOCR

    ocr = PaddleOCR(
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=True,
        lang="es",
    )

    t_ocr_start = time.perf_counter()
    result = ocr.predict(str(image_path))
    t_ocr_end = time.perf_counter()

    res = result[0]
    texts = res["rec_texts"]
    scores = res["rec_scores"]
    boxes = res["rec_boxes"]  # [x1,y1,x2,y2]

    items = []
    for text, score, box in zip(texts, scores, boxes):
        x1, y1, x2, y2 = [float(v) for v in box]
        items.append({
            "text": text,
            "score": float(score),
            "x1": x1, "y1": y1, "x2": x2, "y2": y2,
            "yc": (y1 + y2) / 2,
            "h": y2 - y1,
        })

    # --- Reconstruccion puramente posicional (sin LLM) ---
    t_rec_start = time.perf_counter()

    heights = [it["h"] for it in items]
    median_h = statistics.median(heights) if heights else 20

    # 1. Agrupar en FILAS por proximidad de Y (centro), umbral = ~0.7 * altura mediana de linea
    items_sorted_y = sorted(items, key=lambda it: it["yc"])
    row_threshold = median_h * 0.7
    rows = []
    current_row = [items_sorted_y[0]]
    for it in items_sorted_y[1:]:
        if it["yc"] - current_row[-1]["yc"] > row_threshold:
            rows.append(current_row)
            current_row = []
        current_row.append(it)
    rows.append(current_row)

    # 2. Determinar columnas: clusterizar x1 de TODAS las cajas (global) para
    #    encontrar bandas de columna consistentes en toda la tabla.
    all_x1 = [it["x1"] for it in items]
    x_clusters_idx = cluster_1d(all_x1, gap_factor=2.0, min_gap_px=25)
    # cada cluster define un rango [min_x, max_x] = una "columna"
    col_ranges = []
    for cluster in x_clusters_idx:
        xs = [all_x1[i] for i in cluster]
        col_ranges.append((min(xs), max(xs)))
    col_ranges.sort(key=lambda r: r[0])

    def col_index(x1):
        best_i, best_d = 0, float("inf")
        for i, (lo, hi) in enumerate(col_ranges):
            center = (lo + hi) / 2
            d = abs(x1 - center)
            if d < best_d:
                best_d = d
                best_i = i
        return best_i

    # 3. Construir tabla: por fila, asignar cada texto a su columna, concatenando si hay varios
    table = []
    for row in rows:
        row_sorted = sorted(row, key=lambda it: it["x1"])
        cells = {}
        for it in row_sorted:
            ci = col_index(it["x1"])
            cells.setdefault(ci, []).append(it["text"])
        n_cols = len(col_ranges)
        row_cells = [" ".join(cells.get(c, [])) for c in range(n_cols)]
        table.append(row_cells)

    # 4. Fusionar filas fisicas en "entradas" logicas: una entrada nueva empieza
    #    cuando la columna ancla (la primera con contenido en la mayoria de filas)
    #    tiene texto; las filas siguientes con esa columna vacia se fusionan.
    anchor_col = 0
    non_empty_counts = [sum(1 for r in table if r[c].strip()) for c in range(len(col_ranges))] if col_ranges else []
    if non_empty_counts:
        anchor_col = max(range(len(non_empty_counts)), key=lambda c: non_empty_counts[c])

    entries = []
    for row in table:
        if row[anchor_col].strip() or not entries:
            entries.append([cell for cell in row])
        else:
            last = entries[-1]
            for c in range(len(row)):
                if row[c].strip():
                    last[c] = (last[c] + " " + row[c]).strip() if last[c] else row[c]

    t_rec_end = time.perf_counter()

    rows_raw = [
        [
            {"text": it["text"], "score": it["score"], "x1": it["x1"], "y1": it["y1"], "x2": it["x2"], "y2": it["y2"]}
            for it in sorted(row, key=lambda it: it["x1"])
        ]
        for row in rows
    ]

    return {
        "ocr_time": t_ocr_end - t_ocr_start,
        "reconstruct_time": t_rec_end - t_rec_start,
        "n_lines": len(items),
        "n_rows": len(rows),
        "n_cols": len(col_ranges),
        "table": table,
        "rows_raw": rows_raw,
        "entries": entries,
        "anchor_col": anchor_col,
        "raw_items": items,
    }


def main():
    if len(sys.argv) < 2:
        print("Uso: python test_positional_reconstruct.py <imagen>")
        sys.exit(1)

    image_path = Path(sys.argv[1])
    out = reconstruct(image_path)

    print(f"Tiempo OCR (deteccion+reconocimiento): {out['ocr_time']:.2f}s")
    print(f"Tiempo reconstruccion posicional (sin LLM): {out['reconstruct_time']*1000:.2f}ms")
    print(f"Lineas detectadas: {out['n_lines']}  |  Filas agrupadas: {out['n_rows']}  |  Columnas detectadas: {out['n_cols']}")
    print()
    print("TABLA RECONSTRUIDA (filas fisicas, por linea de texto):")
    print("=" * 80)
    for i, row in enumerate(out["table"]):
        print(f"Fila {i:2d}: {row}")

    print()
    print(f"ENTRADAS FUSIONADAS (columna ancla = {out['anchor_col']}):")
    print("=" * 80)
    for i, row in enumerate(out["entries"]):
        print(f"Entrada {i:2d}: {row}")

    out_path = image_path.with_suffix(".positional.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({
            "ocr_time": out["ocr_time"],
            "reconstruct_time_ms": out["reconstruct_time"] * 1000,
            "n_lines": out["n_lines"],
            "n_rows": out["n_rows"],
            "n_cols": out["n_cols"],
            "table": out["table"],
            "rows_raw": out["rows_raw"],
            "entries": out["entries"],
        }, f, ensure_ascii=False, indent=2)
    print(f"\nGuardado en: {out_path}")


if __name__ == "__main__":
    main()
