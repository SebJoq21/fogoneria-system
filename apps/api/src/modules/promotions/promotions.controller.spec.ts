import { describe, expect, it, vi } from 'vitest';
import { PromotionsController } from './promotions.controller.js';
import type { PromotionsService } from './promotions.service.js';

function build() {
  const promotions = {
    listCombos: vi.fn().mockResolvedValue([]),
    createCombo: vi.fn().mockResolvedValue({ id: 'cb-1' }),
    updateCombo: vi.fn().mockResolvedValue({ id: 'cb-1' }),
    removeCombo: vi.fn().mockResolvedValue({ id: 'cb-1' }),
    listCoupons: vi.fn().mockResolvedValue({ items: [] }),
    createCoupon: vi.fn().mockResolvedValue({ id: 'cp-1' }),
    updateCoupon: vi.fn().mockResolvedValue({ id: 'cp-1' }),
    removeCoupon: vi.fn().mockResolvedValue({ id: 'cp-1' }),
    validateCoupon: vi.fn().mockResolvedValue({ descuento: 4.4 }),
    schedule: vi.fn().mockResolvedValue([]),
  };
  return {
    controller: new PromotionsController(promotions as unknown as PromotionsService),
    promotions,
  };
}

describe('PromotionsController', () => {
  it('delega el CRUD de combos', async () => {
    const { controller, promotions } = build();
    await controller.listCombos();
    expect(promotions.listCombos).toHaveBeenCalledWith();
    await controller.createCombo({ nombre: 'Combo' } as never);
    expect(promotions.createCombo).toHaveBeenCalledWith({ nombre: 'Combo' });
    await controller.updateCombo('cb-1', { activo: false } as never);
    expect(promotions.updateCombo).toHaveBeenCalledWith('cb-1', { activo: false });
    await controller.removeCombo('cb-1');
    expect(promotions.removeCombo).toHaveBeenCalledWith('cb-1');
  });

  it('delega el CRUD de cupones y la validación', async () => {
    const { controller, promotions } = build();
    await controller.listCoupons({ activo: true } as never);
    expect(promotions.listCoupons).toHaveBeenCalledWith({ activo: true });
    await controller.createCoupon({ codigo: 'PARRILLA10' } as never);
    expect(promotions.createCoupon).toHaveBeenCalledWith({ codigo: 'PARRILLA10' });
    await controller.updateCoupon('cp-1', { activo: false } as never);
    expect(promotions.updateCoupon).toHaveBeenCalledWith('cp-1', { activo: false });
    await controller.removeCoupon('cp-1');
    expect(promotions.removeCoupon).toHaveBeenCalledWith('cp-1');
    await controller.validateCoupon('PARRILLA10', { subtotal: 44 } as never);
    expect(promotions.validateCoupon).toHaveBeenCalledWith('PARRILLA10', 44);
  });

  it('delega las reglas horarias', async () => {
    const { controller, promotions } = build();
    await expect(controller.schedule()).resolves.toEqual([]);
    expect(promotions.schedule).toHaveBeenCalledWith();
  });
});
