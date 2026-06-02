// Generates build/icon.ico from public/logo.jpg
// Uses Electron's nativeImage for resizing, then writes ICO binary with PNG payloads
import { createCanvas, loadImage } from 'canvas'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const SIZES = [256, 128, 64, 48, 32, 16]
const SRC  = join(ROOT, 'public', 'logo.jpg')
const DEST = join(ROOT, 'build', 'icon.ico')

async function run() {
  if (!existsSync(join(ROOT, 'build'))) mkdirSync(join(ROOT, 'build'))

  const img = await loadImage(SRC)
  const pngBuffers = []

  for (const size of SIZES) {
    const canvas = createCanvas(size, size)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#060709'
    ctx.fillRect(0, 0, size, size)

    // Scale logo to fill ~90% of the icon square (letterbox if wide)
    const fill = size * 0.90
    const scale = Math.min(fill / img.width, fill / img.height)
    const w = img.width * scale
    const h = img.height * scale
    const x = (size - w) / 2
    const y = (size - h) / 2
    ctx.drawImage(img, x, y, w, h)

    pngBuffers.push(canvas.toBuffer('image/png'))
    console.log(`  ${size}x${size}: ${pngBuffers[pngBuffers.length-1].length} bytes`)
  }

  // Build ICO binary
  const count = SIZES.length
  const headerSize = 6
  const entrySize = 16
  const dirSize = headerSize + count * entrySize

  // Calculate offsets
  const offsets = []
  let offset = dirSize
  for (const buf of pngBuffers) {
    offsets.push(offset)
    offset += buf.length
  }

  const totalSize = offset
  const ico = Buffer.alloc(totalSize)

  // ICONDIR header
  ico.writeUInt16LE(0, 0)     // reserved
  ico.writeUInt16LE(1, 2)     // type: 1 = icon
  ico.writeUInt16LE(count, 4) // count

  // ICONDIRENTRY entries
  for (let i = 0; i < count; i++) {
    const base = headerSize + i * entrySize
    const size = SIZES[i]
    ico.writeUInt8(size === 256 ? 0 : size, base)     // width (0 = 256)
    ico.writeUInt8(size === 256 ? 0 : size, base + 1) // height (0 = 256)
    ico.writeUInt8(0, base + 2)  // colorCount (0 = >8bpp)
    ico.writeUInt8(0, base + 3)  // reserved
    ico.writeUInt16LE(1, base + 4) // planes
    ico.writeUInt16LE(32, base + 6) // bitCount
    ico.writeUInt32LE(pngBuffers[i].length, base + 8) // bytesInRes
    ico.writeUInt32LE(offsets[i], base + 12)           // imageOffset
  }

  // Copy PNG data
  for (let i = 0; i < count; i++) {
    pngBuffers[i].copy(ico, offsets[i])
  }

  writeFileSync(DEST, ico)
  console.log(`\n✓ Created ${DEST} (${(totalSize / 1024).toFixed(1)} KB)`)
}

run().catch(e => { console.error(e); process.exit(1) })
