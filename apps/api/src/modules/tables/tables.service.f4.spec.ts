import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TablesService } from './tables.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';

const admin = {
  userId: null as string | null,
  empresaId: 'e1',
  sucursalId: null,
  rol: 'ADMIN_GLOBAL' as const,
  bypass: false,
};
const MESA = '11111111-1111-4111-8111-111111111111';

function buildPrisma() {
  return {
    scoped: {
      mesas: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: MESA }),
        updateMany: vi.fn(),
      },
      ordenes: { findFirst: vi.fn().mockResolvedValue(null) },
      reservas: { findFirst: vi.fn().mockResolvedValue(null) },
      sucursales: { findFirst: vi.fn() },
    },
  };
}

describe('TablesService (f4: filtros y bajas)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let service: TablesService;

  beforeEach(() => {
    prisma = buildPrisma();
    service = new TablesService(
      prisma as unknown as PrismaService,
      { get: () => admin } as unknown as TenantContextService,
    );
  });

  it('lista sin sucursal y filtra por estado y zona', async () => {
    await service.list({ estado: 'LIBRE', zona: 'Terraza' } as never);
    expect(prisma.scoped.mesas.findMany).toHaveBeenCalledWith({
      where: { deleted_at: null, estado: 'LIBRE', zona: 'Terraza' },
      orderBy: [{ zona: 'asc' }, { numero: 'asc' }],
    });
  });

  it('findOne 404 y create re-lanza errores ajenos', async () => {
    prisma.scoped.mesas.findFirst.mockResolvedValue(null);
    await expect(service.findOne(MESA)).rejects.toBeInstanceOf(NotFoundException);

    prisma.scoped.sucursales.findFirst.mockResolvedValue({ id: 's1' });
    prisma.scoped.mesas.create.mockRejectedValue(new Error('db caída'));
    await expect(
      service.create({ numero: ' 1 ', capacidad: 4, sucursalId: 's1' } as never),
    ).rejects.toThrow('db caída');
  });

  it('actualiza todos los campos o solo uno', async () => {
    prisma.scoped.mesas.findFirst.mockResolvedValue({ id: MESA });
    await service.update(MESA, {
      numero: ' 2 ',
      capacidad: 6,
      zona: ' Barra ',
      forma: 'CIRCULAR',
    } as never);
    expect(prisma.scoped.mesas.update).toHaveBeenLastCalledWith({
      where: { id: MESA },
      data: { numero: '2', capacidad: 6, zona: 'Barra', forma: 'CIRCULAR' },
    });

    await service.update(MESA, { zona: 'Terraza' } as never);
    expect(prisma.scoped.mesas.update).toHaveBeenLastCalledWith({
      where: { id: MESA },
      data: { zona: 'Terraza' },
    });
  });

  it('da de baja con deleted_by nulo si el token no trae usuario', async () => {
    prisma.scoped.mesas.findFirst.mockResolvedValue({ id: MESA });
    await service.remove(MESA);
    expect(prisma.scoped.mesas.update).toHaveBeenCalledWith({
      where: { id: MESA },
      data: { deleted_at: expect.any(Date), deleted_by: null },
    });
  });
});
