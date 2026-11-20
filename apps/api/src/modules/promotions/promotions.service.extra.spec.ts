import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromotionsService } from './promotions.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';
import type { AuditService } from '../audit/index.js';
import type { PricingPort } from '../pricing/index.js';

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

describe('PromotionsService (ramas restantes)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let audit: { record: ReturnType<typeof vi.fn> };
  let pricing: { resolvePrices: ReturnType<typeof vi.fn> };
  let service: PromotionsService;

  beforeEach(() => {
    prisma = buildPrisma();
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    pricing = {
      resolvePrices: vi.fn().mockResolvedValue({
        listaId: 'lista-1',
        precios: new Map([
          [PLATO, 20],
          [PLATO_B, 10],
        ]),
      }),
    };
    service = new PromotionsService(
      prisma as unknown as PrismaService,
      { get: () => context } as unknown as TenantContextService,
      audit as unknown as AuditService,
      pricing as unknown as PricingPort,
    );
  });

  it('updateCombo 404 si no existe', async () => {
    prisma.scoped.combos.findFirst.mockResolvedValue(null);
    await expect(service.updateCombo(COMBO, {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updateCombo reemplaza platos y valida anti-inflación', async () => {
    prisma.scoped.combos.findFirst.mockResolvedValue({
      id: COMBO,
      precio_fijo: '30.00',
      combos_platos: [{ plato_id: PLATO, cantidad: 1 }],
    });
    prisma.scoped.combos.update.mockResolvedValue({ id: COMBO, nombre: 'Combo', precio_fijo: '30.00' });

    const resultado = await service.updateCombo(COMBO, {
      nombre: 'Combo nuevo',
      descripcion: 'Para dos',
      precioFijo: 25,
      activo: false,
      platos: [
        { platoId: PLATO, cantidad: 1 },
        { platoId: PLATO_B, cantidad: 1 },
      ],
    });

    expect(resultado).toMatchObject({ id: COMBO });
    expect(prisma.scoped.combos.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: COMBO },
        data: expect.objectContaining({
          nombre: 'Combo nuevo',
          descripcion: 'Para dos',
          precio_fijo: 25,
          activo: false,
          combos_platos: expect.any(Object),
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'combo.actualizado' }),
    );
  });

  it('updateCombo sin platos ni precio no valida anti-inflación', async () => {
    prisma.scoped.combos.findFirst.mockResolvedValue({
      id: COMBO,
      precio_fijo: '30.00',
      combos_platos: [{ plato_id: PLATO, cantidad: 1 }],
    });
    prisma.scoped.combos.update.mockResolvedValue({ id: COMBO, nombre: 'Combo', precio_fijo: '30.00' });

    await service.updateCombo(COMBO, { activo: true });

    expect(pricing.resolvePrices).not.toHaveBeenCalled();
    expect(prisma.scoped.combos.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { activo: true } }),
    );
  });

  it('updateCombo rechaza un precio mayor a sus partes', async () => {
    prisma.scoped.combos.findFirst.mockResolvedValue({
      id: COMBO,
      precio_fijo: '30.00',
      combos_platos: [{ plato_id: PLATO, cantidad: 1 }],
    });
    await expect(service.updateCombo(COMBO, { precioFijo: 99 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('removeCombo 404 y baja lógica correcta', async () => {
    prisma.scoped.combos.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.removeCombo(COMBO)).rejects.toBeInstanceOf(NotFoundException);

    prisma.scoped.combos.updateMany.mockResolvedValue({ count: 1 });
    await expect(service.removeCombo(COMBO)).resolves.toEqual({ id: COMBO, eliminado: true });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'combo.baja' }),
    );
  });

  it('createCoupon rechaza porcentajes mayores a 100', async () => {
    await expect(
      service.createCoupon({
        codigo: 'MEGA',
        tipoDescuento: 'PORCENTAJE',
        valor: 150,
        limiteUsos: 10,
        vencimiento: '2026-12-31',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createCoupon traduce el código duplicado y audita el alta', async () => {
    prisma.scoped.cupones.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.createCoupon({
        codigo: 'VERANO',
        tipoDescuento: 'MONTO',
        valor: 5,
        limiteUsos: 10,
        vencimiento: '2026-12-31',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    prisma.scoped.cupones.create.mockResolvedValue({
      id: 'cp-1',
      codigo: 'VERANO',
      tipo_descuento: 'MONTO',
      valor: '5.00',
      limite_usos: 10,
    });
    await service.createCoupon({
      codigo: 'verano',
      tipoDescuento: 'MONTO',
      valor: 5,
      limiteUsos: 10,
      vencimiento: '2026-12-31',
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'cupon.creado', entidadId: 'cp-1' }),
    );
  });

  it('updateCoupon 404 y actualización con todos los campos', async () => {
    prisma.scoped.cupones.findFirst.mockResolvedValue(null);
    await expect(service.updateCoupon('cp-1', {})).rejects.toBeInstanceOf(NotFoundException);

    prisma.scoped.cupones.findFirst.mockResolvedValue({ id: 'cp-1', codigo: 'VERANO' });
    prisma.scoped.cupones.update.mockResolvedValue({ id: 'cp-1' });
    await service.updateCoupon('cp-1', {
      valor: 8,
      limiteUsos: 20,
      vencimiento: '2026-12-31',
      activo: false,
    });
    expect(prisma.scoped.cupones.update).toHaveBeenCalledWith({
      where: { id: 'cp-1' },
      data: expect.objectContaining({
        valor: 8,
        limite_usos: 20,
        vencimiento: expect.any(Date),
        activo: false,
      }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'cupon.actualizado' }),
    );
  });

  it('removeCoupon 404 y baja lógica correcta', async () => {
    prisma.scoped.cupones.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.removeCoupon('cp-1')).rejects.toBeInstanceOf(NotFoundException);

    prisma.scoped.cupones.updateMany.mockResolvedValue({ count: 1 });
    await expect(service.removeCoupon('cp-1')).resolves.toEqual({
      id: 'cp-1',
      eliminado: true,
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'cupon.baja' }),
    );
  });

  it('validateCoupon informa cupón inexistente o inválido sin lanzar', async () => {
    prisma.scoped.cupones.findFirst.mockResolvedValue(null);
    await expect(service.validateCoupon('nope', 100)).resolves.toEqual({
      valido: false,
      motivo: 'El cupón no existe',
      descuento: 0,
    });

    prisma.scoped.cupones.findFirst.mockResolvedValue({
      codigo: 'OFF',
      tipo_descuento: 'PORCENTAJE',
      valor: '10',
      limite_usos: 10,
      usos_actuales: 0,
      vencimiento: new Date('2020-01-01T00:00:00.000Z'),
      activo: true,
    });
    const vencido = await service.validateCoupon('off', 100);
    expect(vencido.valido).toBe(false);
    expect(vencido.motivo).toBeTruthy();
  });

  it('validateCoupon calcula porcentaje y monto', async () => {
    prisma.scoped.cupones.findFirst.mockResolvedValue({
      codigo: 'DIEZ',
      tipo_descuento: 'PORCENTAJE',
      valor: '10',
      limite_usos: 10,
      usos_actuales: 2,
      vencimiento: new Date('2099-01-01T00:00:00.000Z'),
      activo: true,
    });
    await expect(service.validateCoupon(' diez ', 100)).resolves.toMatchObject({
      valido: true,
      descuento: 10,
      cupon: { codigo: 'DIEZ', usosRestantes: 8 },
    });

    prisma.scoped.cupones.findFirst.mockResolvedValue({
      codigo: 'MENOS5',
      tipo_descuento: 'MONTO',
      valor: '5',
      limite_usos: 10,
      usos_actuales: 0,
      vencimiento: new Date('2099-01-01T00:00:00.000Z'),
      activo: true,
    });
    await expect(service.validateCoupon('MENOS5', 100)).resolves.toMatchObject({
      descuento: 5,
    });
  });

  it('schedule marca si la regla aplica ahora', async () => {
    prisma.scoped.reglas_horarias_promos.findMany.mockResolvedValue([
      {
        id: 'r-1',
        nombre: 'Happy hour',
        dias_semana: [1, 2, 3, 4, 5, 6, 7],
        hora_inicio: new Date('1970-01-01T00:00:00.000Z'),
        hora_fin: new Date('1970-01-01T23:59:00.000Z'),
      },
      {
        id: 'r-2',
        nombre: 'Madrugada',
        dias_semana: [],
        hora_inicio: new Date('1970-01-01T00:00:00.000Z'),
        hora_fin: new Date('1970-01-01T01:00:00.000Z'),
      },
    ]);

    const reglas = await service.schedule();
    expect(reglas).toHaveLength(2);
    expect(reglas[0].aplicaAhora).toBe(true);
    expect(reglas[1].aplicaAhora).toBe(false);
  });
});
