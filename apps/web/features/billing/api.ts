/**
 * API de facturación: resumen de MRR y estados de suscripción.
 * Reutiliza las métricas de la consola SaaS; el cobro real lo hace la pasarela.
 */
import { resumenFacturacion, type ResumenFacturacion } from '@fogoneria/contracts/billing';
import { plataformaApi } from '@/lib/platform-api';

export const billingApi = {
  async resumen(signal?: AbortSignal): Promise<ResumenFacturacion> {
    return resumenFacturacion(await plataformaApi.metricas(signal));
  },
};

export type { ResumenFacturacion } from '@fogoneria/contracts/billing';
