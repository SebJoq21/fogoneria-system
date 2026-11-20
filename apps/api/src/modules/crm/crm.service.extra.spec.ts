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
      },
      config_lealtad: { upsert: vi.fn() },
      sucursales: { findFirst: vi.fn() },
    },
    raw: { config_lealtad: { findUnique: vi.fn().mockResolvedValue(null) } },
  };
}

describe('CrmService (ramas restantes)', () => {
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

  it('getCustomer 404 si no existe', async () => {
    prisma.scoped.clientes.findFirst.mockResolvedValue(null);
    await expect(service.getCustomer(CLIENTE)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('createCustomer traduce teléfono duplicado y audita el alta', async () => {
    prisma.scoped.clientes.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.createCustomer({ nombre: 'Ana', telefono: '987654321' }),
    ).rejects.toBeInstanceOf(ConflictException);

    prisma.scoped.clientes.create.mockResolvedValue({
      id: CLIENTE,
      nombre: 'Ana',
      telefono: '987654321',
    });
    await service.createCustomer({ nombre: ' Ana ', telefono: ' 987654321 ' });
    expect(prisma.scoped.clientes.create).toHaveBeenCalledWith({
      data: { empresa_id: 'e1', nombre: 'Ana', telefono: '987654321' },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'cliente.creado', entidadId: CLIENTE }),
    );
  });

  it('updateCustomer 404, duplicado y éxito', async () => {
    prisma.scoped.clientes.findFirst.mockResolvedValue(null);
    await expect(service.updateCustomer(CLIENTE, {})).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.scoped.clientes.findFirst.mockResolvedValue({ id: CLIENTE });
    prisma.scoped.clientes.update.mockRejectedValue({ code: 'P2002' });
    await expect(service.updateCustomer(CLIENTE, { telefono: '987654321' })).rejects.toBeInstanceOf(
      ConflictException,
    );

    prisma.scoped.clientes.update.mockResolvedValue({
      id: CLIENTE,
      nombre: 'Ana',
      telefono: '987654321',
    });
    await service.updateCustomer(CLIENTE, { nombre: ' Ana ', telefono: '987654321' });
    expect(prisma.scoped.clientes.update).toHaveBeenCalledWith({
      where: { id: CLIENTE },
      data: { nombre: 'Ana', telefono: '987654321' },
    });
  });

  it('listPoints 404 y filtro por tipo con paginación', async () => {
    prisma.scoped.clientes.findFirst.mockResolvedValue(null);
    await expect(service.listPoints(CLIENTE, {} as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.scoped.clientes.findFirst.mockResolvedValue({ id: CLIENTE, puntos: 26 });
    prisma.scoped.movimientos_puntos.findMany.mockResolvedValue([{ id: 'm-1' }]);
    prisma.scoped.movimientos_puntos.count.mockResolvedValue(1);
    const lista = await service.listPoints(CLIENTE, {
      tipo: 'CANJE',
      page: 1,
      limit: 20,
    } as never);
    expect(lista).toMatchObject({ total: 1, puntos: 26 });
    expect(prisma.scoped.movimientos_puntos.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cliente_id: CLIENTE, tipo: 'CANJE' } }),
    );
  });

  it('config devuelve defaults y mapea la fila existente', async () => {
    await expect(service.config()).resolves.toMatchObject({ umbral_frecuente: 5, umbral_vip: 20 });

    prisma.raw.config_lealtad.findUnique.mockResolvedValue({
      puntos_por_moneda: '1.50',
      caducidad_meses: 12,
      umbral_frecuente: 4,
      umbral_vip: 15,
    });
    await expect(service.config()).resolves.toEqual({
      puntos_por_moneda: 1.5,
      caducidad_meses: 12,
      umbral_frecuente: 4,
      umbral_vip: 15,
    });
  });

  it('updateConfig rechaza VIP menor que frecuente', async () => {
    await expect(
      service.updateConfig({ umbralFrecuente: 10, umbralVip: 5 } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updateConfig guarda, audita y devuelve la configuración', async () => {
    prisma.scoped.config_lealtad.upsert.mockResolvedValue({});
    await service.updateConfig({
      puntosPorMoneda: 2,
      caducidadMeses: 6,
      umbralFrecuente: 3,
      umbralVip: 10,
    } as never);
    expect(prisma.scoped.config_lealtad.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { empresa_id: 'e1' },
        update: expect.objectContaining({ umbral_vip: 10 }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'crm.config', entidadId: 'e1' }),
    );
  });

  it('exige empresa en el token', async () => {
    const sinEmpresa = new CrmService(
      prisma as unknown as PrismaService,
      { get: () => ({}) } as unknown as TenantContextService,
      audit as unknown as AuditService,
    );
    await expect(sinEmpresa.createCustomer({ nombre: 'Ana', telefono: '987654321' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
