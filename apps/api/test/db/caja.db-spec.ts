import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import {
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

async function abrirTurno(
  db: PrismaClient,
  tenant: TenantFixture,
  fondo = 200,
): Promise<string> {
  const [fila] = await db.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO fogoneria.turnos_caja (empresa_id, sucursal_id, fondo_apertura)
     VALUES ($1, $2, $3)
     RETURNING id`,
    tenant.empresaId,
    tenant.sucursalId,
    fondo,
  );
  return fila.id;
}

describeDb('Caja: turnos, propina y arqueo (AYCDS-34)', () => {
  let db: PrismaClient;
  let tenant: TenantFixture;

  beforeAll(async () => {
    db = createDb();
    await prepareRlsRole(db);
  });

  beforeEach(async () => {
    await resetDatabase(db);
    tenant = await createTenant(db, 'CAJA');
  });

  afterAll(async () => {
    await resetDatabase(db).catch(() => undefined);
    await db.$disconnect();
  });

  it('no permite dos turnos abiertos en la misma sucursal', async () => {
    await abrirTurno(db, tenant);

    const error = await captureDbError(() => abrirTurno(db, tenant, 50));

    expect(`${error.code ?? ''} ${error.message}`).toMatch(
      /23505|P2002|uq_turnos_abierto_sucursal/,
    );
  });

  it('deja abrir otro turno cuando el anterior se cerró', async () => {
    const primero = await abrirTurno(db, tenant);
    await db.$executeRawUnsafe(
      `UPDATE fogoneria.turnos_caja
          SET estado = 'CERRADO', cierre_at = now(), saldo = 200
        WHERE id = $1`,
      primero,
    );

    const segundo = await abrirTurno(db, tenant, 100);

    const [fila] = await db.$queryRawUnsafe<{ abiertos: bigint }[]>(
      `SELECT count(*) AS abiertos FROM fogoneria.turnos_caja
        WHERE sucursal_id = $1 AND estado = 'ABIERTO'`,
      tenant.sucursalId,
    );
    expect(Number(fila.abiertos)).toBe(1);
    expect(segundo).not.toBe(primero);
  });

  it('rechaza una propina negativa en la orden', async () => {
    const ordenId = await createOrden(db, tenant, 'ENTREGADO', 'ORD-CAJA-1');

    const error = await captureDbError(() =>
      db.$executeRawUnsafe(
        `UPDATE fogoneria.ordenes SET propina = -1 WHERE id = $1`,
        ordenId,
      ),
    );

    expect(`${error.code ?? ''} ${error.message}`).toMatch(
      /23514|chk_ordenes_propina/,
    );
  });

  it('guarda la propina y la suma en el arqueo del turno', async () => {
    const turnoId = await abrirTurno(db, tenant);
    const ordenId = await createOrden(db, tenant, 'ENTREGADO', 'ORD-CAJA-2');

    await db.$executeRawUnsafe(
      `UPDATE fogoneria.ordenes SET propina = 8 WHERE id = $1`,
      ordenId,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO fogoneria.movimientos_caja
         (empresa_id, turno_id, tipo, concepto, monto, metodo, orden_id, actor_id)
       VALUES ($1, $2, 'INGRESO', 'Cobro ORD-CAJA-2', 36, 'EFECTIVO', $3, $4),
              ($1, $2, 'INGRESO', 'Propina ORD-CAJA-2', 8, 'EFECTIVO', $3, $4)`,
      tenant.empresaId,
      turnoId,
      ordenId,
      tenant.usuarioId,
    );

    const [totales] = await db.$queryRawUnsafe<{ ingresos: string; propinas: string }[]>(
      `SELECT sum(CASE WHEN tipo = 'INGRESO' THEN monto ELSE 0 END)::text AS ingresos,
              sum(CASE WHEN concepto LIKE 'Propina%' THEN monto ELSE 0 END)::text AS propinas
         FROM fogoneria.movimientos_caja
        WHERE turno_id = $1`,
      turnoId,
    );
    expect(Number(totales.ingresos)).toBe(44);
    expect(Number(totales.propinas)).toBe(8);
  });

  it('rechaza movimientos en un turno cerrado', async () => {
    const turnoId = await createTurno(db, tenant, 'CERRADO');

    const error = await captureDbError(() =>
      db.$executeRawUnsafe(
        `INSERT INTO fogoneria.movimientos_caja
           (empresa_id, turno_id, tipo, concepto, monto, metodo, actor_id)
         VALUES ($1, $2, 'EGRESO', 'Tarde', 10, 'EFECTIVO', $3)`,
        tenant.empresaId,
        turnoId,
        tenant.usuarioId,
      ),
    );

    expectDbError(error, 'DB_TURNO_CERRADO');
  });
});
