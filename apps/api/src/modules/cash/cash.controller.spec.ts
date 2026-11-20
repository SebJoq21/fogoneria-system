import { describe, expect, it, vi } from 'vitest';
import { CashController } from './cash.controller.js';
import type { CashService } from './cash.service.js';

function build() {
  const cash = {
    current: vi.fn().mockResolvedValue(null),
    listShifts: vi.fn().mockResolvedValue({ items: [] }),
    open: vi.fn().mockResolvedValue({ turno: { id: 't-1' } }),
    close: vi.fn().mockResolvedValue({ turno: { id: 't-1' } }),
    movements: vi.fn().mockResolvedValue({ items: [] }),
    createMovement: vi.fn().mockResolvedValue({ id: 'm-1' }),
    charge: vi.fn().mockResolvedValue({ cobrado: 59 }),
  };
  return { controller: new CashController(cash as unknown as CashService), cash };
}

describe('CashController', () => {
  it('delega turno actual e historial', async () => {
    const { controller, cash } = build();
    await controller.current({ sucursalId: 's-1' } as never);
    expect(cash.current).toHaveBeenCalledWith('s-1');
    await controller.listShifts({ limit: 10 } as never);
    expect(cash.listShifts).toHaveBeenCalledWith({ limit: 10 });
  });

  it('delega apertura y cierre con el fondo y el conteo', async () => {
    const { controller, cash } = build();
    await controller.open({ sucursalId: 's-1', fondoApertura: 200 } as never);
    expect(cash.open).toHaveBeenCalledWith('s-1', 200);
    await controller.close('t-1', { efectivoContado: 480 } as never);
    expect(cash.close).toHaveBeenCalledWith('t-1', { efectivoContado: 480 });
  });

  it('delega movimientos, alta manual y cobro', async () => {
    const { controller, cash } = build();
    await controller.movements({ turnoId: 't-1' } as never);
    expect(cash.movements).toHaveBeenCalledWith({ turnoId: 't-1' });
    await controller.createMovement({ tipo: 'EGRESO' } as never);
    expect(cash.createMovement).toHaveBeenCalledWith({ tipo: 'EGRESO' });
    await controller.charge({ ordenId: 'o-1', metodo: 'EFECTIVO' } as never);
    expect(cash.charge).toHaveBeenCalledWith({ ordenId: 'o-1', metodo: 'EFECTIVO' });
  });
});
