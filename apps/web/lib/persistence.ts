/* Persistencia del estado ERP (mocks realistas).
   localStorage versionado + BroadcastChannel para sincronizar
   varias pestañas (tablet del mesero vs pantalla de cocina).

   El estado y el canal se namespacan por empresa (`empresaId` del token) para
   que dos cuentas en el mismo navegador no compartan operación, tickets ni
   notificaciones. Sin sesión (offline/demo) se usa `ANON_TENANT_KEY`. */

import type {
  Coupon,
  Customer,
  Expense,
  Ingredient,
  Receipt,
  Reservation,
  Role,
  StockMovement,
} from "./erp";
import type { Combo } from "./erp-catalog";
import type { Notification, Ticket } from "./dashboard";
import type { CashShift, TableAccount } from "./domain";
import type { BranchScope } from "./tenancy";

export const ERP_STORAGE_KEY = "fogoneria:erp:v2";
export const ERP_SYNC_CHANNEL = "fogoneria:erp-sync";

/** Clave de tenant para el estado mostrado sin sesión (demo offline). */
export const ANON_TENANT_KEY = "anon";

export function erpStorageKey(tenantKey: string): string {
  return `${ERP_STORAGE_KEY}:${tenantKey}`;
}

export function erpSyncChannel(tenantKey: string): string {
  return `${ERP_SYNC_CHANNEL}:${tenantKey}`;
}

/* El catálogo (platos, categorías, modificadores y precios) ya no se
   persiste en el cliente: es la fuente de verdad de la API (tarea 63). */
export type ErpState = {
  version: 2;
  roles: Role[];
  reservations: Reservation[];
  ingredients: Ingredient[];
  movements: StockMovement[];
  customers: Customer[];
  coupons: Coupon[];
  receipts: Receipt[];
  expenses: Expense[];
  combos: Combo[];
  tickets: Ticket[];
  notifications: Notification[];
  hasUnread: boolean;
  scopes: Record<string, BranchScope>;
  accounts: TableAccount[];
  cashShifts: CashShift[];
  /** Modo contingencia SUNAT: los CPE quedan en cola y no se envían. */
  sunatContingencia: boolean;
};

export function loadErpState(tenantKey: string): ErpState | null {
  try {
    const raw = localStorage.getItem(erpStorageKey(tenantKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ErpState;
    if (parsed?.version !== 2 || !parsed.scopes) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveErpState(tenantKey: string, state: ErpState): void {
  try {
    localStorage.setItem(erpStorageKey(tenantKey), JSON.stringify(state));
  } catch {
    /* almacenamiento no disponible */
  }
}

export function resetErpState(tenantKey: string): void {
  try {
    localStorage.removeItem(erpStorageKey(tenantKey));
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel(erpSyncChannel(tenantKey));
      ch.postMessage({ type: "reset" });
      ch.close();
    }
  } catch {
    /* almacenamiento no disponible */
  }
}

type SyncMessage = { type: "state"; state: ErpState } | { type: "reset" };

/** Sincroniza el estado entre pestañas de la misma empresa. Devuelve el cleanup. */
export function subscribeErpSync(
  tenantKey: string,
  onMessage: (msg: SyncMessage) => void,
): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const ch = new BroadcastChannel(erpSyncChannel(tenantKey));
  ch.onmessage = (ev: MessageEvent<SyncMessage>) => onMessage(ev.data);
  return () => ch.close();
}

export function broadcastErpState(tenantKey: string, state: ErpState): void {
  if (typeof BroadcastChannel === "undefined") return;
  const ch = new BroadcastChannel(erpSyncChannel(tenantKey));
  ch.postMessage({ type: "state", state });
  ch.close();
}

export type { SyncMessage };
