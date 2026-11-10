import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { TenantContextService } from '../../src/common/context/tenant-context.service.js';
import type { PrismaService } from '../../src/prisma/prisma.service.js';
import { BiService } from '../../src/modules/bi/bi.service.js';
import {
  asTenant,
  createDb,
  createTenant,
  hasTestDatabase,
  prepareRlsRole,
  resetDatabase,
  type TenantFixture,
} from './helpers.js';

const describeDb = hasTestDatabase ? describe : describe.skip;

describeDb('BI por HTTP contra las vistas (AYCDS-35)', () => {
  let db: PrismaClient;
  let tenant: TenantFixture;

  beforeAll(async () => {
    db = createDb();
    await prepareRlsRole(db);
  });

  beforeEach(async () => {
    await resetDatabase(db);
    tenant = await createTenant(db, 'BI-API');
  });

  afterAll(async () => {
    await resetDatabase(db).catch(() => undefined);
    await db.$disconnect();
  });

  async function ordenCobrada(
    total: number,
    opciones: { propina?: number; platoId?: string; cantidad?: number; createdAt?: string } = {},
  ): Promise<void> {
    const createdAt = opciones.createdAt ?? '2026-11-06T18:00:00.000Z';
    const [fila] = await db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO fogoneria.ordenes (empresa_id, sucursal_id, numero_orden, estado, subtotal, total, propina, created_at)
       VALUES ($1, $2, $3, 'ENTREGADO', $4, $4, $5, $6) RETURNING id`,
      tenant.empresaId,
      tenant.sucursalId,
      `BIA-${Math.random().toString(36).slice(2, 8)}`,
      total,
      opciones.propina ?? 0,
      new Date(createdAt),
    );
    if (opciones.platoId) {
      const cantidad = opciones.cantidad ?? 1;
      await db.$executeRawUnsafe(
        `INSERT INTO fogoneria.detalles_orden (orden_id, tipo, plato_id, cantidad, precio_unitario, subtotal)
         VALUES ($1, 'PLATO', $2, $3, $4, $5)`,
        fila.id,
        opciones.platoId,
        cantidad,
        total / cantidad,
        total,
      );
    }
    await db.$executeRawUnsafe(
      `UPDATE fogoneria.ordenes SET estado = 'PAGADA' WHERE id = $1`,
      fila.id,
    );
  }

  /** Corre el servicio dentro de la transacción con contexto RLS, como el request real. */
  async function conTenant<T>(fn: (bi: BiService) => Promise<T>): Promise<T> {
    return db.$transaction(async (tx) => {
      await asTenant(tx, {
        empresaId: tenant.empresaId,
        sucursalId: tenant.sucursalId,
      });
      const bi = new BiService(
        { rls: tx } as unknown as PrismaService,
        {
          get: () => ({
            empresaId: tenant.empresaId,
            sucursalId: tenant.sucursalId,
            userId: tenant.usuarioId,
            rol: 'GERENTE_SUCURSAL',
            bypass: false,
            tx,
          }),
        } as unknown as TenantContextService,
        { get: () => 'fogoneria' } as never,
      );
      return fn(bi);
    });
  }

  it('el P&L del rango suma ventas, gastos y propinas', async () => {
    await ordenCobrada(100, { propina: 10 });
    await ordenCobrada(50);

    const pnl = await conTenant((bi) =>
      bi.pnl({ desde: '2026-11-01', hasta: '2026-11-07' }),
    );

    expect(pnl.ventas).toBe(150);
    expect(pnl.propinas).toBe(10);
    expect(pnl.gastos).toBe(0);
    expect(pnl.margen).toBe(150);
  });

  it('la serie diaria agrupa por día', async () => {
    await ordenCobrada(100);
    await ordenCobrada(40, { createdAt: '2026-11-07T18:00:00.000Z' });

    const serie = await conTenant((bi) =>
      bi.pnlPorDia({ desde: '2026-11-01', hasta: '2026-11-07' }),
    );

    expect(serie.items.map((item) => item.fecha)).toEqual(['2026-11-06', '2026-11-07']);
    expect(serie.items.map((item) => item.ventas)).toEqual([100, 40]);
  });

  it('el ranking devuelve platos por unidades', async () => {
    await ordenCobrada(30, { platoId: tenant.platoId, cantidad: 3 });
    await ordenCobrada(20, { platoId: tenant.platoId, cantidad: 1 });

    const ranking = await conTenant((bi) =>
      bi.topDishes({ desde: '2026-11-01', hasta: '2026-11-07' }),
    );

    expect(ranking.items).toHaveLength(1);
    expect(ranking.items[0]).toMatchObject({ platoId: tenant.platoId, unidades: 4, ingresos: 50 });
  });

  it('no mezcla empresas', async () => {
    await ordenCobrada(100);
    const otra = await createTenant(db, 'BI-API-2');
    await db.$executeRawUnsafe(
      `INSERT INTO fogoneria.ordenes (empresa_id, sucursal_id, numero_orden, estado, subtotal, total, created_at)
       VALUES ($1, $2, 'BIA-AJENA', 'PAGADA', 900, 900, $3)`,
      otra.empresaId,
      otra.sucursalId,
      new Date('2026-11-06T18:00:00.000Z'),
    );

    const pnl = await conTenant((bi) =>
      bi.pnl({ desde: '2026-11-01', hasta: '2026-11-07' }),
    );

    expect(pnl.ventas).toBe(100);
  });

  it('sin rango no hay forma de pedir todo el histórico', async () => {
    const bi = new BiService(
      { rls: db } as unknown as PrismaService,
      { get: () => ({ empresaId: tenant.empresaId, sucursalId: null, tx: undefined }) } as unknown as TenantContextService,
      { get: () => 'fogoneria' } as never,
    );

    await expect(
      bi.pnl({ desde: '2020-01-01', hasta: '2026-11-07' }),
    ).rejects.toThrow(/no puede superar/i);
  });
});
