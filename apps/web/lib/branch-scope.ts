import type { SetStateAction } from 'react';

/**
 * Aplica un `SetStateAction` sobre una colección por sucursal (F6c3).
 *
 * - Sucursal activa: escribe solo esa rama.
 * - Vista general (`todas`): aplica sobre el combinado y reparte por `id`;
 *   los ítems nuevos van a la primera sucursal (matriz).
 *
 * Es el mismo comportamiento que tenía `applyWrite` en `ModulesProvider`.
 */
export function applyBranchWrite<T extends { id: number | string }>(
  prev: Record<string, T[]>,
  branchIds: string[],
  activeId: string,
  value: SetStateAction<T[]>,
): Record<string, T[]> {
  if (activeId !== 'todas') {
    const current = prev[activeId] ?? [];
    return { ...prev, [activeId]: typeof value === 'function' ? value(current) : value };
  }
  const combined = branchIds.flatMap((id) => prev[id] ?? []);
  const next = typeof value === 'function' ? value(combined) : value;
  const knownIds = new Set(combined.map((item) => item.id));
  const fresh = next.filter((item) => !knownIds.has(item.id));
  const out: Record<string, T[]> = { ...prev };
  branchIds.forEach((id, i) => {
    const own = new Set((prev[id] ?? []).map((item) => item.id));
    const slice = next.filter((item) => own.has(item.id));
    out[id] = i === 0 ? [...slice, ...fresh] : slice;
  });
  return out;
}
