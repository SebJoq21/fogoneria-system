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

let serie = 0;

async function crearComprobante(
  db: PrismaClient,
  tenant: TenantFixture,
  ordenId: string,
  total = 36,
): Promise<string> {
  serie += 1;
  const [fila] = await db.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO fogoneria.comprobantes
       (empresa_id, sucursal_id, tipo, serie_numero, orden_id, total, estado, emitido_por)
     VALUES ($1, $2, 'BOLETA', $3, $4, $5, 'PAGADA', $6)
     RETURNING id`,
    tenant.empresaId,
    tenant.sucursalId,
    `B001-${String(serie).padStart(6, '0')}`,
    ordenId,
    total,
    tenant.usuarioId,
  );
  return fila.id;
}

async function cobrar(
  db: PrismaClient,
  tenant: TenantFixture,
  turnoId: string,
  ordenId: string,
  monto = 36,
): Promise<void> {
  await db.$executeRawUnsafe(
    `INSERT INTO fogoneria.movimientos_caja
       (empresa_id, turno_id, tipo, concepto, monto, metodo, orden_id, actor_id)
     VALUES ($1, $2, 'INGRESO', 'Cobro de comanda', $3, 'EFECTIVO', $4, $5)`,
    tenant.empresaId,
    turnoId,
    monto,
    ordenId,
    tenant.usuarioId,
  );
}

async function anularComprobante(
  db: PrismaClient,
  comprobanteId: string,
  usuarioId: string,
  motivo = 'Cliente desistió',
): Promise<void> {
  await db.$executeRawUnsafe(
    `UPDATE fogoneria.comprobantes
        SET estado = 'ANULADA', anulado_por = $2, anulado_at = now(), motivo_anulacion = $3
      WHERE id = $1`,
    comprobanteId,
    usuarioId,
    motivo,
  );
}

async function movimientos(
  db: PrismaClient,
  ordenId: string,
): Promise<{ tipo: string; monto: string; concepto: string; turno_id: string }[]> {
  return db.$queryRawUnsafe(
    `SELECT tipo::text AS tipo, monto::text AS monto, concepto, turno_id
       FROM fogoneria.movimientos_caja
      WHERE orden_id = $1
      ORDER BY created_at`,
    ordenId,
  );
}

describeDb('Reversión financiera al anular (AYCDS-39)', () => {
  let db: PrismaClient;
  let tenant: TenantFixture;
  let turnoId: string;

  beforeAll(async () => {
    db = createDb();
    await prepareRlsRole(db);
  });

  beforeEach(async () => {
    await resetDatabase(db);
    tenant = await createTenant(db, 'REV');
    turnoId = await createTurno(db, tenant, 'ABIERTO');
  });

  afterAll(async () => {
    await resetDatabase(db).catch(() => undefined);
    await db.$disconnect();
  });

  it('inserta el egreso compensatorio en el turno abierto al anular el comprobante', async () => {
    const ordenId = await createOrden(db, tenant, 'ENTREGADO', 'ORD-REV-1');
    const comprobanteId = await crearComprobante(db, tenant, ordenId, 36);
    await cobrar(db, tenant, turnoId, ordenId, 36);

    await anularComprobante(db, comprobanteId, tenant.usuarioId);

    const filas = await movimientos(db, ordenId);
    expect(filas).toHaveLength(2);
    const egreso = filas.find((fila) => fila.tipo === 'EGRESO');
    expect(egreso).toBeDefined();
    expect(Number(egreso?.monto)).toBe(36);
    expect(egreso?.turno_id).toBe(turnoId);
    expect(egreso?.concepto).toMatch(/^Reversión/);
  });

  it('falla con un código propio si no hay turno abierto', async () => {
    const ordenId = await createOrden(db, tenant, 'ENTREGADO', 'ORD-REV-2');
    const comprobanteId = await crearComprobante(db, tenant, ordenId, 20);
    await cobrar(db, tenant, turnoId, ordenId, 20);
    // El turno donde se cobró ya se cerró: la reversión no lo reabre.
    await db.$executeRawUnsafe(
      `UPDATE fogoneria.turnos_caja SET estado = 'CERRADO', cierre_at = now(), saldo = 20 WHERE id = $1`,
      turnoId,
    );

    const error = await captureDbError(() =>
      anularComprobante(db, comprobanteId, tenant.usuarioId),
    );

    expectDbError(error, 'DB_REVERSION_SIN_TURNO');
  });

  it('no revierte la propina, solo el cobro de la comanda', async () => {
    const ordenId = await createOrden(db, tenant, 'ENTREGADO', 'ORD-REV-PROP');
    const comprobanteId = await crearComprobante(db, tenant, ordenId, 36);
    await cobrar(db, tenant, turnoId, ordenId, 36);
    await db.$executeRawUnsafe(
      `INSERT INTO fogoneria.movimientos_caja
         (empresa_id, turno_id, tipo, concepto, monto, metodo, orden_id, actor_id)
       VALUES ($1, $2, 'INGRESO', 'Propina ORD-REV-PROP', 5, 'EFECTIVO', $3, $4)`,
      tenant.empresaId,
      turnoId,
      ordenId,
      tenant.usuarioId,
    );

    await anularComprobante(db, comprobanteId, tenant.usuarioId);

    const filas = await movimientos(db, ordenId);
    const egresos = filas.filter((fila) => fila.tipo === 'EGRESO');
    expect(egresos).toHaveLength(1);
    expect(Number(egresos[0].monto)).toBe(36);
    // La propina sigue como ingreso intacto.
    expect(filas.filter((fila) => fila.concepto.startsWith('Propina'))).toHaveLength(1);
  });

  it('no duplica la reversión ni permite anular dos veces', async () => {
    const ordenId = await createOrden(db, tenant, 'ENTREGADO', 'ORD-REV-3');
    const comprobanteId = await crearComprobante(db, tenant, ordenId, 36);
    await cobrar(db, tenant, turnoId, ordenId, 36);

    await anularComprobante(db, comprobanteId, tenant.usuarioId);
    const error = await captureDbError(() =>
      anularComprobante(db, comprobanteId, tenant.usuarioId),
    );

    expectDbError(error, 'DB_COMPROBANTE_ANULADO');
    const egresos = (await movimientos(db, ordenId)).filter(
      (fila) => fila.tipo === 'EGRESO',
    );
    expect(egresos).toHaveLength(1);
  });

  it('devuelve el stock consumido con una entrada compensatoria', async () => {
    const ordenId = await createOrden(db, tenant, 'ENTREGADO', 'ORD-REV-4');
    const comprobanteId = await crearComprobante(db, tenant, ordenId, 36);
    await cobrar(db, tenant, turnoId, ordenId, 36);

    const [insumo] = await db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO fogoneria.insumos (empresa_id, nombre, unidad)
       VALUES ($1, 'Papa', 'kg') RETURNING id`,
      tenant.empresaId,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO fogoneria.stocks_sucursal (sucursal_id, insumo_id, empresa_id, cantidad, stock_minimo)
       VALUES ($1, $2, $3, 7.5, 2)`,
      tenant.sucursalId,
      insumo.id,
      tenant.empresaId,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO fogoneria.movimientos_inventario
         (empresa_id, sucursal_id, insumo_id, tipo, cantidad, stock_resultante, motivo, orden_id, actor_id)
       VALUES ($1, $2, $3, 'SALIDA', 2.5, 7.5, 'Consumo por escandallo', $4, $5)`,
      tenant.empresaId,
      tenant.sucursalId,
      insumo.id,
      ordenId,
      tenant.usuarioId,
    );

    await anularComprobante(db, comprobanteId, tenant.usuarioId);

    const movimientosInventario = await db.$queryRawUnsafe<
      { tipo: string; cantidad: string; stock_resultante: string }[]
    >(
      `SELECT tipo::text AS tipo, cantidad::text AS cantidad, stock_resultante::text AS stock_resultante
         FROM fogoneria.movimientos_inventario
        WHERE orden_id = $1
        ORDER BY created_at`,
      ordenId,
    );
    expect(movimientosInventario).toHaveLength(2);
    expect(movimientosInventario[1]).toMatchObject({ tipo: 'ENTRADA', cantidad: '2.500' });

    const [stock] = await db.$queryRawUnsafe<{ cantidad: string }[]>(
      `SELECT cantidad::text AS cantidad FROM fogoneria.stocks_sucursal
        WHERE sucursal_id = $1 AND insumo_id = $2`,
      tenant.sucursalId,
      insumo.id,
    );
    expect(Number(stock.cantidad)).toBe(10);
  });

  it('no inserta nada si la orden se anula antes de cobrar', async () => {
    const ordenId = await createOrden(db, tenant, 'POR_CONFIRMAR', 'ORD-REV-5');

    await db.$executeRawUnsafe(
      `UPDATE fogoneria.ordenes SET estado = 'ANULADA' WHERE id = $1`,
      ordenId,
    );

    expect(await movimientos(db, ordenId)).toHaveLength(0);
  });

  it('revierte desde el disparador de la orden si ya había cobros', async () => {
    const ordenId = await createOrden(db, tenant, 'POR_CONFIRMAR', 'ORD-REV-6');
    await cobrar(db, tenant, turnoId, ordenId, 12);

    await db.$executeRawUnsafe(
      `UPDATE fogoneria.ordenes SET estado = 'ANULADA' WHERE id = $1`,
      ordenId,
    );

    const filas = await movimientos(db, ordenId);
    expect(filas.map((fila) => fila.tipo)).toEqual(['INGRESO', 'EGRESO']);
    expect(Number(filas[1].monto)).toBe(12);
  });
});
