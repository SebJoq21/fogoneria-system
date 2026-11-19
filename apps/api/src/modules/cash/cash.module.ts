import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/index.js';
import { CashController } from './cash.controller.js';
import { CashService } from './cash.service.js';
import { CASH_PORT } from './cash.port.js';

@Module({
  imports: [OrdersModule],
  controllers: [CashController],
  providers: [
    CashService,
    // Gastos registra su egreso por el puerto, no por la clase (ola dinero).
    { provide: CASH_PORT, useExisting: CashService },
  ],
  exports: [CashService, CASH_PORT],
})
export class CashModule {}
