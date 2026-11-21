import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryService } from './inventory.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';
import type { AuditService } from '../audit/audit.service.js';

const context = {
  userId: 'u1' as string | null,
  empresaId: 'e1',
  sucursalId: 's1',
  rol: 'COCINERO' as const,
  bypass: false,
};
const ORDEN = '11111111-1111-4111-8111-111111111111';
const PLATO = '22222222-2222-4222-8222-222222222222';
const COMBO = '44444444-4444-4444-8444-444444444444';
const INSUMO = '55555555-5555-4555-8555-555555555555';

function buildPrisma() {
  return {
    scoped: {
      ordenes: { findFirst: vi.fn() },
      movimientos_inventario: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: 'mov-1' }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      escandallos_recetas: { findMany: vi.fn().mockResolvedValue([]) },
      combos_platos: { findMany: vi.fn().mockResolvedValue([]) },
      stocks_sucursal: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn().mockResolvedValue({ cantidad: 10 }),
      },
    },
  };
}

describe('InventoryService (f4: bordes de kardex)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: InventoryService;

  beforeEach(() => {
    prisma = buildPrisma();
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    service = new InventoryService(
      prisma as unknown as PrismaService,
      { get: () => context } as unknown as TenantContextService,
      audit as unknown as AuditService,
    );
  });

  function ordenCon(lineas: Record<string, unknown>[]) {
    return {
      id: ORDEN,
      numero_orden: 'ORD-1',
      empresa_id: 'e1',
      sucursal_id: 's1',
      detalles_orden: lineas,
    };
  }

  it('no descuenta un combo sin componentes', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue(
      ordenCon([{ tipo: 'COMBO', combo_id: COMBO, cantidad: 1 }]),
    );
    prisma.scoped.combos_platos.findMany.mockResolvedValue([]);

    const resultado = await service.consumeOrder(ORDEN);

    expect(resultado).toMatchObject({ aplicado: false, insumos: 0 });
    expect(prisma.scoped.escandallos_recetas.findMany).not.toHaveBeenCalled();
  });

  it('usa el userId del contexto cuando no llega actor', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue(
      ordenCon([{ tipo: 'PLATO', plato_id: PLATO, cantidad: 1 }]),
    );
    prisma.scoped.escandallos_recetas.findMany.mockResolvedValue([
      { plato_id: PLATO, insumo_id: INSUMO, cantidad_por_plato: '2' },
    ]);

    await service.consumeOrder(ORDEN, null);

    expect(prisma.scoped.movimientos_inventario.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ actor_id: 'u1' }) }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: 'u1' }),
    );
  });

  it('re-lanza errores que no son P2002 al crear stock', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue(
      ordenCon([{ tipo: 'PLATO', plato_id: PLATO, cantidad: 1 }]),
    );
    prisma.scoped.escandallos_recetas.findMany.mockResolvedValue([
      { plato_id: PLATO, insumo_id: INSUMO, cantidad_por_plato: '1' },
    ]);
    prisma.scoped.stocks_sucursal.findFirst.mockResolvedValue(null);
    prisma.scoped.stocks_sucursal.create.mockRejectedValue(null);
    await expect(service.consumeOrder(ORDEN)).rejects.toBeNull();

    prisma.scoped.stocks_sucursal.create.mockRejectedValue('boom');
    await expect(service.consumeOrder(ORDEN)).rejects.toBe('boom');
  });

  it('reintenta si otra comanda creó el stock primero', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue(
      ordenCon([{ tipo: 'PLATO', plato_id: PLATO, cantidad: 1 }]),
    );
    prisma.scoped.escandallos_recetas.findMany.mockResolvedValue([
      { plato_id: PLATO, insumo_id: INSUMO, cantidad_por_plato: '1' },
    ]);
    prisma.scoped.stocks_sucursal.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ cantidad: 2 });
    prisma.scoped.stocks_sucursal.create.mockRejectedValue({ code: 'P2002' });
    prisma.scoped.stocks_sucursal.updateMany.mockResolvedValue({ count: 1 });

    const resultado = await service.consumeOrder(ORDEN);
    expect(resultado.aplicado).toBe(true);
  });

  it('agota los reintentos de concurrencia optimista', async () => {
    prisma.scoped.ordenes.findFirst.mockResolvedValue(
      ordenCon([{ tipo: 'PLATO', plato_id: PLATO, cantidad: 1 }]),
    );
    prisma.scoped.escandallos_recetas.findMany.mockResolvedValue([
      { plato_id: PLATO, insumo_id: INSUMO, cantidad_por_plato: '1' },
    ]);
    prisma.scoped.stocks_sucursal.findFirst.mockResolvedValue({ cantidad: 5 });
    prisma.scoped.stocks_sucursal.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.consumeOrder(ORDEN)).rejects.toThrow(/reintentos agotados/);
    expect(prisma.scoped.stocks_sucursal.updateMany).toHaveBeenCalledTimes(3);
  });

  it('mapea el kardex con insumo y orden nulos', async () => {
    const admin = new InventoryService(
      prisma as unknown as PrismaService,
      { get: () => ({ ...context, sucursalId: null }) } as unknown as TenantContextService,
      audit as unknown as AuditService,
    );
    prisma.scoped.movimientos_inventario.findMany.mockResolvedValue([
      {
        id: 'm-1',
        created_at: new Date('2026-11-20T10:00:00.000Z'),
        tipo: 'AJUSTE',
        insumo_id: INSUMO,
        insumos: null,
        cantidad: null,
        stock_resultante: null,
        motivo: null,
        ordenes: null,
      },
    ]);

    const lista = await admin.listMovements({ limit: 10 } as never);

    expect(lista.items[0]).toMatchObject({
      insumo: '',
      unidad: '',
      cantidad: 0,
      stockResultante: null,
      orden: null,
    });
  });
});
