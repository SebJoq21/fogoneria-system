# TAREAS — Semanas 11 y 12: KDS con SLA, caja y comprobantes

**Rango:** 2026-11-06 → 2026-11-17 (vence la primera el 10 y el resto el 17)
**Épica:** AYCDS-7 — «KDS, caja y comprobantes S11-S12»
**Base:** `development` (`906fba3`) · **Regla:** un PR por tarea Jira, siempre desde `development`, sin PRs apilados.

## 1. Resumen ejecutivo

| Indicador | Valor |
|---|---|
| Tareas del rango | **7** |
| Cerradas (Listo) | **5** |
| En revisión | **1** |
| Por hacer | **1** |
| Avance global (promedio simple) | **86%** |

**Diagnóstico:** las órdenes ya se crean con precio de servidor (`20`), se optimizaron a p95 ~307 ms (`22`) y el KDS recibe eventos en vivo (`14`). Falta lo que convierte la comanda en dinero y en cocina medida: el **tablero con SLA** de la `30`, el **turno de caja** de la `34`, el **comprobante con correlativo y reversión** de la `36`, y las dos **UI** que los consumen (`41` y `46`). El esquema ya tiene `turnos_caja`, `movimientos_caja`, `comprobantes` (`serie_numero` único por empresa), `secuencias` y `ordenes.alerta_sla`: no hace falta modelo nuevo, sí módulos.

> **Decisiones tomadas el 2026-11-06**
> - **KDS bajo RLS (`30`):** se **mide primero** con la consulta acotada (sucursal + estados abiertos + ventana + `LIMIT`); solo si sigue lento se escala a vista/función `SECURITY DEFINER` o contadores. No se relaja RLS ni se da `BYPASSRLS` al rol de negocio.
> - **Propinas (`33`, S15-S16):** la fuente será `ordenes.propina` (columna nueva). Se agrega en la migración de la `34`, porque el cobro es quien conoce la propina.
> - **Webhook de stock (`13`, S13-S14):** `STOCK_WEBHOOK_URL` + `STOCK_WEBHOOK_SECRET` (HMAC); sin URL configurada el job registra y no envía.

## 2. Tabla maestra de tareas

| Jira | Tarea | Sem. | Responsable | Estado Jira | Avance | Ya existe | Falta |
|---|---|---|---|---|---|---|---|
| AYCDS-30 | [36.0] API KDS columnas + SLA 20min | 11 | David Piñarreta | Listo | 100% | `ordenes.estado` + `confirmacion_at`/`listo_at`/`alerta_sla`, evento `order.updated`, `idx_ordenes_tenant_sucursal_estado` | — |
| AYCDS-39 | [39.0] ACID financiero triggers reversión | 11 | Sonny De La Cruz | Listo | 100% | Trigger `trg_ordenes_inmutable`, `comprobantes.estado = ANULADA`, inmutabilidad contable | — |
| AYCDS-34 | [37.0] API caja turnos ingresos-egresos | 11 | David Piñarreta | Listo | 100% | `turnos_caja`, `movimientos_caja`, `metodo_pago`, `canOperateCash` en la web | — |
| AYCDS-36 | [38.0] API comprobantes correlativo y reversión | 12 | David Piñarreta | Listo | 100% | Tabla `comprobantes`, `secuencias`, IGV derivado | — |
| AYCDS-41 | [40.0] UI KDS Kanban alertas SLA | 11 | Joshua Chávez | Listo | 100% | `OrdersView` con columnas, canal en vivo y `useNow` | — |
| AYCDS-46 | [41.0] UI caja y comprobantes emisión-anulación | 12 | Diego Arévalo | En revisión | 100% | `CajaView` y `ComprobantesView` contra `cash-api`/`receipts-api`; SUNAT queda «pendiente de OSE» | Revisión del PR |
| AYCDS-50 | [42.0] Auditoría CT-FG-03 acta mensual 2 | 12 | Sebastián Chicata | Por hacer | 0% | Acta anterior (`docs/acta-qa-aycds-66.md`) y la evidencia de caja/comprobantes ya lista | Evidencia de la corrida y firma |

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

