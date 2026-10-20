/* Datos del tenant autenticado (tarea 57): empresa real y sus sucursales.
   La API devuelve snake_case; aquí se traduce a los tipos del shell. */

import { apiFetch } from "./api";
import type { Branch } from "./tenancy";

export type Tenant = {
  id: string;
  legalName: string;
  tradeName: string | null;
  ruc: string;
  status: string;
  plan: string;
  branchLimit: number;
  trialEnd: string | null;
  mrr: number;
  totalBranches: number;
  totalUsers: number;
};

type ApiTenant = {
  id: string;
  nombre_legal: string;
  nombre_comercial: string | null;
  ruc: string;
  estado: string;
  plan_actual: string;
  limite_sucursales: number;
  trial_fin: string | null;
  mrr_monto: string | number;
  totalSucursales: number;
  totalUsuarios: number;
};

type ApiBranch = {
  id: string;
  nombre: string;
  nombre_corto: string | null;
  direccion: string | null;
  telefono: string | null;
  aforo: number | null;
  es_matriz: boolean;
  estado: "ABIERTA" | "CERRADA";
};

const toTenant = (t: ApiTenant): Tenant => ({
  id: t.id,
  legalName: t.nombre_legal,
  tradeName: t.nombre_comercial,
  ruc: t.ruc,
  status: t.estado,
  plan: t.plan_actual,
  branchLimit: t.limite_sucursales,
  trialEnd: t.trial_fin,
  mrr: Number(t.mrr_monto ?? 0) || 0,
  totalBranches: t.totalSucursales,
  totalUsers: t.totalUsuarios,
});

const toBranch = (b: ApiBranch): Branch => ({
  id: b.id,
  name: b.nombre,
  short: b.nombre_corto ?? b.nombre,
  address: b.direccion ?? "",
  phone: b.telefono ?? "",
  isMain: b.es_matriz,
  status: b.estado === "ABIERTA" ? "Abierta" : "Cerrada",
});

/** Empresa del token actual. */
export async function fetchTenant(signal?: AbortSignal): Promise<Tenant> {
  return toTenant(await apiFetch<ApiTenant>("/tenant", { signal }));
}

/** Sucursales visibles para el usuario del token. */
export async function fetchBranches(signal?: AbortSignal): Promise<Branch[]> {
  const rows = await apiFetch<ApiBranch[]>("/tenant/branches", { signal });
  return rows.map(toBranch);
}
