'use client';

/**
 * Provider del módulo Caja (F6c2): dueño de los turnos y de los movimientos
 * por sucursal (antes en `scopes[*].cash`).
 *
 * `addMovements`/`reverseMovements` son las puertas de escritura del cobro y
 * de la anulación; `setMovements` existe para la fachada de `useModules()`
 * (compatibilidad con las vistas). La migración/purga de `cashShifts` y
 * `scopes[*].cash` corre en el loader de `ModulesProvider`.
 */

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { expectedCashFor, fmtDateTime, newId, nowIso, round2 } from '@/lib/domain';
import type { CashShift } from '@/lib/domain';
import type { CashMovement } from '@/lib/erp';
import { loadErpState } from '@/lib/persistence';
import {
  migrateLegacyCash,
  useModuleStore,
  type CashStoreState,
  type LegacyErpState,
} from '@/lib/module-store';
import { initialCashMovementsByBranch, initialCashShifts } from '@/lib/tenancy';

const EMPTY: CashStoreState = { shifts: [], movementsByBranch: {} };
const DEMO: CashStoreState = {
  shifts: initialCashShifts,
  movementsByBranch: initialCashMovementsByBranch,
};

function readLegacy(tenantKey: string): CashStoreState | null {
  const state = loadErpState(tenantKey) as LegacyErpState | null;
  if (!state) return null;
  return migrateLegacyCash(state, null).migrated;
}

type BranchUpdater = (current: CashMovement[]) => CashMovement[];

type CashContextValue = {
  cashShifts: CashShift[];
  movementsByBranch: Record<string, CashMovement[]>;
  movementsOf: (branchId: string) => CashMovement[];
  allMovements: (branchIds: string[]) => CashMovement[];
  activeShift: (branchId: string) => CashShift | null;
  startShift: (input: { branchId: string; fund: number; openedBy: string }) => void;
  closeShift: (input: {
    branchId: string;
    countedCash: number;
    observations: string;
    closedBy: string;
  }) => void;
  addMovements: (branchId: string, movements: CashMovement[]) => void;
  reverseMovements: (branchId: string, movements: CashMovement[]) => void;
  setMovements: (branchId: string, updater: BranchUpdater) => void;
  setMovementsByBranch: (
    updater: (prev: Record<string, CashMovement[]>) => Record<string, CashMovement[]>,
  ) => void;
  setShifts: (updater: (prev: CashShift[]) => CashShift[]) => void;
  remapBranches: (map: Record<string, string>) => void;
  resetCash: () => void;
};

const CashContext = createContext<CashContextValue | null>(null);

