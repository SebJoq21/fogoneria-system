/**
 * GENERADO por scripts/gen-modules.mjs — no editar a mano.
 * Regenera con `pnpm gen:modules`.
 *
 * Fase 6: lista las features y compone los providers opcionales de `module.ts`.
 * El layout consume `FeatureProviders`; el estado global restante sigue en
 * `ModulesProvider` hasta completar la migración.
 */
import { createElement, type ComponentType, type ReactNode } from 'react';
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
import { TenantProvider } from './tenant/provider';
import { AccountsProvider } from './orders/provider';
import { CashProvider } from './cash/provider';
import { ReceiptsProvider } from './receipts/provider';
import { ExpensesProvider } from './expenses/provider';
import { InventoryProvider } from './inventory/provider';
import { PromotionsProvider } from './promotions/provider';
import { CrmProvider } from './crm/provider';
import { StaffProvider } from './staff/provider';

export type FeatureModule = {
  id: string;
  label: string;
  icon: string;
  path: string;
  roles: string[];
  group: string;
  provider?: string;
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
export const featureProviders: FeatureProvider[] = [
  { id: "tenant", Provider: TenantProvider },
  { id: "orders", Provider: AccountsProvider },
  { id: "cash", Provider: CashProvider },
  { id: "receipts", Provider: ReceiptsProvider },
  { id: "expenses", Provider: ExpensesProvider },
  { id: "inventory", Provider: InventoryProvider },
  { id: "promotions", Provider: PromotionsProvider },
  { id: "crm", Provider: CrmProvider },
  { id: "staff", Provider: StaffProvider },
];

/** Envuelve a los hijos con los providers de las features que los declaran. */
export function FeatureProviders({ children }: { children: ReactNode }): ReactNode {
  return featureProviders.reduceRight<ReactNode>(
    (wrapped, { Provider }) => createElement(Provider, null, wrapped),
    children,
  );
}
