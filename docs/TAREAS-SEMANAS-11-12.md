# TAREAS — Semanas 11 y 12: KDS con SLA, caja y comprobantes

**Rango:** 2026-11-06 → 2026-11-17 (vence la primera el 10 y el resto el 17)
**Épica:** AYCDS-7 — «KDS, caja y comprobantes S11-S12»
**Base:** `development` (`906fba3`) · **Regla:** un PR por tarea Jira, siempre desde `development`, sin PRs apilados.

## 1. Resumen ejecutivo

| Indicador | Valor |
|---|---|
| Tareas del rango | **7** |
| Cerradas (Listo) | **0** |
| En revisión (PR) | **1** |
| Por hacer | **5** |
| Avance global (promedio simple) | **29%** |

**Diagnóstico:** las órdenes ya se crean con precio de servidor (`20`), se optimizaron a p95 ~307 ms (`22`) y el KDS recibe eventos en vivo (`14`). Falta lo que convierte la comanda en dinero y en cocina medida: el **tablero con SLA** de la `30`, el **turno de caja** de la `34`, el **comprobante con correlativo y reversión** de la `36`, y las dos **UI** que los consumen (`41` y `46`). El esquema ya tiene `turnos_caja`, `movimientos_caja`, `comprobantes` (`serie_numero` único por empresa), `secuencias` y `ordenes.alerta_sla`: no hace falta modelo nuevo, sí módulos.

> **Decisiones tomadas el 2026-11-06**
> - **KDS bajo RLS (`30`):** se **mide primero** con la consulta acotada (sucursal + estados abiertos + ventana + `LIMIT`); solo si sigue lento se escala a vista/función `SECURITY DEFINER` o contadores. No se relaja RLS ni se da `BYPASSRLS` al rol de negocio.
> - **Propinas (`33`, S15-S16):** la fuente será `ordenes.propina` (columna nueva). Se agrega en la migración de la `34`, porque el cobro es quien conoce la propina.
> - **Webhook de stock (`13`, S13-S14):** `STOCK_WEBHOOK_URL` + `STOCK_WEBHOOK_SECRET` (HMAC); sin URL configurada el job registra y no envía.

## 2. Tabla maestra de tareas

| Jira | Tarea | Sem. | Responsable | Estado Jira | Avance | Ya existe | Falta |
|---|---|---|---|---|---|---|---|
| AYCDS-30 | [36.0] API KDS columnas + SLA 20min | 11 | David Piñarreta | En revisión | 100% | `ordenes.estado` + `confirmacion_at`/`listo_at`/`alerta_sla`, evento `order.updated`, `idx_ordenes_tenant_sucursal_estado` | Endpoint de tablero, cálculo de SLA y alerta, tests y `EXPLAIN` |
| AYCDS-39 | [39.0] ACID financiero triggers reversión | 11 | Sonny De La Cruz | Por hacer | 0% | Trigger `trg_ordenes_inmutable`, `comprobantes.estado = ANULADA`, inmutabilidad contable | Triggers de reversión de caja/kardex/puntos y sus tests DB |
| AYCDS-34 | [37.0] API caja turnos ingresos-egresos | 11 | David Piñarreta | Por hacer | 0% | `turnos_caja`, `movimientos_caja` (tipo INGRESO/EGRESO), `metodo_pago`, `canOperateCash` en la web | Módulo `caja` (abrir/cerrar, movimientos, arqueo), `ordenes.propina`, RBAC y auditoría |
| AYCDS-36 | [38.0] API comprobantes correlativo y reversión | 12 | David Piñarreta | Por hacer | 0% | Tabla `comprobantes` con `serie_numero` único por empresa, `secuencias`, IGV en `domain.ts`, `MockFacturacionAdapter` en la web | Módulo `comprobantes`: correlativo por serie, emisión, anulación en cascada y listado |
| AYCDS-41 | [40.0] UI KDS Kanban alertas SLA | 11 | Joshua Chávez | En revisión | 100% | `OrdersView` con columnas, canal en vivo y `useNow` | Consumir `/orders/board`, badge de SLA y contadores por columna |
| AYCDS-46 | [41.0] UI caja y comprobantes emisión-anulación | 12 | Diego Arévalo | Por hacer | 0% | `CajaView` (445 líneas, mock) y `ComprobantesView` (534 líneas, mock) | `lib/cash-api.ts` y `lib/receipts-api.ts`, conectar ambas vistas y confirmar acciones |
| AYCDS-50 | [42.0] Auditoría CT-FG-03 acta mensual 2 | 12 | Sebastián Chicata | Por hacer | 0% | Acta anterior (`docs/acta-qa-aycds-66.md`) | Evidencia de caja/comprobantes y firma |

## 3. Fichas por tarea

