-- ============================================================================
-- AYCDS-62 — Inmutabilidad contable
--
-- Todo error de negocio sale como SQLSTATE 45000 con un código estable en el
-- mensaje (DB_...). La API lo traduce a HTTP 409/422 en docs/errores-db.md.
--
-- Reglas:
--   - turnos_caja: no se borran; un turno CERRADO no se reabre ni se edita.
--   - movimientos_caja: append-only; solo se insertan en turnos ABIERTOS.
--   - comprobantes: no se borran; solo pasan de PAGADA a ANULADA una vez,
--     con actor, fecha y motivo.
--   - movimientos_inventario / movimientos_puntos / auditoria: append-only.
--   - ordenes: transiciones de estado del KDS y nada más; terminales congeladas.
--   - detalles_orden: no se tocan si la orden ya está PAGADA/CERRADA/ANULADA.
--   - gastos: un gasto pagado en caja no cambia de monto ni de turno.
-- ============================================================================

SET search_path TO fogoneria, public;

-- ----------------------------------------------------------------------------
-- 0. Helper de error
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fogoneria.raise_immutable(p_codigo text, p_detalle text)
RETURNS void
LANGUAGE plpgsql
SET search_path = fogoneria, public
AS $$
BEGIN
  RAISE EXCEPTION '%', p_codigo
    USING ERRCODE = '45000',
          DETAIL = p_detalle,
          HINT = 'Ver docs/errores-db.md';
END;
$$;

COMMENT ON FUNCTION fogoneria.raise_immutable(text, text) IS
  'AYCDS-62: error de inmutabilidad con código estable para la API.';

