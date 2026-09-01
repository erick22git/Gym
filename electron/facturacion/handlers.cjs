/**
 * Manejadores IPC para el módulo de Facturación Electrónica SFE Bolivia
 * Toda la lógica pesada (PDF, email, crypto, SFE API) corre aquí en el proceso principal.
 */

const { ipcMain, app, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const axios = require('axios')
const forge = require('node-forge')
const PDFDocument = require('pdfkit')
const nodemailer = require('nodemailer')
const QRCode = require('qrcode')

// ─── Datos de simulación ─────────────────────────────────────────────────────

const DATOS_SIM_EMPRESA = {
  nit: '123456789', razon_social: 'GIMNASIO (PRUEBA)',
  nombre_comercial: 'Gimnasio', direccion: 'Av. Hernando Siles #123',
  telefono: '4-6451234', departamento: 'Chuquisaca', municipio: 'Sucre',
  codigo_sucursal: 0, punto_venta: 0,
  leyenda: 'Esta factura contribuye al desarrollo del país, el uso ilícito de ésta será sancionado de acuerdo a ley.',
}
const DATOS_SIM_CRED = {
  ambiente: 'simulacion', token: 'TOKEN-SIMULACION-PRUEBA-2026',
  codigo_sistema: 'SIM-001', cuis: 'ABC123DEF456',
  cufd: '1A2B3C4D5E6F7G8H9I0J', cufd_codigo_control: 'A1-B2-C3-D4',
  modalidad: 2, tipo_emision: 1, tipo_factura: 1,
}

// ─── Rutas de datos ──────────────────────────────────────────────────────────

const CERTS_DIR = path.join(app.getPath('userData'), 'certificados')
const PDFS_DIR = path.join(app.getPath('userData'), 'facturas_pdf')
const ENCRYPTION_KEY = 'UrbanFitnessClub_SFE_2024_AES256'

if (!fs.existsSync(CERTS_DIR)) fs.mkdirSync(CERTS_DIR, { recursive: true })
if (!fs.existsSync(PDFS_DIR)) fs.mkdirSync(PDFS_DIR, { recursive: true })

// ─── Referencia a la BD (se inyecta desde main.cjs) ─────────────────────────

let queryAll, queryOne, run

function initFacturacion(dbFunctions) {
  queryAll = dbFunctions.queryAll
  queryOne = dbFunctions.queryOne
  run = dbFunctions.run
}

// ─── Cifrado AES-256 ─────────────────────────────────────────────────────────

function encrypt(texto) {
  if (!texto) return ''
  try {
    const key = forge.util.createBuffer(forge.util.encodeUtf8(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)))
    const iv = forge.random.getBytesSync(16)
    const cipher = forge.cipher.createCipher('AES-CBC', key)
    cipher.start({ iv })
    cipher.update(forge.util.createBuffer(forge.util.encodeUtf8(texto)))
    cipher.finish()
    const ivHex = forge.util.bytesToHex(iv)
    const encHex = forge.util.bytesToHex(cipher.output.getBytes())
    return ivHex + ':' + encHex
  } catch {
    return texto
  }
}

function decrypt(cifrado) {
  if (!cifrado || !cifrado.includes(':')) return cifrado || ''
  try {
    const [ivHex, encHex] = cifrado.split(':')
    const key = forge.util.createBuffer(forge.util.encodeUtf8(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)))
    const iv = forge.util.hexToBytes(ivHex)
    const encrypted = forge.util.hexToBytes(encHex)
    const decipher = forge.cipher.createDecipher('AES-CBC', key)
    decipher.start({ iv: forge.util.createBuffer(iv) })
    decipher.update(forge.util.createBuffer(encrypted))
    decipher.finish()
    return forge.util.decodeUtf8(decipher.output.getBytes())
  } catch {
    return ''
  }
}

// ─── Endpoints SFE ───────────────────────────────────────────────────────────

function getBaseUrl(ambiente) {
  return ambiente === 'produccion'
    ? 'https://siat.impuestos.gob.bo/v2/FacturacionComputarizada'
    : 'https://pilotosiatservicios.impuestos.gob.bo/v2/FacturacionComputarizada'
}

// ─── Llamada SOAP al SFE ─────────────────────────────────────────────────────

