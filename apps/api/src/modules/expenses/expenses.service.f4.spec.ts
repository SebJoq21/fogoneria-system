import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpensesService } from './expenses.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { CashPort } from '../cash/index.js';

const context = {
  userId: 'u1',
  empresaId: 'e1',
  sucursalId: 's1',
  rol: 'ADMIN_GLOBAL' as const,
  bypass: false,
};
const GASTO = '11111111-1111-4111-8111-111111111111';
const PROVEEDOR = '22222222-2222-4222-8222-222222222222';

function buildPrisma() {
  const aggregate = vi.fn().mockResolvedValue({ _sum: { monto: null }, _count: { _all: 0 } });
  return {
    scoped: {
      gastos: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        aggregate,
      },
      proveedores: { findFirst: vi.fn() },
      sucursales: { findFirst: vi.fn() },
    },
  };
}

describe('ExpensesService (f4: filtros y ramas)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let cash: { egresoDeGasto: ReturnType<typeof vi.fn> };
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: ExpensesService;

  beforeEach(() => {
    prisma = buildPrisma();
    cash = { egresoDeGasto: vi.fn().mockResolvedValue({ turno: { id: 't-1' } }) };
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    service = new ExpensesService(
      prisma as unknown as PrismaService,
      { get: () => context } as unknown as TenantContextService,
      cash as unknown as CashPort,
      audit as unknown as AuditService,
    );
    prisma.scoped.gastos.aggregate.mockResolvedValue({
      _sum: { monto: null },
      _count: { _all: 0 },
    });
  });

  it('lista con sucursal, estado, categoría y vencidos', async () => {
    await service.list({
      sucursalId: 's1',
      estadoPago: 'PENDIENTE',
      categoria: 'INSUMOS',
      vencidos: true,
      page: 1,
      limit: 20,
    } as never);

    expect(prisma.scoped.gastos.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sucursal_id: 's1',
          estado_pago: 'PENDIENTE',
          categoria: 'INSUMOS',
          vencimiento: { lt: expect.any(Date) },
        }),
      }),
    );
  });

  it('resume sin sucursal y con agregados vacíos', async () => {
    const sinSucursal = new ExpensesService(
      prisma as unknown as PrismaService,
      { get: () => ({ ...context, sucursalId: null }) } as unknown as TenantContextService,
      cash as unknown as CashPort,
      audit as unknown as AuditService,
    );
    const resumen = await sinSucursal.summary({ page: 1, limit: 20 } as never);
    expect(resumen).toEqual({
      porPagar: 0,
      porPagarCantidad: 0,
      vencido: 0,
      vencidoCantidad: 0,
      pagadoMes: 0,
      pagadoMesCantidad: 0,
    });
    expect(prisma.scoped.gastos.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { estado_pago: 'PENDIENTE' } }),
    );
  });

  it('crea sin proveedor ni vencimiento y audita', async () => {
    prisma.scoped.gastos.create.mockResolvedValue({
      id: GASTO,
      concepto: 'Luz',
      monto: '80',
      categoria: 'SERVICIOS',
    });
    await service.create({ concepto: ' Luz ', monto: 80, categoria: 'SERVICIOS' } as never);

    expect(prisma.scoped.gastos.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          concepto: 'Luz',
          proveedor_id: null,
          vencimiento: null,
          sucursal_id: 's1',
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ detalle: expect.objectContaining({ vencimiento: null }) }),
    );
  });

  it('edita todos los campos y acepta quitar el proveedor', async () => {
    prisma.scoped.gastos.findFirst.mockResolvedValue({
      id: GASTO,
      pagado_en_caja: false,
      sucursal_id: 's1',
    });
    prisma.scoped.gastos.update.mockResolvedValue({ id: GASTO });
    prisma.scoped.proveedores.findFirst.mockResolvedValue({ id: PROVEEDOR });

    await service.update(GASTO, {
      concepto: '  Carbón  ',
      monto: 12.345,
      categoria: 'INSUMOS',
      proveedorId: PROVEEDOR,
      vencimiento: '2026-12-31',
    } as never);
    expect(prisma.scoped.gastos.update).toHaveBeenCalledWith({
      where: { id: GASTO },
      data: {
        concepto: 'Carbón',
        monto: 12.35,
        categoria: 'INSUMOS',
        proveedor_id: PROVEEDOR,
        vencimiento: new Date('2026-12-31T00:00:00-05:00'),
      },
    });

    await service.update(GASTO, { proveedorId: null } as never);
    expect(prisma.scoped.gastos.update).toHaveBeenLastCalledWith({
      where: { id: GASTO },
      data: { proveedor_id: null },
    });
  });

  it('paga en efectivo, sin turno previo y detecta el doble pago', async () => {
    prisma.scoped.gastos.findFirst
      .mockResolvedValueOnce({
        id: GASTO,
        concepto: 'Luz',
        monto: '80',
        estado_pago: 'PENDIENTE',
        pagado_en_caja: false,
        sucursal_id: 's1',
      })
      .mockResolvedValueOnce({ id: GASTO, estado_pago: 'PAGADO' });
    prisma.scoped.gastos.updateMany.mockResolvedValue({ count: 1 });

    await service.pay(GASTO, 'EFECTIVO');
    expect(cash.egresoDeGasto).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ gastoId: GASTO, monto: 80 }),
    );
    expect(prisma.scoped.gastos.updateMany).toHaveBeenCalledWith({
      where: { id: GASTO, estado_pago: 'PENDIENTE' },
      data: { estado_pago: 'PAGADO', pagado_en_caja: true, turno_id: 't-1' },
    });
  });

  it('no paga un gasto inexistente, ya pagado o con carrera', async () => {
    prisma.scoped.gastos.findFirst.mockResolvedValue(null);
    await expect(service.pay(GASTO, 'TARJETA')).rejects.toBeInstanceOf(NotFoundException);

    prisma.scoped.gastos.findFirst.mockResolvedValue({
      id: GASTO,
      estado_pago: 'PAGADO',
      monto: '10',
    });
    await expect(service.pay(GASTO, 'TARJETA')).rejects.toBeInstanceOf(ConflictException);

    prisma.scoped.gastos.findFirst.mockResolvedValue({
      id: GASTO,
      concepto: 'Luz',
      monto: '10',
      estado_pago: 'PENDIENTE',
      pagado_en_caja: false,
      sucursal_id: 's1',
    });
    prisma.scoped.gastos.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.pay(GASTO, 'TARJETA')).rejects.toBeInstanceOf(ConflictException);
    expect(cash.egresoDeGasto).not.toHaveBeenCalled();
  });
});
