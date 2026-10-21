# Evidencia `EXPLAIN` con RLS — AYCDS-62

**Fecha:** 2026-10-20

**Base:** PostgreSQL 16, `fogoneria_db`, rol `fogoneria_rls` (sin BYPASSRLS)

**Contexto:** `app.empresa_id = 11111111-1111-4111-8111-111111111111`, `app.bypass = false`

## Órdenes

```text
Limit  (actual time=0.216..0.222 rows=4)
  ->  Index Scan using idx_ordenes_tenant_fecha on ordenes
        Index Cond: (empresa_id = '1111...'::uuid)
        Filter: bypass OR (empresa_id = app.empresa_id AND sucursal ...)
        Buffers: shared hit=2
Planning Time: 5.558 ms
Execution Time: 0.292 ms
```

## Turnos de caja

```text
Limit  (actual time=8.272..8.274 rows=1)
  ->  Sort  (Sort Key: apertura_at DESC)
        ->  Bitmap Heap Scan on turnos_caja
              Recheck Cond: (empresa_id = '1111...'::uuid)
              ->  Bitmap Index Scan on idx_turnos_tenant_fecha
Planning Time: 13.928 ms
Execution Time: 8.384 ms
```

## Movimientos de inventario (kardex)

```text
Limit  (actual time=1.708..1.711 rows=5)
  ->  Sort  (Sort Key: created_at DESC)
        ->  Bitmap Heap Scan on movimientos_inventario
              Recheck Cond: (empresa_id = '1111...'::uuid)
              ->  Bitmap Index Scan on idx_movinv_tenant_insumo_fecha
Planning Time: 24.809 ms
Execution Time: 1.912 ms
```

## Conclusión

Las tres consultas usan índices compuestos con `empresa_id` como primera columna. El predicado de la política RLS se evalúa como filtro adicional, sin recorrer la tabla completa. Los tiempos son de milisegundos sobre el dataset demo.