export function CashProvider({ children }: { children: ReactNode }) {
  const { value, setValue, reset } = useModuleStore<CashStoreState>({
    id: 'cash',
    empty: EMPTY,
    demo: DEMO,
    readLegacy,
  });

  const movementsOf = useCallback(
    (branchId: string) => value.movementsByBranch[branchId] ?? [],
    [value.movementsByBranch],
  );

  const allMovements = useCallback(
    (branchIds: string[]) => branchIds.flatMap((id) => value.movementsByBranch[id] ?? []),
    [value.movementsByBranch],
  );

  const activeShift = useCallback(
    (branchId: string) =>
      value.shifts.find((shift) => shift.branchId === branchId && shift.status === 'abierto') ??
      null,
    [value.shifts],
  );

  const startShift = useCallback<CashContextValue['startShift']>(
    ({ branchId, fund, openedBy }) => {
      setValue((prev) => {
        if (prev.shifts.some((s) => s.branchId === branchId && s.status === 'abierto')) return prev;
        const at = nowIso();
        const shift: CashShift = {
          id: newId('CH'),
          branchId,
          status: 'abierto',
          openedBy,
          openedAt: at,
          openingFund: round2(fund),
          closedBy: null,
          closedAt: null,
          countedCash: null,
          expectedCash: null,
          difference: null,
          observations: '',
        };
        const movement: CashMovement = {
          id: Date.now(),
          at,
          datetime: fmtDateTime(at),
          concept: 'Fondo de apertura',
          kind: 'Ingreso',
          amount: shift.openingFund,
          method: 'Efectivo',
          shiftId: shift.id,
        };
        return {
          shifts: [shift, ...prev.shifts],
          movementsByBranch: {
            ...prev.movementsByBranch,
            [branchId]: [movement, ...(prev.movementsByBranch[branchId] ?? [])],
          },
        };
      });
    },
    [setValue],
  );

  const closeShift = useCallback<CashContextValue['closeShift']>(
    ({ branchId, countedCash, observations, closedBy }) => {
      setValue((prev) => {
        const shift = prev.shifts.find(
          (s) => s.branchId === branchId && s.status === 'abierto',
        );
        if (!shift) return prev;
        const expected = expectedCashFor(shift, prev.movementsByBranch[branchId] ?? []);
        const rounded = round2(countedCash);
        return {
          ...prev,
          shifts: prev.shifts.map((s) =>
            s.id === shift.id
              ? {
                  ...s,
                  status: 'cerrado',
                  closedBy,
                  closedAt: nowIso(),
                  countedCash: rounded,
                  expectedCash: expected,
                  difference: round2(rounded - expected),
                  observations,
                }
              : s,
          ),
        };
      });
    },
    [setValue],
  );

  const addMovements = useCallback<CashContextValue['addMovements']>(
    (branchId, movements) => {
      if (movements.length === 0) return;
      setValue((prev) => ({
        ...prev,
        movementsByBranch: {
          ...prev.movementsByBranch,
          [branchId]: [...movements, ...(prev.movementsByBranch[branchId] ?? [])],
        },
      }));
    },
    [setValue],
  );

  const reverseMovements = useCallback<CashContextValue['reverseMovements']>(
    (branchId, movements) => {
      if (movements.length === 0) return;
      setValue((prev) => ({
        ...prev,
        movementsByBranch: {
          ...prev.movementsByBranch,
          [branchId]: [...movements, ...(prev.movementsByBranch[branchId] ?? [])],
        },
      }));
    },
    [setValue],
  );

  const setMovements = useCallback<CashContextValue['setMovements']>(
    (branchId, updater) => {
      setValue((prev) => {
        const current = prev.movementsByBranch[branchId] ?? [];
        const next = updater(current);
        if (next === current) return prev;
        return {
          ...prev,
          movementsByBranch: { ...prev.movementsByBranch, [branchId]: next },
        };
      });
    },
    [setValue],
  );

  const setMovementsByBranch = useCallback<CashContextValue['setMovementsByBranch']>(
    (updater) => {
      setValue((prev) => ({ ...prev, movementsByBranch: updater(prev.movementsByBranch) }));
    },
    [setValue],
  );

  const setShifts = useCallback<CashContextValue['setShifts']>(
    (updater) => {
      setValue((prev) => ({ ...prev, shifts: updater(prev.shifts) }));
    },
    [setValue],
  );

  /**
   * Remapea slug→UUID de turnos y de las claves de movimientos. Idempotente:
   * si nada cambia devuelve el mismo estado (sin re-render ni reescritura).
   */
  const remapBranches = useCallback<CashContextValue['remapBranches']>(
    (map) => {
      setValue((prev) => {
        let changed = false;
        const shifts = prev.shifts.map((shift) => {
          const branchId = map[shift.branchId] ?? shift.branchId;
          if (branchId === shift.branchId) return shift;
          changed = true;
          return { ...shift, branchId };
        });
        const movementsByBranch: Record<string, CashMovement[]> = {};
        for (const [branchId, list] of Object.entries(prev.movementsByBranch)) {
          const target = map[branchId] ?? branchId;
          if (target !== branchId) changed = true;
          movementsByBranch[target] = [...(movementsByBranch[target] ?? []), ...list];
        }
        if (!changed) return prev;
        return { shifts, movementsByBranch };
      });
    },
    [setValue],
  );

  const result = useMemo<CashContextValue>(
    () => ({
      cashShifts: value.shifts,
      movementsByBranch: value.movementsByBranch,
      movementsOf,
      allMovements,
      activeShift,
      startShift,
      closeShift,
      addMovements,
      reverseMovements,
      setMovements,
      setMovementsByBranch,
      setShifts,
      remapBranches,
      resetCash: reset,
    }),
    [
      activeShift,
      addMovements,
      allMovements,
      closeShift,
      movementsOf,
      remapBranches,
      reset,
      reverseMovements,
      setMovements,
      setMovementsByBranch,
      setShifts,
      startShift,
      value.movementsByBranch,
      value.shifts,
    ],
  );

  return <CashContext.Provider value={result}>{children}</CashContext.Provider>;
}

export function useCash(): CashContextValue {
  const context = useContext(CashContext);
  if (!context) throw new Error('useCash debe usarse dentro de CashProvider');
  return context;
}
