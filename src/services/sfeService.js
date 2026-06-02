/**
 * sfeService.js — Wrapper del renderer para llamadas al SFE
 * Toda la lógica real está en electron/facturacion/handlers.cjs
 * El renderer solo hace IPC via window.api.facturacion.*
 */

const api = () => window.api.facturacion

export const sfeService = {
  verificarComunicacion: () => api().verificarComunicacion(),
  verificarToken: () => api().verificarToken(),
  obtenerCUIS: () => api().obtenerCUIS(),
  obtenerCUFD: () => api().obtenerCUFD(),
  sincronizarFechaHora: () => api().sincronizarFechaHora(),
  sincronizarParametricas: () => api().sincronizarParametricas(),
  emitirFacturaPrueba: () => api().emitirFacturaPrueba(),
  anularFacturaPrueba: (cuf) => api().anularFacturaPrueba(cuf),
  verificarEstadoFactura: (cuf) => api().verificarEstadoFactura(cuf),
}
