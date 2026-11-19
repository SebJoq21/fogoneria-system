/**
 * API pública del módulo Caja (turnos, movimientos, arqueo y cobro).
 *
 * Gastos no importa `cash.service` ni sus DTOs: consume `CASH_PORT`/`CashPort`
 * para dejar el egreso en el turno abierto.
 */
export { CashModule } from './cash.module.js';
export { CashService } from './cash.service.js';
export { CASH_PORT } from './cash.port.js';
export type {
  CashPort,
  EgresoDeGastoInput,
  EgresoDeGastoResultado,
} from './cash.port.js';
