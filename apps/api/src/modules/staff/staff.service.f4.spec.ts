import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffService } from './staff.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';
import type { AuditService } from '../audit/index.js';

const admin = {
  userId: 'u1',
  empresaId: 'e1',
  sucursalId: null,
  rol: 'ADMIN_GLOBAL' as const,
  bypass: false,
};
const POZO = '11111111-1111-4111-8111-111111111111';
const EMPLEADO = '22222222-2222-4222-8222-222222222222';

function buildPrisma() {
  return {
    scoped: {
      empleados: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      turnos_plan: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      asistencias: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn() },
      pozos_propinas: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      ordenes: { aggregate: vi.fn().mockResolvedValue({ _sum: { propina: '0' } }) },
      sucursales: { findFirst: vi.fn() },
    },
  };
}

describe('StaffService (f4: propinas y turnos)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let service: StaffService;

  beforeEach(() => {
    prisma = buildPrisma();
    prisma.scoped.empleados.findFirst.mockResolvedValue({
      id: EMPLEADO,
      nombre: 'Ana',
      sucursal_id: 's1',
    });
    prisma.scoped.sucursales.findFirst.mockResolvedValue({ id: 's1' });
    service = new StaffService(
      prisma as unknown as PrismaService,
      { get: () => admin } as unknown as TenantContextService,
      { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService,
    );
  });

  it('lista pozos sin sucursal cuando el admin no la indica', async () => {
    await service.listPools({} as never);
    expect(prisma.scoped.pozos_propinas.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('traduce el turno duplicado y re-lanza otros errores', async () => {
    prisma.scoped.turnos_plan.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.createShift({ sucursalId: 's1', empleadoId: EMPLEADO, fecha: '2026-11-20', bloque: 'M' } as never),
    ).rejects.toBeInstanceOf(ConflictException);

    prisma.scoped.turnos_plan.create.mockRejectedValue(new Error('db caída'));
    await expect(
      service.createShift({ sucursalId: 's1', empleadoId: EMPLEADO, fecha: '2026-11-20', bloque: 'M' } as never),
    ).rejects.toThrow('db caída');
  });

  it('rechaza un pozo sin propinas y confirma solo si existe', async () => {
    prisma.scoped.pozos_propinas.findFirst.mockResolvedValue(null);
    prisma.scoped.ordenes.aggregate.mockResolvedValue({ _sum: { propina: '0' } });
    await expect(
      service.calculateTips({ sucursalId: 's1', fecha: '2026-11-20' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.scoped.pozos_propinas.findFirst.mockResolvedValue(null);
    await expect(service.confirmPool(POZO)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('confirma un pozo calculado y devuelve el reparto', async () => {
    prisma.scoped.pozos_propinas.findFirst
      .mockResolvedValueOnce({
        id: POZO,
        sucursal_id: 's1',
        estado: 'CALCULADO',
        total: '105',
      })
      .mockResolvedValueOnce({ id: POZO, repartos_propinas: [] });

    const pozo = await service.confirmPool(POZO);
    expect(prisma.scoped.pozos_propinas.updateMany).toHaveBeenCalledWith({
      where: { id: POZO, estado: 'CALCULADO' },
      data: { estado: 'REPARTIDO' },
    });
    expect(pozo).toMatchObject({ id: POZO });
  });

  it('confirma es idempotente si el pozo ya está repartido', async () => {
    prisma.scoped.pozos_propinas.findFirst
      .mockResolvedValueOnce({ id: POZO, estado: 'REPARTIDO' })
      .mockResolvedValueOnce({ id: POZO, repartos_propinas: [] });
    const pozo = await service.confirmPool(POZO);
    expect(prisma.scoped.pozos_propinas.updateMany).not.toHaveBeenCalled();
    expect(pozo).toMatchObject({ id: POZO });
  });
});
