import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogService } from './catalog.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';

const GRUPO_ID = '11111111-1111-4111-8111-111111111111';
const PLATO_ID = '22222222-2222-4222-8222-222222222222';

function buildPrisma() {
  return {
    scoped: {
      categorias: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      platos: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      grupos_modificadores: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      opciones_modificadores: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn((operations: unknown[]) => Promise.all(operations)),
    },
    raw: { detalles_orden_modificadores: { findMany: vi.fn().mockResolvedValue([]) } },
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>, context: unknown = { empresaId: 'e1' }) {
  return new CatalogService(
    prisma as unknown as PrismaService,
    { get: () => context } as unknown as TenantContextService,
  );
}

describe('CatalogService (ramas restantes)', () => {
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(() => {
    prisma = buildPrisma();
    vi.clearAllMocks();
    prisma.scoped.categorias.findFirst.mockResolvedValue({ id: 'cat-1' });
    prisma.scoped.platos.findFirst.mockResolvedValue({ id: PLATO_ID });
    prisma.scoped.grupos_modificadores.findFirst.mockResolvedValue({ id: GRUPO_ID });
    prisma.scoped.grupos_modificadores.count.mockResolvedValue(1);
  });

  it('lista categorías y grupos con su orden', async () => {
    const service = buildService(prisma);
    await service.listCategories();
    expect(prisma.scoped.categorias.findMany).toHaveBeenCalledWith({
      orderBy: [{ posicion: 'asc' }, { nombre: 'asc' }],
      include: { _count: { select: { platos: true } } },
    });
    await service.listModifierGroups();
    expect(prisma.scoped.grupos_modificadores.findMany).toHaveBeenCalledWith({
      orderBy: { nombre: 'asc' },
      include: { opciones_modificadores: true },
    });
  });

  it('actualiza categoría con solo los campos enviados', async () => {
    const service = buildService(prisma);
    prisma.scoped.categorias.update.mockResolvedValue({ id: 'cat-1' });

    await service.updateCategory('cat-1', { nombre: '  Bebidas ', posicion: 2, activa: false });
    expect(prisma.scoped.categorias.update).toHaveBeenCalledWith({
      where: { id: 'cat-1' },
      data: { nombre: 'Bebidas', posicion: 2, activa: false },
    });

    await service.updateCategory('cat-1', {});
    expect(prisma.scoped.categorias.update).toHaveBeenLastCalledWith({
      where: { id: 'cat-1' },
      data: {},
    });
  });

  it('404 si la categoría no existe al editar o desactivar', async () => {
    const service = buildService(prisma);
    prisma.scoped.categorias.findFirst.mockResolvedValue(null);
    await expect(service.updateCategory('cat-1', {})).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.deactivateCategory('cat-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('desactiva la categoría', async () => {
    const service = buildService(prisma);
    prisma.scoped.categorias.update.mockResolvedValue({ id: 'cat-1', activa: false });
    await service.deactivateCategory('cat-1');
    expect(prisma.scoped.categorias.update).toHaveBeenCalledWith({
      where: { id: 'cat-1' },
      data: { activa: false },
    });
  });

  it('devuelve el detalle del plato y 404 si no existe', async () => {
    const service = buildService(prisma);
    prisma.scoped.platos.findFirst.mockResolvedValue({ id: PLATO_ID, nombre: 'Lomo' });
    await expect(service.getDish(PLATO_ID)).resolves.toMatchObject({ id: PLATO_ID });

    prisma.scoped.platos.findFirst.mockResolvedValue(null);
    await expect(service.getDish(PLATO_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('crea un plato con grupos y defaults', async () => {
    const service = buildService(prisma);
    prisma.scoped.platos.create.mockResolvedValue({ id: PLATO_ID });

    await service.createDish({
      categoriaId: 'cat-1',
      sku: ' LOM-001 ',
      nombre: ' Lomo ',
      descripcion: 'Con papas',
      fotoUrl: 'https://cdn/foto.jpg',
      grupoIds: [GRUPO_ID],
    });

    expect(prisma.scoped.grupos_modificadores.count).toHaveBeenCalled();
    expect(prisma.scoped.platos.create).toHaveBeenCalledWith({
      data: {
        empresa_id: 'e1',
        categoria_id: 'cat-1',
        sku: 'LOM-001',
        nombre: 'Lomo',
        descripcion: 'Con papas',
        foto_url: 'https://cdn/foto.jpg',
        activo: true,
        costo_real: 0,
        platos_grupos_modificadores: { create: [{ grupo_id: GRUPO_ID }] },
      },
      include: { categorias: true, precios_platos: true },
    });
  });

  it('crea un plato sin grupos ni opcionales', async () => {
    const service = buildService(prisma);
    prisma.scoped.platos.create.mockResolvedValue({ id: PLATO_ID });

    await service.createDish({ categoriaId: 'cat-1', sku: 'LOM', nombre: 'Lomo' });

    expect(prisma.scoped.platos.create).toHaveBeenCalledWith({
      data: {
        empresa_id: 'e1',
        categoria_id: 'cat-1',
        sku: 'LOM',
        nombre: 'Lomo',
        descripcion: null,
        foto_url: null,
        activo: true,
        costo_real: 0,
      },
      include: { categorias: true, precios_platos: true },
    });
  });

  it('rechaza grupos inexistentes al crear', async () => {
    const service = buildService(prisma);
    prisma.scoped.grupos_modificadores.count.mockResolvedValue(0);
    await expect(
      service.createDish({ categoriaId: 'cat-1', sku: 'LOM', nombre: 'Lomo', grupoIds: [GRUPO_ID] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('traduce SKU duplicado a 409 al crear', async () => {
    const service = buildService(prisma);
    prisma.scoped.platos.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.createDish({ categoriaId: 'cat-1', sku: 'LOM', nombre: 'Lomo' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('repropaga errores que no son de unicidad', async () => {
    const service = buildService(prisma);
    const boom = new Error('db caída');
    prisma.scoped.platos.create.mockRejectedValue(boom);
    await expect(
      service.createDish({ categoriaId: 'cat-1', sku: 'LOM', nombre: 'Lomo' }),
    ).rejects.toBe(boom);
  });

  it('actualiza el plato y reemplaza grupos', async () => {
    const service = buildService(prisma);
    prisma.scoped.platos.update.mockResolvedValue({ id: PLATO_ID });

    await service.updateDish(PLATO_ID, {
      categoriaId: 'cat-1',
      sku: ' LOM-2 ',
      nombre: ' Lomo fino ',
      descripcion: null as never,
      fotoUrl: null as never,
      activo: false,
      costoReal: 12,
      grupoIds: [GRUPO_ID],
    });

    expect(prisma.scoped.platos.update).toHaveBeenCalledWith({
      where: { id: PLATO_ID },
      data: {
        categoria_id: 'cat-1',
        sku: 'LOM-2',
        nombre: 'Lomo fino',
        descripcion: null,
        foto_url: null,
        activo: false,
        costo_real: 12,
        platos_grupos_modificadores: {
          deleteMany: {},
          create: [{ grupo_id: GRUPO_ID }],
        },
      },
      include: {
        categorias: true,
        precios_platos: true,
        platos_grupos_modificadores: true,
      },
    });
  });

  it('edita el plato sin campos opcionales y traduce el SKU duplicado', async () => {
    const service = buildService(prisma);
    prisma.scoped.platos.update.mockResolvedValue({ id: PLATO_ID });
    await service.updateDish(PLATO_ID, {});
    expect(prisma.scoped.platos.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { id: PLATO_ID }, data: {} }),
    );

    prisma.scoped.platos.update.mockRejectedValue({ code: 'P2002' });
    await expect(service.updateDish(PLATO_ID, { sku: 'X' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('404 al editar un plato inexistente', async () => {
    const service = buildService(prisma);
    prisma.scoped.platos.findFirst.mockResolvedValue(null);
    await expect(service.updateDish(PLATO_ID, {})).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.deleteDish(PLATO_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('borra lógicamente el plato', async () => {
    const service = buildService(prisma);
    prisma.scoped.platos.update.mockResolvedValue({ id: PLATO_ID });
    await service.deleteDish(PLATO_ID);
    expect(prisma.scoped.platos.update).toHaveBeenCalledWith({
      where: { id: PLATO_ID },
      data: { activo: false, deleted_at: expect.any(Date) },
    });
  });

  it('reemplaza los grupos del plato', async () => {
    const service = buildService(prisma);
    prisma.scoped.platos.update.mockResolvedValue({ id: PLATO_ID });
    await service.assignModifierGroups(PLATO_ID, [GRUPO_ID]);
    expect(prisma.scoped.platos.update).toHaveBeenCalledWith({
      where: { id: PLATO_ID },
      data: {
        platos_grupos_modificadores: {
          deleteMany: {},
          create: [{ grupo_id: GRUPO_ID }],
        },
      },
      include: { platos_grupos_modificadores: true },
    });
  });

  it('crea el grupo con opciones y defaults', async () => {
    const service = buildService(prisma);
    prisma.scoped.grupos_modificadores.create.mockResolvedValue({ id: GRUPO_ID });

    await service.createModifierGroup({
      nombre: ' Término ',
      obligatorio: true,
      permiteMultiple: false,
      opciones: [{ nombre: ' Medio ', precioExtra: 1.5 }, { nombre: 'Tres cuartos' }],
    });

    expect(prisma.scoped.grupos_modificadores.create).toHaveBeenCalledWith({
      data: {
        empresa_id: 'e1',
        nombre: 'Término',
        obligatorio: true,
        permite_multiple: false,
        activo: true,
        opciones_modificadores: {
          create: [
            { nombre: 'Medio', precio_extra: 1.5 },
            { nombre: 'Tres cuartos', precio_extra: 0 },
          ],
        },
      },
      include: { opciones_modificadores: true },
    });
  });

  it('crea el grupo sin opciones y traduce el duplicado', async () => {
    const service = buildService(prisma);
    prisma.scoped.grupos_modificadores.create.mockResolvedValue({ id: GRUPO_ID });
    await service.createModifierGroup({ nombre: 'Término' });
    expect(prisma.scoped.grupos_modificadores.create).toHaveBeenCalledWith({
      data: {
        empresa_id: 'e1',
        nombre: 'Término',
        obligatorio: false,
        permite_multiple: false,
        activo: true,
      },
      include: { opciones_modificadores: true },
    });

    prisma.scoped.grupos_modificadores.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.createModifierGroup({ nombre: 'Término' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rechaza opciones repetidas en la petición', async () => {
    const service = buildService(prisma);
    prisma.scoped.opciones_modificadores.findMany.mockResolvedValue([{ id: 'o-1' }]);
    await expect(
      service.updateModifierGroup(GRUPO_ID, {
        opciones: [
          { id: 'o-1', nombre: 'A' },
          { id: 'o-1', nombre: 'B' },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('desactiva el grupo y 404 si no existe', async () => {
    const service = buildService(prisma);
    prisma.scoped.grupos_modificadores.update.mockResolvedValue({ id: GRUPO_ID });
    await service.deleteModifierGroup(GRUPO_ID);
    expect(prisma.scoped.grupos_modificadores.update).toHaveBeenCalledWith({
      where: { id: GRUPO_ID },
      data: { activo: false },
    });

    prisma.scoped.grupos_modificadores.findFirst.mockResolvedValue(null);
    await expect(service.deleteModifierGroup(GRUPO_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('exige empresa en el token para crear', async () => {
    const service = buildService(prisma, {});
    await expect(service.createCategory({ nombre: 'X' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
