/**
 * API del módulo Tenant: empresa y sucursales del token.
 * La implementación compartida vive en `lib/platform-api.ts`; `TenantProvider`
 * sigue siendo el dueño del estado hasta la Fase 6.
 */
import { plataformaApi } from '@/lib/platform-api';

export const tenantApi = {
  empresa: plataformaApi.empresa,
  sucursales: plataformaApi.sucursales,
};

export { toEmpresa, toSucursal } from '@/lib/platform-api';
export type { PlanEmpresa } from '@fogoneria/contracts/billing';
export type {
  Empresa,
  EstadoEmpresa,
  Sucursal,
} from '@fogoneria/contracts/tenant';
