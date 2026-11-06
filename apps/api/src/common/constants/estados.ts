import type {
  estado_orden,
  estado_reserva,
} from '../../generated/prisma/enums.js';

/**
 * Estados de orden que mantienen la mesa ocupada. `PAGADA`, `CERRADA` y
 * `ANULADA` son terminales y liberan la mesa (AYCDS-16/20).
 */
export const OPEN_ORDER_STATES: readonly estado_orden[] = [
  'POR_CONFIRMAR',
  'EN_COCINA',
  'LISTO',
  'ENTREGADO',
];

/** Estados de reserva que bloquean la mesa. */
export const ACTIVE_RESERVATION_STATES: readonly estado_reserva[] = [
  'POR_CONFIRMAR',
  'CONFIRMADA',
];
