import { NotFoundException } from '@nestjs/common';
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
const MESA = '33333333-3333-4333-8333-333333333333';
const PLATO = '11111111-1111-4111-8111-111111111111';

function buildPrisma() {
  return {
    scoped: {
      ordenes: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      mesas: { findFirst: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      reservas: { count: vi.fn().mockResolvedValue(0) },
      platos: { findMany: vi.fn().mockResolvedValue([{ id: PLATO, nombre: 'Lomo', activo: true }]) },
      combos: { findMany: vi.fn().mockResolvedValue([]) },
      sucursales: { findFirst: vi.fn() },
    },
  };
}

describe('OrdersService (f4: tablero, transiciones y bordes)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let realtime: { orderCreated: ReturnType<typeof vi.fn>; orderUpdated: ReturnType<typeof vi.fn>; tableStatus: ReturnType<typeof vi.fn> };
  let inventory: { consumeOrder: ReturnType<typeof vi.fn> };
  let service: OrdersService;

  beforeEach(() => {
    prisma = buildPrisma();
    realtime = { orderCreated: vi.fn(), orderUpdated: vi.fn(), tableStatus: vi.fn() };
    inventory = { consumeOrder: vi.fn().mockResolvedValue({ aplicado: true }) };
    service = new OrdersService(
      prisma as unknown as PrismaService,
      { get: () => context } as unknown as TenantContextService,
      { nextNumeroOrden: vi.fn().mockResolvedValue('ORD-1') } as unknown as SequencesService,
      { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService,
      realtime as unknown as RealtimeService,
      inventory as unknown as InventoryService,
      { resolverCupon: vi.fn(), registrarCanje: vi.fn() } as unknown as PromotionsService,
      {
        resolvePrices: vi.fn().mockResolvedValue({ listaId: 'l1', precios: new Map([[PLATO, 24.9]]) }),
      } as unknown as PricingPort,
    );
  });

  it('mapea el tablero sin mesa, mesero ni confirmación', async () => {
    prisma.scoped.ordenes.findMany
      .mockResolvedValueOnce([
        {
          id: 'o-1',
          numero_orden: 'ORD-1',
          estado: 'POR_CONFIRMAR',
          origen: 'MOSTRADOR',
          sucursal_id: 's1',
          mesa_id: null,
          total: '24.90',
          ingreso_at: new Date('2026-11-20T10:00:00.000Z'),
          confirmacion_at: null,
          listo_at: null,
          mesas: null,
          usuarios: null,
          _count: { detalles_orden: 2 },
        },
      ])
      .mockResolvedValueOnce([]);

    const tablero = await service.board({ sucursalId: 's1', dias: 1, limite: 10 } as never);
    const pendiente = tablero.columnas.find((col) => col.estado === 'POR_CONFIRMAR');
    expect(pendiente?.ordenes[0]).toMatchObject({
      mesa: null,
      mesero: null,
      confirmacionAt: null,
      listoAt: null,
      items: 2,
    });
  });

  it('devuelve 404 al buscar una orden que no existe', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue(null);
    await expect(service.findOne('o-x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('anula con mesa y sin relación de mesa: emite table.status con numero null', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue({
      id: 'o-1',
      numero_orden: 'ORD-1',
      estado: 'POR_CONFIRMAR',
      sucursal_id: 's1',
      mesa_id: MESA,
      mesas: null,
    });
    await service.updateStatus('o-1', 'ANULADA');
    expect(realtime.tableStatus).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({ mesaId: MESA, numero: null, a: 'LIBRE' }),
    );
  });

  it('sella listo y entregado y descuenta el kardex al entregar', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue({
      id: 'o-1',
      numero_orden: 'ORD-1',
      estado: 'EN_COCINA',
      sucursal_id: 's1',
      mesa_id: null,
      mesas: null,
    });
    await service.updateStatus('o-1', 'LISTO');
    expect(prisma.scoped.ordenes.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'o-1' },
      data: { estado: 'LISTO', listo_at: expect.any(Date) },
    });

    prisma.scoped.ordenes.findFirst.mockResolvedValue({
      id: 'o-1',
      numero_orden: 'ORD-1',
      estado: 'LISTO',
      sucursal_id: 's1',
      mesa_id: null,
      mesas: null,
    });
    await service.updateStatus('o-1', 'ENTREGADO');
    expect(prisma.scoped.ordenes.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'o-1' },
      data: { estado: 'ENTREGADO', entrega_at: expect.any(Date) },
    });
    expect(inventory.consumeOrder).toHaveBeenCalledWith('o-1', 'u1');
  });

  it('explica la anulación tardía y exige mesa existente', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue({
      id: 'o-1',
      numero_orden: 'ORD-1',
      estado: 'EN_COCINA',
      sucursal_id: 's1',
      mesa_id: null,
      mesas: null,
    });
    await expect(service.updateStatus('o-1', 'ANULADA')).rejects.toThrow(/ya no se anula/);

    prisma.scoped.mesas.findFirst.mockResolvedValue(null);
    await expect(
      service.create({ mesaId: MESA, items: [{ tipo: 'PLATO', platoId: PLATO, cantidad: 1 }] } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
