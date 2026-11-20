import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PricingService } from './pricing.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';

const LISTA = '11111111-1111-4111-8111-111111111111';
const PLATO = '22222222-2222-4222-8222-222222222222';

function buildPrisma() {
  return {
    scoped: {
      listas_precios: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      precios_platos: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        upsert: vi.fn(),
      },
      platos: { count: vi.fn().mockResolvedValue(1) },
      $transaction: vi.fn((operations: unknown[]) => Promise.all(operations)),
    },
  };
}

describe('PricingService (ramas restantes)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let service: PricingService;

  beforeEach(() => {
    prisma = buildPrisma();
    service = new PricingService(
      prisma as unknown as PrismaService,
      { get: () => ({ empresaId: 'e1' }) } as unknown as TenantContextService,
    );
    prisma.scoped.listas_precios.findFirst.mockResolvedValue({ id: LISTA });
  });

  it('lista las listas con su orden y conteo', async () => {
    await service.list();
    expect(prisma.scoped.listas_precios.findMany).toHaveBeenCalledWith({
      orderBy: [{ activa: 'desc' }, { nombre: 'asc' }],
      include: { _count: { select: { precios_platos: true } } },
    });
  });

  it('crea la lista con vigencia y defaults', async () => {
    prisma.scoped.listas_precios.create.mockResolvedValue({ id: LISTA });
    await service.create({
      nombre: '  Carta ',
      activa: true,
      vigenciaDesde: '2026-01-01',
      vigenciaHasta: '2026-12-31',
    });
    expect(prisma.scoped.listas_precios.create).toHaveBeenCalledWith({
      data: {
        empresa_id: 'e1',
        nombre: 'Carta',
        activa: true,
        vigencia_desde: expect.any(Date),
        vigencia_hasta: expect.any(Date),
      },
    });
  });

  it('crea sin fechas ni activa', async () => {
    prisma.scoped.listas_precios.create.mockResolvedValue({ id: LISTA });
    await service.create({ nombre: 'Delivery' });
    expect(prisma.scoped.listas_precios.create).toHaveBeenCalledWith({
      data: {
        empresa_id: 'e1',
        nombre: 'Delivery',
        activa: false,
        vigencia_desde: null,
        vigencia_hasta: null,
      },
    });
  });

  it('rechaza una vigencia invertida y traduce el nombre duplicado', async () => {
    await expect(
      service.create({
        nombre: 'Carta',
        vigenciaDesde: '2026-12-31',
        vigenciaHasta: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.scoped.listas_precios.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.create({ nombre: 'Carta' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('exige empresa en el token al crear', async () => {
    const sinEmpresa = new PricingService(
      prisma as unknown as PrismaService,
      { get: () => ({}) } as unknown as TenantContextService,
    );
    await expect(sinEmpresa.create({ nombre: 'X' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('actualiza solo los campos enviados y exige existencia', async () => {
    prisma.scoped.listas_precios.findFirst.mockResolvedValue(null);
    await expect(service.update(LISTA, {})).rejects.toBeInstanceOf(NotFoundException);

    prisma.scoped.listas_precios.findFirst.mockResolvedValue({ id: LISTA });
    prisma.scoped.listas_precios.update.mockResolvedValue({ id: LISTA });
    await service.update(LISTA, {
      nombre: ' Carta 2027 ',
      activa: false,
      vigenciaDesde: '2027-01-01',
      vigenciaHasta: '2027-12-31',
    });
    expect(prisma.scoped.listas_precios.update).toHaveBeenCalledWith({
      where: { id: LISTA },
      data: {
        nombre: 'Carta 2027',
        activa: false,
        vigencia_desde: expect.any(Date),
        vigencia_hasta: expect.any(Date),
      },
    });

    await service.update(LISTA, {});
    expect(prisma.scoped.listas_precios.update).toHaveBeenLastCalledWith({
      where: { id: LISTA },
      data: {},
    });
  });

  it('actualiza sin tocar fechas y traduce duplicado', async () => {
    prisma.scoped.listas_precios.update.mockResolvedValue({ id: LISTA });
    await service.update(LISTA, { activa: true });
    expect(prisma.scoped.listas_precios.update).toHaveBeenCalledWith({
      where: { id: LISTA },
      data: { activa: true },
    });

    prisma.scoped.listas_precios.update.mockRejectedValue({ code: 'P2002' });
    await expect(service.update(LISTA, { nombre: 'Otra' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('desactiva y activa con transacción', async () => {
    prisma.scoped.listas_precios.findFirst.mockResolvedValue(null);
    await expect(service.deactivate(LISTA)).rejects.toBeInstanceOf(NotFoundException);

    prisma.scoped.listas_precios.findFirst.mockResolvedValue({ id: LISTA });
    prisma.scoped.listas_precios.update.mockResolvedValue({ id: LISTA });
    await service.deactivate(LISTA);
    expect(prisma.scoped.listas_precios.update).toHaveBeenCalledWith({
      where: { id: LISTA },
      data: { activa: false },
    });

    prisma.scoped.listas_precios.updateMany.mockResolvedValue({ count: 1 });
    prisma.scoped.listas_precios.update.mockResolvedValue({ id: LISTA, activa: true });
    await expect(service.activate(LISTA)).resolves.toMatchObject({ id: LISTA });
    expect(prisma.scoped.$transaction).toHaveBeenCalled();
  });

  it('getPrices exige la lista y devuelve sus precios', async () => {
    prisma.scoped.listas_precios.findFirst.mockResolvedValue(null);
    await expect(service.getPrices(LISTA)).rejects.toBeInstanceOf(NotFoundException);

    prisma.scoped.listas_precios.findFirst.mockResolvedValue({ id: LISTA });
    prisma.scoped.precios_platos.findMany.mockResolvedValue([{ lista_id: LISTA }]);
    await expect(service.getPrices(LISTA)).resolves.toHaveLength(1);
    expect(prisma.scoped.precios_platos.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { lista_id: LISTA } }),
    );
  });

  it('setPrices exige lista y platos, y hace upsert en lote', async () => {
    prisma.scoped.listas_precios.findFirst.mockResolvedValue(null);
    await expect(service.setPrices(LISTA, [])).rejects.toBeInstanceOf(NotFoundException);

    prisma.scoped.listas_precios.findFirst.mockResolvedValue({ id: LISTA });
    prisma.scoped.platos.count.mockResolvedValue(0);
    await expect(
      service.setPrices(LISTA, [{ platoId: PLATO, precio: 24.9 }]),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.scoped.platos.count.mockResolvedValue(1);
    prisma.scoped.precios_platos.upsert.mockResolvedValue({});
    await service.setPrices(LISTA, [{ platoId: PLATO, precio: 24.9 }]);
    expect(prisma.scoped.precios_platos.upsert).toHaveBeenCalledWith({
      where: { lista_id_plato_id: { lista_id: LISTA, plato_id: PLATO } },
      create: { lista_id: LISTA, plato_id: PLATO, precio: 24.9 },
      update: { precio: 24.9 },
    });
  });

  it('resolvePrice usa la lista pedida, la activa o devuelve null', async () => {
    prisma.scoped.precios_platos.findFirst.mockResolvedValue({ precio: '24.90' });
    await expect(service.resolvePrice(PLATO, LISTA)).resolves.toEqual({
      platoId: PLATO,
      listaId: LISTA,
      precio: 24.9,
    });

    prisma.scoped.listas_precios.findFirst.mockResolvedValue({ id: LISTA });
    await expect(service.resolvePrice(PLATO)).resolves.toMatchObject({ listaId: LISTA });

    prisma.scoped.precios_platos.findFirst.mockResolvedValue(null);
    await expect(service.resolvePrice(PLATO)).resolves.toMatchObject({ precio: null });

    prisma.scoped.listas_precios.findFirst.mockResolvedValue(null);
    await expect(service.resolvePrice(PLATO)).resolves.toEqual({
      platoId: PLATO,
      listaId: null,
      precio: null,
    });
  });

  it('resolvePrices cotiza en lote y maneja lista inexistente o vacía', async () => {
    prisma.scoped.listas_precios.findFirst.mockResolvedValue(null);
    await expect(service.resolvePrices([PLATO], 'ajena')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    await expect(service.resolvePrices([])).resolves.toEqual({
      listaId: null,
      precios: new Map(),
    });

    prisma.scoped.listas_precios.findFirst.mockResolvedValue({ id: LISTA });
    prisma.scoped.precios_platos.findMany.mockResolvedValue([
      { plato_id: PLATO, precio: '24.90' },
    ]);
    const resuelto = await service.resolvePrices([PLATO]);
    expect(resuelto.listaId).toBe(LISTA);
    expect(resuelto.precios.get(PLATO)).toBe(24.9);
  });
});
