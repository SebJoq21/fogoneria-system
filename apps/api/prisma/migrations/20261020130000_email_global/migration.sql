-- ============================================================================
-- AYCDS-53/55 — Email único global para usuarios activos
--
-- El login busca por email sin tenant. Se reemplaza la unicidad por empresa
-- por una única global entre filas no eliminadas; un usuario soft-deleted
-- libera su correo para reutilizarlo.
-- ============================================================================

SET search_path TO fogoneria, public;

-- Detecta duplicados activos antes de crear el índice (falla con mensaje claro
-- en vez de un error opaco de Postgres).
DO $$
DECLARE
  duplicados integer;
BEGIN
  SELECT count(*) INTO duplicados
  FROM (
    SELECT email
    FROM fogoneria.usuarios
    WHERE deleted_at IS NULL
    GROUP BY email
    HAVING count(*) > 1
  ) d;

  IF duplicados > 0 THEN
    RAISE EXCEPTION 'Hay % correos activos duplicados; resuélvelos antes de aplicar AYCDS-53/55', duplicados;
  END IF;
END
$$;

DROP INDEX IF EXISTS fogoneria.uq_usuarios_email_global;
DROP INDEX IF EXISTS fogoneria.uq_usuarios_empresa_email;

CREATE UNIQUE INDEX uq_usuarios_email_activo
  ON fogoneria.usuarios (email)
  WHERE deleted_at IS NULL;

COMMENT ON INDEX fogoneria.uq_usuarios_email_activo IS
  'AYCDS-53/55: el email identifica al usuario en el login; único entre activos.';
