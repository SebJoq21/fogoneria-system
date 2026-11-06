-- ============================================================================
-- AYCDS-62 — Borrado lógico en entidades maestras
--
-- Alcance: catálogo, configuración y datos maestros. La contabilidad
-- (comprobantes, movimientos_caja, movimientos_inventario, movimientos_puntos)
-- NO se borra: se anula o se compensa (migración 20261020120300).
--
-- Reglas:
--   1. `deleted_at` marca la baja; `deleted_by` guarda el actor.
--   2. Las unicidades de negocio pasan a índices únicos PARCIALES
--      (`WHERE deleted_at IS NULL`) para poder reutilizar el nombre/SKU/código.
--   3. Un DELETE sobre estas tablas se convierte en UPDATE (trigger
--      `soft_delete_row`). Prisma debe usar `update` explícito: el trigger
--      devuelve NULL y un DELETE real no reporta filas.
--   4. Restaurar = `fogoneria.restore_row('tabla', 'uuid')` (SECURITY DEFINER,
--      solo para el rol de administración).
--
-- `empresas.ruc` queda con su único global: el RUC de un tenant dado de baja
-- sigue reservado para no perder trazabilidad (decisión registrada en
-- docs/decisiones.md).
--
-- Fuera de alcance a propósito: `opciones_modificadores`. El catálogo las
-- elimina físicamente cuando no están referenciadas por ninguna orden
-- (FK `fk_dom_opcion` es RESTRICT), así que convertirlas a baja lógica
-- obligaría a filtrar todos sus `include` anidados. Se revisará cuando el
-- catálogo exponga un endpoint de baja.
-- ============================================================================

SET search_path TO fogoneria, public;

-- ----------------------------------------------------------------------------
-- 1. Columnas
-- ----------------------------------------------------------------------------
ALTER TABLE empresas                ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE sucursales              ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE usuarios                ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE platos                  ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE insumos                 ADD COLUMN IF NOT EXISTS deleted_by UUID;

ALTER TABLE categorias              ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE categorias              ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE grupos_modificadores    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE grupos_modificadores    ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE listas_precios          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE listas_precios          ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE combos                  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE combos                  ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE reglas_horarias_promos  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE reglas_horarias_promos  ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE cupones                 ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE cupones                 ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE proveedores             ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE proveedores             ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE clientes                ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE clientes                ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE roles_empresa           ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE roles_empresa           ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE empleados               ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE empleados               ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE mesas                   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE mesas                   ADD COLUMN IF NOT EXISTS deleted_by UUID;

COMMENT ON COLUMN categorias.deleted_at IS 'AYCDS-62: baja lógica. NULL = vigente.';
COMMENT ON COLUMN mesas.deleted_by IS 'AYCDS-62: usuario que ejecutó la baja lógica.';

-- ----------------------------------------------------------------------------
-- 2. Unicidades parciales (solo filas vigentes)
-- ----------------------------------------------------------------------------
ALTER TABLE sucursales             DROP CONSTRAINT IF EXISTS uq_sucursales_empresa_nombre;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sucursales_empresa_nombre
  ON sucursales (empresa_id, nombre) WHERE deleted_at IS NULL;

ALTER TABLE usuarios               DROP CONSTRAINT IF EXISTS uq_usuarios_empresa_email;
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_empresa_email
  ON usuarios (empresa_id, email) WHERE deleted_at IS NULL;

ALTER TABLE categorias             DROP CONSTRAINT IF EXISTS uq_categorias_empresa_nombre;
CREATE UNIQUE INDEX IF NOT EXISTS uq_categorias_empresa_nombre
  ON categorias (empresa_id, nombre) WHERE deleted_at IS NULL;

ALTER TABLE grupos_modificadores   DROP CONSTRAINT IF EXISTS uq_grupos_empresa_nombre;
CREATE UNIQUE INDEX IF NOT EXISTS uq_grupos_empresa_nombre
  ON grupos_modificadores (empresa_id, nombre) WHERE deleted_at IS NULL;

ALTER TABLE platos                 DROP CONSTRAINT IF EXISTS uq_platos_empresa_sku;
CREATE UNIQUE INDEX IF NOT EXISTS uq_platos_empresa_sku
  ON platos (empresa_id, sku) WHERE deleted_at IS NULL;

