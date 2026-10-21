-- ============================================================================
-- AYCDS-62 — Rol de aplicación con RLS
--
-- Ejecutar UNA vez por clúster, como superusuario, después de las migraciones:
--   psql "$DATABASE_URL" -f db/scripts/rls/000-roles.sql
--
-- Por qué un rol aparte: el dueño de las tablas (fogoneria_app) ignora RLS
-- salvo que se use FORCE. La API de negocio debe conectar con `fogoneria_rls`
-- (sin BYPASSRLS) y la consola SaaS / migraciones con un rol con BYPASSRLS.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fogoneria_rls') THEN
    CREATE ROLE fogoneria_rls
      LOGIN
      PASSWORD 'fogoneria_rls'
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOBYPASSRLS;
  END IF;
END
$$;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO fogoneria_rls', current_database());
END
$$;

GRANT USAGE ON SCHEMA fogoneria TO fogoneria_rls;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA fogoneria TO fogoneria_rls;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA fogoneria TO fogoneria_rls;

-- Tablas y secuencias que se creen en el futuro (migraciones).
ALTER DEFAULT PRIVILEGES IN SCHEMA fogoneria
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fogoneria_rls;
ALTER DEFAULT PRIVILEGES IN SCHEMA fogoneria
  GRANT USAGE, SELECT ON SEQUENCES TO fogoneria_rls;

-- Restaurar bajas lógicas queda reservado al rol de administración.
REVOKE ALL ON FUNCTION fogoneria.restore_row(text, uuid) FROM fogoneria_rls;
