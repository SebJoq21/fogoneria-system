'use client';

/**
 * Provider del módulo Órdenes (F6c1/F6c3): cuentas de mesa y comandas demo.
 *
 * - `AccountsProvider` / `useAccounts`: cuentas (F6c1).
 * - `useOrdersDemo`: comandas demo por sucursal (antes `scopes[*].orders`).
 *
 * El provider compone los dos stores para que `module.ts` siga declarando un
 * único provider. La migración/purga de `accounts` y `scopes` del `ErpState`
 * corre en el loader de `ModulesProvider` antes de su último borrado.
 */

import {
  createContext,
  useContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import type { Order } from '@/lib/erp';
import type { TableAccount } from '@/lib/domain';
import { applyBranchWrite } from '@/lib/branch-scope';
import { loadErpState } from '@/lib/persistence';
import {
  mergeById,
  migrateLegacyScopes,
  useModuleStore,
  readLegacyErpField,
  type LegacyErpState,
} from '@/lib/module-store';
import { demoScopeFor, initialAccounts, initialScopes } from '@/lib/tenancy';

const EMPTY_ACCOUNTS: TableAccount[] = [];
const EMPTY_ORDERS: Record<string, Order[]> = {};
const DEMO_ORDERS: Record<string, Order[]> = Object.fromEntries(
  Object.entries(initialScopes).map(([branchId, scope]) => [branchId, scope.orders]),
);

function readLegacyAccounts(tenantKey: string): TableAccount[] | null {
  return readLegacyErpField<TableAccount[]>(tenantKey, 'accounts');
}

function readLegacyOrders(tenantKey: string): Record<string, Order[]> | null {
  const state = loadErpState(tenantKey) as LegacyErpState | null;
  if (!state) return null;
  return migrateLegacyScopes(state, null, null).migrated?.ordersByBranch ?? null;
}

/* ------------------------------ cuentas ---------------------------------- */

type AccountsContextValue = {
  accounts: TableAccount[];
  setAccounts: Dispatch<SetStateAction<TableAccount[]>>;
  resetAccounts: () => void;
};

const AccountsContext = createContext<AccountsContextValue | null>(null);

function AccountsStoreProvider({ children }: { children: ReactNode }) {
  const { value: accounts, setValue: setAccounts, reset } = useModuleStore<TableAccount[]>({
    id: 'orders',
    empty: EMPTY_ACCOUNTS,
    demo: initialAccounts,
    readLegacy: readLegacyAccounts,
  });

  return (
    <AccountsContext.Provider value={{ accounts, setAccounts, resetAccounts: reset }}>
      {children}
    </AccountsContext.Provider>
  );
}

export function useAccounts(): AccountsContextValue {
  const context = useContext(AccountsContext);
  if (!context) throw new Error('useAccounts debe usarse dentro de AccountsProvider');
  return context;
}

/* --------------------------- comandas demo ------------------------------- */

type OrdersDemoContextValue = {
  ordersByBranch: Record<string, Order[]>;
  setOrdersForBranches: (
    branchIds: string[],
    activeId: string,
    value: SetStateAction<Order[]>,
  ) => void;
  setBranchOrders: (branchId: string, updater: (current: Order[]) => Order[]) => void;
  ensureDemoOrders: (branchIds: string[]) => void;
  /** Remapea claves slug→UUID (idempotente; fusiona por id). */
  remapBranches: (map: Record<string, string>) => void;
  resetOrdersDemo: () => void;
};

const OrdersDemoContext = createContext<OrdersDemoContextValue | null>(null);

function OrdersDemoProvider({ children }: { children: ReactNode }) {
  const { value, setValue, reset } = useModuleStore<Record<string, Order[]>>({
    id: 'orders-demo',
    empty: EMPTY_ORDERS,
    demo: DEMO_ORDERS,
    readLegacy: readLegacyOrders,
  });

  const setOrdersForBranches: OrdersDemoContextValue['setOrdersForBranches'] = (
    branchIds,
    activeId,
    next,
  ) => {
    setValue((prev) => applyBranchWrite(prev, branchIds, activeId, next));
  };

  const setBranchOrders: OrdersDemoContextValue['setBranchOrders'] = (branchId, updater) => {
    setValue((prev) => {
      const current = prev[branchId] ?? [];
      const next = updater(current);
      if (next === current) return prev;
      return { ...prev, [branchId]: next };
    });
  };

  const ensureDemoOrders: OrdersDemoContextValue['ensureDemoOrders'] = (branchIds) => {
    setValue((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const id of branchIds) {
        if (next[id]) continue;
        next[id] = demoScopeFor(id)?.orders ?? [];
        changed = true;
      }
      return changed ? next : prev;
    });
  };

  const remapBranches: OrdersDemoContextValue['remapBranches'] = (map) => {
    setValue((prev) => {
      let changed = false;
      const next: Record<string, Order[]> = {};
      for (const [branchId, list] of Object.entries(prev)) {
        const target = map[branchId] ?? branchId;
        if (target !== branchId) changed = true;
        next[target] = mergeById(next[target] ?? null, list);
      }
      return changed ? next : prev;
    });
  };

  return (
    <OrdersDemoContext.Provider
      value={{
        ordersByBranch: value,
        setOrdersForBranches,
        setBranchOrders,
        ensureDemoOrders,
        remapBranches,
        resetOrdersDemo: reset,
      }}
    >
      {children}
    </OrdersDemoContext.Provider>
  );
}

export function useOrdersDemo(): OrdersDemoContextValue {
  const context = useContext(OrdersDemoContext);
  if (!context) throw new Error('useOrdersDemo debe usarse dentro de AccountsProvider');
  return context;
}

/* ------------------------------ composición ------------------------------ */

export function AccountsProvider({ children }: { children: ReactNode }) {
  return (
    <AccountsStoreProvider>
      <OrdersDemoProvider>{children}</OrdersDemoProvider>
    </AccountsStoreProvider>
  );
}
