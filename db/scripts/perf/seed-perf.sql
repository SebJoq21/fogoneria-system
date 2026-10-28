-- ============================================================================
-- AYCDS-22 — Volumen sintético para la prueba de carga de comandas
--
-- Inserta 50 000 órdenes históricas (150 000 líneas) en la empresa demo y la
-- sucursal Miraflores. Sirve para que el planner de PostgreSQL vea un volumen
-- parecido al de un local en operación y para que el baseline de p95 no se mida
-- sobre una tabla de 4 filas.
--
-- Reglas del dataset:
--   - `numero_orden` empieza con `PERF-`, así el reset borra solo lo suyo.
--   - `created_at` va de ~69 días atrás hasta hoy (una orden cada 2 minutos),
--     así el KDS "de hoy" no se llena de comandas falsas.
--   - Estados terminales/entregados; ninguna queda abierta.
--   - Se desactivan los triggers de inmutabilidad SOLO dentro de esta
--     transacción (`session_replication_role = replica`), porque la carga
--     escribe historia, no transiciones del KDS. Requiere el rol dueño o
--     superusuario (el `POSTGRES_USER` del compose lo es).
--
-- Uso:
--   pnpm --filter api perf:seed       # idempotente
--   pnpm --filter api perf:reset      # borra solo PERF-% y deja el demo intacto
-- ============================================================================

BEGIN;

SELECT set_config('app.bypass', 'on', true);
SET LOCAL session_replication_role = replica;

DO $$
DECLARE
  v_empresa   uuid := '11111111-1111-4111-8111-111111111111';
  v_sucursal  uuid := '22222222-2222-4222-8222-222222222222';
  v_mesero    uuid := '55555555-5555-4555-8555-555555555559';
  v_lista     uuid;
  v_platos    uuid[];
  v_mesas     uuid[];
  v_total     int  := 50000;
  v_previas   int;
BEGIN
  SELECT count(*) INTO v_previas
    FROM fogoneria.ordenes
   WHERE numero_orden LIKE 'PERF-%';

  IF v_previas >= v_total THEN
    RAISE NOTICE 'AYCDS-22: ya existen % órdenes PERF; no se duplica nada.', v_previas;
    RETURN;
  END IF;

  SELECT id INTO v_lista
    FROM fogoneria.listas_precios
   WHERE empresa_id = v_empresa
   ORDER BY activa DESC, created_at
   LIMIT 1;

  SELECT array_agg(id) INTO v_platos
    FROM (
      SELECT id
        FROM fogoneria.platos
       WHERE empresa_id = v_empresa
         AND deleted_at IS NULL
       ORDER BY id
       LIMIT 3
    ) AS vigentes;

  IF v_lista IS NULL OR v_platos IS NULL OR array_length(v_platos, 1) < 3 THEN
    RAISE EXCEPTION
      'AYCDS-22: falta el catálogo demo (lista de precios o 3 platos). Corre `pnpm --filter api db:seed`.';
  END IF;

  -- Las comandas se reparten entre las mesas de la sucursal para que las
  -- consultas por mesa (liberación de mesa, mapa) vean volumen real.
  SELECT array_agg(id) INTO v_mesas
    FROM fogoneria.mesas
   WHERE sucursal_id = v_sucursal
     AND deleted_at IS NULL;

  INSERT INTO fogoneria.ordenes (
    empresa_id, sucursal_id, numero_orden, mesa_id, mesero_id, origen, estado,
    subtotal, total, lista_precio_id, ingreso_at, created_at, updated_at
  )
  SELECT
    v_empresa,
    v_sucursal,
    'PERF-' || lpad(g::text, 6, '0'),
    CASE
      WHEN v_mesas IS NULL THEN NULL
      ELSE v_mesas[1 + (g % array_length(v_mesas, 1))]
    END,
    v_mesero,
    'BARRA',
    (ARRAY['PAGADA', 'CERRADA', 'ENTREGADO', 'ANULADA']::fogoneria.estado_orden[])[1 + (g % 4)],
    60.00,
    60.00,
    v_lista,
    now() - (g * interval '2 minutes'),
    now() - (g * interval '2 minutes'),
    now() - (g * interval '2 minutes')
  FROM generate_series(1, v_total) AS g;

  INSERT INTO fogoneria.detalles_orden (
    orden_id, tipo, plato_id, cantidad, precio_unitario, subtotal, created_at
  )
  SELECT
    o.id,
    'PLATO'::fogoneria.tipo_detalle_orden,
    v_platos[1 + (linea % 3)],
    1,
    20.00,
    20.00,
    o.created_at
  FROM fogoneria.ordenes AS o
  CROSS JOIN generate_series(1, 3) AS linea
  WHERE o.empresa_id = v_empresa
    AND o.numero_orden LIKE 'PERF-%';

  -- El contador de folios sigue después del volumen histórico para que las
  -- comandas nuevas no colisionen con el dataset.
  INSERT INTO fogoneria.secuencias (empresa_id, tipo, valor)
  VALUES (v_empresa, 'ORD', v_total)
  ON CONFLICT (empresa_id, tipo)
  DO UPDATE SET valor = GREATEST(fogoneria.secuencias.valor, EXCLUDED.valor);

  RAISE NOTICE 'AYCDS-22: % órdenes y % líneas nuevas.', v_total - v_previas, (v_total - v_previas) * 3;
END $$;

-- Estadísticas frescas: sin ANALYZE el planner mide con estimaciones del seed.
ANALYZE fogoneria.ordenes;
ANALYZE fogoneria.detalles_orden;
ANALYZE fogoneria.mesas;

COMMIT;
