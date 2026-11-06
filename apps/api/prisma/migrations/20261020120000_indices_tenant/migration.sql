-- ============================================================================
-- AYCDS-62 — Índices compuestos y parciales por tenant
--
-- Objetivo: que las consultas reales del ERP (listados por empresa/sucursal y
-- por rango de fecha) y las políticas RLS de la migración siguiente usen
-- índices en lugar de Seq Scan.
--
-- Criterio de las columnas: primero las de aislamiento (empresa_id,
-- sucursal_id), después el filtro de estado y por último el orden temporal.
-- Los índices de una sola columna que quedan cubiertos como prefijo se dejan
-- intactos por ahora: sin datos de volumen no hay evidencia para borrarlos
-- (se revisará con pg_stat_user_indexes cuando exista el seed de performance).
-- ============================================================================

SET search_path TO fogoneria, public;

-- ----------------------------------------------------------------------------
-- 1. Operación: órdenes (KDS, listados del día, tablero por estado)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ordenes_tenant_sucursal_estado
  ON ordenes (empresa_id, sucursal_id, estado, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ordenes_tenant_fecha
  ON ordenes (empresa_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 2. Caja y facturación
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_turnos_tenant_sucursal_estado
  ON turnos_caja (empresa_id, sucursal_id, estado);

CREATE INDEX IF NOT EXISTS idx_turnos_tenant_fecha
  ON turnos_caja (empresa_id, apertura_at DESC);

CREATE INDEX IF NOT EXISTS idx_movcaja_tenant_fecha
  ON movimientos_caja (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_movcaja_turno_fecha
  ON movimientos_caja (turno_id, created_at);

CREATE INDEX IF NOT EXISTS idx_gastos_tenant_fecha
  ON gastos (empresa_id, sucursal_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comp_tenant_fecha
  ON comprobantes (empresa_id, sucursal_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comp_tenant_estado
  ON comprobantes (empresa_id, estado, created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. Inventario (kardex por insumo y sucursal)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_movinv_tenant_insumo_fecha
  ON movimientos_inventario (empresa_id, sucursal_id, insumo_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. Salón: reservas y asistencia
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_reservas_sucursal_fecha
  ON reservas (sucursal_id, fecha_hora);

CREATE INDEX IF NOT EXISTS idx_reservas_tenant_estado
  ON reservas (empresa_id, estado, fecha_hora);

CREATE INDEX IF NOT EXISTS idx_asis_tenant_fecha
  ON asistencias (empresa_id, sucursal_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_tp_sucursal_fecha
  ON turnos_plan (sucursal_id, fecha);

-- ----------------------------------------------------------------------------
-- 5. Catálogo, clientes y fidelidad
-- ----------------------------------------------------------------------------
-- Solo platos vigentes (el soft-delete de la migración 20261020120200 los
-- marca con deleted_at).
CREATE INDEX IF NOT EXISTS idx_platos_tenant_categoria_activo
  ON platos (empresa_id, categoria_id, activo)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_tenant_visitas
  ON clientes (empresa_id, visitas DESC);

CREATE INDEX IF NOT EXISTS idx_movpuntos_tenant_fecha
  ON movimientos_puntos (empresa_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 6. Acceso y auditoría
-- ----------------------------------------------------------------------------
-- Login: hoy solo existe el único parcial por empresa y el global de
-- superadmin; la búsqueda inicial por email necesita un índice propio.
CREATE INDEX IF NOT EXISTS idx_usuarios_email
  ON usuarios (email);

CREATE INDEX IF NOT EXISTS idx_usuarios_tenant_estado
  ON usuarios (empresa_id, estado);

CREATE INDEX IF NOT EXISTS idx_aud_tenant_fecha
  ON auditoria (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_aud_entidad_fecha
  ON auditoria (entidad, entidad_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 7. Comentarios
-- ----------------------------------------------------------------------------
COMMENT ON INDEX fogoneria.idx_ordenes_tenant_sucursal_estado IS 'AYCDS-62: tablero de órdenes por sucursal y estado.';
COMMENT ON INDEX fogoneria.idx_movcaja_tenant_fecha IS 'AYCDS-62: arqueo y reporte de caja por empresa.';
COMMENT ON INDEX fogoneria.idx_movinv_tenant_insumo_fecha IS 'AYCDS-62: kardex por insumo/sucursal.';
COMMENT ON INDEX fogoneria.idx_platos_tenant_categoria_activo IS 'AYCDS-62: carta vigente (excluye soft-delete).';
COMMENT ON INDEX fogoneria.idx_usuarios_email IS 'AYCDS-62: búsqueda de login por email.';
