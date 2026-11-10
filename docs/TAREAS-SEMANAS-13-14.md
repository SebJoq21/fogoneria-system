# TAREAS — Semanas 13 y 14: inventario, gastos y comercial

**Rango:** 2026-11-18 → 2026-12-01
**Épica:** AYCDS-8 — «Inventario, gastos y comercial S13-S14»
**Base:** `development` · **Regla:** un PR por tarea desde `development`, revisado por otra persona.

## 1. Resumen ejecutivo

| Indicador | Valor |
|---|---|
| Tareas del rango | **8** |
| Cerradas (Listo) | **0** |
| En revisión (PR) | **1** |
| Por hacer | **7** |
| Avance global (promedio simple) | **13%** |

**Diagnóstico:** el esquema ya tiene todo lo que el inventario necesita (`insumos`, `escandallos_recetas`, `stocks_sucursal`, `movimientos_inventario`, `gastos`, `proveedores`, `combos`, `combos_platos`, `cupones`, `reglas_horarias_promos`). Falta el trabajo por comanda (kardex), el semáforo con alerta, el gasto que sale de caja y la promoción que se aplica en el cobro. La caja y los comprobantes ya están en `development` (S11–S12), así que el gasto y la promoción se apoyan en módulos reales.

## 2. Tabla maestra

| Jira | Tarea | Sem. | Responsable | Estado Jira | Avance | Ya existe | Falta |
|---|---|---|---|---|---|---|---|
| AYCDS-11 | [43.0] Job Kardex auto por escandallo | 13 | David Piñarreta | En revisión | 100% | `escandallos_recetas`, `stocks_sucursal`, `movimientos_inventario`, `combos_platos` | Descuento al `ENTREGADO`, idempotencia, explosión de combos y stock sin negativos |
| AYCDS-13 | [44.0] Semáforo stock + webhook n8n | 13 | David Piñarreta | Por hacer | 0% | `stocks_sucursal.stock_minimo`, `STOCK_WEBHOOK_*` en `.env.example` | Endpoint de estado, alerta y webhook firmado |
| AYCDS-17 | [45.0] API gastos CxP cruce a caja | 13 | David Piñarreta | Por hacer | 0% | `gastos` con `estado_pago`, `pagado_en_caja`, `turno_id`; caja real (S11) | Módulo de gastos y egreso automático en efectivo |
| AYCDS-19 | [46.0] API combos precio fijo y promos | 14 | David Piñarreta | Por hacer | 0% | `combos.precio_fijo`, `cupones`, `reglas_horarias_promos`, `canjes_cupones` | CRUD de combos/cupones, validación anti-inflación y aplicación en la comanda |
| AYCDS-23 | [47.0] Modelo escandallos recetas-insumos N-M | 13 | Sonny De La Cruz | Por hacer | 0% | Tabla `escandallos_recetas` (PK compuesta) | Definir merma/rendimiento si el negocio lo pide |
| AYCDS-24 | [48.0] UI inventario Kardex semáforos | 13 | Diego Arévalo | Por hacer | 0% | `InventoryMovementsView` (mock) | Conectar kardex y semáforo a la API |
| AYCDS-27 | [49.0] UI gastos combos promos | 14 | Joshua Chávez | Por hacer | 0% | `GastosView`, `CombosView`, `PromocionesView` (mock) | Conectar a los módulos de 17 y 19 |
| AYCDS-29 | [50.0] Pruebas Kardex inventario-ventas | 14 | Sebastián Chicata | Por hacer | 0% | Suites unit/e2e/DB | Pruebas cruzadas inventario↔ventas y acta |

## 3. Fichas de las tareas de API

### AYCDS-11 — [43.0] Job Kardex auto por escandallo

- **Semana:** 13 · **Responsable:** David Piñarreta · **Estado Jira:** En revisión · **Avance:** 100 %
- **Descripción Jira:** «Descarga receta\*qty al Entregado RF-11 RD-03 CT-FG-04 + unit tests».
- **Qué se hizo:**
  1. `InventoryService.consumeOrder()`: al pasar la comanda a `ENTREGADO` explota la receta de cada plato (`cantidad × cantidad_por_plato`), agrega por insumo y descuenta `stocks_sucursal` con un `movimientos_inventario` `SALIDA`.
  2. **Combos**: se expanden a sus platos con `combos_platos.cantidad` antes de la receta.
  3. **Idempotente**: si la orden ya tiene una `SALIDA`, no vuelve a descontar.
  4. **Sin receta no rompe**: el plato se omite y se reporta en `sinReceta` (la cocina no deja de servir por un escandallo faltante).
  5. **Stock sin negativos**: la base tiene un `CHECK`, así que el faltante queda en 0 y el movimiento registra lo consumido; el descuento usa concurrencia optimista (`updateMany` con la cantidad leída) para no pisar a otra comanda.
  6. Corre **dentro de la transacción del request**: si el kardex falla, la entrega no se confirma.
