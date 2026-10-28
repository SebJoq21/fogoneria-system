import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrdersService } from './orders.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';
import type { SequencesService } from '../../common/sequences/sequences.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { PricingService } from '../pricing/pricing.service.js';
import type { RealtimeService } from '../realtime/realtime.service.js';

const context = {
  userId: 'u1',
  empresaId: 'e1',
  sucursalId: 's1',
  rol: 'MESERO' as const,
  bypass: false,
};

const PLATO = '11111111-1111-4111-8111-111111111111';
const COMBO = '22222222-2222-4222-8222-222222222222';
const MESA = '33333333-3333-4333-8333-333333333333';

function buildPrisma() {
  return {
    scoped: {
      ordenes: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      mesas: {
        findFirst: vi.fn(),
        updateMany: vi.fn(),
      },
      reservas: { count: vi.fn().mockResolvedValue(0) },
      platos: { findFirst: vi.fn() },
      combos: { findFirst: vi.fn() },
      listas_precios: { findFirst: vi.fn() },
      sucursales: { findFirst: vi.fn() },
    },
  };
}

describe('OrdersService (AYCDS-20)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let sequences: { nextNumeroOrden: ReturnType<typeof vi.fn> };
  let pricing: { resolvePrice: ReturnType<typeof vi.fn> };
  let audit: { record: ReturnType<typeof vi.fn> };
  let realtime: {
    orderCreated: ReturnType<typeof vi.fn>;
    orderUpdated: ReturnType<typeof vi.fn>;
    tableStatus: ReturnType<typeof vi.fn>;
  };

  function buildService(tenant: Record<string, unknown> = context) {
    return new OrdersService(
      prisma as unknown as PrismaService,
      { get: () => tenant } as unknown as TenantContextService,
      sequences as unknown as SequencesService,
      pricing as unknown as PricingService,
      audit as unknown as AuditService,
      realtime as unknown as RealtimeService,
    );
  }

  beforeEach(() => {
    prisma = buildPrisma();
    sequences = { nextNumeroOrden: vi.fn().mockResolvedValue('ORD-000001') };
    pricing = { resolvePrice: vi.fn().mockResolvedValue({ precio: 24.9 }) };
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    realtime = {
      orderCreated: vi.fn(),
      orderUpdated: vi.fn(),
      tableStatus: vi.fn(),
    };
    vi.clearAllMocks();

    prisma.scoped.listas_precios.findFirst.mockResolvedValue({ id: 'l1' });
    prisma.scoped.platos.findFirst.mockResolvedValue({
      id: PLATO,
      nombre: 'Anticucho',
      activo: true,
    });
    prisma.scoped.combos.findFirst.mockResolvedValue({
      id: COMBO,
      nombre: 'Combo parrillero',
      activo: true,
      precio_fijo: '39.90',
    });
    prisma.scoped.ordenes.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'o1',
        ...data,
      }),
    );
    prisma.scoped.ordenes.count.mockResolvedValue(0);
    prisma.scoped.reservas.count.mockResolvedValue(0);
  });

  it('resuelve el precio en el servidor y calcula los totales', async () => {
    const service = buildService();

    await service.create({
      items: [
        { tipo: 'PLATO', platoId: PLATO, cantidad: 2 },
        { tipo: 'COMBO', comboId: COMBO, cantidad: 1 },
      ],
    });

    expect(pricing.resolvePrice).toHaveBeenCalledWith(PLATO, 'l1');
    const data = prisma.scoped.ordenes.create.mock.calls[0][0].data as {
      subtotal: number;
      total: number;
      detalles_orden: { create: { precio_unitario: number; subtotal: number }[] };
    };
    expect(data.subtotal).toBe(89.7);
    expect(data.total).toBe(89.7);
    expect(data.detalles_orden.create[0]).toMatchObject({
      precio_unitario: 24.9,
      subtotal: 49.8,
    });
    expect(data.detalles_orden.create[1]).toMatchObject({
      precio_unitario: 39.9,
      subtotal: 39.9,
    });
  });

  it('usa la secuencia de la empresa para el número de orden', async () => {
    const service = buildService();

    await service.create({
      items: [{ tipo: 'PLATO', platoId: PLATO, cantidad: 1 }],
    });

    expect(sequences.nextNumeroOrden).toHaveBeenCalledWith('e1');
    expect(prisma.scoped.ordenes.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ numero_orden: 'ORD-000001' }),
      }),
    );
  });

  it('toma el mesero del JWT, no del body', async () => {
    const service = buildService();

    await service.create({
      items: [{ tipo: 'PLATO', platoId: PLATO, cantidad: 1 }],
    });

    expect(prisma.scoped.ordenes.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mesero_id: 'u1' }),
      }),
    );
  });

  it('marca la mesa OCUPADA al crear la orden', async () => {
    prisma.scoped.mesas.findFirst.mockResolvedValue({
      id: MESA,
      sucursal_id: 's1',
      estado: 'LIBRE',
    });
    const service = buildService();

    await service.create({
      mesaId: MESA,
      items: [{ tipo: 'PLATO', platoId: PLATO, cantidad: 1 }],
    });

    expect(prisma.scoped.mesas.updateMany).toHaveBeenCalledWith({
      where: { id: MESA },
      data: { estado: 'OCUPADA' },
    });
  });

  it('rechaza una mesa en mantenimiento', async () => {
    prisma.scoped.mesas.findFirst.mockResolvedValue({
      id: MESA,
      sucursal_id: 's1',
      estado: 'MANTENIMIENTO',
    });
    const service = buildService();

    await expect(
      service.create({
        mesaId: MESA,
        items: [{ tipo: 'PLATO', platoId: PLATO, cantidad: 1 }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.scoped.ordenes.create).not.toHaveBeenCalled();
  });

  it('rechaza un plato sin precio en la lista', async () => {
    pricing.resolvePrice.mockResolvedValue({ precio: null });
    const service = buildService();

    await expect(
      service.create({
        items: [{ tipo: 'PLATO', platoId: PLATO, cantidad: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.scoped.ordenes.create).not.toHaveBeenCalled();
  });

  it('rechaza un plato inactivo', async () => {
    prisma.scoped.platos.findFirst.mockResolvedValue({
      id: PLATO,
      nombre: 'Anticucho',
      activo: false,
    });
    const service = buildService();

    await expect(
      service.create({
        items: [{ tipo: 'PLATO', platoId: PLATO, cantidad: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza un descuento mayor que el subtotal', async () => {
    const service = buildService();

    await expect(
      service.create({
        descuento: 100,
        items: [{ tipo: 'PLATO', platoId: PLATO, cantidad: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('registra auditoría al crear la orden', async () => {
    const service = buildService();

    await service.create({
      items: [{ tipo: 'PLATO', platoId: PLATO, cantidad: 1 }],
    });

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'orden.creada',
        entidad: 'ordenes',
        entidadId: 'o1',
      }),
    );
  });

  it('ADMIN_GLOBAL deduce la sucursal de la mesa', async () => {
    prisma.scoped.mesas.findFirst.mockResolvedValue({
      id: MESA,
      sucursal_id: 's2',
      estado: 'LIBRE',
    });
    const service = buildService({ ...context, sucursalId: null, rol: 'ADMIN_GLOBAL' });

    await service.create({
      mesaId: MESA,
      items: [{ tipo: 'PLATO', platoId: PLATO, cantidad: 1 }],
    });

    expect(prisma.scoped.ordenes.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sucursal_id: 's2' }),
      }),
    );
  });

  it('permite POR_CONFIRMAR → EN_COCINA y sella confirmacion_at', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue({
      id: 'o1',
      numero_orden: 'ORD-000001',
      estado: 'POR_CONFIRMAR',
      mesa_id: null,
      sucursal_id: 's1',
    });
    const service = buildService();

    await service.updateStatus('o1', 'EN_COCINA');

    expect(prisma.scoped.ordenes.updateMany).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { estado: 'EN_COCINA', confirmacion_at: expect.any(Date) },
    });
  });

  it('bloquea la anulación cuando la orden está EN_COCINA', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue({
      id: 'o1',
      numero_orden: 'ORD-000001',
      estado: 'EN_COCINA',
      mesa_id: null,
      sucursal_id: 's1',
    });
    const service = buildService();

    await expect(service.updateStatus('o1', 'ANULADA')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.scoped.ordenes.updateMany).not.toHaveBeenCalled();
  });

  it('bloquea la anulación cuando la orden está LISTO', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue({
      id: 'o1',
      numero_orden: 'ORD-000001',
      estado: 'LISTO',
      mesa_id: null,
      sucursal_id: 's1',
    });
    const service = buildService();

    await expect(service.updateStatus('o1', 'ANULADA')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rechaza cambiar una orden en estado terminal', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue({
      id: 'o1',
      numero_orden: 'ORD-000001',
      estado: 'PAGADA',
      mesa_id: null,
      sucursal_id: 's1',
    });
    const service = buildService();

    await expect(service.updateStatus('o1', 'CERRADA')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.scoped.ordenes.updateMany).not.toHaveBeenCalled();
  });

  it('libera la mesa al anular la última orden abierta', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue({
      id: 'o1',
      numero_orden: 'ORD-000001',
      estado: 'POR_CONFIRMAR',
      mesa_id: MESA,
      sucursal_id: 's1',
    });
    const service = buildService();

    await service.updateStatus('o1', 'ANULADA');

    expect(prisma.scoped.mesas.updateMany).toHaveBeenCalledWith({
      where: { id: MESA, estado: 'OCUPADA' },
      data: { estado: 'LIBRE' },
    });
  });

  it('no libera la mesa si queda otra orden abierta', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue({
      id: 'o1',
      numero_orden: 'ORD-000001',
      estado: 'POR_CONFIRMAR',
      mesa_id: MESA,
      sucursal_id: 's1',
    });
    prisma.scoped.ordenes.count.mockResolvedValue(1);
    const service = buildService();

    await service.updateStatus('o1', 'ANULADA');

    expect(prisma.scoped.mesas.updateMany).not.toHaveBeenCalled();
  });

  it('deja la mesa RESERVADA si queda una reserva activa al cerrar', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue({
      id: 'o1',
      numero_orden: 'ORD-000001',
      estado: 'ENTREGADO',
      mesa_id: MESA,
      sucursal_id: 's1',
    });
    prisma.scoped.reservas.count.mockResolvedValue(1);
    const service = buildService();

    await service.updateStatus('o1', 'PAGADA');

    expect(prisma.scoped.mesas.updateMany).toHaveBeenCalledWith({
      where: { id: MESA, estado: 'OCUPADA' },
      data: { estado: 'RESERVADA' },
    });
  });

  it('audita el cambio de estado con origen y destino', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue({
      id: 'o1',
      numero_orden: 'ORD-000001',
      estado: 'POR_CONFIRMAR',
      mesa_id: null,
      sucursal_id: 's1',
    });
    const service = buildService();

    await service.updateStatus('o1', 'ANULADA');

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'orden.anulada',
        detalle: { numeroOrden: 'ORD-000001', de: 'POR_CONFIRMAR', a: 'ANULADA' },
      }),
    );
  });

  it('devuelve 404 si la orden no existe en el tenant', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue(null);
    const service = buildService();

    await expect(service.updateStatus('ajena', 'EN_COCINA')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe('eventos en vivo (AYCDS-14)', () => {
    it('publica order.created y table.status al crear una orden con mesa', async () => {
      prisma.scoped.mesas.findFirst.mockResolvedValue({
        id: MESA,
        numero: 'Mesa 1',
        sucursal_id: 's1',
        estado: 'LIBRE',
      });
      prisma.scoped.ordenes.create.mockResolvedValue({
        id: 'o1',
        total: 24.9,
        created_at: new Date('2026-10-28T10:00:00.000Z'),
        detalles_orden: [],
      });
      const service = buildService();

      await service.create({
        mesaId: MESA,
        items: [{ tipo: 'PLATO', platoId: PLATO, cantidad: 1 }],
      });

      expect(realtime.orderCreated).toHaveBeenCalledWith(
        'e1',
        expect.objectContaining({
          ordenId: 'o1',
          numeroOrden: 'ORD-000001',
          sucursalId: 's1',
          mesaId: MESA,
        }),
      );
      expect(realtime.tableStatus).toHaveBeenCalledWith(
        'e1',
        expect.objectContaining({ mesaId: MESA, de: 'LIBRE', a: 'OCUPADA' }),
      );
    });

    it('publica order.updated y table.status al liberar la mesa', async () => {
      prisma.scoped.ordenes.findFirst.mockResolvedValue({
        id: 'o1',
        numero_orden: 'ORD-000001',
        estado: 'ENTREGADO',
        mesa_id: MESA,
        sucursal_id: 's1',
        mesas: { numero: 'Mesa 1' },
      });
      prisma.scoped.mesas.updateMany.mockResolvedValue({ count: 1 });
      const service = buildService();

      await service.updateStatus('o1', 'PAGADA');

      expect(realtime.orderUpdated).toHaveBeenCalledWith(
        'e1',
        expect.objectContaining({
          ordenId: 'o1',
          de: 'ENTREGADO',
          a: 'PAGADA',
          sucursalId: 's1',
        }),
      );
      expect(realtime.tableStatus).toHaveBeenCalledWith(
        'e1',
        expect.objectContaining({
          mesaId: MESA,
          numero: 'Mesa 1',
          de: 'OCUPADA',
          a: 'LIBRE',
        }),
      );
    });

    it('no publica table.status si la mesa sigue con otra orden abierta', async () => {
      prisma.scoped.ordenes.findFirst.mockResolvedValue({
        id: 'o1',
        numero_orden: 'ORD-000001',
        estado: 'POR_CONFIRMAR',
        mesa_id: MESA,
        sucursal_id: 's1',
        mesas: { numero: 'Mesa 1' },
      });
      prisma.scoped.ordenes.count.mockResolvedValue(1);
      const service = buildService();

      await service.updateStatus('o1', 'ANULADA');

      expect(realtime.orderUpdated).toHaveBeenCalledOnce();
      expect(realtime.tableStatus).not.toHaveBeenCalled();
    });
  });
});
