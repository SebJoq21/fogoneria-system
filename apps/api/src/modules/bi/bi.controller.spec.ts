import { describe, expect, it, vi } from 'vitest';
import { BiController } from './bi.controller.js';
import type { BiService } from './bi.service.js';

function build() {
  const bi = {
    pnl: vi.fn().mockResolvedValue({ ventas: 288 }),
    pnlPorDia: vi.fn().mockResolvedValue({ items: [] }),
    topDishes: vi.fn().mockResolvedValue({ items: [] }),
    salesByMethod: vi.fn().mockResolvedValue({ items: [] }),
  };
  return { controller: new BiController(bi as unknown as BiService), bi };
}

describe('BiController', () => {
  it('delega los cuatro reportes con su query', async () => {
    const { controller, bi } = build();
    const rango = { desde: '2026-11-01', hasta: '2026-11-20' } as never;
    await controller.pnl(rango);
    expect(bi.pnl).toHaveBeenCalledWith(rango);
    await controller.pnlPorDia(rango);
    expect(bi.pnlPorDia).toHaveBeenCalledWith(rango);
    await controller.topDishes(rango);
    expect(bi.topDishes).toHaveBeenCalledWith(rango);
    await controller.salesByMethod(rango);
    expect(bi.salesByMethod).toHaveBeenCalledWith(rango);
  });
});
