/* Cliente de la consola SaaS (superadmin). Pasa por el BFF para adjuntar el
   token HttpOnly; nunca usa fetch directo a la API desde el navegador. */

import { apiFetch } from "./api";

export type SaasTenant = {
  id: string;
  nombre_legal: string;
  nombre_comercial: string | null;
  ruc: string;
  plan_actual: "TRIAL" | "BASICO" | "PROFESIONAL";
  estado: "LEAD" | "NO_CALIFICADO" | "TRIAL" | "ACTIVE" | "SUSPENDED" | "EXPIRED";
  mrr_monto: string | number;
  _count: { sucursales: number; usuarios: number };
};

export type SaasMetrics = {
  empresas: {
    total: number;
    trial: number;
    active: number;
    suspended: number;
    expired: number;
  };
  mrr: number;
};

type TenantList = { items: SaasTenant[]; total: number; page: number; limit: number };

export function fetchTenants(): Promise<TenantList> {
  return apiFetch<TenantList>("/saas/tenants?limit=50");
}

export function fetchMetrics(): Promise<SaasMetrics> {
  return apiFetch<SaasMetrics>("/saas/metrics");
}

export function suspendTenant(id: string, motivo: string): Promise<SaasTenant> {
  return apiFetch<SaasTenant>(`/saas/tenants/${id}/suspend`, {
    method: "POST",
    body: { motivo },
  });
}

export function reactivateTenant(id: string, motivo: string): Promise<SaasTenant> {
  return apiFetch<SaasTenant>(`/saas/tenants/${id}/reactivate`, {
    method: "POST",
    body: { motivo },
  });
}
