-- ============================================================================
-- AYCDS-62 — Row Level Security por empresa y sucursal
--
-- Contrato de sesión (lo escribe la API al abrir transacción):
--   SELECT set_config('app.empresa_id',  '<uuid>', true);
--   SELECT set_config('app.sucursal_id', '<uuid>', true);
--   SELECT set_config('app.usuario_id',  '<uuid>', true);
--   SELECT set_config('app.bypass', 'on', true);   -- solo consola SaaS
--
-- El tercer argumento `true` es obligatorio: `SET LOCAL`/`set_config(...,
-- true)` vive dentro de la transacción. Con `SET` normal y pool de conexiones
-- el contexto se filtra entre requests.
--
-- Esta migración NO activa `FORCE ROW LEVEL SECURITY`: el dueño del esquema
-- (el rol con el que corre la API hoy) sigue leyendo sin filtro, de modo que
-- nada se rompe mientras la tarea 53 no inyecte el contexto. Para probar el
-- aislamiento real se usa el rol `fogoneria_rls` (db/scripts/rls/000-roles.sql)
-- y `db/scripts/rls/010-force-rls.sql` cuando la API ya setee el contexto.
--
-- Modelo de acceso:
--   - Todas las políticas son PERMISSIVE y se aplican a PUBLIC.
--   - Sin contexto (GUC vacío) y sin bypass no se ve ninguna fila.
--   - SUPERADMIN/consola SaaS opera con app.bypass = 'on'.
--   - `leads_cotizaciones` queda fuera de RLS: es plataforma y se escribe
--     desde la landing con el rol de migración/SaaS.
-- ============================================================================

SET search_path TO fogoneria, public;

-- ----------------------------------------------------------------------------
-- 1. Funciones de contexto
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fogoneria.current_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.empresa_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION fogoneria.current_sucursal_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.sucursal_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION fogoneria.current_usuario_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.usuario_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION fogoneria.is_bypass()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(current_setting('app.bypass', true), '') IN ('on', 'true', '1');
$$;

COMMENT ON FUNCTION fogoneria.current_empresa_id() IS 'AYCDS-62: empresa activa de la transacción (app.empresa_id).';
COMMENT ON FUNCTION fogoneria.current_sucursal_id() IS 'AYCDS-62: sucursal activa de la transacción (app.sucursal_id).';
COMMENT ON FUNCTION fogoneria.current_usuario_id() IS 'AYCDS-62: usuario actor de la transacción (app.usuario_id).';
COMMENT ON FUNCTION fogoneria.is_bypass() IS 'AYCDS-62: true solo para la consola SaaS (app.bypass).';

-- ----------------------------------------------------------------------------
-- 2. Plataforma: la empresa solo se ve a sí misma
-- ----------------------------------------------------------------------------
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empresas_tenant_select ON empresas;
CREATE POLICY empresas_tenant_select ON empresas
  FOR SELECT
  USING (fogoneria.is_bypass() OR id = fogoneria.current_empresa_id());

DROP POLICY IF EXISTS empresas_tenant_update ON empresas;
CREATE POLICY empresas_tenant_update ON empresas
  FOR UPDATE
  USING (fogoneria.is_bypass() OR id = fogoneria.current_empresa_id())
  WITH CHECK (fogoneria.is_bypass() OR id = fogoneria.current_empresa_id());

-- Alta/baja de tenants: solo rol con BYPASS (onboarding y consola SaaS).
COMMENT ON POLICY empresas_tenant_select ON empresas IS 'AYCDS-62: aislamiento de tenant raíz.';
COMMENT ON POLICY empresas_tenant_update ON empresas IS 'AYCDS-62: cada empresa edita solo su fila.';

