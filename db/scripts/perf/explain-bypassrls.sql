-- ============================================================================
-- AYCDS-22 — diagnóstico de lectura: el MISMO listado del KDS, pero con un rol
-- que ve las estadísticas del planner (BYPASSRLS).
--
-- No es el rol de la API: sirve solo para comparar cuánto cuesta el listado
-- cuando el planner conoce la distribución de `estado`. Se ejecuta como dueño:
--
--   psql "postgresql://fogoneria_app:fogoneria_app@localhost:5433/fogoneria_db?options=-csearch_path%3Dfogoneria" \
--        -f db/scripts/perf/explain-bypassrls.sql
--
-- Ver `docs/explain-orders.md` (hallazgo de lectura).
-- ============================================================================

\set ON_ERROR_STOP on
\set empresa '11111111-1111-4111-8111-111111111111'
\set sucursal '22222222-2222-4222-8222-222222222222'

BEGIN;

\echo ''
\echo '### A. KDS — listado por estado (LIMIT 20), planificador con estadísticas'
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.id, o.numero_orden, o.estado, o.total, o.created_at
  FROM fogoneria.ordenes AS o
 WHERE o.empresa_id = :'empresa'
   AND o.sucursal_id = :'sucursal'
   AND o.estado = 'EN_COCINA'
 ORDER BY o.created_at DESC
 LIMIT 20;

\echo ''
\echo '### B. KDS — count del listado, planificador con estadísticas'
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*)
  FROM fogoneria.ordenes AS o
 WHERE o.empresa_id = :'empresa'
   AND o.sucursal_id = :'sucursal'
   AND o.estado = 'EN_COCINA';

ROLLBACK;
