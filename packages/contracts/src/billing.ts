/**
 * Contrato de facturación: plan, estado de suscripción y resumen de MRR.
 *
 * El cobro real lo hace la pasarela; aquí solo viven las formas que consume la
 * consola SaaS (`/saas`) y el panel de facturación.
 */

export type PlanEmpresa = 'TRIAL' | 'BASICO' | 'PROFESIONAL';

export const PLANES_EMPRESA: readonly PlanEmpresa[] = ['TRIAL', 'BASICO', 'PROFESIONAL'];

export function esPlanEmpresa(value: string): value is PlanEmpresa {
  return (PLANES_EMPRESA as readonly string[]).includes(value);
}

export function etiquetaPlan(plan: PlanEmpresa | string): 'Trial' | 'Básico' | 'Profesional' {
  switch (plan) {
    case 'BASICO':
      return 'Básico';
    case 'PROFESIONAL':
      return 'Profesional';
    default:
      return 'Trial';
  }
}

export type ResumenFacturacion = {
  mrr: number;
  total: number;
  trial: number;
  active: number;
  suspended: number;
  expired: number;
};

/** Deriva el resumen de facturación de las métricas de la consola SaaS. */
export function resumenFacturacion(input: {
  mrr: number;
  empresas: { total: number; trial: number; active: number; suspended: number; expired: number };
}): ResumenFacturacion {
  return {
    mrr: Number(input.mrr ?? 0) || 0,
    total: Number(input.empresas.total ?? 0) || 0,
    trial: Number(input.empresas.trial ?? 0) || 0,
    active: Number(input.empresas.active ?? 0) || 0,
    suspended: Number(input.empresas.suspended ?? 0) || 0,
    expired: Number(input.empresas.expired ?? 0) || 0,
  };
}
