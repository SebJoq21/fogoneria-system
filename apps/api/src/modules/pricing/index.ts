/**
 * API pública del módulo Precios.
 *
 * Otros módulos no deben importar `pricing.service` ni sus DTOs: solo este
 * punto de entrada. La resolución de precios de una comanda se consume por
 * `PRICING_PORT`/`PricingPort`; la clase `PricingService` queda como
 * implementación (y para la consola de precios).
 */
export { PricingModule } from './pricing.module.js';
export { PricingService } from './pricing.service.js';
export { PRICING_PORT } from './pricing.port.js';
export type { PreciosResueltos, PricingPort } from './pricing.port.js';
