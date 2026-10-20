import { Module } from '@nestjs/common';
import { BillingService } from './billing.service.js';
import { BillingScheduler } from './billing.scheduler.js';

@Module({
  providers: [BillingService, BillingScheduler],
  exports: [BillingService],
})
export class BillingModule {}
