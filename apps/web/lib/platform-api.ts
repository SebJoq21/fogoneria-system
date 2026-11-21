/**
 * Cliente del módulo plataforma (sesión, tenant y consola SaaS).
 *
 * Habla con el BFF (`/api/backend`) a través del SDK compartido: el access token
 * vive en una cookie HttpOnly y este cliente nunca lo ve. El login no pasa por
 * aquí a propósito: lo emite `/api/session` (BFF + `lib/session.ts`), que sigue
 * siendo la autoridad de la sesión.
 *
 * La API responde snake_case; el mapeo a `@fogoneria/contracts/{auth,tenant,onboarding,saas,billing}`
 * se hace en este archivo. El alta pública (`POST /onboarding`) es la única ruta
 * sin sesión que el BFF reenvía.
 */

import { createClient, queryString } from '@fogoneria/sdk';
import { rolDesdeApi, type UsuarioSesion } from '@fogoneria/contracts/auth';
import { esPlanEmpresa, type PlanEmpresa } from '@fogoneria/contracts/billing';
import {
  type OnboardingInput,
  type OnboardingResultado,
} from '@fogoneria/contracts/onboarding';
import { type EmpresaSaas, type MetricasSaas } from '@fogoneria/contracts/saas';
import {
  esEstadoEmpresa,
  type Empresa,
  type EstadoEmpresa,
  type Sucursal,
} from '@fogoneria/contracts/tenant';

export const plataformaClient = createClient({ baseUrl: '/api/backend' });

type DecimalLike = string | number;

/** Empresa tal como la devuelve `GET /tenant` (`snake_case`). */
export type ApiEmpresa = {
  id: string;
  nombre_legal: string;
  nombre_comercial: string | null;
  ruc: string;
  estado: string;
  plan_actual: string;
  limite_sucursales: number;
  trial_fin: string | null;
  mrr_monto: DecimalLike;
  totalSucursales: number;
  totalUsuarios: number;
};

/** Sucursal de `GET /tenant/branches`. */
export type ApiSucursal = {
  id: string;
  nombre: string;
  nombre_corto: string | null;
  direccion: string | null;
  telefono: string | null;
  aforo: number | null;
  es_matriz: boolean;
  estado: 'ABIERTA' | 'CERRADA';
};

/** Empresa de la consola SaaS (`GET /saas/tenants`). */
export type ApiEmpresaSaas = {
  id: string;
  nombre_legal: string;
  nombre_comercial: string | null;
  ruc: string;
  estado: string;
  plan_actual: string;
  mrr_monto: DecimalLike;
  _count: { sucursales: number; usuarios: number };
};

export type ApiEmpresaList = {
  items: ApiEmpresaSaas[];
  total: number;
  page: number;
  limit: number;
};

/** Usuario del login de la API; el rol llega como enum `rol_usuario`. */
export type ApiUsuarioLogin = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  empresaId: string | null;
  sucursalId: string | null;
};

export type ApiOnboardingResultado = {
  id: string;
  nombreLegal: string;
  nombreComercial: string | null;
  ruc: string;
  logoUrl: string | null;
  estado: string;
  plan: string;
  trialFin: string | null;
  sucursalMatriz: { id: string; nombre: string };
  admin: { id: string; nombre: string; email: string };
};

export type ListaEmpresasSaas = {
  items: EmpresaSaas[];
  total: number;
  page: number;
  limit: number;
};

