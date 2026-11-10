import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffService } from './staff.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';
import type { AuditService } from '../audit/audit.service.js';

const context = {
  userId: 'u1',
  empresaId: 'e1',
  sucursalId: 's1',
  rol: 'GERENTE_SUCURSAL' as const,
  bypass: false,
};

const EMPLEADO = '11111111-1111-4111-8111-111111111111';
const POZO = '22222222-2222-4222-8222-222222222222';

function buildPrisma() {
  return {
    scoped: {
      empleados: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      turnos_plan: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        create: vi.fn(),
        delete: vi.fn().mockResolvedValue({}),
      },
      asistencias: {
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn(),
      },
      pozos_propinas: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      ordenes: { aggregate: vi.fn().mockResolvedValue({ _sum: { propina: '0' } }) },
      sucursales: { findFirst: vi.fn() },
    },
  };
}

describe('StaffService (AYCDS-33)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let audit: { record: ReturnType<typeof vi.fn> };

  function buildService(tenant: Record<string, unknown> = context) {
    return new StaffService(
      prisma as unknown as PrismaService,
      { get: () => tenant } as unknown as TenantContextService,
      audit as unknown as AuditService,
    );
  }

  beforeEach(() => {
    prisma = buildPrisma();
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    vi.clearAllMocks();
    prisma.scoped.empleados.findMany.mockResolvedValue([]);
    prisma.scoped.empleados.findFirst.mockResolvedValue({
      id: EMPLEADO,
      nombre: 'Ana',
      sucursal_id: 's1',
    });
    prisma.scoped.turnos_plan.findMany.mockResolvedValue([]);
    prisma.scoped.asistencias.findMany.mockResolvedValue([]);
    prisma.scoped.pozos_propinas.findMany.mockResolvedValue([]);
    prisma.scoped.ordenes.aggregate.mockResolvedValue({ _sum: { propina: '0' } });
  });

  describe('turnos', () => {
    it('crea el turno del empleado en su sucursal', async () => {
      prisma.scoped.turnos_plan.create.mockResolvedValue({
        id: 't-1',
        empleados: { id: EMPLEADO, nombre: 'Ana' },
      });
      const service = buildService();

      await service.createShift({ empleadoId: EMPLEADO, fecha: '2026-11-07', bloque: 'TARDE' });

      expect(prisma.scoped.turnos_plan.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          empresa_id: 'e1',
          sucursal_id: 's1',
          empleado_id: EMPLEADO,
          bloque: 'TARDE',
        }),
        include: { empleados: { select: { id: true, nombre: true } } },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'turno.creado' }),
      );
    });

    it('rechaza un turno duplicado (409)', async () => {
      prisma.scoped.turnos_plan.create.mockRejectedValue({ code: 'P2002' });
      const service = buildService();

      await expect(
        service.createShift({ empleadoId: EMPLEADO, fecha: '2026-11-07', bloque: 'TARDE' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rechaza un empleado de otra sucursal', async () => {
      prisma.scoped.empleados.findFirst.mockResolvedValue({
        id: EMPLEADO,
        nombre: 'Ana',
        sucursal_id: 's-otra',
      });
      const service = buildService();

      await expect(
        service.createShift({ empleadoId: EMPLEADO, fecha: '2026-11-07', bloque: 'TARDE' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('devuelve 404 al borrar un turno inexistente', async () => {
      prisma.scoped.turnos_plan.findFirst.mockResolvedValue(null);
      const service = buildService();

      await expect(service.removeShift('x')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('asistencia', () => {
    it('hace upsert por empleado y día', async () => {
      prisma.scoped.asistencias.upsert.mockResolvedValue({
        id: 'a-1',
        fuente: 'PIN',
        empleados: { id: EMPLEADO, nombre: 'Ana' },
      });
      const service = buildService();

      await service.markAttendance({
        empleadoId: EMPLEADO,
        fecha: '2026-11-06',
        estado: 'TARDANZA',
      });

      expect(prisma.scoped.asistencias.upsert).toHaveBeenCalledWith({
        where: { empleado_id_fecha: { empleado_id: EMPLEADO, fecha: expect.any(Date) } },
        create: expect.objectContaining({
          empresa_id: 'e1',
          sucursal_id: 's1',
          estado: 'TARDANZA',
        }),
        update: { estado: 'TARDANZA' },
        include: { empleados: { select: { id: true, nombre: true } } },
      });
    });
  });

  describe('propinas', () => {
    it('reparte el pozo entre los presentes', async () => {
      prisma.scoped.ordenes.aggregate.mockResolvedValue({ _sum: { propina: '100.00' } });
      prisma.scoped.asistencias.findMany.mockResolvedValue([
        { empleado_id: 'e-a', estado: 'PRESENTE' },
        { empleado_id: 'e-b', estado: 'TARDANZA' },
        { empleado_id: 'e-c', estado: 'FALTA' },
      ]);
      prisma.scoped.pozos_propinas.create.mockResolvedValue({ id: POZO });
      const service = buildService();

      await service.calculateTips({ fecha: '2026-11-06' });

      const arg = prisma.scoped.pozos_propinas.create.mock.calls[0][0] as {
        data: { total: number; nro_beneficiarios: number; repartos_propinas: { create: { monto: number }[] } };
      };
      expect(arg.data.total).toBe(100);
      expect(arg.data.nro_beneficiarios).toBe(2);
      expect(arg.data.repartos_propinas.create.map((r) => r.monto)).toEqual([50, 50]);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'propinas.calculadas' }),
      );
    });

    it('rechaza si el pozo del día ya existe (409)', async () => {
      prisma.scoped.pozos_propinas.findFirst.mockResolvedValue({ id: POZO });
      const service = buildService();

      await expect(service.calculateTips({ fecha: '2026-11-06' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rechaza si no hay propinas cobradas (400)', async () => {
      const service = buildService();

      await expect(service.calculateTips({ fecha: '2026-11-06' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rechaza si no hay personal presente (400)', async () => {
      prisma.scoped.ordenes.aggregate.mockResolvedValue({ _sum: { propina: '80.00' } });
      prisma.scoped.asistencias.findMany.mockResolvedValue([
        { empleado_id: 'e-a', estado: 'FALTA' },
      ]);
      const service = buildService();

      await expect(service.calculateTips({ fecha: '2026-11-06' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('confirmar es idempotente si ya está repartido', async () => {
      prisma.scoped.pozos_propinas.findFirst
        .mockResolvedValueOnce({ id: POZO, sucursal_id: 's1', estado: 'REPARTIDO', total: '80.00' })
        .mockResolvedValueOnce({ id: POZO, estado: 'REPARTIDO', repartos_propinas: [] });
      const service = buildService();

      const result = await service.confirmPool(POZO);

      expect(prisma.scoped.pozos_propinas.updateMany).not.toHaveBeenCalled();
      expect(result).toMatchObject({ estado: 'REPARTIDO' });
    });

    it('confirma el pozo calculado', async () => {
      prisma.scoped.pozos_propinas.findFirst
        .mockResolvedValueOnce({ id: POZO, sucursal_id: 's1', estado: 'CALCULADO', total: '80.00' })
        .mockResolvedValueOnce({ id: POZO, estado: 'REPARTIDO', repartos_propinas: [] });
      const service = buildService();

      await service.confirmPool(POZO);

      expect(prisma.scoped.pozos_propinas.updateMany).toHaveBeenCalledWith({
        where: { id: POZO, estado: 'CALCULADO' },
        data: { estado: 'REPARTIDO' },
      });
    });
  });
});
