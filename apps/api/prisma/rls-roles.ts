/**
 * AYCDS-62 — Provisiona los roles de RLS de un entorno ya migrado.
 *
 * La app separa dos conexiones (ver `docs/rls-modelo.md`):
 *   - `fogoneria_rls`  → rol de negocio, **sin** BYPASSRLS: las políticas de
 *     tenant se aplican siempre. Es el `DATABASE_URL_RLS`.
 *   - `fogoneria_saas` → rol de plataforma, **con** BYPASSRLS: auth, onboarding,
 *     consola SaaS y folios. Es el `DATABASE_URL_SAAS`.
 *
 * Uso, una vez por entorno (o cuando se roten las contraseñas), conectando como
 * el dueño del esquema / superusuario:
 *
 *   DATABASE_URL=... \
 *   RLS_RLS_PASSWORD=... \
 *   RLS_SAAS_PASSWORD=... \
 *   npx tsx prisma/rls-roles.ts
 *
 * Es idempotente: crea el rol si falta, actualiza la contraseña y reaplica los
 * grants (incluidos los privilegios por defecto de las tablas futuras).
 *
 * No ejecuta `FORCE ROW LEVEL SECURITY`: con roles separados no hace falta (el
 * dueño de las tablas se salta las políticas, el rol de negocio no) y forzarlo
 * bloquearía migraciones y seed, que conectan como dueño.
 */
import 'dotenv/config';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;
const schema = process.env.DATABASE_SCHEMA ?? 'fogoneria';
const rlsPassword = process.env.RLS_RLS_PASSWORD;
const saasPassword = process.env.RLS_SAAS_PASSWORD;

if (!connectionString) throw new Error('DATABASE_URL no está definida');
if (!rlsPassword || !saasPassword) {
  throw new Error('Faltan RLS_RLS_PASSWORD y/o RLS_SAAS_PASSWORD');
}
if (!/^[a-z_][a-z0-9_]*$/.test(schema)) {
  throw new Error(`DATABASE_SCHEMA inválido: ${schema}`);
}

type RoleSpec = {
  name: string;
  password: string;
  bypassRls: boolean;
};

const ROLES: RoleSpec[] = [
  { name: 'fogoneria_rls', password: rlsPassword, bypassRls: false },
  { name: 'fogoneria_saas', password: saasPassword, bypassRls: true },
];

const client = new Client({ connectionString });

async function main(): Promise<void> {
  await client.connect();

  const database = await client.query<{ db: string }>('SELECT current_database() AS db');
  const db = database.rows[0]?.db;
  if (!db) throw new Error('No se pudo resolver current_database()');

  const schemaSql = client.escapeIdentifier(schema);
  const dbSql = client.escapeIdentifier(db);
  const created: string[] = [];

  for (const role of ROLES) {
    const exists = await client.query<{ exists: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS exists',
      [role.name],
    );
    if (!exists.rows[0]?.exists) {
      // Sin contraseña en el CREATE: se fija justo después con ALTER ROLE.
      await client.query(
        `CREATE ROLE ${client.escapeIdentifier(role.name)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`,
      );
      created.push(role.name);
    }

    await client.query(
      `ALTER ROLE ${client.escapeIdentifier(role.name)} WITH LOGIN PASSWORD ${client.escapeLiteral(role.password)}`,
    );
    await client.query(
      `ALTER ROLE ${client.escapeIdentifier(role.name)} ${role.bypassRls ? 'BYPASSRLS' : 'NOBYPASSRLS'}`,
    );

    await client.query(`GRANT CONNECT ON DATABASE ${dbSql} TO ${client.escapeIdentifier(role.name)}`);
    await client.query(`GRANT USAGE ON SCHEMA ${schemaSql} TO ${client.escapeIdentifier(role.name)}`);
    await client.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${schemaSql} TO ${client.escapeIdentifier(role.name)}`,
    );
    await client.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ${schemaSql} TO ${client.escapeIdentifier(role.name)}`,
    );
    // Tablas y secuencias que creen las migraciones futuras.
    await client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA ${schemaSql} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${client.escapeIdentifier(role.name)}`,
    );
    await client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA ${schemaSql} GRANT USAGE, SELECT ON SEQUENCES TO ${client.escapeIdentifier(role.name)}`,
    );
  }

  // Restaurar bajas lógicas queda reservado al rol de administración.
  const restoreRow = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = $1 AND p.proname = 'restore_row'
     ) AS exists`,
    [schema],
  );
  if (restoreRow.rows[0]?.exists) {
    await client.query(
      `REVOKE ALL ON FUNCTION ${schemaSql}.restore_row(text, uuid) FROM fogoneria_rls, fogoneria_saas`,
    );
  }

  const bypass = await client.query<{ rolname: string; rolbypassrls: boolean }>(
    `SELECT rolname, rolbypassrls
       FROM pg_roles
      WHERE rolname = ANY($1::text[])
      ORDER BY rolname`,
    [ROLES.map((role) => role.name)],
  );

  console.log('Roles de RLS provisionados:', {
    database: db,
    schema,
    created,
    roles: bypass.rows,
  });
  console.log('Siguiente paso: apuntar DATABASE_URL_RLS / DATABASE_URL_SAAS a esos roles y reiniciar la API.');
}

try {
  await main();
} catch (error) {
  console.error('No se pudieron provisionar los roles de RLS:', error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
