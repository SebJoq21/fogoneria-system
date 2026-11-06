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
      platos: { findMany: vi.fn() },
      combos: { findMany: vi.fn() },
      precios_platos: { findMany: vi.fn() },
      listas_precios: { findFirst: vi.fn() },
      sucursales: { findFirst: vi.fn() },
    },
  };
}

describe('OrdersService (AYCDS-20)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let sequences: { nextNumeroOrden: ReturnType<typeof vi.fn> };
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
      audit as unknown as AuditService,
      realtime as unknown as RealtimeService,
    );
  }

  beforeEach(() => {
    prisma = buildPrisma();
    sequences = { nextNumeroOrden: vi.fn().mockResolvedValue('ORD-000001') };
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    realtime = {
      orderCreated: vi.fn(),
      orderUpdated: vi.fn(),
      tableStatus: vi.fn(),
    };
    vi.clearAllMocks();

    prisma.scoped.listas_precios.findFirst.mockResolvedValue({ id: 'l1' });
    prisma.scoped.platos.findMany.mockResolvedValue([
      { id: PLATO, nombre: 'Anticucho', activo: true },
    ]);
    prisma.scoped.combos.findMany.mockResolvedValue([
      {
        id: COMBO,
        nombre: 'Combo parrillero',
        activo: true,
        precio_fijo: '39.90',
      },
    ]);
    prisma.scoped.precios_platos.findMany.mockResolvedValue([
      { plato_id: PLATO, precio: '24.90' },
    ]);
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

    expect(prisma.scoped.precios_platos.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { lista_id: 'l1', plato_id: { in: [PLATO] } },
      }),
    );
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
    prisma.scoped.precios_platos.findMany.mockResolvedValue([]);
    const service = buildService();

    await expect(
      service.create({
        items: [{ tipo: 'PLATO', platoId: PLATO, cantidad: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.scoped.ordenes.create).not.toHaveBeenCalled();
  });

  it('rechaza un plato inactivo', async () => {
    prisma.scoped.platos.findMany.mockResolvedValue([
      { id: PLATO, nombre: 'Anticucho', activo: false },
    ]);
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

  describe('tablero del KDS (AYCDS-30)', () => {
    const AHORA = new Date('2026-11-06T12:00:00.000Z');

    function fila(overrides: Record<string, unknown> = {}) {
      return {
        id: 'o-1',
        numero_orden: 'ORD-000001',
        estado: 'EN_COCINA' as const,
        origen: 'MESA' as const,
        sucursal_id: 's1',
        mesa_id: MESA,
        total: 36,
        ingreso_at: new Date('2026-11-06T11:00:00.000Z'),
        confirmacion_at: new Date('2026-11-06T11:15:00.000Z'),
        listo_at: null,
        mesas: { id: MESA, numero: 'Mesa 1' },
        usuarios: { nombre: 'Mesero Uno' },
        _count: { detalles_orden: 3 },
        ...overrides,
      };
    }

    it('agrupa por columna y calcula el SLA desde la confirmación', async () => {
      prisma.scoped.ordenes.findMany
        .mockResolvedValueOnce([
          fila(),
          fila({ id: 'o-2', numero_orden: 'ORD-000002', estado: 'POR_CONFIRMAR' }),
          fila({ id: 'o-3', estado: 'ENTREGADO' }),
        ])
        .mockResolvedValueOnce([]);
      const service = buildService();

      const board = await service.board({}, AHORA);

      const enCocina = board.columnas.find((columna) => columna.estado === 'EN_COCINA');
      expect(enCocina?.total).toBe(1);
      // 45 minutos desde la confirmación: fuera de SLA por 25.
      expect(enCocina?.ordenes[0]).toMatchObject({
        minutos: 45,
        alertaSla: true,
        excedidoPor: 25,
        mesa: { id: MESA, numero: 'Mesa 1' },
        mesero: 'Mesero Uno',
        items: 3,
      });
      const entregado = board.columnas.find((columna) => columna.estado === 'ENTREGADO');
      expect(entregado?.ordenes[0]?.minutos).toBeNull();
      expect(board.columnas).toHaveLength(4);
    });

    it('acota por la sucursal del token', async () => {
      prisma.scoped.ordenes.findMany.mockResolvedValue([]);
      const service = buildService();

      await service.board({}, AHORA);

      const arg = prisma.scoped.ordenes.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(arg.where).toMatchObject({ sucursal_id: 's1' });
    });

    it('rechaza una sucursal que no es la del token', async () => {
      const service = buildService();

      await expect(
        service.board({ sucursalId: 'otra-sucursal' }, AHORA),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.scoped.ordenes.findMany).not.toHaveBeenCalled();
    });

    it('deja que ADMIN_GLOBAL acote o vea todas', async () => {
      prisma.scoped.ordenes.findMany.mockResolvedValue([]);
      const service = buildService({
        ...context,
        sucursalId: null,
        rol: 'ADMIN_GLOBAL' as const,
      });

      await service.board({}, AHORA);
      const sinFiltro = prisma.scoped.ordenes.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(sinFiltro.where).not.toHaveProperty('sucursal_id');

      await service.board({ sucursalId: 's-2' }, AHORA);
      const conFiltro = prisma.scoped.ordenes.findMany.mock.calls[2][0] as {
        where: Record<string, unknown>;
      };
      expect(conFiltro.where).toMatchObject({ sucursal_id: 's-2' });
    });

    it('calcula las métricas de espera y preparación', async () => {
      prisma.scoped.ordenes.findMany
        .mockResolvedValueOnce([fila()])
        .mockResolvedValueOnce([
          {
            ingreso_at: new Date('2026-11-06T11:00:00.000Z'),
            confirmacion_at: new Date('2026-11-06T11:05:00.000Z'),
            listo_at: new Date('2026-11-06T11:20:00.000Z'),
          },
          {
            ingreso_at: new Date('2026-11-06T11:10:00.000Z'),
            confirmacion_at: new Date('2026-11-06T11:13:00.000Z'),
            listo_at: new Date('2026-11-06T11:25:00.000Z'),
          },
        ]);
      const service = buildService();

      const board = await service.board({}, AHORA);

      expect(board.metricas).toMatchObject({
        abiertas: 1,
        fueraDeSla: 1,
        promedioEsperaMin: 4,
        promedioPreparacionMin: 13.5,
      });
    });

    it('marca el tablero como truncado al llegar al límite', async () => {
      prisma.scoped.ordenes.findMany
        .mockResolvedValueOnce([fila()])
        .mockResolvedValueOnce([]);
      const service = buildService();

      const board = await service.board({ limite: 1 }, AHORA);

      expect(board.truncado).toBe(true);
      expect(board.limite).toBe(1);
    });
  });
});
