import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { AuditService } from '../../src/modules/audit/audit.service.js';
import type { TenantContextService } from '../../src/common/context/tenant-context.service.js';
import type { PrismaService } from '../../src/prisma/prisma.service.js';
import { StockAlertsService } from '../../src/modules/inventory/stock-alerts.service.js';
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

describeDb('Alertas de stock (AYCDS-13)', () => {
  let db: PrismaClient;
  let tenant: TenantFixture;
  let insumoId: string;

  beforeAll(async () => {
    db = createDb();
    await prepareRlsRole(db);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 202 }));
  });

  beforeEach(async () => {
    await resetDatabase(db);
    tenant = await createTenant(db, 'STOCK');
    const [insumo] = await db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO fogoneria.insumos (empresa_id, nombre, unidad)
       VALUES ($1, $2, 'kg') RETURNING id`,
      tenant.empresaId,
      `Papa ${Math.random().toString(36).slice(2, 6)}`,
    );
    insumoId = insumo.id;
    process.env.STOCK_WEBHOOK_URL = 'https://n8n.local/webhook/stock';
    process.env.STOCK_WEBHOOK_SECRET = 'secreto-de-prueba';
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    process.env.STOCK_WEBHOOK_URL = '';
    process.env.STOCK_WEBHOOK_SECRET = '';
    await resetDatabase(db).catch(() => undefined);
    await db.$disconnect();
  });

  async function stock(cantidad: number, minimo = 5, sucursalId = tenant.sucursalId): Promise<void> {
    await db.$executeRawUnsafe(
      `INSERT INTO fogoneria.stocks_sucursal (sucursal_id, insumo_id, empresa_id, cantidad, stock_minimo)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (sucursal_id, insumo_id)
       DO UPDATE SET cantidad = EXCLUDED.cantidad, stock_minimo = EXCLUDED.stock_minimo`,
      sucursalId,
      insumoId,
      tenant.empresaId,
      cantidad,
      minimo,
    );
  }

  async function conTenant<T>(fn: (service: StockAlertsService) => Promise<T>): Promise<T> {
    return db.$transaction(async (tx) => {
      await asTenant(tx, { empresaId: tenant.empresaId, sucursalId: tenant.sucursalId });
      return fn(
        new StockAlertsService(
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
          { record: async () => undefined } as unknown as AuditService,
          { get: () => 'fogoneria' } as never,
        ),
      );
    });
  }

  async function alertas(): Promise<{ id: string; estado: string; notificado_at: Date | null }[]> {
    return db.$queryRawUnsafe(
      `SELECT id, estado, notificado_at FROM fogoneria.alertas_stock WHERE empresa_id = $1`,
      tenant.empresaId,
    );
  }

  it('crea la alerta y la marca como notificada', async () => {
    await stock(2);
    const resumen = await conTenant((service) => service.checkAlerts({}));

    expect(resumen).toMatchObject({ evaluados: 1, nuevas: 1, enviado: true });
    const filas = await alertas();
    expect(filas).toHaveLength(1);
    expect(filas[0].estado).toBe('BAJO');
    expect(filas[0].notificado_at).not.toBeNull();
  });

  it('marca AGOTADO cuando no queda stock', async () => {
    await stock(0);
    await conTenant((service) => service.checkAlerts({}));

    const filas = await alertas();
    expect(filas[0].estado).toBe('AGOTADO');
  });

  it('no duplica la alerta en el siguiente barrido', async () => {
    await stock(2);
    await conTenant((service) => service.checkAlerts({}));
    const segundo = await conTenant((service) => service.checkAlerts({}));

    expect(segundo.nuevas).toBe(0);
    expect(await alertas()).toHaveLength(1);
  });

  it('borra la alerta cuando el stock se repone', async () => {
    await stock(2);
    await conTenant((service) => service.checkAlerts({}));
    await stock(9);
    const resumen = await conTenant((service) => service.checkAlerts({}));

    expect(resumen.resueltas).toBe(1);
    expect(await alertas()).toHaveLength(0);
  });

  it('el semáforo devuelve el estado calculado por la vista', async () => {
    await stock(9, 5);
    const status = await conTenant((service) => service.status({}));

    expect(status.items).toHaveLength(1);
    expect(status.items[0]).toMatchObject({ insumoId, estado: 'OPTIMO', cantidad: 9 });
    expect(status.resumen.optimos).toBe(1);
  });

  it('no toca el stock de otra empresa', async () => {
    await stock(1);
    const otra = await createTenant(db, 'STOCK-2');
    const [insumoB] = await db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO fogoneria.insumos (empresa_id, nombre, unidad)
       VALUES ($1, 'Arroz ajeno', 'kg') RETURNING id`,
      otra.empresaId,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO fogoneria.stocks_sucursal (sucursal_id, insumo_id, empresa_id, cantidad, stock_minimo)
       VALUES ($1, $2, $3, 0, 5)`,
      otra.sucursalId,
      insumoB.id,
      otra.empresaId,
    );

    await conTenant((service) => service.checkAlerts({}));

    const [propias] = await db.$queryRawUnsafe<{ total: bigint }[]>(
      `SELECT count(*) AS total FROM fogoneria.alertas_stock WHERE empresa_id = $1`,
      otra.empresaId,
    );
    expect(Number(propias.total)).toBe(0);
  });
});
