'use client';

/**
 * Provider del módulo Mesas (F6c3): dueño de las mesas demo por sucursal
 * (antes `scopes[*].tables`).
 *
 * Con sesión la API manda (`useModules().tables` = `liveTables`); este store
 * solo conserva el demo y el parche de estado que usan abrir/anular/cobrar.
 */

import { createContext, useContext, type ReactNode, type SetStateAction } from 'react';
import type { Table } from '@/lib/erp';
import { applyBranchWrite } from '@/lib/branch-scope';
import { loadErpState } from '@/lib/persistence';
import {
  mergeById,
  migrateLegacyScopes,
  useModuleStore,
  type LegacyErpState,
} from '@/lib/module-store';
import {
  SEED_BRANCH_SLUGS,
  SEED_SLUG_BRANCH_IDS,
  demoScopeFor,
  initialScopes,
} from '@/lib/tenancy';

const EMPTY: Record<string, Table[]> = {};
const DEMO: Record<string, Table[]> = Object.fromEntries(
  Object.entries(initialScopes).map(([branchId, scope]) => [branchId, scope.tables]),
);

function readLegacy(tenantKey: string): Record<string, Table[]> | null {
  const state = loadErpState(tenantKey) as LegacyErpState | null;
  if (!state) return null;
  return migrateLegacyScopes(state, null, null).migrated?.tablesByBranch ?? null;
}

type TablesContextValue = {
  tablesByBranch: Record<string, Table[]>;
  setTablesForBranches: (
    branchIds: string[],
    activeId: string,
    value: SetStateAction<Table[]>,
  ) => void;
  /** Cambia el estado de una mesa en la sucursal (y sus alias slug/UUID). */
  patchStatus: (branchId: string, tableId: number, status: Table['status']) => void;
  ensureDemoTables: (branchIds: string[]) => void;
  /** Remapea claves slug→UUID (idempotente; fusiona por id). */
  remapBranches: (map: Record<string, string>) => void;
  resetTables: () => void;
};

const TablesContext = createContext<TablesContextValue | null>(null);

export function TablesProvider({ children }: { children: ReactNode }) {
  const { value, setValue, reset } = useModuleStore<Record<string, Table[]>>({
    id: 'tables-demo',
    empty: EMPTY,
    demo: DEMO,
    readLegacy,
  });

  const setTablesForBranches: TablesContextValue['setTablesForBranches'] = (
    branchIds,
    activeId,
    next,
  ) => {
    setValue((prev) => applyBranchWrite(prev, branchIds, activeId, next));
  };

  const patchStatus: TablesContextValue['patchStatus'] = (branchId, tableId, status) => {
    setValue((prev) => {
      const targets = new Set(
        [branchId, SEED_BRANCH_SLUGS[branchId], SEED_SLUG_BRANCH_IDS[branchId]].filter(
          (item): item is string => Boolean(item),
        ),
      );
      let changed = false;
      const next = { ...prev };
      for (const id of targets) {
        const list = next[id];
        if (!list) continue;
        const updated = list.map((table) =>
          table.id === tableId ? { ...table, status } : table,
        );
        if (updated.some((table, index) => table !== list[index])) {
          next[id] = updated;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  };

  const ensureDemoTables: TablesContextValue['ensureDemoTables'] = (branchIds) => {
    setValue((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const id of branchIds) {
        if (next[id]) continue;
        next[id] = demoScopeFor(id)?.tables ?? [];
        changed = true;
      }
      return changed ? next : prev;
    });
  };

  const remapBranches: TablesContextValue['remapBranches'] = (map) => {
    setValue((prev) => {
      let changed = false;
      const next: Record<string, Table[]> = {};
      for (const [branchId, list] of Object.entries(prev)) {
        const target = map[branchId] ?? branchId;
        if (target !== branchId) changed = true;
        next[target] = mergeById(next[target] ?? null, list);
      }
      return changed ? next : prev;
    });
  };

  return (
    <TablesContext.Provider
      value={{
        tablesByBranch: value,
        setTablesForBranches,
        patchStatus,
        ensureDemoTables,
        remapBranches,
        resetTables: reset,
      }}
    >
      {children}
    </TablesContext.Provider>
  );
}

export function useTables(): TablesContextValue {
  const context = useContext(TablesContext);
  if (!context) throw new Error('useTables debe usarse dentro de TablesProvider');
  return context;
}
