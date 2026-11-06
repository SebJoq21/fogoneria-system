import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CashService } from './cash.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { OrdersService } from '../orders/orders.service.js';

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
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      movimientos_caja: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn(),
        create: vi.fn(),
      },
      ordenes: {
        findFirst: vi.fn(),
        updateMany: vi.fn(),
      },
      sucursales: { findFirst: vi.fn() },
    },
  };
}

describe('CashService (AYCDS-34)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let audit: { record: ReturnType<typeof vi.fn> };
  let orders: { markPaid: ReturnType<typeof vi.fn> };

  function buildService(tenant: Record<string, unknown> = context) {
    return new CashService(
      prisma as unknown as PrismaService,
      { get: () => tenant } as unknown as TenantContextService,
      orders as unknown as OrdersService,
      audit as unknown as AuditService,
    );
  }

  beforeEach(() => {
    prisma = buildPrisma();
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    orders = { markPaid: vi.fn().mockResolvedValue({ id: ORDEN }) };
    vi.clearAllMocks();
    prisma.scoped.movimientos_caja.findMany.mockResolvedValue([]);
  });

  describe('apertura', () => {
    it('rechaza abrir si la sucursal ya tiene un turno abierto', async () => {
      prisma.scoped.turnos_caja.findFirst.mockResolvedValue({ id: TURNO });
      const service = buildService();

      await expect(service.open(undefined, 200)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.scoped.turnos_caja.create).not.toHaveBeenCalled();
    });

    it('abre con el fondo y el cajero del token', async () => {
      prisma.scoped.turnos_caja.findFirst.mockResolvedValue(null);
      prisma.scoped.turnos_caja.create.mockResolvedValue({
        id: TURNO,
        fondo_apertura: 200,
        estado: 'ABIERTO',
      });
      const service = buildService();

      const result = await service.open(undefined, 200);

      expect(prisma.scoped.turnos_caja.create).toHaveBeenCalledWith({
        data: {
          empresa_id: 'e1',
          sucursal_id: 's1',
          cajero_id: 'u1',
          fondo_apertura: 200,
        },
      });
      expect(result.turno).toMatchObject({ id: TURNO });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'caja.abierta' }),
      );
    });

    it('rechaza abrir en otra sucursal si el token está atado a una', async () => {
      const service = buildService();

      await expect(service.open('s-otra', 100)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('cierre y arqueo', () => {
    it('calcula totales, esperado en efectivo y diferencia', async () => {
      prisma.scoped.turnos_caja.findFirst.mockResolvedValue({
        id: TURNO,
        estado: 'ABIERTO',
        fondo_apertura: 100,
        sucursal_id: 's1',
      });
      prisma.scoped.movimientos_caja.findMany.mockResolvedValue([
        { tipo: 'INGRESO', metodo: 'EFECTIVO', monto: 200 },
        { tipo: 'INGRESO', metodo: 'TARJETA', monto: 150 },
        { tipo: 'EGRESO', metodo: 'EFECTIVO', monto: 50 },
      ]);
      prisma.scoped.turnos_caja.updateMany.mockResolvedValue({ count: 1 });
      prisma.scoped.turnos_caja.findFirstOrThrow.mockResolvedValue({
        id: TURNO,
        estado: 'CERRADO',
      });
      const service = buildService();

      const result = await service.close(TURNO, { efectivoContado: 260 });

      // Esperado en efectivo: 100 + 200 - 50 = 250; contado 260 -> +10.
      expect(prisma.scoped.turnos_caja.updateMany).toHaveBeenCalledWith({
        where: { id: TURNO, estado: 'ABIERTO' },
        data: expect.objectContaining({
          estado: 'CERRADO',
          ingresos_total: 350,
          egresos_total: 50,
          saldo: 400,
          efectivo_contado: 260,
          diferencia: 10,
        }),
      });
      expect(result.arqueo).toMatchObject({
        esperadoEfectivo: 250,
        diferencia: 10,
        saldoSistema: 400,
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'caja.cerrada' }),
      );
    });

    it('rechaza cerrar un turno ya cerrado', async () => {
      prisma.scoped.turnos_caja.findFirst.mockResolvedValue({
        id: TURNO,
        estado: 'CERRADO',
        fondo_apertura: 100,
      });
      const service = buildService();

      await expect(
        service.close(TURNO, { efectivoContado: 100 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('devuelve 404 si el turno no existe en el tenant', async () => {
      prisma.scoped.turnos_caja.findFirst.mockResolvedValue(null);
      const service = buildService();

      await expect(
        service.close('otro', { efectivoContado: 100 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('cobro de comanda', () => {
    function ordenLista(overrides: Record<string, unknown> = {}) {
      return {
        id: ORDEN,
        numero_orden: 'ORD-000010',
        estado: 'ENTREGADO',
        total: 100,
        propina: 0,
        sucursal_id: 's1',
        ...overrides,
      };
    }

    function turnoAbierto() {
      prisma.scoped.turnos_caja.findFirst.mockResolvedValue({
        id: TURNO,
        sucursal_id: 's1',
      });
      prisma.scoped.movimientos_caja.create.mockResolvedValue({ id: 'mov-1' });
    }

    it('cobra el total y pasa la orden a PAGADA', async () => {
      prisma.scoped.ordenes.findFirst.mockResolvedValue(ordenLista());
      turnoAbierto();
      const service = buildService();

      const result = await service.charge({ ordenId: ORDEN, metodo: 'EFECTIVO' });

      expect(prisma.scoped.movimientos_caja.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tipo: 'INGRESO',
          monto: 100,
          orden_id: ORDEN,
          concepto: 'Cobro ORD-000010',
        }),
      });
      expect(orders.markPaid).toHaveBeenCalledWith(ORDEN);
      expect(result).toMatchObject({ pagada: true, pendiente: 0, cobrado: 100 });
    });

    it('acepta un pago parcial sin cerrar la orden', async () => {
      prisma.scoped.ordenes.findFirst.mockResolvedValue(ordenLista());
      turnoAbierto();
      const service = buildService();

      const result = await service.charge({
        ordenId: ORDEN,
        metodo: 'TARJETA',
        monto: 40,
      });

      expect(orders.markPaid).not.toHaveBeenCalled();
      expect(result).toMatchObject({ pagada: false, pendiente: 60 });
    });

    it('descuenta lo ya cobrado antes de calcular el saldo', async () => {
      prisma.scoped.ordenes.findFirst.mockResolvedValue(ordenLista());
      turnoAbierto();
      prisma.scoped.movimientos_caja.findMany.mockResolvedValue([
        { tipo: 'INGRESO', monto: 70 },
      ]);
      const service = buildService();

      const result = await service.charge({
        ordenId: ORDEN,
        metodo: 'EFECTIVO',
      });

      expect(result).toMatchObject({ cobrado: 30, pendiente: 0, pagada: true });
    });

    it('rechaza cobrar más que el saldo pendiente', async () => {
      prisma.scoped.ordenes.findFirst.mockResolvedValue(ordenLista());
      turnoAbierto();
      prisma.scoped.movimientos_caja.findMany.mockResolvedValue([
        { tipo: 'INGRESO', monto: 80 },
      ]);
      const service = buildService();

      await expect(
        service.charge({ ordenId: ORDEN, metodo: 'EFECTIVO', monto: 30 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('registra la propina en la orden y como ingreso aparte', async () => {
      prisma.scoped.ordenes.findFirst.mockResolvedValue(ordenLista());
      turnoAbierto();
      const service = buildService();

      const result = await service.charge({
        ordenId: ORDEN,
        metodo: 'EFECTIVO',
        propina: 8,
      });

      expect(prisma.scoped.ordenes.updateMany).toHaveBeenCalledWith({
        where: { id: ORDEN },
        data: { propina: { increment: 8 } },
      });
      expect(prisma.scoped.movimientos_caja.create).toHaveBeenCalledTimes(2);
      expect(prisma.scoped.movimientos_caja.create).toHaveBeenLastCalledWith({
        data: expect.objectContaining({
          concepto: 'Propina ORD-000010',
          monto: 8,
        }),
      });
      expect(result.propina).toBe(8);
    });

    it('rechaza cobrar una comanda que no está ENTREGADO', async () => {
      prisma.scoped.ordenes.findFirst.mockResolvedValue(
        ordenLista({ estado: 'EN_COCINA' }),
      );
      const service = buildService();

      await expect(
        service.charge({ ordenId: ORDEN, metodo: 'EFECTIVO' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rechaza cobrar sin caja abierta', async () => {
      prisma.scoped.ordenes.findFirst.mockResolvedValue(ordenLista());
      prisma.scoped.turnos_caja.findFirst.mockResolvedValue(null);
      const service = buildService();

      await expect(
        service.charge({ ordenId: ORDEN, metodo: 'EFECTIVO' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.scoped.movimientos_caja.create).not.toHaveBeenCalled();
    });
  });

  describe('movimientos manuales', () => {
    it('registra un egreso en el turno abierto', async () => {
      prisma.scoped.turnos_caja.findFirst.mockResolvedValue({
        id: TURNO,
        sucursal_id: 's1',
      });
      prisma.scoped.movimientos_caja.create.mockResolvedValue({ id: 'mov-2' });
      const service = buildService();

      await service.createMovement({
        tipo: 'EGRESO',
        concepto: 'Compra de hielo',
        monto: 25,
        metodo: 'EFECTIVO',
      });

      expect(prisma.scoped.movimientos_caja.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tipo: 'EGRESO',
          turno_id: TURNO,
          monto: 25,
          actor_id: 'u1',
        }),
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'caja.egreso' }),
      );
    });

    it('rechaza el movimiento sin caja abierta', async () => {
      prisma.scoped.turnos_caja.findFirst.mockResolvedValue(null);
      const service = buildService();

      await expect(
        service.createMovement({
          tipo: 'INGRESO',
          concepto: 'Otro',
          monto: 10,
          metodo: 'EFECTIVO',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
