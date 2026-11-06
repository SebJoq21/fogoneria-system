import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BillingService } from './billing.service.js';

@Injectable()
export class BillingScheduler {
  private readonly logger = new Logger(BillingScheduler.name);

  constructor(private readonly billing: BillingService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'billing-delinquency' })
  async handleDelinquency(): Promise<void> {
    try {
      const result = await this.billing.runCycle();
      this.logger.log(
        `Ciclo de morosidad: ${result.expired.length} expirados, ${result.suspended.length} suspendidos`,
      );
    } catch (error) {
      this.logger.error(`Falló el ciclo de morosidad: ${String(error)}`);
    }
  }
}
