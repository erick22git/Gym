import { useState, useEffect } from 'react'
import { Download, Printer, Mail, X, Edit2, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

function numALetras(monto) {
  const U = ['','UNO','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE','DIEZ',
    'ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE',
    'VEINTE','VEINTIUNO','VEINTIDÓS','VEINTITRÉS','VEINTICUATRO','VEINTICINCO','VEINTISÉIS',
    'VEINTISIETE','VEINTIOCHO','VEINTINUEVE']
  const D = ['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA']
  const C = ['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS',
             'SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS']
  function s100(n) {
    if (n < 30) return U[n]
    const d = Math.floor(n/10), u = n%10
    return u ? D[d]+' Y '+U[u] : D[d]
  }
  function s1000(n) {
    if (!n) return ''
    if (n < 100) return s100(n)
    if (n === 100) return 'CIEN'
    const c = Math.floor(n/100), r = n%100
    return r ? C[c]+' '+s100(r) : C[c]
  }
  function ent(n) {
    if (!n) return 'CERO'
    if (n < 1000) return s1000(n)
    const m = Math.floor(n/1000), r = n%1000
    const tm = m === 1 ? 'MIL' : s1000(m)+' MIL'
    return r ? tm+' '+s1000(r) : tm
  }
  const e = Math.floor(monto), c = Math.round((monto-e)*100)
  return ent(e)+' '+String(c).padStart(2,'0')+'/100'
}

function fmtFecha(s) {
  if (!s) return new Date().toLocaleString('es-BO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
  return new Date(s).toLocaleString('es-BO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

export default function VistaFactura({ factura, empresa, onClose, onNueva, onEditar }) {
  const [qrSrc, setQrSrc] = useState('')
  const [descargando, setDescargando] = useState(false)
  const [enviandoCorreo, setEnviandoCorreo] = useState(false)
  const esSimulacion = !!factura?.es_simulacion

  const emp = empresa || {}
  const total = parseFloat(factura?.monto_total || 0)
  const descuento = parseFloat(factura?.descuento || 0)
  const itemsDetalle = (() => { try { return factura?.items ? JSON.parse(factura.items) : null } catch { return null } })()
  const subtotal = itemsDetalle?.length
    ? itemsDetalle.reduce((s, i) => s + parseFloat(i.subtotal || 0), 0)
    : parseFloat(factura?.precio_unitario || total) * (parseInt(factura?.cantidad) || 1)
  const qrUrl = `https://pilotosiatservicios.impuestos.gob.bo/verificadorFacturas?cuf=${factura?.cuf || 'SIMULADO'}`
  const cuf = factura?.cuf || ''

  useEffect(() => {
    if (factura?.cuf) {
      window.api.facturacion.getQRBase64(qrUrl).then(r => {
        if (r.ok) setQrSrc(r.dataUrl)
      }).catch(() => {})
    }
  }, [factura?.cuf])

  async function descargar() {
    setDescargando(true)
    try {
      const r = await window.api.facturacion.guardarPDF(factura.id)
      if (r.ok) toast.success('PDF guardado correctamente')
      else if (!r.cancelado) toast.error(r.error || 'Error al guardar')
    } catch { toast.error('Error al guardar PDF') }
    setDescargando(false)
  }

  async function imprimir() {
    await window.api.facturacion.descargarPDF(factura.id)
  }

  async function enviarCorreo() {
    if (!factura.cliente_correo) return toast.error('El cliente no tiene correo registrado')
    setEnviandoCorreo(true)
    try {
      const r = await window.api.facturacion.reenviarCorreo(factura.id, factura.cliente_correo)
      if (r.ok) toast.success('Correo enviado a ' + factura.cliente_correo)
      else toast.error(r.error || 'Error al enviar')
    } catch { toast.error('Error al enviar correo') }
    setEnviandoCorreo(false)
  }

  const ROJO = '#c0392b'
  const baseStyle = { fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#222', background: '#fff', padding: '20px 24px', maxWidth: 640, margin: '0 auto', position: 'relative' }
  const sep = { borderBottom: '1px solid #ccc', margin: '8px 0' }
  const labelSt = { fontSize: 9, color: '#777', textTransform: 'uppercase', letterSpacing: '0.04em' }
  const valSt = { fontSize: 11, color: '#111', fontWeight: 600 }

  if (!factura) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9100, background: 'oklch(0 0 0 / .75)', display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto', padding: '20px 0' }}>
      {/* Toolbar */}
      <div style={{ width: '100%', maxWidth: 700, display: 'flex', gap: 8, marginBottom: 12, padding: '0 16px', flexShrink: 0 }}>
        {onEditar && (
          <button onClick={onEditar} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, background:'oklch(0.74 0.13 250 / .2)', border:'1px solid oklch(0.74 0.13 250 / .4)', color:'oklch(0.82 0.10 250)', cursor:'pointer', fontSize:12, fontWeight:600 }}>
            <Edit2 size={13} /> Editar datos
          </button>
        )}
        <button onClick={descargar} disabled={descargando} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, background:'oklch(0.78 0.16 155 / .2)', border:'1px solid oklch(0.78 0.16 155 / .4)', color:'oklch(0.78 0.16 155)', cursor:'pointer', fontSize:12, fontWeight:600 }}>
          <Download size={13} /> {descargando ? 'Guardando...' : 'Descargar PDF'}
        </button>
        <button onClick={imprimir} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, background:'oklch(0.82 0.14 75 / .2)', border:'1px solid oklch(0.82 0.14 75 / .4)', color:'oklch(0.75 0.14 75)', cursor:'pointer', fontSize:12, fontWeight:600 }}>
          <Printer size={13} /> Imprimir
        </button>
        <button onClick={enviarCorreo} disabled={enviandoCorreo || !factura.cliente_correo} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, background:'oklch(0.74 0.13 250 / .2)', border:'1px solid oklch(0.74 0.13 250 / .4)', color:'oklch(0.74 0.13 250)', cursor:'pointer', fontSize:12, fontWeight:600, opacity: !factura.cliente_correo ? 0.4 : 1 }}>
          <Mail size={13} /> {enviandoCorreo ? 'Enviando...' : 'Email'}
        </button>
        <div style={{ flex: 1 }} />
        {onNueva && (
          <button onClick={onNueva} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, background:'oklch(0.66 0.22 25 / .2)', border:'1px solid oklch(0.66 0.22 25 / .4)', color:'oklch(0.76 0.20 25)', cursor:'pointer', fontSize:12, fontWeight:600 }}>
            <CheckCircle size={13} /> Nueva Factura
          </button>
        )}
        {onClose && (
          <button onClick={onClose} style={{ width:34, height:34, borderRadius:8, background:'oklch(1 0 0 / .08)', border:'1px solid oklch(1 0 0 / .15)', color:'oklch(1 0 0 / .6)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Factura visual */}
      <div style={{ ...baseStyle, width: '100%', maxWidth: 640, boxShadow: '0 8px 40px rgba(0,0,0,0.6)', borderRadius: 6 }}>

        {/* Marca de agua MODO PRUEBA */}
        {esSimulacion && (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none', zIndex:1, overflow:'hidden', borderRadius:6 }}>
            <span style={{ fontSize:64, fontWeight:900, color:'rgba(192,0,0,0.07)', transform:'rotate(-45deg)', whiteSpace:'nowrap', userSelect:'none' }}>MODO PRUEBA</span>
          </div>
        )}

        {/* HEADER */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:'#111', letterSpacing:'0.02em' }}>{emp.nombre_comercial || emp.razon_social || 'URBAN FITNESS CLUB'}</div>
            <div style={{ fontSize:9, color:'#777', marginTop:2 }}>NIT: {emp.nit || '123456789'}</div>
          </div>
          <div style={{ textAlign:'center', background:ROJO, color:'white', padding:'6px 16px', borderRadius:4, minWidth:130 }}>
            <div style={{ fontSize:16, fontWeight:800, letterSpacing:'0.08em' }}>FACTURA</div>
            <div style={{ fontSize:8, marginTop:2, lineHeight:1.3 }}>(CON DERECHO A CRÉDITO FISCAL)</div>
          </div>
        </div>

        <div style={sep} />

        {/* EMISOR + N° FACTURA */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:8 }}>
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:'#111' }}>{emp.razon_social || ''}</div>
            <div style={{ fontSize:9, color:'#666', marginTop:2 }}>Casa Matriz</div>
            <div style={{ fontSize:9, color:'#666' }}>{emp.direccion || ''}</div>
            <div style={{ fontSize:9, color:'#666' }}>{emp.municipio || ''} · {emp.departamento || ''} · Bolivia</div>
            <div style={{ fontSize:9, color:'#666' }}>Tel: {emp.telefono || ''}</div>
          </div>
          <div>
            <div style={{ ...labelSt, marginBottom:2 }}>FACTURA N°</div>
            <div style={{ fontSize:18, fontWeight:900, color:ROJO, fontFamily:'monospace' }}>{factura.numero_factura}</div>
            <div style={{ ...labelSt, marginTop:6, marginBottom:2 }}>CÓD. AUTORIZACIÓN</div>
            <div style={{ fontSize:7, color:'#555', wordBreak:'break-all', fontFamily:'monospace', lineHeight:1.4 }}>{cuf}</div>
            <div style={{ ...labelSt, marginTop:4, marginBottom:1 }}>FECHA</div>
            <div style={{ ...valSt, fontSize:10 }}>{fmtFecha(factura.fecha_emision)}</div>
          </div>
        </div>

        <div style={sep} />

        {/* CLIENTE */}
        <div style={{ marginBottom:8 }}>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
            <div><span style={labelSt}>NOMBRE/RAZÓN SOCIAL: </span><span style={valSt}>{factura.cliente_nombre || 'S/N'}</span></div>
          </div>
          <div style={{ display:'flex', gap:16, marginTop:3 }}>
            <div><span style={labelSt}>{factura.cliente_tipo_doc || 'CI'}/CEX: </span><span style={valSt}>{factura.cliente_documento || ''}</span></div>
          </div>
        </div>

        <div style={sep} />

        {/* TABLA */}
        <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:8, fontSize:10 }}>
          <thead>
            <tr style={{ background:'#111', color:'white' }}>
              <th style={{ padding:'5px 6px', textAlign:'left', width:40, fontSize:9 }}>CANT</th>
              <th style={{ padding:'5px 6px', textAlign:'left', fontSize:9 }}>DESCRIPCIÓN</th>
              <th style={{ padding:'5px 6px', textAlign:'right', width:80, fontSize:9 }}>P. UNIT</th>
              <th style={{ padding:'5px 6px', textAlign:'right', width:65, fontSize:9 }}>DESC.</th>
              <th style={{ padding:'5px 6px', textAlign:'right', width:80, fontSize:9 }}>SUBTOTAL</th>
            </tr>
          </thead>
          <tbody>
            {itemsDetalle?.length ? itemsDetalle.map((item, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? '#f8f8f8' : 'white' }}>
                <td style={{ padding:'6px', textAlign:'center' }}>{item.cantidad}</td>
                <td style={{ padding:'6px', fontWeight:600 }}>{item.nombre}</td>
                <td style={{ padding:'6px', textAlign:'right' }}>Bs. {parseFloat(item.precio_unitario || 0).toFixed(2)}</td>
                <td style={{ padding:'6px', textAlign:'right' }}>Bs. {parseFloat(item.descuento_promo || 0).toFixed(2)}</td>
                <td style={{ padding:'6px', textAlign:'right', fontWeight:700 }}>Bs. {parseFloat(item.subtotal || 0).toFixed(2)}</td>
              </tr>
            )) : (
              <tr style={{ background:'#f8f8f8' }}>
                <td style={{ padding:'6px', textAlign:'center' }}>{factura.cantidad || 1}</td>
                <td style={{ padding:'6px', fontWeight:600 }}>{factura.concepto || 'Servicio'}</td>
                <td style={{ padding:'6px', textAlign:'right' }}>Bs. {parseFloat(factura.precio_unitario || total).toFixed(2)}</td>
                <td style={{ padding:'6px', textAlign:'right' }}>Bs. {descuento.toFixed(2)}</td>
                <td style={{ padding:'6px', textAlign:'right', fontWeight:700 }}>Bs. {subtotal.toFixed(2)}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* TOTALES */}
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
          <div style={{ minWidth:220 }}>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', fontSize:10 }}>
              <span style={{ color:'#666' }}>SUBTOTAL Bs.</span>
              <span style={{ fontWeight:600 }}>{subtotal.toFixed(2)}</span>
            </div>
            {descuento > 0 && (
              <div style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', fontSize:10 }}>
                <span style={{ color:'#666' }}>DESCUENTO Bs.</span>
                <span style={{ color:ROJO, fontWeight:600 }}>-{descuento.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 8px', background:ROJO, borderRadius:4 }}>
              <span style={{ color:'white', fontWeight:800, fontSize:12 }}>TOTAL Bs.</span>
              <span style={{ color:'white', fontWeight:900, fontSize:14 }}>{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* SON */}
        <div style={{ fontSize:9, fontStyle:'italic', color:'#444', marginBottom:8 }}>
          Son: <strong>{numALetras(total)} BOLIVIANOS</strong>
        </div>

        <div style={sep} />

        {/* QR + CÓDIGO DE CONTROL */}
        <div style={{ display:'flex', gap:16, alignItems:'flex-start', marginBottom:10 }}>
          {qrSrc ? (
            <img src={qrSrc} alt="QR" style={{ width:80, height:80, flexShrink:0 }} />
          ) : (
            <div style={{ width:80, height:80, background:'#f0f0f0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, color:'#aaa', flexShrink:0 }}>QR</div>
          )}
          <div style={{ flex:1 }}>
            <div style={labelSt}>CÓDIGO DE CONTROL</div>
            <div style={{ fontFamily:'monospace', fontSize:11, fontWeight:700, color:'#111', marginBottom:4 }}>
              {(()=>{
                try {
                  const cred = null
                  return factura.cufd_codigo_control || 'A1-B2-C3-D4'
                } catch { return 'N/D' }
              })()}
            </div>
            <div style={{ fontSize:8, color:'#777' }}>Método de pago: {(factura.metodo_pago||'efectivo').replace(/_/g,' ').toUpperCase()}</div>
            <div style={{ fontSize:8, color:'#777', marginTop:2 }}>Escanea el QR para verificar en el SIN</div>
          </div>
        </div>

        <div style={sep} />

        {/* LEYENDAS */}
        <div style={{ fontSize:8, color:'#555', textAlign:'center', lineHeight:1.5 }}>
          <div style={{ fontStyle:'italic', marginBottom:4 }}>
            "ESTA FACTURA CONTRIBUYE AL DESARROLLO DEL PAÍS, EL USO ILÍCITO DE ÉSTA SERÁ SANCIONADO DE ACUERDO A LEY"
          </div>
          <div style={{ marginBottom:4 }}>
            <strong>Ley N° 453:</strong> Tienes derecho a un trato equitativo y digno en cualquier compra.
          </div>
          <div style={{ fontStyle:'italic' }}>
            "Este documento es la Representación Gráfica de un Documento Fiscal Digital emitido en una modalidad de facturación en línea"
          </div>
        </div>

        {/* MODO PRUEBA BADGE */}
        {esSimulacion && (
          <div style={{ marginTop:10, padding:'6px 12px', background:'#fff3cd', border:'1px solid #ffc107', borderRadius:4, textAlign:'center', fontSize:9, fontWeight:700, color:'#856404' }}>
            ⚠ MODO PRUEBA — SIN VALIDEZ FISCAL — DOCUMENTO SIMULADO
          </div>
        )}
      </div>
    </div>
  )
}
