import { describe, expect, it, vi } from 'vitest';
import { PricingController } from './pricing.controller.js';
import type { PricingService } from './pricing.service.js';

function build() {
  const pricing = {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 'l-1' }),
    update: vi.fn().mockResolvedValue({ id: 'l-1' }),
    deactivate: vi.fn().mockResolvedValue({ id: 'l-1' }),
    activate: vi.fn().mockResolvedValue({ id: 'l-1' }),
    getPrices: vi.fn().mockResolvedValue([]),
    setPrices: vi.fn().mockResolvedValue(undefined),
    resolvePrice: vi.fn().mockResolvedValue({ precio: 24.9 }),
  };
  return { controller: new PricingController(pricing as unknown as PricingService), pricing };
}

describe('PricingController', () => {
  it('delega el CRUD de listas', async () => {
    const { controller, pricing } = build();
    await controller.list();
    expect(pricing.list).toHaveBeenCalledWith();
    await controller.create({ nombre: 'Carta' } as never);
    expect(pricing.create).toHaveBeenCalledWith({ nombre: 'Carta' });
    await controller.update('l-1', { nombre: 'Delivery' } as never);
    expect(pricing.update).toHaveBeenCalledWith('l-1', { nombre: 'Delivery' });
    await controller.deactivate('l-1');
    expect(pricing.deactivate).toHaveBeenCalledWith('l-1');
    await controller.activate('l-1');
    expect(pricing.activate).toHaveBeenCalledWith('l-1');
  });

  it('delega precios y resolución', async () => {
    const { controller, pricing } = build();
    await controller.prices('l-1');
    expect(pricing.getPrices).toHaveBeenCalledWith('l-1');
    const items = [{ platoId: 'p-1', precio: 24.9 }];
    await controller.setPrices('l-1', { items } as never);
    expect(pricing.setPrices).toHaveBeenCalledWith('l-1', items);
    await controller.resolve('p-1', 'l-1');
    expect(pricing.resolvePrice).toHaveBeenCalledWith('p-1', 'l-1');
    await controller.resolve('p-1');
    expect(pricing.resolvePrice).toHaveBeenLastCalledWith('p-1', undefined);
  });
});
