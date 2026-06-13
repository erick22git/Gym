/**
 * Genera build/icon.ico desde src/assets/logo.jpg
 * Zoom 92% del centro: logo completo sin recortar, más grande que el anterior.
 * Uso: node scripts/gen-icon.cjs
 */

const sharp = require('sharp')
let pngToIco
const path = require('path')
const fs = require('fs')

const SRC   = path.join(__dirname, '../src/assets/logo.jpg')
const OUT   = path.join(__dirname, '../build/icon.ico')
const TMP   = path.join(__dirname, '../build/_tmp_icon')
const SIZES = [256, 128, 64, 48, 32, 16]

const PCT = 0.92

async function main() {
  pngToIco = (await import('png-to-ico')).default
  fs.mkdirSync(TMP, { recursive: true })

  const meta = await sharp(SRC).metadata()
  const w    = Math.floor(meta.width  * PCT)
  const h    = Math.floor(meta.height * PCT)
  const left = Math.floor((meta.width  - w) / 2)
  const top  = Math.floor((meta.height - h) / 2)

  const pngFiles = []

  for (const size of SIZES) {
    const out = path.join(TMP, `icon_${size}.png`)
    await sharp(SRC)
      .extract({ left, top, width: w, height: h })
      .resize(size, size, {
        fit: 'cover',
        position: 'centre',
      })
      .png()
      .toFile(out)
    pngFiles.push(out)
    console.log(`  ✓ ${size}x${size} → ${path.basename(out)}`)
  }

  const icoBuffer = await pngToIco(pngFiles)
  fs.writeFileSync(OUT, icoBuffer)
  console.log(`\n✅ build/icon.ico generado al 92% — zoom suave (${(icoBuffer.length / 1024).toFixed(1)} KB)`)

  for (const f of pngFiles) try { fs.unlinkSync(f) } catch (_) {}
  try { fs.rmdirSync(TMP) } catch (_) {}
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