- **Semana:** 11 · **Responsable:** Sonny De La Cruz · **Estado Jira:** En revisión · **Avance:** 100 %
- **Descripción Jira:** «ACID financiero triggers reversion».
- **Qué se hizo:**
  1. `fogoneria.revertir_caja_orden()`: un EGRESO compensatorio por cada INGRESO de la orden, en el turno **abierto** de la sucursal (nunca reabre uno cerrado).
  2. `fogoneria.revertir_kardex_orden()`: una ENTRADA compensatoria por cada SALIDA/MERMA y restauración de `stocks_sucursal`.
  3. Triggers `AFTER UPDATE OF estado` en `comprobantes` (al pasar a `ANULADA`) y en `ordenes` (red de seguridad).
  4. Idempotencia: si ya existe el movimiento compensatorio de esa orden no se duplica; la segunda anulación choca con `DB_COMPROBANTE_ANULADO`/`DB_ORDEN_CERRADA`.
  5. `DB_REVERSION_SIN_TURNO` (409) cuando se anula con cobros y no hay caja abierta; documentado en `docs/errores-db.md`.
  6. **Puntos fuera de alcance**: nada los otorga aún y el enum no tiene ajuste; entra con AYCDS-31 (decisión registrada).
- **Archivos/rutas:** `apps/api/prisma/migrations/20261106140000_reversion_financiera/`, `apps/api/test/db/reversion-financiera.db-spec.ts`, `docs/errores-db.md`
- **Criterio de aceptación:** ninguna anulación deja caja o stock descuadrados, y repetirla no mueve nada. **Cumplido** (6 pruebas DB).
- **Depende de:** nada nuevo.
- **Bloquea a:** **AYCDS-36** (la anulación en cascada del comprobante reutiliza estos triggers).

### AYCDS-34 — [37.0] API caja turnos ingresos-egresos

- **Semana:** 11 · **Responsable:** David Piñarreta · **Estado Jira:** En revisión · **Avance:** 100 %
- **Descripción Jira:** «Apertura/cierre, metodos pago RF-08 CT-FG-03 Swagger».
- **Qué se hizo:**
  1. Módulo `cash`: `POST /cash/shifts` (abrir con fondo), `PATCH /cash/shifts/:id/close` (arqueo con efectivo contado, diferencia y observaciones), `GET /cash/shifts`, `GET /cash/shifts/current`.
  2. `POST /cash/movements` (INGRESO/EGRESO) y listado por turno; sin turno abierto responde 409.
  3. `POST /cash/charges`: cobro de la comanda con pagos parciales y propina; cuando cubre el total, la orden pasa a `PAGADA` (libera mesa y avisa al KDS).
  4. Cierre calcula `ingresos_total`, `egresos_total`, `saldo`, esperado en efectivo y diferencia **desde los movimientos**; el turno cerrado queda inmutable.
  5. Migración: `ordenes.propina` con `CHECK >= 0`, columnas de arqueo y **índice único parcial** `uq_turnos_abierto_sucursal` (una caja abierta por sucursal).
  6. `PATCH /orders/:id/status` ya **no** acepta `PAGADA`: el dinero entra solo por caja (400 con el endpoint correcto).
  7. RBAC `CAJERO`/`GERENTE_SUCURSAL`/`ADMIN_GLOBAL` y auditoría en apertura, cierre, movimiento y cobro.
- **Archivos/rutas:** `apps/api/src/modules/cash/**`, `apps/api/src/modules/orders/orders.service.ts`, `apps/api/prisma/migrations/20261106160000_caja_turnos_propina/`
- **Criterio de aceptación:** un turno cuadra al céntimo y no se puede abrir dos veces la misma caja. **Cumplido** (smoke 21/21 + 5 pruebas DB).
- **Depende de:** nada nuevo.
- **Bloquea a:** **AYCDS-46**, **AYCDS-17** (egreso de gastos) y la fuente de propinas de **AYCDS-33**.

### AYCDS-36 — [38.0] API comprobantes correlativo y reversión

- **Semana:** 12 · **Responsable:** David Piñarreta · **Estado Jira:** En revisión · **Avance:** 100 %
- **Descripción Jira:** «Emision B001 + anulacion cascada RF-09 RD-01 CT-FG-03 + tests».
- **Qué se hizo:**
  1. Módulo `receipts`: `POST /receipts` (201), `GET /receipts` con filtros por día (hora de Lima), tipo, estado y sucursal, `GET /receipts/:id`, `POST /receipts/:id/void`.
  2. **Solo sobre comanda `PAGADA`**: el comprobante es el documento de un cobro que ya existe (AYCDS-34), no una forma de cobrar.
  3. Correlativo por empresa y **serie** en `secuencias` (`B001-00000001`, `F001-00000001`, `T001-…`), sin `Date.now()` ni `COUNT(*)`; el índice `uq_comp_empresa_serie` es la última defensa ante dos emisiones a la vez.
  4. Documento validado: FAC­TURA exige RUC con dígito (módulo 11), BOLETA acepta DNI de 8 dígitos, TICKET no pide documento.
  5. IGV desglosado en la respuesta (`base = total / 1.18`, `igv = total - base`), derivado y no persistido.
  6. Anulación con motivo obligatorio: estado `ANULADA` + actor + fecha; la reversión de caja/stock la aplican los triggers de AYCDS-39 cuando se desplieguen, este módulo no la duplica.
  7. Auditoría en emisión y anulación.
