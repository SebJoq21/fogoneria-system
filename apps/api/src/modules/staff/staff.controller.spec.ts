import { describe, expect, it, vi } from 'vitest';
import { StaffController } from './staff.controller.js';
import type { StaffService } from './staff.service.js';

function build() {
  const staff = {
    listEmployees: vi.fn().mockResolvedValue([]),
    listShifts: vi.fn().mockResolvedValue([]),
    createShift: vi.fn().mockResolvedValue({ id: 't-1' }),
    removeShift: vi.fn().mockResolvedValue({ id: 't-1' }),
    listAttendance: vi.fn().mockResolvedValue([]),
    markAttendance: vi.fn().mockResolvedValue({ id: 'a-1' }),
    listPools: vi.fn().mockResolvedValue([]),
    getPool: vi.fn().mockResolvedValue({ id: 'p-1' }),
    calculateTips: vi.fn().mockResolvedValue({ id: 'p-1' }),
    confirmPool: vi.fn().mockResolvedValue({ id: 'p-1' }),
  };
  return { controller: new StaffController(staff as unknown as StaffService), staff };
}

const dto = {} as never;

describe('StaffController', () => {
  it('delega personal, turnos y asistencia', async () => {
    const { controller, staff } = build();
    const query = { sucursalId: 's-1' } as never;
    await controller.listEmployees(query);
    expect(staff.listEmployees).toHaveBeenCalledWith(query);
    await controller.listShifts(query);
    expect(staff.listShifts).toHaveBeenCalledWith(query);
    await controller.createShift(dto);
    expect(staff.createShift).toHaveBeenCalledWith(dto);
    await controller.removeShift('t-1');
    expect(staff.removeShift).toHaveBeenCalledWith('t-1');
    await controller.listAttendance(query);
    expect(staff.listAttendance).toHaveBeenCalledWith(query);
    await controller.markAttendance(dto);
    expect(staff.markAttendance).toHaveBeenCalledWith(dto);
  });

  it('delega propinas', async () => {
    const { controller, staff } = build();
    await controller.listPools({} as never);
    expect(staff.listPools).toHaveBeenCalledWith({});
    await controller.getPool('p-1');
    expect(staff.getPool).toHaveBeenCalledWith('p-1');
    await controller.calculateTips(dto);
    expect(staff.calculateTips).toHaveBeenCalledWith(dto);
    await controller.confirmPool('p-1');
    expect(staff.confirmPool).toHaveBeenCalledWith('p-1');
  });
});
