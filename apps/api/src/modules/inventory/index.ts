/**
 * API pública del módulo Inventario.
 *
 * Otros módulos (órdenes al entregar una comanda) consumen `InventoryService`
 * a través de este punto de entrada, nunca del archivo interno. El semáforo y
 * el webhook viven dentro del módulo y se montan con su controller.
 */
export { InventoryModule } from './inventory.module.js';
export { InventoryService } from './inventory.service.js';
export type { ConsumptionResult } from './inventory.service.js';