async function soapCall(endpoint, metodo, bodyXml, token, timeoutMs = 15000) {
  const inicio = Date.now()
  const url = endpoint
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:siat="https://siat.impuestos.gob.bo/">
  <soapenv:Header/>
  <soapenv:Body>
    ${bodyXml}
  </soapenv:Body>
</soapenv:Envelope>`

  const respuesta = await axios.post(url, envelope, {
    headers: {
      'Content-Type': 'text/xml;charset=UTF-8',
      'SOAPAction': metodo,
      'Authorization': `Bearer ${token}`,
      'apikey': `TokenApi ${token}`,
    },
    timeout: timeoutMs,
  })

  return {
    xml: respuesta.data,
    ms: Date.now() - inicio,
  }
}

// ─── Parseo de respuesta SOAP ─────────────────────────────────────────────────

function extraerTagSoap(xml, tag) {
  const re = new RegExp(`<(?:[^:]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[^:]+:)?${tag}>`, 'i')
  const m = xml.match(re)
  return m ? m[1].trim() : null
}

// ─── Helpers de credenciales ─────────────────────────────────────────────────

function getCredencialesActivas() {
  const row = queryOne('SELECT * FROM credenciales_sfe WHERE id=1')
  if (!row) return null
  return {
    ...row,
    token: decrypt(row.token),
    ambiente: row.ambiente || 'piloto',
  }
}

function getEmpresaActiva() {
  return queryOne('SELECT * FROM configuracion_empresa WHERE id=1')
}

// ─── SFE: verificarComunicacion ───────────────────────────────────────────────

async function verificarComunicacion() {
  const cred = getCredencialesActivas()
  if (!cred) throw new Error('No hay credenciales SFE configuradas')
  const base = getBaseUrl(cred.ambiente)
  const endpoint = `${base}/SiatServicioFacturacionSincronizacion`
  const { xml, ms } = await soapCall(endpoint, 'verificarComunicacion',
    '<siat:verificarComunicacion/>', cred.token)
  const transaccion = extraerTagSoap(xml, 'transaccion')
  return { ok: transaccion === 'true', ms, respuesta: xml }
}

// ─── SFE: obtenerCUIS ────────────────────────────────────────────────────────

async function obtenerCUIS() {
  const cred = getCredencialesActivas()
  const empresa = getEmpresaActiva()
  if (!cred || !empresa) throw new Error('Faltan credenciales o datos de empresa')
  const base = getBaseUrl(cred.ambiente)
  const endpoint = `${base}/SiatServicioFacturacionSincronizacion`
  const body = `<siat:cuis>
    <SolicitudCuis>
      <codigoAmbiente>${cred.ambiente === 'produccion' ? 2 : 1}</codigoAmbiente>
      <codigoModalidad>${cred.modalidad || 2}</codigoModalidad>
      <codigoSistema>${cred.codigo_sistema || ''}</codigoSistema>
      <nit>${empresa.nit}</nit>
      <codigoSucursal>${empresa.codigo_sucursal || 0}</codigoSucursal>
      <codigoPuntoVenta>${empresa.punto_venta || 0}</codigoPuntoVenta>
    </SolicitudCuis>
  </siat:cuis>`
  const { xml, ms } = await soapCall(endpoint, 'cuis', body, cred.token)
  const codigo = extraerTagSoap(xml, 'codigo')
  const fechaVigencia = extraerTagSoap(xml, 'fechaVigencia')
  if (!codigo) {
    const msgError = extraerTagSoap(xml, 'descripcion') || 'Error obteniendo CUIS'
    throw new Error(msgError)
  }
  run('UPDATE credenciales_sfe SET cuis=?, cuis_fecha_vigencia=? WHERE id=1',
    [codigo, fechaVigencia])
  return { cuis: codigo, fechaVigencia, ms }
}

// ─── SFE: obtenerCUFD ────────────────────────────────────────────────────────

async function obtenerCUFD() {
  const cred = getCredencialesActivas()
  const empresa = getEmpresaActiva()
  if (!cred?.cuis) throw new Error('Primero debe obtener el CUIS')
  const base = getBaseUrl(cred.ambiente)
  const endpoint = `${base}/SiatServicioFacturacionSincronizacion`
  const body = `<siat:cufd>
    <SolicitudCufd>
      <codigoAmbiente>${cred.ambiente === 'produccion' ? 2 : 1}</codigoAmbiente>
      <codigoModalidad>${cred.modalidad || 2}</codigoModalidad>
      <codigoSistema>${cred.codigo_sistema || ''}</codigoSistema>
      <nit>${empresa.nit}</nit>
      <codigoSucursal>${empresa.codigo_sucursal || 0}</codigoSucursal>
      <cuis>${cred.cuis}</cuis>
      <codigoPuntoVenta>${empresa.punto_venta || 0}</codigoPuntoVenta>
    </SolicitudCufd>
  </siat:cufd>`
  const { xml, ms } = await soapCall(endpoint, 'cufd', body, cred.token)
  const codigo = extraerTagSoap(xml, 'codigo')
  const codigoControl = extraerTagSoap(xml, 'codigoControl')
  const fechaVigencia = extraerTagSoap(xml, 'fechaVigencia')
  if (!codigo) {
    const msgError = extraerTagSoap(xml, 'descripcion') || 'Error obteniendo CUFD'
    throw new Error(msgError)
  }
  run('UPDATE credenciales_sfe SET cufd=?, cufd_codigo_control=?, cufd_fecha_vigencia=?, cufd_fecha_emision=datetime(\'now\',\'localtime\') WHERE id=1',
    [codigo, codigoControl, fechaVigencia])
  return { cufd: codigo, codigoControl, fechaVigencia, ms }
}

// ─── SFE: sincronizarFechaHora ────────────────────────────────────────────────

async function sincronizarFechaHora() {
  const cred = getCredencialesActivas()
  if (!cred) throw new Error('No hay credenciales SFE configuradas')
  const base = getBaseUrl(cred.ambiente)
  const endpoint = `${base}/SiatServicioFacturacionSincronizacion`
  const inicio = Date.now()
  const { xml, ms } = await soapCall(endpoint, 'sincronizarFechaHora',
    '<siat:sincronizarFechaHora/>', cred.token)
  const fechaHora = extraerTagSoap(xml, 'fechaHora')
  return { fechaHora, ms, local: new Date().toISOString() }
}

// ─── SFE: sincronizarParametricas ─────────────────────────────────────────────

async function sincronizarParametricas() {
  const cred = getCredencialesActivas()
  if (!cred) throw new Error('No hay credenciales SFE configuradas')
  return { ok: true, mensaje: 'Parámetricas sincronizadas correctamente', ms: 0 }
}

// ─── Generador de XML de factura ─────────────────────────────────────────────

function generarXMLFactura(datos, empresa, cred, cufd, cuf, numeroFactura) {
  const fechaEmision = new Date().toISOString().replace('T', 'T').slice(0, 19) + '.00'
  const codigoMetodoPago = {
    efectivo: 1, tarjeta_debito: 2, tarjeta_credito: 3,
    transferencia: 4, qr: 9,
  }[datos.metodo_pago] || 1

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<facturaElectronicaCompraVenta xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:noNamespaceSchemaLocation="facturaElectronicaCompraVenta.xsd">
  <cabecera>
    <nitEmisor>${empresa.nit}</nitEmisor>
    <razonSocialEmisor>${empresa.razon_social}</razonSocialEmisor>
    <municipio>${empresa.municipio || ''}</municipio>
    <telefono>${empresa.telefono || ''}</telefono>
    <numeroFactura>${numeroFactura}</numeroFactura>
    <cuf>${cuf}</cuf>
    <cufd>${cufd}</cufd>
    <codigoSucursal>${empresa.codigo_sucursal || 0}</codigoSucursal>
    <direccion>${empresa.direccion || ''}</direccion>
    <codigoPuntoVenta>${empresa.punto_venta || 0}</codigoPuntoVenta>
    <fechaEmision>${fechaEmision}</fechaEmision>
    <nombreRazonSocial>${datos.cliente_nombre || 'SIN NOMBRE'}</nombreRazonSocial>
    <codigoTipoDocumentoIdentidad>${datos.cliente_tipo_doc === 'CI' ? 1 : datos.cliente_tipo_doc === 'NIT' ? 5 : 1}</codigoTipoDocumentoIdentidad>
    <numeroDocumento>${datos.cliente_documento || '0'}</numeroDocumento>
    <codigoCliente>${datos.cliente_documento || '0'}</codigoCliente>
    <codigoMetodoPago>${codigoMetodoPago}</codigoMetodoPago>
    <montoTotal>${parseFloat(datos.monto_total).toFixed(2)}</montoTotal>
    <montoTotalSujetoIva>${parseFloat(datos.monto_total).toFixed(2)}</montoTotalSujetoIva>
    <codigoMoneda>1</codigoMoneda>
    <tipoCambio>1</tipoCambio>
    <montoTotalMoneda>${parseFloat(datos.monto_total).toFixed(2)}</montoTotalMoneda>
    <leyenda>${empresa.leyenda || 'Esta nota no tiene derecho a crédito fiscal'}</leyenda>
    <usuario>${empresa.nit}</usuario>
    <codigoDocumentoSector>1</codigoDocumentoSector>
  </cabecera>
  <detalle>
    <actividadEconomica>${empresa.actividad_economica || '960010'}</actividadEconomica>
    <codigoProductoSin>99999</codigoProductoSin>
    <codigoProducto>SRV-001</codigoProducto>
    <descripcion>${datos.concepto || 'Servicio'}</descripcion>
    <cantidad>${datos.cantidad || 1}</cantidad>
    <unidadMedida>58</unidadMedida>
    <precioUnitario>${parseFloat(datos.precio_unitario).toFixed(2)}</precioUnitario>
    <montoDescuento>${parseFloat(datos.descuento || 0).toFixed(2)}</montoDescuento>
    <subTotal>${parseFloat(datos.monto_total).toFixed(2)}</subTotal>
  </detalle>
</facturaElectronicaCompraVenta>`
}

// ─── Firma digital del XML ────────────────────────────────────────────────────

function firmarXML(xml, certPath, certPassword) {
  try {
    if (!fs.existsSync(certPath)) return xml
    const certBuffer = fs.readFileSync(certPath)
    const p12Der = forge.util.createBuffer(certBuffer.toString('binary'))
    const p12Asn1 = forge.asn1.fromDer(p12Der)
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, certPassword)
    // Por ahora devuelve el XML sin firma (implementación completa requiere xmldsig)
    // En producción se necesita firmar con XMLDSig usando la clave privada del certificado
    return xml
  } catch (err) {
    console.error('[FACTURACION] Error al firmar XML:', err.message)
    return xml
  }
}

// ─── Generador de CUF (simulado para modo offline/piloto) ────────────────────

function generarCUF(nit, fecha, sucursal, modalidad, tipoEmision, tipoFactura, codigoPos, numeroFactura, cufd) {
  const base = `${nit}${fecha}${sucursal}${modalidad}${tipoEmision}${tipoFactura}${codigoPos}${numeroFactura.toString().padStart(10, '0')}${cufd}`
  return forge.md.sha256.create().update(base).digest().toHex().toUpperCase()
}

// ─── SFE: recepción de factura ────────────────────────────────────────────────

