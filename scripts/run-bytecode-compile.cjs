'use strict'
// Invokes Electron binary to compile main.cjs to V8 bytecode
// Runs as `prebuild` npm hook before electron-builder packages the app
const { execFileSync } = require('child_process')
const electronPath = require('electron')
const path = require('path')

console.log('[prebuild] Compiling main.cjs to V8 bytecode using Electron...')
execFileSync(String(electronPath), [
  path.resolve(__dirname, 'compile-bytecode.cjs')
], {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..')
})
console.log('[prebuild] Bytecode ready')
