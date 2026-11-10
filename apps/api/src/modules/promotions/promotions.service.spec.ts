import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromotionsService } from './promotions.service.js';
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

const PLATO = '11111111-1111-4111-8111-111111111111';
const PLATO_B = '22222222-2222-4222-8222-222222222222';
const COMBO = '33333333-3333-4333-8333-333333333333';

function buildPrisma() {
  return {
    scoped: {
      combos: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      combos_platos: { findMany: vi.fn().mockResolvedValue([]) },
      platos: { count: vi.fn().mockResolvedValue(2) },
      listas_precios: { findFirst: vi.fn().mockResolvedValue({ id: 'lista-1' }) },
      precios_platos: { findMany: vi.fn().mockResolvedValue([]) },
      cupones: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      canjes_cupones: { create: vi.fn() },
      reglas_horarias_promos: { findMany: vi.fn().mockResolvedValue([]) },
    },
  };
}

describe('PromotionsService (AYCDS-19)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let audit: { record: ReturnType<typeof vi.fn> };

  function buildService() {
    return new PromotionsService(
      prisma as unknown as PrismaService,
      { get: () => context } as unknown as TenantContextService,
      audit as unknown as AuditService,
    );
  }

  beforeEach(() => {
    prisma = buildPrisma();
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    vi.clearAllMocks();
    prisma.scoped.platos.count.mockResolvedValue(2);
    prisma.scoped.listas_precios.findFirst.mockResolvedValue({ id: 'lista-1' });
    prisma.scoped.precios_platos.findMany.mockResolvedValue([]);
    prisma.scoped.combos.findMany.mockResolvedValue([]);
    prisma.scoped.combos_platos.findMany.mockResolvedValue([]);
    prisma.scoped.cupones.findMany.mockResolvedValue([]);
    prisma.scoped.cupones.count.mockResolvedValue(0);
    prisma.scoped.reglas_horarias_promos.findMany.mockResolvedValue([]);
  });

  describe('combos', () => {
    const comboDto = {
      nombre: 'Combo parrillero',
      precioFijo: 45,
      platos: [
        { platoId: PLATO, cantidad: 1 },
        { platoId: PLATO_B, cantidad: 1 },
      ],
    };

    it('rechaza un combo más caro que sus partes (anti-inflación)', async () => {
      prisma.scoped.precios_platos.findMany.mockResolvedValue([
        { plato_id: PLATO, precio: '20' },
        { plato_id: PLATO_B, precio: '10' },
      ]);
      const service = buildService();

      await expect(
        service.createCombo({ ...comboDto, precioFijo: 40 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.scoped.combos.create).not.toHaveBeenCalled();
    });

    it('acepta un combo más barato que sus partes', async () => {
      prisma.scoped.precios_platos.findMany.mockResolvedValue([
        { plato_id: PLATO, precio: '20' },
        { plato_id: PLATO_B, precio: '15' },
      ]);
      prisma.scoped.combos.create.mockResolvedValue({ id: COMBO });
      const service = buildService();

      await service.createCombo({ ...comboDto, precioFijo: 30 });

      expect(prisma.scoped.combos.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            precio_fijo: 30,
            combos_platos: {
              create: [
                { plato_id: PLATO, cantidad: 1 },
                { plato_id: PLATO_B, cantidad: 1 },
              ],
            },
          }),
        }),
      );
    });

    it('no valida el precio si la lista no tiene precios de los platos', async () => {
      prisma.scoped.precios_platos.findMany.mockResolvedValue([
        { plato_id: PLATO, precio: '20' },
      ]);
      prisma.scoped.combos.create.mockResolvedValue({ id: COMBO });
      const service = buildService();

      await service.createCombo({ ...comboDto, precioFijo: 999 });

      expect(prisma.scoped.combos.create).toHaveBeenCalled();
    });

    it('rechaza un plato que no es del catálogo', async () => {
      prisma.scoped.platos.count.mockResolvedValue(1);
      const service = buildService();

      await expect(service.createCombo(comboDto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rechaza un nombre de combo repetido', async () => {
      prisma.scoped.combos.create.mockRejectedValue({ code: 'P2002' });
      const service = buildService();

      await expect(service.createCombo(comboDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('calcula el ahorro al listar', async () => {
      prisma.scoped.combos.findMany.mockResolvedValue([
        {
          id: COMBO,
          nombre: 'Combo',
          precio_fijo: '30',
          combos_platos: [
            { plato_id: PLATO, cantidad: 1, platos: { id: PLATO, nombre: 'Lomo' } },
          ],
        },
      ]);
      prisma.scoped.precios_platos.findMany.mockResolvedValue([
        { plato_id: PLATO, precio: '45' },
      ]);
      const service = buildService();

      const [combo] = await service.listCombos();

      expect(combo).toMatchObject({ precioReferencia: 45, ahorro: 15 });
    });
  });

  describe('cupones', () => {
    const cuponBase = {
      id: 'cup-1',
      codigo: 'VERANO20',
      tipo_descuento: 'PORCENTAJE' as const,
      valor: '20',
      limite_usos: 10,
      usos_actuales: 0,
      activo: true,
      vencimiento: new Date('2026-12-31T00:00:00.000Z'),
      deleted_at: null,
    };

    it('valida un cupón y calcula el descuento', async () => {
      prisma.scoped.cupones.findFirst.mockResolvedValue(cuponBase);
      const service = buildService();

      const result = await service.validateCoupon('verano20', 100);

      expect(result).toMatchObject({ valido: true, descuento: 20 });
      expect(prisma.scoped.cupones.findFirst).toHaveBeenCalledWith({
        where: { codigo: 'VERANO20', deleted_at: null },
      });
    });

    it('devuelve el motivo cuando el cupón no existe', async () => {
      prisma.scoped.cupones.findFirst.mockResolvedValue(null);
      const service = buildService();

      expect(await service.validateCoupon('NOPE', 100)).toMatchObject({
        valido: false,
        motivo: 'El cupón no existe',
      });
    });

    it('rechaza un porcentaje mayor a 100', async () => {
      const service = buildService();

      await expect(
        service.createCoupon({
          codigo: 'MALO',
          tipoDescuento: 'PORCENTAJE',
          valor: 150,
          limiteUsos: 1,
          vencimiento: '2026-12-31',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza un código repetido', async () => {
      prisma.scoped.cupones.create.mockRejectedValue({ code: 'P2002' });
      const service = buildService();

      await expect(
        service.createCoupon({
          codigo: 'VERANO20',
          tipoDescuento: 'MONTO',
          valor: 10,
          limiteUsos: 5,
          vencimiento: '2026-12-31',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('consume un uso al resolver el cupón de una comanda', async () => {
      prisma.scoped.cupones.findFirst.mockResolvedValue(cuponBase);
      prisma.scoped.cupones.updateMany.mockResolvedValue({ count: 1 });
      const service = buildService();

      const cupon = await service.resolverCupon('VERANO20', 50);

      expect(cupon).toMatchObject({ id: 'cup-1', descuento: 10, usosActuales: 1 });
      expect(prisma.scoped.cupones.updateMany).toHaveBeenCalledWith({
        where: { id: 'cup-1', usos_actuales: 0 },
        data: { usos_actuales: { increment: 1 } },
      });
    });

    it('avisa si el cupón se agotó en la carrera', async () => {
      prisma.scoped.cupones.findFirst.mockResolvedValue(cuponBase);
      prisma.scoped.cupones.updateMany.mockResolvedValue({ count: 0 });
      const service = buildService();

      await expect(service.resolverCupon('VERANO20', 50)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rechaza un cupón vencido al resolver', async () => {
      prisma.scoped.cupones.findFirst.mockResolvedValue({
        ...cuponBase,
        vencimiento: new Date('2020-01-01T00:00:00.000Z'),
      });
      const service = buildService();

      await expect(service.resolverCupon('VERANO20', 50)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('registra el canje con la orden y el monto descontado', async () => {
      const service = buildService();

      await service.registrarCanje(
        { id: 'cup-1', codigo: 'VERANO20', descuento: 12, usosActuales: 1, limiteUsos: 10 },
        { id: 'o-1', empresaId: 'e1', sucursalId: 's1' },
        'u1',
      );

      expect(prisma.scoped.canjes_cupones.create).toHaveBeenCalledWith({
        data: {
          cupon_id: 'cup-1',
          orden_id: 'o-1',
          empresa_id: 'e1',
          sucursal_id: 's1',
          monto_descontado: 12,
          aplicado_por: 'u1',
        },
      });
    });
  });
});
