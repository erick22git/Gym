/**
 * certificadoService.js — Wrapper del renderer para manejo de certificado .p12
 */

const api = () => window.api.facturacion

export const certificadoService = {
  cargarCertificado: () => api().cargarCertificado(),
  validarCertificado: (ruta, password) => api().validarCertificado({ ruta, password }),
  getCertificado: () => api().getCertificado(),
}
