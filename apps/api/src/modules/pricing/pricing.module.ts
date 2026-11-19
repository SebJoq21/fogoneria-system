import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller.js';
import { PricingService } from './pricing.service.js';
import { PRICING_PORT } from './pricing.port.js';

@Module({
  controllers: [PricingController],
  providers: [
    PricingService,
    // El servicio es la implementación por defecto del puerto. Órdenes (y la
    // ola de dinero) dependen de `PRICING_PORT`, no de la clase.
    { provide: PRICING_PORT, useExisting: PricingService },
  ],
  exports: [PricingService, PRICING_PORT],
})
export class PricingModule {}
