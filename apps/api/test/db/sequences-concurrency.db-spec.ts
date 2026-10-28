import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import {
  createDb,
  createTenant,
  hasTestDatabase,
  resetDatabase,
  type TenantFixture,
} from './helpers.js';

const describeDb = hasTestDatabase ? describe : describe.skip;

/**
 * AYCDS-22 — concurrencia de folios.
 *
 * La optimización mueve el upsert de `secuencias` fuera de la transacción de la
 * comanda. Este spec comprueba que la sentencia sigue siendo atómica cuando 50
 * conexiones la ejecutan a la vez: sin duplicados, sin deadlocks y con la
 * numeración correlativa por empresa.
 */
describeDb('Folios de comanda bajo concurrencia (AYCDS-22)', () => {
  let db: PrismaClient;
  let tenant: TenantFixture;

  const BUMP = `INSERT INTO fogoneria.secuencias (empresa_id, tipo, valor)
                VALUES ($1::uuid, $2, 1)
                ON CONFLICT (empresa_id, tipo)
                DO UPDATE SET valor = fogoneria.secuencias.valor + 1,
                              updated_at = now()
                RETURNING valor`;

  async function reservar(empresaId: string, tipo: 'ORD' | 'RSV'): Promise<number> {
    const [row] = await db.$queryRawUnsafe<{ valor: bigint }[]>(
      BUMP,
      empresaId,
      tipo,
    );
    return Number(row.valor);
  }

  beforeAll(async () => {
    db = createDb();
  });

  beforeEach(async () => {
    await resetDatabase(db);
    tenant = await createTenant(db, 'FOLIOS');
  });

  afterAll(async () => {
    await resetDatabase(db).catch(() => undefined);
    await db.$disconnect();
  });

  it('50 reservas simultáneas dan 50 folios únicos y correlativos', async () => {
    const valores = await Promise.all(
      Array.from({ length: 50 }, () => reservar(tenant.empresaId, 'ORD')),
    );

    const ordenados = [...valores].sort((a, b) => a - b);
    expect(new Set(ordenados).size).toBe(50);
    expect(ordenados[0]).toBe(1);
    expect(ordenados.at(-1)).toBe(50);
  });

  it('cada empresa lleva su propio contador', async () => {
    const otra = await createTenant(db, 'FOLIOS-B');

    const [a1, b1, a2, b2] = await Promise.all([
      reservar(tenant.empresaId, 'ORD'),
      reservar(otra.empresaId, 'ORD'),
      reservar(tenant.empresaId, 'ORD'),
      reservar(otra.empresaId, 'ORD'),
    ]);

    expect([a1, a2].sort((x, y) => x - y)).toEqual([1, 2]);
    expect([b1, b2].sort((x, y) => x - y)).toEqual([1, 2]);
  });

  it('las órdenes y las reservas no comparten contador', async () => {
    const [orden, reserva] = await Promise.all([
      reservar(tenant.empresaId, 'ORD'),
      reservar(tenant.empresaId, 'RSV'),
    ]);

    expect(orden).toBe(1);
    expect(reserva).toBe(1);
  });
});
