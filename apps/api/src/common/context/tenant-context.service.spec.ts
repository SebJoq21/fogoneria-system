import { describe, expect, it } from 'vitest';
import { TenantContextService } from './tenant-context.service.js';

describe('TenantContextService', () => {
  it('sin ejecución devuelve vacío', () => {
    const servicio = new TenantContextService();
    expect(servicio.get()).toBeUndefined();
    expect(servicio.getOrEmpty()).toEqual({
      userId: null,
      empresaId: null,
      sucursalId: null,
      rol: null,
      bypass: false,
    });
  });

  it('publica el contexto dentro del callback y lo limpia al salir', () => {
    const servicio = new TenantContextService();
    const dentro = servicio.run({ empresaId: 'e-1', rol: 'MESERO' }, () => servicio.getOrEmpty());
    expect(dentro).toMatchObject({ empresaId: 'e-1', rol: 'MESERO', bypass: false, userId: null });
    expect(servicio.get()).toBeUndefined();
  });

  it('asocia la transacción RLS al contexto actual', () => {
    const servicio = new TenantContextService();
    const tx = { id: 'tx' };
    servicio.run({ empresaId: 'e-1' }, () => {
      servicio.setTransaction(tx as never);
      expect(servicio.getOrEmpty().tx).toBe(tx);
    });
  });

  it('setTransaction fuera de un contexto no falla', () => {
    const servicio = new TenantContextService();
    expect(() => servicio.setTransaction({} as never)).not.toThrow();
  });
});
