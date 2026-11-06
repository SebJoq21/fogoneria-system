import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrdersSlaCron } from './orders.sla.cron.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { RealtimeService } from '../realtime/realtime.service.js';

const EMPRESA_A = '11111111-1111-4111-8111-111111111111';
const EMPRESA_B = '22222222-2222-4222-8222-222222222222';
const SUCURSAL = '33333333-3333-4333-8333-333333333333';
const AHORA = new Date('2026-11-06T12:00:00.000Z');

function haceMinutos(minutos: number): Date {
  return new Date(AHORA.getTime() - minutos * 60_000);
}

function buildPrisma() {
  return {
    raw: {
      ordenes: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    },
  };
}

function orden(overrides: Record<string, unknown> = {}) {
  return {
    id: 'o-1',
    numero_orden: 'ORD-000001',
    estado: 'EN_COCINA',
    empresa_id: EMPRESA_A,
    sucursal_id: SUCURSAL,
    mesa_id: null,
    ingreso_at: haceMinutos(30),
    confirmacion_at: haceMinutos(25),
    ...overrides,
  };
}

function build() {
  const prisma = buildPrisma();
  const realtime = { orderSla: vi.fn() };
  const cron = new OrdersSlaCron(
    prisma as unknown as PrismaService,
    realtime as unknown as RealtimeService,
  );
  return { cron, prisma, realtime };
}

describe('OrdersSlaCron (AYCDS-30)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no hace nada cuando no hay comandas fuera de SLA', async () => {
    const { cron, prisma, realtime } = build();

    const result = await cron.sweep(AHORA);

    expect(result).toEqual({ marcadas: 0 });
    expect(prisma.raw.ordenes.updateMany).not.toHaveBeenCalled();
    expect(realtime.orderSla).not.toHaveBeenCalled();
  });

  it('marca solo las que siguen en falso y emite una vez por comanda', async () => {
    const { cron, prisma, realtime } = build();
    prisma.raw.ordenes.findMany.mockResolvedValue([
      orden(),
      orden({ id: 'o-2', numero_orden: 'ORD-000002', empresa_id: EMPRESA_B }),
    ]);

    const result = await cron.sweep(AHORA);

    expect(result).toEqual({ marcadas: 2 });
    expect(prisma.raw.ordenes.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['o-1', 'o-2'] }, alerta_sla: false },
      data: { alerta_sla: true },
    });
    expect(realtime.orderSla).toHaveBeenCalledTimes(2);
    expect(realtime.orderSla).toHaveBeenNthCalledWith(
      2,
      EMPRESA_B,
      expect.objectContaining({ ordenId: 'o-2', slaMinutos: 20, minutos: 25 }),
    );
  });

  it('consulta con el corte de 20 minutos y sin tocar las ya marcadas', async () => {
    const { cron, prisma } = build();

    await cron.sweep(AHORA);

    const arg = prisma.raw.ordenes.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
      take: number;
    };
    expect(arg.where).toMatchObject({
      alerta_sla: false,
      estado: { in: ['POR_CONFIRMAR', 'EN_COCINA', 'LISTO'] },
    });
    expect(arg.take).toBe(500);
    const or = arg.where.OR as { confirmacion_at?: { lt: Date } }[];
    expect(or[0]?.confirmacion_at?.lt.toISOString()).toBe('2026-11-06T11:40:00.000Z');
  });

  it('numera la comanda sin confirmar desde el ingreso', async () => {
    const { cron, prisma, realtime } = build();
    prisma.raw.ordenes.findMany.mockResolvedValue([
      orden({ id: 'o-3', estado: 'POR_CONFIRMAR', confirmacion_at: null }),
    ]);

    await cron.sweep(AHORA);

    expect(realtime.orderSla).toHaveBeenCalledWith(
      EMPRESA_A,
      expect.objectContaining({ ordenId: 'o-3', estado: 'POR_CONFIRMAR', minutos: 30 }),
    );
  });
});
