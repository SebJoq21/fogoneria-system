-- ============================================================================
-- AYCDS-20 — Anulación estricta de órdenes
--
-- Regla de negocio: una comanda solo se anula mientras está POR_CONFIRMAR.
-- Si ya entró a cocina (EN_COCINA) o está lista (LISTO) no se deshace: se
-- entrega y se compensa. La API valida lo mismo en `OrdersService`, pero el
-- trigger es la última línea de defensa (AYCDS-62).
--
-- Antes: EN_COCINA → ANULADA y LISTO → ANULADA estaban permitidas.
-- Ahora: solo POR_CONFIRMAR → ANULADA, con el código DB_ORDEN_ANULACION_TARDIA
-- para distinguir el intento tardío de una transición simplemente inválida.
-- ============================================================================

CREATE OR REPLACE FUNCTION fogoneria.trg_ordenes_inmutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = fogoneria, public
AS $$
DECLARE
  v_destino estado_orden;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM fogoneria.raise_immutable(
      'DB_ORDEN_NO_BORRABLE',
      'Las órdenes no se borran: pasan a ANULADA.'
    );
  END IF;

  IF OLD.estado IN ('PAGADA', 'CERRADA', 'ANULADA') THEN
    PERFORM fogoneria.raise_immutable(
      'DB_ORDEN_CERRADA',
      format('La orden %s está %s: es un estado terminal.', OLD.id, OLD.estado)
    );
  END IF;

  IF NEW.estado <> OLD.estado THEN
    v_destino := NEW.estado;

    IF v_destino = 'ANULADA' AND OLD.estado IN ('EN_COCINA', 'LISTO') THEN
      PERFORM fogoneria.raise_immutable(
        'DB_ORDEN_ANULACION_TARDIA',
        format(
          'La orden %s está %s: ya no se anula, se entrega y se compensa.',
          OLD.id,
          OLD.estado
        )
      );
    END IF;

    IF NOT (
      (OLD.estado = 'POR_CONFIRMAR' AND v_destino IN ('EN_COCINA', 'ANULADA'))
      OR (OLD.estado = 'EN_COCINA' AND v_destino = 'LISTO')
      OR (OLD.estado = 'LISTO' AND v_destino = 'ENTREGADO')
      OR (OLD.estado = 'ENTREGADO' AND v_destino IN ('PAGADA', 'CERRADA'))
    ) THEN
      PERFORM fogoneria.raise_immutable(
        'DB_ORDEN_TRANSICION_INVALIDA',
        format('Transición no permitida: %s -> %s.', OLD.estado, v_destino)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON TRIGGER trg_ordenes_inmutable ON ordenes IS
  'AYCDS-20: transiciones del KDS; ANULADA solo desde POR_CONFIRMAR.';