-- ----------------------------------------------------------------------------
-- 1. turnos_caja
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fogoneria.trg_turnos_caja_inmutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = fogoneria, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM fogoneria.raise_immutable(
      'DB_TURNO_NO_BORRABLE',
      'Los turnos de caja son históricos: se cierran, no se borran.'
    );
  END IF;

  IF OLD.estado = 'CERRADO' THEN
    PERFORM fogoneria.raise_immutable(
      'DB_TURNO_CERRADO',
      format('El turno %s está CERRADO y no admite cambios.', OLD.id)
    );
  END IF;

  IF NEW.empresa_id <> OLD.empresa_id
     OR NEW.sucursal_id <> OLD.sucursal_id
     OR NEW.apertura_at <> OLD.apertura_at
     OR NEW.fondo_apertura <> OLD.fondo_apertura
     OR NEW.cajero_id IS DISTINCT FROM OLD.cajero_id THEN
    PERFORM fogoneria.raise_immutable(
      'DB_TURNO_DATOS_INMUTABLES',
      'Empresa, sucursal, apertura, fondo y cajero no se modifican tras abrir el turno.'
    );
  END IF;

  IF NEW.estado = 'CERRADO' AND NEW.cierre_at IS NULL THEN
    PERFORM fogoneria.raise_immutable(
      'DB_TURNO_CIERRE_INCOMPLETO',
      'Un turno CERRADO requiere cierre_at.'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_turnos_caja_inmutable ON turnos_caja;
CREATE TRIGGER trg_turnos_caja_inmutable
  BEFORE UPDATE OR DELETE ON turnos_caja
  FOR EACH ROW EXECUTE FUNCTION fogoneria.trg_turnos_caja_inmutable();

-- ----------------------------------------------------------------------------
-- 2. movimientos_caja (append-only)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fogoneria.trg_movimientos_caja_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = fogoneria, public
AS $$
BEGIN
  PERFORM fogoneria.raise_immutable(
    'DB_MOVIMIENTO_INMUTABLE',
    'Los movimientos de caja no se editan ni se borran: se registra un movimiento de ajuste.'
  );
END;
$$;

DROP TRIGGER IF EXISTS trg_movcaja_append_only ON movimientos_caja;
CREATE TRIGGER trg_movcaja_append_only
  BEFORE UPDATE OR DELETE ON movimientos_caja
  FOR EACH ROW EXECUTE FUNCTION fogoneria.trg_movimientos_caja_append_only();

CREATE OR REPLACE FUNCTION fogoneria.trg_movimientos_caja_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = fogoneria, public
AS $$
DECLARE
  v_estado   estado_turno_caja;
  v_empresa  uuid;
BEGIN
  SELECT estado, empresa_id INTO v_estado, v_empresa
  FROM turnos_caja
  WHERE id = NEW.turno_id;

  IF NOT FOUND THEN
    PERFORM fogoneria.raise_immutable(
      'DB_TURNO_NO_EXISTE',
      format('El turno %s no existe.', NEW.turno_id)
    );
  END IF;

  IF v_estado <> 'ABIERTO' THEN
    PERFORM fogoneria.raise_immutable(
      'DB_TURNO_CERRADO',
      format('El turno %s está %s: no admite movimientos.', NEW.turno_id, v_estado)
    );
  END IF;

  IF v_empresa <> NEW.empresa_id THEN
    PERFORM fogoneria.raise_immutable(
      'DB_TENANT_MISMATCH',
      'El turno y el movimiento pertenecen a empresas distintas.'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_movcaja_insert ON movimientos_caja;
CREATE TRIGGER trg_movcaja_insert
  BEFORE INSERT ON movimientos_caja
  FOR EACH ROW EXECUTE FUNCTION fogoneria.trg_movimientos_caja_insert();

-- ----------------------------------------------------------------------------
-- 3. comprobantes
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fogoneria.trg_comprobantes_inmutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = fogoneria, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM fogoneria.raise_immutable(
      'DB_COMPROBANTE_NO_BORRABLE',
      'Los comprobantes no se borran: se anulan.'
    );
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.estado <> 'PAGADA' THEN
      PERFORM fogoneria.raise_immutable(
        'DB_COMPROBANTE_ESTADO_INICIAL',
        'Un comprobante nace PAGADA; la anulación es una transición posterior.'
      );
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF OLD.estado = 'ANULADA' THEN
    PERFORM fogoneria.raise_immutable(
      'DB_COMPROBANTE_ANULADO',
      'El comprobante ya está ANULADA: es un estado terminal.'
    );
  END IF;

  IF NEW.estado = 'ANULADA' THEN
    IF NEW.anulado_por IS NULL
       OR NEW.anulado_at IS NULL
       OR coalesce(trim(NEW.motivo_anulacion), '') = '' THEN
      PERFORM fogoneria.raise_immutable(
        'DB_ANULACION_INCOMPLETA',
        'La anulación exige anulado_por, anulado_at y motivo_anulacion.'
      );
    END IF;

    IF NEW.total <> OLD.total
       OR NEW.serie_numero <> OLD.serie_numero
       OR NEW.tipo <> OLD.tipo
       OR NEW.orden_id <> OLD.orden_id
       OR NEW.empresa_id <> OLD.empresa_id
       OR NEW.sucursal_id <> OLD.sucursal_id THEN
      PERFORM fogoneria.raise_immutable(
        'DB_COMPROBANTE_DATOS_INMUTABLES',
        'La anulación solo cambia estado, actor, fecha y motivo.'
      );
    END IF;

    RETURN NEW;
  END IF;

  PERFORM fogoneria.raise_immutable(
    'DB_COMPROBANTE_INMUTABLE',
    'Un comprobante PAGADA solo puede pasar a ANULADA.'
  );
END;
$$;

DROP TRIGGER IF EXISTS trg_comprobantes_inmutable ON comprobantes;
CREATE TRIGGER trg_comprobantes_inmutable
  BEFORE INSERT OR UPDATE OR DELETE ON comprobantes
  FOR EACH ROW EXECUTE FUNCTION fogoneria.trg_comprobantes_inmutable();

-- ----------------------------------------------------------------------------
-- 4. movimientos_inventario y movimientos_puntos (append-only)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fogoneria.trg_kardex_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = fogoneria, public
AS $$
BEGIN
  PERFORM fogoneria.raise_immutable(
    'DB_KARDEX_INMUTABLE',
    'El kardex no se edita ni se borra: se compensa con un movimiento inverso.'
  );
END;
$$;

DROP TRIGGER IF EXISTS trg_movinv_append_only ON movimientos_inventario;
CREATE TRIGGER trg_movinv_append_only
  BEFORE UPDATE OR DELETE ON movimientos_inventario
  FOR EACH ROW EXECUTE FUNCTION fogoneria.trg_kardex_append_only();

CREATE OR REPLACE FUNCTION fogoneria.trg_puntos_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = fogoneria, public
AS $$
BEGIN
  PERFORM fogoneria.raise_immutable(
    'DB_PUNTOS_INMUTABLE',
    'Los movimientos de puntos no se editan ni se borran: se compensan.'
  );
END;
$$;

DROP TRIGGER IF EXISTS trg_movpuntos_append_only ON movimientos_puntos;
CREATE TRIGGER trg_movpuntos_append_only
  BEFORE UPDATE OR DELETE ON movimientos_puntos
  FOR EACH ROW EXECUTE FUNCTION fogoneria.trg_puntos_append_only();

-- ----------------------------------------------------------------------------
-- 5. auditoria (append-only)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fogoneria.trg_auditoria_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = fogoneria, public
AS $$
BEGIN
  PERFORM fogoneria.raise_immutable(
    'DB_AUDITORIA_INMUTABLE',
    'La auditoría es append-only.'
  );
END;
$$;

DROP TRIGGER IF EXISTS trg_auditoria_append_only ON auditoria;
CREATE TRIGGER trg_auditoria_append_only
  BEFORE UPDATE OR DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION fogoneria.trg_auditoria_append_only();

-- ----------------------------------------------------------------------------
-- 6. ordenes: transiciones válidas del KDS
--    Fuente: apps/api/src/modules/orders/orders.service.ts (TRANSITIONS)
-- ----------------------------------------------------------------------------
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

    IF NOT (
      (OLD.estado = 'POR_CONFIRMAR' AND v_destino IN ('EN_COCINA', 'ANULADA'))
      OR (OLD.estado = 'EN_COCINA' AND v_destino IN ('LISTO', 'ANULADA'))
      OR (OLD.estado = 'LISTO' AND v_destino IN ('ENTREGADO', 'ANULADA'))
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

DROP TRIGGER IF EXISTS trg_ordenes_inmutable ON ordenes;
CREATE TRIGGER trg_ordenes_inmutable
  BEFORE UPDATE OR DELETE ON ordenes
  FOR EACH ROW EXECUTE FUNCTION fogoneria.trg_ordenes_inmutable();

-- ----------------------------------------------------------------------------
-- 7. detalles_orden: congelados con la orden
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fogoneria.trg_detalles_orden_inmutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = fogoneria, public
AS $$
DECLARE
  v_estado estado_orden;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT estado INTO v_estado FROM ordenes WHERE id = OLD.orden_id;
    IF v_estado IN ('PAGADA', 'CERRADA', 'ANULADA') THEN
      PERFORM fogoneria.raise_immutable(
        'DB_DETALLE_INMUTABLE',
        format('La orden %s está %s: sus líneas no se modifican.', OLD.orden_id, v_estado)
      );
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF TG_OP = 'UPDATE' AND NEW.orden_id <> OLD.orden_id THEN
      SELECT estado INTO v_estado FROM ordenes WHERE id = OLD.orden_id;
      IF v_estado IN ('PAGADA', 'CERRADA', 'ANULADA') THEN
        PERFORM fogoneria.raise_immutable(
          'DB_DETALLE_INMUTABLE',
          format('La orden %s está %s: sus líneas no se mueven.', OLD.orden_id, v_estado)
        );
      END IF;
    END IF;

    SELECT estado INTO v_estado FROM ordenes WHERE id = NEW.orden_id;
    IF v_estado IN ('PAGADA', 'CERRADA', 'ANULADA') THEN
      PERFORM fogoneria.raise_immutable(
        'DB_DETALLE_INMUTABLE',
        format('La orden %s está %s: no admite líneas nuevas.', NEW.orden_id, v_estado)
      );
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_detalles_orden_inmutable ON detalles_orden;
CREATE TRIGGER trg_detalles_orden_inmutable
  BEFORE INSERT OR UPDATE OR DELETE ON detalles_orden
  FOR EACH ROW EXECUTE FUNCTION fogoneria.trg_detalles_orden_inmutable();

-- ----------------------------------------------------------------------------
-- 8. gastos: un gasto pagado en caja no se reescribe
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fogoneria.trg_gastos_inmutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = fogoneria, public
AS $$
DECLARE
  v_estado_turno estado_turno_caja;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.pagado_en_caja THEN
      PERFORM fogoneria.raise_immutable(
        'DB_GASTO_PAGADO',
        'Un gasto pagado en caja no se borra: se registra una devolución.'
      );
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.pagado_en_caja THEN
    IF NEW.monto <> OLD.monto
       OR NEW.turno_id IS DISTINCT FROM OLD.turno_id
       OR NEW.empresa_id <> OLD.empresa_id
       OR NEW.sucursal_id <> OLD.sucursal_id THEN
      PERFORM fogoneria.raise_immutable(
        'DB_GASTO_PAGADO',
        'Un gasto pagado en caja no cambia de monto, turno ni sucursal.'
      );
    END IF;

    IF OLD.turno_id IS NOT NULL THEN
      SELECT estado INTO v_estado_turno FROM turnos_caja WHERE id = OLD.turno_id;
      IF v_estado_turno = 'CERRADO' THEN
        PERFORM fogoneria.raise_immutable(
          'DB_TURNO_CERRADO',
          'El turno del gasto ya está CERRADO.'
        );
      END IF;
    END IF;
  END IF;

  IF NEW.pagado_en_caja AND NOT OLD.pagado_en_caja AND NEW.turno_id IS NOT NULL THEN
    SELECT estado INTO v_estado_turno FROM turnos_caja WHERE id = NEW.turno_id;
    IF v_estado_turno IS DISTINCT FROM 'ABIERTO' THEN
      PERFORM fogoneria.raise_immutable(
        'DB_TURNO_CERRADO',
        'Solo se paga un gasto en un turno ABIERTO.'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gastos_inmutable ON gastos;
CREATE TRIGGER trg_gastos_inmutable
  BEFORE UPDATE OR DELETE ON gastos
  FOR EACH ROW EXECUTE FUNCTION fogoneria.trg_gastos_inmutable();

-- ----------------------------------------------------------------------------
-- 9. Comentarios
-- ----------------------------------------------------------------------------
COMMENT ON TRIGGER trg_comprobantes_inmutable ON comprobantes IS
  'AYCDS-62: PAGADA -> ANULADA una sola vez; sin DELETE.';
COMMENT ON TRIGGER trg_movcaja_append_only ON movimientos_caja IS
  'AYCDS-62: append-only; ajustes por movimiento inverso.';
COMMENT ON TRIGGER trg_ordenes_inmutable ON ordenes IS
  'AYCDS-62: transiciones KDS y terminales congelados.';
