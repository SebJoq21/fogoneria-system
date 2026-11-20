import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffService } from './staff.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';
import type { AuditService } from '../audit/index.js';

const context = {
  userId: 'u1',
  empresaId: 'e1',
  sucursalId: 's1',
  rol: 'GERENTE_SUCURSAL' as const,
  bypass: false,
};
const admin = { userId: 'u1', empresaId: 'e1', sucursalId: null, rol: 'ADMIN_GLOBAL' as const, bypass: false };
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
      asistencias: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn() },
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

describe('StaffService (ramas restantes)', () => {
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
    prisma.scoped.empleados.findFirst.mockResolvedValue({ id: EMPLEADO, nombre: 'Ana', sucursal_id: 's1' });
  });

  it('lista empleados con filtro activo y rechaza otra sucursal del token', async () => {
    prisma.scoped.empleados.findMany.mockResolvedValue([{ id: EMPLEADO }]);
    await expect(buildService().listEmployees({ activo: false } as never)).resolves.toHaveLength(1);
    expect(prisma.scoped.empleados.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deleted_at: null, sucursal_id: 's1', activo: false } }),
    );

    await expect(
      buildService().listEmployees({ sucursalId: 's-2' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('el admin sin sucursal debe indicarla en turnos y asistencia', async () => {
    prisma.scoped.empleados.findMany.mockResolvedValue([]);
    await expect(buildService(admin).listShifts({} as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(buildService(admin).listAttendance({} as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      buildService(admin).listEmployees({} as never),
    ).resolves.toEqual([]);
  });

  it('crea turnos y traduce el duplicado', async () => {
    prisma.scoped.turnos_plan.create.mockResolvedValue({
      id: 't-1',
      empleados: { nombre: 'Ana' },
    });
    await expect(
      buildService().createShift({
        empleadoId: EMPLEADO,
        fecha: '2026-11-20',
        bloque: 'TARDE',
      } as never),
    ).resolves.toMatchObject({ id: 't-1' });

    prisma.scoped.turnos_plan.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      buildService().createShift({
        empleadoId: EMPLEADO,
        fecha: '2026-11-20',
        bloque: 'TARDE',
      } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza turnos de un empleado ajeno o inexistente', async () => {
    prisma.scoped.empleados.findFirst.mockResolvedValue(null);
    await expect(
      buildService().createShift({
        empleadoId: EMPLEADO,
        fecha: '2026-11-20',
        bloque: 'TARDE',
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removeShift 404 y baja correcta', async () => {
    prisma.scoped.turnos_plan.findFirst.mockResolvedValue(null);
    await expect(buildService().removeShift('t-1')).rejects.toBeInstanceOf(NotFoundException);

    prisma.scoped.turnos_plan.findFirst.mockResolvedValue({
      id: 't-1',
      sucursal_id: 's1',
      empleado_id: EMPLEADO,
      fecha: new Date('2026-11-20T00:00:00.000Z'),
      bloque: 'TARDE',
    });
    await expect(buildService().removeShift('t-1')).resolves.toEqual({
      id: 't-1',
      eliminado: true,
    });
  });

  it('marca asistencia con horas y fuente opcionales', async () => {
    prisma.scoped.asistencias.upsert.mockResolvedValue({
      id: 'a-1',
      empleados: { nombre: 'Ana' },
      fuente: 'PIN',
    });
    await buildService().markAttendance({
      empleadoId: EMPLEADO,
      estado: 'TARDANZA',
      horaEntrada: '2026-11-20T14:00:00.000Z',
      horaSalida: '2026-11-20T22:00:00.000Z',
      fuente: 'PIN',
    } as never);
    expect(prisma.scoped.asistencias.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          hora_entrada: expect.any(Date),
          hora_salida: expect.any(Date),
          fuente: 'PIN',
        }),
        update: expect.objectContaining({ fuente: 'PIN' }),
      }),
    );
  });

  it('getPool 404 si el pozo no existe', async () => {
    prisma.scoped.pozos_propinas.findFirst.mockResolvedValue(null);
    await expect(buildService().getPool(POZO)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('calculateTips rechaza pozo existente, sin propinas y sin presentes', async () => {
    prisma.scoped.pozos_propinas.findFirst.mockResolvedValue({ id: POZO });
    await expect(buildService().calculateTips({} as never)).rejects.toBeInstanceOf(
      ConflictException,
    );

    prisma.scoped.pozos_propinas.findFirst.mockResolvedValue(null);
    prisma.scoped.ordenes.aggregate.mockResolvedValue({ _sum: { propina: '0' } });
    await expect(buildService().calculateTips({} as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.scoped.ordenes.aggregate.mockResolvedValue({ _sum: { propina: '100' } });
    prisma.scoped.asistencias.findMany.mockResolvedValue([]);
    await expect(buildService().calculateTips({} as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('exige empresa en el token', async () => {
    await expect(
      buildService({ userId: 'u1' }).createShift({
        empleadoId: EMPLEADO,
        fecha: '2026-11-20',
        bloque: 'TARDE',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
