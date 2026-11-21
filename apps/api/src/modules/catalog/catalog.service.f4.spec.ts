import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogService } from './catalog.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';

const CATEGORIA = '11111111-1111-4111-8111-111111111111';
const PLATO = '22222222-2222-4222-8222-222222222222';
const GRUPO = '33333333-3333-4333-8333-333333333333';

function buildPrisma() {
  return {
    scoped: {
      categorias: { findFirst: vi.fn().mockResolvedValue({ id: CATEGORIA }) },
      platos: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue({ id: PLATO }),
        create: vi.fn(),
        update: vi.fn(),
      },
      grupos_modificadores: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue({ id: GRUPO }),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
      },
      opciones_modificadores: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
      $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
    },
    raw: { detalles_orden_modificadores: { findMany: vi.fn().mockResolvedValue([]) } },
  };
}

describe('CatalogService (f4: filtros y conflictos)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let service: CatalogService;

  beforeEach(() => {
    prisma = buildPrisma();
    service = new CatalogService(
      prisma as unknown as PrismaService,
      { get: () => ({ empresaId: 'e1' }) } as unknown as TenantContextService,
    );
  });

  it('lista platos con y sin filtros', async () => {
    await service.listDishes({ categoriaId: CATEGORIA, activo: true, search: 'lomo' } as never);
    expect(prisma.scoped.platos.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          categoria_id: CATEGORIA,
          activo: true,
          OR: [
            { nombre: { contains: 'lomo', mode: 'insensitive' } },
            { sku: { contains: 'lomo', mode: 'insensitive' } },
          ],
        }),
      }),
    );

    await service.listDishes({ page: 1, limit: 20 } as never);
    expect(prisma.scoped.platos.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { deleted_at: null } }),
    );
  });

  it('traduce SKU duplicado y re-lanza otros errores al crear plato', async () => {
    prisma.scoped.platos.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.createDish({ categoriaId: CATEGORIA, sku: 'LOM', nombre: 'Lomo' } as never),
    ).rejects.toBeInstanceOf(ConflictException);

    prisma.scoped.platos.create.mockRejectedValue(new Error('db caída'));
    await expect(
      service.createDish({ categoriaId: CATEGORIA, sku: 'LOM', nombre: 'Lomo' } as never),
    ).rejects.toThrow('db caída');
  });

  it('rechaza grupos inexistentes al crear un plato', async () => {
    prisma.scoped.grupos_modificadores.count.mockResolvedValue(0);
    await expect(
      service.createDish({
        categoriaId: CATEGORIA,
        sku: 'LOM',
        nombre: 'Lomo',
        grupoIds: [GRUPO],
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('traduce el grupo duplicado y actualiza sin opciones', async () => {
    prisma.scoped.grupos_modificadores.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.createModifierGroup({ nombre: 'Término' } as never),
    ).rejects.toBeInstanceOf(ConflictException);

    prisma.scoped.grupos_modificadores.update.mockResolvedValue({ id: GRUPO });
    await service.updateModifierGroup(GRUPO, { nombre: ' Punto ' } as never);
    expect(prisma.scoped.grupos_modificadores.update).toHaveBeenCalledWith({
      where: { id: GRUPO },
      data: { nombre: 'Punto' },
    });
  });

  it('propaga el conflicto de la transacción al sincronizar opciones', async () => {
    prisma.scoped.$transaction.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.updateModifierGroup(GRUPO, {
        opciones: [{ nombre: 'Medio', precioExtra: 0 }],
      } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('404 si el grupo no existe', async () => {
    prisma.scoped.grupos_modificadores.findFirst.mockResolvedValue(null);
    await expect(
      service.updateModifierGroup(GRUPO, { nombre: 'X' } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
