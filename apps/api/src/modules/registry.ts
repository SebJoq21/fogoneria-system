/**
 * GENERADO por scripts/gen-modules.mjs — no editar a mano.
 * Regenera con `pnpm gen:modules`; el CI lo compara con `pnpm gen:modules --check`.
 *
 * Orden: el de modules/catalog.json. Los módulos de infraestructura
 * (`PrismaModule`, `TenantContextModule`) se declaran en app.module.ts.
 */
import { AuthModule } from './auth/index.js';
import { TenantModule } from './tenant/index.js';
import { OnboardingModule } from './onboarding/index.js';
import { SaasModule } from './saas/index.js';
import { BillingModule } from './billing/index.js';
import { AuditModule } from './audit/index.js';
import { CatalogModule } from './catalog/index.js';
import { PricingModule } from './pricing/index.js';
import { TablesModule } from './tables/index.js';
import { ReservationsModule } from './reservations/index.js';
import { OrdersModule } from './orders/index.js';
import { RealtimeModule } from './realtime/index.js';
import { CashModule } from './cash/index.js';
import { ReceiptsModule } from './receipts/index.js';
import { ExpensesModule } from './expenses/index.js';
import { InventoryModule } from './inventory/index.js';
import { PromotionsModule } from './promotions/index.js';
import { CrmModule } from './crm/index.js';
import { StaffModule } from './staff/index.js';
import { BiModule } from './bi/index.js';

export const MODULE_REGISTRY = [
  AuthModule,
  TenantModule,
  OnboardingModule,
  SaasModule,
  BillingModule,
  AuditModule,
  CatalogModule,
  PricingModule,
  TablesModule,
  ReservationsModule,
  OrdersModule,
  RealtimeModule,
  CashModule,
  ReceiptsModule,
  ExpensesModule,
  InventoryModule,
  PromotionsModule,
  CrmModule,
  StaffModule,
  BiModule,
];