### AYCDS-30 — [36.0] API KDS columnas + SLA 20min

- **Semana:** 11 · **Responsable:** David Piñarreta · **Estado Jira:** En revisión · **Avance:** 100 %
- **Descripción Jira:** «Por confirmar/En cocina/Listo/Entregado + timer RF-07 CT-FG-08».
- **Qué se hizo:**
  1. `GET /orders/board?dias&limite&sucursalId`: cuatro columnas con sus comandas, `alertaSla` calculado y métricas del turno (abiertas, fuera de SLA, espera media y preparación media) en una sola llamada.
  2. Consulta acotada (sucursal + estados abiertos + 7 días + `LIMIT 200`) y medida: **1,56 ms** con `idx_ordenes_tenant_fecha`, contra **81 ms** del mismo listado sin ventana (`docs/explain-orders.md` §7).
  3. SLA de 20 min desde `confirmacion_at` (o `ingreso_at` si no se confirmó), con `orders.sla.ts` como única fuente; a los 20 justos no alerta.
  4. `OrdersSlaCron` cada minuto: marca `ordenes.alerta_sla` una sola vez y emite `order.sla`; índice parcial nuevo `idx_ordenes_sla_pendiente` (**0,072 ms** con el rol del cron).
  5. Tests: 12 unitarios nuevos (umbrales 19/20/21, base del reloj, métricas, cron) + 5 e2e (columnas, query, 400, 401) + 6 DB (dos empresas, sin confirmar, idempotencia).
- **Archivos/rutas:** `apps/api/src/modules/orders/{orders.sla,orders.sla.cron,orders.service,orders.controller}.ts`, `dto/board-orders.dto.ts`, `apps/api/prisma/migrations/20261106120000_ordenes_sla_indice`, `db/scripts/perf/explain-board.sql`, `docs/explain-orders.md`
- **Criterio de aceptación:** el KDS pinta el tablero con una sola llamada, la alerta de 20 min es determinista y el `EXPLAIN` está documentado. **Cumplido.**
- **Depende de:** nada nuevo (`20`, `22` y `14` están en `development`).
- **Bloquea a:** **AYCDS-41**.

### AYCDS-39 — [39.0] ACID financiero triggers reversión

- **Semana:** 11 · **Responsable:** Sonny De La Cruz · **Estado Jira:** Por hacer · **Avance:** 0 %
- **Descripción Jira:** «ACID financiero triggers reversion».
- **Qué debe hacerse:**
  1. Trigger de reversión al anular una orden o un comprobante: devolver el stock consumido, reversar el movimiento de caja y los puntos otorgados.
  2. Idempotencia: una segunda anulación no vuelve a reversar (clave por orden/comprobante).
  3. Códigos de error estables (`DB_*`) y traducción documentada en `docs/errores-db.md`.
  4. Tests DB: anulación simple, doble anulación, orden sin kardex, comprobante sin caja.
- **Archivos/rutas:** `apps/api/prisma/migrations/**`, `apps/api/test/db/**`, `docs/errores-db.md`
- **Criterio de aceptación:** ninguna anulación deja caja o stock descuadrados, y repetirla no mueve nada.
- **Depende de:** nada nuevo.
- **Bloquea a:** **AYCDS-36** (la anulación en cascada del comprobante reutiliza estos triggers).

### AYCDS-34 — [37.0] API caja turnos ingresos-egresos

- **Semana:** 11 · **Responsable:** David Piñarreta · **Estado Jira:** Por hacer · **Avance:** 0 %
- **Descripción Jira:** «Apertura/cierre, metodos pago RF-08 CT-FG-03 Swagger».
- **Qué debe hacerse:**
  1. Módulo `caja`: `POST /cash/shifts` (abrir con fondo), `PATCH /cash/shifts/:id/close` (arqueo: efectivo contado, diferencia, observaciones), `GET /cash/shifts` y `GET /cash/shifts/current`.
  2. `POST /cash/movements` (INGRESO/EGRESO con concepto y método) y listado por turno; solo sobre un turno `ABIERTO` (409 si no).
  3. Cierre calcula `ingresos_total`, `egresos_total` y `saldo`; un turno cerrado es inmutable.
  4. Migración: `ordenes.propina` (`Decimal(12,2)`, default 0) y su `CHECK >= 0`.
  5. RBAC `cajero`/`GERENTE_SUCURSAL`/`ADMIN_GLOBAL`, auditoría en apertura, cierre y cada movimiento.
  6. Tests unit (arqueo, diferencia, doble cierre), e2e (RBAC y 409) y DB (concurrencia de dos aperturas en la misma sucursal).
