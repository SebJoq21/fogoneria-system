import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  type Prisma,
} from '../../src/generated/prisma/client.js';

/**
 * Utilidades para las pruebas contra PostgreSQL real (AYCDS-62).
 *
 * Requisitos:
 *   - `DATABASE_URL_TEST` apuntando a una base DESCARTABLE con las migraciones
 *     aplicadas (`pnpm --filter api exec prisma migrate deploy`).
 *   - El usuario de esa URL debe poder crear roles o el rol `fogoneria_rls`
 *     debe existir (`db/scripts/rls/000-roles.sql`).
 *
 * Si `DATABASE_URL_TEST` no está definida, los specs se saltan: el `pnpm test`
 * normal sigue funcionando sin Postgres.
 */
const RAW_URL = process.env.DATABASE_URL_TEST;

export const hasTestDatabase = Boolean(RAW_URL);

export function createDb(): PrismaClient {
  if (!RAW_URL) throw new Error('DATABASE_URL_TEST no está definida');
  const schema = new URL(RAW_URL).searchParams.get('schema') ?? 'fogoneria';
  return new PrismaClient({
    adapter: new PrismaPg(RAW_URL, { schema }),
  });
}

export type Tx = Prisma.TransactionClient;

export interface TenantFixture {
  empresaId: string;
  sucursalId: string;
  usuarioId: string;
  categoriaId: string;
  platoId: string;
}

export interface DbErrorText {
  code?: string;
  message: string;
}

export async function captureDbError(fn: () => Promise<unknown>): Promise<DbErrorText> {
  try {
    await fn();
  } catch (error) {
    const e = error as {
      code?: string;
      message?: string;
      meta?: { code?: string; message?: string };
    };
    return {
      code: e.meta?.code ?? e.code,
      message: String(e.meta?.message ?? e.message ?? error),
    };
  }
  throw new Error('Se esperaba un error de PostgreSQL y la operación se ejecutó sin error.');
}

export function expectDbError(error: DbErrorText, codigo: string): void {
  if (!error.message.includes(codigo)) {
    throw new Error(`Se esperaba el código ${codigo} y llegó: ${error.message}`);
  }
}

/** Trunca el modelo completo. `CASCADE` arrastra las tablas hijas. */
export async function resetDatabase(db: PrismaClient): Promise<void> {
  await db.$executeRawUnsafe(
    'TRUNCATE fogoneria.empresas, fogoneria.leads_cotizaciones CASCADE',
  );
}

/** Crea (si falta) y otorga permisos al rol sin BYPASSRLS usado en las pruebas. */
export async function prepareRlsRole(db: PrismaClient): Promise<void> {
  await db.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fogoneria_rls') THEN
        CREATE ROLE fogoneria_rls NOLOGIN NOSUPERUSER NOBYPASSRLS;
      END IF;
    END
    $$;
  `);
  await db.$executeRawUnsafe('GRANT USAGE ON SCHEMA fogoneria TO fogoneria_rls');
  await db.$executeRawUnsafe(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA fogoneria TO fogoneria_rls',
  );
}

/**
 * Cambia a `fogoneria_rls` y fija el contexto de sesión dentro de la
 * transacción en curso. Debe llamarse dentro de `$transaction`.
 */
export async function asTenant(
  tx: Tx,
  options: { empresaId?: string; sucursalId?: string; bypass?: boolean },
): Promise<void> {
  await tx.$executeRawUnsafe('SET LOCAL ROLE fogoneria_rls');
  await tx.$queryRawUnsafe(
    `SELECT set_config('app.empresa_id', $1, true)`,
    options.empresaId ?? '',
  );
  await tx.$queryRawUnsafe(
    `SELECT set_config('app.sucursal_id', $1, true)`,
    options.sucursalId ?? '',
  );
  await tx.$queryRawUnsafe(
    `SELECT set_config('app.bypass', $1, true)`,
    options.bypass ? 'on' : 'off',
  );
}

function rucAleatorio(): string {
  return String(Math.floor(Math.random() * 100_000_000_000)).padStart(11, '0');
}

/**
 * Crea una empresa completa con sucursal, usuario, categoría y un plato.
 * Los RUC/emails son aleatorios para no chocar con datos existentes.
 */
export async function createTenant(
  db: PrismaClient,
  etiqueta: string,
  sku = `SKU-${Math.random().toString(36).slice(2, 8)}`,
): Promise<TenantFixture> {
  const [empresa] = await db.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO fogoneria.empresas (nombre_legal, ruc)
     VALUES ($1, $2)
     RETURNING id`,
    `Empresa ${etiqueta}`,
    rucAleatorio(),
  );

  const [sucursal] = await db.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO fogoneria.sucursales (empresa_id, nombre)
     VALUES ($1, $2)
     RETURNING id`,
    empresa.id,
    `Sucursal ${etiqueta}`,
  );

  const [usuario] = await db.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO fogoneria.usuarios (empresa_id, nombre, email, password_hash, rol)
     VALUES ($1, $2, $3, 'x', 'ADMIN_GLOBAL')
     RETURNING id`,
    empresa.id,
    `Usuario ${etiqueta}`,
    `${etiqueta.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.local`,
  );

  const [categoria] = await db.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO fogoneria.categorias (empresa_id, nombre)
     VALUES ($1, $2)
     RETURNING id`,
    empresa.id,
    `Categoría ${etiqueta}`,
  );

  const [plato] = await db.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO fogoneria.platos (empresa_id, categoria_id, sku, nombre)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    empresa.id,
    categoria.id,
    sku,
    `Plato ${etiqueta}`,
  );

  return {
    empresaId: empresa.id,
    sucursalId: sucursal.id,
    usuarioId: usuario.id,
    categoriaId: categoria.id,
    platoId: plato.id,
  };
}

export async function createOrden(
  db: PrismaClient,
  tenant: TenantFixture,
  estado = 'ENTREGADO',
  numero = `ORD-${Math.random().toString(36).slice(2, 8)}`,
): Promise<string> {
  const [orden] = await db.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO fogoneria.ordenes (empresa_id, sucursal_id, numero_orden, estado, subtotal, total)
     VALUES ($1, $2, $3, $4, 10, 10)
     RETURNING id`,
    tenant.empresaId,
    tenant.sucursalId,
    numero,
    estado,
  );
  return orden.id;
}

export async function createTurno(
  db: PrismaClient,
  tenant: TenantFixture,
  estado: 'ABIERTO' | 'CERRADO' = 'ABIERTO',
): Promise<string> {
  const [turno] = await db.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO fogoneria.turnos_caja (empresa_id, sucursal_id, estado, cierre_at)
     VALUES ($1, $2, $3, CASE WHEN $3 = 'CERRADO' THEN now() + interval '1 minute' ELSE NULL END)
     RETURNING id`,
    tenant.empresaId,
    tenant.sucursalId,
    estado,
  );
  return turno.id;
}
