-- ============================================================================
-- AYCDS-39 — Reversión financiera al anular
--
-- La contabilidad no se edita: se compensa. Cuando un comprobante se anula (o
-- una orden se anula, aunque hoy solo pueda desde POR_CONFIRMAR) la base
-- devuelve el dinero a la caja y el stock al inventario **insertando el
-- movimiento contrario**, nunca con UPDATE, porque `movimientos_caja` y
-- `movimientos_inventario` son append-only (AYCDS-62).
--
-- Reglas:
--   - El egreso compensatorio entra al turno ABIERTO de la sucursal. Si no hay
--     turno abierto se lanza DB_REVERSION_SIN_TURNO (409 en la API): no se
--     reabre un turno cerrado para cuadrar una anulación.
--   - La reversión es idempotente: si ya existe el movimiento compensatorio de
--     esa orden no se vuelve a insertar. La segunda anulación, además, choca
--     con DB_COMPROBANTE_ANULADO / DB_ORDEN_CERRADA.
--   - Los puntos no se revierten aquí: hoy nada los otorga todavía y el modelo
--     no tiene un tipo de ajuste. Queda para AYCDS-31 (CRM), documentado en
--     docs/decisiones.md.
-- ============================================================================

SET search_path TO fogoneria, public;

-- ----------------------------------------------------------------------------
-- 1. Turno abierto de la sucursal (o error estable)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fogoneria.turno_abierto(
  p_empresa uuid,
  p_sucursal uuid
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = fogoneria, public
AS $$
DECLARE
  v_turno uuid;
BEGIN
  SELECT id INTO v_turno
    FROM turnos_caja
   WHERE empresa_id = p_empresa
     AND sucursal_id = p_sucursal
     AND estado = 'ABIERTO'
   ORDER BY apertura_at DESC
   LIMIT 1;

  IF v_turno IS NULL THEN
    PERFORM fogoneria.raise_immutable(
      'DB_REVERSION_SIN_TURNO',
      'No hay turno de caja abierto en la sucursal: ábrelo antes de anular.'
    );
  END IF;

  RETURN v_turno;
END;
$$;

COMMENT ON FUNCTION fogoneria.turno_abierto(uuid, uuid) IS
  'AYCDS-39: turno ABIERTO donde se imputa la reversión; falla si no existe.';

-- ----------------------------------------------------------------------------
-- 2. Reversión de caja de una orden
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fogoneria.revertir_caja_orden(
  p_orden uuid,
  p_motivo text,
  p_actor uuid
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = fogoneria, public
AS $$
DECLARE
  v_empresa  uuid;
  v_sucursal uuid;
  v_turno    uuid;
  v_mov      record;
  v_total    integer := 0;
BEGIN
  -- Idempotencia: si ya se revirtió esta orden, no se duplica.
  IF EXISTS (
    SELECT 1 FROM movimientos_caja
     WHERE orden_id = p_orden
       AND tipo = 'EGRESO'
       AND concepto LIKE 'Reversión%'
  ) THEN
    RETURN 0;
  END IF;

  SELECT empresa_id, sucursal_id INTO v_empresa, v_sucursal
    FROM ordenes
   WHERE id = p_orden;

  IF v_empresa IS NULL THEN
    RETURN 0;
  END IF;

  -- Sin cobros no hay nada que devolver (orden anulada antes de pagar).
  IF NOT EXISTS (
    SELECT 1 FROM movimientos_caja
     WHERE orden_id = p_orden
       AND tipo = 'INGRESO'
  ) THEN
    RETURN 0;
  END IF;

  v_turno := fogoneria.turno_abierto(v_empresa, v_sucursal);

  FOR v_mov IN
    SELECT * FROM movimientos_caja
     WHERE orden_id = p_orden
       AND tipo = 'INGRESO'
       AND concepto NOT LIKE 'Reversión%'
     ORDER BY created_at
  LOOP
    INSERT INTO movimientos_caja (
      empresa_id, turno_id, tipo, concepto, monto, metodo, orden_id, actor_id
    ) VALUES (
      v_mov.empresa_id,
      v_turno,
      'EGRESO',
      left('Reversión de cobro: ' || coalesce(p_motivo, 'anulación'), 200),
      v_mov.monto,
      v_mov.metodo,
      p_orden,
      p_actor
    );
    v_total := v_total + 1;
  END LOOP;

  RETURN v_total;
END;
$$;

COMMENT ON FUNCTION fogoneria.revertir_caja_orden(uuid, text, uuid) IS
  'AYCDS-39: egreso compensatorio de los cobros de la orden en el turno abierto.';

-- ----------------------------------------------------------------------------
-- 3. Reversión de stock de una orden
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fogoneria.revertir_kardex_orden(
  p_orden uuid,
  p_motivo text,
  p_actor uuid
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = fogoneria, public
AS $$
DECLARE
  v_mov      record;
  v_stock    numeric(12, 3);
  v_total    integer := 0;
BEGIN
  IF EXISTS (
    SELECT 1 FROM movimientos_inventario
     WHERE orden_id = p_orden
       AND tipo = 'ENTRADA'
       AND motivo LIKE 'Reversión%'
  ) THEN
    RETURN 0;
  END IF;

  FOR v_mov IN
    SELECT * FROM movimientos_inventario
     WHERE orden_id = p_orden
       AND tipo IN ('SALIDA', 'MERMA')
     ORDER BY created_at
  LOOP
    UPDATE stocks_sucursal
       SET cantidad = cantidad + v_mov.cantidad,
           updated_at = now()
     WHERE sucursal_id = v_mov.sucursal_id
       AND insumo_id = v_mov.insumo_id;

    SELECT cantidad INTO v_stock
      FROM stocks_sucursal
     WHERE sucursal_id = v_mov.sucursal_id
       AND insumo_id = v_mov.insumo_id;

    INSERT INTO movimientos_inventario (
      empresa_id, sucursal_id, insumo_id, tipo, cantidad,
      stock_resultante, motivo, orden_id, actor_id
    ) VALUES (
      v_mov.empresa_id,
      v_mov.sucursal_id,
      v_mov.insumo_id,
      'ENTRADA',
      v_mov.cantidad,
      v_stock,
      left('Reversión de consumo: ' || coalesce(p_motivo, 'anulación'), 200),
      p_orden,
      p_actor
    );
    v_total := v_total + 1;
  END LOOP;

  RETURN v_total;
END;
$$;

COMMENT ON FUNCTION fogoneria.revertir_kardex_orden(uuid, text, uuid) IS
  'AYCDS-39: entrada compensatoria del stock consumido por la orden.';

-- ----------------------------------------------------------------------------
-- 4. Disparadores
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fogoneria.trg_comprobante_reversion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = fogoneria, public
AS $$
DECLARE
  v_motivo text;
BEGIN
  IF NEW.estado = 'ANULADA' AND OLD.estado <> 'ANULADA' THEN
    v_motivo := coalesce(NEW.motivo_anulacion, 'comprobante anulado');

    PERFORM fogoneria.revertir_caja_orden(
      NEW.orden_id, v_motivo, NEW.anulado_por
    );
    PERFORM fogoneria.revertir_kardex_orden(
      NEW.orden_id, v_motivo, NEW.anulado_por
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comprobante_reversion ON comprobantes;
CREATE TRIGGER trg_comprobante_reversion
  AFTER UPDATE OF estado ON comprobantes
  FOR EACH ROW EXECUTE FUNCTION fogoneria.trg_comprobante_reversion();

CREATE OR REPLACE FUNCTION fogoneria.trg_orden_reversion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = fogoneria, public
AS $$
BEGIN
  IF NEW.estado = 'ANULADA' AND OLD.estado <> 'ANULADA' THEN
    PERFORM fogoneria.revertir_caja_orden(
      NEW.id, 'orden anulada', NULL
    );
    PERFORM fogoneria.revertir_kardex_orden(
      NEW.id, 'orden anulada', NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orden_reversion ON ordenes;
CREATE TRIGGER trg_orden_reversion
  AFTER UPDATE OF estado ON ordenes
  FOR EACH ROW EXECUTE FUNCTION fogoneria.trg_orden_reversion();

COMMENT ON TRIGGER trg_comprobante_reversion ON comprobantes IS
  'AYCDS-39: al anular, inserta caja y stock compensatorios.';
COMMENT ON TRIGGER trg_orden_reversion ON ordenes IS
  'AYCDS-39: red de seguridad si una orden se anula con movimientos.';
