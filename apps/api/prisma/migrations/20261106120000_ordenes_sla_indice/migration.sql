-- ============================================================================
-- AYCDS-30 — Índice parcial para el barrido de SLA del KDS
--
-- El cron de SLA corre cada minuto y busca solo comandas abiertas que todavía
-- no se marcaron. Sin el índice, el planificador no puede estimar `estado` bajo
-- RLS (no ve `pg_statistic`) y recorre las ~50 000 órdenes del dataset:
--
--   Seq Scan on ordenes  (rows=3, Rows Removed by Filter: 50008)  75,7 ms
--
-- El índice parcial guarda únicamente lo que el barrido mira (abiertas y sin
-- marcar), que son decenas de filas, así que el plan deja de depender de la
-- estimación del enum.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ordenes_sla_pendiente
  ON fogoneria.ordenes (empresa_id, confirmacion_at, ingreso_at)
  WHERE alerta_sla = false
    AND estado IN ('POR_CONFIRMAR', 'EN_COCINA', 'LISTO');

COMMENT ON INDEX fogoneria.idx_ordenes_sla_pendiente IS
  'AYCDS-30: comandas abiertas sin alerta de SLA; sirve al barrido por minuto.';
