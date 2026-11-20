import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TablesService } from './tables.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';

const context = {
  userId: 'u1',
  empresaId: 'e1',
  sucursalId: 's1',
  rol: 'ADMIN_GLOBAL' as const,
  bypass: false,
};
const admin = { userId: 'u1', empresaId: 'e1', sucursalId: null, rol: 'ADMIN_GLOBAL' as const, bypass: false };
const MESA = '11111111-1111-4111-8111-111111111111';

function buildPrisma() {
  return {
    scoped: {
      mesas: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
      sucursales: { findFirst: vi.fn() },
      ordenes: { findFirst: vi.fn().mockResolvedValue(null) },
      reservas: { findFirst: vi.fn().mockResolvedValue(null) },
    },
  };
}

describe('TablesService (ramas restantes)', () => {
  let prisma: ReturnType<typeof buildPrisma>;

  function buildService(tenant: Record<string, unknown> = context) {
    return new TablesService(
      prisma as unknown as PrismaService,
      { get: () => tenant } as unknown as TenantContextService,
    );
  }

  beforeEach(() => {
    prisma = buildPrisma();
    prisma.scoped.mesas.findFirst.mockResolvedValue({ id: MESA, estado: 'LIBRE', sucursal_id: 's1' });
  });

  it('create traduce el número duplicado y repropaga otros errores', async () => {
    prisma.scoped.mesas.create.mockRejectedValue({ code: 'P2002' });
    await expect(buildService().create({ numero: '7', capacidad: 4 } as never)).rejects.toBeInstanceOf(
      ConflictException,
    );

    prisma.scoped.mesas.create.mockRejectedValue(new Error('db caída'));
    await expect(buildService().create({ numero: '7', capacidad: 4 } as never)).rejects.toThrow(
      'db caída',
    );
  });

  it('update 404 y número duplicado', async () => {
    prisma.scoped.mesas.findFirst.mockResolvedValue(null);
    await expect(buildService().update(MESA, {})).rejects.toBeInstanceOf(NotFoundException);

    prisma.scoped.mesas.findFirst.mockResolvedValue({ id: MESA, estado: 'LIBRE' });
    prisma.scoped.mesas.update.mockRejectedValue({ code: 'P2002' });
    await expect(buildService().update(MESA, { numero: '9' } as never)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('updateStatus solo acepta estados manuales', async () => {
    await expect(
      buildService().updateStatus(MESA, { estado: 'OCUPADA' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.scoped.mesas.update.mockResolvedValue({ id: MESA, estado: 'MANTENIMIENTO' });
    await expect(
      buildService().updateStatus(MESA, { estado: 'MANTENIMIENTO' } as never),
    ).resolves.toMatchObject({ estado: 'MANTENIMIENTO' });
  });

  it('create del admin exige sucursal válida', async () => {
    await expect(
      buildService(admin).create({ numero: '7', capacidad: 4 } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.scoped.sucursales.findFirst.mockResolvedValue(null);
    await expect(
      buildService(admin).create({ numero: '7', capacidad: 4, sucursalId: 's9' } as never),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.scoped.sucursales.findFirst.mockResolvedValue({ id: 's9' });
    prisma.scoped.mesas.create.mockResolvedValue({ id: MESA });
    await expect(
      buildService(admin).create({ numero: '7', capacidad: 4, sucursalId: 's9' } as never),
    ).resolves.toMatchObject({ id: MESA });
  });

  it('exige empresa en el token', async () => {
    await expect(
      buildService({ userId: 'u1' }).create({ numero: '7', capacidad: 4 } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
