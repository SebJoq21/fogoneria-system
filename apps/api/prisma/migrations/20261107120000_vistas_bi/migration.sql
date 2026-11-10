-- AYCDS-38 — Vistas de BI (P&L, ranking de platos y cobros por método).
--
-- Reglas:
--  * Todas las vistas exponen `empresa_id` y `sucursal_id` para que la API pueda
--    acotar por tenant sin traer filas al proceso (RLS sigue aplicando: el dueño
--    de las tablas tiene FORCE ROW LEVEL SECURITY).
--  * La fecha es la del **día de Lima** (`America/Lima`, UTC-05:00 sin DST), no UTC:
--    una venta de 21:00 en Lima no puede caer en el día siguiente.
--  * El ingreso se mide sobre comandas `PAGADA`/`CERRADA` (todas las ventas
--    cobradas), y aparte se expone el importe `comprobado` (comprobantes
--    `PAGADA`) para conciliar contra SUNAT. La diferencia es venta sin
--    comprobante y es un control, no un error.
--  * La propina se informa pero **no** suma al margen: es un traspaso al
--    personal (pozo de AYCDS-33), no ingreso propio.
--  * `v_bi_cobros_metodo` cuenta solo ingresos ligados a una orden y excluye el
--    concepto `Propina …` para no duplicar la venta.

CREATE OR REPLACE VIEW v_bi_ventas_dia WITH (security_invoker = true) AS
SELECT
  o.empresa_id,
  o.sucursal_id,
  (o.created_at AT TIME ZONE 'America/Lima')::date AS fecha,
  COUNT(*) AS n_ordenes,
  SUM(o.total) AS ventas,
  SUM(o.propina) AS propinas,
  ROUND(SUM(o.total) / NULLIF(COUNT(*), 0), 2) AS ticket_promedio
FROM ordenes o
WHERE o.estado IN ('PAGADA', 'CERRADA')
GROUP BY 1, 2, 3;

CREATE OR REPLACE VIEW v_bi_gastos_dia WITH (security_invoker = true) AS
SELECT
  g.empresa_id,
  g.sucursal_id,
  (g.created_at AT TIME ZONE 'America/Lima')::date AS fecha,
  g.categoria::text AS categoria,
  COUNT(*) AS n_gastos,
  SUM(g.monto) AS gastos
FROM gastos g
WHERE g.estado_pago = 'PAGADO'
GROUP BY 1, 2, 3, 4;

CREATE OR REPLACE VIEW v_bi_comprobado_dia WITH (security_invoker = true) AS
SELECT
  c.empresa_id,
  c.sucursal_id,
  (c.created_at AT TIME ZONE 'America/Lima')::date AS fecha,
  COUNT(*) AS n_comprobantes,
  SUM(c.total) AS comprobado
FROM comprobantes c
WHERE c.estado = 'PAGADA'
GROUP BY 1, 2, 3;

-- P&L diario: ventas, gastos y margen por empresa, sucursal y día.
CREATE OR REPLACE VIEW v_bi_pl_dia WITH (security_invoker = true) AS
WITH ventas AS (
  SELECT empresa_id, sucursal_id, fecha, SUM(ventas) AS ventas, SUM(propinas) AS propinas
  FROM v_bi_ventas_dia GROUP BY 1, 2, 3
), gastos AS (
  SELECT empresa_id, sucursal_id, fecha, SUM(gastos) AS gastos
  FROM v_bi_gastos_dia GROUP BY 1, 2, 3
), comprobado AS (
  SELECT empresa_id, sucursal_id, fecha, SUM(comprobado) AS comprobado
  FROM v_bi_comprobado_dia GROUP BY 1, 2, 3
)
SELECT
  COALESCE(v.empresa_id, g.empresa_id, c.empresa_id) AS empresa_id,
  COALESCE(v.sucursal_id, g.sucursal_id, c.sucursal_id) AS sucursal_id,
  COALESCE(v.fecha, g.fecha, c.fecha) AS fecha,
  COALESCE(v.ventas, 0) AS ventas,
  COALESCE(c.comprobado, 0) AS comprobado,
  COALESCE(v.ventas, 0) - COALESCE(c.comprobado, 0) AS venta_sin_comprobante,
  COALESCE(g.gastos, 0) AS gastos,
  COALESCE(v.ventas, 0) - COALESCE(g.gastos, 0) AS margen,
  COALESCE(v.propinas, 0) AS propinas
