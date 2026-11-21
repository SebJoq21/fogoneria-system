import { describe, expect, it } from 'vitest';
import { esEstadoEmpresa, estadoEmpresaTone, etiquetaEstadoEmpresa } from './tenant';

describe('contrato de tenant', () => {
  it('etiqueta los estados y cae a Lead', () => {
    expect(etiquetaEstadoEmpresa('ACTIVE')).toBe('Activa');
    expect(etiquetaEstadoEmpresa('SUSPENDED')).toBe('Suspendida');
    expect(etiquetaEstadoEmpresa('TRIAL')).toBe('Trial');
    expect(etiquetaEstadoEmpresa('EXPIRED')).toBe('Expirada');
    expect(etiquetaEstadoEmpresa('NO_CALIFICADO')).toBe('Lead');
    expect(etiquetaEstadoEmpresa('PENDIENTE')).toBe('Lead');
  });

  it('valida estados y asigna tono de badge', () => {
    expect(esEstadoEmpresa('ACTIVE')).toBe(true);
    expect(esEstadoEmpresa('PENDIENTE')).toBe(false);
    expect(estadoEmpresaTone('ACTIVE')).toBe('success');
    expect(estadoEmpresaTone('TRIAL')).toBe('warning');
    expect(estadoEmpresaTone('LEAD')).toBe('danger');
  });
});
