/**
 * Contrato de la consola SaaS: empresas, métricas y acciones de suspensión.
 *
 * Solo lo consume el superadmin; el backend usa el rol `BYPASSRLS` para leer
 * todos los tenants.
 */

import type { PlanEmpresa } from './billing';
import type { EstadoEmpresa } from './tenant';

/** Empresa de la consola SaaS (`GET /saas/tenants`). */
export type EmpresaSaas = {
  id: string;
  nombreLegal: string;
  nombreComercial: string | null;
  ruc: string;
  estado: EstadoEmpresa;
  plan: PlanEmpresa;
  mrr: number;
  sucursales: number;
  usuarios: number;
};

export type MetricasSaas = {
  empresas: {
    total: number;
    trial: number;
    active: number;
    suspended: number;
    expired: number;
  };
  mrr: number;
};
