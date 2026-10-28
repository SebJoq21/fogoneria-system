import { Module } from '@nestjs/common';
import { SequencesModule } from '../../common/sequences/sequences.module.js';
import { PricingModule } from '../pricing/pricing.module.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [SequencesModule, PricingModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
