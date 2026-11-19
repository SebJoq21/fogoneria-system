/**
 * API pública del módulo Órdenes (POS + tablero del KDS).
 *
 * Otros módulos no deben importar `orders.service`, los DTOs ni el repositorio:
 * solo este punto de entrada. Caja lo consume por `ORDERS_PORT`/`OrdersPort`
 * para `markPaid`; el contrato de eventos vive en `realtime`.
 */
export { OrdersModule } from './orders.module.js';
export { OrdersService } from './orders.service.js';
export { ORDERS_PORT } from './orders.port.js';
export type { OrdersPort } from './orders.port.js';
