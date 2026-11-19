/**
 * API pública del módulo Órdenes (POS + tablero del KDS).
 *
 * Otros módulos no deben importar `orders.service`, los DTOs ni el repositorio:
 * solo este punto de entrada. Caja lo consume para `markPaid`; el contrato de
 * eventos vive en `realtime`.
 */
export { OrdersModule } from './orders.module.js';
export { OrdersService } from './orders.service.js';