-- ----------------------------------------------------------------------------
-- 3. Usuarios: caso especial (superadmin con empresa_id NULL)
-- ----------------------------------------------------------------------------
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usuarios_tenant_isolation ON usuarios;
CREATE POLICY usuarios_tenant_isolation ON usuarios
  FOR ALL
  USING (
    fogoneria.is_bypass()
    OR (
      empresa_id IS NOT NULL
      AND empresa_id = fogoneria.current_empresa_id()
      AND (
        fogoneria.current_sucursal_id() IS NULL
        OR sucursal_id IS NULL
        OR sucursal_id = fogoneria.current_sucursal_id()
      )
    )
  )
  WITH CHECK (
    fogoneria.is_bypass()
    OR (
      empresa_id IS NOT NULL
      AND empresa_id = fogoneria.current_empresa_id()
      AND (
        fogoneria.current_sucursal_id() IS NULL
        OR sucursal_id IS NULL
        OR sucursal_id = fogoneria.current_sucursal_id()
      )
    )
  );

COMMENT ON POLICY usuarios_tenant_isolation ON usuarios IS 'AYCDS-62: los SUPERADMIN (empresa_id NULL) solo son visibles con bypass.';

-- ----------------------------------------------------------------------------
-- 4. Tablas con empresa_id directo (catálogo y configuración)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'sucursales',
    'categorias',
    'grupos_modificadores',
    'platos',
    'listas_precios',
    'combos',
    'reglas_horarias_promos',
    'cupones',
    'proveedores',
    'insumos',
    'clientes',
    'config_lealtad',
    'roles_empresa',
    'suscripciones_eventos'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'tenant_isolation_' || t, t);
    EXECUTE format($f$
      CREATE POLICY %I ON %I
        FOR ALL
        USING (
          fogoneria.is_bypass()
          OR empresa_id = fogoneria.current_empresa_id()
        )
        WITH CHECK (
          fogoneria.is_bypass()
          OR empresa_id = fogoneria.current_empresa_id()
        )
    $f$, 'tenant_isolation_' || t, t);
  END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- 5. Tablas operativas con empresa_id + sucursal_id
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'empleados',
    'mesas',
    'reservas',
    'ordenes',
    'stocks_sucursal',
    'movimientos_inventario',
    'turnos_caja',
    'gastos',
    'comprobantes',
    'canjes_cupones',
    'movimientos_puntos',
    'turnos_plan',
    'asistencias',
    'pozos_propinas'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'tenant_isolation_' || t, t);
    EXECUTE format($f$
      CREATE POLICY %I ON %I
        FOR ALL
        USING (
          fogoneria.is_bypass()
          OR (
            empresa_id = fogoneria.current_empresa_id()
            AND (
              fogoneria.current_sucursal_id() IS NULL
              OR sucursal_id = fogoneria.current_sucursal_id()
            )
          )
        )
        WITH CHECK (
          fogoneria.is_bypass()
          OR (
            empresa_id = fogoneria.current_empresa_id()
            AND (
              fogoneria.current_sucursal_id() IS NULL
              OR sucursal_id = fogoneria.current_sucursal_id()
            )
          )
        )
    $f$, 'tenant_isolation_' || t, t);
  END LOOP;
END
$$;