function numero(value: DecimalLike | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function estado(value: string): EstadoEmpresa {
  return esEstadoEmpresa(value) ? value : 'LEAD';
}

function plan(value: string): PlanEmpresa {
  return esPlanEmpresa(value) ? value : 'TRIAL';
}

export function toEmpresa(raw: ApiEmpresa): Empresa {
  return {
    id: raw.id,
    nombreLegal: raw.nombre_legal,
    nombreComercial: raw.nombre_comercial,
    ruc: raw.ruc,
    estado: estado(raw.estado),
    plan: plan(raw.plan_actual),
    limiteSucursales: Number(raw.limite_sucursales ?? 0),
    trialFin: raw.trial_fin ?? null,
    mrr: numero(raw.mrr_monto),
    totalSucursales: Number(raw.totalSucursales ?? 0),
    totalUsuarios: Number(raw.totalUsuarios ?? 0),
  };
}

export function toSucursal(raw: ApiSucursal): Sucursal {
  return {
    id: raw.id,
    nombre: raw.nombre,
    nombreCorto: raw.nombre_corto ?? raw.nombre,
    direccion: raw.direccion ?? '',
    telefono: raw.telefono ?? '',
    aforo: raw.aforo ?? null,
    esMatriz: Boolean(raw.es_matriz),
    estado: raw.estado === 'CERRADA' ? 'CERRADA' : 'ABIERTA',
  };
}

export function toEmpresaSaas(raw: ApiEmpresaSaas): EmpresaSaas {
  return {
    id: raw.id,
    nombreLegal: raw.nombre_legal,
    nombreComercial: raw.nombre_comercial,
    ruc: raw.ruc,
    estado: estado(raw.estado),
    plan: plan(raw.plan_actual),
    mrr: numero(raw.mrr_monto),
    sucursales: Number(raw._count?.sucursales ?? 0),
    usuarios: Number(raw._count?.usuarios ?? 0),
  };
}

/** KPIs de la consola; la API ya los manda en camelCase, se normalizan. */
export function toMetricas(raw: Partial<MetricasSaas> | null | undefined): MetricasSaas {
  const empresas = raw?.empresas;
  return {
    empresas: {
      total: Number(empresas?.total ?? 0),
      trial: Number(empresas?.trial ?? 0),
      active: Number(empresas?.active ?? 0),
      suspended: Number(empresas?.suspended ?? 0),
      expired: Number(empresas?.expired ?? 0),
    },
    mrr: numero(raw?.mrr),
  };
}

/** Usuario de la API → usuario de sesión. `null` si el rol no es válido. */
export function toUsuarioSesion(raw: ApiUsuarioLogin): UsuarioSesion | null {
  const rol = rolDesdeApi(raw.rol);
  if (!rol) return null;
  return {
    id: raw.id,
    nombre: raw.nombre,
    email: raw.email,
    rol,
    empresaId: raw.empresaId ?? null,
    sucursalId: raw.sucursalId ?? null,
  };
}

export function toOnboardingResultado(raw: ApiOnboardingResultado): OnboardingResultado {
  return {
    id: raw.id,
    nombreLegal: raw.nombreLegal,
    nombreComercial: raw.nombreComercial,
    ruc: raw.ruc,
    logoUrl: raw.logoUrl,
    estado: estado(raw.estado),
    plan: plan(raw.plan),
    trialFin: raw.trialFin,
    sucursalMatriz: raw.sucursalMatriz,
    admin: raw.admin,
  };
}

export const plataformaApi = {
  /** Alta pública de un restaurante. El BFF reenvía esta ruta sin sesión. */
  async onboarding(input: OnboardingInput): Promise<OnboardingResultado> {
    const raw = await plataformaClient.post<ApiOnboardingResultado>('/onboarding', input);
    return toOnboardingResultado(raw);
  },

  async empresas(signal?: AbortSignal): Promise<ListaEmpresasSaas> {
    const raw = await plataformaClient.get<ApiEmpresaList>(
      `/saas/tenants${queryString({ limit: 50 })}`,
      { signal },
    );
    return {
      items: (raw.items ?? []).map(toEmpresaSaas),
      total: raw.total,
      page: raw.page,
      limit: raw.limit,
    };
  },

  async metricas(signal?: AbortSignal): Promise<MetricasSaas> {
    return toMetricas(
      await plataformaClient.get<Partial<MetricasSaas>>('/saas/metrics', { signal }),
    );
  },

  async suspender(id: string, motivo: string): Promise<EmpresaSaas> {
    const raw = await plataformaClient.post<ApiEmpresaSaas>(`/saas/tenants/${id}/suspend`, {
      motivo,
    });
    return toEmpresaSaas(raw);
  },

  async reactivar(id: string, motivo: string): Promise<EmpresaSaas> {
    const raw = await plataformaClient.post<ApiEmpresaSaas>(`/saas/tenants/${id}/reactivate`, {
      motivo,
    });
    return toEmpresaSaas(raw);
  },

  /** Empresa del token. Lista para Fase 4 (`TenantProvider`). */
  async empresa(signal?: AbortSignal): Promise<Empresa> {
    return toEmpresa(await plataformaClient.get<ApiEmpresa>('/tenant', { signal }));
  },

  /** Sucursales visibles para el token. Lista para Fase 4. */
  async sucursales(signal?: AbortSignal): Promise<Sucursal[]> {
    const rows = await plataformaClient.get<ApiSucursal[]>('/tenant/branches', { signal });
    return rows.map(toSucursal);
  },
};