ALTER TABLE listas_precios         DROP CONSTRAINT IF EXISTS uq_listas_empresa_nombre;
CREATE UNIQUE INDEX IF NOT EXISTS uq_listas_empresa_nombre
  ON listas_precios (empresa_id, nombre) WHERE deleted_at IS NULL;

ALTER TABLE combos                 DROP CONSTRAINT IF EXISTS uq_combos_empresa_nombre;
CREATE UNIQUE INDEX IF NOT EXISTS uq_combos_empresa_nombre
  ON combos (empresa_id, nombre) WHERE deleted_at IS NULL;

ALTER TABLE reglas_horarias_promos DROP CONSTRAINT IF EXISTS uq_reglas_empresa_nombre;
CREATE UNIQUE INDEX IF NOT EXISTS uq_reglas_empresa_nombre
  ON reglas_horarias_promos (empresa_id, nombre) WHERE deleted_at IS NULL;

ALTER TABLE cupones                DROP CONSTRAINT IF EXISTS uq_cupones_empresa_codigo;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cupones_empresa_codigo
  ON cupones (empresa_id, codigo) WHERE deleted_at IS NULL;

ALTER TABLE proveedores            DROP CONSTRAINT IF EXISTS uq_proveedores_empresa_nombre;
CREATE UNIQUE INDEX IF NOT EXISTS uq_proveedores_empresa_nombre
  ON proveedores (empresa_id, nombre) WHERE deleted_at IS NULL;

ALTER TABLE insumos                DROP CONSTRAINT IF EXISTS uq_insumos_empresa_nombre;
CREATE UNIQUE INDEX IF NOT EXISTS uq_insumos_empresa_nombre
  ON insumos (empresa_id, nombre) WHERE deleted_at IS NULL;

ALTER TABLE clientes               DROP CONSTRAINT IF EXISTS uq_clientes_empresa_tel;
CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_empresa_tel
  ON clientes (empresa_id, telefono) WHERE deleted_at IS NULL;

ALTER TABLE roles_empresa          DROP CONSTRAINT IF EXISTS uq_roles_empresa_nombre;
CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_empresa_nombre
  ON roles_empresa (empresa_id, nombre) WHERE deleted_at IS NULL;

ALTER TABLE mesas                  DROP CONSTRAINT IF EXISTS uq_mesas_sucursal_numero;
CREATE UNIQUE INDEX IF NOT EXISTS uq_mesas_sucursal_numero
  ON mesas (sucursal_id, numero) WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 3. Trigger: DELETE -> baja lógica
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fogoneria.soft_delete_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = fogoneria, public
AS $$
BEGIN
  EXECUTE format(
    'UPDATE %I.%I SET deleted_at = now(), deleted_by = $1 WHERE id = $2',
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME
  )
  USING fogoneria.current_usuario_id(), OLD.id;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION fogoneria.soft_delete_row() IS
  'AYCDS-62: convierte DELETE en baja lógica (deleted_at + deleted_by). Cancela el DELETE real.';

DROP TRIGGER IF EXISTS trg_soft_delete ON empresas;
CREATE TRIGGER trg_soft_delete BEFORE DELETE ON empresas
  FOR EACH ROW EXECUTE FUNCTION fogoneria.soft_delete_row();

DROP TRIGGER IF EXISTS trg_soft_delete ON sucursales;
CREATE TRIGGER trg_soft_delete BEFORE DELETE ON sucursales
  FOR EACH ROW EXECUTE FUNCTION fogoneria.soft_delete_row();

DROP TRIGGER IF EXISTS trg_soft_delete ON usuarios;
CREATE TRIGGER trg_soft_delete BEFORE DELETE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION fogoneria.soft_delete_row();

DROP TRIGGER IF EXISTS trg_soft_delete ON categorias;
CREATE TRIGGER trg_soft_delete BEFORE DELETE ON categorias
  FOR EACH ROW EXECUTE FUNCTION fogoneria.soft_delete_row();

DROP TRIGGER IF EXISTS trg_soft_delete ON grupos_modificadores;
CREATE TRIGGER trg_soft_delete BEFORE DELETE ON grupos_modificadores
  FOR EACH ROW EXECUTE FUNCTION fogoneria.soft_delete_row();

