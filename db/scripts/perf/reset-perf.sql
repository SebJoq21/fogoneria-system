-- ============================================================================
-- AYCDS-22 — Limpieza del volumen sintético
--
-- Borra solo las órdenes `PERF-%` y todo lo que cuelga de ellas; el demo, las
-- comandas reales y el resto del catálogo quedan intactos.
--
-- El trigger `trg_ordenes_inmutable` prohíbe DELETE, así que se desactiva
-- dentro de esta transacción (`session_replication_role = replica`). Es un
-- script de mantenimiento, no una ruta de la API.
--
-- OJO (AYCDS-38): con `session_replication_role = replica` **tampoco corren los
-- CASCADE**, porque las claves foráneas se implementan con triggers. Por eso las
-- hijas se borran explícitamente y en orden: dejarlas sueltas rompe cualquier
-- `pg_restore` (el dump falla al insertar líneas sin comanda).
--
-- Uso:
--   pnpm --filter api perf:reset
-- ============================================================================

BEGIN;

SELECT set_config('app.bypass', 'on', true);
SET LOCAL session_replication_role = replica;

CREATE TEMP TABLE perf_ordenes ON COMMIT DROP AS
  SELECT id FROM fogoneria.ordenes WHERE numero_orden LIKE 'PERF-%';

DELETE FROM fogoneria.movimientos_puntos
 WHERE orden_id IN (SELECT id FROM perf_ordenes);

DELETE FROM fogoneria.movimientos_inventario
 WHERE orden_id IN (SELECT id FROM perf_ordenes);

DELETE FROM fogoneria.movimientos_caja
 WHERE orden_id IN (SELECT id FROM perf_ordenes);

DELETE FROM fogoneria.comprobantes
 WHERE orden_id IN (SELECT id FROM perf_ordenes);

DELETE FROM fogoneria.canjes_cupones
 WHERE orden_id IN (SELECT id FROM perf_ordenes);

DELETE FROM fogoneria.detalles_orden_modificadores
 WHERE detalle_id IN (
   SELECT d.id FROM fogoneria.detalles_orden d
   JOIN perf_ordenes p ON p.id = d.orden_id
 );

DELETE FROM fogoneria.detalles_orden
 WHERE orden_id IN (SELECT id FROM perf_ordenes);

DELETE FROM fogoneria.ordenes
 WHERE id IN (SELECT id FROM perf_ordenes);

COMMIT;