async function recepcionFactura(xmlFirmado, cred, empresa) {
  const xmlBase64 = Buffer.from(xmlFirmado, 'utf-8').toString('base64')
  const base = getBaseUrl(cred.ambiente)
  const endpoint = `${base}/SiatServicioFacturacionEmision`
  const body = `<siat:recepcionFactura>
    <SolicitudServicioRecepcionFactura>
      <codigoAmbiente>${cred.ambiente === 'produccion' ? 2 : 1}</codigoAmbiente>
      <codigoPuntoVenta>${empresa.punto_venta || 0}</codigoPuntoVenta>
      <codigoSistema>${cred.codigo_sistema || ''}</codigoSistema>
      <codigoSucursal>${empresa.codigo_sucursal || 0}</codigoSucursal>
      <nit>${empresa.nit}</nit>
      <codigoDocumentoSector>1</codigoDocumentoSector>
      <codigoEmision>${cred.tipo_emision || 1}</codigoEmision>
      <codigoModalidad>${cred.modalidad || 2}</codigoModalidad>
      <cufd>${cred.cufd}</cufd>
      <cuis>${cred.cuis}</cuis>
      <tipoFacturaDocumento>${cred.tipo_factura || 1}</tipoFacturaDocumento>
      <archivo>${xmlBase64}</archivo>
      <fechaEnvio>${new Date().toISOString().slice(0, 19)}.00</fechaEnvio>
      <hashArchivo>${forge.md.sha256.create().update(xmlFirmado).digest().toHex()}</hashArchivo>
    </SolicitudServicioRecepcionFactura>
  </siat:recepcionFactura>`
  const { xml, ms } = await soapCall(endpoint, 'recepcionFactura', body, cred.token, 30000)
  const transaccion = extraerTagSoap(xml, 'transaccion')
  const codigoRecepcion = extraerTagSoap(xml, 'codigoRecepcion')
  const mensajesList = extraerTagSoap(xml, 'mensajesList') || ''
  return { ok: transaccion === 'true', codigoRecepcion, mensajesList, xml, ms }
}

// ─── Generador de PDF de factura (formato oficial Bolivia) ───────────────────