- **Archivos/rutas:** `apps/api/src/modules/receipts/**`, `apps/api/src/common/sequences/sequences.service.ts`
- **Criterio de aceptación:** dos cajas emitiendo a la vez nunca repiten serie-número y la anulación no descuadra caja. **Cumplido** (smoke 14/14 + 5 pruebas DB).
- **Depende de:** **AYCDS-39** solo para la reversión automática (el correlativo y la emisión no la necesitan).
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

- **Semana:** 12 · **Responsable:** Diego Arévalo · **Estado Jira:** En revisión · **Avance:** 100 %
- **Qué se hizo (parte 1 — caja):**
  1. `lib/cash-api.ts`: turno actual, apertura, cierre con arqueo, movimientos y cobro; traducciones de método (Plin → Yape) y de tipo.
  2. `lib/receipts-api.ts`: listado con filtros, detalle con IGV, emisión y anulación; `fechaLima` y código SUNAT del tipo.
  3. `CajaView` contra la API con sesión: turno y arqueo del servidor, movimientos del turno, historial de turnos cerrados, apertura/cierre y **cobro de comandas `ENTREGADO`** con pago parcial y propina (`POST /cash/charges`). Sin sesión mantiene el estado local del demo.
  4. Tests: 20 nuevos en los dos clientes (queries, cuerpos, traducciones, fecha de Lima).
- **Qué se hizo (parte 2 — comprobantes):**
  1. `ComprobantesView` lista, emite y anula contra `receipts-api` cuando hay sesión; sin sesión conserva el flujo demo.
  2. La emisión **solo** acepta una comanda `PAGADA` (selector de comandas cobradas); el importe lo pone el servidor.
  3. La columna SUNAT muestra **«Pendiente de OSE»**: se retiró la simulación de CDR/resumen/contingencia en modo API (siguen solo en el demo). Decisión: no fingir un ciclo tributario que la API no tiene.
  4. `lib/receipt-mapping.ts` + 7 tests del mapeo (IGV derivado, factura/boleta, anulada con motivo, sin cliente, sin orden).
- **Criterio de aceptación:** caja y comprobantes operan contra la API, sin `localStorage`. **Cumplido.**
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
| 2026-11-06 | 46 | Diego Arévalo | Parte 1: `cash-api` / `receipts-api` y `CajaView` contra la API (turno, arqueo, movimientos y cobro con propina). Falta `ComprobantesView` (ciclo SUNAT mock) | 128 tests web (+20), `check-types`, `lint` y `build` OK |
| 2026-11-06 | 41 | Joshua Chávez | KDS contra `/orders/board`: contadores, badge de SLA en vivo (10/20 min), refresco por `order.created`/`order.updated`/`order.sla` y caída al estado local en demo | 108 web (+7), `check-types`, `lint` y `build` OK |
| 2026-11-06 | 34 | David Piñarreta | Caja: turnos con arqueo, ingresos/egresos, cobro con propina y `PAGADA` solo por caja. Índice único de turno abierto por sucursal y `ordenes.propina` | Smoke real 21/21, 163 unit (+15), 54 e2e (+11), 60 DB (+5) |
| 2026-11-06 | 39 | Sonny De La Cruz | Reversión financiera al anular: EGRESO compensatorio en el turno abierto, ENTRADA de stock con restauración, idempotencia y `DB_REVERSION_SIN_TURNO`. Puntos diferidos a AYCDS-31 | 6 pruebas DB (55 en total), `docs/errores-db.md`, `docs/decisiones.md` |
| 2026-11-06 | 30 | David Piñarreta | Tablero del KDS con SLA: `/orders/board`, `order.sla` y cron de 20 min. Consulta acotada medida (1,56 ms vs 81 ms) e índice parcial para el barrido (0,072 ms) | PR (rama `feat/aycds-30-kds-sla`), `docs/explain-orders.md` §7, 146 unit + 43 e2e + 49 DB |
