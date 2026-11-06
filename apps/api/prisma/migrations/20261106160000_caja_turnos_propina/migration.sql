-- ============================================================================
-- AYCDS-34 — Caja: turnos, propinas y arqueo
--
-- Tres cosas que la tabla no tenía y el arqueo necesita:
--   - `turnos_caja.efectivo_contado`, `diferencia` y `observaciones`: el cierre
--     no puede guardar el conteo solo en auditoría (la UI lo muestra).
--   - `ordenes.propina`: el cobro conoce la propina y AYCDS-33 la reparte por
--     día; sin la columna el pozo no tiene fuente (docs/decisiones.md).
--   - Índice único parcial: una sucursal no puede tener dos turnos ABIERTOS a
--     la vez, aunque dos cajas abran en el mismo segundo.
-- ============================================================================

SET search_path TO fogoneria, public;

-- ----------------------------------------------------------------------------
-- 1. Propina de la comanda
-- ----------------------------------------------------------------------------
ALTER TABLE fogoneria.ordenes
  ADD COLUMN IF NOT EXISTS propina numeric(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE fogoneria.ordenes
  DROP CONSTRAINT IF EXISTS chk_ordenes_propina;
ALTER TABLE fogoneria.ordenes
  ADD CONSTRAINT chk_ordenes_propina CHECK (propina >= 0);

COMMENT ON COLUMN fogoneria.ordenes.propina IS
  'AYCDS-34: propina cobrada con la orden; el pozo diario la suma por sucursal.';

-- ----------------------------------------------------------------------------
-- 2. Arqueo del turno
-- ----------------------------------------------------------------------------
ALTER TABLE fogoneria.turnos_caja
  ADD COLUMN IF NOT EXISTS efectivo_contado numeric(12, 2),
  ADD COLUMN IF NOT EXISTS diferencia numeric(12, 2),
  ADD COLUMN IF NOT EXISTS observaciones text;

COMMENT ON COLUMN fogoneria.turnos_caja.efectivo_contado IS
  'AYCDS-34: efectivo contado por el cajero al cerrar.';
COMMENT ON COLUMN fogoneria.turnos_caja.diferencia IS
  'AYCDS-34: contado menos esperado en efectivo (puede ser negativa).';

-- ----------------------------------------------------------------------------
-- 3. Un solo turno abierto por sucursal
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_turnos_abierto_sucursal
  ON fogoneria.turnos_caja (empresa_id, sucursal_id)
  WHERE estado = 'ABIERTO';

COMMENT ON INDEX fogoneria.uq_turnos_abierto_sucursal IS
  'AYCDS-34: una caja abierta por sucursal; el cierre libera el índice.';