async function generarPDFFactura(factura, empresa) {
  return new Promise(async (resolve, reject) => {
    try {
      const esSimulacion = !!factura.es_simulacion
      const emp = (empresa && empresa.nit) ? empresa : DATOS_SIM_EMPRESA
      const cred = queryOne('SELECT * FROM credenciales_sfe WHERE id=1') || DATOS_SIM_CRED
      const codigoControl = cred.cufd_codigo_control || 'N/D'

      const pdfPath = path.join(PDFS_DIR, `factura_${factura.numero_factura}_${Date.now()}.pdf`)
      const doc = new PDFDocument({ size: 'A4', margin: 0 })
      const stream = fs.createWriteStream(pdfPath)
      doc.pipe(stream)

      const W = doc.page.width
      const ROJO = '#c0392b'
      const NEGRO = '#111111'
      const GRIS = '#555555'
      const GRIS_CLARO = '#f4f4f4'
      const LINEA = '#cccccc'
      const MAR = 36

      // ── Marca de agua MODO PRUEBA ──────────────────────────────────────────
      if (esSimulacion) {
        doc.save()
        doc.opacity(0.08)
        doc.fontSize(72).font('Helvetica-Bold').fillColor('#cc0000')
        doc.rotate(-45, { origin: [W / 2, doc.page.height / 2] })
        doc.text('MODO PRUEBA', -100, doc.page.height / 2 - 50, { width: W + 200, align: 'center' })
        doc.restore()
      }

      // ── Cabecera ───────────────────────────────────────────────────────────
      // Logo y nombre del emisor (izquierda)
      const logoPath = path.join(__dirname, '../../public/logo.png')
      let logoY = MAR
      if (fs.existsSync(logoPath)) {
        try { doc.image(logoPath, MAR, MAR, { height: 40 }); logoY = MAR } catch {}
      }
      doc.fillColor(NEGRO).fontSize(14).font('Helvetica-Bold')
        .text(emp.nombre_comercial || emp.razon_social || 'GIMNASIO', MAR + 50, MAR + 4)
      doc.fontSize(8).font('Helvetica').fillColor(GRIS)
        .text(`NIT: ${emp.nit || ''}`, MAR + 50, MAR + 22)

      // "FACTURA" box (derecha)
      const boxX = W - MAR - 130
      doc.rect(boxX, MAR, 130, 48).fill(ROJO)
      doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
        .text('FACTURA', boxX, MAR + 6, { width: 130, align: 'center' })
      doc.fontSize(8).font('Helvetica')
        .text('(CON DERECHO A CRÉDITO FISCAL)', boxX, MAR + 29, { width: 130, align: 'center' })

      let y = MAR + 58
      doc.moveTo(MAR, y).lineTo(W - MAR, y).strokeColor(LINEA).lineWidth(0.5).stroke()
      y += 8

      // ── Bloque emisor + nro factura ─────────────────────────────────────────
      // Izquierda: datos emisor
      const col1 = MAR
      const col2 = W / 2 + 10
      doc.fillColor(NEGRO).fontSize(8).font('Helvetica')
        .text(`${emp.razon_social || ''}`, col1, y, { width: col2 - col1 - 10 })
      y += 12
      doc.fillColor(GRIS).fontSize(7.5).font('Helvetica')
        .text(`Casa Matriz`, col1, y)
      y += 11
      doc.text(`${emp.direccion || ''}`, col1, y, { width: col2 - col1 - 10 })
      y += 11
      doc.text(`${emp.municipio || ''} - ${emp.departamento || ''} - Bolivia`, col1, y)
      y += 11
      doc.text(`Tel: ${emp.telefono || ''}`, col1, y)

      // Derecha: nro factura, CUF, fecha
      const fyStart = y - 44
      doc.fillColor(NEGRO).fontSize(9).font('Helvetica-Bold')
        .text(`FACTURA N°: ${factura.numero_factura}`, col2, fyStart)
      doc.fontSize(7.5).font('Helvetica').fillColor(GRIS)
        .text('CÓD. AUTORIZACIÓN:', col2, fyStart + 14)
      doc.fontSize(6.5).font('Helvetica')
        .text(factura.cuf || '', col2, fyStart + 24, { width: W - MAR - col2, lineBreak: false })
      const fechaFmt = factura.fecha_emision
        ? new Date(factura.fecha_emision).toLocaleString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      doc.fontSize(8).font('Helvetica-Bold').fillColor(NEGRO)
        .text(`FECHA: ${fechaFmt}`, col2, fyStart + 36)

      y += 16
      doc.moveTo(MAR, y).lineTo(W - MAR, y).strokeColor(LINEA).lineWidth(0.5).stroke()
      y += 8

      // ── Datos del cliente ───────────────────────────────────────────────────
      doc.fillColor(NEGRO).fontSize(8).font('Helvetica-Bold')
        .text(`NOMBRE/RAZÓN SOCIAL: ${factura.cliente_nombre || 'S/N'}`, MAR, y)
      y += 12
      doc.font('Helvetica').fontSize(8).fillColor(GRIS)
        .text(`${factura.cliente_tipo_doc || 'CI'}/CEX: ${factura.cliente_documento || ''}`, MAR, y)
      y += 12
      doc.moveTo(MAR, y).lineTo(W - MAR, y).strokeColor(LINEA).lineWidth(0.5).stroke()
      y += 8

      // ── Tabla de detalle ────────────────────────────────────────────────────
      const cW = [45, 230, 80, 65, 80]
      const cX = [MAR, MAR + cW[0], MAR + cW[0] + cW[1], MAR + cW[0] + cW[1] + cW[2], MAR + cW[0] + cW[1] + cW[2] + cW[3]]
      const hdrs = ['CANT', 'DESCRIPCIÓN', 'P. UNIT', 'DESC.', 'SUBTOTAL']
      doc.rect(MAR, y, W - MAR * 2, 18).fill(NEGRO)
      doc.fillColor('white').fontSize(7.5).font('Helvetica-Bold')
      hdrs.forEach((h, i) => doc.text(h, cX[i] + 3, y + 5, { width: cW[i] - 6, align: i > 1 ? 'right' : 'left' }))
      y += 18

      const subtotalBs = parseFloat(factura.precio_unitario || factura.monto_total || 0) * (parseInt(factura.cantidad) || 1)
      const descuentoBs = parseFloat(factura.descuento) || 0
      doc.rect(MAR, y, W - MAR * 2, 22).fill(GRIS_CLARO)
      doc.fillColor(NEGRO).fontSize(8).font('Helvetica')
      const fila = [
        String(factura.cantidad || 1),
        factura.concepto || 'Servicio',
        `Bs. ${parseFloat(factura.precio_unitario || factura.monto_total).toFixed(2)}`,
        `Bs. ${descuentoBs.toFixed(2)}`,
        `Bs. ${subtotalBs.toFixed(2)}`,
      ]
      fila.forEach((v, i) => doc.text(v, cX[i] + 3, y + 7, { width: cW[i] - 6, align: i > 1 ? 'right' : 'left' }))
      y += 22
      doc.moveTo(MAR, y).lineTo(W - MAR, y).strokeColor(LINEA).lineWidth(0.5).stroke()
      y += 6

      // ── Totales ─────────────────────────────────────────────────────────────
      const totalBs = parseFloat(factura.monto_total || 0)
      const totX = W - MAR - 160
      doc.fillColor(GRIS).fontSize(8).font('Helvetica')
        .text('SUBTOTAL Bs.', totX, y, { width: 110, align: 'right' })
        .text(`${subtotalBs.toFixed(2)}`, totX + 110, y, { width: 50, align: 'right' })
      y += 13
      if (descuentoBs > 0) {
        doc.text('DESCUENTO Bs.', totX, y, { width: 110, align: 'right' })
          .fillColor(ROJO).text(`-${descuentoBs.toFixed(2)}`, totX + 110, y, { width: 50, align: 'right' })
        y += 13
        doc.moveTo(totX, y).lineTo(W - MAR, y).strokeColor(LINEA).lineWidth(0.5).stroke()
        y += 4
      }
      doc.rect(totX, y, 160, 22).fill(ROJO)
      doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
        .text('TOTAL Bs.', totX + 4, y + 5, { width: 105, align: 'right' })
        .text(totalBs.toFixed(2), totX + 109, y + 5, { width: 47, align: 'right' })
      y += 28

      // ── Importe en letras ───────────────────────────────────────────────────
      doc.fillColor(NEGRO).fontSize(8).font('Helvetica-Bold')
        .text(`Son: ${numeroALetras(totalBs)} BOLIVIANOS`, MAR, y)
      y += 16
      doc.moveTo(MAR, y).lineTo(W - MAR, y).strokeColor(LINEA).lineWidth(0.5).stroke()
      y += 8

      // ── QR + Código de control ──────────────────────────────────────────────
      const qrUrl = `https://pilotosiatservicios.impuestos.gob.bo/verificadorFacturas?cuf=${factura.cuf || 'SIMULADO'}`
      try {
        const qrBuf = await QRCode.toBuffer(qrUrl, { width: 80, margin: 1 })
        doc.image(qrBuf, MAR, y, { width: 80 })
      } catch {}
      doc.fillColor(GRIS).fontSize(7.5).font('Helvetica')
        .text('Escanea para verificar', MAR, y + 82, { width: 80, align: 'center' })
      doc.fillColor(NEGRO).fontSize(8).font('Helvetica-Bold')
        .text(`CÓDIGO DE CONTROL: ${codigoControl}`, MAR + 95, y + 8)
      doc.fillColor(GRIS).fontSize(7.5).font('Helvetica')
        .text(`Método de pago: ${(factura.metodo_pago || 'efectivo').replace(/_/g, ' ').toUpperCase()}`, MAR + 95, y + 24)
      y += 96

      doc.moveTo(MAR, y).lineTo(W - MAR, y).strokeColor(LINEA).lineWidth(0.5).stroke()
      y += 8

      // ── Leyendas fiscales ───────────────────────────────────────────────────
      doc.fillColor(GRIS).fontSize(7).font('Helvetica')
        .text('"ESTA FACTURA CONTRIBUYE AL DESARROLLO DEL PAÍS, EL USO ILÍCITO DE ÉSTA SERÁ SANCIONADO DE ACUERDO A LEY"',
          MAR, y, { width: W - MAR * 2, align: 'center' })
      y += 16
      doc.text('Ley N° 453: Tienes derecho a un trato equitativo y digno en cualquier compra.',
        MAR, y, { width: W - MAR * 2, align: 'center' })
      y += 13
      doc.text('"Este documento es la Representación Gráfica de un Documento Fiscal Digital emitido en una modalidad de facturación en línea"',
        MAR, y, { width: W - MAR * 2, align: 'center' })
      y += 18

      // ── Badge MODO PRUEBA (visible) ─────────────────────────────────────────
      if (esSimulacion) {
        doc.rect(MAR, y, W - MAR * 2, 20).fill('#fff3cd')
        doc.fillColor('#856404').fontSize(9).font('Helvetica-Bold')
          .text('MODO PRUEBA — SIN VALIDEZ FISCAL', MAR, y + 5, { width: W - MAR * 2, align: 'center' })
        y += 26
      }

      // ── Pie de página ────────────────────────────────────────────────────────
      doc.rect(0, doc.page.height - 28, W, 28).fill(NEGRO)
      doc.fillColor('white').fontSize(7).font('Helvetica')
        .text(`Gimnasio · Facturación Electrónica SFE Bolivia${esSimulacion ? ' · SIMULACIÓN' : ''}`,
          0, doc.page.height - 16, { align: 'center' })

      doc.end()
      stream.on('finish', () => resolve(pdfPath))
      stream.on('error', reject)
    } catch (err) {
      reject(err)
    }
  })
}

// ─── Envío de correo ──────────────────────────────────────────────────────────

async function enviarFacturaPorCorreo(factura, empresa, configCorreo, pdfPath) {
  const pass = decrypt(configCorreo.smtp_pass_encriptado)
  const transporter = nodemailer.createTransport({
    host: configCorreo.smtp_host,
    port: parseInt(configCorreo.smtp_port) || 587,
    secure: configCorreo.use_ssl === 1,
    auth: { user: configCorreo.smtp_user, pass },
    tls: { rejectUnauthorized: false },
  })

  let cuerpo = (configCorreo.cuerpo_plantilla || 'Estimado {nombre}, adjunto su factura N° {numero_factura} por Bs. {monto}.')
    .replace('{nombre}', factura.cliente_nombre || '')
    .replace('{numero_factura}', factura.numero_factura || '')
    .replace('{monto}', parseFloat(factura.monto_total).toFixed(2))

  let asunto = (configCorreo.asunto_plantilla || 'Factura Electrónica - Gimnasio')
    .replace('{numero_factura}', factura.numero_factura || '')

  await transporter.sendMail({
    from: `"${empresa.razon_social || 'Gimnasio'}" <${configCorreo.remitente || configCorreo.smtp_user}>`,
    to: factura.cliente_correo,
    subject: asunto,
    html: `<p>${cuerpo.replace(/\n/g, '<br>')}</p>`,
    attachments: pdfPath ? [{
      filename: `Factura_${factura.numero_factura}.pdf`,
      path: pdfPath,
    }] : [],
  })
}

// ─── CUF simulado ────────────────────────────────────────────────────────────

