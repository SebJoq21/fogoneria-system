import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import {
  captureDbError,
  createDb,
  createTenant,
  expectDbError,
  hasTestDatabase,
  resetDatabase,
  type TenantFixture,
} from './helpers.js';

const describeDb = hasTestDatabase ? describe : describe.skip;

describeDb('Baja lógica en entidades maestras (AYCDS-62)', () => {
  let db: PrismaClient;
  let tenant: TenantFixture;

  beforeAll(() => {
    db = createDb();
  });

  beforeEach(async () => {
    await resetDatabase(db);
    tenant = await createTenant(db, 'Soft', 'SKU-REUSABLE');
  });

  afterAll(async () => {
    await resetDatabase(db).catch(() => undefined);
    await db.$disconnect();
  });

  it('DELETE deja la fila con deleted_at y cancela el borrado físico', async () => {
    const afectadas = await db.$executeRawUnsafe(
      'DELETE FROM fogoneria.platos WHERE id = $1',
      tenant.platoId,
    );

    expect(afectadas).toBe(0);

    const [fila] = await db.$queryRawUnsafe<{ deleted_at: Date | null }[]>(
      'SELECT deleted_at FROM fogoneria.platos WHERE id = $1',
      tenant.platoId,
    );

    expect(fila?.deleted_at).toBeInstanceOf(Date);
  });

  it('guarda el actor de la baja si hay contexto de sesión', async () => {
    await db.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        `SELECT set_config('app.usuario_id', $1, true)`,
        tenant.usuarioId,
      );
      await tx.$executeRawUnsafe(
        'DELETE FROM fogoneria.platos WHERE id = $1',
        tenant.platoId,
      );
    });

    const [fila] = await db.$queryRawUnsafe<{ deleted_by: string | null }[]>(
      'SELECT deleted_by FROM fogoneria.platos WHERE id = $1',
      tenant.platoId,
    );

    expect(fila?.deleted_by).toBe(tenant.usuarioId);
  });

  it('permite reutilizar el SKU de una fila dada de baja', async () => {
    await db.$executeRawUnsafe('DELETE FROM fogoneria.platos WHERE id = $1', tenant.platoId);

    const [nuevo] = await db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO fogoneria.platos (empresa_id, categoria_id, sku, nombre)
       VALUES ($1, $2, 'SKU-REUSABLE', 'Plato nuevo')
       RETURNING id`,
      tenant.empresaId,
      tenant.categoriaId,
    );

    expect(nuevo?.id).toBeTruthy();
  });

  it('mantiene la unicidad entre filas vigentes', async () => {
    const error = await captureDbError(() =>
      db.$executeRawUnsafe(
        `INSERT INTO fogoneria.platos (empresa_id, categoria_id, sku, nombre)
         VALUES ($1, $2, 'SKU-REUSABLE', 'Duplicado')`,
        tenant.empresaId,
        tenant.categoriaId,
      ),
    );

    expect(error.message).toContain('uq_platos_empresa_sku');
  });

  it('restaura una fila dada de baja', async () => {
    await db.$executeRawUnsafe('DELETE FROM fogoneria.platos WHERE id = $1', tenant.platoId);

    const [restaurada] = await db.$queryRawUnsafe<{ restore_row: boolean }[]>(
      `SELECT fogoneria.restore_row('platos', $1) AS restore_row`,
      tenant.platoId,
    );

    expect(restaurada?.restore_row).toBe(true);

    const [fila] = await db.$queryRawUnsafe<{ deleted_at: Date | null }[]>(
      'SELECT deleted_at FROM fogoneria.platos WHERE id = $1',
      tenant.platoId,
    );

    expect(fila?.deleted_at).toBeNull();
  });

  it('rechaza restaurar tablas fuera de la lista blanca', async () => {
    const error = await captureDbError(() =>
      db.$queryRawUnsafe(
        `SELECT fogoneria.restore_row('comprobantes', '00000000-0000-0000-0000-000000000000')`,
      ),
    );

    expectDbError(error, 'DB_TABLA_NO_RESTAURABLE');
  });
});
