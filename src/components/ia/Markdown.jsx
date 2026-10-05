// Markdown mínimo y SEGURO para las respuestas del asistente (sin dependencias, sin HTML crudo):
// **negrita**, *cursiva*, `código`, listas con - / * / 1., encabezados # y párrafos. Todo se pinta como
// elementos de React (nunca dangerouslySetInnerHTML), así que lo que diga el modelo no puede inyectar HTML.
import { Fragment } from 'react'

function enLinea(texto, clave) {
  const partes = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g
  let ultimo = 0
  let m
  let i = 0
  while ((m = re.exec(texto)) !== null) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index))
    const t = m[0]
    if (t.startsWith('**')) partes.push(<strong key={`${clave}b${i}`}>{t.slice(2, -2)}</strong>)
    else if (t.startsWith('`')) partes.push(<code key={`${clave}c${i}`} className="ia-md-codigo">{t.slice(1, -1)}</code>)
    else partes.push(<em key={`${clave}e${i}`}>{t.slice(1, -1)}</em>)
    ultimo = m.index + t.length
    i += 1
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo))
  return partes
}

export default function Markdown({ texto, className = '' }) {
  const lineas = String(texto || '').replace(/\r/g, '').split('\n')
  const bloques = []
  let lista = null
  let parrafo = []
  const cerrarParrafo = () => { if (parrafo.length) { bloques.push({ t: 'p', lineas: parrafo }); parrafo = [] } }
  const cerrarLista = () => { if (lista) { bloques.push(lista); lista = null } }
  for (const l of lineas) {
    const item = l.match(/^\s*([-*•]|\d+[.)])\s+(.*)$/)
    const enc = l.match(/^(#{1,3})\s+(.*)$/)
    if (item) {
      cerrarParrafo()
      const ordenada = /\d/.test(item[1])
      if (!lista || lista.ordenada !== ordenada) { cerrarLista(); lista = { t: 'lista', ordenada, items: [] } }
      lista.items.push(item[2])
    } else if (enc) { cerrarParrafo(); cerrarLista(); bloques.push({ t: 'h', texto: enc[2] }) }
    else if (!l.trim()) { cerrarParrafo(); cerrarLista() }
    else { cerrarLista(); parrafo.push(l) }
  }
  cerrarParrafo(); cerrarLista()

  return (
    <div className={`ia-md ${className}`}>
      {bloques.map((b, i) => {
        if (b.t === 'h') return <div key={i} className="ia-md-h">{enLinea(b.texto, `h${i}`)}</div>
        if (b.t === 'lista') {
          const Tag = b.ordenada ? 'ol' : 'ul'
          return <Tag key={i} className="ia-md-lista">{b.items.map((it, j) => <li key={j}>{enLinea(it, `l${i}-${j}`)}</li>)}</Tag>
        }
        return <p key={i} className="ia-md-p">{b.lineas.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{enLinea(l, `p${i}-${j}`)}</Fragment>)}</p>
      })}
    </div>
  )
}
