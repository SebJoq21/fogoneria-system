import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogService } from './catalog.service.js';
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
      categorias: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      platos: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      grupos_modificadores: {
        create: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
      },
    },
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  return new CatalogService(
    prisma as unknown as PrismaService,
    { get: () => context } as unknown as TenantContextService,
  );
}

describe('CatalogService', () => {
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(() => {
    prisma = buildPrisma();
    vi.clearAllMocks();
  });

  it('crea categorías con el empresa_id del contexto', async () => {
    prisma.scoped.categorias.create.mockResolvedValue({ id: 'c1' });
    const service = buildService(prisma);

    await service.createCategory({ nombre: '  Entradas  ' });

    expect(prisma.scoped.categorias.create).toHaveBeenCalledWith({
      data: { empresa_id: 'e1', nombre: 'Entradas', posicion: 0, activa: true },
    });
  });

  it('traduce la violación de unicidad a ConflictException', async () => {
    prisma.scoped.categorias.create.mockRejectedValue({ code: 'P2002' });
    const service = buildService(prisma);

    await expect(
      service.createCategory({ nombre: 'Entradas' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lista platos con paginación y búsqueda', async () => {
    prisma.scoped.platos.findMany.mockResolvedValue([]);
    prisma.scoped.platos.count.mockResolvedValue(0);
    const service = buildService(prisma);

    const result = await service.listDishes({
      page: 2,
      limit: 10,
      search: 'ceviche',
      activo: true,
    });

    expect(result).toEqual({ items: [], total: 0, page: 2, limit: 10 });
    expect(prisma.scoped.platos.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
  });

  it('falla al crear un plato con categoría inexistente', async () => {
    prisma.scoped.categorias.findFirst.mockResolvedValue(null);
    const service = buildService(prisma);

    await expect(
      service.createDish({
        categoriaId: '00000000-0000-0000-0000-000000000000',
        sku: 'CEV-1',
        nombre: 'Ceviche',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
