import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module.js';
import { CashController } from './cash.controller.js';
import { CashService } from './cash.service.js';

@Module({
  imports: [OrdersModule],
  controllers: [CashController],
  providers: [CashService],
  exports: [CashService],
})
export class CashModule {}