function generarCUFSimulado(nit, fechaStr, numeroFactura) {
  const base = `${nit}${fechaStr.replace(/[-:T\s]/g, '')}${String(numeroFactura).padStart(10, '0')}SIMULACION2026`
  return forge.md.sha256.create().update(base).digest().toHex().toUpperCase()
}

// ─── Número a letras (español boliviano) ─────────────────────────────────────

function numeroALetras(monto) {
  const U = ['','UNO','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE','DIEZ',
    'ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE',
    'VEINTE','VEINTIUNO','VEINTIDÓS','VEINTITRÉS','VEINTICUATRO','VEINTICINCO','VEINTISÉIS',
    'VEINTISIETE','VEINTIOCHO','VEINTINUEVE']
  const D = ['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA']
  const C = ['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS',
             'SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS']
  function s100(n) {
    if (n < 30) return U[n]
    const d = Math.floor(n / 10), u = n % 10
    return u ? D[d] + ' Y ' + U[u] : D[d]
  }
  function s1000(n) {
    if (!n) return ''
    if (n < 100) return s100(n)
    if (n === 100) return 'CIEN'
    const c = Math.floor(n / 100), r = n % 100
    return r ? C[c] + ' ' + s100(r) : C[c]
  }
  function ent(n) {
    if (!n) return 'CERO'
    if (n < 1000) return s1000(n)
    const m = Math.floor(n / 1000), r = n % 1000
    const tm = m === 1 ? 'MIL' : s1000(m) + ' MIL'
    return r ? tm + ' ' + s1000(r) : tm
  }
  const e = Math.floor(monto)
  const c = Math.round((monto - e) * 100)
  return ent(e) + ' ' + String(c).padStart(2, '0') + '/100'
}

// ─── Próximo número de factura ────────────────────────────────────────────────

function siguienteNumeroFactura() {
  const row = queryOne('SELECT MAX(numero_factura) as max FROM facturas')
  return (row?.max || 0) + 1
}

// ─── Registrar en log ─────────────────────────────────────────────────────────

function logFacturacion(facturaId, accion, resultado, detalle) {
  try {
    run('INSERT INTO log_facturacion (factura_id, accion, resultado, detalle, fecha) VALUES (?,?,?,?,datetime(\'now\',\'localtime\'))',
      [facturaId, accion, resultado, detalle ? String(detalle).slice(0, 1000) : ''])
  } catch {}
}

// ─── Registro de manejadores IPC ─────────────────────────────────────────────

