'use strict'
// Entry point para producción: carga main.jsc via bytenode
// En desarrollo, npm run dev usa electron . que lee package.json main directamente
const isDev = !require('electron').app.isPackaged
if (isDev) {
  require('./main.cjs')
} else {
  require('bytenode')
  require('./main.jsc')
}
