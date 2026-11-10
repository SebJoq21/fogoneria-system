import { Module } from '@nestjs/common';
import { SequencesModule } from '../../common/sequences/sequences.module.js';
import { PricingModule } from '../pricing/pricing.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { PromotionsModule } from '../promotions/promotions.module.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { OrdersSlaCron } from './orders.sla.cron.js';

@Module({
  imports: [SequencesModule, PricingModule, InventoryModule, PromotionsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersSlaCron],
  exports: [OrdersService],
})
export class OrdersModule {}
