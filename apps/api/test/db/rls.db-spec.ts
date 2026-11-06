import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import {
  asTenant,
  captureDbError,
  createDb,
  createOrden,
  createTenant,
  createTurno,
  expectDbError,
  hasTestDatabase,
  prepareRlsRole,
  resetDatabase,
  type TenantFixture,
} from './helpers.js';

const describeDb = hasTestDatabase ? describe : describe.skip;

describeDb('RLS por empresa y sucursal (AYCDS-62)', () => {
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

  it('sin contexto de sesión no devuelve filas', async () => {
    const filas = await db.$transaction(async (tx) => {
      await asTenant(tx, {});
      return tx.$queryRawUnsafe<{ n: number }[]>(
        'SELECT count(*)::int AS n FROM fogoneria.platos',
      );
    });

    expect(filas[0]?.n).toBe(0);
  });

  it('cada empresa solo ve sus platos', async () => {
    const [comoA, comoB] = await Promise.all([
      db.$transaction(async (tx) => {
        await asTenant(tx, { empresaId: empresaA.empresaId });
        return tx.$queryRawUnsafe<{ id: string }[]>('SELECT id FROM fogoneria.platos');
      }),
      db.$transaction(async (tx) => {
        await asTenant(tx, { empresaId: empresaB.empresaId });
        return tx.$queryRawUnsafe<{ id: string }[]>('SELECT id FROM fogoneria.platos');
      }),
    ]);

    expect(comoA.map((fila) => fila.id)).toEqual([empresaA.platoId]);
    expect(comoB.map((fila) => fila.id)).toEqual([empresaB.platoId]);
  });

  it('rechaza insertar filas de otra empresa', async () => {
    const error = await captureDbError(() =>
      db.$transaction(async (tx) => {
        await asTenant(tx, { empresaId: empresaA.empresaId });
        await tx.$executeRawUnsafe(
          `INSERT INTO fogoneria.platos (empresa_id, categoria_id, sku, nombre)
           VALUES ($1, $2, $3, $4)`,
          empresaB.empresaId,
          empresaB.categoriaId,
          'SKU-CRUZADO',
          'Plato cruzado',
        );
      }),
    );

    expectDbError(error, 'row-level security');
  });

  it('el bypass de la consola SaaS ve todas las empresas', async () => {
    const filas = await db.$transaction(async (tx) => {
      await asTenant(tx, { bypass: true });
      return tx.$queryRawUnsafe<{ n: number }[]>(
        'SELECT count(*)::int AS n FROM fogoneria.platos',
      );
    });

    expect(filas[0]?.n).toBe(2);
  });

  it('la sucursal limita la operación de la empresa', async () => {
    const [otraSucursal] = await db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO fogoneria.sucursales (empresa_id, nombre)
       VALUES ($1, 'Sucursal A2')
       RETURNING id`,
      empresaA.empresaId,
    );

    await createOrden(
      db,
      { ...empresaA, sucursalId: otraSucursal.id },
      'ENTREGADO',
      'ORD-A2',
    );
    await createOrden(db, empresaA, 'ENTREGADO', 'ORD-A1');

    const filas = await db.$transaction(async (tx) => {
      await asTenant(tx, {
        empresaId: empresaA.empresaId,
        sucursalId: empresaA.sucursalId,
      });
      return tx.$queryRawUnsafe<{ numero_orden: string }[]>(
        'SELECT numero_orden FROM fogoneria.ordenes ORDER BY numero_orden',
      );
    });

    expect(filas.map((fila) => fila.numero_orden)).toEqual(['ORD-A1']);
  });

  it('movimientos_caja hereda la sucursal del turno', async () => {
    const [otraSucursal] = await db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO fogoneria.sucursales (empresa_id, nombre)
       VALUES ($1, 'Sucursal A2')
       RETURNING id`,
      empresaA.empresaId,
    );

    const turnoA2 = await createTurno(db, { ...empresaA, sucursalId: otraSucursal.id });
    await db.$executeRawUnsafe(
      `INSERT INTO fogoneria.movimientos_caja (empresa_id, turno_id, tipo, concepto, monto, metodo)
       VALUES ($1, $2, 'INGRESO', 'Venta', 10, 'EFECTIVO')`,
      empresaA.empresaId,
      turnoA2,
    );

    const filas = await db.$transaction(async (tx) => {
      await asTenant(tx, {
        empresaId: empresaA.empresaId,
        sucursalId: empresaA.sucursalId,
      });
      return tx.$queryRawUnsafe<{ n: number }[]>(
        'SELECT count(*)::int AS n FROM fogoneria.movimientos_caja',
      );
    });

    expect(filas[0]?.n).toBe(0);
  });

  it('las líneas de orden se aíslan por la orden padre', async () => {
    const ordenA = await createOrden(db, empresaA);
    const ordenB = await createOrden(db, empresaB);

    for (const [orden, tenant] of [
      [ordenA, empresaA] as const,
      [ordenB, empresaB] as const,
    ]) {
      await db.$executeRawUnsafe(
        `INSERT INTO fogoneria.detalles_orden (orden_id, tipo, plato_id, cantidad, precio_unitario, subtotal)
         VALUES ($1, 'PLATO', $2, 1, 10, 10)`,
        orden,
        tenant.platoId,
      );
    }

    const filas = await db.$transaction(async (tx) => {
      await asTenant(tx, { empresaId: empresaA.empresaId });
      return tx.$queryRawUnsafe<{ orden_id: string }[]>(
        'SELECT orden_id FROM fogoneria.detalles_orden',
      );
    });

    expect(filas.map((fila) => fila.orden_id)).toEqual([ordenA]);
  });

  it('los superadmin (empresa_id NULL) quedan ocultos sin bypass', async () => {
    await db.$executeRawUnsafe(
      `INSERT INTO fogoneria.usuarios (empresa_id, nombre, email, password_hash, rol)
       VALUES (NULL, 'SaaS Root', 'root@test.local', 'x', 'SUPERADMIN')`,
    );

    const [sinBypass, conBypass] = await Promise.all([
      db.$transaction(async (tx) => {
        await asTenant(tx, { empresaId: empresaA.empresaId });
        return tx.$queryRawUnsafe<{ n: number }[]>(
          `SELECT count(*)::int AS n FROM fogoneria.usuarios WHERE rol = 'SUPERADMIN'`,
        );
      }),
      db.$transaction(async (tx) => {
        await asTenant(tx, { bypass: true });
        return tx.$queryRawUnsafe<{ n: number }[]>(
          `SELECT count(*)::int AS n FROM fogoneria.usuarios WHERE rol = 'SUPERADMIN'`,
        );
      }),
    ]);

    expect(sinBypass[0]?.n).toBe(0);
    expect(conBypass[0]?.n).toBe(1);
  });
});
