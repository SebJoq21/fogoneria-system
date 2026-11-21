/**
 * Feature Caja (turnos, movimientos, arqueo y cobro).
 *
 * El estado de negocio sigue en `ModulesProvider` (Fase 4). La página lee y
 * pinta; este índice expone solo lo que consumen las rutas y el resto del ERP.
 */

export { CajaPage } from './CajaPage';
export { CashProvider, useCash } from './provider';
export { CheckoutModal } from './CheckoutModal';
export {
  cajaApi,
  cajaClient,
  cobroDesdeApi,
  metodoFromUi,
  metodoToUi,
  tipoToUi,
  toMovimiento,
  toTurno,
  turnoActualDesdeApi,
} from './api';
export type {
  AperturaInput,
  Arqueo,
  CierreInput,
  CobroInput,
  EstadoTurno,
  MetodoPago,
  MovimientoCaja,
  MovimientoInput,
  ResultadoCobro,
  TipoMovimiento,
  TurnoCaja,
  TurnoCajaActual,
} from '@fogoneria/contracts/cash';
