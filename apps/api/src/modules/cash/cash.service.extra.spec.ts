import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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
const admin = { userId: 'u1', empresaId: 'e1', sucursalId: null, rol: 'ADMIN_GLOBAL' as const, bypass: false };
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
        create: vi.fn(),
      },
      ordenes: { findFirst: vi.fn(), updateMany: vi.fn() },
      sucursales: { findFirst: vi.fn() },
    },
  };
}

describe('CashService (ramas restantes)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let audit: { record: ReturnType<typeof vi.fn> };
  let orders: { markPaid: ReturnType<typeof vi.fn> };

  function buildService(tenant: Record<string, unknown> = context) {
    return new CashService(
      prisma as unknown as PrismaService,
      { get: () => tenant } as unknown as TenantContextService,
      orders as unknown as OrdersPort,
      audit as unknown as AuditService,
    );
  }

  beforeEach(() => {
    prisma = buildPrisma();
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    orders = { markPaid: vi.fn().mockResolvedValue({ id: 'o-1' }) };
  });

  it('current devuelve null sin turno y el arqueo con turno', async () => {
    await expect(buildService().current()).resolves.toBeNull();

    prisma.scoped.turnos_caja.findFirst.mockResolvedValue({
      id: TURNO,
      fondo_apertura: '200.00',
    });
    prisma.scoped.movimientos_caja.findMany.mockResolvedValue([
      { tipo: 'INGRESO', metodo: 'EFECTIVO', monto: '59.00' },
      { tipo: 'EGRESO', metodo: 'TARJETA', monto: '20.00' },
    ]);
    const actual = await buildService().current();
    expect(actual?.arqueo).toMatchObject({
      fondo: 200,
      ingresos: 59,
      egresos: 20,
      esperadoEfectivo: 259,
      saldoSistema: 239,
      movimientos: 2,
    });
  });

  it('rechaza pedir otra sucursal cuando el token está atado', async () => {
    await expect(buildService().current('s-2')).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      buildService().listShifts({ sucursalId: 's-2', page: 1, limit: 20 } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('listShifts filtra por fechas y sucursal del token', async () => {
    prisma.scoped.turnos_caja.findMany.mockResolvedValue([{ id: TURNO }]);
    prisma.scoped.turnos_caja.count.mockResolvedValue(1);
    const lista = await buildService().listShifts({
      desde: '2026-11-01',
      hasta: '2026-11-30',
      page: 1,
      limit: 20,
    } as never);
    expect(lista).toMatchObject({ total: 1, page: 1, limit: 20 });
    expect(prisma.scoped.turnos_caja.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sucursal_id: 's1',
          apertura_at: { gte: expect.any(Date), lte: expect.any(Date) },
        },
      }),
    );
  });

  it('open exige sucursal al admin y valida que exista', async () => {
    await expect(buildService(admin).open(undefined, 200)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.scoped.sucursales.findFirst.mockResolvedValue(null);
    await expect(buildService(admin).open('s-9', 200)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.scoped.sucursales.findFirst.mockResolvedValue({ id: 's-9' });
    prisma.scoped.turnos_caja.findFirst.mockResolvedValue(null);
    prisma.scoped.turnos_caja.create.mockResolvedValue({ id: TURNO, fondo_apertura: 200 });
    await expect(buildService(admin).open('s-9', 200)).resolves.toMatchObject({
      turno: { id: TURNO },
    });
  });

  it('open traduce la carrera del índice único y repropaga otros errores', async () => {
    prisma.scoped.turnos_caja.findFirst.mockResolvedValue(null);
    prisma.scoped.turnos_caja.create.mockRejectedValue({ code: 'P2002' });
    await expect(buildService().open(undefined, 200)).rejects.toBeInstanceOf(ConflictException);

    prisma.scoped.turnos_caja.create.mockRejectedValue(new Error('db caída'));
    await expect(buildService().open(undefined, 200)).rejects.toThrow('db caída');
  });

  it('close rechaza un turno ya cerrado', async () => {
    prisma.scoped.turnos_caja.findFirst.mockResolvedValue({
      id: TURNO,
      sucursal_id: 's1',
      fondo_apertura: '200.00',
    });
    prisma.scoped.movimientos_caja.findMany.mockResolvedValue([]);
    prisma.scoped.turnos_caja.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      buildService().close(TURNO, { efectivoContado: 200 } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('movements usa el turno abierto o exige sucursal', async () => {
    prisma.scoped.turnos_caja.findFirst.mockResolvedValue({ id: TURNO, sucursal_id: 's1' });
    prisma.scoped.movimientos_caja.findMany.mockResolvedValue([{ id: 'm-1' }]);
    prisma.scoped.movimientos_caja.count.mockResolvedValue(1);
    const lista = await buildService().movements({ tipo: 'EGRESO', page: 1, limit: 20 } as never);
    expect(lista).toMatchObject({ turnoId: TURNO, total: 1 });
    expect(prisma.scoped.movimientos_caja.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { turno_id: TURNO, tipo: 'EGRESO' } }),
    );

    await expect(buildService(admin).movements({} as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('createMovement exige un turno abierto', async () => {
    prisma.scoped.turnos_caja.findFirst.mockResolvedValue(null);
    await expect(
      buildService().createMovement({
        tipo: 'EGRESO',
        concepto: 'Compra',
        monto: 20,
        metodo: 'EFECTIVO',
      } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('egresoDeGasto registra el movimiento con el turno abierto', async () => {
    prisma.scoped.turnos_caja.findFirst.mockResolvedValue({ id: TURNO, sucursal_id: 's1' });
    prisma.scoped.movimientos_caja.create.mockResolvedValue({ id: 'm-1' });

    const resultado = await buildService().egresoDeGasto('s1', {
      concepto: 'Gas',
      monto: 120,
      gastoId: 'g-1',
      actorId: null,
    });

    expect(resultado).toMatchObject({ movimiento: { id: 'm-1' } });
    expect(prisma.scoped.movimientos_caja.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: 'EGRESO',
        gasto_id: 'g-1',
        metodo: 'EFECTIVO',
        actor_id: 'u1',
      }),
    });
  });

  it('arqueoDe separa efectivo y otros métodos', async () => {
    prisma.scoped.movimientos_caja.findMany.mockResolvedValue([
      { tipo: 'INGRESO', metodo: 'EFECTIVO', monto: '100' },
      { tipo: 'INGRESO', metodo: 'YAPE', monto: '50' },
      { tipo: 'EGRESO', metodo: 'EFECTIVO', monto: '30' },
      { tipo: 'EGRESO', metodo: 'TARJETA', monto: '10' },
    ]);
    const arqueo = await buildService().arqueoDe(TURNO, 200);
    expect(arqueo).toMatchObject({
      fondo: 200,
      ingresos: 150,
      egresos: 40,
      ingresosEfectivo: 100,
      egresosEfectivo: 30,
      esperadoEfectivo: 270,
      saldoSistema: 310,
      movimientos: 4,
    });
  });

  it('exige empresa en el token', async () => {
    await expect(buildService({ userId: 'u1' }).open(undefined, 100)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
