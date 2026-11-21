import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CashService } from './cash.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { OrdersPort } from '../orders/index.js';

const context = {
  userId: 'u1',
  empresaId: 'e1',
  sucursalId: 's1',
  rol: 'CAJERO' as const,
  bypass: false,
};
const ORDEN = '11111111-1111-4111-8111-111111111111';
const TURNO = '22222222-2222-4222-8222-222222222222';

function buildPrisma() {
  return {
    scoped: {
      turnos_caja: {
        findFirst: vi.fn(),
        findFirstOrThrow: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      movimientos_caja: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: 'm-1' }),
      },
      ordenes: { findFirst: vi.fn(), updateMany: vi.fn() },
      sucursales: { findFirst: vi.fn().mockResolvedValue({ id: 's1' }) },
    },
  };
}

describe('CashService (f4: filtros y saldos)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let orders: { markPaid: ReturnType<typeof vi.fn> };
  let service: CashService;

  beforeEach(() => {
    prisma = buildPrisma();
    orders = { markPaid: vi.fn().mockResolvedValue({ id: ORDEN }) };
    service = new CashService(
      prisma as unknown as PrismaService,
      { get: () => context } as unknown as TenantContextService,
      orders as unknown as OrdersPort,
      { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService,
    );
    prisma.scoped.turnos_caja.findFirstOrThrow.mockResolvedValue({
      id: TURNO,
      sucursal_id: 's1',
      fondo_apertura: '200',
    });
    prisma.scoped.turnos_caja.findFirst.mockResolvedValue({
      id: TURNO,
      sucursal_id: 's1',
      fondo_apertura: '200',
    });
  });

  it('filtra turnos por desde y por hasta', async () => {
    await service.listShifts({ desde: '2026-11-01', page: 1, limit: 10 } as never);
    expect(prisma.scoped.turnos_caja.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          apertura_at: { gte: new Date('2026-11-01') },
        }),
      }),
    );

    await service.listShifts({ hasta: '2026-11-30', page: 1, limit: 10 } as never);
    expect(prisma.scoped.turnos_caja.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          apertura_at: { lte: new Date('2026-11-30') },
        }),
      }),
    );
  });

  it('filtra movimientos por turno y tipo', async () => {
    await service.movements({ turnoId: TURNO, tipo: 'EGRESO', page: 1, limit: 10 } as never);
    expect(prisma.scoped.movimientos_caja.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { turno_id: TURNO, tipo: 'EGRESO' } }),
    );
  });

  it('rechaza cobrar una orden pagada, anulada o ya saldada', async () => {
    const base = {
      id: ORDEN,
      numero_orden: 'ORD-1',
      total: '100',
      propina: '0',
      sucursal_id: 's1',
    };

    prisma.scoped.ordenes.findFirst.mockResolvedValue({ ...base, estado: 'PAGADA' });
    await expect(service.charge({ ordenId: ORDEN, metodo: 'EFECTIVO' } as never)).rejects.toBeInstanceOf(
      ConflictException,
    );

    prisma.scoped.ordenes.findFirst.mockResolvedValue({ ...base, estado: 'ANULADA' });
    await expect(service.charge({ ordenId: ORDEN, metodo: 'EFECTIVO' } as never)).rejects.toBeInstanceOf(
      ConflictException,
    );

    prisma.scoped.ordenes.findFirst.mockResolvedValue({ ...base, estado: 'ENTREGADO' });
    prisma.scoped.movimientos_caja.findMany.mockResolvedValue([
      { tipo: 'INGRESO', monto: '100' },
    ]);
    await expect(service.charge({ ordenId: ORDEN, metodo: 'EFECTIVO' } as never)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('calcula el saldo neto descontando egresos y cobra el pendiente', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue({
      id: ORDEN,
      numero_orden: 'ORD-1',
      estado: 'ENTREGADO',
      total: '100',
      propina: '0',
      sucursal_id: 's1',
    });
    prisma.scoped.movimientos_caja.findMany.mockResolvedValue([
      { tipo: 'INGRESO', monto: '60' },
      { tipo: 'EGRESO', monto: '10' },
    ]);

    const resultado = await service.charge({ ordenId: ORDEN, metodo: 'EFECTIVO' } as never);

    expect(prisma.scoped.movimientos_caja.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ monto: 50 }) }),
    );
    expect(orders.markPaid).toHaveBeenCalledWith(ORDEN);
    expect(resultado).toMatchObject({ pagada: true, cobrado: 50, pendiente: 0 });
  });
});
