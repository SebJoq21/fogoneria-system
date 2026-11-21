/**
 * Contrato de tenant: empresa del token, sucursales y estado SaaS.
 *
 * Los tipos de lectura usan camelCase; el mapeo desde `snake_case` vive en
 * `lib/platform-api.ts` y en el `TenantProvider`. El aislamiento real lo aplica
 * la API con RLS.
 */

import type { PlanEmpresa } from './billing';

export type EstadoEmpresa =
  | 'LEAD'
  | 'NO_CALIFICADO'
  | 'TRIAL'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'EXPIRED';

export const ESTADOS_EMPRESA: readonly EstadoEmpresa[] = [
  'LEAD',
  'NO_CALIFICADO',
  'TRIAL',
  'ACTIVE',
  'SUSPENDED',
  'EXPIRED',
];

export function esEstadoEmpresa(value: string): value is EstadoEmpresa {
  return (ESTADOS_EMPRESA as readonly string[]).includes(value);
}

/** Estado que pinta la consola SaaS; `NO_CALIFICADO` se muestra como Lead. */
export type EstadoEmpresaUi = 'Activa' | 'Suspendida' | 'Trial' | 'Expirada' | 'Lead';

export function etiquetaEstadoEmpresa(estado: EstadoEmpresa | string): EstadoEmpresaUi {
  switch (estado) {
    case 'ACTIVE':
      return 'Activa';
    case 'SUSPENDED':
      return 'Suspendida';
    case 'TRIAL':
      return 'Trial';
    case 'EXPIRED':
      return 'Expirada';
    default:
      return 'Lead';
  }
}

export type TonoEstado = 'success' | 'warning' | 'danger';

export function estadoEmpresaTone(estado: EstadoEmpresa | string): TonoEstado {
  if (estado === 'ACTIVE') return 'success';
  if (estado === 'TRIAL') return 'warning';
  return 'danger';
}

/** Empresa del token (`GET /tenant`), ya normalizada. */
export type Empresa = {
  id: string;
  nombreLegal: string;
  nombreComercial: string | null;
  ruc: string;
  estado: EstadoEmpresa;
  plan: PlanEmpresa;
  limiteSucursales: number;
  trialFin: string | null;
  mrr: number;
  totalSucursales: number;
  totalUsuarios: number;
};

/** Sucursal de la empresa (`GET /tenant/branches`). */
export type Sucursal = {
  id: string;
  nombre: string;
  nombreCorto: string;
  direccion: string;
  telefono: string;
  aforo: number | null;
  esMatriz: boolean;
  estado: 'ABIERTA' | 'CERRADA';
};
