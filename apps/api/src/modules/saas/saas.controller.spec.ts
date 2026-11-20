import { describe, expect, it, vi } from 'vitest';
import { SaasController } from './saas.controller.js';
import type { SaasService } from './saas.service.js';

const actor = { userId: 'u-1', empresaId: 'e-1' } as never;

function build() {
  const saas = {
    createTenant: vi.fn().mockResolvedValue({ id: 'e-1' }),
    list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getTenant: vi.fn().mockResolvedValue({ id: 'e-1' }),
    suspend: vi.fn().mockResolvedValue({ id: 'e-1', estado: 'SUSPENDED' }),
    reactivate: vi.fn().mockResolvedValue({ id: 'e-1', estado: 'ACTIVE' }),
    changePlan: vi.fn().mockResolvedValue({ id: 'e-1', plan: 'PROFESIONAL' }),
    history: vi.fn().mockResolvedValue({ items: [] }),
    metrics: vi.fn().mockResolvedValue({ empresas: { total: 1 }, mrr: 149.9 }),
  };
  return { controller: new SaasController(saas as unknown as SaasService), saas };
}

describe('SaasController', () => {
  it('delega alta, listado, detalle e historial', async () => {
    const { controller, saas } = build();
    await controller.create({} as never, actor);
    expect(saas.createTenant).toHaveBeenCalledWith({}, actor);
    await controller.list({ page: 1 } as never);
    expect(saas.list).toHaveBeenCalledWith({ page: 1 });
    await controller.detail('e-1');
    expect(saas.getTenant).toHaveBeenCalledWith('e-1');
    await controller.history('e-1', { page: 1 } as never);
    expect(saas.history).toHaveBeenCalledWith('e-1', { page: 1 });
  });

  it('delega suspensión, reactivación, cambio de plan y métricas', async () => {
    const { controller, saas } = build();
    await controller.suspend('e-1', { motivo: 'Mora' } as never, actor);
    expect(saas.suspend).toHaveBeenCalledWith('e-1', 'Mora', actor);
    await controller.reactivate('e-1', { motivo: 'Pago' } as never, actor);
    expect(saas.reactivate).toHaveBeenCalledWith('e-1', 'Pago', actor);
    await controller.changePlan('e-1', { plan: 'PROFESIONAL' } as never, actor);
    expect(saas.changePlan).toHaveBeenCalledWith('e-1', { plan: 'PROFESIONAL' }, actor);
    await controller.metrics();
    expect(saas.metrics).toHaveBeenCalledWith();
  });
});
