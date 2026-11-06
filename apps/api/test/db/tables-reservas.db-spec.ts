import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import {
  asTenant,
  captureDbError,
  createDb,
  createTenant,
  expectDbError,
  hasTestDatabase,
  prepareRlsRole,
  resetDatabase,
  type TenantFixture,
  type Tx,
} from './helpers.js';

const describeDb = hasTestDatabase ? describe : describe.skip;

async function createMesa(
  db: PrismaClient,
  tenant: TenantFixture,
  numero: string,
  capacidad = 4,
): Promise<string> {
  const [mesa] = await db.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO fogoneria.mesas (empresa_id, sucursal_id, numero, capacidad)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    tenant.empresaId,
    tenant.sucursalId,
    numero,
    capacidad,
  );
  return mesa.id;
}

/** Incremento de la secuencia, tal como lo hace `SequencesService`. */
async function bump(tx: Tx, empresaId: string, tipo: string): Promise<number> {
  const [row] = await tx.$queryRawUnsafe<{ valor: bigint }[]>(
    `INSERT INTO fogoneria.secuencias (empresa_id, tipo, valor)
     VALUES ($1::uuid, $2, 1)
     ON CONFLICT (empresa_id, tipo)
     DO UPDATE SET valor = fogoneria.secuencias.valor + 1, updated_at = now()
     RETURNING valor`,
    empresaId,
    tipo,
  );
  return Number(row.valor);
}

async function countAs(
  db: PrismaClient,
  tenant: TenantFixture,
  tabla: 'mesas' | 'secuencias',
): Promise<number> {
  return db.$transaction(async (tx) => {
    await asTenant(tx, {
      empresaId: tenant.empresaId,
      sucursalId: tenant.sucursalId,
    });
    const [row] = await tx.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM fogoneria.${tabla}`,
    );
    return row.n;
  });
}

describeDb('Mesas, reservas y secuencias (AYCDS-16)', () => {
  let db: PrismaClient;
  let empresaA: TenantFixture;
  let empresaB: TenantFixture;

  beforeAll(async () => {
    db = createDb();
    await prepareRlsRole(db);
  });

  beforeEach(async () => {
    await resetDatabase(db);
    empresaA = await createTenant(db, 'A');
    empresaB = await createTenant(db, 'B');
  });

  afterAll(async () => {
    await resetDatabase(db).catch(() => undefined);
    await db.$disconnect();
  });

  it('aísla las mesas por empresa', async () => {
    await createMesa(db, empresaA, '1');

    expect(await countAs(db, empresaA, 'mesas')).toBe(1);
    expect(await countAs(db, empresaB, 'mesas')).toBe(0);
  });

  it('impide dos mesas con el mismo número en la sucursal', async () => {
    await createMesa(db, empresaA, '1');

    const error = await captureDbError(() => createMesa(db, empresaA, '1'));

    // Prisma envuelve el error crudo como P2010; el SQLSTATE viaja en el mensaje.
    expectDbError(error, '23505');
  });

  it('permite el mismo número de mesa en otra empresa', async () => {
    await createMesa(db, empresaA, '1');
    await createMesa(db, empresaB, '1');

    expect(await countAs(db, empresaA, 'mesas')).toBe(1);
    expect(await countAs(db, empresaB, 'mesas')).toBe(1);
  });

  it('la secuencia es atómica bajo concurrencia', async () => {
    const resultados = await Promise.all([
      db.$transaction(async (tx) => {
        await asTenant(tx, { empresaId: empresaA.empresaId, sucursalId: empresaA.sucursalId });
        return bump(tx, empresaA.empresaId, 'ORD');
      }),
      db.$transaction(async (tx) => {
        await asTenant(tx, { empresaId: empresaA.empresaId, sucursalId: empresaA.sucursalId });
        return bump(tx, empresaA.empresaId, 'ORD');
      }),
    ]);

    expect(resultados.sort((x, y) => x - y)).toEqual([1, 2]);
  });

  it('las secuencias quedan aisladas por empresa', async () => {
    await db.$transaction(async (tx) => {
      await asTenant(tx, { empresaId: empresaA.empresaId, sucursalId: empresaA.sucursalId });
      await bump(tx, empresaA.empresaId, 'RSV');
    });

    expect(await countAs(db, empresaA, 'secuencias')).toBe(1);
    expect(await countAs(db, empresaB, 'secuencias')).toBe(0);
  });

  it('la RLS impide escribir una secuencia de otra empresa', async () => {
    const error = await captureDbError(() =>
      db.$transaction(async (tx) => {
        await asTenant(tx, { empresaId: empresaB.empresaId, sucursalId: empresaB.sucursalId });
        await bump(tx, empresaA.empresaId, 'ORD');
      }),
    );

    expect(error.message).toContain('row-level security');
  });

  it('la reserva exige una mesa existente (FK)', async () => {
    const error = await captureDbError(() =>
      db.$queryRawUnsafe(
        `INSERT INTO fogoneria.reservas
           (empresa_id, sucursal_id, mesa_id, codigo, cliente_nombre, nro_comensales, fecha_hora)
         VALUES ($1, $2, gen_random_uuid(), $3, 'Prueba', 2, now() + interval '1 hour')`,
        empresaA.empresaId,
        empresaA.sucursalId,
        `RSV-FK-${Date.now()}`,
      ),
    );

    expectDbError(error, '23503');
  });
});
