import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { PrismaService } from '../../src/prisma/prisma.service.js';
import type { TenantContextService } from '../../src/common/context/tenant-context.service.js';
import type { AuditService } from '../../src/modules/audit/audit.service.js';
import { CashService } from '../../src/modules/cash/cash.service.js';
import { ExpensesService } from '../../src/modules/expenses/expenses.service.js';
import {
  asTenant,
  captureDbError,
  createDb,
  createTenant,
  createTurno,
  expectDbError,
  hasTestDatabase,
  prepareRlsRole,
  resetDatabase,
  type TenantFixture,
} from './helpers.js';

const describeDb = hasTestDatabase ? describe : describe.skip;

describeDb('Gastos y cruce a caja (AYCDS-17)', () => {
  let db: PrismaClient;
  let tenant: TenantFixture;
  let turnoId: string;

  beforeAll(async () => {
    db = createDb();
    await prepareRlsRole(db);
  });

  beforeEach(async () => {
    await resetDatabase(db);
    tenant = await createTenant(db, 'GASTOS');
    turnoId = await createTurno(db, tenant, 'ABIERTO');
  });

  afterAll(async () => {
    await resetDatabase(db).catch(() => undefined);
    await db.$disconnect();
  });

  async function crearGasto(monto = 120): Promise<string> {
    const [fila] = await db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO fogoneria.gastos (empresa_id, sucursal_id, concepto, monto, categoria)
       VALUES ($1, $2, 'Compra de carbón', $3, 'INSUMOS')
       RETURNING id`,
      tenant.empresaId,
      tenant.sucursalId,
      monto,
    );
    return fila.id;
  }

  /** Ejecuta los servicios dentro de una transacción con el rol de negocio. */
  async function enTenant<T>(fn: (services: {
    cash: CashService;
    expenses: ExpensesService;
  }) => Promise<T>): Promise<T> {
    return db.$transaction(async (tx) => {
      await asTenant(tx, {
        empresaId: tenant.empresaId,
        sucursalId: tenant.sucursalId,
      });
      const prisma = { scoped: tx } as unknown as PrismaService;
      const context = {
        get: () => ({
          empresaId: tenant.empresaId,
          sucursalId: tenant.sucursalId,
          userId: tenant.usuarioId,
          rol: 'CAJERO',
          bypass: false,
        }),
      } as unknown as TenantContextService;
      const audit = { record: async () => undefined } as unknown as AuditService;
      const cash = new CashService(prisma, context, { updateStatus: async () => undefined } as never, audit);
      const expenses = new ExpensesService(prisma, context, cash, audit);
      return fn({ cash, expenses });
    });
  }

  it('pagar en efectivo deja el egreso en el turno y marca el gasto', async () => {
    const gastoId = await crearGasto(120);

    const gasto = await enTenant(({ expenses }) => expenses.pay(gastoId, 'EFECTIVO'));

    expect(gasto?.estado_pago).toBe('PAGADO');
    expect(gasto?.pagado_en_caja).toBe(true);
    expect(gasto?.turno_id).toBe(turnoId);

    const [movimiento] = await db.$queryRawUnsafe<
      { tipo: string; monto: string; gasto_id: string; turno_id: string }[]
    >(
      `SELECT tipo::text AS tipo, monto::text AS monto, gasto_id, turno_id
         FROM fogoneria.movimientos_caja WHERE gasto_id = $1`,
      gastoId,
    );
    expect(movimiento).toMatchObject({
      tipo: 'EGRESO',
      monto: '120.00',
      gasto_id: gastoId,
      turno_id: turnoId,
    });
  });

  it('pagar por transferencia no toca la caja', async () => {
    const gastoId = await crearGasto(80);

    const gasto = await enTenant(({ expenses }) => expenses.pay(gastoId, 'TRANSFERENCIA'));

    expect(gasto).toMatchObject({ estado_pago: 'PAGADO', pagado_en_caja: false });
    const [conteo] = await db.$queryRawUnsafe<{ total: bigint }[]>(
      `SELECT count(*) AS total FROM fogoneria.movimientos_caja WHERE gasto_id = $1`,
      gastoId,
    );
    expect(Number(conteo.total)).toBe(0);
  });

  it('la base bloquea cambiar el monto de un gasto pagado en caja', async () => {
    const gastoId = await crearGasto(120);
    await enTenant(({ expenses }) => expenses.pay(gastoId, 'EFECTIVO'));

    const error = await captureDbError(() =>
      db.$executeRawUnsafe(
        `UPDATE fogoneria.gastos SET monto = 200 WHERE id = $1`,
        gastoId,
      ),
    );

    expectDbError(error, 'DB_GASTO_PAGADO');
  });

  it('el servicio rechaza editar un gasto pagado en caja', async () => {
    const gastoId = await crearGasto(120);
    await enTenant(({ expenses }) => expenses.pay(gastoId, 'EFECTIVO'));

    await expect(
      enTenant(({ expenses }) => expenses.update(gastoId, { monto: 200 })),
    ).rejects.toThrow(/pagó en caja/i);
  });

  it('pagar sin turno abierto falla con un 409 de caja', async () => {
    await db.$executeRawUnsafe(
      `UPDATE fogoneria.turnos_caja SET estado = 'CERRADO', cierre_at = now(), saldo = 200 WHERE id = $1`,
      turnoId,
    );
    const gastoId = await crearGasto(50);

    await expect(
      enTenant(({ expenses }) => expenses.pay(gastoId, 'EFECTIVO')),
    ).rejects.toThrow(/turno de caja abierto/i);
  });
});
