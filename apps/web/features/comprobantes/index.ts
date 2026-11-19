/**
 * Feature Comprobantes.
 *
 * Con sesión la página lista/emite/anula contra la API; sin sesión cae al demo
 * de `ModulesProvider`. SUNAT sigue «pendiente de OSE»: no se simula CDR.
 */

export { ComprobantesPage } from './ComprobantesPage';
export {
  comprobanteARecibo,
  comprobantesApi,
  comprobantesClient,
  comprobantesDesdeApi,
  toComprobante,
} from './api';
export type {
  Comprobante,
  DesgloseIgv,
  EmisionComprobanteInput,
  EstadoComprobante,
  TipoComprobante,
  TipoComprobanteEmisible,
} from '@fogoneria/contracts/comprobantes';
