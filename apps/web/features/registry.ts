/**
 * GENERADO por scripts/gen-modules.mjs — no editar a mano.
 * Regenera con `pnpm gen:modules`.
 *
 * Fase 0–3: lista las features que ya exponen `module.ts`. Los providers
 * por módulo llegan en la Fase 6; el layout todavía no consume este registry.
 */
import type { ComponentType, ReactNode } from 'react';
import { catalogModule } from './catalog/module';
import { pricingModule } from './pricing/module';
import { tablesModule } from './tables/module';
import { reservationsModule } from './reservations/module';
import { crmModule } from './crm/module';

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
  catalogModule,
  pricingModule,
  tablesModule,
  reservationsModule,
  crmModule,
];

/** Módulos del catálogo que aún no exponen `features/<id>/module.ts`. */
export const pendingFeatureIds = ["auth","tenant","onboarding","saas","billing","audit","orders","realtime","cash","receipts","expenses","inventory","promotions","staff","bi"];

/** Providers opcionales por módulo (Fase 6). */
export const featureProviders: FeatureProvider[] = [];
