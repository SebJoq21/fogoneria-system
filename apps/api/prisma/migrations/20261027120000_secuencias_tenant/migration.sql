-- ============================================================================
-- AYCDS-16/20 — Secuencias por empresa
--
-- Folios legibles y sin colisiones (`numero_orden`, `codigo` de reserva) sin
-- depender del reloj del servidor ni de COUNT(*). El incremento es una sola
-- sentencia atómica dentro de la transacción del request:
--
--   INSERT INTO fogoneria.secuencias (empresa_id, tipo)
--   VALUES ($1, $2)
--   ON CONFLICT (empresa_id, tipo)
--   DO UPDATE SET valor = fogoneria.secuencias.valor + 1,
--                 updated_at = now()
--   RETURNING valor
--
-- Con RLS activo, la empresa sale del contexto `app.empresa_id` que la API
-- fija por transacción.
-- ============================================================================

CREATE TABLE IF NOT EXISTS fogoneria.secuencias (
  empresa_id uuid NOT NULL,
  tipo       text NOT NULL,
  valor      bigint NOT NULL DEFAULT 0,
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT pk_secuencias PRIMARY KEY (empresa_id, tipo),
  CONSTRAINT fk_secuencias_empresa FOREIGN KEY (empresa_id)
    REFERENCES fogoneria.empresas (id) ON DELETE CASCADE
);

COMMENT ON TABLE fogoneria.secuencias IS
  'AYCDS-16/20: contadores por empresa (ORD, RSV) con incremento atómico.';

ALTER TABLE fogoneria.secuencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS secuencias_tenant ON fogoneria.secuencias;
CREATE POLICY secuencias_tenant ON fogoneria.secuencias
  USING (
    empresa_id = fogoneria.current_empresa_id() OR fogoneria.is_bypass()
  )
  WITH CHECK (
    empresa_id = fogoneria.current_empresa_id() OR fogoneria.is_bypass()
  );
