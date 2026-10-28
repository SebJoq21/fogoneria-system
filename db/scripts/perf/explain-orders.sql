-- ============================================================================
-- AYCDS-22 — EXPLAIN (ANALYZE, BUFFERS) de las consultas de comanda
--
-- Se ejecuta como rol de negocio (sin BYPASSRLS) para que el plan incluya las
-- políticas RLS tal como las ve la API:
--
--   psql "postgresql://fogoneria_rls:fogoneria_rls@localhost:5433/fogoneria_db?options=-csearch_path%3Dfogoneria" \
--        -f db/scripts/perf/explain-orders.sql
--
-- Todo corre dentro de una transacción que termina en ROLLBACK: el INSERT de
-- prueba y el incremento del folio no quedan en la base.
-- ============================================================================

\set ON_ERROR_STOP on
\set empresa '11111111-1111-4111-8111-111111111111'
\set sucursal '22222222-2222-4222-8222-222222222222'
\set mesa '00000000-0000-4000-8000-000000000000'

BEGIN;

SELECT set_config('app.empresa_id', :'empresa', true)
\gset
SELECT set_config('app.sucursal_id', :'sucursal', true)
\gset
SELECT set_config('app.bypass', 'off', true)
\gset

\echo ''
\echo '### 1. KDS — listado por estado (LIMIT 20)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.id, o.numero_orden, o.estado, o.total, o.created_at
  FROM fogoneria.ordenes AS o
 WHERE o.empresa_id = :'empresa'
   AND o.sucursal_id = :'sucursal'
   AND o.estado = 'EN_COCINA'
 ORDER BY o.created_at DESC
 LIMIT 20;

\echo ''
\echo '### 2. KDS — count del listado (paginación)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*)
  FROM fogoneria.ordenes AS o
 WHERE o.empresa_id = :'empresa'
   AND o.sucursal_id = :'sucursal'
   AND o.estado = 'EN_COCINA';

\echo ''
\echo '### 3. Detalle de una comanda (findOne con líneas)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT d.id, d.orden_id, d.plato_id, d.cantidad, d.precio_unitario
  FROM fogoneria.detalles_orden AS d
 WHERE d.orden_id = (
   SELECT id FROM fogoneria.ordenes
    WHERE numero_orden = 'PERF-000001'
 );

\echo ''
\echo '### 4. Liberación de mesa — órdenes abiertas de la mesa'
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*)
  FROM fogoneria.ordenes AS o
 WHERE o.empresa_id = :'empresa'
   AND o.mesa_id = (
     SELECT mesa_id FROM fogoneria.ordenes
      WHERE numero_orden = 'PERF-000001'
   )
   AND o.estado IN ('POR_CONFIRMAR', 'EN_COCINA', 'LISTO', 'ENTREGADO');

\echo ''
\echo '### 5. Folio — upsert atómico de la secuencia'
EXPLAIN (ANALYZE, BUFFERS)
INSERT INTO fogoneria.secuencias (empresa_id, tipo, valor)
VALUES (:'empresa'::uuid, 'ORD', 1)
ON CONFLICT (empresa_id, tipo)
DO UPDATE SET valor = fogoneria.secuencias.valor + 1, updated_at = now()
RETURNING valor;

\echo ''
\echo '### 6. Alta de comanda — INSERT de la orden'
EXPLAIN (ANALYZE, BUFFERS)
INSERT INTO fogoneria.ordenes (
  empresa_id, sucursal_id, numero_orden, mesero_id, origen, estado,
  subtotal, total, lista_precio_id, created_at, updated_at
)
VALUES (
  :'empresa'::uuid,
  :'sucursal'::uuid,
  'EXPLAIN-' || extract(epoch FROM clock_timestamp())::bigint,
  '55555555-5555-4555-8555-555555555559'::uuid,
  'BARRA',
  'POR_CONFIRMAR',
  40.00, 40.00,
  (SELECT id FROM fogoneria.listas_precios WHERE empresa_id = :'empresa' ORDER BY activa DESC LIMIT 1),
  now(), now()
);

ROLLBACK;
