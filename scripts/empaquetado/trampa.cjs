// Proxy TRAMPA en 127.0.0.1:9: cualquier programa que respete HTTP(S)_PROXY y quiera salir a
// internet termina acá; se registra a dónde intentaba ir y se le responde 503 (falla ruidosa).
// (Los destinos loopback se excluyen con NO_PROXY, así que solo llegan intentos externos.)
const http = require('http')
const net = require('net')
const fs = require('fs')
const log = process.argv[2] || 'trampa.log'
const anotar = m => fs.appendFileSync(log, new Date().toISOString() + ' ' + m + '\n')
fs.writeFileSync(log, '')
const s = http.createServer((req, res) => { anotar('HTTP ' + req.method + ' ' + req.url + ' host=' + req.headers.host); res.statusCode = 503; res.end('sin internet (trampa)') })
s.on('connect', (req, sock) => { anotar('CONNECT ' + req.url); sock.end('HTTP/1.1 503 Sin internet\r\n\r\n') })
s.listen(9, '127.0.0.1', () => console.log('trampa lista en 127.0.0.1:9'))
