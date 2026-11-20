import { describe, expect, it, vi } from 'vitest';
import { OrdersController } from './orders.controller.js';
import type { OrdersService } from './orders.service.js';

function build() {
  const orders = {
    list: vi.fn().mockResolvedValue({ items: [] }),
    board: vi.fn().mockResolvedValue({ columnas: [] }),
    findOne: vi.fn().mockResolvedValue({ id: 'o-1' }),
    create: vi.fn().mockResolvedValue({ id: 'o-1' }),
    updateStatus: vi.fn().mockResolvedValue({ id: 'o-1', estado: 'EN_COCINA' }),
  };
  return { controller: new OrdersController(orders as unknown as OrdersService), orders };
}

describe('OrdersController', () => {
  it('delega listado, tablero y detalle', async () => {
    const { controller, orders } = build();
    await controller.list({ page: 1 } as never);
    expect(orders.list).toHaveBeenCalledWith({ page: 1 });
    await controller.board({ dias: 7 } as never);
    expect(orders.board).toHaveBeenCalledWith({ dias: 7 });
    await controller.findOne('o-1');
    expect(orders.findOne).toHaveBeenCalledWith('o-1');
  });

  it('delega el alta y el cambio de estado', async () => {
    const { controller, orders } = build();
    await controller.create({ items: [] } as never);
    expect(orders.create).toHaveBeenCalledWith({ items: [] });
    await controller.updateStatus('o-1', { estado: 'EN_COCINA' } as never);
    expect(orders.updateStatus).toHaveBeenCalledWith('o-1', 'EN_COCINA');
  });
});
