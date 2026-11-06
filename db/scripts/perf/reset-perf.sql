-- ============================================================================
-- AYCDS-22 — Limpieza del volumen sintético
--
-- Borra solo las órdenes `PERF-%` (y sus líneas por CASCADE). El demo, las
-- comandas reales de la prueba y el resto del catálogo quedan intactos.
--
-- El trigger `trg_ordenes_inmutable` prohíbe DELETE, así que se desactiva
-- dentro de esta transacción (`session_replication_role = replica`). Es un
-- script de mantenimiento, no una ruta de la API.
--
-- Uso:
--   pnpm --filter api perf:reset
-- ============================================================================

BEGIN;

SELECT set_config('app.bypass', 'on', true);
SET LOCAL session_replication_role = replica;

DELETE FROM fogoneria.ordenes WHERE numero_orden LIKE 'PERF-%';

COMMIT;
