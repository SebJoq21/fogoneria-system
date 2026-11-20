# inventory — especificación

**Estado:** Mixto (kardex/semáforo reales; maestro demo) · **Última revisión:** 2026-11-19

## 1. Propósito

Descontar insumos según la receta cuando la comanda se entrega y avisar cuando el stock cae. El stock es **por sucursal**; los insumos y recetas son de empresa.

## 2. Superficies

| Capa | Dónde vive | Estado |
|---|---|---|
| Backend | `apps/api/src/modules/inventory/` (`inventory.service`, `stock-alerts.service`) | real |
| Web | `apps/web/features/inventario/` (`MovementsPage` real, `InventoryPage` demo, `InventoryHubPage`) | Mixto |
| Contrato | `packages/contracts/src/inventario.ts` | sí |
| Datos | `insumos`, `stocks_sucursal`, `movimientos_inventario`, `escandallos_recetas`, `combos_platos`, `alertas_stock` | `20261019000000_init`, `20261110120000_alertas_stock` |

## 3. API

| Método | Ruta | Roles | Qué hace |
|---|---|---|---|
| `GET` | `/inventory/stock` | autenticado | Semáforo `AGOTADO|BAJO|OPTIMO` desde `v_stock_bajo` |
| `GET` | `/inventory/movements` | autenticado | Kardex con insumo, folio y fechas (`limit` ≤500) |
| `POST` | `/inventory/alerts/check` | admin/sucursal | Reconcilia alertas y dispara webhook |

Reglas:
- **Kardex al `ENTREGADO`**, no al crear: `consumeOrder` explota la receta (`cantidad × cantidad_por_plato`), expande combos con `combos_platos.cantidad`, agrega por insumo y descuenta con `updateMany` optimista.
- Idempotente por `SALIDA` de la orden; omite platos sin receta y los reporta en `sinReceta`.
- El stock **no baja de cero** (`CHECK`): el faltante queda en 0 y el movimiento guarda lo consumido.
- Corre en la transacción del request: si el kardex falla, la entrega no se confirma.
- Alertas: una fila por insumo y sucursal, **se borra al reponer**; cron cada 10 min (`EVERY_10_MINUTES`); sin `STOCK_WEBHOOK_URL` registra y no envía. Con URL, HMAC-SHA256 en `X-Fogoneria-Signature`.

## 4. Datos

- `insumos`: nombre, unidad.
- `stocks_sucursal`: `insumo_id`, `sucursal_id`, `cantidad` (CHECK ≥ 0), `stock_minimo`.
- `movimientos_inventario`: `tipo` (`ENTRADA|SALIDA|AJUSTE|MERMA`), `cantidad`, `orden_id`, folio; append-only.
- `escandallos_recetas`: PK compuesta (`plato_id`, `insumo_id`), `cantidad_por_plato`.
- `alertas_stock`: `estado`, `notificado_at`.

## 5. UI y rutas

- `/app/modulos/inventario/movimientos` → `MovementsPage`: semáforo + kardex reales.
- `/app/modulos/inventario/stock` → `InventoryPage`: maestro y ajustes **demo**.
- `/app/modulos/inventario` (hub) → `InventoryHubPage` con `ModuleGate`.

## 6. Pruebas

- Cobertura p2 (2026-11-20): tests de ramas de error y servicios (Prisma/tenant extension, promociones, precios, caja, RRHH, CRM) y SSR de providers/páginas; sin cambios de comportamiento.

- Cobertura (2026-11-20): se añadieron tests de controlador, DTO, mapper y ramas de error para subir la cobertura de Sonar; sin cambios de comportamiento.

| Suite | Archivo |
|---|---|
| Unit | `inventory.service.spec.ts`, `inventory.movements.spec.ts`, `stock-alerts.service.spec.ts` |
| e2e | `test/inventory-alerts.e2e-spec.ts` |
| DB | `kardex.db-spec.ts`, `alertas-stock.db-spec.ts` |
| Web | `features/inventario/inventario.test.ts` |

## 7. Deuda conocida

- **Falta el maestro de insumos**: no hay `GET/POST/PATCH /inventory/items` ni ajuste con motivo (observación 1; cierra el 20 % de AYCDS-24).
- AYCDS-23 (merma/rendimiento) y AYCDS-29 (pruebas cruzadas inventario↔ventas) siguen pendientes.
- El ajuste manual no existe en API; el demo lo simula.

## 8. Trazabilidad

- Jira: AYCDS-11 (kardex), AYCDS-13 (semáforo/alertas), AYCDS-24 (UI), AYCDS-23/29 (pendientes).
- PRs: #28, #37, #40.
- Docs: [decisiones](../../docs/decisiones.md) (descuento al entregar, stock ≥ 0).

## 9. Próximos pasos

1. Endpoints de insumos y ajuste con motivo para cerrar AYCDS-24.
2. Pruebas cruzadas inventario↔ventas (AYCDS-29).
3. Definir merma/rendimiento si el negocio lo pide.
