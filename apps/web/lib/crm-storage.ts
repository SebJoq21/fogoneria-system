/**
 * Persistencia del módulo CRM y migración del estado legacy.
 *
 * Hasta F6 los clientes demo vivían en `ErpState` v2 (`customers`). La
 * migración se ejecuta en el **loader de `ModulesProvider`**, antes de que su
 * efecto de guardado escriba un estado limpio; así el `CrmProvider` (que corre
 * después por el orden de efectos hijo→padre) siempre encuentra la nueva clave.
 */

import type { Customer } from './erp';
import type { ErpState } from './persistence';

export const CRM_STORAGE_KEY = 'fogoneria:crm:v1';
export const CRM_SYNC_CHANNEL = 'fogoneria:crm-sync';

export type LegacyErpState = ErpState & { customers?: Customer[] };

export type CrmMigration = {
  state: ErpState;
  /** Lista fusionada que debe escribirse en la clave CRM; `null` si no había legacy. */
  migrated: Customer[] | null;
};

export function crmStorageKey(tenantKey: string): string {
  return `${CRM_STORAGE_KEY}:${tenantKey}`;
}

export function crmChannelKey(tenantKey: string): string {
  return `${CRM_SYNC_CHANNEL}:${tenantKey}`;
}

/** Fusiona por `id`; lo que ya está en la clave CRM gana sobre el legacy. */
export function mergeCustomers(
  legacy: Customer[],
  existing: Customer[] | null,
): Customer[] {
  const byId = new Map<number, Customer>();
  for (const customer of legacy) byId.set(customer.id, customer);
  for (const customer of existing ?? []) byId.set(customer.id, customer);
  return [...byId.values()];
}

/**
 * Saca `customers` del ErpState y devuelve la lista a persistir en CRM.
 * No toca `localStorage`: el caller decide cuándo guardar (loader).
 */
export function migrateLegacyCustomers(
  state: LegacyErpState,
  existing: Customer[] | null = null,
): CrmMigration {
  if (!Array.isArray(state.customers)) {
    return { state, migrated: null };
  }
  const { customers, ...rest } = state;
  return {
    state: rest as ErpState,
    migrated: mergeCustomers(customers, existing),
  };
}

export function readCrmCustomers(tenantKey: string): Customer[] | null {
  try {
    const raw = localStorage.getItem(crmStorageKey(tenantKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Customer[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCrmCustomers(tenantKey: string, customers: Customer[]): void {
  try {
    localStorage.setItem(crmStorageKey(tenantKey), JSON.stringify(customers));
  } catch {
    /* almacenamiento no disponible */
  }
}

/** Fallback de solo lectura para un `CrmProvider` montado aislado. */
export function readLegacyCustomers(tenantKey: string): Customer[] | null {
  try {
    const raw = localStorage.getItem(`fogoneria:erp:v2:${tenantKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LegacyErpState;
    return Array.isArray(parsed.customers) ? parsed.customers : null;
  } catch {
    return null;
  }
}
