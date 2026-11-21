# bi — especificación

**Estado:** API real · **Última revisión:** 2026-11-19

## 1. Propósito

Dar al dueño/gerente la foto del negocio: P&L, serie diaria, ranking de platos y cobros por método. Todo en **día de Lima** y sin exponer datos de otra empresa.

## 2. Superficies

| Capa | Dónde vive | Estado |
|---|---|---|
| Backend | `apps/api/src/modules/bi/` | real |
| Web | `apps/web/features/bi/` (`AnaliticasPage`, `hooks.ts`, `api.ts`) | real |
| Contrato | `packages/contracts/src/bi.ts` (`RangoBi`, `Pnl`, `PnlDia`, `PlatoTop`, `CobroMetodo`) | sí |
| Datos | vistas `v_bi_*` | `20261107120000_vistas_bi` |

## 3. API

| Método | Ruta | Roles | Qué hace |
|---|---|---|---|
| `GET` | `/bi/pnl` | `ADMIN_GLOBAL`, `GERENTE_SUCURSAL` | Ventas, comprobado, venta sin comprobante, gastos, margen, propinas |
| `GET` | `/bi/pnl/daily` | mismos | Serie diaria |
| `GET` | `/bi/top-dishes` | mismos | Ranking por unidades/ingresos (`limit`) |
| `GET` | `/bi/sales-by-method` | mismos | Cobros por método |

Reglas:
- Rango **obligatorio** `desde`/`hasta`, ≤366 días; la sucursal sale del token (`ADMIN_GLOBAL` puede omitirla para el agregado).
- Consulta las vistas con SQL crudo **dentro de la transacción del request**: son `security_invoker`; fuera devolverían 0 filas.
- Venta = comandas `PAGADA`/`CERRADA`; margen = ventas − gastos pagados; **la propina no es ingreso**.
- Comprobado se informa aparte (conciliación SUNAT), no es un error.

## 4. Datos

| Vista | Grano |
|---|---|
| `v_bi_ventas_dia` | empresa, sucursal, día |
| `v_bi_gastos_dia` | empresa, sucursal, día, categoría |
| `v_bi_comprobado_dia` | empresa, sucursal, día |
| `v_bi_pl_dia` | empresa, sucursal, día |
| `v_bi_platos_top` | empresa, sucursal, día, plato |
| `v_bi_cobros_metodo` | empresa, sucursal, día, método |

- Día de Lima (UTC-05:00 fijo, sin DST); las vistas viejas en UTC quedan históricas.
- La base temporal es `ordenes.created_at`: no existe `pagado_at` (deuda documentada).

## 5. UI y rutas

- `/app/analiticas` → `AnaliticasPage`: P&L, serie de 7 días, ranking y cobros por método.
- `useBi` calcula el rango de 7 días con `@fogoneria/kernel`.
- Sin sesión cae al demo del provider.

## 6. Pruebas

- Cobertura Fase 1 (2026-11-20): tests de hooks (BI, RRHH, catálogo), DTO de precios y componentes del shell con RTL/jsdom; sin cambios de comportamiento.

- Cobertura (2026-11-20): se añadieron tests de controlador, DTO, mapper y ramas de error para subir la cobertura de Sonar; sin cambios de comportamiento.

| Suite | Archivo |
|---|---|
| Unit | `src/modules/bi/bi.service.spec.ts` |
| e2e | `test/bi.e2e-spec.ts` |
| DB | `test/db/bi.db-spec.ts` (aislamiento de vistas), `bi-endpoints.db-spec.ts` |
| Web | `features/bi/bi.test.ts` |

## 7. Deuda conocida

- Metadata (2026-11-21): `features/bi/module.ts` describe la entrada de nav del registry generado; no cambia el estado.

- Añadir `pagado_at` permitiría imputar por fecha de cobro (hoy usa `created_at`).
- Bajo RLS el planificador no ve `pg_statistic`: siempre acotar por fecha (deuda de AYCDS-22).
- No hay exportación a Excel/CSV ni BI externo.

## 8. Trazabilidad

- Jira: AYCDS-38 (vistas), AYCDS-35 (API), AYCDS-45 (UI).
- PRs: #35, #36, #42.
- Docs: [bi-vistas](../../docs/bi-vistas.md), [explain-orders](../../docs/explain-orders.md).

## 9. Próximos pasos

1. `pagado_at` para imputar la venta al día de cobro.
2. Exportación CSV y filtros por rango en la UI.
