import { describe, expect, it, vi } from 'vitest';
import { ReceiptsController } from './receipts.controller.js';
import type { ReceiptsService } from './receipts.service.js';

function build() {
  const receipts = {
    list: vi.fn().mockResolvedValue({ items: [] }),
    findOne: vi.fn().mockResolvedValue({ id: 'c-1' }),
    create: vi.fn().mockResolvedValue({ comprobante: { id: 'c-1' } }),
    void: vi.fn().mockResolvedValue({ comprobante: { id: 'c-1', estado: 'ANULADA' } }),
  };
  return { controller: new ReceiptsController(receipts as unknown as ReceiptsService), receipts };
}

describe('ReceiptsController', () => {
  it('delega listado y detalle', async () => {
    const { controller, receipts } = build();
    const query = { fecha: '2026-11-20' } as never;
    await controller.list(query);
    expect(receipts.list).toHaveBeenCalledWith(query);
    await controller.findOne('c-1');
    expect(receipts.findOne).toHaveBeenCalledWith('c-1');
  });

  it('delega emisión y anulación con el motivo', async () => {
    const { controller, receipts } = build();
    await controller.create({ ordenId: 'o-1', tipo: 'BOLETA' } as never);
    expect(receipts.create).toHaveBeenCalledWith({ ordenId: 'o-1', tipo: 'BOLETA' });
    await controller.void('c-1', { motivo: 'Duplicado' } as never);
    expect(receipts.void).toHaveBeenCalledWith('c-1', 'Duplicado');
  });
});
