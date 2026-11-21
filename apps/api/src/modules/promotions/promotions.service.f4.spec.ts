import { BadRequestException, ConflictException } from '@nestjs/common';
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
const COMBO = '22222222-2222-4222-8222-222222222222';
const CUPON = '33333333-3333-4333-8333-333333333333';

function buildPrisma() {
  return {
    scoped: {
      combos: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: COMBO }),
        updateMany: vi.fn(),
      },
      combos_platos: { findMany: vi.fn().mockResolvedValue([]) },
      platos: { count: vi.fn().mockResolvedValue(1) },
      cupones: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: CUPON }),
        updateMany: vi.fn(),
      },
      canjes_cupones: { create: vi.fn() },
      reglas_horarias_promos: { findMany: vi.fn().mockResolvedValue([]) },
    },
  };
}

describe('PromotionsService (f4: referencias y cupones)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let pricing: { resolvePrices: ReturnType<typeof vi.fn> };
  let service: PromotionsService;

  beforeEach(() => {
    prisma = buildPrisma();
    pricing = {
      resolvePrices: vi.fn().mockResolvedValue({
        listaId: 'l-1',
        precios: new Map([[PLATO, 20]]),
      }),
    };
    service = new PromotionsService(
      prisma as unknown as PrismaService,
      { get: () => context } as unknown as TenantContextService,
      { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService,
      pricing as unknown as PricingPort,
    );
  });

  it('marca referencia y ahorro nulos sin precios completos', async () => {
    prisma.scoped.combos.findMany.mockResolvedValue([
      {
        id: COMBO,
        precio_fijo: '25',
        combos_platos: [{ plato_id: PLATO, cantidad: 1 }],
      },
    ]);
    pricing.resolvePrices.mockResolvedValueOnce({ listaId: null, precios: new Map() });
    const sinLista = await service.listCombos();
    expect(sinLista[0]).toMatchObject({ precioReferencia: null, ahorro: null });

    pricing.resolvePrices.mockResolvedValueOnce({
      listaId: 'l-1',
      precios: new Map([[PLATO, 20]]),
    });
    const conPrecio = await service.listCombos();
    expect(conPrecio[0]).toMatchObject({ precioReferencia: 20, ahorro: -5 });
  });

  it('traduce nombre duplicado de combo y re-lanza otros errores', async () => {
    prisma.scoped.combos.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.createCombo({ nombre: 'Dúo', platos: [{ platoId: PLATO, cantidad: 1 }] } as never),
    ).rejects.toBeInstanceOf(ConflictException);

    prisma.scoped.combos.create.mockRejectedValue(new Error('db caída'));
    await expect(
      service.createCombo({ nombre: 'Dúo', platos: [{ platoId: PLATO, cantidad: 1 }] } as never),
    ).rejects.toThrow('db caída');
  });

  it('actualiza solo el estado sin recalcular la referencia', async () => {
    prisma.scoped.combos.findFirst.mockResolvedValue({
      id: COMBO,
      precio_fijo: '25',
      combos_platos: [],
    });
    await service.updateCombo(COMBO, { activo: false } as never);
    expect(prisma.scoped.combos.update).toHaveBeenCalledWith({
      where: { id: COMBO },
      data: { activo: false },
      include: expect.any(Object),
    });
  });

  it('lista cupones con activo explícito o sin filtro', async () => {
    await service.listCoupons({ activo: true, page: 1, limit: 10 } as never);
    expect(prisma.scoped.cupones.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { deleted_at: null, activo: true } }),
    );
    await service.listCoupons({ page: 1, limit: 10 } as never);
    expect(prisma.scoped.cupones.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { deleted_at: null } }),
    );
  });

  it('traduce código duplicado, actualiza parcial y resuelve un cupón', async () => {
    prisma.scoped.cupones.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.createCoupon({
        codigo: 'b10',
        tipoDescuento: 'PORCENTAJE',
        valor: 10,
        limiteUsos: 10,
        vencimiento: '2026-12-31',
      } as never),
    ).rejects.toBeInstanceOf(ConflictException);

    prisma.scoped.cupones.findFirst.mockResolvedValue({ id: CUPON, deleted_at: null });
    await service.updateCoupon(CUPON, { activo: false, vencimiento: '2026-12-31' } as never);
    expect(prisma.scoped.cupones.update).toHaveBeenCalledWith({
      where: { id: CUPON },
      data: { vencimiento: new Date('2026-12-31T00:00:00-05:00'), activo: false },
    });

    prisma.scoped.cupones.findFirst.mockResolvedValue({
      id: CUPON,
      codigo: 'B10',
      tipo_descuento: 'PORCENTAJE',
      valor: '10',
      usos_actuales: 0,
      limite_usos: 10,
      vencimiento: new Date('2027-12-31T00:00:00-05:00'),
      activo: true,
      deleted_at: null,
    });
    prisma.scoped.cupones.updateMany.mockResolvedValue({ count: 1 });
    const cupon = await service.resolverCupon(' b10 ', 100);
    expect(cupon).toMatchObject({ codigo: 'B10', descuento: 10 });
  });

  it('rechaza cupón inexistente, sin descuento o sin usos', async () => {
    prisma.scoped.cupones.findFirst.mockResolvedValue(null);
    await expect(service.resolverCupon('X', 100)).rejects.toBeInstanceOf(BadRequestException);

    prisma.scoped.cupones.findFirst.mockResolvedValue({
      id: CUPON,
      codigo: 'X',
      tipo_descuento: 'MONTO_FIJO',
      valor: '0',
      usos_actuales: 0,
      limite_usos: 10,
      vencimiento: new Date('2027-12-31T00:00:00-05:00'),
      activo: true,
      deleted_at: null,
    });
    await expect(service.resolverCupon('X', 100)).rejects.toBeInstanceOf(BadRequestException);

    prisma.scoped.cupones.findFirst.mockResolvedValue({
      id: CUPON,
      codigo: 'X',
      tipo_descuento: 'PORCENTAJE',
      valor: '10',
      usos_actuales: 0,
      limite_usos: 10,
      vencimiento: new Date('2027-12-31T00:00:00-05:00'),
      activo: true,
      deleted_at: null,
    });
    prisma.scoped.cupones.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.resolverCupon('X', 100)).rejects.toBeInstanceOf(ConflictException);
  });
});
