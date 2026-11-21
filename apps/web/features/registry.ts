/**
 * GENERADO por scripts/gen-modules.mjs — no editar a mano.
 * Regenera con `pnpm gen:modules`.
 *
 * Fase 0–3: lista las features que ya exponen `module.ts`. Los providers
 * por módulo llegan en la Fase 6; el layout todavía no consume este registry.
 */
import type { ComponentType, ReactNode } from 'react';
import { authModule } from './auth/module';
import { tenantModule } from './tenant/module';
import { onboardingModule } from './onboarding/module';
import { saasModule } from './saas/module';
import { billingModule } from './billing/module';
import { auditModule } from './audit/module';
import { catalogModule } from './catalog/module';
import { pricingModule } from './pricing/module';
import { tablesModule } from './tables/module';
import { reservationsModule } from './reservations/module';
import { ordersModule } from './orders/module';
import { realtimeModule } from './realtime/module';
import { cashModule } from './cash/module';
import { receiptsModule } from './receipts/module';
import { expensesModule } from './expenses/module';
import { inventoryModule } from './inventory/module';
import { promotionsModule } from './promotions/module';
import { crmModule } from './crm/module';
import { staffModule } from './staff/module';
import { biModule } from './bi/module';

export type FeatureModule = {
  id: string;
  label: string;
  icon: string;
  path: string;
  roles: string[];
  group: string;
};

export type FeatureProvider = {
  id: string;
  Provider: ComponentType<{ children: ReactNode }>;
};

export const featureModules: FeatureModule[] = [
  authModule,
  tenantModule,
  onboardingModule,
  saasModule,
  billingModule,
  auditModule,
  catalogModule,
  pricingModule,
  tablesModule,
  reservationsModule,
  ordersModule,
  realtimeModule,
  cashModule,
  receiptsModule,
  expensesModule,
  inventoryModule,
  promotionsModule,
  crmModule,
  staffModule,
  biModule,
];

/** Módulos del catálogo que aún no exponen `features/<id>/module.ts`. */
export const pendingFeatureIds = [];

/** Providers opcionales por módulo (Fase 6). */
export const featureProviders: FeatureProvider[] = [];
