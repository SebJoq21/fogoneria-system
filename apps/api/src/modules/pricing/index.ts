/**
 * API pública del módulo Precios.
 *
 * Otros módulos no deben importar `pricing.service` ni sus DTOs: solo este
 * punto de entrada. La resolución de precios para una comanda (AYCDS-20) se
 * consume por `PricingPort` en la ola de órdenes.
 */
export { PricingModule } from './pricing.module.js';
export { PricingService } from './pricing.service.js';
