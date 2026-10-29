// Se importa PRIMERO en main.jsx: pone los ajustes del dispositivo en <html> de forma síncrona, antes de que React pinte,
// para que apariencia, tamaño y contraste valgan desde el login sin parpadeo.
try {
  const d = window.api?.dispositivoInicial || {}
  const r = document.documentElement
  const ap = ['oscuro', 'claro'].includes(d.apariencia) ? d.apariencia : 'transparente'
  r.setAttribute('data-apariencia', ap)
  r.setAttribute('data-tamano', String([100, 125, 150, 175, 200].includes(d.tamano) ? d.tamano : 100))
  r.setAttribute('data-alto-contraste', d.altoContraste ? '1' : '0')
} catch { /* sin preload (pruebas en navegador): valores por defecto */ }