FROM ventas v
FULL OUTER JOIN gastos g ON g.empresa_id = v.empresa_id AND g.sucursal_id = v.sucursal_id AND g.fecha = v.fecha
FULL OUTER JOIN comprobado c ON c.empresa_id = COALESCE(v.empresa_id, g.empresa_id)
  AND c.sucursal_id = COALESCE(v.sucursal_id, g.sucursal_id)
  AND c.fecha = COALESCE(v.fecha, g.fecha);

-- Ranking de platos vendidos sobre comandas cobradas.
CREATE OR REPLACE VIEW v_bi_platos_top WITH (security_invoker = true) AS
SELECT
  o.empresa_id,
  o.sucursal_id,
  (o.created_at AT TIME ZONE 'America/Lima')::date AS fecha,
  d.plato_id,
  p.sku,
  p.nombre,
  SUM(d.cantidad) AS unidades,
  SUM(d.subtotal) AS ingresos
FROM detalles_orden d
JOIN ordenes o ON o.id = d.orden_id
JOIN platos p ON p.id = d.plato_id
WHERE o.estado IN ('PAGADA', 'CERRADA')
GROUP BY 1, 2, 3, 4, 5, 6;

-- Cobros por método de pago (solo ventas: se excluye el ingreso de propina).
CREATE OR REPLACE VIEW v_bi_cobros_metodo WITH (security_invoker = true) AS
SELECT
  m.empresa_id,
  t.sucursal_id,
  (m.created_at AT TIME ZONE 'America/Lima')::date AS fecha,
  m.metodo::text AS metodo,
  COUNT(*) AS n_cobros,
  SUM(m.monto) AS monto
FROM movimientos_caja m
JOIN turnos_caja t ON t.id = m.turno_id
WHERE m.tipo = 'INGRESO'
  AND m.orden_id IS NOT NULL
  AND m.concepto NOT LIKE 'Propina %'
GROUP BY 1, 2, 3, 4;

-- Hallazgo de auditoria (AYCDS-38): `fogoneria_app` es superusuario con
-- BYPASSRLS, asi que una vista creada por el se ejecuta con sus privilegios y
-- **no aplica RLS**. Las vistas existentes tenian esa fuga (una empresa veia las
-- ventas de otra). `security_invoker = true` hace que la vista corra con los
-- privilegios de quien consulta, de modo que RLS filtra igual que en la tabla.
ALTER VIEW v_ventas_dia SET (security_invoker = true);
ALTER VIEW v_platos_top SET (security_invoker = true);
ALTER VIEW v_ocupacion_mesas SET (security_invoker = true);
ALTER VIEW v_stock_bajo SET (security_invoker = true);

COMMENT ON VIEW v_bi_ventas_dia IS 'AYCDS-38: ventas cobradas por dia de Lima (ordenes PAGADA/CERRADA).';
COMMENT ON VIEW v_bi_gastos_dia IS 'AYCDS-38: gastos pagados por dia de Lima y categoria.';
COMMENT ON VIEW v_bi_comprobado_dia IS 'AYCDS-38: importe con comprobante vigente, para conciliar con SUNAT.';
COMMENT ON VIEW v_bi_pl_dia IS 'AYCDS-38: P&L diario. margen = ventas - gastos; la propina no suma (es traspaso al personal).';
COMMENT ON VIEW v_bi_platos_top IS 'AYCDS-38: unidades e ingresos por plato sobre comandas cobradas.';
COMMENT ON VIEW v_bi_cobros_metodo IS 'AYCDS-38: cobros por metodo de pago; excluye el ingreso de propina.';