-- Auditoría: empresa_id y sucursal_id son nullable (acciones de plataforma).
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_auditoria ON auditoria;
CREATE POLICY tenant_isolation_auditoria ON auditoria
  FOR ALL
  USING (
    fogoneria.is_bypass()
    OR (
      empresa_id = fogoneria.current_empresa_id()
      AND (
        fogoneria.current_sucursal_id() IS NULL
        OR sucursal_id IS NULL
        OR sucursal_id = fogoneria.current_sucursal_id()
      )
    )
  )
  WITH CHECK (
    fogoneria.is_bypass()
    OR (
      empresa_id = fogoneria.current_empresa_id()
      AND (
        fogoneria.current_sucursal_id() IS NULL
        OR sucursal_id IS NULL
        OR sucursal_id = fogoneria.current_sucursal_id()
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 6. movimientos_caja: tiene empresa_id pero no sucursal_id
--    La sucursal se resuelve por el turno de caja padre.
-- ----------------------------------------------------------------------------
ALTER TABLE movimientos_caja ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_movimientos_caja ON movimientos_caja;
CREATE POLICY tenant_isolation_movimientos_caja ON movimientos_caja
  FOR ALL
  USING (
    fogoneria.is_bypass()
    OR (
      empresa_id = fogoneria.current_empresa_id()
      AND (
        fogoneria.current_sucursal_id() IS NULL
        OR EXISTS (
          SELECT 1
          FROM turnos_caja t
          WHERE t.id = turno_id
            AND t.sucursal_id = fogoneria.current_sucursal_id()
        )
      )
    )
  )
  WITH CHECK (
    fogoneria.is_bypass()
    OR (
      empresa_id = fogoneria.current_empresa_id()
      AND (
        fogoneria.current_sucursal_id() IS NULL
        OR EXISTS (
          SELECT 1
          FROM turnos_caja t
          WHERE t.id = turno_id
            AND t.sucursal_id = fogoneria.current_sucursal_id()
        )
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 7. Tablas hijas sin empresa_id: heredan el aislamiento del padre
-- ----------------------------------------------------------------------------
ALTER TABLE opciones_modificadores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_opciones_modificadores ON opciones_modificadores;
CREATE POLICY tenant_isolation_opciones_modificadores ON opciones_modificadores
  FOR ALL
  USING (
    fogoneria.is_bypass()
    OR EXISTS (
      SELECT 1 FROM grupos_modificadores g
      WHERE g.id = grupo_id
        AND g.empresa_id = fogoneria.current_empresa_id()
    )
  )
  WITH CHECK (
    fogoneria.is_bypass()
    OR EXISTS (
      SELECT 1 FROM grupos_modificadores g
      WHERE g.id = grupo_id
        AND g.empresa_id = fogoneria.current_empresa_id()
    )
  );

ALTER TABLE platos_grupos_modificadores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_platos_grupos_modificadores ON platos_grupos_modificadores;
CREATE POLICY tenant_isolation_platos_grupos_modificadores ON platos_grupos_modificadores
  FOR ALL
  USING (
    fogoneria.is_bypass()
    OR EXISTS (
      SELECT 1 FROM platos p
      WHERE p.id = plato_id
        AND p.empresa_id = fogoneria.current_empresa_id()
    )
  )
  WITH CHECK (
    fogoneria.is_bypass()
    OR EXISTS (
      SELECT 1 FROM platos p
      WHERE p.id = plato_id
        AND p.empresa_id = fogoneria.current_empresa_id()
    )
  );

ALTER TABLE precios_platos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_precios_platos ON precios_platos;
CREATE POLICY tenant_isolation_precios_platos ON precios_platos
  FOR ALL
  USING (
    fogoneria.is_bypass()
    OR EXISTS (
      SELECT 1 FROM listas_precios l
      WHERE l.id = lista_id
        AND l.empresa_id = fogoneria.current_empresa_id()
    )
  )
  WITH CHECK (
    fogoneria.is_bypass()
    OR EXISTS (
      SELECT 1 FROM listas_precios l
      WHERE l.id = lista_id
        AND l.empresa_id = fogoneria.current_empresa_id()
    )
  );

ALTER TABLE combos_platos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_combos_platos ON combos_platos;
CREATE POLICY tenant_isolation_combos_platos ON combos_platos
  FOR ALL
  USING (
    fogoneria.is_bypass()
    OR EXISTS (
      SELECT 1 FROM combos c
      WHERE c.id = combo_id
        AND c.empresa_id = fogoneria.current_empresa_id()
    )
  )
  WITH CHECK (
    fogoneria.is_bypass()
    OR EXISTS (
      SELECT 1 FROM combos c
      WHERE c.id = combo_id
        AND c.empresa_id = fogoneria.current_empresa_id()
    )
  );

ALTER TABLE escandallos_recetas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_escandallos_recetas ON escandallos_recetas;
CREATE POLICY tenant_isolation_escandallos_recetas ON escandallos_recetas
  FOR ALL
  USING (
    fogoneria.is_bypass()
    OR EXISTS (
      SELECT 1 FROM platos p
      WHERE p.id = plato_id
        AND p.empresa_id = fogoneria.current_empresa_id()
    )
  )
  WITH CHECK (
    fogoneria.is_bypass()
    OR EXISTS (
      SELECT 1 FROM platos p
      WHERE p.id = plato_id
        AND p.empresa_id = fogoneria.current_empresa_id()
    )
  );

ALTER TABLE detalles_orden ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_detalles_orden ON detalles_orden;
CREATE POLICY tenant_isolation_detalles_orden ON detalles_orden
  FOR ALL
  USING (
    fogoneria.is_bypass()
    OR EXISTS (
      SELECT 1 FROM ordenes o
      WHERE o.id = orden_id
        AND o.empresa_id = fogoneria.current_empresa_id()
        AND (
          fogoneria.current_sucursal_id() IS NULL
          OR o.sucursal_id = fogoneria.current_sucursal_id()
        )
    )
  )
  WITH CHECK (
    fogoneria.is_bypass()
    OR EXISTS (
      SELECT 1 FROM ordenes o
      WHERE o.id = orden_id
        AND o.empresa_id = fogoneria.current_empresa_id()
        AND (
          fogoneria.current_sucursal_id() IS NULL
          OR o.sucursal_id = fogoneria.current_sucursal_id()
        )
    )
  );

ALTER TABLE detalles_orden_modificadores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_detalles_orden_modificadores ON detalles_orden_modificadores;
CREATE POLICY tenant_isolation_detalles_orden_modificadores ON detalles_orden_modificadores
  FOR ALL
  USING (
    fogoneria.is_bypass()
    OR EXISTS (
      SELECT 1
      FROM detalles_orden d
      JOIN ordenes o ON o.id = d.orden_id
      WHERE d.id = detalle_id
        AND o.empresa_id = fogoneria.current_empresa_id()
        AND (
          fogoneria.current_sucursal_id() IS NULL
          OR o.sucursal_id = fogoneria.current_sucursal_id()
        )
    )
  )
  WITH CHECK (
    fogoneria.is_bypass()
    OR EXISTS (
      SELECT 1
      FROM detalles_orden d
      JOIN ordenes o ON o.id = d.orden_id
      WHERE d.id = detalle_id
        AND o.empresa_id = fogoneria.current_empresa_id()
        AND (
          fogoneria.current_sucursal_id() IS NULL
          OR o.sucursal_id = fogoneria.current_sucursal_id()
        )
    )
  );

ALTER TABLE repartos_propinas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_repartos_propinas ON repartos_propinas;
CREATE POLICY tenant_isolation_repartos_propinas ON repartos_propinas
  FOR ALL
  USING (
    fogoneria.is_bypass()
    OR EXISTS (
      SELECT 1 FROM pozos_propinas p
      WHERE p.id = pozo_id
        AND p.empresa_id = fogoneria.current_empresa_id()
        AND (
          fogoneria.current_sucursal_id() IS NULL
          OR p.sucursal_id = fogoneria.current_sucursal_id()
        )
    )
  )
  WITH CHECK (
    fogoneria.is_bypass()
    OR EXISTS (
      SELECT 1 FROM pozos_propinas p
      WHERE p.id = pozo_id
        AND p.empresa_id = fogoneria.current_empresa_id()
        AND (
          fogoneria.current_sucursal_id() IS NULL
          OR p.sucursal_id = fogoneria.current_sucursal_id()
        )
    )
  );

-- ----------------------------------------------------------------------------
-- 8. Comentarios
-- ----------------------------------------------------------------------------
COMMENT ON TABLE empresas IS 'Tenant SaaS. Ciclo: LEAD > TRIAL(14d) > ACTIVE > SUSPENDED/EXPIRED. CT-01 morosidad. RLS AYCDS-62.';
COMMENT ON TABLE ordenes IS 'KDS: POR_CONFIRMAR > EN_COCINA > LISTO > ENTREGADO (+ANULADA solo desde POR_CONFIRMAR, CERRADA/PAGADA). SLA 20min. RLS AYCDS-62.';
COMMENT ON TABLE comprobantes IS 'Correlativo B001-1041 por empresa. Anular resta Total Cobrado y ajusta turno abierto (CT-03). Soft-delete por estado. RLS AYCDS-62.';
