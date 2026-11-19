/* Helpers puros del tenant (Fase 4 etapa 2): resolución de la sucursal activa
   y comparación de ids. Sin React ni `localStorage`: eso vive en
   `TenantProvider`. La vista `todas` es el agregado de lectura. */

import { GENERAL_BRANCH, SEED_BRANCH_SLUGS, type Branch } from "./tenancy";

export type ResolveActiveBranchInput = {
  /** Sucursal del usuario del token (rol operativo). */
  userBranchId?: string | null;
  /** Última sucursal recordada en el navegador para esta empresa. */
  saved?: string | null;
  /** Ids de sucursales reales que devolvió la API. */
  realIds: readonly string[];
};

/**
 * Sucursal activa al entrar: la del usuario manda; después la recordada si
 * sigue vigente; si no, la primera real y, sin sucursales, la vista general.
 */
export function resolveActiveBranch({
  userBranchId,
  saved,
  realIds,
}: ResolveActiveBranchInput): string {
  if (userBranchId && realIds.includes(userBranchId)) return userBranchId;
  if (saved && realIds.includes(saved)) return saved;
  return realIds[0] ?? GENERAL_BRANCH.id;
}

/**
 * Compara una sucursal de un dato (cuenta, mesa, caja) con la activa. Tolera
 * el dataset demo, que mezcla slugs (`miraflores`) con UUID de la API.
 */
export function matchesBranch(branchA?: string | null, branchB?: string | null): boolean {
  if (!branchA || !branchB) return false;
  if (branchA === branchB) return true;
  const slugA = SEED_BRANCH_SLUGS[branchA] ?? branchA;
  const slugB = SEED_BRANCH_SLUGS[branchB] ?? branchB;
  return slugA === slugB;
}

/** Ids de sucursales reales (sin la vista agregada `todas`). */
export function branchIdsOf(branches: readonly Branch[]): string[] {
  return branches.map((branch) => branch.id);
}
