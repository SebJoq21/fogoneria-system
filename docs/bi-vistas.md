# Vistas de BI — P&L, ranking y cobros (AYCDS-38)

Migración: `apps/api/prisma/migrations/20261107120000_vistas_bi/migration.sql`.

Seis vistas de solo lectura que la API de BI (AYCDS-35) consume con `$queryRaw`,
porque Prisma no modela vistas. Todas traen `empresa_id` y `sucursal_id` para
acotar el rango en la consulta.

| Vista | Grano | Qué responde |
|---|---|---|
| `v_bi_ventas_dia` | empresa, sucursal, día | Ventas cobradas, propinas y ticket promedio |
| `v_bi_gastos_dia` | empresa, sucursal, día, categoría | Gastos pagados por categoría |
| `v_bi_comprobado_dia` | empresa, sucursal, día | Importe con comprobante vigente |
| `v_bi_pl_dia` | empresa, sucursal, día | P&L: ventas, comprobado, gastos, margen, propinas |
| `v_bi_platos_top` | empresa, sucursal, día, plato | Unidades e ingresos por plato |
| `v_bi_cobros_metodo` | empresa, sucursal, día, método | Cobros por método de pago |

## Reglas de cálculo

- **Fecha = día de Lima** (`America/Lima`, UTC-05:00 fijo, sin DST). Una venta de
  las 21:00 no cae en el día siguiente. Las vistas viejas (`v_ventas_dia`, etc.)
  usan UTC y quedan como históricas; no se usan para BI.
- **Venta** = comandas `PAGADA`/`CERRADA` (todo lo cobrado). `v_bi_comprobado_dia`
  mide aparte lo que tiene comprobante `PAGADA`; la diferencia es
  `venta_sin_comprobante`, un control de conciliación, no un error.
- **Margen** = `ventas - gastos` (gastos en estado `PAGADO`). La **propina no suma**:
  es un traspaso al personal (pozo de AYCDS-33), no ingreso del negocio.
- **Cobros por método** toman `movimientos_caja` con `tipo = 'INGRESO'`, ligados a
  una orden, y **excluyen el concepto `Propina …`** para no duplicar la venta.
- **Base temporal**: las comandas no tienen `pagado_at`, así que el día se toma de
  `created_at`. Una comanda abierta a las 23:50 y cobrada a las 00:10 cuenta el día
  anterior. Añadir `pagado_at` permitiría imputar por fecha de cobro.

## Seguridad: `security_invoker` es obligatorio

Hallazgo de la implementación: **`fogoneria_app` es superusuario con `BYPASSRLS`**.
Una vista creada por él se ejecuta con sus privilegios y **no aplica RLS**, así que
una empresa veía las ventas de otra (`v_ventas_dia` incluida).

Todas las vistas se crean con `WITH (security_invoker = true)` y las cuatro
heredadas se migraron con `ALTER VIEW … SET (security_invoker = true)`. Así la vista
corre con los privilegios de quien consulta y RLS filtra igual que en la tabla.

Regla: **toda vista nueva en este esquema se crea con `security_invoker = true`.**
Lo cubre `apps/api/test/db/bi.db-spec.ts`: sin contexto de sesión devuelve 0 filas y
con el contexto de la empresa A no aparece la empresa B.

## Rendimiento

Las vistas no crean índices nuevos: `idx_ordenes_tenant_fecha`,
`idx_gastos_tenant_fecha`, `idx_comp_tenant_fecha` e `idx_comp_tenant_estado` ya
cubren el filtro por empresa/fecha. Igual que en AYCDS-22, se mide antes de añadir.

La API debe **acotar siempre** por `desde`/`hasta` (máximo 12 meses) y, cuando el
rol tiene sucursal, por `sucursal_id`. Con `FORCE ROW LEVEL SECURITY` el planificador
no ve `pg_statistic` de las tablas con RLS (deuda conocida de AYCDS-22), y una vista
sin ventana de fecha recorre la tabla completa.
