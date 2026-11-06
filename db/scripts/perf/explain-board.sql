-- ============================================================================
-- AYCDS-30 — EXPLAIN (ANALYZE, BUFFERS) del tablero del KDS
--
-- Se ejecuta como rol de negocio (sin BYPASSRLS) para que el plan incluya las
-- políticas RLS tal como las ve la API:
--
--   psql "postgresql://fogoneria_rls:fogoneria_rls@localhost:5433/fogoneria_db?options=-csearch_path%3Dfogoneria" \
--        -f db/scripts/perf/explain-board.sql
--
-- Requiere el dataset de AYCDS-22 (`pnpm --filter api perf:seed`). Todo corre
-- dentro de una transacción que termina en ROLLBACK.
-- ============================================================================

\set ON_ERROR_STOP on
\set empresa '11111111-1111-4111-8111-111111111111'
\set sucursal '22222222-2222-4222-8222-222222222222'

BEGIN;

SELECT set_config('app.empresa_id', :'empresa', true)
\gset
SELECT set_config('app.sucursal_id', :'sucursal', true)
\gset
SELECT set_config('app.bypass', 'off', true)
\gset

\echo ''
\echo '### 1. Tablero acotado: sucursal + estados abiertos + 7 días + LIMIT 200 (AYCDS-30)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.id, o.numero_orden, o.estado, o.total, o.created_at,
       o.confirmacion_at, o.listo_at, o.mesa_id, o.alerta_sla
  FROM fogoneria.ordenes AS o
 WHERE o.empresa_id = :'empresa'
   AND o.sucursal_id = :'sucursal'
   AND o.estado IN ('POR_CONFIRMAR', 'EN_COCINA', 'LISTO', 'ENTREGADO')
   AND o.created_at >= now() - interval '7 days'
 ORDER BY o.created_at ASC
 LIMIT 200;

\echo ''
\echo '### 2. Contraste: el mismo listado sin ventana ni límite (patrón anterior)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.id, o.numero_orden, o.estado, o.total, o.created_at
  FROM fogoneria.ordenes AS o
 WHERE o.empresa_id = :'empresa'
   AND o.sucursal_id = :'sucursal'
   AND o.estado IN ('POR_CONFIRMAR', 'EN_COCINA', 'LISTO', 'ENTREGADO')
 ORDER BY o.created_at ASC;

\echo ''
\echo '### 3. Métricas: comandas que llegaron a LISTO en los últimos 7 días'
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.ingreso_at, o.confirmacion_at, o.listo_at
  FROM fogoneria.ordenes AS o
 WHERE o.empresa_id = :'empresa'
   AND o.sucursal_id = :'sucursal'
   AND o.created_at >= now() - interval '7 days'
   AND o.listo_at IS NOT NULL;

\echo ''
\echo '### 4. Barrido de SLA: pendientes de marcar (cada minuto)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.id, o.numero_orden, o.estado, o.empresa_id, o.sucursal_id, o.ingreso_at
  FROM fogoneria.ordenes AS o
 WHERE o.estado IN ('POR_CONFIRMAR', 'EN_COCINA', 'LISTO')
   AND o.alerta_sla = false
   AND (o.confirmacion_at < now() - interval '20 minutes'
        OR (o.confirmacion_at IS NULL AND o.ingreso_at < now() - interval '20 minutes'))
 LIMIT 500;

ROLLBACK;
