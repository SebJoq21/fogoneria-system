import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import {
  captureDbError,
  createDb,
  createOrden,
  createTenant,
  createTurno,
  expectDbError,
  hasTestDatabase,
  resetDatabase,
  type TenantFixture,
} from './helpers.js';

const describeDb = hasTestDatabase ? describe : describe.skip;

describeDb('Inmutabilidad contable (AYCDS-62)', () => {
  let db: PrismaClient;
  let tenant: TenantFixture;
  let ordenId: string;
  let turnoAbierto: string;
  let turnoCerrado: string;

  beforeAll(() => {
    db = createDb();
  });

  beforeEach(async () => {
    await resetDatabase(db);
    tenant = await createTenant(db, 'Inmutable');
    ordenId = await createOrden(db, tenant, 'ENTREGADO');
    turnoAbierto = await createTurno(db, tenant, 'ABIERTO');
    turnoCerrado = await createTurno(db, tenant, 'CERRADO');
  });

  afterAll(async () => {
    await resetDatabase(db).catch(() => undefined);
    await db.$disconnect();
  });

  async function insertarMovimiento(turnoId: string): Promise<string> {
    const [fila] = await db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO fogoneria.movimientos_caja
         (empresa_id, turno_id, tipo, concepto, monto, metodo)
       VALUES ($1, $2, 'INGRESO', 'Venta', 10, 'EFECTIVO')
       RETURNING id`,
      tenant.empresaId,
      turnoId,
    );
    return fila.id;
  }

  it('no permite borrar un turno de caja', async () => {
    const error = await captureDbError(() =>
      db.$executeRawUnsafe('DELETE FROM fogoneria.turnos_caja WHERE id = $1', turnoAbierto),
    );

    expectDbError(error, 'DB_TURNO_NO_BORRABLE');
  });

  it('no permite reabrir un turno cerrado', async () => {
    const error = await captureDbError(() =>
      db.$executeRawUnsafe(
        `UPDATE fogoneria.turnos_caja SET estado = 'ABIERTO' WHERE id = $1`,
        turnoCerrado,
      ),
    );

    expectDbError(error, 'DB_TURNO_CERRADO');
  });

  it('no registra movimientos en un turno cerrado', async () => {
    const error = await captureDbError(() => insertarMovimiento(turnoCerrado));

    expectDbError(error, 'DB_TURNO_CERRADO');
  });

  it('los movimientos de caja son append-only', async () => {
    const movimientoId = await insertarMovimiento(turnoAbierto);

    const errorUpdate = await captureDbError(() =>
      db.$executeRawUnsafe(
        `UPDATE fogoneria.movimientos_caja SET monto = 99 WHERE id = $1`,
        movimientoId,
      ),
    );
    expectDbError(errorUpdate, 'DB_MOVIMIENTO_INMUTABLE');

    const errorDelete = await captureDbError(() =>
      db.$executeRawUnsafe(
        'DELETE FROM fogoneria.movimientos_caja WHERE id = $1',
        movimientoId,
      ),
    );
    expectDbError(errorDelete, 'DB_MOVIMIENTO_INMUTABLE');
  });

  it('el comprobante nace PAGADA y solo se anula una vez', async () => {
    const errorNaceAnulado = await captureDbError(() =>
      db.$executeRawUnsafe(
        `INSERT INTO fogoneria.comprobantes
           (empresa_id, sucursal_id, serie_numero, orden_id, total, estado)
         VALUES ($1, $2, 'B001-0001', $3, 10, 'ANULADA')`,
        tenant.empresaId,
        tenant.sucursalId,
        ordenId,
      ),
    );
    expectDbError(errorNaceAnulado, 'DB_COMPROBANTE_ESTADO_INICIAL');

    const [comprobante] = await db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO fogoneria.comprobantes
         (empresa_id, sucursal_id, serie_numero, orden_id, total)
       VALUES ($1, $2, 'B001-0002', $3, 10)
       RETURNING id`,
      tenant.empresaId,
      tenant.sucursalId,
      ordenId,
    );

    const errorSinMotivo = await captureDbError(() =>
      db.$executeRawUnsafe(
        `UPDATE fogoneria.comprobantes SET estado = 'ANULADA' WHERE id = $1`,
        comprobante.id,
      ),
    );
    expectDbError(errorSinMotivo, 'DB_ANULACION_INCOMPLETA');

    await db.$executeRawUnsafe(
      `UPDATE fogoneria.comprobantes
          SET estado = 'ANULADA', anulado_por = $2, anulado_at = now(), motivo_anulacion = 'Error de emisión'
        WHERE id = $1`,
      comprobante.id,
      tenant.usuarioId,
    );

    const errorAnulado = await captureDbError(() =>
      db.$executeRawUnsafe(
        `UPDATE fogoneria.comprobantes SET motivo_anulacion = 'Otro' WHERE id = $1`,
        comprobante.id,
      ),
    );
    expectDbError(errorAnulado, 'DB_COMPROBANTE_ANULADO');

    const errorBorrar = await captureDbError(() =>
      db.$executeRawUnsafe(
        'DELETE FROM fogoneria.comprobantes WHERE id = $1',
        comprobante.id,
      ),
    );
    expectDbError(errorBorrar, 'DB_COMPROBANTE_NO_BORRABLE');
  });

  it('las órdenes respetan las transiciones del KDS y quedan congeladas', async () => {
    await db.$executeRawUnsafe(
      `UPDATE fogoneria.ordenes SET estado = 'PAGADA' WHERE id = $1`,
      ordenId,
    );

    const errorRetroceso = await captureDbError(() =>
      db.$executeRawUnsafe(
        `UPDATE fogoneria.ordenes SET estado = 'EN_COCINA' WHERE id = $1`,
        ordenId,
      ),
    );
    expectDbError(errorRetroceso, 'DB_ORDEN_CERRADA');

    const errorBorrar = await captureDbError(() =>
      db.$executeRawUnsafe('DELETE FROM fogoneria.ordenes WHERE id = $1', ordenId),
    );
    expectDbError(errorBorrar, 'DB_ORDEN_NO_BORRABLE');
  });

  it('rechaza transiciones no permitidas', async () => {
    const porConfirmar = await createOrden(db, tenant, 'POR_CONFIRMAR', 'ORD-PC');

    const error = await captureDbError(() =>
      db.$executeRawUnsafe(
        `UPDATE fogoneria.ordenes SET estado = 'PAGADA' WHERE id = $1`,
        porConfirmar,
      ),
    );

    expectDbError(error, 'DB_ORDEN_TRANSICION_INVALIDA');
  });

  it('las líneas de una orden pagada no se modifican', async () => {
    await db.$executeRawUnsafe(
      `UPDATE fogoneria.ordenes SET estado = 'PAGADA' WHERE id = $1`,
      ordenId,
    );

    const error = await captureDbError(() =>
      db.$executeRawUnsafe(
        `INSERT INTO fogoneria.detalles_orden
           (orden_id, tipo, plato_id, cantidad, precio_unitario, subtotal)
         VALUES ($1, 'PLATO', $2, 1, 10, 10)`,
        ordenId,
        tenant.platoId,
      ),
    );

    expectDbError(error, 'DB_DETALLE_INMUTABLE');
  });

  it('el kardex es append-only', async () => {
    const [insumo] = await db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO fogoneria.insumos (empresa_id, nombre)
       VALUES ($1, 'Insumo')
       RETURNING id`,
      tenant.empresaId,
    );

    const [movimiento] = await db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO fogoneria.movimientos_inventario
         (empresa_id, sucursal_id, insumo_id, tipo, cantidad)
       VALUES ($1, $2, $3, 'ENTRADA', 5)
       RETURNING id`,
      tenant.empresaId,
      tenant.sucursalId,
      insumo.id,
    );

    const errorUpdate = await captureDbError(() =>
      db.$executeRawUnsafe(
        `UPDATE fogoneria.movimientos_inventario SET cantidad = 99 WHERE id = $1`,
        movimiento.id,
      ),
    );
    expectDbError(errorUpdate, 'DB_KARDEX_INMUTABLE');

    const errorDelete = await captureDbError(() =>
      db.$executeRawUnsafe(
        'DELETE FROM fogoneria.movimientos_inventario WHERE id = $1',
        movimiento.id,
      ),
    );
    expectDbError(errorDelete, 'DB_KARDEX_INMUTABLE');
  });

  it('la auditoría no se edita ni se borra', async () => {
    const [registro] = await db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO fogoneria.auditoria (empresa_id, accion, entidad)
       VALUES ($1, 'TEST', 'prueba')
       RETURNING id`,
      tenant.empresaId,
    );

    const errorDelete = await captureDbError(() =>
      db.$executeRawUnsafe('DELETE FROM fogoneria.auditoria WHERE id = $1', registro.id),
    );
    expectDbError(errorDelete, 'DB_AUDITORIA_INMUTABLE');
  });

  it('un gasto pagado en caja no cambia de monto', async () => {
    const [gasto] = await db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO fogoneria.gastos
         (empresa_id, sucursal_id, concepto, monto, categoria, pagado_en_caja, turno_id)
       VALUES ($1, $2, 'Compra', 50, 'INSUMOS', true, $3)
       RETURNING id`,
      tenant.empresaId,
      tenant.sucursalId,
      turnoAbierto,
    );

    const error = await captureDbError(() =>
      db.$executeRawUnsafe(
        `UPDATE fogoneria.gastos SET monto = 10 WHERE id = $1`,
        gasto.id,
      ),
    );

    expectDbError(error, 'DB_GASTO_PAGADO');
  });
});
