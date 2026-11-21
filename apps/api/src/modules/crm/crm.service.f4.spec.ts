import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CrmService } from './crm.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';
import type { AuditService } from '../audit/audit.service.js';

const context = {
  userId: 'u1',
  empresaId: 'e1',
  sucursalId: 's1',
  rol: 'ADMIN_GLOBAL' as const,
  bypass: false,
};
const CLIENTE = '11111111-1111-4111-8111-111111111111';
const ORDEN_1 = '22222222-2222-4222-8222-222222222222';
const ORDEN_2 = '33333333-3333-4333-8333-333333333333';

function buildPrisma() {
  return {
    scoped: {
      clientes: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      movimientos_puntos: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({}),
      },
      ordenes: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      config_lealtad: { upsert: vi.fn().mockResolvedValue({}) },
      sucursales: { findFirst: vi.fn() },
    },
    raw: {
      clientes: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      movimientos_puntos: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({}),
      },
      ordenes: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      config_lealtad: { findUnique: vi.fn().mockResolvedValue(null) },
    },
  };
}

describe('CrmService (f4: ramas de datos)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: CrmService;

  beforeEach(() => {
    prisma = buildPrisma();
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    service = new CrmService(
      prisma as unknown as PrismaService,
      { get: () => context } as unknown as TenantContextService,
      audit as unknown as AuditService,
    );
    prisma.raw.config_lealtad.findUnique.mockResolvedValue(null);
  });

  it('lista clientes por segmento y puntos sin filtro de tipo', async () => {
    await service.listCustomers({ segmento: 'VIP', page: 1, limit: 20 } as never);
    expect(prisma.scoped.clientes.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deleted_at: null, segmento: 'VIP' },
      }),
    );

    prisma.scoped.clientes.findFirst.mockResolvedValue({ id: CLIENTE, puntos: 3 });
    await service.listPoints(CLIENTE, { page: 1, limit: 20 } as never);
    expect(prisma.scoped.movimientos_puntos.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cliente_id: CLIENTE } }),
    );
  });

  it('actualiza solo los campos enviados y re-lanza errores ajenos', async () => {
    prisma.scoped.clientes.findFirst.mockResolvedValue({ id: CLIENTE });
    prisma.scoped.clientes.update.mockResolvedValue({
      id: CLIENTE,
      nombre: 'Ana',
      telefono: '987',
    });

    await service.updateCustomer(CLIENTE, { nombre: '  Ana  ' } as never);
    expect(prisma.scoped.clientes.update).toHaveBeenLastCalledWith({
      where: { id: CLIENTE },
      data: { nombre: 'Ana' },
    });

    await service.updateCustomer(CLIENTE, { telefono: '987' } as never);
    expect(prisma.scoped.clientes.update).toHaveBeenLastCalledWith({
      where: { id: CLIENTE },
      data: { telefono: '987' },
    });

    prisma.scoped.clientes.update.mockRejectedValue(new Error('db caída'));
    await expect(
      service.updateCustomer(CLIENTE, { nombre: 'Ana' } as never),
    ).rejects.toThrow('db caída');

    prisma.scoped.clientes.update.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.updateCustomer(CLIENTE, { telefono: '987' } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('ajusta puntos con motivo por defecto y saldo nulo en auditoría', async () => {
    prisma.scoped.clientes.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.adjustPoints(CLIENTE, { tipo: 'GANANCIA', puntos: 5 } as never),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.scoped.clientes.findFirst
      .mockResolvedValueOnce({ id: CLIENTE, puntos: 10 })
      .mockResolvedValueOnce({ empresa_id: 'e1' })
      .mockResolvedValueOnce(null);
    await service.adjustPoints(CLIENTE, { tipo: 'GANANCIA', puntos: 5 } as never);
    expect(prisma.scoped.movimientos_puntos.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ motivo: 'Ajuste manual' }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'cliente.puntos',
        detalle: expect.objectContaining({ saldo: null }),
      }),
    );
  });

  it('actualiza la configuración solo con los campos enviados', async () => {
    await service.updateConfig({ puntosPorMoneda: 2 } as never);
    expect(prisma.scoped.config_lealtad.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          puntos_por_moneda: 2,
          caducidad_meses: 12,
          umbral_frecuente: 5,
          umbral_vip: 20,
        }),
        update: { puntos_por_moneda: 2 },
      }),
    );

    await service.updateConfig({ umbralVip: 30 } as never);
    expect(prisma.scoped.config_lealtad.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ umbral_frecuente: 5, umbral_vip: 30 }),
        update: { umbral_vip: 30 },
      }),
    );
  });

  it('procesa dos comandas de la misma empresa con caché de configuración', async () => {
    prisma.raw.ordenes.findMany.mockResolvedValue([
      { id: ORDEN_1, empresa_id: 'e1', cliente_id: CLIENTE, sucursal_id: 's1', total: '0' },
      { id: ORDEN_2, empresa_id: 'e1', cliente_id: CLIENTE, sucursal_id: 's1', total: '12.50' },
    ]);
    prisma.raw.clientes.findFirst.mockResolvedValue({ id: CLIENTE, empresa_id: 'e1' });
    prisma.raw.config_lealtad.findUnique.mockResolvedValue(null);
    prisma.raw.ordenes.count.mockResolvedValue(1);
    prisma.raw.clientes.updateMany.mockResolvedValue({ count: 1 });

    const resultado = await service.procesarConsumos();

    expect(prisma.raw.movimientos_puntos.create).toHaveBeenCalledTimes(1);
    expect(prisma.raw.config_lealtad.findUnique).toHaveBeenCalledTimes(2);
    expect(resultado).toEqual({ puntos: 12, clientes: 1 });
  });

  it('no falla el cron si el worker lanza', async () => {
    vi.spyOn(service, 'procesarConsumos').mockRejectedValue(new Error('boom'));
    await expect(service.consumosCron()).resolves.toBeUndefined();
  });

  it('exige empresa en el token', async () => {
    const sinEmpresa = new CrmService(
      prisma as unknown as PrismaService,
      { get: () => ({}) } as unknown as TenantContextService,
      audit as unknown as AuditService,
    );
    await expect(
      sinEmpresa.adjustPoints(CLIENTE, { tipo: 'GANANCIA', puntos: 1 } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
