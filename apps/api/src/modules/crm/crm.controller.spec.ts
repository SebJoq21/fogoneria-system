import { describe, expect, it, vi } from 'vitest';
import { CrmController } from './crm.controller.js';
import type { CrmService } from './crm.service.js';

function build() {
  const crm = {
    listCustomers: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getCustomer: vi.fn().mockResolvedValue({ id: 'c-1' }),
    listPoints: vi.fn().mockResolvedValue({ items: [] }),
    createCustomer: vi.fn().mockResolvedValue({ id: 'c-1' }),
    updateCustomer: vi.fn().mockResolvedValue({ id: 'c-1' }),
    adjustPoints: vi.fn().mockResolvedValue({ id: 'c-1' }),
    recalcularCliente: vi.fn().mockResolvedValue({ id: 'c-1' }),
    procesarConsumos: vi.fn().mockResolvedValue({ puntos: 36 }),
    config: vi.fn().mockResolvedValue({ umbralVip: 20 }),
    updateConfig: vi.fn().mockResolvedValue({ umbralVip: 30 }),
  };
  return { controller: new CrmController(crm as unknown as CrmService), crm };
}

const dto = {} as never;

describe('CrmController', () => {
  it('delega las lecturas de clientes y puntos', async () => {
    const { controller, crm } = build();
    const query = { page: 1 } as never;
    await controller.listCustomers(query);
    expect(crm.listCustomers).toHaveBeenCalledWith(query);
    await controller.getCustomer('c-1');
    expect(crm.getCustomer).toHaveBeenCalledWith('c-1');
    await controller.listPoints('c-1', { limit: 10 } as never);
    expect(crm.listPoints).toHaveBeenCalledWith('c-1', { limit: 10 });
    await controller.config();
    expect(crm.config).toHaveBeenCalledWith();
  });

  it('delega altas, edición y ajustes', async () => {
    const { controller, crm } = build();
    await controller.createCustomer(dto);
    expect(crm.createCustomer).toHaveBeenCalledWith(dto);
    await controller.updateCustomer('c-1', dto);
    expect(crm.updateCustomer).toHaveBeenCalledWith('c-1', dto);
    await controller.adjustPoints('c-1', dto);
    expect(crm.adjustPoints).toHaveBeenCalledWith('c-1', dto);
    await controller.recalculate('c-1');
    expect(crm.recalcularCliente).toHaveBeenCalledWith('c-1');
    await controller.processConsumptions();
    expect(crm.procesarConsumos).toHaveBeenCalledWith();
    await controller.updateConfig(dto);
    expect(crm.updateConfig).toHaveBeenCalledWith(dto);
  });
});