- **Archivos/rutas:** `apps/api/src/modules/cash/**`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/**`
- **Criterio de aceptación:** un turno cuadra al céntimo y no se puede abrir dos veces la misma caja.
- **Depende de:** nada nuevo.
- **Bloquea a:** **AYCDS-46**, **AYCDS-17** (egreso de gastos) y la fuente de propinas de **AYCDS-33**.

### AYCDS-36 — [38.0] API comprobantes correlativo y reversión

- **Semana:** 12 · **Responsable:** David Piñarreta · **Estado Jira:** Por hacer · **Avance:** 0 %
- **Descripción Jira:** «Emision B001 + anulacion cascada RF-09 RD-01 CT-FG-03 + tests».
- **Qué debe hacerse:**
  1. Módulo `comprobantes`: `POST /receipts` desde una orden `ENTREGADO`/`PAGADA`, con tipo (`BOLETA`/`FACTURA`), documento del cliente validado (RUC módulo 11 / DNI) y total con IGV desglosado.
  2. Correlativo por empresa y serie (`B001-000001`, `F001-000001`) sobre la tabla `secuencias`, sin `Date.now()` ni `COUNT(*)`.
  3. `POST /receipts/:id/void` con motivo obligatorio: estado `ANULADA`, reversión de caja y stock (triggers de `39`) y auditoría; una segunda anulación responde 409.
  4. `GET /receipts` con filtros por fecha, tipo y estado; `GET /receipts/:id`.
  5. Tests unit (correlativo, IGV, validación de documento), e2e (RBAC, 409 de doble anulación) y DB (dos emisiones concurrentes no repiten número).
- **Archivos/rutas:** `apps/api/src/modules/receipts/**`, `apps/api/src/common/sequences/**`
- **Criterio de aceptación:** dos cajas emitiendo a la vez nunca repiten serie-número y la anulación no descuadra caja.
- **Depende de:** **AYCDS-39**.
- **Bloquea a:** **AYCDS-46** y **AYCDS-35** (BI de ventas).

### AYCDS-41 — [40.0] UI KDS Kanban alertas SLA

- **Semana:** 11 · **Responsable:** Joshua Chávez · **Estado Jira:** En revisión · **Avance:** 100 %
- **Qué se hizo:**
  1. `lib/orders-api.ts`: `getOrdersBoard()` sobre el BFF (sucursal, días y límite opcionales) con los tipos del contrato.
  2. `lib/order-mapping.ts`: `kdsBoardFromApi()` traduce columnas, folio, mesa, importe, nº de ítems y base del SLA (confirmación o ingreso); `minutosDeSla()` y `slaTone()` (ámbar >10, rojo >20) son la única regla de urgencia.
  3. Hook `useOrdersBoard`: carga inicial diferida (sin render en cascada), descarte de respuestas viejas y `refresh` para los eventos.
  4. `OrdersView` consume el tablero: contador por columna, badge de SLA en vivo (se recalcula cada 30 s con `useNow`), aviso de «fuera de SLA» y de tablero truncado. Las líneas siguen saliendo del estado local para no perder detalle en cocina.
  5. Un solo socket: `order.created`, `order.updated` **y** `order.sla` refrescan tablero y comandas; sin sesión la vista cae al estado local del demo.
- **Criterio de aceptación:** la cocina ve el tablero real con la alerta de 20 min y sin mutar estado local. **Cumplido**: las acciones van por `advanceOrder` (PATCH), no por `setOrders`.
- **Depende de:** **AYCDS-30**.

### AYCDS-46 — [41.0] UI caja y comprobantes emisión-anulación

- **Semana:** 12 · **Responsable:** Diego Arévalo · **Estado Jira:** Por hacer · **Avance:** 0 %
- **Qué debe hacerse:**
  1. `lib/cash-api.ts` (turno actual, apertura, cierre, movimientos) y `lib/receipts-api.ts` (listado, emisión, anulación).
  2. `CajaView` contra la API: apertura, cobro, egreso, arqueo y diferencia; `ConfirmDialog` en cierre y anulación.
  3. `ComprobantesView` contra la API: emisión con documento validado, anulación con motivo y estado `ANULADA`.
  4. Tests de los dos clientes y de los mapeos de estado.
- **Criterio de aceptación:** caja y comprobantes operan contra la API, sin `localStorage`.
- **Depende de:** **AYCDS-34** y **AYCDS-36**.

### AYCDS-50 — [42.0] Auditoría CT-FG-03 acta mensual 2

- **Semana:** 12 · **Responsable:** Sebastián Chicata · **Estado Jira:** Por hacer · **Avance:** 0 %
- **Qué debe hacerse:** matriz de control `CT-FG-03` con evidencia de caja y comprobantes (capturas, `EXPLAIN`, salidas de test) y firma del acta mensual 2.
- **Depende de:** **AYCDS-34** y **AYCDS-36**.

## 4. Dependencias

```text
39 ACID/reversión ──► 36 comprobantes ──┐
34 caja (turnos + propina) ──────────────┴─► 46 UI caja/comprobantes
34 caja ──► 17 gastos→caja (S13-S14)
34 caja ──► 33 propinas (S15-S16)
30 KDS SLA ──► 41 UI KDS Kanban
```

| Tarea bloqueada | Depende de | Motivo |
|---|---|---|
| 36 comprobantes | 39 | La anulación en cascada reutiliza los triggers financieros |
| 41 UI KDS | 30 | Necesita el tablero y el cálculo de SLA |
| 46 UI caja | 34 y 36 | Necesita turnos y comprobantes reales |
| 50 acta | 34 y 36 | La evidencia es de caja y comprobantes |
| 17 gastos (S13-S14) | 34 | `movimientos_caja.turno_id` es obligatorio |
| 33 propinas (S15-S16) | 34 | La propina se captura en el cobro |

**Ruta crítica:** `39 → 36 → 46`. **Paralelo:** `30 → 41` y `34` pueden ir en paralelo con `39/36`, pero `46` espera a los dos.

## 5. Orden obligatorio de PRs (sin stacked)

| Orden | Tarea | Rama | Condición |
|---|---|---|---|
| 0 | plan + `test:e2e` en CI | `chore/sprint-11-12-plan-ci` | Base `development`; merge primero |
| 1 | AYCDS-30 | `feat/aycds-30-kds-sla` | Base `development` |
| 2 | AYCDS-39 | `feat/aycds-39-acid-reversion` | Base `development` |
| 3 | AYCDS-34 | `feat/aycds-34-caja` | Base `development` |
| 4 | AYCDS-36 | `feat/aycds-36-comprobantes` | Base `development` con PR 2 mergeado |
| 5 | AYCDS-41 | `feat/aycds-41-ui-kds-joshua` | Base `development` con PR 1 mergeado |
| 6 | AYCDS-46 | `feat/aycds-46-ui-caja-diego` | Base `development` con PR 3 y 4 mergeados |
| 7 | AYCDS-50 | `docs/acta-aycds-50-sebastian` | Último |

## 6. Definición de Terminado (DoD)

Una tarea está **Listo** solo si:

- [ ] El endpoint o la pantalla funciona contra la API real (sin mocks ni `localStorage` en el flujo).
- [ ] RBAC por rol probado y aislamiento por empresa/sucursal verificado.
- [ ] Tests: unit + e2e; y DB si toca migración, trigger o concurrencia.
- [ ] `pnpm lint`, `pnpm check-types`, `pnpm build` en verde y **CI verde** en el PR.
- [ ] Smoke real contra PostgreSQL con evidencia pegada en el PR.
- [ ] Docs actualizados: este archivo, `decisiones.md`, `arquitectura.md`, `AGENTS.md` y README si cambia el contrato.
- [ ] Jira en **Listo** con comentario de evidencia (PR, merge, run de CI, smoke).

### Comandos de verificación

```bash
pnpm lint
pnpm check-types
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter api test:db      # requiere DATABASE_URL_TEST y RLS forzado
pnpm --filter web test
pnpm build
```

## 7. Reglas para actualizar Jira

- Al abrir la rama: `Por hacer → En curso` (`transitionId` 21).
- Al mergear con CI verde y evidencia: `En curso → Listo` (`transitionId` 31) + comentario con PR, merge commit, run de CI y resultado del smoke.
- No marcar Listo con dependencia dura sin mergear.
- AYCDS-22 y AYCDS-26 se corrigieron a **Listo** el 2026-11-06 (su código está en `development` desde los PR #16 y #18).

## 8. Bitácora de avance

| Fecha | Tarea | Responsable | Qué | Evidencia |
|---|---|---|---|---|
| 2026-11-06 | plan | David Piñarreta | Ficha de S11-S12 con las 7 tareas, dependencias y orden de PRs; `test:e2e` agregado al CI; decisiones de KDS bajo RLS, propina en `ordenes` y webhook por entorno | Este archivo, `docs/decisiones.md`, `.github/workflows/ci.yml` |
| 2026-11-06 | 41 | Joshua Chávez | KDS contra `/orders/board`: contadores, badge de SLA en vivo (10/20 min), refresco por `order.created`/`order.updated`/`order.sla` y caída al estado local en demo | 108 web (+7), `check-types`, `lint` y `build` OK |
| 2026-11-06 | 30 | David Piñarreta | Tablero del KDS con SLA: `/orders/board`, `order.sla` y cron de 20 min. Consulta acotada medida (1,56 ms vs 81 ms) e índice parcial para el barrido (0,072 ms) | PR (rama `feat/aycds-30-kds-sla`), `docs/explain-orders.md` §7, 146 unit + 43 e2e + 49 DB |
