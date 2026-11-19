import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/index.js';
import { PromotionsController } from './promotions.controller.js';
import { PromotionsService } from './promotions.service.js';

@Module({
  // El precio de referencia de un combo (anti-inflación) sale del puerto de
  // Precios, no de `precios_platos`: el catálogo y sus listas tienen un dueño.
  imports: [PricingModule],
  controllers: [PromotionsController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
