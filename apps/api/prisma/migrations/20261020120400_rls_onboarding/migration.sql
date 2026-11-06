-- ============================================================================
-- AYCDS-62 — Alta de tenants bajo RLS
--
-- El onboarding crea empresas y sus filas hijas. La política INSERT solo se
-- permite al rol de plataforma con `app.bypass = 'on'` (fogoneria_saas) o a
-- un rol con BYPASSRLS. Sin esta política, FORCE ROW LEVEL SECURITY bloquearía
-- el alta incluso para el dueño de las tablas.
-- ============================================================================

SET search_path TO fogoneria, public;

DROP POLICY IF EXISTS empresas_tenant_insert ON empresas;
CREATE POLICY empresas_tenant_insert ON empresas
  FOR INSERT
  WITH CHECK (fogoneria.is_bypass());

COMMENT ON POLICY empresas_tenant_insert ON empresas IS
  'AYCDS-62: solo el rol de plataforma (bypass) puede crear tenants.';
