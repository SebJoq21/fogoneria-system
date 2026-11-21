import { describe, expect, it } from 'vitest';
import { esPlanEmpresa, etiquetaPlan, resumenFacturacion } from './billing';

describe('contrato de billing', () => {
  it('valida y etiqueta los planes', () => {
    expect(esPlanEmpresa('BASICO')).toBe(true);
    expect(esPlanEmpresa('EMPRESA')).toBe(false);
    expect(etiquetaPlan('TRIAL')).toBe('Trial');
    expect(etiquetaPlan('PROFESIONAL')).toBe('Profesional');
    expect(etiquetaPlan('EMPRESA')).toBe('Trial');
  });

  it('deriva el resumen de facturación y normaliza ceros', () => {
    expect(
      resumenFacturacion({
        mrr: 480.5,
        empresas: { total: 5, trial: 2, active: 2, suspended: 1, expired: 0 },
      }),
    ).toEqual({ mrr: 480.5, total: 5, trial: 2, active: 2, suspended: 1, expired: 0 });
    expect(
      resumenFacturacion({
        mrr: Number.NaN,
        empresas: { total: 0, trial: 0, active: 0, suspended: 0, expired: 0 },
      }).mrr,
    ).toBe(0);
  });
});
