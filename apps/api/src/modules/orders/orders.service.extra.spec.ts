import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrdersService } from './orders.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';
import type { SequencesService } from '../../common/sequences/sequences.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { RealtimeService } from '../realtime/index.js';
import type { InventoryService } from '../inventory/inventory.service.js';
import type { PromotionsService } from '../promotions/promotions.service.js';
import type { PricingPort } from '../pricing/index.js';

const context = {
  userId: 'u1',
  empresaId: 'e1',
  sucursalId: 's1',
  rol: 'MESERO' as const,
  bypass: false,
};
const admin = { userId: 'u1', empresaId: 'e1', sucursalId: null, rol: 'ADMIN_GLOBAL' as const, bypass: false };
const PLATO = '11111111-1111-4111-8111-111111111111';
const COMBO = '22222222-2222-4222-8222-222222222222';
const MESA = '33333333-3333-4333-8333-333333333333';

function buildPrisma() {
  return {
    scoped: {
      ordenes: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn(),
      },
      mesas: { findFirst: vi.fn(), updateMany: vi.fn() },
      platos: { findMany: vi.fn().mockResolvedValue([]) },
      combos: { findMany: vi.fn().mockResolvedValue([]) },
      sucursales: { findFirst: vi.fn() },
    },
  };
}

describe('OrdersService (ramas restantes)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let service: OrdersService;
  let pricing: { resolvePrices: ReturnType<typeof vi.fn> };
  let inventory: { consumeOrder: ReturnType<typeof vi.fn> };

  function buildService(tenant: Record<string, unknown> = context) {
    return new OrdersService(
      prisma as unknown as PrismaService,
      { get: () => tenant } as unknown as TenantContextService,
      { nextNumeroOrden: vi.fn().mockResolvedValue('ORD-1') } as unknown as SequencesService,
      { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService,
      {
        orderCreated: vi.fn(),
        orderUpdated: vi.fn(),
        tableStatus: vi.fn(),
      } as unknown as RealtimeService,
      inventory as unknown as InventoryService,
      { resolverCupon: vi.fn() } as unknown as PromotionsService,
      pricing as unknown as PricingPort,
    );
  }

  beforeEach(() => {
    prisma = buildPrisma();
    pricing = {
      resolvePrices: vi.fn().mockResolvedValue({
        listaId: 'l-1',
        precios: new Map([[PLATO, 24.9]]),
      }),
    };
    inventory = { consumeOrder: vi.fn().mockResolvedValue({}) };
    service = buildService();
  });

  it('lista con filtros y paginación', async () => {
    prisma.scoped.ordenes.findMany.mockResolvedValue([{ id: 'o-1' }]);
    prisma.scoped.ordenes.count.mockResolvedValue(1);
    const lista = await service.list({
      estado: 'EN_COCINA',
      mesaId: MESA,
      page: 2,
      limit: 10,
    } as never);
    expect(lista).toMatchObject({ total: 1, page: 2, limit: 10 });
    expect(prisma.scoped.ordenes.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { estado: 'EN_COCINA', mesa_id: MESA },
        skip: 10,
        take: 10,
      }),
    );
  });

  it('rechaza la mesa de otra sucursal', async () => {
    prisma.scoped.mesas.findFirst.mockResolvedValue({ id: MESA, sucursal_id: 's9', estado: 'LIBRE' });
    await expect(
      buildService(admin).create({
        mesaId: MESA,
        sucursalId: 's1',
        items: [{ tipo: 'PLATO', platoId: PLATO, cantidad: 1 }],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exige platoId/comboId coherentes', async () => {
    prisma.scoped.mesas.findFirst.mockResolvedValue({ id: MESA, sucursal_id: 's1', estado: 'LIBRE' });
    await expect(
      service.create({ mesaId: MESA, items: [{ tipo: 'PLATO', cantidad: 1 }] } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({ mesaId: MESA, items: [{ tipo: 'COMBO', cantidad: 1 }] } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exige lista de precios activa', async () => {
    prisma.scoped.mesas.findFirst.mockResolvedValue({ id: MESA, sucursal_id: 's1', estado: 'LIBRE' });
    pricing.resolvePrices.mockResolvedValue({ listaId: null, precios: new Map() });
    await expect(
      service.create({
        mesaId: MESA,
        items: [{ tipo: 'PLATO', platoId: PLATO, cantidad: 1 }],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza platos inactivos o sin precio', async () => {
    prisma.scoped.mesas.findFirst.mockResolvedValue({ id: MESA, sucursal_id: 's1', estado: 'LIBRE' });
    prisma.scoped.platos.findMany.mockResolvedValue([{ id: PLATO, nombre: 'Lomo', activo: false }]);
    await expect(
      service.create({
        mesaId: MESA,
        items: [{ tipo: 'PLATO', platoId: PLATO, cantidad: 1 }],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.scoped.platos.findMany.mockResolvedValue([{ id: PLATO, nombre: 'Lomo', activo: true }]);
    pricing.resolvePrices.mockResolvedValue({ listaId: 'l-1', precios: new Map() });
    await expect(
      service.create({
        mesaId: MESA,
        items: [{ tipo: 'PLATO', platoId: PLATO, cantidad: 1 }],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza combos inactivos o inexistentes', async () => {
    prisma.scoped.mesas.findFirst.mockResolvedValue({ id: MESA, sucursal_id: 's1', estado: 'LIBRE' });
    prisma.scoped.combos.findMany.mockResolvedValue([{ id: COMBO, nombre: 'Dúo', activo: false }]);
    await expect(
      service.create({
        mesaId: MESA,
        items: [{ tipo: 'COMBO', comboId: COMBO, cantidad: 1 }],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.scoped.combos.findMany.mockResolvedValue([]);
    await expect(
      service.create({
        mesaId: MESA,
        items: [{ tipo: 'COMBO', comboId: COMBO, cantidad: 1 }],
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resuelve la sucursal del token, de la mesa o del body', async () => {
    await expect(
      buildService(admin).create({
        sucursalId: 's9',
        items: [{ tipo: 'PLATO', platoId: PLATO, cantidad: 1 }],
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.scoped.mesas.findFirst.mockResolvedValue({ id: MESA, sucursal_id: 's1', estado: 'LIBRE' });
    prisma.scoped.sucursales.findFirst.mockResolvedValue({ id: 's1' });
    prisma.scoped.platos.findMany.mockResolvedValue([{ id: PLATO, nombre: 'Lomo', activo: true }]);
  });

  it('rechaza que el token pida otra sucursal y la orden sin mesa ni sucursal', async () => {
    await expect(
      service.create({ sucursalId: 's2', items: [{ tipo: 'PLATO', platoId: PLATO, cantidad: 1 }] } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      buildService(admin).create({
        items: [{ tipo: 'PLATO', platoId: PLATO, cantidad: 1 }],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exige empresa en el token', async () => {
    await expect(
      buildService({ userId: 'u1' }).create({
        mesaId: MESA,
        items: [{ tipo: 'PLATO', platoId: PLATO, cantidad: 1 }],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
