import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpensesService } from './expenses.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { CashService } from '../cash/cash.service.js';

const context = {
  userId: 'u1',
  empresaId: 'e1',
  sucursalId: 's1',
  rol: 'CAJERO' as const,
  bypass: false,
};

const GASTO = '11111111-1111-4111-8111-111111111111';
const PROVEEDOR = '22222222-2222-4222-8222-222222222222';

function buildPrisma() {
  const aggregate = vi.fn().mockResolvedValue({
    _sum: { monto: '0' },
    _count: { _all: 0 },
  });
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

describe('ExpensesService (AYCDS-17)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let cash: { egresoDeGasto: ReturnType<typeof vi.fn> };
  let audit: { record: ReturnType<typeof vi.fn> };

  function buildService(tenant: Record<string, unknown> = context) {
    return new ExpensesService(
      prisma as unknown as PrismaService,
      { get: () => tenant } as unknown as TenantContextService,
      cash as unknown as CashService,
      audit as unknown as AuditService,
    );
  }

  beforeEach(() => {
    prisma = buildPrisma();
    cash = {
      egresoDeGasto: vi.fn().mockResolvedValue({ turno: { id: 't-1', sucursal_id: 's1' } }),
    };
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    vi.clearAllMocks();
    prisma.scoped.gastos.findMany.mockResolvedValue([]);
    prisma.scoped.gastos.count.mockResolvedValue(0);
    prisma.scoped.proveedores.findFirst.mockResolvedValue({ id: PROVEEDOR });
  });

  describe('alta', () => {
    it('crea el gasto pendiente con el usuario del token', async () => {
      prisma.scoped.gastos.create.mockResolvedValue({ id: GASTO, concepto: 'Carbón', monto: '350.50' });
      const service = buildService();

      await service.create({
        concepto: '  Carbón  ',
        monto: 350.5,
        categoria: 'INSUMOS',
        proveedorId: PROVEEDOR,
        vencimiento: '2026-12-15',
      });

      expect(prisma.scoped.gastos.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          empresa_id: 'e1',
          sucursal_id: 's1',
          concepto: 'Carbón',
          monto: 350.5,
          categoria: 'INSUMOS',
          proveedor_id: PROVEEDOR,
          registrado_por: 'u1',
        }),
        include: { proveedores: { select: { id: true, nombre: true } } },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'gasto.creado' }),
      );
    });

    it('rechaza un proveedor ajeno', async () => {
      prisma.scoped.proveedores.findFirst.mockResolvedValue(null);
      const service = buildService();

      await expect(
        service.create({ concepto: 'X', monto: 10, categoria: 'OTROS', proveedorId: PROVEEDOR }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rechaza otra sucursal si el token está atado a una', async () => {
      const service = buildService();

      await expect(
        service.create({ concepto: 'X', monto: 10, categoria: 'OTROS', sucursalId: 's-otra' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('edición', () => {
    it('edita un gasto pendiente', async () => {
      prisma.scoped.gastos.findFirst.mockResolvedValue({
        id: GASTO,
        pagado_en_caja: false,
        sucursal_id: 's1',
      });
      prisma.scoped.gastos.update.mockResolvedValue({ id: GASTO, concepto: 'Carbón', monto: '300' });
      const service = buildService();

      await service.update(GASTO, { monto: 300 });

      expect(prisma.scoped.gastos.update).toHaveBeenCalledWith({
        where: { id: GASTO },
        data: { monto: 300 },
      });
    });

    it('bloquea editar un gasto pagado en caja', async () => {
      prisma.scoped.gastos.findFirst.mockResolvedValue({
        id: GASTO,
        pagado_en_caja: true,
        sucursal_id: 's1',
      });
      const service = buildService();

      await expect(service.update(GASTO, { monto: 1 })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('devuelve 404 si el gasto no existe', async () => {
      prisma.scoped.gastos.findFirst.mockResolvedValue(null);
      const service = buildService();

      await expect(service.update('otro', { monto: 1 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('pago', () => {
    const pendiente = {
      id: GASTO,
      concepto: 'Carbón',
      monto: '350.50',
      estado_pago: 'PENDIENTE' as const,
      pagado_en_caja: false,
      sucursal_id: 's1',
    };

    it('en efectivo descuenta del turno abierto y marca pagado_en_caja', async () => {
      prisma.scoped.gastos.findFirst
        .mockResolvedValueOnce(pendiente)
        .mockResolvedValueOnce({ ...pendiente, estado_pago: 'PAGADO', pagado_en_caja: true });
      prisma.scoped.gastos.updateMany.mockResolvedValue({ count: 1 });
      const service = buildService();

      const result = await service.pay(GASTO, 'EFECTIVO');

      expect(cash.egresoDeGasto).toHaveBeenCalledWith('s1', {
        concepto: 'Pago de gasto: Carbón',
        monto: 350.5,
        gastoId: GASTO,
        actorId: 'u1',
      });
      expect(prisma.scoped.gastos.updateMany).toHaveBeenCalledWith({
        where: { id: GASTO, estado_pago: 'PENDIENTE' },
        data: { estado_pago: 'PAGADO', pagado_en_caja: true, turno_id: 't-1' },
      });
      expect(result).toMatchObject({ estado_pago: 'PAGADO' });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'gasto.pagado' }),
      );
    });

    it('con transferencia no toca la caja', async () => {
      prisma.scoped.gastos.findFirst
        .mockResolvedValueOnce(pendiente)
        .mockResolvedValueOnce({ ...pendiente, estado_pago: 'PAGADO' });
      prisma.scoped.gastos.updateMany.mockResolvedValue({ count: 1 });
      const service = buildService();

      await service.pay(GASTO, 'TRANSFERENCIA');

      expect(cash.egresoDeGasto).not.toHaveBeenCalled();
      expect(prisma.scoped.gastos.updateMany).toHaveBeenCalledWith({
        where: { id: GASTO, estado_pago: 'PENDIENTE' },
        data: { estado_pago: 'PAGADO', pagado_en_caja: false },
      });
    });

    it('rechaza pagar dos veces', async () => {
      prisma.scoped.gastos.findFirst.mockResolvedValue({
        ...pendiente,
        estado_pago: 'PAGADO',
      });
      const service = buildService();

      await expect(service.pay(GASTO, 'EFECTIVO')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(cash.egresoDeGasto).not.toHaveBeenCalled();
    });

    it('avisa si otra caja pagó el gasto en paralelo', async () => {
      prisma.scoped.gastos.findFirst.mockResolvedValue(pendiente);
      prisma.scoped.gastos.updateMany.mockResolvedValue({ count: 0 });
      const service = buildService();

      await expect(service.pay(GASTO, 'EFECTIVO')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('listado y resumen', () => {
    it('filtra vencidos como pendientes con fecha pasada', async () => {
      const service = buildService();

      await service.list({ page: 1, limit: 20, vencidos: true });

      const arg = prisma.scoped.gastos.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(arg.where).toMatchObject({
        estado_pago: 'PENDIENTE',
        vencimiento: { lt: expect.any(Date) },
      });
    });

    it('acota a la sucursal del token', async () => {
      const service = buildService();

      await service.list({ page: 1, limit: 20 });

      const arg = prisma.scoped.gastos.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(arg.where).toMatchObject({ sucursal_id: 's1' });
    });

    it('suma por pagar, vencido y pagado del mes', async () => {
      prisma.scoped.gastos.aggregate
        .mockResolvedValueOnce({ _sum: { monto: '1200.40' }, _count: { _all: 3 } })
        .mockResolvedValueOnce({ _sum: { monto: '200.10' }, _count: { _all: 1 } })
        .mockResolvedValueOnce({ _sum: { monto: '800.00' }, _count: { _all: 2 } });
      const service = buildService();

      const summary = await service.summary({ page: 1, limit: 20 });

      expect(summary).toEqual({
        porPagar: 1200.4,
        porPagarCantidad: 3,
        vencido: 200.1,
        vencidoCantidad: 1,
        pagadoMes: 800,
        pagadoMesCantidad: 2,
      });
    });
  });
});