- **Archivos/rutas:** `apps/api/src/modules/inventory/**`, `apps/api/src/modules/orders/orders.service.ts`
- **Criterio de aceptación:** la entrega descuenta la receta una sola vez, los combos también, y ninguna comanda deja stock negativo. **Cumplido** (smoke 9/9 + 6 pruebas DB).
- **Depende de:** nada bloqueante (la tabla de recetas existe desde el modelo inicial).
- **Bloquea a:** **AYCDS-13** (el semáforo se alimenta de este kardex) y **AYCDS-24**/**29**.

### AYCDS-13 — [44.0] Semáforo stock + webhook n8n WhatsApp

- **Semana:** 13 · **Responsable:** David Piñarreta · **Estado Jira:** Por hacer · **Avance:** 0 %
- **Descripción Jira:** «Optimo/Bajo/Agotado + alerta CT-FG-04 endpoint + webhook».
- **Qué debe hacerse:**
  1. `GET /inventory/stock?sucursalId` con estado por insumo frente a `stock_minimo`: `OPTIMO`, `BAJO`, `AGOTADO`.
  2. `GET /inventory/alerts` con solo lo que cruzó el umbral, ordenado por criticidad.
  3. Webhook saliente a n8n con `STOCK_WEBHOOK_URL` + `STOCK_WEBHOOK_SECRET` (HMAC `X-Fogoneria-Signature`); **sin URL configurada es no-op** con log y registro en `auditoria`.
  4. Reintento con backoff y sin bloquear el request (el kardex no espera a n8n).
- **Criterio de aceptación:** el semáforo refleja el stock real y una alerta llega firmada al webhook configurado.
- **Depende de:** **AYCDS-11**.
- **Bloquea a:** **AYCDS-24** (semáforos en la UI).

### AYCDS-17 — [45.0] API gastos CxP cruce a caja

- **Semana:** 13 · **Responsable:** David Piñarreta · **Estado Jira:** Por hacer · **Avance:** 0 %
- **Descripción Jira:** «Operativos y por pagar, auto-egreso efectivo RF-12 CT-FG-03».
- **Qué debe hacerse:**
  1. Módulo `expenses`: CRUD de `gastos` con `categoria_gasto`, proveedor, vencimiento y `estado_pago`.
  2. `POST /expenses/:id/pay` con método: si es **EFECTIVO**, crea `movimientos_caja` `EGRESO` en el turno abierto y marca `pagado_en_caja`; si es otro método, solo cambia `estado_pago` (el banco no está en caja).
  3. Listado con filtros por estado, categoría y vencimiento; resumen de por pagar.
  4. RBAC `admin`/`sucursal`/`cajero` según acción; auditoría en alta y pago.
- **Criterio de aceptación:** un gasto pagado en efectivo aparece como egreso en el arqueo y no se puede pagar dos veces.
- **Depende de:** **AYCDS-34** (caja).
- **Bloquea a:** **AYCDS-27** y **AYCDS-35** (BI de gastos).

### AYCDS-19 — [46.0] API combos precio fijo y promos

- **Semana:** 14 · **Responsable:** David Piñarreta · **Estado Jira:** Por hacer · **Avance:** 0 %
- **Descripción Jira:** «Bloqueo inflacion + cupones/horarias RF-04 CT-FG-05 CT-FG-06 validaciones».
- **Qué debe hacerse:**
  1. CRUD de `combos` con sus `combos_platos` y **bloqueo anti-inflación**: el `precio_fijo` no puede superar la suma de los platos a la lista activa.
  2. CRUD de `cupones` (código único por empresa, tipo, valor, límite, vencimiento) y consulta de `reglas_horarias_promos`.
  3. Validación del cupón en `POST /orders`: activo, vigente, con usos, dentro de la regla horaria; registra `canjes_cupones` y descuenta del total en el servidor.
  4. `POST /coupons/:codigo/validate` para que la UI muestre el descuento antes de cobrar.
- **Criterio de aceptación:** un combo nunca es más caro que sus partes y un cupón no se puede usar fuera de regla ni dos veces de más.
- **Depende de:** nada bloqueante (catálogo y precios ya existen).
- **Bloquea a:** **AYCDS-27** (UI de combos y promos).

## 4. Dependencias

```text
11 kardex ──► 13 semáforo ──┐
                            ├─► 24 UI inventario
11 kardex ──────────────────┘
34 caja (hecha) ──► 17 gastos ──┐
                                ├─► 27 UI gastos/combos/promos
19 combos/promos ───────────────┘
17 + 19 + 34 ──► 35 BI (S15-S16)
11 + 13 ──► 29 pruebas x inventario/ventas
```

**Ruta crítica:** `11 → 13 → 24` y `17 → 27`. La **19** es independiente y se puede adelantar.

## 5. Orden de PRs

| Orden | Tarea | Rama | Condición |
|---|---|---|---|
| 1 | AYCDS-11 | `feat/aycds-11-kardex` | Base `development` |
| 2 | AYCDS-13 | `feat/aycds-13-semaforo-stock` | Base con PR 1 mergeado |
| 3 | AYCDS-19 | `feat/aycds-19-combos-promos` | Base `development` (independiente) |
| 4 | AYCDS-17 | `feat/aycds-17-gastos-caja` | Base con caja (ya en `development`) |
| 5 | AYCDS-24 | `feat/aycds-24-ui-inventario-diego` | Con 11 y 13 |
| 6 | AYCDS-27 | `feat/aycds-27-ui-gastos-promos-joshua` | Con 17 y 19 |
| 7 | AYCDS-29 | `test/aycds-29-kardex-sebastian` | Al final |

## 6. DoD

El de S11–S12: funciona contra la API real, RBAC y aislamiento probados, unit + e2e (+DB si toca datos), `lint`/`check-types`/`build` y **CI verde**, smoke real cuando haya Postgres, docs actualizadas y Jira en Listo solo después del merge.

## 7. Bitácora

| Fecha | Tarea | Responsable | Qué | Evidencia |
|---|---|---|---|---|
| 2026-11-06 | plan | David Piñarreta | Ficha de S13-S14 con las 8 tareas, dependencias y orden de PRs | Este archivo |
| 2026-11-06 | 11 | David Piñarreta | Kardex por escandallo al entregar: explosión de combos, idempotencia, stock sin negativos y dentro de la transacción del request | Smoke real 9/9 (lomo 12 → 11 kg), 6 pruebas DB, 8 unit |
