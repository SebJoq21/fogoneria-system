import { Module } from '@nestjs/common';
import { SequencesModule } from '../../common/sequences/sequences.module.js';
import { PricingModule } from '../pricing/index.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { PromotionsModule } from '../promotions/promotions.module.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { OrdersSlaCron } from './orders.sla.cron.js';
import { ORDERS_PORT } from './orders.port.js';

@Module({
  imports: [SequencesModule, PricingModule, InventoryModule, PromotionsModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersSlaCron,
    // Caja cobra la comanda a través del puerto, no de la clase (ola dinero).
    { provide: ORDERS_PORT, useExisting: OrdersService },
  ],
  exports: [OrdersService, ORDERS_PORT],
})
export class OrdersModule {}
