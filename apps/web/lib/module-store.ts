'use client';

/**
 * Fábrica de stores por módulo (F6b): estado + persistencia por tenant +
 * sincronización entre pestañas con `BroadcastChannel`, sin tocar el estado
 * global que aún vive en `ModulesProvider`.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSession } from '@/components/dashboard/providers/session';
import type { ErpState } from '@/lib/persistence';
import { loadErpState } from '@/lib/persistence';
import type { Ingredient, StockMovement } from '@/lib/erp';
import { tenantKeyOf } from '@/lib/session-state';
import { DEMO_EMPRESA_ID } from '@/lib/tenancy';

export type LegacyErpState = ErpState & Record<string, unknown>;

export type InventoryStoreState = {
  ingredients: Ingredient[];
  movements: StockMovement[];
};

export function moduleStorageKey(id: string, tenantKey: string): string {
  return `fogoneria:${id}:v1:${tenantKey}`;
}

export function moduleChannelKey(id: string, tenantKey: string): string {
  return `fogoneria:${id}-sync:${tenantKey}`;
}

export function readModuleValue<T>(id: string, tenantKey: string): T | null {
  try {
    const raw = localStorage.getItem(moduleStorageKey(id, tenantKey));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveModuleValue<T>(id: string, tenantKey: string, value: T): void {
  try {
    localStorage.setItem(moduleStorageKey(id, tenantKey), JSON.stringify(value));
  } catch {
    /* almacenamiento no disponible */
  }
}

/** Fallback de solo lectura para un provider montado sin el loader global. */
export function readLegacyErpField<T>(tenantKey: string, field: string): T | null {
  const state = loadErpState(tenantKey) as LegacyErpState | null;
  const value = state?.[field];
  return value === undefined ? null : (value as T);
}

export function mergeById<T extends { id: number | string }>(
  legacy: T[] | null,
  existing: T[] | null,
): T[] {
  const byId = new Map<number | string, T>();
  for (const item of legacy ?? []) byId.set(item.id, item);
  for (const item of existing ?? []) byId.set(item.id, item);
  return [...byId.values()];
}

export function migrateLegacyArray<T extends { id: number | string }>(
  state: LegacyErpState,
  field: string,
  existing: T[] | null,
): { state: ErpState; migrated: T[] | null } {
  const legacy = state[field];
  if (!Array.isArray(legacy)) return { state, migrated: null };
  const rest = { ...state };
  delete rest[field];
  return {
    state: rest as ErpState,
    migrated: mergeById(legacy as T[], existing),
  };
}

export function migrateLegacyInventory(
  state: LegacyErpState,
  existing: InventoryStoreState | null,
): { state: ErpState; migrated: InventoryStoreState | null } {
  const legacyIngredients = Array.isArray(state.ingredients)
    ? (state.ingredients as Ingredient[])
    : null;
  const legacyMovements = Array.isArray(state.movements)
    ? (state.movements as StockMovement[])
    : null;
  if (!legacyIngredients && !legacyMovements) return { state, migrated: null };
  const rest = { ...state };
  delete rest.ingredients;
  delete rest.movements;
  return {
    state: rest as ErpState,
    migrated: {
      ingredients: mergeById(legacyIngredients, existing?.ingredients ?? null),
      movements: mergeById(legacyMovements, existing?.movements ?? null),
    },
  };
}

type ModuleStoreOptions<T> = {
  id: string;
  empty: T;
  demo: T;
  /** Fallback legacy solo para montajes aislados; el loader global migra. */
  readLegacy?: (tenantKey: string) => T | null;
};

type ModuleSyncMessage<T> = { type: 'state' | 'reset'; source: string; value: T };

export function useModuleStore<T>({ id, empty, demo, readLegacy }: ModuleStoreOptions<T>) {
  const { currentUser } = useSession();
  const tenantKey = tenantKeyOf(currentUser);
  const [value, setValue] = useState<T>(empty);
  /** Tenant al que pertenece `value`: evita guardar el valor anterior en la clave nueva. */
  const [hydratedTenant, setHydratedTenant] = useState<string | null>(null);
  const sourceId = useId();
  const applyingRemote = useRef(false);
  const skipBroadcast = useRef(false);

  useEffect(() => {
    const saved = readModuleValue<T>(id, tenantKey);
    const legacy = saved === null ? (readLegacy?.(tenantKey) ?? null) : null;
    const demoValue = tenantKey === 'anon' || tenantKey === DEMO_EMPRESA_ID ? demo : empty;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación por tenant
    setValue(saved ?? legacy ?? demoValue);
    setHydratedTenant(tenantKey);
  }, [demo, empty, id, readLegacy, tenantKey]);

  useEffect(() => {
    if (hydratedTenant !== tenantKey) return;
    saveModuleValue(id, tenantKey, value);
    if (applyingRemote.current) {
      applyingRemote.current = false;
      return;
    }
    if (skipBroadcast.current) {
      skipBroadcast.current = false;
      return;
    }
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(moduleChannelKey(id, tenantKey));
    channel.postMessage({ type: 'state', source: sourceId, value } satisfies ModuleSyncMessage<T>);
    channel.close();
  }, [hydratedTenant, id, sourceId, tenantKey, value]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(moduleChannelKey(id, tenantKey));
    channel.onmessage = (event: MessageEvent<ModuleSyncMessage<T>>) => {
      const message = event.data;
      if (!message || message.source === sourceId) return;
      applyingRemote.current = true;
      setValue(message.value);
    };
    return () => channel.close();
  }, [id, sourceId, tenantKey]);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(moduleStorageKey(id, tenantKey));
    } catch {
      /* almacenamiento no disponible */
    }
    const next = tenantKey === 'anon' || tenantKey === DEMO_EMPRESA_ID ? demo : empty;
    skipBroadcast.current = true;
    setValue(next);
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(moduleChannelKey(id, tenantKey));
      channel.postMessage({ type: 'reset', source: sourceId, value: next } satisfies ModuleSyncMessage<T>);
      channel.close();
    }
  }, [demo, empty, id, sourceId, tenantKey]);

  const result = useMemo(
    () => ({ value, setValue, reset }),
    [reset, setValue, value],
  );
  return result;
}
