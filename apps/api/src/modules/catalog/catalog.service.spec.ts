import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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

const GRUPO_ID = '11111111-1111-1111-1111-111111111111';
const OPCION_ID = '22222222-2222-2222-2222-222222222222';

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
        update: vi.fn(),
        count: vi.fn(),
      },
      opciones_modificadores: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn((operations: unknown[]) => Promise.all(operations)),
    },
    raw: {
      detalles_orden_modificadores: { findMany: vi.fn().mockResolvedValue([]) },
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

  describe('updateModifierGroup', () => {
    function arrange(opciones: { id: string; nombre: string }[], usos: { opcion_id: string }[] = []) {
      prisma.scoped.grupos_modificadores.findFirst.mockResolvedValue({ id: GRUPO_ID });
      prisma.scoped.grupos_modificadores.update.mockResolvedValue({ id: GRUPO_ID });
      prisma.scoped.opciones_modificadores.findMany.mockResolvedValue(opciones);
      prisma.scoped.opciones_modificadores.create.mockResolvedValue({});
      prisma.scoped.opciones_modificadores.update.mockResolvedValue({});
      prisma.scoped.opciones_modificadores.deleteMany.mockResolvedValue({ count: 0 });
      prisma.raw.detalles_orden_modificadores.findMany.mockResolvedValue(usos);
      return buildService(prisma);
    }

    it('conserva las opciones enviadas con id y solo actualiza sus datos', async () => {
      const service = arrange([{ id: OPCION_ID, nombre: 'Poco cocido' }]);

      await service.updateModifierGroup(GRUPO_ID, {
        opciones: [{ id: OPCION_ID, nombre: 'Término medio', precioExtra: 2 }],
      });

      expect(prisma.scoped.opciones_modificadores.update).toHaveBeenCalledWith({
        where: { id: OPCION_ID },
        data: { nombre: 'Término medio', precio_extra: 2 },
      });
      expect(prisma.scoped.opciones_modificadores.deleteMany).not.toHaveBeenCalled();
      expect(prisma.scoped.opciones_modificadores.create).not.toHaveBeenCalled();
    });

    it('crea las opciones que llegan sin id y borra las que desaparecen', async () => {
      const service = arrange([{ id: OPCION_ID, nombre: 'Vieja' }]);

      await service.updateModifierGroup(GRUPO_ID, {
        opciones: [{ nombre: 'Nueva' }],
      });

      expect(prisma.scoped.opciones_modificadores.create).toHaveBeenCalledWith({
        data: { grupo_id: GRUPO_ID, nombre: 'Nueva', precio_extra: 0 },
      });
      expect(prisma.scoped.opciones_modificadores.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [OPCION_ID] } },
      });
    });

    it('rechaza quitar una opción ya usada en órdenes en vez de devolver 500', async () => {
      const service = arrange([{ id: OPCION_ID, nombre: 'Sin ají' }], [
        { opcion_id: OPCION_ID },
      ]);

      await expect(service.updateModifierGroup(GRUPO_ID, { opciones: [] })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.scoped.opciones_modificadores.deleteMany).not.toHaveBeenCalled();
      expect(prisma.scoped.$transaction).not.toHaveBeenCalled();
    });

    it('mantiene la opción en uso si el cliente la reenvía con su id', async () => {
      const service = arrange([{ id: OPCION_ID, nombre: 'Sin ají' }], [
        { opcion_id: OPCION_ID },
      ]);

      await service.updateModifierGroup(GRUPO_ID, {
        opciones: [{ id: OPCION_ID, nombre: 'Sin rocoto', precioExtra: 0 }],
      });

      expect(prisma.scoped.opciones_modificadores.update).toHaveBeenCalledOnce();
      expect(prisma.raw.detalles_orden_modificadores.findMany).not.toHaveBeenCalled();
    });

    it('rechaza ids de opciones de otro grupo', async () => {
      const service = arrange([{ id: OPCION_ID, nombre: 'Sin ají' }]);

      await expect(
        service.updateModifierGroup(GRUPO_ID, {
          opciones: [{ id: '33333333-3333-3333-3333-333333333333', nombre: 'Ajena' }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('traduce el nombre de opción duplicado a 409', async () => {
      const service = arrange([{ id: OPCION_ID, nombre: 'Sin ají' }]);
      prisma.scoped.$transaction.mockRejectedValueOnce({ code: 'P2002' });

      await expect(
        service.updateModifierGroup(GRUPO_ID, { opciones: [{ nombre: 'Sin ají' }] }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
