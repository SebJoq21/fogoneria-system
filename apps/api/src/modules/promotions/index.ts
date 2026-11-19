/**
 * API pública del módulo Promociones (combos, cupones y reglas horarias).
 *
 * Órdenes consume `PromotionsService` desde aquí para resolver el cupón de una
 * comanda; nadie importa sus DTOs ni sus reglas internas. El importe del
 * descuento y el consumo del uso los decide el servidor.
 */
export { PromotionsModule } from './promotions.module.js';
export { PromotionsService } from './promotions.service.js';
export type { CuponResuelto } from './promotions.service.js';
