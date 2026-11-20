import { describe, expect, it, vi } from 'vitest';
import { ExpensesController } from './expenses.controller.js';
import type { ExpensesService } from './expenses.service.js';

function build() {
  const expenses = {
    list: vi.fn().mockResolvedValue({ items: [] }),
    summary: vi.fn().mockResolvedValue({ porPagar: 300 }),
    create: vi.fn().mockResolvedValue({ id: 'g-1' }),
    update: vi.fn().mockResolvedValue({ id: 'g-1' }),
    pay: vi.fn().mockResolvedValue({ id: 'g-1', estadoPago: 'PAGADO' }),
  };
  return { controller: new ExpensesController(expenses as unknown as ExpensesService), expenses };
}

describe('ExpensesController', () => {
  it('delega listado y resumen', async () => {
    const { controller, expenses } = build();
    const query = { estadoPago: 'PENDIENTE' } as never;
    await controller.list(query);
    expect(expenses.list).toHaveBeenCalledWith(query);
    await controller.summary(query);
    expect(expenses.summary).toHaveBeenCalledWith(query);
  });

  it('delega alta, edición y pago con el método', async () => {
    const { controller, expenses } = build();
    await controller.create({} as never);
    expect(expenses.create).toHaveBeenCalledWith({});
    await controller.update('g-1', {} as never);
    expect(expenses.update).toHaveBeenCalledWith('g-1', {});
    await controller.pay('g-1', { metodo: 'EFECTIVO' } as never);
    expect(expenses.pay).toHaveBeenCalledWith('g-1', 'EFECTIVO');
  });
});
