/**
 * API de la consola SaaS. La implementación compartida vive en
 * `lib/platform-api.ts`; solo la usa el superadmin.
 */
import { plataformaApi } from '@/lib/platform-api';

export const saasApi = {
  empresas: plataformaApi.empresas,
  metricas: plataformaApi.metricas,
  suspender: plataformaApi.suspender,
  reactivar: plataformaApi.reactivar,
};

export { toEmpresaSaas, toMetricas } from '@/lib/platform-api';
export type { EmpresaSaas, MetricasSaas } from '@fogoneria/contracts/saas';
