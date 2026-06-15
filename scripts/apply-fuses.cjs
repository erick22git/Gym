'use strict'
// Electron Fuses: applied after electron-builder packs the app
// Runs as the `afterPack` hook in package.json build config
const path = require('path')

async function afterPack(context) {
  process.stderr.write('[fuses] afterPack hook called\n')
  const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses')
  const { appOutDir, packager } = context
  const platform = packager.platform.name

  // Only apply on Windows for this project
  if (platform !== 'windows') {
    process.stderr.write(`[fuses] Skipping non-Windows platform: ${platform}\n`)
    return
  }

  const exeName = `${packager.appInfo.productFilename}.exe`
  const exePath = path.join(appOutDir, exeName)

  process.stderr.write(`[fuses] Applying to: ${exePath}\n`)

  await flipFuses(exePath, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  })

  process.stderr.write('[fuses] All fuses applied successfully\n')
}

module.exports = afterPack
module.exports.default = afterPack
module.exports.afterPack = afterPack
