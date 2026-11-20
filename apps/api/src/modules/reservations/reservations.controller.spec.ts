import { describe, expect, it, vi } from 'vitest';
import { ReservationsController } from './reservations.controller.js';
import type { ReservationsService } from './reservations.service.js';

function build() {
  const reservations = {
    list: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue({ id: 'r-1' }),
    create: vi.fn().mockResolvedValue({ id: 'r-1' }),
    update: vi.fn().mockResolvedValue({ id: 'r-1' }),
    updateStatus: vi.fn().mockResolvedValue({ id: 'r-1', estado: 'CONFIRMADA' }),
  };
  return {
    controller: new ReservationsController(reservations as unknown as ReservationsService),
    reservations,
  };
}

const dto = {} as never;

describe('ReservationsController', () => {
  it('delega listado y detalle', async () => {
    const { controller, reservations } = build();
    const query = { fecha: '2026-11-20' } as never;
    await controller.list(query);
    expect(reservations.list).toHaveBeenCalledWith(query);
    await controller.findOne('r-1');
    expect(reservations.findOne).toHaveBeenCalledWith('r-1');
  });

  it('delega alta, edición y cambio de estado', async () => {
    const { controller, reservations } = build();
    await controller.create(dto);
    expect(reservations.create).toHaveBeenCalledWith(dto);
    await controller.update('r-1', dto);
    expect(reservations.update).toHaveBeenCalledWith('r-1', dto);
    await controller.updateStatus('r-1', { estado: 'CONFIRMADA' } as never);
    expect(reservations.updateStatus).toHaveBeenCalledWith('r-1', 'CONFIRMADA');
  });
});
