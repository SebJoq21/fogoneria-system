import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryService } from './inventory.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';
import type { AuditService } from '../audit/audit.service.js';

const context = {
  userId: 'u1',
  empresaId: 'e1',
  sucursalId: 's1',
  rol: 'COCINERO' as const,
  bypass: false,
};

const ORDEN = '11111111-1111-4111-8111-111111111111';
const PLATO = '22222222-2222-4222-8222-222222222222';
const PLATO_B = '33333333-3333-4333-8333-333333333333';
const COMBO = '44444444-4444-4444-8444-444444444444';
const INSUMO = '55555555-5555-4555-8555-555555555555';
const INSUMO_B = '66666666-6666-4666-8666-666666666666';

function buildPrisma() {
  return {
    scoped: {
      ordenes: { findFirst: vi.fn() },
      movimientos_inventario: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: 'mov-1' }),
      },
      escandallos_recetas: { findMany: vi.fn().mockResolvedValue([]) },
      combos_platos: { findMany: vi.fn().mockResolvedValue([]) },
      stocks_sucursal: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn().mockResolvedValue({ cantidad: 9 }),
      },
    },
  };
}

describe('InventoryService (AYCDS-11)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let audit: { record: ReturnType<typeof vi.fn> };

  function buildService(tenant: Record<string, unknown> = context) {
    return new InventoryService(
      prisma as unknown as PrismaService,
      { get: () => tenant } as unknown as TenantContextService,
      audit as unknown as AuditService,
    );
  }

  function ordenCon(lineas: Record<string, unknown>[]) {
    return {
      id: ORDEN,
      numero_orden: 'ORD-000010',
      empresa_id: 'e1',
      sucursal_id: 's1',
      detalles_orden: lineas,
    };
  }

  beforeEach(() => {
    prisma = buildPrisma();
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    vi.clearAllMocks();
    prisma.scoped.movimientos_inventario.count.mockResolvedValue(0);
    prisma.scoped.escandallos_recetas.findMany.mockResolvedValue([]);
    prisma.scoped.combos_platos.findMany.mockResolvedValue([]);
    prisma.scoped.stocks_sucursal.updateMany.mockResolvedValue({ count: 1 });
    prisma.scoped.stocks_sucursal.findFirst.mockResolvedValue({ cantidad: 10 });
  });

  it('descuenta la receta por la cantidad pedida', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue(
      ordenCon([{ tipo: 'PLATO', plato_id: PLATO, combo_id: null, cantidad: 2 }]),
    );
    prisma.scoped.escandallos_recetas.findMany.mockResolvedValue([
      { plato_id: PLATO, insumo_id: INSUMO, cantidad_por_plato: '0.25' },
    ]);
    const service = buildService();

    const result = await service.consumeOrder(ORDEN, 'u1');

    expect(prisma.scoped.stocks_sucursal.updateMany).toHaveBeenCalledWith({
      where: { sucursal_id: 's1', insumo_id: INSUMO, cantidad: 10 },
      data: { cantidad: 9.5, updated_at: expect.any(Date) },
    });
    expect(prisma.scoped.movimientos_inventario.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: 'SALIDA',
        cantidad: 0.5,
        orden_id: ORDEN,
        motivo: 'Consumo ORD-000010',
        stock_resultante: 9.5,
      }),
    });
    expect(result).toMatchObject({ aplicado: true, insumos: 1, lineas: 1 });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'kardex.consumo' }),
    );
  });

  it('agrega varios platos que comparten insumo', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue(
      ordenCon([
        { tipo: 'PLATO', plato_id: PLATO, combo_id: null, cantidad: 1 },
        { tipo: 'PLATO', plato_id: PLATO_B, combo_id: null, cantidad: 1 },
      ]),
    );
    prisma.scoped.escandallos_recetas.findMany.mockResolvedValue([
      { plato_id: PLATO, insumo_id: INSUMO, cantidad_por_plato: '0.2' },
      { plato_id: PLATO_B, insumo_id: INSUMO, cantidad_por_plato: '0.3' },
    ]);
    const service = buildService();

    await service.consumeOrder(ORDEN);

    expect(prisma.scoped.stocks_sucursal.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.scoped.stocks_sucursal.updateMany).toHaveBeenCalledWith({
      where: { sucursal_id: 's1', insumo_id: INSUMO, cantidad: 10 },
      data: { cantidad: 9.5, updated_at: expect.any(Date) },
    });
  });

  it('expande el combo a sus platos antes de explotar la receta', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue(
      ordenCon([{ tipo: 'COMBO', plato_id: null, combo_id: COMBO, cantidad: 2 }]),
    );
    prisma.scoped.combos_platos.findMany.mockResolvedValue([
      { combo_id: COMBO, plato_id: PLATO, cantidad: 1 },
      { combo_id: COMBO, plato_id: PLATO_B, cantidad: 2 },
    ]);
    prisma.scoped.escandallos_recetas.findMany.mockResolvedValue([
      { plato_id: PLATO, insumo_id: INSUMO, cantidad_por_plato: '0.1' },
      { plato_id: PLATO_B, insumo_id: INSUMO_B, cantidad_por_plato: '0.05' },
    ]);
    const service = buildService();

    const result = await service.consumeOrder(ORDEN);

    // 2 combos: PLATO 2×1×0.1 = 0.2; PLATO_B 2×2×0.05 = 0.2.
    expect(prisma.scoped.stocks_sucursal.updateMany).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ aplicado: true, insumos: 2 });
  });

  it('no vuelve a consumir una orden que ya tiene salida', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue(
      ordenCon([{ tipo: 'PLATO', plato_id: PLATO, combo_id: null, cantidad: 1 }]),
    );
    prisma.scoped.movimientos_inventario.count.mockResolvedValue(1);
    const service = buildService();

    const result = await service.consumeOrder(ORDEN);

    expect(result.aplicado).toBe(false);
    expect(prisma.scoped.movimientos_inventario.create).not.toHaveBeenCalled();
  });

  it('omite los platos sin escandallo y lo reporta', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue(
      ordenCon([
        { tipo: 'PLATO', plato_id: PLATO, combo_id: null, cantidad: 1 },
        { tipo: 'PLATO', plato_id: PLATO_B, combo_id: null, cantidad: 1 },
      ]),
    );
    prisma.scoped.escandallos_recetas.findMany.mockResolvedValue([
      { plato_id: PLATO, insumo_id: INSUMO, cantidad_por_plato: '0.4' },
    ]);
    const service = buildService();

    const result = await service.consumeOrder(ORDEN);

    expect(result.sinReceta).toEqual([PLATO_B]);
    expect(prisma.scoped.stocks_sucursal.updateMany).toHaveBeenCalledTimes(1);
  });

  it('no falla si ningún plato tiene receta', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue(
      ordenCon([{ tipo: 'PLATO', plato_id: PLATO, combo_id: null, cantidad: 3 }]),
    );
    const service = buildService();

    const result = await service.consumeOrder(ORDEN);

    expect(result).toMatchObject({ aplicado: false, insumos: 0, sinReceta: [PLATO] });
    expect(prisma.scoped.movimientos_inventario.create).not.toHaveBeenCalled();
  });

  it('crea la fila de stock en cero si la sucursal no la tenía', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue(
      ordenCon([{ tipo: 'PLATO', plato_id: PLATO, combo_id: null, cantidad: 1 }]),
    );
    prisma.scoped.escandallos_recetas.findMany.mockResolvedValue([
      { plato_id: PLATO, insumo_id: INSUMO, cantidad_por_plato: '1.5' },
    ]);
    prisma.scoped.stocks_sucursal.findFirst.mockResolvedValue(null);
    const service = buildService();

    await service.consumeOrder(ORDEN);

    expect(prisma.scoped.stocks_sucursal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sucursal_id: 's1',
        insumo_id: INSUMO,
        cantidad: 0,
      }),
    });
    expect(prisma.scoped.movimientos_inventario.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ stock_resultante: 0 }),
    });
  });

  it('no baja de cero cuando la receta consume más de lo que hay', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue(
      ordenCon([{ tipo: 'PLATO', plato_id: PLATO, combo_id: null, cantidad: 4 }]),
    );
    prisma.scoped.escandallos_recetas.findMany.mockResolvedValue([
      { plato_id: PLATO, insumo_id: INSUMO, cantidad_por_plato: '1' },
    ]);
    prisma.scoped.stocks_sucursal.findFirst.mockResolvedValue({ cantidad: 2 });
    const service = buildService();

    await service.consumeOrder(ORDEN);

    // 4 consumidos sobre 2 disponibles: el stock queda en 0, no en -2.
    expect(prisma.scoped.stocks_sucursal.updateMany).toHaveBeenCalledWith({
      where: { sucursal_id: 's1', insumo_id: INSUMO, cantidad: 2 },
      data: { cantidad: 0, updated_at: expect.any(Date) },
    });
    expect(prisma.scoped.movimientos_inventario.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ cantidad: 4, stock_resultante: 0 }),
    });
  });

  it('devuelve 404 si la orden no existe en el tenant', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue(null);
    const service = buildService();

    await expect(service.consumeOrder('ajena')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
