/**
 * Feature CRM (comensales, puntos y fidelización).
 *
 * La API manda: el segmento se deriva de las comandas pagadas y los puntos se
 * mueven con movimientos auditados. Las rutas y `ModuleGate` solo importan este
 * índice.
 */

export { ClientesPage } from './ClientesPage';
export { CrmProvider, useCrm } from './provider';

export { LoyaltyPage } from './LoyaltyPage';
export { LoyaltyHubPage } from './LoyaltyHubPage';
export {
  crmApi,
  crmClient,
  toCliente,
  toClienteDetalle,
  toConfigLealtad,
  toMovimientoPuntos,
} from './api';
export type {
  ApiCliente,
  ApiClienteDetalle,
  ApiClienteList,
  ApiConfigLealtad,
  ApiMovimientoPuntos,
  ListaClientes,
  ListarClientesParams,
  ResultadoConsumos,
} from './api';
export type {
  AjustePuntosInput,
  Cliente,
  ClienteDetalle,
  ClienteInput,
  ConfigLealtad,
  MovimientoPuntos,
  SegmentoCliente,
  TipoMovimientoPuntos,
} from '@fogoneria/contracts/crm';
