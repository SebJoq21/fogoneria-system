-- ============================================================================
-- AYCDS-62 — Activar FORCE ROW LEVEL SECURITY
--
-- NO ejecutar hasta que la API escriba el contexto de sesión en cada
-- transacción:
--
--   SELECT set_config('app.empresa_id',  $1, true);
--   SELECT set_config('app.sucursal_id', $2, true);
--   SELECT set_config('app.usuario_id',  $3, true);
--
-- Con FORCE activo, incluso el dueño de las tablas queda sujeto a las
-- políticas: si el contexto falta, las consultas devuelven 0 filas.
--
-- Revertir:
--   ALTER TABLE fogoneria.<tabla> NO FORCE ROW LEVEL SECURITY;
--
-- Uso:
--   psql "$DATABASE_URL" -f db/scripts/rls/010-force-rls.sql
-- ============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'fogoneria'
      AND c.relkind = 'r'
      AND c.relrowsecurity          -- ya tiene ENABLE ROW LEVEL SECURITY
  LOOP
    EXECUTE format('ALTER TABLE fogoneria.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END
$$;
