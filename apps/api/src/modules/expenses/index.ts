/**
 * API pública del módulo Gastos (cuentas por pagar y pago en caja).
 *
 * Un gasto pagado en efectivo sale del turno abierto vía `CASH_PORT`; el resto
 * de métodos solo cambia el estado.
 */
export { ExpensesModule } from './expenses.module.js';
export { ExpensesService } from './expenses.service.js';
