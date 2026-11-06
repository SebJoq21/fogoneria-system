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
const ORDEN = '22222222-2222-4222-8222-222222222222';

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
        create: vi.fn(),
      },
      ordenes: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      config_lealtad: { upsert: vi.fn() },
    },
    raw: {
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
        create: vi.fn(),
      },
      ordenes: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      config_lealtad: { findUnique: vi.fn().mockResolvedValue(null) },
    },
  };
}

describe('CrmService (AYCDS-31)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let audit: { record: ReturnType<typeof vi.fn> };

  function buildService(tenant: Record<string, unknown> = context) {
    return new CrmService(
      prisma as unknown as PrismaService,
      { get: () => tenant } as unknown as TenantContextService,
      audit as unknown as AuditService,
    );
  }

  beforeEach(() => {
    prisma = buildPrisma();
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    vi.clearAllMocks();
    prisma.scoped.clientes.findMany.mockResolvedValue([]);
    prisma.scoped.clientes.count.mockResolvedValue(0);
    prisma.scoped.clientes.updateMany.mockResolvedValue({ count: 1 });
    prisma.scoped.movimientos_puntos.findMany.mockResolvedValue([]);
    prisma.scoped.ordenes.findMany.mockResolvedValue([]);
    prisma.scoped.ordenes.count.mockResolvedValue(0);
    prisma.raw.config_lealtad.findUnique.mockResolvedValue(null);
    prisma.raw.movimientos_puntos.findMany.mockResolvedValue([]);
    prisma.raw.ordenes.findMany.mockResolvedValue([]);
  });

  describe('clientes', () => {
    it('crea un cliente con nombre y teléfono normalizados', async () => {
      prisma.scoped.clientes.create.mockResolvedValue({
        id: CLIENTE,
        nombre: 'Ana',
        telefono: '987654321',
      });
      const service = buildService();

      await service.createCustomer({ nombre: '  Ana  ', telefono: ' 987654321 ' });

      expect(prisma.scoped.clientes.create).toHaveBeenCalledWith({
        data: { empresa_id: 'e1', nombre: 'Ana', telefono: '987654321' },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'cliente.creado' }),
      );
    });

    it('rechaza un teléfono repetido (409)', async () => {
      prisma.scoped.clientes.create.mockRejectedValue({ code: 'P2002' });
      const service = buildService();

      await expect(
        service.createCustomer({ nombre: 'Ana', telefono: '987654321' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('busca por nombre o teléfono', async () => {
      const service = buildService();

      await service.listCustomers({ page: 1, limit: 20, q: '987' });

      const arg = prisma.scoped.clientes.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(arg.where).toMatchObject({
        deleted_at: null,
        OR: [{ nombre: { contains: '987', mode: 'insensitive' } }, { telefono: { contains: '987' } }],
      });
    });
  });

  describe('puntos', () => {
    it('rechaza descontar más puntos de los que hay', async () => {
      prisma.scoped.clientes.findFirst.mockResolvedValue({ id: CLIENTE, puntos: 10 });
      const service = buildService();

      await expect(
        service.adjustPoints(CLIENTE, { tipo: 'CANJE', puntos: 20 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('registra el movimiento y recalcula el saldo', async () => {
      prisma.scoped.clientes.findFirst
        .mockResolvedValueOnce({ id: CLIENTE, puntos: 10 })
        .mockResolvedValueOnce({ id: CLIENTE, empresa_id: 'e1', puntos: 60 })
        .mockResolvedValueOnce({ id: CLIENTE, puntos: 60 });
      prisma.scoped.movimientos_puntos.findMany.mockResolvedValue([
        { tipo: 'GANANCIA', puntos: 50 },
        { tipo: 'CANJE', puntos: 10 },
      ]);
      const service = buildService();

      const resultado = await service.adjustPoints(CLIENTE, {
        tipo: 'GANANCIA',
        puntos: 50,
        motivo: 'Cortesía',
      });

      expect(prisma.scoped.movimientos_puntos.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cliente_id: CLIENTE,
          empresa_id: 'e1',
          sucursal_id: 's1',
          tipo: 'GANANCIA',
          puntos: 50,
        }),
      });
      expect(resultado).toMatchObject({ puntos: 60 });
    });

    it('exige sucursal en el token para ajustar puntos', async () => {
      prisma.scoped.clientes.findFirst.mockResolvedValue({ id: CLIENTE, puntos: 10 });
      const service = buildService({ ...context, sucursalId: null });

      await expect(
        service.adjustPoints(CLIENTE, { tipo: 'GANANCIA', puntos: 5 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('worker de consumos', () => {
    it('otorga puntos por cada comanda pagada sin movimiento', async () => {
      prisma.raw.ordenes.findMany.mockResolvedValue([
        { id: ORDEN, empresa_id: 'e1', cliente_id: CLIENTE, sucursal_id: 's1', total: '36.00' },
      ]);
      prisma.raw.movimientos_puntos.findMany.mockResolvedValue([]);
      prisma.raw.clientes.findFirst.mockResolvedValue({ id: CLIENTE, empresa_id: 'e1' });
      prisma.raw.ordenes.count.mockResolvedValue(1);
      prisma.raw.clientes.updateMany.mockResolvedValue({ count: 1 });
      const service = buildService();

      const result = await service.procesarConsumos();

      expect(prisma.raw.movimientos_puntos.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cliente_id: CLIENTE,
          tipo: 'GANANCIA',
          puntos: 36,
          orden_id: ORDEN,
        }),
      });
      expect(result).toEqual({ puntos: 36, clientes: 1 });
    });

    it('no vuelve a otorgar puntos de una comanda ya procesada', async () => {
      prisma.raw.ordenes.findMany.mockResolvedValue([
        { id: ORDEN, empresa_id: 'e1', cliente_id: CLIENTE, sucursal_id: 's1', total: '36.00' },
      ]);
      prisma.raw.movimientos_puntos.findMany.mockResolvedValue([{ orden_id: ORDEN }]);
      const service = buildService();

      const result = await service.procesarConsumos();

      expect(prisma.raw.movimientos_puntos.create).not.toHaveBeenCalled();
      expect(result).toEqual({ puntos: 0, clientes: 0 });
    });

    it('no procesa nada si no hay comandas pagadas con cliente', async () => {
      const service = buildService();

      const result = await service.procesarConsumos();

      expect(result).toEqual({ puntos: 0, clientes: 0 });
      expect(prisma.raw.movimientos_puntos.create).not.toHaveBeenCalled();
    });
  });

  describe('configuración', () => {
    it('devuelve los valores por defecto si la empresa no la tiene', async () => {
      const service = buildService();

      expect(await service.config()).toEqual({
        puntos_por_moneda: 1,
        caducidad_meses: 12,
        umbral_frecuente: 5,
        umbral_vip: 20,
      });
    });

    it('rechaza un umbral VIP menor que el de frecuente', async () => {
      const service = buildService();

      await expect(
        service.updateConfig({ umbralFrecuente: 10, umbralVip: 5 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  it('devuelve 404 si el cliente no existe', async () => {
    prisma.scoped.clientes.findFirst.mockResolvedValue(null);
    const service = buildService();

    await expect(service.getCustomer(CLIENTE)).rejects.toBeInstanceOf(NotFoundException);
  });
});