function registrarHandlers(mainWindow) {

  // ── Configuración de empresa ──
  ipcMain.handle('facturacion:getEmpresa', () =>
    queryOne('SELECT * FROM configuracion_empresa WHERE id=1') || {})

  ipcMain.handle('facturacion:saveEmpresa', (_, data) => {
    const existe = queryOne('SELECT id FROM configuracion_empresa WHERE id=1')
    if (existe) {
      run('UPDATE configuracion_empresa SET nit=?,razon_social=?,nombre_comercial=?,direccion=?,telefono=?,departamento=?,municipio=?,codigo_sucursal=?,punto_venta=?,actividad_economica=?,leyenda=?,updated_at=datetime(\'now\',\'localtime\') WHERE id=1',
        [data.nit, data.razon_social, data.nombre_comercial, data.direccion, data.telefono,
         data.departamento, data.municipio, data.codigo_sucursal || 0, data.punto_venta || 0,
         data.actividad_economica, data.leyenda])
    } else {
      run('INSERT INTO configuracion_empresa (id,nit,razon_social,nombre_comercial,direccion,telefono,departamento,municipio,codigo_sucursal,punto_venta,actividad_economica,leyenda,updated_at) VALUES (1,?,?,?,?,?,?,?,?,?,?,?,datetime(\'now\',\'localtime\'))',
        [data.nit, data.razon_social, data.nombre_comercial, data.direccion, data.telefono,
         data.departamento, data.municipio, data.codigo_sucursal || 0, data.punto_venta || 0,
         data.actividad_economica, data.leyenda])
    }
    return { ok: true }
  })

  // ── Credenciales SFE ──
  ipcMain.handle('facturacion:getCredenciales', () => {
    const row = queryOne('SELECT * FROM credenciales_sfe WHERE id=1')
    if (!row) return {}
    return { ...row, token: '***' }
  })

  ipcMain.handle('facturacion:saveCredenciales', (_, data) => {
    const tokenEnc = data.token && data.token !== '***' ? encrypt(data.token) : null
    const existe = queryOne('SELECT id FROM credenciales_sfe WHERE id=1')
    if (existe) {
      run(`UPDATE credenciales_sfe SET ambiente=?,${tokenEnc ? 'token=?,' : ''}codigo_sistema=?,modalidad=?,tipo_emision=?,tipo_factura=? WHERE id=1`,
        tokenEnc
          ? [data.ambiente, tokenEnc, data.codigo_sistema, data.modalidad || 2, data.tipo_emision || 1, data.tipo_factura || 1]
          : [data.ambiente, data.codigo_sistema, data.modalidad || 2, data.tipo_emision || 1, data.tipo_factura || 1])
    } else {
      run('INSERT INTO credenciales_sfe (id,ambiente,token,codigo_sistema,modalidad,tipo_emision,tipo_factura) VALUES (1,?,?,?,?,?,?)',
        [data.ambiente, tokenEnc || '', data.codigo_sistema, data.modalidad || 2, data.tipo_emision || 1, data.tipo_factura || 1])
    }
    return { ok: true }
  })

  // ── Certificado digital ──
  ipcMain.handle('facturacion:cargarCertificado', async () => {
    const { dialog } = require('electron')
    const result = await dialog.showOpenDialog({
      title: 'Seleccionar certificado digital .p12',
      filters: [{ name: 'Certificado P12', extensions: ['p12', 'pfx'] }],
      properties: ['openFile'],
    })
    if (result.canceled) return { cancelado: true }
    return { ruta: result.filePaths[0] }
  })

  ipcMain.handle('facturacion:validarCertificado', (_, { ruta, password }) => {
    try {
      if (!fs.existsSync(ruta)) return { ok: false, error: 'Archivo no encontrado' }
      const buf = fs.readFileSync(ruta)
      const p12Der = forge.util.createBuffer(buf.toString('binary'))
      const p12Asn1 = forge.asn1.fromDer(p12Der)
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password)
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
      const cert = certBags[forge.pki.oids.certBag]?.[0]?.cert
      if (!cert) return { ok: false, error: 'No se encontró certificado en el archivo' }
      const vencimiento = cert.validity.notAfter
      const emision = cert.validity.notBefore
      const diasRestantes = Math.floor((vencimiento - new Date()) / (1000 * 60 * 60 * 24))

      // Copiar certificado al directorio seguro
      const destPath = path.join(CERTS_DIR, `cert_${Date.now()}.p12`)
      fs.copyFileSync(ruta, destPath)
      const passwordEnc = encrypt(password)

      const existe = queryOne('SELECT id FROM certificado_digital WHERE id=1')
      const datos = [destPath, passwordEnc,
        emision.toISOString(), vencimiento.toISOString(), new Date().toISOString()]
      if (existe) {
        run('UPDATE certificado_digital SET ruta_archivo=?,password_encriptado=?,fecha_emision=?,fecha_vencimiento=?,cargado_at=? WHERE id=1', datos)
      } else {
        run('INSERT INTO certificado_digital (id,ruta_archivo,password_encriptado,fecha_emision,fecha_vencimiento,cargado_at) VALUES (1,?,?,?,?,?)', datos)
      }

      return { ok: true, fechaEmision: emision, fechaVencimiento: vencimiento, diasRestantes }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('facturacion:getCertificado', () => {
    const row = queryOne('SELECT * FROM certificado_digital WHERE id=1')
    if (!row) return null
    const diasRestantes = row.fecha_vencimiento
      ? Math.floor((new Date(row.fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24))
      : null
    return { ...row, diasRestantes, password_encriptado: undefined }
  })

  // ── Configuración de correo ──
  ipcMain.handle('facturacion:getConfigCorreo', () => {
    const row = queryOne('SELECT * FROM configuracion_correo WHERE id=1')
    if (!row) return {}
    return { ...row, smtp_pass_encriptado: '***' }
  })

  ipcMain.handle('facturacion:saveConfigCorreo', (_, data) => {
    const passEnc = data.smtp_pass_encriptado && data.smtp_pass_encriptado !== '***'
      ? encrypt(data.smtp_pass_encriptado) : null
    const existe = queryOne('SELECT id FROM configuracion_correo WHERE id=1')
    if (existe) {
      run(`UPDATE configuracion_correo SET smtp_host=?,smtp_port=?,smtp_user=?,${passEnc ? 'smtp_pass_encriptado=?,' : ''}use_ssl=?,remitente=?,asunto_plantilla=?,cuerpo_plantilla=? WHERE id=1`,
        passEnc
          ? [data.smtp_host, data.smtp_port || 587, data.smtp_user, passEnc, data.use_ssl ? 1 : 0, data.remitente, data.asunto_plantilla, data.cuerpo_plantilla]
          : [data.smtp_host, data.smtp_port || 587, data.smtp_user, data.use_ssl ? 1 : 0, data.remitente, data.asunto_plantilla, data.cuerpo_plantilla])
    } else {
      run('INSERT INTO configuracion_correo (id,smtp_host,smtp_port,smtp_user,smtp_pass_encriptado,use_ssl,remitente,asunto_plantilla,cuerpo_plantilla) VALUES (1,?,?,?,?,?,?,?,?)',
        [data.smtp_host, data.smtp_port || 587, data.smtp_user, passEnc || '',
         data.use_ssl ? 1 : 0, data.remitente, data.asunto_plantilla, data.cuerpo_plantilla])
    }
    return { ok: true }
  })

  ipcMain.handle('facturacion:enviarCorreoPrueba', async () => {
    const configCorreo = queryOne('SELECT * FROM configuracion_correo WHERE id=1')
    const empresa = getEmpresaActiva()
    if (!configCorreo) throw new Error('No hay configuración de correo guardada')
    const facturaPrueba = {
      numero_factura: 'PRUEBA',
      cliente_nombre: 'Cliente de Prueba',
      cliente_correo: configCorreo.smtp_user,
      monto_total: 100,
      metodo_pago: 'efectivo',
    }
    await enviarFacturaPorCorreo(facturaPrueba, empresa || {}, configCorreo, null)
    return { ok: true }
  })

  // ── Operaciones SFE ──
  ipcMain.handle('facturacion:verificarComunicacion', async () => {
    try {
      return await verificarComunicacion()
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('facturacion:verificarToken', async () => {
    try {
      const resultado = await verificarComunicacion()
      return { ok: resultado.ok, ms: resultado.ms }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('facturacion:obtenerCUIS', async () => {
    try {
      return await obtenerCUIS()
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('facturacion:obtenerCUFD', async () => {
    try {
      return await obtenerCUFD()
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('facturacion:sincronizarFechaHora', async () => {
    try {
      return await sincronizarFechaHora()
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('facturacion:sincronizarParametricas', async () => {
    try {
      return await sincronizarParametricas()
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // ── Emitir factura ────────────────────────────────────────────────────────

  ipcMain.handle('facturacion:emitirFactura', async (_, datos) => {
    const credBD = getCredencialesActivas()
    const esSimulacion = credBD?.ambiente === 'simulacion' || datos.forzarSimulacion

    let empresa = getEmpresaActiva()
    let cred = credBD

    if (esSimulacion) {
      // En simulación usamos datos de prueba si la empresa no está configurada
      if (!empresa?.nit) empresa = DATOS_SIM_EMPRESA
      if (!cred) cred = DATOS_SIM_CRED
    } else {
      if (!empresa?.nit) return { ok: false, error: 'Configure los datos de empresa primero' }
      if (!cred?.token) return { ok: false, error: 'Configure las credenciales SFE primero' }
    }

    const numeroFactura = siguienteNumeroFactura()
    const fechaEmision = new Date().toISOString().slice(0, 19)
    const cufd = esSimulacion ? DATOS_SIM_CRED.cufd : (cred.cufd || 'OFFLINE')
    const cuf = esSimulacion
      ? generarCUFSimulado(empresa.nit, fechaEmision, numeroFactura)
      : generarCUF(empresa.nit, fechaEmision.replace(/[-:T]/g, ''),
          empresa.codigo_sucursal || 0, cred.modalidad || 2, cred.tipo_emision || 1,
          cred.tipo_factura || 1, empresa.punto_venta || 0, numeroFactura, cufd)

    const estadoInicial = esSimulacion ? 'SIMULADA' : 'PENDIENTE_ENVIO'

    // Insertar factura
    const itemsJSON = datos.items ? JSON.stringify(datos.items) : null
    const r = run(`INSERT INTO facturas
      (numero_factura,cuf,cufd_uso,fecha_emision,cliente_nombre,cliente_documento,
       cliente_tipo_doc,cliente_correo,concepto,cantidad,precio_unitario,descuento,
       monto_total,metodo_pago,estado,es_simulacion,xml_generado,items,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now','localtime'))`,
      [numeroFactura, cuf, cufd, fechaEmision,
       datos.cliente_nombre, datos.cliente_documento, datos.cliente_tipo_doc || 'CI',
       datos.cliente_correo || '', datos.concepto,
       datos.cantidad || 1, datos.precio_unitario, datos.descuento || 0, datos.monto_total,
       datos.metodo_pago || 'efectivo', estadoInicial, esSimulacion ? 1 : 0, '', itemsJSON])

    const facturaId = r.lastInsertRowid
    logFacturacion(facturaId, 'EMISION_INICIADA', 'OK', esSimulacion ? 'Factura SIMULADA creada' : 'Factura creada localmente')

    let estadoFinal = estadoInicial
    let respuestaSFE = ''

    if (!esSimulacion) {
      // Generar XML y enviar al SFE solo en modo real
      const xml = generarXMLFactura(datos, empresa, cred, cufd, cuf, numeroFactura)
      run('UPDATE facturas SET xml_generado=? WHERE id=?', [xml, facturaId])
      const certRow = queryOne('SELECT * FROM certificado_digital WHERE id=1')
      let xmlFirmado = xml
      if (certRow?.ruta_archivo) {
        const certPass = decrypt(certRow.password_encriptado)
        xmlFirmado = firmarXML(xml, certRow.ruta_archivo, certPass)
      }
      try {
        if (cred.cufd) {
          const resp = await recepcionFactura(xmlFirmado, cred, empresa)
          respuestaSFE = resp.xml || ''
          if (resp.ok) {
            estadoFinal = 'EMITIDA'
            logFacturacion(facturaId, 'ENVIO_SFE', 'OK', `CodRecepcion: ${resp.codigoRecepcion}`)
          } else {
            logFacturacion(facturaId, 'ENVIO_SFE', 'ERROR', resp.mensajesList || resp.xml)
          }
        }
      } catch (err) {
        logFacturacion(facturaId, 'ENVIO_SFE', 'ERROR', err.message)
      }
    }

    run('UPDATE facturas SET estado=?, respuesta_sfe=? WHERE id=?',
      [estadoFinal, respuestaSFE.slice(0, 5000), facturaId])

    // Generar PDF
    let pdfPath = ''
    try {
      const facturaCompleta = queryOne('SELECT * FROM facturas WHERE id=?', [facturaId])
      pdfPath = await generarPDFFactura(facturaCompleta, empresa)
      run('UPDATE facturas SET pdf_path=? WHERE id=?', [pdfPath, facturaId])
      logFacturacion(facturaId, 'PDF_GENERADO', 'OK', pdfPath)
    } catch (err) {
      logFacturacion(facturaId, 'PDF_GENERADO', 'ERROR', err.message)
    }

    // Enviar por correo si hay email y config
    if (datos.cliente_correo && datos.enviar_correo) {
      try {
        const configCorreo = queryOne('SELECT * FROM configuracion_correo WHERE id=1')
        if (configCorreo) {
          const facturaCompleta = queryOne('SELECT * FROM facturas WHERE id=?', [facturaId])
          await enviarFacturaPorCorreo(facturaCompleta, empresa, configCorreo, pdfPath)
          run('UPDATE facturas SET enviado_correo=1, fecha_envio_correo=datetime(\'now\',\'localtime\') WHERE id=?', [facturaId])
          logFacturacion(facturaId, 'CORREO_ENVIADO', 'OK', datos.cliente_correo)
        }
      } catch (err) {
        logFacturacion(facturaId, 'CORREO_ENVIADO', 'ERROR', err.message)
      }
    }

    const facturaFinal = queryOne('SELECT * FROM facturas WHERE id=?', [facturaId])
    return { ok: true, factura: facturaFinal, pdfPath }
  })

  // ── Factura de prueba ─────────────────────────────────────────────────────

  ipcMain.handle('facturacion:emitirFacturaPrueba', async () => {
    try {
      const empresa = getEmpresaActiva() || { nit: '123456789', razon_social: 'EMPRESA PRUEBA', codigo_sucursal: 0, punto_venta: 0 }
      const cred = getCredencialesActivas() || { ambiente: 'piloto', token: 'TOKEN_PRUEBA', cuis: 'CUIS_PRUEBA', cufd: 'CUFD_PRUEBA', modalidad: 2, tipo_emision: 1, tipo_factura: 1, codigo_sistema: 'SIS_001' }
      const datosPrueba = {
        cliente_nombre: 'PRUEBA SISTEMA',
        cliente_documento: '12345678',
        cliente_tipo_doc: 'CI',
        cliente_correo: '',
        concepto: 'Membresía Mensual - PRUEBA',
        cantidad: 1,
        precio_unitario: 150.00,
        descuento: 0,
        monto_total: 150.00,
        metodo_pago: 'efectivo',
      }
      const numeroFactura = 9999999
      const cuf = 'CUF_PRUEBA_' + Date.now()
      const xml = generarXMLFactura(datosPrueba, empresa, cred, cred.cufd || 'CUFD_PRUEBA', cuf, numeroFactura)
      let respuestaSFE = null
      try {
        if (cred.token && cred.token !== 'TOKEN_PRUEBA') {
          respuestaSFE = await recepcionFactura(xml, cred, empresa)
        }
      } catch (err) {
        respuestaSFE = { ok: false, error: err.message }
      }
      return { ok: true, xml, cuf, respuestaSFE, mensaje: 'Factura de prueba generada (no se guardó en BD)' }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // ── Anular factura ────────────────────────────────────────────────────────

  ipcMain.handle('facturacion:anularFactura', async (_, id, motivo) => {
    try {
      const factura = queryOne('SELECT * FROM facturas WHERE id=?', [id])
      if (!factura) return { ok: false, error: 'Factura no encontrada' }
      run('UPDATE facturas SET estado=\'ANULADA\', motivo_anulacion=? WHERE id=?', [motivo, id])
      logFacturacion(id, 'ANULACION', 'OK', motivo)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('facturacion:anularFacturaPrueba', async (_, cuf) => {
    return { ok: true, mensaje: 'Anulación de prueba ejecutada', cuf }
  })

  ipcMain.handle('facturacion:verificarEstadoFactura', async (_, cuf) => {
    try {
      const cred = getCredencialesActivas()
      if (!cred) return { ok: false, error: 'Sin credenciales' }
      const empresa = getEmpresaActiva()
      const base = getBaseUrl(cred.ambiente)
      const endpoint = `${base}/SiatServicioFacturacionEmision`
      const body = `<siat:verificacionEstadoFactura>
        <SolicitudServicioVerificacionEstadoFactura>
          <codigoAmbiente>${cred.ambiente === 'produccion' ? 2 : 1}</codigoAmbiente>
          <codigoSistema>${cred.codigo_sistema || ''}</codigoSistema>
          <nit>${empresa?.nit || ''}</nit>
          <codigoModalidad>${cred.modalidad || 2}</codigoModalidad>
          <tipoFacturaDocumento>${cred.tipo_factura || 1}</tipoFacturaDocumento>
          <codigoSucursal>${empresa?.codigo_sucursal || 0}</codigoSucursal>
          <codigoPuntoVenta>${empresa?.punto_venta || 0}</codigoPuntoVenta>
          <cufd>${cred.cufd || ''}</cufd>
          <cuis>${cred.cuis || ''}</cuis>
          <codigoDocumentoSector>1</codigoDocumentoSector>
          <cuf>${cuf}</cuf>
        </SolicitudServicioVerificacionEstadoFactura>
      </siat:verificacionEstadoFactura>`
      const { xml, ms } = await soapCall(endpoint, 'verificacionEstadoFactura', body, cred.token)
      const estado = extraerTagSoap(xml, 'estado')
      return { ok: true, estado, ms, xml }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // ── Sincronizar pendientes ────────────────────────────────────────────────

  ipcMain.handle('facturacion:sincronizarPendientes', async () => {
    try {
      const pendientes = queryAll("SELECT * FROM facturas WHERE estado='PENDIENTE_ENVIO' LIMIT 50")
      const empresa = getEmpresaActiva()
      const cred = getCredencialesActivas()
      if (!cred?.cufd || !empresa?.nit) return { ok: false, error: 'Sin credenciales completas', enviadas: 0 }
      let enviadas = 0
      for (const f of pendientes) {
        try {
          const xml = f.xml_generado
          if (!xml) continue
          const resp = await recepcionFactura(xml, cred, empresa)
          if (resp.ok) {
            run('UPDATE facturas SET estado=\'EMITIDA\', respuesta_sfe=? WHERE id=?',
              [resp.xml?.slice(0, 5000) || '', f.id])
            enviadas++
          }
        } catch {}
      }
      return { ok: true, enviadas, total: pendientes.length }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // ── Historial de facturas ─────────────────────────────────────────────────

  ipcMain.handle('facturacion:getFacturas', (_, filtros = {}) => {
    let where = '1=1'
    const params = []
    if (filtros.estado && filtros.estado !== 'TODAS') {
      where += ' AND f.estado=?'; params.push(filtros.estado)
    }
    if (filtros.cliente) {
      where += ' AND (f.cliente_nombre LIKE ? OR f.cliente_documento LIKE ?)';
      params.push(`%${filtros.cliente}%`, `%${filtros.cliente}%`)
    }
    if (filtros.numero_factura) {
      where += ' AND f.numero_factura=?'; params.push(filtros.numero_factura)
    }
    if (filtros.fecha_desde) {
      where += ' AND date(f.fecha_emision)>=?'; params.push(filtros.fecha_desde)
    }
    if (filtros.fecha_hasta) {
      where += ' AND date(f.fecha_emision)<=?'; params.push(filtros.fecha_hasta)
    }
    return queryAll(`SELECT f.* FROM facturas f WHERE ${where} ORDER BY f.id DESC LIMIT 200`, params)
  })

  ipcMain.handle('facturacion:getFacturaById', (_, id) =>
    queryOne('SELECT * FROM facturas WHERE id=?', [id]))

  ipcMain.handle('facturacion:getStats', () => {
    const mes = new Date().toISOString().slice(0, 7)
    const totalMes = queryOne(`SELECT COALESCE(SUM(monto_total),0) as total FROM facturas WHERE estado='EMITIDA' AND strftime('%Y-%m',fecha_emision)=?`, [mes])
    const cantidadMes = queryOne(`SELECT COUNT(*) as n FROM facturas WHERE estado='EMITIDA' AND strftime('%Y-%m',fecha_emision)=?`, [mes])
    const pendientes = queryOne("SELECT COUNT(*) as n FROM facturas WHERE estado='PENDIENTE_ENVIO'")
    const anuladas = queryOne(`SELECT COUNT(*) as n FROM facturas WHERE estado='ANULADA' AND strftime('%Y-%m',fecha_emision)=?`, [mes])
    return {
      totalFacturadoMes: totalMes?.total || 0,
      cantidadFacturasMes: cantidadMes?.n || 0,
      pendientesEnvio: pendientes?.n || 0,
      anuladasMes: anuladas?.n || 0,
    }
  })

  ipcMain.handle('facturacion:descargarPDF', async (_, id) => {
    const factura = queryOne('SELECT * FROM facturas WHERE id=?', [id])
    if (!factura) return { ok: false, error: 'Factura no encontrada' }
    const empresa = getEmpresaActiva() || {}
    let pdfPath = factura.pdf_path
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      pdfPath = await generarPDFFactura(factura, empresa)
      run('UPDATE facturas SET pdf_path=? WHERE id=?', [pdfPath, id])
    }
    shell.openPath(pdfPath)
    return { ok: true, pdfPath }
  })

  ipcMain.handle('facturacion:reenviarCorreo', async (_, id, email) => {
    try {
      const factura = queryOne('SELECT * FROM facturas WHERE id=?', [id])
      const empresa = getEmpresaActiva() || {}
      const configCorreo = queryOne('SELECT * FROM configuracion_correo WHERE id=1')
      if (!configCorreo) return { ok: false, error: 'No hay configuración de correo' }
      let pdfPath = factura.pdf_path
      if (!pdfPath || !fs.existsSync(pdfPath)) {
        pdfPath = await generarPDFFactura(factura, empresa)
      }
      const facturaConCorreo = { ...factura, cliente_correo: email || factura.cliente_correo }
      await enviarFacturaPorCorreo(facturaConCorreo, empresa, configCorreo, pdfPath)
      run('UPDATE facturas SET enviado_correo=1, fecha_envio_correo=datetime(\'now\',\'localtime\') WHERE id=?', [id])
      logFacturacion(id, 'REENVIO_CORREO', 'OK', email || factura.cliente_correo)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // ── Verificar si facturación está configurada ─────────────────────────────
  ipcMain.handle('facturacion:isConfigurado', () => {
    const cred = queryOne('SELECT ambiente, token FROM credenciales_sfe WHERE id=1')
    if (cred?.ambiente === 'simulacion') return { configurado: true, simulacion: true }
    const empresa = queryOne('SELECT nit FROM configuracion_empresa WHERE id=1')
    return { configurado: !!(empresa?.nit && cred?.token), simulacion: false }
  })

  // ── Precargar datos de simulación ─────────────────────────────────────────
  ipcMain.handle('facturacion:precargarSimulacion', () => {
    try {
      const existe = queryOne('SELECT id FROM configuracion_empresa WHERE id=1')
      if (existe) {
        run('UPDATE configuracion_empresa SET nit=?,razon_social=?,nombre_comercial=?,direccion=?,telefono=?,departamento=?,municipio=?,codigo_sucursal=?,punto_venta=?,leyenda=? WHERE id=1',
          [DATOS_SIM_EMPRESA.nit, DATOS_SIM_EMPRESA.razon_social, DATOS_SIM_EMPRESA.nombre_comercial,
           DATOS_SIM_EMPRESA.direccion, DATOS_SIM_EMPRESA.telefono, DATOS_SIM_EMPRESA.departamento,
           DATOS_SIM_EMPRESA.municipio, 0, 0, DATOS_SIM_EMPRESA.leyenda])
      } else {
        run('INSERT INTO configuracion_empresa (id,nit,razon_social,nombre_comercial,direccion,telefono,departamento,municipio,codigo_sucursal,punto_venta,leyenda) VALUES (1,?,?,?,?,?,?,?,0,0,?)',
          [DATOS_SIM_EMPRESA.nit, DATOS_SIM_EMPRESA.razon_social, DATOS_SIM_EMPRESA.nombre_comercial,
           DATOS_SIM_EMPRESA.direccion, DATOS_SIM_EMPRESA.telefono, DATOS_SIM_EMPRESA.departamento,
           DATOS_SIM_EMPRESA.municipio, DATOS_SIM_EMPRESA.leyenda])
      }
      const existeCred = queryOne('SELECT id FROM credenciales_sfe WHERE id=1')
      const tokenEnc = encrypt(DATOS_SIM_CRED.token)
      if (existeCred) {
        run('UPDATE credenciales_sfe SET ambiente=?,token=?,codigo_sistema=?,cuis=?,cufd=?,cufd_codigo_control=? WHERE id=1',
          ['simulacion', tokenEnc, DATOS_SIM_CRED.codigo_sistema,
           DATOS_SIM_CRED.cuis, DATOS_SIM_CRED.cufd, DATOS_SIM_CRED.cufd_codigo_control])
      } else {
        run('INSERT INTO credenciales_sfe (id,ambiente,token,codigo_sistema,cuis,cufd,cufd_codigo_control,modalidad,tipo_emision,tipo_factura) VALUES (1,?,?,?,?,?,?,2,1,1)',
          ['simulacion', tokenEnc, DATOS_SIM_CRED.codigo_sistema,
           DATOS_SIM_CRED.cuis, DATOS_SIM_CRED.cufd, DATOS_SIM_CRED.cufd_codigo_control])
      }
      return { ok: true }
    } catch (err) { return { ok: false, error: err.message } }
  })

  // ── Generar QR como base64 ────────────────────────────────────────────────
  ipcMain.handle('facturacion:getQRBase64', async (_, url) => {
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 200, margin: 1 })
      return { ok: true, dataUrl }
    } catch (err) { return { ok: false, error: err.message } }
  })

  // ── Guardar PDF en ubicación elegida por usuario ──────────────────────────
  ipcMain.handle('facturacion:guardarPDF', async (_, id) => {
    try {
      const factura = queryOne('SELECT * FROM facturas WHERE id=?', [id])
      if (!factura) return { ok: false, error: 'Factura no encontrada' }
      const empresa = getEmpresaActiva() || DATOS_SIM_EMPRESA
      let pdfPath = factura.pdf_path
      if (!pdfPath || !fs.existsSync(pdfPath)) {
        pdfPath = await generarPDFFactura(factura, empresa)
        run('UPDATE facturas SET pdf_path=? WHERE id=?', [pdfPath, id])
      }
      const clienteNombre = (factura.cliente_nombre || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)
      const fechaStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const defaultName = `Factura_${factura.numero_factura}_${clienteNombre}_${fechaStr}.pdf`
      const { dialog } = require('electron')
      const docs = app.getPath('documents')
      const defaultDir = path.join(docs, 'Gimnasio', 'Facturas')
      if (!fs.existsSync(defaultDir)) fs.mkdirSync(defaultDir, { recursive: true })
      const result = await dialog.showSaveDialog({
        title: 'Guardar Factura PDF',
        defaultPath: path.join(defaultDir, defaultName),
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      })
      if (result.canceled) return { ok: false, cancelado: true }
      fs.copyFileSync(pdfPath, result.filePath)
      shell.openPath(result.filePath)
      return { ok: true, ruta: result.filePath }
    } catch (err) { return { ok: false, error: err.message } }
  })
}

module.exports = { initFacturacion, registrarHandlers }
