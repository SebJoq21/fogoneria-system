-- AYCDS-13 — Alertas de stock (semáforo + webhook a n8n).
--
-- Una fila por insumo y sucursal con la alerta vigente. Sirve para dos cosas:
--  1. No repetir el webhook cada 10 minutos mientras el stock siga bajo.
--  2. Dar a la UI de inventario (AYCDS-24) la lista de alertas activas.
--
-- Cuando el insumo se repone, la fila se borra: la alerta deja de existir y, si
-- vuelve a caer, se notifica de nuevo (es un cambio de estado, no un cron ciego).

CREATE TABLE alertas_stock (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL,
  sucursal_id   uuid NOT NULL,
  insumo_id     uuid NOT NULL,
  estado        text NOT NULL,
  cantidad      numeric(12, 3) NOT NULL,
  stock_minimo  numeric(12, 3) NOT NULL,
  notificado_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_alertas_estado CHECK (estado IN ('AGOTADO', 'BAJO')),
  CONSTRAINT uq_alertas_stock UNIQUE (sucursal_id, insumo_id),
  CONSTRAINT fk_alertas_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE,
  CONSTRAINT fk_alertas_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales (id) ON DELETE CASCADE,
  CONSTRAINT fk_alertas_insumo FOREIGN KEY (insumo_id) REFERENCES insumos (id) ON DELETE CASCADE
);

CREATE INDEX idx_alertas_tenant ON alertas_stock (empresa_id, sucursal_id, estado);

COMMENT ON TABLE alertas_stock IS 'AYCDS-13: alerta vigente por insumo y sucursal; se borra al reponer el stock.';
COMMENT ON COLUMN alertas_stock.notificado_at IS 'Ultima vez que el webhook acepto la alerta; null = pendiente de enviar.';

ALTER TABLE alertas_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_alertas_stock ON alertas_stock
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
  );
