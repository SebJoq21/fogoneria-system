-- ============================================================================
-- Fogonería System — Modelo físico PostgreSQL 14+
-- SaaS ERP gastronómico multitenant: 1 empresa -> N sucursales
-- Fuentes: DOCUMENTACIÓN (PR-FG-01..21, CT-FG-01..09),
--   apps/web/lib/erp.ts, erp-catalog.ts, auth.ts, tenancy.ts, demo.ts,
--   landing src/lib/landing.ts, site.ts
-- Convenciones skill modelador-postgresql:
--   esquema fogoneria, snake_case español, tablas plural,
--   PK id UUID DEFAULT gen_random_uuid(), dinero NUMERIC(12,2),
--   fechas TIMESTAMPTZ, FKs con ON DELETE/UPDATE + índice propio.
-- Ejecución: psql -f fogoneria_schema.sql  (o pgAdmin/DBeaver/DataGrip)
-- ============================================================================

-- Crear la base aparte (no se puede mezclar con transacción):
-- CREATE DATABASE fogoneria_db OWNER fogoneria_app ENCODING 'UTF8';

CREATE SCHEMA IF NOT EXISTS fogoneria;
SET search_path TO fogoneria, public;

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Extensiones
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ----------------------------------------------------------------------------
-- 2. Tipos ENUM (re-ejecutables vía DO)
-- ----------------------------------------------------------------------------
DO $$ BEGIN CREATE TYPE estado_empresa AS ENUM ('LEAD','NO_CALIFICADO','TRIAL','ACTIVE','SUSPENDED','EXPIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE plan_suscripcion AS ENUM ('TRIAL','BASICO','PROFESIONAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE rango_sucursales AS ENUM ('1','2-3','4+'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE estado_lead AS ENUM ('NUEVO','CONTACTADO','PROPUESTA','GANADO','DESCARTADO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE rol_usuario AS ENUM ('SUPERADMIN','ADMIN_GLOBAL','GERENTE_SUCURSAL','COCINERO','MESERO','CAJERO','ANFITRION','BARMAN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE estado_usuario AS ENUM ('ACTIVO','INVITADO','SUSPENDIDO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE estado_sucursal AS ENUM ('ABIERTA','CERRADA'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE origen_orden AS ENUM ('MESA','WEB','DELIVERY','BARRA'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE estado_orden AS ENUM ('POR_CONFIRMAR','EN_COCINA','LISTO','ENTREGADO','ANULADA','CERRADA','PAGADA'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE tipo_detalle_orden AS ENUM ('PLATO','COMBO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE estado_mesa AS ENUM ('LIBRE','OCUPADA','RESERVADA','MANTENIMIENTO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE forma_mesa AS ENUM ('REDONDA','RECTANGULAR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE estado_reserva AS ENUM ('POR_CONFIRMAR','CONFIRMADA','EJECUTADA','CANCELADA','NO_SHOW'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE estado_turno_caja AS ENUM ('ABIERTO','CERRADO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE tipo_movimiento_caja AS ENUM ('INGRESO','EGRESO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE metodo_pago AS ENUM ('EFECTIVO','TARJETA','YAPE','TRANSFERENCIA'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE tipo_comprobante AS ENUM ('BOLETA','FACTURA','TICKET'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE estado_comprobante AS ENUM ('PAGADA','ANULADA'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE categoria_gasto AS ENUM ('INSUMOS','SERVICIOS','PERSONAL','ALQUILER','MARKETING','OTROS'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE estado_pago_gasto AS ENUM ('PAGADO','PENDIENTE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE tipo_movimiento_inventario AS ENUM ('ENTRADA','SALIDA','AJUSTE','MERMA'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE segmento_cliente AS ENUM ('NUEVO','FRECUENTE','VIP'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE tipo_movimiento_puntos AS ENUM ('GANANCIA','CANJE','CADUCIDAD'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE tipo_descuento_cupon AS ENUM ('PORCENTAJE','MONTO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE bloque_turno AS ENUM ('MANANA','TARDE','NOCHE','DESCANSO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE estado_asistencia AS ENUM ('PRESENTE','TARDANZA','FALTA','DESCANSO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE estado_pozo_propina AS ENUM ('CALCULADO','REPARTIDO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 3. Función updated_at (PostgreSQL no tiene ON UPDATE CURRENT_TIMESTAMP)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 4. Tablas independientes primero (orden topológico)
-- ----------------------------------------------------------------------------

-- 4.1 SaaS / Tenant ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS empresas (
  id UUID DEFAULT gen_random_uuid(),
  nombre_legal TEXT NOT NULL,
  nombre_comercial TEXT,
  ruc VARCHAR(11) NOT NULL,
  logo_url TEXT,
  limite_sucursales INTEGER NOT NULL DEFAULT 3,
  modulos_habilitados JSONB NOT NULL DEFAULT '[]'::jsonb,
  estado estado_empresa NOT NULL DEFAULT 'TRIAL',
  plan_actual plan_suscripcion NOT NULL DEFAULT 'TRIAL',
  mrr_monto NUMERIC(12,2) NOT NULL DEFAULT 0,
  trial_inicio TIMESTAMPTZ,
  trial_fin TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT pk_empresas PRIMARY KEY (id),
  CONSTRAINT uq_empresas_ruc UNIQUE (ruc),
  CONSTRAINT ck_empresas_ruc_formato CHECK (ruc ~ '^[0-9]{11}$'),
  CONSTRAINT ck_empresas_limite CHECK (limite_sucursales >= 1),
  CONSTRAINT ck_empresas_mrr CHECK (mrr_monto >= 0),
  CONSTRAINT ck_empresas_trial CHECK (trial_fin IS NULL OR trial_inicio IS NULL OR trial_fin > trial_inicio)
);

CREATE TABLE IF NOT EXISTS sucursales (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  nombre_corto TEXT,
  direccion TEXT,
  telefono TEXT,
  aforo INTEGER,
  es_matriz BOOLEAN NOT NULL DEFAULT false,
  estado estado_sucursal NOT NULL DEFAULT 'ABIERTA',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT pk_sucursales PRIMARY KEY (id),
  CONSTRAINT fk_sucursales_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_sucursales_empresa_nombre UNIQUE (empresa_id, nombre),
  CONSTRAINT ck_sucursales_aforo CHECK (aforo IS NULL OR aforo > 0)
);
CREATE INDEX IF NOT EXISTS idx_sucursales_empresa ON sucursales (empresa_id);

CREATE TABLE IF NOT EXISTS leads_cotizaciones (
  id UUID DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  telefono TEXT NOT NULL,
  email CITEXT NOT NULL,
  negocio TEXT NOT NULL,
  rango_sucursales rango_sucursales NOT NULL,
  estado estado_lead NOT NULL DEFAULT 'NUEVO',
  empresa_creada_id UUID,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_leads PRIMARY KEY (id),
  CONSTRAINT fk_leads_empresa FOREIGN KEY (empresa_creada_id) REFERENCES empresas (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT ck_leads_email CHECK (email::text LIKE '%@%')
);
CREATE INDEX IF NOT EXISTS idx_leads_empresa ON leads_cotizaciones (empresa_creada_id);
CREATE INDEX IF NOT EXISTS idx_leads_estado ON leads_cotizaciones (estado);

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID,
  sucursal_id UUID,
  nombre TEXT NOT NULL,
  email CITEXT NOT NULL,
  password_hash TEXT NOT NULL,
  rol rol_usuario NOT NULL,
  estado estado_usuario NOT NULL DEFAULT 'ACTIVO',
  ultimo_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT pk_usuarios PRIMARY KEY (id),
  CONSTRAINT fk_usuarios_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_usuarios_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT uq_usuarios_empresa_email UNIQUE (empresa_id, email),
  CONSTRAINT ck_usuarios_superadmin_sin_empresa CHECK (rol <> 'SUPERADMIN' OR empresa_id IS NULL),
  CONSTRAINT ck_usuarios_email CHECK (email::text LIKE '%@%')
);
CREATE INDEX IF NOT EXISTS idx_usuarios_empresa ON usuarios (empresa_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_sucursal ON usuarios (sucursal_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_email_global ON usuarios (email) WHERE empresa_id IS NULL;

CREATE TABLE IF NOT EXISTS suscripciones_eventos (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  plan plan_suscripcion NOT NULL,
  estado_anterior estado_empresa,
  estado_nuevo estado_empresa NOT NULL,
  motivo TEXT,
  mrr_antes NUMERIC(12,2),
  mrr_despues NUMERIC(12,2),
  actor_usuario_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_suscripciones PRIMARY KEY (id),
  CONSTRAINT fk_suscripciones_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_suscripciones_actor FOREIGN KEY (actor_usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT ck_suscripciones_mrr CHECK ((mrr_antes IS NULL OR mrr_antes >= 0) AND (mrr_despues IS NULL OR mrr_despues >= 0))
);
CREATE INDEX IF NOT EXISTS idx_suscripciones_empresa ON suscripciones_eventos (empresa_id);

-- 4.2 Catálogo (maestro por empresa, compartido entre sucursales) --------------
CREATE TABLE IF NOT EXISTS categorias (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  posicion INTEGER NOT NULL DEFAULT 0,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_categorias PRIMARY KEY (id),
  CONSTRAINT fk_categorias_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_categorias_empresa_nombre UNIQUE (empresa_id, nombre)
);
CREATE INDEX IF NOT EXISTS idx_categorias_empresa ON categorias (empresa_id);

CREATE TABLE IF NOT EXISTS grupos_modificadores (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  obligatorio BOOLEAN NOT NULL DEFAULT false,
  permite_multiple BOOLEAN NOT NULL DEFAULT false,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_grupos_mod PRIMARY KEY (id),
  CONSTRAINT fk_grupos_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_grupos_empresa_nombre UNIQUE (empresa_id, nombre)
);
CREATE INDEX IF NOT EXISTS idx_grupos_empresa ON grupos_modificadores (empresa_id);

CREATE TABLE IF NOT EXISTS opciones_modificadores (
  id UUID DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  precio_extra NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_opciones_mod PRIMARY KEY (id),
  CONSTRAINT fk_opciones_grupo FOREIGN KEY (grupo_id) REFERENCES grupos_modificadores (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_opciones_grupo_nombre UNIQUE (grupo_id, nombre),
  CONSTRAINT ck_opciones_precio CHECK (precio_extra >= 0)
);
CREATE INDEX IF NOT EXISTS idx_opciones_grupo ON opciones_modificadores (grupo_id);

CREATE TABLE IF NOT EXISTS platos (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  categoria_id UUID NOT NULL,
  sku TEXT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  foto_url TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  costo_real NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT pk_platos PRIMARY KEY (id),
  CONSTRAINT fk_platos_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_platos_categoria FOREIGN KEY (categoria_id) REFERENCES categorias (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT uq_platos_empresa_sku UNIQUE (empresa_id, sku),
  CONSTRAINT ck_platos_costo CHECK (costo_real >= 0)
);
CREATE INDEX IF NOT EXISTS idx_platos_empresa ON platos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_platos_categoria ON platos (categoria_id);

CREATE TABLE IF NOT EXISTS platos_grupos_modificadores (
  plato_id UUID NOT NULL,
  grupo_id UUID NOT NULL,
  PRIMARY KEY (plato_id, grupo_id),
  CONSTRAINT fk_pgm_plato FOREIGN KEY (plato_id) REFERENCES platos (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_pgm_grupo FOREIGN KEY (grupo_id) REFERENCES grupos_modificadores (id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pgm_grupo ON platos_grupos_modificadores (grupo_id);

CREATE TABLE IF NOT EXISTS listas_precios (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  activa BOOLEAN NOT NULL DEFAULT false,
  vigencia_desde DATE,
  vigencia_hasta DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_listas PRIMARY KEY (id),
  CONSTRAINT fk_listas_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_listas_empresa_nombre UNIQUE (empresa_id, nombre),
  CONSTRAINT ck_listas_vigencia CHECK (vigencia_hasta IS NULL OR vigencia_desde IS NULL OR vigencia_hasta >= vigencia_desde)
);
CREATE INDEX IF NOT EXISTS idx_listas_empresa ON listas_precios (empresa_id);

CREATE TABLE IF NOT EXISTS precios_platos (
  lista_id UUID NOT NULL,
  plato_id UUID NOT NULL,
  precio NUMERIC(12,2) NOT NULL,
  PRIMARY KEY (lista_id, plato_id),
  CONSTRAINT fk_precios_lista FOREIGN KEY (lista_id) REFERENCES listas_precios (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_precios_plato FOREIGN KEY (plato_id) REFERENCES platos (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ck_precios_precio CHECK (precio >= 0)
);
CREATE INDEX IF NOT EXISTS idx_precios_plato ON precios_platos (plato_id);

CREATE TABLE IF NOT EXISTS combos (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio_fijo NUMERIC(12,2) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_combos PRIMARY KEY (id),
  CONSTRAINT fk_combos_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_combos_empresa_nombre UNIQUE (empresa_id, nombre),
  CONSTRAINT ck_combos_precio CHECK (precio_fijo >= 0)
);
CREATE INDEX IF NOT EXISTS idx_combos_empresa ON combos (empresa_id);

CREATE TABLE IF NOT EXISTS combos_platos (
  combo_id UUID NOT NULL,
  plato_id UUID NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (combo_id, plato_id),
  CONSTRAINT fk_cp_combo FOREIGN KEY (combo_id) REFERENCES combos (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cp_plato FOREIGN KEY (plato_id) REFERENCES platos (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ck_cp_cantidad CHECK (cantidad > 0)
);
CREATE INDEX IF NOT EXISTS idx_cp_plato ON combos_platos (plato_id);

CREATE TABLE IF NOT EXISTS reglas_horarias_promos (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  beneficio TEXT NOT NULL,
  dias_semana INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_reglas PRIMARY KEY (id),
  CONSTRAINT fk_reglas_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_reglas_empresa_nombre UNIQUE (empresa_id, nombre),
  CONSTRAINT ck_reglas_horas CHECK (hora_fin > hora_inicio)
);
CREATE INDEX IF NOT EXISTS idx_reglas_empresa ON reglas_horarias_promos (empresa_id);

CREATE TABLE IF NOT EXISTS cupones (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  codigo TEXT NOT NULL,
  tipo_descuento tipo_descuento_cupon NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  limite_usos INTEGER NOT NULL,
  usos_actuales INTEGER NOT NULL DEFAULT 0,
  vencimiento DATE NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_cupones PRIMARY KEY (id),
  CONSTRAINT fk_cupones_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_cupones_empresa_codigo UNIQUE (empresa_id, codigo),
  CONSTRAINT ck_cupones_valor CHECK (valor > 0),
  CONSTRAINT ck_cupones_limite CHECK (limite_usos > 0),
  CONSTRAINT ck_cupones_usos CHECK (usos_actuales >= 0 AND usos_actuales <= limite_usos)
);
CREATE INDEX IF NOT EXISTS idx_cupones_empresa ON cupones (empresa_id);

CREATE TABLE IF NOT EXISTS proveedores (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  ruc VARCHAR(11),
  telefono TEXT,
  rubro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_proveedores PRIMARY KEY (id),
  CONSTRAINT fk_proveedores_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_proveedores_empresa_nombre UNIQUE (empresa_id, nombre),
  CONSTRAINT ck_proveedores_ruc CHECK (ruc IS NULL OR ruc ~ '^[0-9]{11}$')
);
CREATE INDEX IF NOT EXISTS idx_proveedores_empresa ON proveedores (empresa_id);

CREATE TABLE IF NOT EXISTS insumos (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  proveedor_id UUID,
  nombre TEXT NOT NULL,
  categoria TEXT,
  unidad TEXT NOT NULL DEFAULT 'kg',
  costo_promedio NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT pk_insumos PRIMARY KEY (id),
  CONSTRAINT fk_insumos_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_insumos_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT uq_insumos_empresa_nombre UNIQUE (empresa_id, nombre),
  CONSTRAINT ck_insumos_costo CHECK (costo_promedio >= 0)
);
CREATE INDEX IF NOT EXISTS idx_insumos_empresa ON insumos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_insumos_proveedor ON insumos (proveedor_id);

-- 4.3 CRM (global por empresa) ------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  telefono TEXT NOT NULL,
  segmento segmento_cliente NOT NULL DEFAULT 'NUEVO',
  visitas INTEGER NOT NULL DEFAULT 0,
  puntos INTEGER NOT NULL DEFAULT 0,
  ultima_visita DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_clientes PRIMARY KEY (id),
  CONSTRAINT fk_clientes_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_clientes_empresa_tel UNIQUE (empresa_id, telefono),
  CONSTRAINT ck_clientes_visitas CHECK (visitas >= 0),
  CONSTRAINT ck_clientes_puntos CHECK (puntos >= 0)
);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa ON clientes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_telefono ON clientes (telefono);

CREATE TABLE IF NOT EXISTS config_lealtad (
  empresa_id UUID,
  puntos_por_moneda NUMERIC(10,2) NOT NULL DEFAULT 1.00,
  caducidad_meses INTEGER NOT NULL DEFAULT 12,
  umbral_frecuente INTEGER NOT NULL DEFAULT 5,
  umbral_vip INTEGER NOT NULL DEFAULT 20,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_config_lealtad PRIMARY KEY (empresa_id),
  CONSTRAINT fk_config_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ck_config_puntos CHECK (puntos_por_moneda > 0),
  CONSTRAINT ck_config_umbrales CHECK (umbral_vip > umbral_frecuente AND umbral_frecuente > 0)
);

-- 4.4 RRHH base ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles_empresa (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_roles PRIMARY KEY (id),
  CONSTRAINT fk_roles_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_roles_empresa_nombre UNIQUE (empresa_id, nombre)
);
CREATE INDEX IF NOT EXISTS idx_roles_empresa ON roles_empresa (empresa_id);

CREATE TABLE IF NOT EXISTS empleados (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  sucursal_id UUID NOT NULL,
  usuario_id UUID,
  nombre TEXT NOT NULL,
  rol_id UUID NOT NULL,
  en_turno BOOLEAN NOT NULL DEFAULT false,
  fecha_ingreso DATE,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_empleados PRIMARY KEY (id),
  CONSTRAINT fk_empleados_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_empleados_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_empleados_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_empleados_rol FOREIGN KEY (rol_id) REFERENCES roles_empresa (id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_empleados_empresa ON empleados (empresa_id);
CREATE INDEX IF NOT EXISTS idx_empleados_sucursal ON empleados (sucursal_id);
CREATE INDEX IF NOT EXISTS idx_empleados_rol ON empleados (rol_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_empleados_usuario ON empleados (usuario_id) WHERE usuario_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 5. Tablas operativas por sucursal
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mesas (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  sucursal_id UUID NOT NULL,
  numero TEXT NOT NULL,
  capacidad INTEGER NOT NULL,
  zona TEXT NOT NULL DEFAULT 'Salón',
  forma forma_mesa NOT NULL DEFAULT 'RECTANGULAR',
  estado estado_mesa NOT NULL DEFAULT 'LIBRE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_mesas PRIMARY KEY (id),
  CONSTRAINT fk_mesas_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_mesas_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_mesas_sucursal_numero UNIQUE (sucursal_id, numero),
  CONSTRAINT ck_mesas_capacidad CHECK (capacidad > 0)
);
CREATE INDEX IF NOT EXISTS idx_mesas_empresa ON mesas (empresa_id);
CREATE INDEX IF NOT EXISTS idx_mesas_sucursal ON mesas (sucursal_id);
CREATE INDEX IF NOT EXISTS idx_mesas_estado ON mesas (sucursal_id, estado);

CREATE TABLE IF NOT EXISTS reservas (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  sucursal_id UUID NOT NULL,
  mesa_id UUID NOT NULL,
  codigo TEXT NOT NULL,
  cliente_nombre TEXT NOT NULL,
  telefono TEXT,
  nro_comensales INTEGER NOT NULL,
  fecha_hora TIMESTAMPTZ NOT NULL,
  estado estado_reserva NOT NULL DEFAULT 'POR_CONFIRMAR',
  canal TEXT NOT NULL DEFAULT 'Presencial',
  notas TEXT,
  creada_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_reservas PRIMARY KEY (id),
  CONSTRAINT fk_reservas_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_reservas_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_reservas_mesa FOREIGN KEY (mesa_id) REFERENCES mesas (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_reservas_creada FOREIGN KEY (creada_por) REFERENCES usuarios (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT uq_reservas_empresa_codigo UNIQUE (empresa_id, codigo),
  CONSTRAINT ck_reservas_comensales CHECK (nro_comensales > 0)
);
CREATE INDEX IF NOT EXISTS idx_reservas_empresa ON reservas (empresa_id);
CREATE INDEX IF NOT EXISTS idx_reservas_sucursal ON reservas (sucursal_id);
CREATE INDEX IF NOT EXISTS idx_reservas_mesa ON reservas (mesa_id);

CREATE TABLE IF NOT EXISTS ordenes (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  sucursal_id UUID NOT NULL,
  numero_orden TEXT NOT NULL,
  mesa_id UUID,
  cliente_id UUID,
  mesero_id UUID,
  origen origen_orden NOT NULL DEFAULT 'MESA',
  estado estado_orden NOT NULL DEFAULT 'POR_CONFIRMAR',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  descuento_cupon NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  lista_precio_id UUID,
  cupon_id UUID,
  ingreso_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmacion_at TIMESTAMPTZ,
  listo_at TIMESTAMPTZ,
  entrega_at TIMESTAMPTZ,
  alerta_sla BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_ordenes PRIMARY KEY (id),
  CONSTRAINT fk_ordenes_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ordenes_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ordenes_mesa FOREIGN KEY (mesa_id) REFERENCES mesas (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_ordenes_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_ordenes_mesero FOREIGN KEY (mesero_id) REFERENCES usuarios (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_ordenes_lista FOREIGN KEY (lista_precio_id) REFERENCES listas_precios (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_ordenes_cupon FOREIGN KEY (cupon_id) REFERENCES cupones (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT uq_ordenes_empresa_numero UNIQUE (empresa_id, numero_orden),
  CONSTRAINT ck_ordenes_totales CHECK (subtotal >= 0 AND descuento_cupon >= 0 AND total >= 0 AND descuento_cupon <= subtotal)
);
CREATE INDEX IF NOT EXISTS idx_ordenes_empresa ON ordenes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_sucursal ON ordenes (sucursal_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON ordenes (sucursal_id, estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_mesa ON ordenes (mesa_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_cliente ON ordenes (cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_mesero ON ordenes (mesero_id);

CREATE TABLE IF NOT EXISTS detalles_orden (
  id UUID DEFAULT gen_random_uuid(),
  orden_id UUID NOT NULL,
  tipo tipo_detalle_orden NOT NULL,
  plato_id UUID,
  combo_id UUID,
  cantidad INTEGER NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_detalles PRIMARY KEY (id),
  CONSTRAINT fk_detalles_orden FOREIGN KEY (orden_id) REFERENCES ordenes (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_detalles_plato FOREIGN KEY (plato_id) REFERENCES platos (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_detalles_combo FOREIGN KEY (combo_id) REFERENCES combos (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ck_detalles_cantidad CHECK (cantidad > 0),
  CONSTRAINT ck_detalles_precios CHECK (precio_unitario >= 0 AND subtotal >= 0),
  CONSTRAINT ck_detalles_tipo CHECK (
    (tipo = 'PLATO' AND plato_id IS NOT NULL AND combo_id IS NULL) OR
    (tipo = 'COMBO' AND combo_id IS NOT NULL AND plato_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_detalles_orden ON detalles_orden (orden_id);
CREATE INDEX IF NOT EXISTS idx_detalles_plato ON detalles_orden (plato_id);
CREATE INDEX IF NOT EXISTS idx_detalles_combo ON detalles_orden (combo_id);

CREATE TABLE IF NOT EXISTS detalles_orden_modificadores (
  detalle_id UUID NOT NULL,
  opcion_id UUID NOT NULL,
  precio_extra NUMERIC(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (detalle_id, opcion_id),
  CONSTRAINT fk_dom_detalle FOREIGN KEY (detalle_id) REFERENCES detalles_orden (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_dom_opcion FOREIGN KEY (opcion_id) REFERENCES opciones_modificadores (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ck_dom_precio CHECK (precio_extra >= 0)
);
CREATE INDEX IF NOT EXISTS idx_dom_opcion ON detalles_orden_modificadores (opcion_id);

CREATE TABLE IF NOT EXISTS stocks_sucursal (
  sucursal_id UUID NOT NULL,
  insumo_id UUID NOT NULL,
  empresa_id UUID NOT NULL,
  cantidad NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_minimo NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sucursal_id, insumo_id),
  CONSTRAINT fk_stock_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_stock_insumo FOREIGN KEY (insumo_id) REFERENCES insumos (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_stock_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ck_stock_cantidad CHECK (cantidad >= 0),
  CONSTRAINT ck_stock_minimo CHECK (stock_minimo >= 0)
);
CREATE INDEX IF NOT EXISTS idx_stock_insumo ON stocks_sucursal (insumo_id);
CREATE INDEX IF NOT EXISTS idx_stock_empresa ON stocks_sucursal (empresa_id);

CREATE TABLE IF NOT EXISTS escandallos_recetas (
  plato_id UUID NOT NULL,
  insumo_id UUID NOT NULL,
  cantidad_por_plato NUMERIC(12,3) NOT NULL,
  unidad TEXT NOT NULL DEFAULT 'kg',
  PRIMARY KEY (plato_id, insumo_id),
  CONSTRAINT fk_esc_plato FOREIGN KEY (plato_id) REFERENCES platos (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_esc_insumo FOREIGN KEY (insumo_id) REFERENCES insumos (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ck_esc_cantidad CHECK (cantidad_por_plato > 0)
);
CREATE INDEX IF NOT EXISTS idx_esc_insumo ON escandallos_recetas (insumo_id);

CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  sucursal_id UUID NOT NULL,
  insumo_id UUID NOT NULL,
  tipo tipo_movimiento_inventario NOT NULL,
  cantidad NUMERIC(12,3) NOT NULL,
  stock_resultante NUMERIC(12,3),
  motivo TEXT,
  orden_id UUID,
  actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_movinv PRIMARY KEY (id),
  CONSTRAINT fk_movinv_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_movinv_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_movinv_insumo FOREIGN KEY (insumo_id) REFERENCES insumos (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_movinv_orden FOREIGN KEY (orden_id) REFERENCES ordenes (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_movinv_actor FOREIGN KEY (actor_id) REFERENCES usuarios (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT ck_movinv_cantidad CHECK (cantidad <> 0)
);
CREATE INDEX IF NOT EXISTS idx_movinv_empresa ON movimientos_inventario (empresa_id);
CREATE INDEX IF NOT EXISTS idx_movinv_sucursal ON movimientos_inventario (sucursal_id);
CREATE INDEX IF NOT EXISTS idx_movinv_insumo ON movimientos_inventario (insumo_id);
CREATE INDEX IF NOT EXISTS idx_movinv_orden ON movimientos_inventario (orden_id);

CREATE TABLE IF NOT EXISTS turnos_caja (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  sucursal_id UUID NOT NULL,
  cajero_id UUID,
  apertura_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cierre_at TIMESTAMPTZ,
  fondo_apertura NUMERIC(12,2) NOT NULL DEFAULT 0,
  ingresos_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  egresos_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  saldo NUMERIC(12,2),
  estado estado_turno_caja NOT NULL DEFAULT 'ABIERTO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_turnos PRIMARY KEY (id),
  CONSTRAINT fk_turnos_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_turnos_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_turnos_cajero FOREIGN KEY (cajero_id) REFERENCES usuarios (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT ck_turnos_fondo CHECK (fondo_apertura >= 0),
  CONSTRAINT ck_turnos_totales CHECK (ingresos_total >= 0 AND egresos_total >= 0),
  CONSTRAINT ck_turnos_cierre CHECK (cierre_at IS NULL OR cierre_at > apertura_at)
);
CREATE INDEX IF NOT EXISTS idx_turnos_empresa ON turnos_caja (empresa_id);
CREATE INDEX IF NOT EXISTS idx_turnos_sucursal ON turnos_caja (sucursal_id);
CREATE INDEX IF NOT EXISTS idx_turnos_estado ON turnos_caja (sucursal_id, estado);

CREATE TABLE IF NOT EXISTS gastos (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  sucursal_id UUID NOT NULL,
  concepto TEXT NOT NULL,
  monto NUMERIC(12,2) NOT NULL,
  categoria categoria_gasto NOT NULL,
  estado_pago estado_pago_gasto NOT NULL DEFAULT 'PENDIENTE',
  pagado_en_caja BOOLEAN NOT NULL DEFAULT false,
  turno_id UUID,
  proveedor_id UUID,
  vencimiento DATE,
  registrado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_gastos PRIMARY KEY (id),
  CONSTRAINT fk_gastos_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_gastos_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_gastos_turno FOREIGN KEY (turno_id) REFERENCES turnos_caja (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_gastos_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_gastos_registrado FOREIGN KEY (registrado_por) REFERENCES usuarios (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT ck_gastos_monto CHECK (monto > 0)
);
CREATE INDEX IF NOT EXISTS idx_gastos_empresa ON gastos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_gastos_sucursal ON gastos (sucursal_id);
CREATE INDEX IF NOT EXISTS idx_gastos_turno ON gastos (turno_id);
CREATE INDEX IF NOT EXISTS idx_gastos_proveedor ON gastos (proveedor_id);

CREATE TABLE IF NOT EXISTS movimientos_caja (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  turno_id UUID NOT NULL,
  tipo tipo_movimiento_caja NOT NULL,
  concepto TEXT NOT NULL,
  monto NUMERIC(12,2) NOT NULL,
  metodo metodo_pago NOT NULL,
  orden_id UUID,
  gasto_id UUID,
  actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_movcaja PRIMARY KEY (id),
  CONSTRAINT fk_movcaja_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_movcaja_turno FOREIGN KEY (turno_id) REFERENCES turnos_caja (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_movcaja_orden FOREIGN KEY (orden_id) REFERENCES ordenes (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_movcaja_gasto FOREIGN KEY (gasto_id) REFERENCES gastos (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_movcaja_actor FOREIGN KEY (actor_id) REFERENCES usuarios (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT ck_movcaja_monto CHECK (monto > 0)
);
CREATE INDEX IF NOT EXISTS idx_movcaja_empresa ON movimientos_caja (empresa_id);
CREATE INDEX IF NOT EXISTS idx_movcaja_turno ON movimientos_caja (turno_id);
CREATE INDEX IF NOT EXISTS idx_movcaja_orden ON movimientos_caja (orden_id);
CREATE INDEX IF NOT EXISTS idx_movcaja_gasto ON movimientos_caja (gasto_id);

CREATE TABLE IF NOT EXISTS comprobantes (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  sucursal_id UUID NOT NULL,
  tipo tipo_comprobante NOT NULL DEFAULT 'BOLETA',
  serie_numero TEXT NOT NULL,
  orden_id UUID NOT NULL,
  cliente_ref TEXT,
  total NUMERIC(12,2) NOT NULL,
  estado estado_comprobante NOT NULL DEFAULT 'PAGADA',
  emitido_por UUID,
  anulado_por UUID,
  anulado_at TIMESTAMPTZ,
  motivo_anulacion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_comprobantes PRIMARY KEY (id),
  CONSTRAINT fk_comp_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_comp_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_comp_orden FOREIGN KEY (orden_id) REFERENCES ordenes (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_comp_emitido FOREIGN KEY (emitido_por) REFERENCES usuarios (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_comp_anulado FOREIGN KEY (anulado_por) REFERENCES usuarios (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT uq_comp_empresa_serie UNIQUE (empresa_id, serie_numero),
  CONSTRAINT ck_comp_total CHECK (total >= 0)
);
CREATE INDEX IF NOT EXISTS idx_comp_empresa ON comprobantes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_comp_sucursal ON comprobantes (sucursal_id);
CREATE INDEX IF NOT EXISTS idx_comp_orden ON comprobantes (orden_id);

CREATE TABLE IF NOT EXISTS canjes_cupones (
  id UUID DEFAULT gen_random_uuid(),
  cupon_id UUID NOT NULL,
  orden_id UUID NOT NULL,
  empresa_id UUID NOT NULL,
  sucursal_id UUID NOT NULL,
  monto_descontado NUMERIC(12,2) NOT NULL,
  aplicado_por UUID,
  aplicado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_canjes PRIMARY KEY (id),
  CONSTRAINT fk_canjes_cupon FOREIGN KEY (cupon_id) REFERENCES cupones (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_canjes_orden FOREIGN KEY (orden_id) REFERENCES ordenes (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_canjes_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_canjes_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_canjes_aplicado FOREIGN KEY (aplicado_por) REFERENCES usuarios (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT uq_canjes_cupon_orden UNIQUE (cupon_id, orden_id),
  CONSTRAINT ck_canjes_monto CHECK (monto_descontado >= 0)
);
CREATE INDEX IF NOT EXISTS idx_canjes_cupon ON canjes_cupones (cupon_id);
CREATE INDEX IF NOT EXISTS idx_canjes_orden ON canjes_cupones (orden_id);
CREATE INDEX IF NOT EXISTS idx_canjes_empresa ON canjes_cupones (empresa_id);
CREATE INDEX IF NOT EXISTS idx_canjes_sucursal ON canjes_cupones (sucursal_id);

CREATE TABLE IF NOT EXISTS movimientos_puntos (
  id UUID DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL,
  empresa_id UUID NOT NULL,
  sucursal_id UUID NOT NULL,
  tipo tipo_movimiento_puntos NOT NULL,
  puntos INTEGER NOT NULL,
  orden_id UUID,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_movpuntos PRIMARY KEY (id),
  CONSTRAINT fk_movpuntos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_movpuntos_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_movpuntos_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_movpuntos_orden FOREIGN KEY (orden_id) REFERENCES ordenes (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT ck_movpuntos CHECK (puntos <> 0)
);
CREATE INDEX IF NOT EXISTS idx_movpuntos_cliente ON movimientos_puntos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_movpuntos_empresa ON movimientos_puntos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_movpuntos_sucursal ON movimientos_puntos (sucursal_id);

CREATE TABLE IF NOT EXISTS turnos_plan (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  sucursal_id UUID NOT NULL,
  empleado_id UUID NOT NULL,
  fecha DATE NOT NULL,
  bloque bloque_turno NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_turnosplan PRIMARY KEY (id),
  CONSTRAINT fk_tp_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_tp_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_tp_empleado FOREIGN KEY (empleado_id) REFERENCES empleados (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_tp_empleado_fecha_bloque UNIQUE (empleado_id, fecha, bloque)
);
CREATE INDEX IF NOT EXISTS idx_tp_empresa ON turnos_plan (empresa_id);
CREATE INDEX IF NOT EXISTS idx_tp_sucursal ON turnos_plan (sucursal_id);
CREATE INDEX IF NOT EXISTS idx_tp_empleado ON turnos_plan (empleado_id);

CREATE TABLE IF NOT EXISTS asistencias (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  sucursal_id UUID NOT NULL,
  empleado_id UUID NOT NULL,
  fecha DATE NOT NULL,
  hora_entrada TIMESTAMPTZ,
  hora_salida TIMESTAMPTZ,
  estado estado_asistencia NOT NULL DEFAULT 'PRESENTE',
  fuente TEXT NOT NULL DEFAULT 'PIN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_asistencias PRIMARY KEY (id),
  CONSTRAINT fk_asis_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_asis_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_asis_empleado FOREIGN KEY (empleado_id) REFERENCES empleados (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_asis_empleado_fecha UNIQUE (empleado_id, fecha),
  CONSTRAINT ck_asis_horas CHECK (hora_salida IS NULL OR hora_entrada IS NULL OR hora_salida >= hora_entrada)
);
CREATE INDEX IF NOT EXISTS idx_asis_empresa ON asistencias (empresa_id);
CREATE INDEX IF NOT EXISTS idx_asis_sucursal ON asistencias (sucursal_id);
CREATE INDEX IF NOT EXISTS idx_asis_empleado ON asistencias (empleado_id);

CREATE TABLE IF NOT EXISTS pozos_propinas (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  sucursal_id UUID NOT NULL,
  fecha DATE NOT NULL,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  nro_beneficiarios INTEGER NOT NULL DEFAULT 0,
  estado estado_pozo_propina NOT NULL DEFAULT 'CALCULADO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_pozos PRIMARY KEY (id),
  CONSTRAINT fk_pozos_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_pozos_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_pozos_sucursal_fecha UNIQUE (sucursal_id, fecha),
  CONSTRAINT ck_pozos_total CHECK (total >= 0 AND nro_beneficiarios >= 0)
);
CREATE INDEX IF NOT EXISTS idx_pozos_empresa ON pozos_propinas (empresa_id);
CREATE INDEX IF NOT EXISTS idx_pozos_sucursal ON pozos_propinas (sucursal_id);

CREATE TABLE IF NOT EXISTS repartos_propinas (
  pozo_id UUID NOT NULL,
  empleado_id UUID NOT NULL,
  monto NUMERIC(12,2) NOT NULL,
  presente BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (pozo_id, empleado_id),
  CONSTRAINT fk_rep_pozo FOREIGN KEY (pozo_id) REFERENCES pozos_propinas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_rep_empleado FOREIGN KEY (empleado_id) REFERENCES empleados (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ck_rep_monto CHECK (monto >= 0)
);
CREATE INDEX IF NOT EXISTS idx_rep_empleado ON repartos_propinas (empleado_id);

CREATE TABLE IF NOT EXISTS auditoria (
  id UUID DEFAULT gen_random_uuid(),
  empresa_id UUID,
  sucursal_id UUID,
  usuario_id UUID,
  accion TEXT NOT NULL,
  entidad TEXT NOT NULL,
  entidad_id UUID,
  detalle JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_auditoria PRIMARY KEY (id),
  CONSTRAINT fk_aud_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_aud_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_aud_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_aud_empresa ON auditoria (empresa_id);
CREATE INDEX IF NOT EXISTS idx_aud_sucursal ON auditoria (sucursal_id);
CREATE INDEX IF NOT EXISTS idx_aud_usuario ON auditoria (usuario_id);
CREATE INDEX IF NOT EXISTS idx_aud_entidad ON auditoria (entidad, entidad_id);

-- ----------------------------------------------------------------------------
-- 6. Triggers updated_at
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_empresas_updated_at ON empresas;
CREATE TRIGGER trg_empresas_updated_at BEFORE UPDATE ON empresas FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_sucursales_updated_at ON sucursales;
CREATE TRIGGER trg_sucursales_updated_at BEFORE UPDATE ON sucursales FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads_cotizaciones;
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON leads_cotizaciones FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_usuarios_updated_at ON usuarios;
CREATE TRIGGER trg_usuarios_updated_at BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_categorias_updated_at ON categorias;
CREATE TRIGGER trg_categorias_updated_at BEFORE UPDATE ON categorias FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_platos_updated_at ON platos;
CREATE TRIGGER trg_platos_updated_at BEFORE UPDATE ON platos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_grupos_updated_at ON grupos_modificadores;
CREATE TRIGGER trg_grupos_updated_at BEFORE UPDATE ON grupos_modificadores FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_listas_updated_at ON listas_precios;
CREATE TRIGGER trg_listas_updated_at BEFORE UPDATE ON listas_precios FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_combos_updated_at ON combos;
CREATE TRIGGER trg_combos_updated_at BEFORE UPDATE ON combos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_reglas_updated_at ON reglas_horarias_promos;
CREATE TRIGGER trg_reglas_updated_at BEFORE UPDATE ON reglas_horarias_promos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_cupones_updated_at ON cupones;
CREATE TRIGGER trg_cupones_updated_at BEFORE UPDATE ON cupones FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_clientes_updated_at ON clientes;
CREATE TRIGGER trg_clientes_updated_at BEFORE UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_config_updated_at ON config_lealtad;
CREATE TRIGGER trg_config_updated_at BEFORE UPDATE ON config_lealtad FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_mesas_updated_at ON mesas;
CREATE TRIGGER trg_mesas_updated_at BEFORE UPDATE ON mesas FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_reservas_updated_at ON reservas;
CREATE TRIGGER trg_reservas_updated_at BEFORE UPDATE ON reservas FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_ordenes_updated_at ON ordenes;
CREATE TRIGGER trg_ordenes_updated_at BEFORE UPDATE ON ordenes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_insumos_updated_at ON insumos;
CREATE TRIGGER trg_insumos_updated_at BEFORE UPDATE ON insumos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_turnos_updated_at ON turnos_caja;
CREATE TRIGGER trg_turnos_updated_at BEFORE UPDATE ON turnos_caja FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_gastos_updated_at ON gastos;
CREATE TRIGGER trg_gastos_updated_at BEFORE UPDATE ON gastos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_roles_updated_at ON roles_empresa;
CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON roles_empresa FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_empleados_updated_at ON empleados;
CREATE TRIGGER trg_empleados_updated_at BEFORE UPDATE ON empleados FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_proveedores_updated_at ON proveedores;
CREATE TRIGGER trg_proveedores_updated_at BEFORE UPDATE ON proveedores FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- 7. Comentarios de documentación
-- ----------------------------------------------------------------------------
COMMENT ON SCHEMA fogoneria IS 'Fogoneria SaaS ERP gastronomico multitenant 1 empresa : N sucursales';
COMMENT ON TABLE empresas IS 'Tenant SaaS. Ciclo: LEAD > TRIAL(14d) > ACTIVE > SUSPENDED/EXPIRED. CT-01 morosidad.';
COMMENT ON TABLE sucursales IS 'Locales: Miraflores-Matriz, Surco, San Isidro. Operacion vive por sucursal_id.';
COMMENT ON TABLE leads_cotizaciones IS 'Formulario landing Cotiza tu sistema: nombre, apellido, telefono, email, negocio, rango sucursales.';
COMMENT ON TABLE usuarios IS 'RBAC: SUPERADMIN(/saas) > ADMIN_GLOBAL(/app) > GERENTE_SUCURSAL/Cajero/Anfitrion > COCINERO(KDS) > MESERO(mozo). password_hash bcrypt/argon2, nunca plano.';
COMMENT ON TABLE platos IS 'Maestro por empresa (SKU PLA-001 unico por tenant). Precio real vive en precios_platos por lista.';
COMMENT ON TABLE listas_precios IS 'Context router pricing: MESA->CARTA, WEB/DELIVERY->DELIVERY. CT-06.';
COMMENT ON TABLE combos IS 'Precio fijo congelado: update de plato NO propaga (shield CT-06).';
COMMENT ON TABLE cupones IS 'Validar usos_actuales < limite_usos AND hoy <= vencimiento (CT-05).';
COMMENT ON TABLE ordenes IS 'KDS: POR_CONFIRMAR > EN_COCINA > LISTO > ENTREGADO (+ANULADA solo desde POR_CONFIRMAR, CERRADA/PAGADA). SLA 20min en cocina.';
COMMENT ON TABLE movimientos_inventario IS 'Kardex: SALIDA automatica = SUM(detalle.cantidad * escandallo) al ENTREGADO (CT-04).';
COMMENT ON TABLE comprobantes IS 'Correlativo B001-1041 por empresa. Anular resta Total Cobrado y ajusta turno abierto (CT-03). Soft-delete por estado.';
COMMENT ON TABLE clientes IS 'CRM global por empresa. telefono = ID fidelidad, UNIQUE por tenant. Auto VIP>20 visitas, Frecuente>5.';
COMMENT ON TABLE auditoria IS 'Movimientos auditados por usuario (landing roles). Inmutabilidad financiera.';

-- ----------------------------------------------------------------------------
-- 8. Datos de prueba (mocks reales del sistema)
-- ----------------------------------------------------------------------------

-- Empresa demo + sucursales (tenancy.ts) --------------------------------------
INSERT INTO empresas (id, nombre_legal, nombre_comercial, ruc, limite_sucursales, modulos_habilitados, estado, plan_actual, mrr_monto, trial_inicio, trial_fin)
VALUES ('11111111-1111-4111-8111-111111111111','Mi Restaurante S.A.C.','Fogoneria Demo','20123456786',3,'["pedidos","carta","inventario","caja","asistencia","roles"]','ACTIVE','PROFESIONAL',99.00, now() - INTERVAL '20 days', now() - INTERVAL '6 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sucursales (id, empresa_id, nombre, nombre_corto, direccion, telefono, aforo, es_matriz, estado) VALUES
('22222222-2222-4222-8222-222222222222','11111111-1111-1111-1111-111111111111','Miraflores · Matriz','Miraflores','Av. José Pardo 456, Miraflores','+51 987 654 321',80,true,'ABIERTA'),
('33333333-3333-4333-8333-333333333333','11111111-1111-1111-1111-111111111111','Surco','Surco','Av. Encalada 1420, Surco','+51 955 231 884',60,false,'ABIERTA'),
('44444444-4444-4444-8444-444444444444','11111111-1111-1111-1111-111111111111','San Isidro','San Isidro','Av. Camino Real 390, San Isidro','+51 901 447 220',50,false,'CERRADA')
ON CONFLICT (id) DO NOTHING;

-- Usuarios demo (auth.ts: jerarquia superadmin > admin > sucursal + cocina + mesero)
INSERT INTO usuarios (id, empresa_id, sucursal_id, nombre, email, password_hash, rol, estado) VALUES
('55555555-5555-4555-8555-555555555555', NULL, NULL, 'Equipo Fogonería', 'super@fogoneria.com', '$2b$12$HASH_SUPERADMIN_DEMO', 'SUPERADMIN', 'ACTIVO'),
('55555555-5555-4555-8555-555555555556','11111111-1111-1111-1111-111111111111', NULL, 'Martín Quispe', 'admin@mirestaurante.com', '$2b$12$HASH_ADMIN_DEMO', 'ADMIN_GLOBAL', 'ACTIVO'),
('55555555-5555-4555-8555-555555555557','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','Rosa Quispe', 'sucursal@mirestaurante.com', '$2b$12$HASH_SUCURSAL_DEMO', 'GERENTE_SUCURSAL', 'ACTIVO'),
('55555555-5555-4555-8555-555555555558','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','Luis Huamán', 'cocina@mirestaurante.com', '$2b$12$HASH_COCINA_DEMO', 'COCINERO', 'ACTIVO'),
('55555555-5555-4555-8555-555555555559','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','Ana Beltrán', 'mesero@mirestaurante.com', '$2b$12$HASH_MESERO_DEMO', 'MESERO', 'ACTIVO'),
('55555555-5555-4555-8555-555555555560','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','Pedro León', 'caja@mirestaurante.com', '$2b$12$HASH_CAJERO_DEMO', 'CAJERO', 'ACTIVO')
ON CONFLICT (id) DO NOTHING;

-- Lead landing -----------------------------------------------------------------
INSERT INTO leads_cotizaciones (id, nombre, apellido, telefono, email, negocio, rango_sucursales, estado, notas)
VALUES ('80000000-0000-4000-8000-000000000001','Carlos','Mendoza','+51 999 111 222','carlos@elmuelle.pe','Cevichería El Muelle','2-3','PROPUESTA','Solicita cotización: 2 locales, módulos pedidos + caja + inventario')
ON CONFLICT (id) DO NOTHING;

-- Catálogo (erp-catalog.ts) ----------------------------------------------------
INSERT INTO categorias (id, empresa_id, nombre, posicion, activa) VALUES
('66666666-6666-4666-8666-666666666661','11111111-1111-1111-1111-111111111111','Entradas',1,true),
('66666666-6666-4666-8666-666666666662','11111111-1111-1111-1111-111111111111','Fondos',2,true),
('66666666-6666-4666-8666-666666666663','11111111-1111-1111-1111-111111111111','Bebidas',3,true),
('66666666-6666-4666-8666-666666666664','11111111-1111-1111-1111-111111111111','Postres',4,true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO grupos_modificadores (id, empresa_id, nombre, obligatorio, permite_multiple, activo) VALUES
('77777777-7777-4777-8777-777777777771','11111111-1111-1111-1111-111111111111','Tamaño',true,false,true),
('77777777-7777-4777-8777-777777777772','11111111-1111-1111-1111-111111111111','Extras',false,true,true),
('77777777-7777-4777-8777-777777777773','11111111-1111-1111-1111-111111111111','Punto de cocción',true,false,true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO opciones_modificadores (id, grupo_id, nombre, precio_extra) VALUES
('77777777-7777-4777-8777-777777777781','77777777-7777-4777-8777-777777777771','Regular',0),
('77777777-7777-4777-8777-777777777782','77777777-7777-4777-8777-777777777771','Grande',4),
('77777777-7777-4777-8777-777777777783','77777777-7777-4777-8777-777777777772','Queso extra',2),
('77777777-7777-4777-8777-777777777784','77777777-7777-4777-8777-777777777772','Palta',3),
('77777777-7777-4777-8777-777777777785','77777777-7777-4777-8777-777777777773','Al punto',0),
('77777777-7777-4777-8777-777777777786','77777777-7777-4777-8777-777777777773','Bien cocido',0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO platos (id, empresa_id, categoria_id, sku, nombre, descripcion, foto_url, activo, costo_real) VALUES
('88888888-8888-8888-8888-888888888881','11111111-1111-1111-1111-111111111111','66666666-6666-4666-8666-666666666661','PLA-001','Ceviche Clásico','Pesca del día, limón sutil, ají limo, cebolla roja.','https://images.unsplash.com/photo-1534482421-64566f976cfa',true,8.50),
('88888888-8888-8888-8888-888888888882','11111111-1111-1111-1111-111111111111','66666666-6666-4666-8666-666666666661','PLA-002','Tequeños de Lomo','Masa crujiente rellena de lomo saltado, huancaína.',NULL,true,4.00),
('88888888-8888-8888-8888-888888888883','11111111-1111-1111-1111-111111111111','66666666-6666-4666-8666-666666666662','PLA-003','Lomo Saltado','Lomo fino al wok, cebolla, tomate, ají amarillo, papas y arroz.',NULL,true,12.00),
('88888888-8888-8888-8888-888888888884','11111111-1111-1111-1111-111111111111','66666666-6666-4666-8666-666666666662','PLA-004','Ají de Gallina','Guiso cremoso de pollo, ají amarillo, pecanas y parmesano.',NULL,true,9.00),
('88888888-8888-8888-8888-888888888885','11111111-1111-1111-1111-111111111111','66666666-6666-4666-8666-666666666663','PLA-005','Pisco Sour','Pisco Quebranta, limón, jarabe de goma y Angostura.',NULL,true,4.50),
('88888888-8888-8888-8888-888888888886','11111111-1111-1111-1111-111111111111','66666666-6666-4666-8666-666666666663','PLA-006','Chicha Morada','Maíz morado, piña, manzana, canela y clavo.',NULL,true,1.20)
ON CONFLICT (id) DO NOTHING;

INSERT INTO platos_grupos_modificadores (plato_id, grupo_id) VALUES
('88888888-8888-8888-8888-888888888881','77777777-7777-4777-8777-777777777772'),
('88888888-8888-8888-8888-888888888882','77777777-7777-4777-8777-777777777772'),
('88888888-8888-8888-8888-888888888883','77777777-7777-4777-8777-777777777771'),
('88888888-8888-8888-8888-888888888883','77777777-7777-4777-8777-777777777773'),
('88888888-8888-8888-8888-888888888884','77777777-7777-4777-8777-777777777771'),
('88888888-8888-8888-8888-888888888886','77777777-7777-4777-8777-777777777771')
ON CONFLICT DO NOTHING;

INSERT INTO listas_precios (id, empresa_id, nombre, activa, vigencia_desde, vigencia_hasta) VALUES
('99999999-9999-4999-8999-999999999991','11111111-1111-1111-1111-111111111111','Carta',true,'2026-01-01','2026-12-31'),
('99999999-9999-4999-8999-999999999992','11111111-1111-1111-1111-111111111111','Delivery',false,'2026-01-01','2026-12-31'),
('99999999-9999-4999-8999-999999999993','11111111-1111-1111-1111-111111111111','Eventos',false,'2026-11-01','2026-12-31')
ON CONFLICT (id) DO NOTHING;

INSERT INTO precios_platos (lista_id, plato_id, precio) VALUES
-- Carta base
('99999999-9999-4999-8999-999999999991','88888888-8888-8888-8888-888888888881',15.00),
('99999999-9999-4999-8999-999999999991','88888888-8888-8888-8888-888888888882',8.00),
('99999999-9999-4999-8999-999999999991','88888888-8888-8888-8888-888888888883',22.00),
('99999999-9999-4999-8999-999999999991','88888888-8888-8888-8888-888888888884',18.00),
('99999999-9999-4999-8999-999999999991','88888888-8888-8888-8888-888888888885',10.00),
('99999999-9999-4999-8999-999999999991','88888888-8888-8888-8888-888888888886',4.00),
-- Delivery +2
('99999999-9999-4999-8999-999999999992','88888888-8888-8888-8888-888888888881',17.00),
('99999999-9999-4999-8999-999999999992','88888888-8888-8888-8888-888888888882',10.00),
('99999999-9999-4999-8999-999999999992','88888888-8888-8888-8888-888888888883',24.00),
('99999999-9999-4999-8999-999999999992','88888888-8888-8888-8888-888888888884',20.00),
('99999999-9999-4999-8999-999999999992','88888888-8888-8888-8888-888888888885',12.00),
('99999999-9999-4999-8999-999999999992','88888888-8888-8888-8888-888888888886',6.00),
-- Eventos -1
('99999999-9999-4999-8999-999999999993','88888888-8888-8888-8888-888888888881',14.00),
('99999999-9999-4999-8999-999999999993','88888888-8888-8888-8888-888888888882',7.00),
('99999999-9999-4999-8999-999999999993','88888888-8888-8888-8888-888888888883',21.00),
('99999999-9999-4999-8999-999999999993','88888888-8888-8888-8888-888888888884',17.00),
('99999999-9999-4999-8999-999999999993','88888888-8888-8888-8888-888888888885',9.00),
('99999999-9999-4999-8999-999999999993','88888888-8888-8888-8888-888888888886',3.00)
ON CONFLICT DO NOTHING;

INSERT INTO combos (id, empresa_id, nombre, descripcion, precio_fijo, activo) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-1111-1111-111111111111','Dúo Criollo','Ceviche + Chicha para dos.',17.00,true),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','11111111-1111-1111-1111-111111111111','Almuerzo Ejecutivo','Fondo + bebida del día.',24.00,true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO combos_platos (combo_id, plato_id, cantidad) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','88888888-8888-8888-8888-888888888881',1),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','88888888-8888-8888-8888-888888888886',1),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','88888888-8888-8888-8888-888888888883',1),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','88888888-8888-8888-8888-888888888886',1)
ON CONFLICT DO NOTHING;

INSERT INTO reglas_horarias_promos (id, empresa_id, nombre, beneficio, dias_semana, hora_inicio, hora_fin, activa) VALUES
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','11111111-1111-1111-1111-111111111111','Happy Hour Pisco','2x1 en barra',ARRAY[1,2,3,4,5],'18:00','20:00',true),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','11111111-1111-1111-1111-111111111111','Almuerzo Ejecutivo','$5.00 off',ARRAY[1,2,3,4,5],'12:00','15:00',true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO cupones (id, empresa_id, codigo, tipo_descuento, valor, limite_usos, usos_actuales, vencimiento, activo) VALUES
('cccccccc-cccc-4ccc-8ccc-cccccccccc01','11111111-1111-1111-1111-111111111111','BURGER10','PORCENTAJE',10.00,100,45,'2026-11-30',true),
('cccccccc-cccc-4ccc-8ccc-cccccccccc02','11111111-1111-1111-1111-111111111111','PISCO5','MONTO',5.00,50,12,'2026-12-15',true),
('cccccccc-cccc-4ccc-8ccc-cccccccccc03','11111111-1111-1111-1111-111111111111','FIEL20','PORCENTAJE',20.00,80,78,'2026-10-31',true)
ON CONFLICT (id) DO NOTHING;

-- Proveedores + insumos (erp.ts: initialIngredients + initialMovements) --------
INSERT INTO proveedores (id, empresa_id, nombre, ruc, telefono, rubro) VALUES
('dddddddd-dddd-4ddd-8ddd-dddddddddd01','11111111-1111-1111-1111-111111111111','AgroAndina','20111222333','+51 955 000 111','Insumos'),
('dddddddd-dddd-4ddd-8ddd-dddddddddd02','11111111-1111-1111-1111-111111111111','Frutas Lima','20144555666','+51 955 000 222','Frutas')
ON CONFLICT (id) DO NOTHING;

INSERT INTO insumos (id, empresa_id, proveedor_id, nombre, categoria, unidad, costo_promedio) VALUES
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','11111111-1111-1111-1111-111111111111','dddddddd-dddd-4ddd-8ddd-dddddddddd01','Lomo fino','Carnes','kg',28.50),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2','11111111-1111-1111-1111-111111111111','dddddddd-dddd-4ddd-8ddd-dddddddddd01','Ají amarillo','Vegetales','kg',6.00),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3','11111111-1111-1111-1111-111111111111',NULL,'Pisco Quebranta','Bar','litros',45.00),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4','11111111-1111-1111-1111-111111111111','dddddddd-dddd-4ddd-8ddd-dddddddddd01','Papa amarilla','Vegetales','kg',3.20),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5','11111111-1111-1111-1111-111111111111','dddddddd-dddd-4ddd-8ddd-dddddddddd02','Limón sutil','Frutas','kg',4.80),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee6','11111111-1111-1111-1111-111111111111','dddddddd-dddd-4ddd-8ddd-dddddddddd02','Maíz morado','Granos','kg',5.50)
ON CONFLICT (id) DO NOTHING;

INSERT INTO stocks_sucursal (sucursal_id, insumo_id, empresa_id, cantidad, stock_minimo) VALUES
('22222222-2222-4222-8222-222222222222','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','11111111-1111-1111-1111-111111111111',12.00,5.00),
('22222222-2222-4222-8222-222222222222','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2','11111111-1111-1111-1111-111111111111',1.50,3.00),
('22222222-2222-4222-8222-222222222222','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3','11111111-1111-1111-1111-111111111111',0.00,2.00),
('22222222-2222-4222-8222-222222222222','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4','11111111-1111-1111-1111-111111111111',20.00,8.00),
('22222222-2222-4222-8222-222222222222','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5','11111111-1111-1111-1111-111111111111',2.00,4.00),
('22222222-2222-4222-8222-222222222222','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee6','11111111-1111-1111-1111-111111111111',6.00,2.00)
ON CONFLICT DO NOTHING;

INSERT INTO escandallos_recetas (plato_id, insumo_id, cantidad_por_plato, unidad) VALUES
('88888888-8888-8888-8888-888888888883','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',0.500,'kg'),
('88888888-8888-8888-8888-888888888883','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4',0.400,'kg'),
('88888888-8888-8888-8888-888888888883','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',0.050,'kg'),
('88888888-8888-8888-8888-888888888881','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5',0.200,'kg'),
('88888888-8888-8888-8888-888888888886','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee6',0.150,'kg'),
('88888888-8888-8888-8888-888888888885','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3',0.150,'litros')
ON CONFLICT DO NOTHING;

-- CRM (erp.ts: initialCustomers) + config --------------------------------------
INSERT INTO config_lealtad (empresa_id, puntos_por_moneda, caducidad_meses, umbral_frecuente, umbral_vip)
VALUES ('11111111-1111-1111-1111-111111111111',1.00,12,5,20)
ON CONFLICT (empresa_id) DO NOTHING;

INSERT INTO clientes (id, empresa_id, nombre, telefono, segmento, visitas, puntos, ultima_visita) VALUES
('ffffffff-ffff-4fff-8fff-fffffffffff1','11111111-1111-1111-1111-111111111111','Valeria Ríos','+51 987 112 203','VIP',32,1240,CURRENT_DATE),
('ffffffff-ffff-4fff-8fff-fffffffffff2','11111111-1111-1111-1111-111111111111','Diego Torres','+51 955 804 117','FRECUENTE',21,860,CURRENT_DATE - 1),
('ffffffff-ffff-4fff-8fff-fffffffffff3','11111111-1111-1111-1111-111111111111','Camila Duarte','+51 901 445 882','FRECUENTE',9,410,CURRENT_DATE - 3),
('ffffffff-ffff-4fff-8fff-fffffffffff4','11111111-1111-1111-1111-111111111111','Jorge Paredes','+51 988 230 541','NUEVO',2,120,CURRENT_DATE - 7),
('ffffffff-ffff-4fff-8fff-fffffffffff5','11111111-1111-1111-1111-111111111111','Lucía Prado','+51 976 551 309','VIP',48,2310,CURRENT_DATE)
ON CONFLICT (id) DO NOTHING;

-- RRHH (erp.ts: roles + empleados) ----------------------------------------------
INSERT INTO roles_empresa (id, empresa_id, nombre, descripcion, activo) VALUES
('10101010-1010-4010-8010-101010101010','11111111-1111-1111-1111-111111111111','Mozo','Atención en mesa, comandas y servicio.',true),
('20202020-2020-4020-8020-202020202020','11111111-1111-1111-1111-111111111111','Cocinero','Preparación de platos y KDS.',true),
('30303030-3030-4030-8030-303030303030','11111111-1111-1111-1111-111111111111','Barman','Bebidas, coctelería y barra.',true),
('40404040-4040-4040-8040-404040404040','11111111-1111-1111-1111-111111111111','Cajero','Cobros, caja y cierre de turno.',true),
('50505050-5050-4050-8050-505050505050','11111111-1111-1111-1111-111111111111','Anfitrión','Reservas y mapa de mesas.',true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO empleados (id, empresa_id, sucursal_id, usuario_id, nombre, rol_id, en_turno, fecha_ingreso, activo) VALUES
('11111111-2222-4333-8444-555555555551','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','55555555-5555-4555-8555-555555555557','Rosa Quispe','10101010-1010-4010-8010-101010101010',true,'2024-03-01',true),
('11111111-2222-4333-8444-555555555552','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','55555555-5555-4555-8555-555555555558','Luis Huamán','20202020-2020-4020-8020-202020202020',true,'2023-06-15',true),
('11111111-2222-4333-8444-555555555553','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','55555555-5555-4555-8555-555555555559','Ana Beltrán','30303030-3030-4030-8030-303030303030',true,'2024-01-10',true),
('11111111-2222-4333-8444-555555555554','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','55555555-5555-4555-8555-555555555560','Pedro León','40404040-4040-4040-8040-404040404040',false,'2023-11-20',true),
('11111111-2222-4333-8444-555555555555','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222',NULL,'María Flores','10101010-1010-4010-8010-101010101010',false,'2025-02-01',true),
('11111111-2222-4333-8444-555555555556','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222',NULL,'Carlos Vega','20202020-2020-4020-8020-202020202020',true,'2024-08-05',true)
ON CONFLICT (id) DO NOTHING;

-- Mesas + reservas (erp.ts) ------------------------------------------------------
INSERT INTO mesas (id, empresa_id, sucursal_id, numero, capacidad, zona, forma, estado) VALUES
('20000000-0000-4000-8000-000000000001','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','Mesa 1',2,'Terraza','REDONDA','LIBRE'),
('20000000-0000-4000-8000-000000000002','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','Mesa 2',2,'Terraza','REDONDA','OCUPADA'),
('20000000-0000-4000-8000-000000000003','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','Mesa 3',4,'Salón','RECTANGULAR','RESERVADA'),
('20000000-0000-4000-8000-000000000004','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','Mesa 4',4,'Salón','RECTANGULAR','LIBRE'),
('20000000-0000-4000-8000-000000000005','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','Mesa 5',6,'Salón','RECTANGULAR','OCUPADA'),
('20000000-0000-4000-8000-000000000006','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','Mesa 6',2,'Barra','REDONDA','LIBRE'),
('20000000-0000-4000-8000-000000000007','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','Mesa 7',4,'Barra','RECTANGULAR','OCUPADA'),
('20000000-0000-4000-8000-000000000008','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','Mesa 8',8,'Salón','RECTANGULAR','RESERVADA')
ON CONFLICT (id) DO NOTHING;

INSERT INTO reservas (id, empresa_id, sucursal_id, mesa_id, codigo, cliente_nombre, telefono, nro_comensales, fecha_hora, estado, canal, notas, creada_por) VALUES
('30000000-0000-4000-8000-000000000201','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','20000000-0000-4000-8000-000000000003','RS-201','Camila Duarte','+51 987 442 019',4, CURRENT_DATE + TIME '20:00','CONFIRMADA','Teléfono','Mesa cerca a la ventana, una silla de bebé.','55555555-5555-4555-8555-555555555557'),
('30000000-0000-4000-8000-000000000202','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','20000000-0000-4000-8000-000000000008','RS-202','Jorge Paredes','+51 955 128 774',8, CURRENT_DATE + TIME '21:30','POR_CONFIRMAR','Web','Cumpleaños, llevarán torta.','55555555-5555-4555-8555-555555555557')
ON CONFLICT (id) DO NOTHING;

-- Órdenes KDS (erp.ts: #PD-1042 cocina/pendiente/listo/entregado) ----------------
INSERT INTO ordenes (id, empresa_id, sucursal_id, numero_orden, mesa_id, cliente_id, mesero_id, origen, estado, subtotal, descuento_cupon, total, lista_precio_id, ingreso_at) VALUES
('40000000-0000-4000-8000-000000001042','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222', '#PD-1042', NULL,'ffffffff-ffff-4fff-8fff-fffffffffff1','55555555-5555-4555-8555-555555555559','WEB','POR_CONFIRMAR',52.00,0,52.00,'99999999-9999-4999-8999-999999999991', now() - INTERVAL '6 minutes'),
('40000000-0000-4000-8000-000000001041','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222', '#PD-1041','20000000-0000-4000-8000-000000000007',NULL,'55555555-5555-4555-8555-555555555559','MESA','EN_COCINA',35.00,0,35.00,'99999999-9999-4999-8999-999999999991', now() - INTERVAL '13 minutes'),
('40000000-0000-4000-8000-000000001040','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222', '#PD-1040', NULL,'ffffffff-ffff-4fff-8fff-fffffffffff2','55555555-5555-4555-8555-555555555559','WEB','LISTO',18.00,0,18.00,'99999999-9999-4999-8999-999999999991', now() - INTERVAL '20 minutes'),
('40000000-0000-4000-8000-000000001039','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222', '#PD-1039','20000000-0000-4000-8000-000000000003',NULL,'55555555-5555-4555-8555-555555555559','MESA','ENTREGADO',20.00,0,20.00,'99999999-9999-4999-8999-999999999991', now() - INTERVAL '33 minutes')
ON CONFLICT (id) DO NOTHING;

INSERT INTO detalles_orden (orden_id, tipo, plato_id, cantidad, precio_unitario, subtotal) VALUES
('40000000-0000-4000-8000-000000001042','PLATO','88888888-8888-8888-8888-888888888883',2,22.00,44.00),
('40000000-0000-4000-8000-000000001042','PLATO','88888888-8888-8888-8888-888888888886',2,4.00,8.00),
('40000000-0000-4000-8000-000000001041','PLATO','88888888-8888-8888-8888-888888888881',1,15.00,15.00),
('40000000-0000-4000-8000-000000001041','PLATO','88888888-8888-8888-8888-888888888885',2,10.00,20.00),
('40000000-0000-4000-8000-000000001040','PLATO','88888888-8888-8888-8888-888888888884',1,18.00,18.00),
('40000000-0000-4000-8000-000000001039','PLATO','88888888-8888-8888-8888-888888888882',2,8.00,16.00),
('40000000-0000-4000-8000-000000001039','PLATO','88888888-8888-8888-8888-888888888886',1,4.00,4.00)
ON CONFLICT DO NOTHING;

-- Kardex (erp.ts: initialMovements) ----------------------------------------------
INSERT INTO movimientos_inventario (empresa_id, sucursal_id, insumo_id, tipo, cantidad, stock_resultante, motivo, orden_id, actor_id) VALUES
('11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','SALIDA',-1.500,10.500,'Venta · comandas #PD-1042','40000000-0000-4000-8000-000000001042','55555555-5555-4555-8555-555555555558'),
('11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4','ENTRADA',20.000,20.000,'Recepción OC-031 · AgroAndina',NULL,'55555555-5555-4555-8555-555555555557'),
('11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2','MERMA',-0.500,1.500,'Merma de cocina',NULL,'55555555-5555-4555-8555-555555555558'),
('11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3','SALIDA',-2.000,0.000,'Venta · barra',NULL,'55555555-5555-4555-8555-555555555559'),
('11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5','ENTRADA',5.000,2.000,'Recepción OC-030 · Frutas Lima',NULL,'55555555-5555-4555-8555-555555555557')
ON CONFLICT DO NOTHING;

-- Caja + comprobantes + gastos ----------------------------------------------------
INSERT INTO turnos_caja (id, empresa_id, sucursal_id, cajero_id, apertura_at, fondo_apertura, ingresos_total, egresos_total, saldo, estado) VALUES
('50000000-0000-4000-8000-000000000001','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','55555555-5555-4555-8555-555555555560', CURRENT_DATE + TIME '09:00',200.00,287.00,12.00,475.00,'ABIERTO')
ON CONFLICT (id) DO NOTHING;

INSERT INTO movimientos_caja (empresa_id, turno_id, tipo, concepto, monto, metodo, orden_id, actor_id) VALUES
('11111111-1111-1111-1111-111111111111','50000000-0000-4000-8000-000000000001','INGRESO','Fondo de apertura',200.00,'EFECTIVO',NULL,'55555555-5555-4555-8555-555555555560'),
('11111111-1111-1111-1111-111111111111','50000000-0000-4000-8000-000000000001','INGRESO','Venta web #PD-1042',52.00,'TARJETA','40000000-0000-4000-8000-000000001042','55555555-5555-4555-8555-555555555560'),
('11111111-1111-1111-1111-111111111111','50000000-0000-4000-8000-000000000001','INGRESO','Venta mesa 7',35.00,'YAPE','40000000-0000-4000-8000-000000001041','55555555-5555-4555-8555-555555555560'),
('11111111-1111-1111-1111-111111111111','50000000-0000-4000-8000-000000000001','EGRESO','Compra hielo',12.00,'EFECTIVO',NULL,'55555555-5555-4555-8555-555555555560')
ON CONFLICT DO NOTHING;

INSERT INTO gastos (id, empresa_id, sucursal_id, concepto, monto, categoria, estado_pago, pagado_en_caja, turno_id, proveedor_id, registrado_por) VALUES
('70000000-0000-4000-8000-000000000001','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','Compra insumos AgroAndina',120.00,'INSUMOS','PAGADO',true,'50000000-0000-4000-8000-000000000001','dddddddd-dddd-4ddd-8ddd-dddddddddd01','55555555-5555-4555-8555-555555555557'),
('70000000-0000-4000-8000-000000000002','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','Recibo Luz del Sur',85.50,'SERVICIOS','PENDIENTE',false,NULL,NULL,'55555555-5555-4555-8555-555555555557'),
('70000000-0000-4000-8000-000000000003','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','Planilla semanal personal',950.00,'PERSONAL','PENDIENTE',false,NULL,NULL,'55555555-5555-4555-8555-555555555557')
ON CONFLICT (id) DO NOTHING;

INSERT INTO comprobantes (id, empresa_id, sucursal_id, tipo, serie_numero, orden_id, cliente_ref, total, estado, emitido_por) VALUES
('60000000-0000-4000-8000-000000001042','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','BOLETA','B001-1042','40000000-0000-4000-8000-000000001042','Valeria Ríos',52.00,'PAGADA','55555555-5555-4555-8555-555555555560'),
('60000000-0000-4000-8000-000000001041','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','BOLETA','B001-1041','40000000-0000-4000-8000-000000001041','Mesa 7',35.00,'PAGADA','55555555-5555-4555-8555-555555555560'),
('60000000-0000-4000-8000-000000001040','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','BOLETA','B001-1040','40000000-0000-4000-8000-000000001040','Diego Torres',18.00,'ANULADA','55555555-5555-4555-8555-555555555560')
ON CONFLICT (id) DO NOTHING;

-- Puntos + turnos + propinas -------------------------------------------------------
INSERT INTO movimientos_puntos (cliente_id, empresa_id, sucursal_id, tipo, puntos, orden_id, motivo) VALUES
('ffffffff-ffff-4fff-8fff-fffffffffff1','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','GANANCIA',52,'40000000-0000-4000-8000-000000001042','Pago exitoso #PD-1042: 1pto x $1'),
('ffffffff-ffff-4fff-8fff-fffffffffff2','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','GANANCIA',18,'40000000-0000-4000-8000-000000001040','Pago exitoso #PD-1040')
ON CONFLICT DO NOTHING;

INSERT INTO turnos_plan (empresa_id, sucursal_id, empleado_id, fecha, bloque) VALUES
('11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','11111111-2222-4333-8444-555555555551',CURRENT_DATE,'MANANA'),
('11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','11111111-2222-4333-8444-555555555552',CURRENT_DATE,'TARDE'),
('11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','11111111-2222-4333-8444-555555555553',CURRENT_DATE,'TARDE')
ON CONFLICT DO NOTHING;

INSERT INTO asistencias (empresa_id, sucursal_id, empleado_id, fecha, hora_entrada, estado, fuente) VALUES
('11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','11111111-2222-4333-8444-555555555551',CURRENT_DATE, CURRENT_DATE + TIME '08:00','PRESENTE','PIN'),
('11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','11111111-2222-4333-8444-555555555552',CURRENT_DATE, CURRENT_DATE + TIME '08:07','TARDANZA','PIN'),
('11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222','11111111-2222-4333-8444-555555555553',CURRENT_DATE, CURRENT_DATE + TIME '07:58','PRESENTE','PIN')
ON CONFLICT DO NOTHING;

INSERT INTO pozos_propinas (id, empresa_id, sucursal_id, fecha, total, nro_beneficiarios, estado) VALUES
('90000000-0000-4000-8000-000000000001','11111111-1111-1111-1111-111111111111','22222222-2222-4222-8222-222222222222',CURRENT_DATE,86.50,3,'CALCULADO')
ON CONFLICT (id) DO NOTHING;

INSERT INTO repartos_propinas (pozo_id, empleado_id, monto, presente) VALUES
('90000000-0000-4000-8000-000000000001','11111111-2222-4333-8444-555555555551',28.83,true),
('90000000-0000-4000-8000-000000000001','11111111-2222-4333-8444-555555555552',28.83,true),
('90000000-0000-4000-8000-000000000001','11111111-2222-4333-8444-555555555553',28.84,true)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 9. Vistas BI (solo lectura: analíticas, ocupación, stock, top platos)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_ventas_dia AS
SELECT o.empresa_id, o.sucursal_id, (o.ingreso_at AT TIME ZONE 'UTC')::date AS fecha,
  COUNT(*) AS n_ordenes, SUM(o.total) AS ventas, AVG(o.total) AS ticket_promedio
FROM ordenes o WHERE o.estado <> 'ANULADA' GROUP BY 1,2,3;

CREATE OR REPLACE VIEW v_platos_top AS
SELECT d.plato_id, p.sku, p.nombre, SUM(d.cantidad) AS cantidad_vendida, SUM(d.subtotal) AS ingresos
FROM detalles_orden d JOIN platos p ON p.id = d.plato_id
GROUP BY 1,2,3 ORDER BY cantidad_vendida DESC;

CREATE OR REPLACE VIEW v_ocupacion_mesas AS
SELECT sucursal_id,
  COUNT(*) AS total_mesas,
  COUNT(*) FILTER (WHERE estado='OCUPADA') AS ocupadas,
  COUNT(*) FILTER (WHERE estado='LIBRE') AS libres,
  COUNT(*) FILTER (WHERE estado='RESERVADA') AS reservadas,
  ROUND(100.0 * COUNT(*) FILTER (WHERE estado='OCUPADA') / NULLIF(COUNT(*),0),1) AS pct_ocupacion
FROM mesas GROUP BY 1;

CREATE OR REPLACE VIEW v_stock_bajo AS
SELECT s.sucursal_id, s.insumo_id, i.nombre, i.unidad, s.cantidad, s.stock_minimo,
  CASE WHEN s.cantidad <= 0 THEN 'AGOTADO' WHEN s.cantidad <= s.stock_minimo THEN 'BAJO' ELSE 'OPTIMO' END AS estado
FROM stocks_sucursal s JOIN insumos i ON i.id = s.insumo_id;

COMMIT;

-- Fin. Orden de creación: extensiones > tipos > función > empresas > sucursales >
-- leads/usuarios/suscripciones > catálogo (categorías/grupos/opciones/platos/N:M/listas/precios/combos/N:M/reglas/cupones/proveedores/insumos) >
-- CRM/RRHH base > mesas > reservas > órdenes > detalles > stocks/escandallos/kardex >
-- turnos_caja > gastos > movimientos_caja > comprobantes > canjes/puntos > turnos/asistencias/propinas > auditoría > triggers > vistas > seeds.
