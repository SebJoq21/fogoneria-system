import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
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

function buildPrisma() {
  return {
    scoped: {
      mesas: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      sucursales: { findFirst: vi.fn() },
      ordenes: { findFirst: vi.fn().mockResolvedValue(null) },
      reservas: { findFirst: vi.fn().mockResolvedValue(null) },
    },
  };
}

function buildService(
  prisma: ReturnType<typeof buildPrisma>,
  tenant: Record<string, unknown> = context,
) {
  return new TablesService(
    prisma as unknown as PrismaService,
    { get: () => tenant } as unknown as TenantContextService,
  );
}

describe('TablesService', () => {
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(() => {
    prisma = buildPrisma();
    vi.clearAllMocks();
    prisma.scoped.ordenes.findFirst.mockResolvedValue(null);
    prisma.scoped.reservas.findFirst.mockResolvedValue(null);
  });

  it('crea la mesa con la empresa y sucursal del token', async () => {
    prisma.scoped.mesas.create.mockResolvedValue({ id: 'm1' });
    const service = buildService(prisma);

    await service.create({ numero: ' 7 ', capacidad: 4 });

    expect(prisma.scoped.mesas.create).toHaveBeenCalledWith({
      data: {
        empresa_id: 'e1',
        sucursal_id: 's1',
        numero: '7',
        capacidad: 4,
        zona: 'Salón',
        forma: 'RECTANGULAR',
      },
    });
  });

  it('devuelve 409 si el número ya existe en la sucursal', async () => {
    prisma.scoped.mesas.create.mockRejectedValue({ code: 'P2002' });
    const service = buildService(prisma);

    await expect(service.create({ numero: '1', capacidad: 2 })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('no bloquea una mesa con una orden abierta', async () => {
    prisma.scoped.mesas.findFirst.mockResolvedValue({ id: 'm1', estado: 'OCUPADA' });
    prisma.scoped.ordenes.findFirst.mockResolvedValue({
      id: 'o1',
      estado: 'EN_COCINA',
    });
    const service = buildService(prisma);

    await expect(
      service.updateStatus('m1', { estado: 'MANTENIMIENTO' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.scoped.mesas.update).not.toHaveBeenCalled();
  });

  it('no bloquea una mesa con una reserva activa', async () => {
    prisma.scoped.mesas.findFirst.mockResolvedValue({ id: 'm1', estado: 'RESERVADA' });
    prisma.scoped.reservas.findFirst.mockResolvedValue({
      id: 'r1',
      fecha_hora: new Date('2026-10-27T20:00:00Z'),
    });
    const service = buildService(prisma);

    await expect(
      service.updateStatus('m1', { estado: 'LIBRE' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('bloquea una mesa libre para mantenimiento', async () => {
    prisma.scoped.mesas.findFirst.mockResolvedValue({ id: 'm1', estado: 'LIBRE' });
    prisma.scoped.mesas.update.mockResolvedValue({ id: 'm1', estado: 'MANTENIMIENTO' });
    const service = buildService(prisma);

    const mesa = await service.updateStatus('m1', { estado: 'MANTENIMIENTO' });

    expect(mesa).toMatchObject({ estado: 'MANTENIMIENTO' });
    expect(prisma.scoped.mesas.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { estado: 'MANTENIMIENTO' },
    });
  });

  it('la baja lógica guarda deleted_at y el actor', async () => {
    prisma.scoped.mesas.findFirst.mockResolvedValue({ id: 'm1', estado: 'LIBRE' });
    prisma.scoped.mesas.update.mockResolvedValue({ id: 'm1' });
    const service = buildService(prisma);

    await service.remove('m1');

    const args = prisma.scoped.mesas.update.mock.calls[0][0];
    expect(args.data.deleted_at).toBeInstanceOf(Date);
    expect(args.data.deleted_by).toBe('u1');
  });

  it('lista solo mesas vigentes y aplica los filtros', async () => {
    prisma.scoped.mesas.findMany.mockResolvedValue([]);
    const service = buildService(prisma);

    await service.list({ estado: 'LIBRE', zona: 'Terraza' });

    expect(prisma.scoped.mesas.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deleted_at: null,
          sucursal_id: 's1',
          estado: 'LIBRE',
          zona: 'Terraza',
        },
      }),
    );
  });

  it('devuelve 404 si la mesa no existe o está dada de baja', async () => {
    prisma.scoped.mesas.findFirst.mockResolvedValue(null);
    const service = buildService(prisma);

    await expect(service.findOne('m1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('exige sucursalId cuando el token no trae sucursal (ADMIN_GLOBAL)', async () => {
    const service = buildService(prisma, { empresaId: 'e1', sucursalId: null });

    await expect(service.create({ numero: '1', capacidad: 2 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.scoped.mesas.create).not.toHaveBeenCalled();
  });

  it('ADMIN_GLOBAL crea la mesa en la sucursal indicada', async () => {
    prisma.scoped.sucursales.findFirst.mockResolvedValue({ id: 's2' });
    prisma.scoped.mesas.create.mockResolvedValue({ id: 'm9' });
    const service = buildService(prisma, { empresaId: 'e1', sucursalId: null });

    await service.create({ numero: '9', capacidad: 2, sucursalId: 's2' });

    expect(prisma.scoped.sucursales.findFirst).toHaveBeenCalledWith({
      where: { id: 's2', deleted_at: null },
      select: { id: true },
    });
    expect(prisma.scoped.mesas.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sucursal_id: 's2' }),
      }),
    );
  });

  it('ADMIN_GLOBAL recibe 404 si la sucursal es de otra empresa', async () => {
    prisma.scoped.sucursales.findFirst.mockResolvedValue(null);
    const service = buildService(prisma, { empresaId: 'e1', sucursalId: null });

    await expect(
      service.create({ numero: '9', capacidad: 2, sucursalId: 'ajena' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('un rol atado a sucursal no puede crear en otra', async () => {
    const service = buildService(prisma);

    await expect(
      service.create({ numero: '9', capacidad: 2, sucursalId: 's2' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.scoped.mesas.create).not.toHaveBeenCalled();
  });

  it('el listado de un rol atado ignora el filtro de otra sucursal', async () => {
    prisma.scoped.mesas.findMany.mockResolvedValue([]);
    const service = buildService(prisma);

    await service.list({ sucursalId: 's2' });

    expect(prisma.scoped.mesas.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deleted_at: null, sucursal_id: 's1' } }),
    );
  });
});
