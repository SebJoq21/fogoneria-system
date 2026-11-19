/**
 * API pública del ciclo de morosidad (TRIAL → EXPIRED → SUSPENDED).
 *
 * El cron diario y las pruebas e2e lo montan por este `index.js`; las reglas de
 * gracia y auditoría no cambian.
 */
export { BillingModule } from './billing.module.js';
export { BillingService } from './billing.service.js';
export type { BillingCycleResult } from './billing.service.js';
