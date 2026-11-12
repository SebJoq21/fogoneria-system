-- Limpieza de datos de demo (2026-11-11).
--
-- Deja la base lista para una demo "en vivo": conserva **cuentas y
-- configuración** (empresa, sucursales, roles, usuarios), el **catálogo**
-- (categorías, platos, modificadores, listas y precios) y las **mesas**.
-- Borra todo lo operativo y los datos de ejemplo: comandas, caja, comprobantes,
-- gastos, clientes, reservas, inventario (movimientos y stocks), RRHH,
-- promociones, leads y auditoría.
--
-- Los triggers de inmutabilidad prohíben DELETE, así que se corre con
-- `session_replication_role = replica`. OJO: en ese modo **tampoco corren los
-- CASCADE** (las FK son triggers), por eso las hijas se borran explícitamente y
-- en orden.
--
-- Uso:
--   pnpm --filter api db:demo:clean

BEGIN;

SET LOCAL session_replication_role = replica;

-- 1. Comandas y sus líneas -----------------------------------------------
DELETE FROM fogoneria.detalles_orden_modificadores;
DELETE FROM fogoneria.detalles_orden;
DELETE FROM fogoneria.comprobantes;

-- 2. Caja ----------------------------------------------------------------
DELETE FROM fogoneria.movimientos_caja;

-- 3. CRM y puntos (antes de órdenes y clientes) --------------------------
DELETE FROM fogoneria.canjes_cupones;
DELETE FROM fogoneria.movimientos_puntos;

-- 4. Inventario: kardex y stock (los insumos y recetas se conservan) -----
DELETE FROM fogoneria.movimientos_inventario;
DELETE FROM fogoneria.alertas_stock;
DELETE FROM fogoneria.stocks_sucursal;

-- 5. Comandas (ya sin hijas) y clientes ----------------------------------
DELETE FROM fogoneria.ordenes;
DELETE FROM fogoneria.clientes;

-- 6. Gastos y proveedores ------------------------------------------------
DELETE FROM fogoneria.gastos;
DELETE FROM fogoneria.proveedores;

-- 7. Promociones ---------------------------------------------------------
DELETE FROM fogoneria.combos_platos;
DELETE FROM fogoneria.reglas_horarias_promos;
DELETE FROM fogoneria.cupones;
DELETE FROM fogoneria.combos;

-- 8. Reservas ------------------------------------------------------------
DELETE FROM fogoneria.reservas;

-- 9. RRHH y propinas -----------------------------------------------------
DELETE FROM fogoneria.repartos_propinas;
DELETE FROM fogoneria.pozos_propinas;
DELETE FROM fogoneria.asistencias;
DELETE FROM fogoneria.turnos_plan;

-- 10. Turnos de caja (después de sus movimientos y gastos) ---------------
DELETE FROM fogoneria.turnos_caja;

-- 11. Rastro de la demo --------------------------------------------------
DELETE FROM fogoneria.auditoria;
DELETE FROM fogoneria.leads_cotizaciones;
DELETE FROM fogoneria.suscripciones_eventos;

-- 12. Folios: la primera comanda/reserva debe nacer en 0001 --------------
DELETE FROM fogoneria.secuencias;

COMMIT;

-- Verificación rápida (se imprime al ejecutar el script).
SELECT 'empresas' AS tabla, count(*) FROM fogoneria.empresas
UNION ALL SELECT 'sucursales', count(*) FROM fogoneria.sucursales
UNION ALL SELECT 'usuarios', count(*) FROM fogoneria.usuarios
UNION ALL SELECT 'platos', count(*) FROM fogoneria.platos
UNION ALL SELECT 'mesas', count(*) FROM fogoneria.mesas
UNION ALL SELECT 'listas_precios', count(*) FROM fogoneria.listas_precios
UNION ALL SELECT 'insumos', count(*) FROM fogoneria.insumos
UNION ALL SELECT 'ordenes', count(*) FROM fogoneria.ordenes
UNION ALL SELECT 'comprobantes', count(*) FROM fogoneria.comprobantes
UNION ALL SELECT 'movimientos_caja', count(*) FROM fogoneria.movimientos_caja
UNION ALL SELECT 'gastos', count(*) FROM fogoneria.gastos
UNION ALL SELECT 'clientes', count(*) FROM fogoneria.clientes
UNION ALL SELECT 'reservas', count(*) FROM fogoneria.reservas
UNION ALL SELECT 'stocks', count(*) FROM fogoneria.stocks_sucursal
UNION ALL SELECT 'auditoria', count(*) FROM fogoneria.auditoria;
