/**
 * Genera build/icon.ico desde src/assets/logo.jpg
 * con recorte central (zoom ~80%) para que el logo se vea más grande.
 * Uso: node scripts/gen-icon.cjs
 */

const sharp = require('sharp')
// png-to-ico es ESM — se importa dinámicamente
let pngToIco
const path = require('path')
const fs = require('fs')

const SRC   = path.join(__dirname, '../src/assets/logo.jpg')
const OUT   = path.join(__dirname, '../build/icon.ico')
const TMP   = path.join(__dirname, '../build/_tmp_icon')
const SIZES = [256, 128, 64, 48, 32, 16]

// Zoom: recortamos el centro al 80% del área original.
// Con fit:'cover' y un tamaño cuadrado, sharp centra y recorta automáticamente.
const ZOOM = 0.80

async function main() {
  pngToIco = (await import('png-to-ico')).default
  fs.mkdirSync(TMP, { recursive: true })

  const meta = await sharp(SRC).metadata()
  const side  = Math.min(meta.width, meta.height)
  const crop  = Math.round(side * ZOOM)

  const pngFiles = []

  for (const size of SIZES) {
    const out = path.join(TMP, `icon_${size}.png`)
    await sharp(SRC)
      .extract({
        left:   Math.round((meta.width  - crop) / 2),
        top:    Math.round((meta.height - crop) / 2),
        width:  crop,
        height: crop,
      })
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(out)
    pngFiles.push(out)
    console.log(`  ✓ ${size}x${size} → ${path.basename(out)}`)
  }

  const icoBuffer = await pngToIco(pngFiles)
  fs.writeFileSync(OUT, icoBuffer)
  console.log(`\n✅ build/icon.ico generado (${(icoBuffer.length / 1024).toFixed(1)} KB)`)

  // Limpia temporales
  for (const f of pngFiles) try { fs.unlinkSync(f) } catch (_) {}
  try { fs.rmdirSync(TMP) } catch (_) {}
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
