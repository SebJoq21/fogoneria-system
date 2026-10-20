/* Persistencia del estado ERP (mocks realistas).
   localStorage versionado + BroadcastChannel para sincronizar
   varias pestañas (tablet del mesero vs pantalla de cocina). */

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
import type {
  Combo,
  ModifierGroup,
  PriceList,
  Product,
  ProductCategory,
} from "./erp-catalog";
import type { Notification, Ticket } from "./dashboard";
import type { CashShift, TableAccount } from "./domain";
import type { BranchScope } from "./tenancy";

export const ERP_STORAGE_KEY = "fogoneria:erp:v1";
export const ERP_SYNC_CHANNEL = "fogoneria:erp-sync";

export type ErpState = {
  version: 1;
  products: Product[];
  categories: ProductCategory[];
  modifierGroups: ModifierGroup[];
  priceLists: PriceList[];
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

export function loadErpState(): ErpState | null {
  try {
    const raw = localStorage.getItem(ERP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ErpState;
    if (parsed?.version !== 1 || !parsed.scopes) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveErpState(state: ErpState): void {
  try {
    localStorage.setItem(ERP_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* almacenamiento no disponible */
  }
}

export function resetErpState(): void {
  try {
    localStorage.removeItem(ERP_STORAGE_KEY);
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel(ERP_SYNC_CHANNEL);
      ch.postMessage({ type: "reset" });
      ch.close();
    }
  } catch {
    /* almacenamiento no disponible */
  }
}

type SyncMessage = { type: "state"; state: ErpState } | { type: "reset" };

/** Sincroniza el estado entre pestañas. Devuelve la función de limpieza. */
export function subscribeErpSync(onMessage: (msg: SyncMessage) => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const ch = new BroadcastChannel(ERP_SYNC_CHANNEL);
  ch.onmessage = (ev: MessageEvent<SyncMessage>) => onMessage(ev.data);
  return () => ch.close();
}

export function broadcastErpState(state: ErpState): void {
  if (typeof BroadcastChannel === "undefined") return;
  const ch = new BroadcastChannel(ERP_SYNC_CHANNEL);
  ch.postMessage({ type: "state", state });
  ch.close();
}

export type { SyncMessage };
