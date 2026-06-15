'use strict'
// Runs inside Electron's V8 to compile main.cjs → main.jsc
// Called by: node scripts/run-bytecode-compile.cjs
const bytenode = require('bytenode')
const v8 = require('v8')
const path = require('path')
const fs = require('fs')

// Eager compilation — include all function bodies in bytecode
v8.setFlagsFromString('--no-lazy')

const electronDir = path.resolve(__dirname, '../electron')
const src = path.join(electronDir, 'main.cjs')
const dst = path.join(electronDir, 'main.jsc')

if (!fs.existsSync(src)) {
  console.error('[bytecode] Source not found:', src)
  process.exit(1)
}

bytenode.compileFile(src, dst)
console.log('[bytecode] Compiled main.cjs → main.jsc')
process.exit(0)
