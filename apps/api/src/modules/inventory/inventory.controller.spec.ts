import { describe, expect, it, vi } from 'vitest';
import { InventoryController } from './inventory.controller.js';
import type { InventoryService } from './inventory.service.js';
import type { StockAlertsService } from './stock-alerts.service.js';

function build() {
  const stockAlerts = {
    status: vi.fn().mockResolvedValue({ resumen: { total: 0 } }),
    checkAlerts: vi.fn().mockResolvedValue({ alertas: 0 }),
  };
  const inventory = { listMovements: vi.fn().mockResolvedValue({ items: [] }) };
  return {
    controller: new InventoryController(
      stockAlerts as unknown as StockAlertsService,
      inventory as unknown as InventoryService,
    ),
    stockAlerts,
    inventory,
  };
}

describe('InventoryController', () => {
  it('delega el semáforo y el kardex', async () => {
    const { controller, stockAlerts, inventory } = build();
    await controller.status({ sucursalId: 's-1' } as never);
    expect(stockAlerts.status).toHaveBeenCalledWith({ sucursalId: 's-1' });
    await controller.movements({ limit: 50 } as never);
    expect(inventory.listMovements).toHaveBeenCalledWith({ limit: 50 });
  });

  it('delega el chequeo manual de alertas', async () => {
    const { controller, stockAlerts } = build();
    await controller.check({ sucursalId: 's-1' } as never);
    expect(stockAlerts.checkAlerts).toHaveBeenCalledWith({ sucursalId: 's-1' });
  });
});
