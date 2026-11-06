import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import {
  captureDbError,
  createDb,
  createOrden,
  createTenant,
  expectDbError,
  hasTestDatabase,
  prepareRlsRole,
  resetDatabase,
  type TenantFixture,
} from './helpers.js';

const describeDb = hasTestDatabase ? describe : describe.skip;

async function moverEstado(
  db: PrismaClient,
  ordenId: string,
  estado: string,
): Promise<void> {
  await db.$executeRawUnsafe(
    `UPDATE fogoneria.ordenes SET estado = $2::fogoneria.estado_orden WHERE id = $1`,
    ordenId,
    estado,
  );
}

describeDb('Órdenes POS e inmutabilidad (AYCDS-20)', () => {
  let db: PrismaClient;
  let tenant: TenantFixture;

  beforeAll(async () => {
    db = createDb();
    await prepareRlsRole(db);
  });

  beforeEach(async () => {
    await resetDatabase(db);
    tenant = await createTenant(db, 'POS');
  });

  afterAll(async () => {
    await resetDatabase(db).catch(() => undefined);
    await db.$disconnect();
  });

  it('recorre el camino feliz del KDS', async () => {
    const ordenId = await createOrden(db, tenant, 'POR_CONFIRMAR', 'ORD-KDS');

    await moverEstado(db, ordenId, 'EN_COCINA');
    await moverEstado(db, ordenId, 'LISTO');
    await moverEstado(db, ordenId, 'ENTREGADO');
    await moverEstado(db, ordenId, 'PAGADA');

    const [orden] = await db.$queryRawUnsafe<{ estado: string }[]>(
      `SELECT estado FROM fogoneria.ordenes WHERE id = $1`,
      ordenId,
    );
    expect(orden.estado).toBe('PAGADA');
  });

  it('anula una orden que aún no entró a cocina', async () => {
    const ordenId = await createOrden(db, tenant, 'POR_CONFIRMAR', 'ORD-ANULA');

    await moverEstado(db, ordenId, 'ANULADA');

    const [orden] = await db.$queryRawUnsafe<{ estado: string }[]>(
      `SELECT estado FROM fogoneria.ordenes WHERE id = $1`,
      ordenId,
    );
    expect(orden.estado).toBe('ANULADA');
  });

  it('bloquea la anulación en preparación con un código propio', async () => {
    const ordenId = await createOrden(db, tenant, 'EN_COCINA', 'ORD-COCINA');

    const error = await captureDbError(() => moverEstado(db, ordenId, 'ANULADA'));

    expectDbError(error, 'DB_ORDEN_ANULACION_TARDIA');
  });

  it('bloquea la anulación cuando la orden ya está lista', async () => {
    const ordenId = await createOrden(db, tenant, 'LISTO', 'ORD-LISTO');

    const error = await captureDbError(() => moverEstado(db, ordenId, 'ANULADA'));

    expectDbError(error, 'DB_ORDEN_ANULACION_TARDIA');
  });

  it('no repite el número de orden dentro de la empresa', async () => {
    await createOrden(db, tenant, 'POR_CONFIRMAR', 'ORD-DUP');

    const error = await captureDbError(() =>
      createOrden(db, tenant, 'POR_CONFIRMAR', 'ORD-DUP'),
    );

    expectDbError(error, '23505');
  });

  it('permite el mismo número de orden en otra empresa', async () => {
    const otra = await createTenant(db, 'POS-B');
    await createOrden(db, tenant, 'POR_CONFIRMAR', 'ORD-IGUAL');
    await createOrden(db, otra, 'POR_CONFIRMAR', 'ORD-IGUAL');

    const [row] = await db.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM fogoneria.ordenes WHERE numero_orden = 'ORD-IGUAL'`,
    );
    expect(row.n).toBe(2);
  });
});
