import { afterAll, beforeEach, describe, expect, it } from 'vitest';
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

describeDb('Email global de usuarios activos (AYCDS-53/55)', () => {
  let db: PrismaClient;
  let empresaA: TenantFixture;
  let empresaB: TenantFixture;
  const email = `compartido-${Date.now()}@test.local`;

  beforeAll(() => {
    db = createDb();
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

  it('rechaza el mismo email activo en dos empresas', async () => {
    await db.$executeRawUnsafe(
      `INSERT INTO fogoneria.usuarios (empresa_id, nombre, email, password_hash, rol)
       VALUES ($1, 'Original', $2, 'x', 'ADMIN_GLOBAL')`,
      empresaA.empresaId,
      email,
    );

    const error = await captureDbError(() =>
      db.$executeRawUnsafe(
        `INSERT INTO fogoneria.usuarios (empresa_id, nombre, email, password_hash, rol)
         VALUES ($1, 'Duplicado', $2, 'x', 'ADMIN_GLOBAL')`,
        empresaB.empresaId,
        email,
      ),
    );

    expectDbError(error, 'uq_usuarios_email_activo');
  });

  it('permite reutilizar el email de un usuario soft-deleted', async () => {
    await db.$executeRawUnsafe(
      `INSERT INTO fogoneria.usuarios (empresa_id, nombre, email, password_hash, rol)
       VALUES ($1, 'Original', $2, 'x', 'ADMIN_GLOBAL')`,
      empresaA.empresaId,
      email,
    );
    await db.$executeRawUnsafe(
      `UPDATE fogoneria.usuarios SET deleted_at = now() WHERE email = $1 AND empresa_id = $2`,
      email,
      empresaA.empresaId,
    );

    await expect(
      db.$executeRawUnsafe(
        `INSERT INTO fogoneria.usuarios (empresa_id, nombre, email, password_hash, rol)
         VALUES ($1, 'Reutilizado', $2, 'x', 'ADMIN_GLOBAL')`,
        empresaB.empresaId,
        email,
      ),
    ).resolves.toBe(1);
  });
});
