# Lector INDEPENDIENTE (zxing-cpp) para comprobar los códigos de barras generados por electron/codigobarras.cjs.
# Entrada (stdin): JSON [{"id":..., "bits":"1010..."}]  ·  Salida: JSON [{"id":..., "texto":..., "formato":...}]
import sys, json
from PIL import Image
import zxingcpp

def render(bits, modulo=4, alto=100, zona=12):
    ancho = (len(bits) + 2 * zona) * modulo
    img = Image.new('L', (ancho, alto + 2 * 10), 255)
    px = img.load()
    for i, b in enumerate(bits):
        if b == '1':
            for x in range((zona + i) * modulo, (zona + i + 1) * modulo):
                for y in range(10, 10 + alto):
                    px[x, y] = 0
    return img

def leer_rects(d):
    esc = 6
    img = Image.new('L', (int(d['w'] * esc), int(d['h'] * esc)), 255)
    px = img.load()
    for x, y, w, h in d['rects']:
        for xx in range(max(0, int(round(x * esc))), min(img.width, int(round((x + w) * esc)))):
            for yy in range(max(0, int(round(y * esc))), min(img.height, int(round((y + h) * esc)))):
                px[xx, yy] = 0
    return sorted(set(r.text for r in zxingcpp.read_barcodes(img)))

entrada = json.load(sys.stdin)
if isinstance(entrada, dict):
    print(json.dumps({'textos': leer_rects(entrada)})); sys.exit(0)

res = []
for it in entrada:
    r = zxingcpp.read_barcodes(render(it['bits']))
    res.append({'id': it['id'], 'texto': r[0].text if r else None, 'formato': str(r[0].format) if r else None})
print(json.dumps(res))