DROP TRIGGER IF EXISTS trg_soft_delete ON platos;
CREATE TRIGGER trg_soft_delete BEFORE DELETE ON platos
  FOR EACH ROW EXECUTE FUNCTION fogoneria.soft_delete_row();

DROP TRIGGER IF EXISTS trg_soft_delete ON listas_precios;
CREATE TRIGGER trg_soft_delete BEFORE DELETE ON listas_precios
  FOR EACH ROW EXECUTE FUNCTION fogoneria.soft_delete_row();

DROP TRIGGER IF EXISTS trg_soft_delete ON combos;
CREATE TRIGGER trg_soft_delete BEFORE DELETE ON combos
  FOR EACH ROW EXECUTE FUNCTION fogoneria.soft_delete_row();

DROP TRIGGER IF EXISTS trg_soft_delete ON reglas_horarias_promos;
CREATE TRIGGER trg_soft_delete BEFORE DELETE ON reglas_horarias_promos
  FOR EACH ROW EXECUTE FUNCTION fogoneria.soft_delete_row();

DROP TRIGGER IF EXISTS trg_soft_delete ON cupones;
CREATE TRIGGER trg_soft_delete BEFORE DELETE ON cupones
  FOR EACH ROW EXECUTE FUNCTION fogoneria.soft_delete_row();

DROP TRIGGER IF EXISTS trg_soft_delete ON proveedores;
CREATE TRIGGER trg_soft_delete BEFORE DELETE ON proveedores
  FOR EACH ROW EXECUTE FUNCTION fogoneria.soft_delete_row();

DROP TRIGGER IF EXISTS trg_soft_delete ON insumos;
CREATE TRIGGER trg_soft_delete BEFORE DELETE ON insumos
  FOR EACH ROW EXECUTE FUNCTION fogoneria.soft_delete_row();

DROP TRIGGER IF EXISTS trg_soft_delete ON clientes;
CREATE TRIGGER trg_soft_delete BEFORE DELETE ON clientes
  FOR EACH ROW EXECUTE FUNCTION fogoneria.soft_delete_row();

DROP TRIGGER IF EXISTS trg_soft_delete ON roles_empresa;
CREATE TRIGGER trg_soft_delete BEFORE DELETE ON roles_empresa
  FOR EACH ROW EXECUTE FUNCTION fogoneria.soft_delete_row();

DROP TRIGGER IF EXISTS trg_soft_delete ON empleados;
CREATE TRIGGER trg_soft_delete BEFORE DELETE ON empleados
  FOR EACH ROW EXECUTE FUNCTION fogoneria.soft_delete_row();

DROP TRIGGER IF EXISTS trg_soft_delete ON mesas;
CREATE TRIGGER trg_soft_delete BEFORE DELETE ON mesas
  FOR EACH ROW EXECUTE FUNCTION fogoneria.soft_delete_row();

-- ----------------------------------------------------------------------------
-- 4. Restauración (solo rol de administración, SECURITY DEFINER)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fogoneria.restore_row(p_tabla text, p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fogoneria, public
AS $$
DECLARE
  tablas text[] := ARRAY[
    'empresas', 'sucursales', 'usuarios', 'categorias', 'grupos_modificadores',
    'platos', 'listas_precios', 'combos',
    'reglas_horarias_promos', 'cupones', 'proveedores', 'insumos', 'clientes',
    'roles_empresa', 'empleados', 'mesas'
  ];
  afectadas bigint;
BEGIN
  IF NOT p_tabla = ANY (tablas) THEN
    RAISE EXCEPTION
      USING ERRCODE = '45000',
            MESSAGE = 'DB_TABLA_NO_RESTAURABLE',
            DETAIL = format('Tabla no habilitada para restauración: %s', p_tabla);
  END IF;

  EXECUTE format(
    'UPDATE %I SET deleted_at = NULL, deleted_by = NULL WHERE id = $1 AND deleted_at IS NOT NULL',
    p_tabla
  )
  USING p_id;

  GET DIAGNOSTICS afectadas = ROW_COUNT;
  RETURN afectadas > 0;
END;
$$;

COMMENT ON FUNCTION fogoneria.restore_row(text, uuid) IS
  'AYCDS-62: restaura una fila dada de baja lógica. Devuelve true si actualizó.';

REVOKE ALL ON FUNCTION fogoneria.restore_row(text, uuid) FROM PUBLIC;
