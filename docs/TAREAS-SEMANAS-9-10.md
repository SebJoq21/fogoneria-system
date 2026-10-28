# Tareas pendientes — Semanas 9 a 10 (Jira AYCDS)

**Proyecto:** Automatización y Control de Software — ERP Fogonería
**Fuente:** Jira `AYCDS` (https://proyectouniversidad.atlassian.net/jira/software/projects/AYCDS)
**Sprint:** Sprint 3
**Rango:** Semanas 9 a 10 (tareas 29.0 a 35.0)
**Repositorio de trabajo:** `fogoneria-system` (monorepo pnpm + Turbo: `apps/api`, `apps/web`, `db/`)
**Fecha de corte:** 2026-10-26
**Elaborado por:** Sebastián Chicata

> **Entorno:** el sistema completo se levanta con `docker compose up --build`.
> No usar `pnpm dev` para la demo. `pnpm` queda únicamente para lint, tipos, tests y build.

---

## 1. Resumen ejecutivo

| Indicador | Valor |
|---|---|
| Tareas del rango | **7** |
| Cerradas (Listo) | **5** |
| En curso | **0** |
| Por hacer | **2** |
| Avance global (promedio simple) | **77%** |
| Avance funcional end-to-end | **≈50%** |

**Diagnóstico:** la base de autenticación, RLS, catálogo, precios, órdenes, mesas/reservas y WebSockets ya existe. El mesero ya opera contra la API real (AYCDS-25): crea la comanda, ve los estados del KDS y marca entregado/anulado. Queda conectar el mapa de mesas y la agenda de reservas (AYCDS-26) y cerrar la integración e2e con evidencia (AYCDS-28).

> **Pendientes heredados:** AYCDS-58 (smoke/CI, 90%) y AYCDS-66 (firmas de acta, 95%) siguen abiertos, pero no se cuentan en el avance de S9–S10.

> **Ejecución sin atajos:** no se usarán PRs apilados ni se recortará el alcance para “llegar” en 2 días. El orden obligatorio es `16 → 20 → 14 → 22 → 25 → 26 → 28`; cada tarea se mergea antes de abrir la siguiente que dependa de ella.

---

## 2. Metodología del porcentaje

- El **% de avance** se estima por **evidencia real en el código**, no por el estado en Jira.
- Se usa **promedio simple por tarea**.
- La columna **“Ya existe”** indica lo verificado en el repositorio; **“Falta”** indica la brecha para cerrar la tarea.
- Los porcentajes son estimaciones de planificación y deben actualizarse en la bitácora.

### Avance por semana

| Semana | Tareas | Avance |
|---|---|---|
| S9 | 14, 16, 20, 22, 25, 26 | 90% |
| S10 | 28 y cierre de 16/20/25/26 | 0% |
| **Global** | **7 tareas** | **77%** |

### Avance por responsable

| Responsable | Tareas | Avance personal |
|---|---|---|
| David Piñarreta | 14, 16, 20 | 100% |
| Sonny De La Cruz | 22 | 100% |
| Joshua Chávez | 25 | 100% |
| Diego Arévalo | 26 | 40% |
| Sebastián Chicata | 28 | 0% |

---

## 3. Tabla maestra de tareas

| Jira | Tarea | Sem. | Responsable | Estado Jira | Avance | Ya existe | Falta |
|---|---|---|---|---|---|---|---|
| AYCDS-14 | [29.0] Gateway WebSockets Mesero-Cocina | 9 | David Piñarreta | Listo | 100% | Gateway Socket.io `/orders` con rooms por empresa/sucursal y `order:<id>`, ticket efímero de 60 s (`POST /auth/ws-ticket` + BFF `/api/session/ws-ticket`), eventos `order.created`/`order.updated`/`table.status` con sobre `{ eventId, at, data }`, cliente web con backoff y deduplicación, `docs/websockets.md`, 127 unit + 38 e2e | — (el pintado de la comanda en el KDS queda en AYCDS-25/26/28) |
| AYCDS-16 | [30.0] API mesas reservas Libre-Ocupada-Reservada | 9-10 | David Piñarreta | Listo | 100% | Módulos API `tables` y `reservations` (CRUD, estados manuales vs derivados, aforo ±90 min, hora de Lima, folios por secuencia); RLS por empresa con `secuencias`; tests unit/e2e/db; UI `BookingsModule` y `SalonTablesView` | — (conectar la UI a la API queda en AYCDS-26) |
| AYCDS-20 | [31.0] API órdenes POS e inmutabilidad | 9-10 | David Piñarreta | Listo | 100% | Precio resuelto en servidor, `mesero_id` del JWT, `numero_orden` por secuencia, mesa `OCUPADA`→liberada en estado terminal, `ANULADA` solo desde `POR_CONFIRMAR` (API 400 + trigger `DB_ORDEN_ANULACION_TARDIA`), auditoría; 19 unit + e2e + 6 DB | — |
| AYCDS-22 | [32.0] Optimizar Comanda alta concurrencia | 9-10 | Sonny De La Cruz | Listo | 100% | Script de carga (`apps/api/test/load/orders-load.mjs`), seed de 50k órdenes (`db/scripts/perf/**`), línea base y `EXPLAIN`; folio en autocommit fuera de la transacción, `set_config` en una sentencia y precios en lote; p95 307–326 ms a 50 concurrentes (antes 1034–1092 ms) | — (la lectura del KDS bajo RLS queda documentada como deuda en `docs/explain-orders.md` §6) |
| AYCDS-25 | [33.0] App Mesero generar-estados-entregado | 9-10 | Joshua Chávez | Listo | 100% | `lib/orders-api.ts` + `lib/tables-api.ts` + `lib/order-mapping.ts` (adapter API↔UI); `MozoView`/`AccountPanel` crean la comanda real (`POST /orders`, sin precio), avanzan estados (`PATCH /orders/:id/status`), muestran carga/error y el canal en vivo; `orders` del `ModulesProvider` sale de la API con sesión real | — (los recargos de modificadores viajan como nota; el cobro sigue en Caja) |
| AYCDS-26 | [34.0] Mapa mesas croquis + agenda reservas | 9-10 | Diego Arévalo | Por hacer | 40% | Mapa/agenda en `BookingsModule`, `SalonTablesView` y `/app/mesas`; CRUD local | API real, estados en vivo, reservas por fecha, bloqueo/liberación y permisos |
| AYCDS-28 | [35.0] Integración Mesero-Cocina-Mesas e2e | 10 | Sebastián Chicata | Por hacer | 0% | Suites unit/DB/e2e existentes; CI verde | Flujo completo mesero → KDS → entregado, prueba e2e, guion y video demo |

---

## 4. Fichas por tarea

### AYCDS-14 — [29.0] Gateway WebSockets Mesero-Cocina

- **Semana:** 9 | **Responsable:** David Piñarreta | **Estado Jira:** Listo | **Avance:** 100%
- **Descripción Jira:** “Socket.io sincronización comandas RNF-02 RDES-02 eventos docs.”
- **Qué se hizo:**
  1. Dependencias `@nestjs/websockets@12.2.0`, `@nestjs/platform-socket.io@12.2.0` y `socket.io@4.8.4` en la API; `socket.io-client@4.8.4` en la web (y como devDependency de la API para el e2e).
  2. `realtime/orders.gateway.ts` con namespace `/orders` y rooms `empresa:<id>`, `empresa:<id>:sucursal:<id>` y `order:<id>` (`order:subscribe` valida el tenant).
  3. Handshake con **ticket efímero de 60 s** (`POST /auth/ws-ticket`, `scope: ws`); el gateway exige `scope` y empresa, y `JwtStrategy` rechaza cualquier token con `scope`, así que el ticket no abre la API HTTP.
  4. Eventos `order.created`, `order.updated` y `table.status` con sobre `{ eventId, at, data }`, emitidos al crear, en cada transición del KDS y al ocupar/liberar la mesa.
  5. `docs/websockets.md` con el contrato completo, el flujo del ticket, los rooms y los límites (sin Redis adapter).
  6. Cliente `apps/web/lib/realtime.ts` con reconexión propia (backoff 1 s → 30 s + jitter, ticket nuevo en cada intento) y deduplicación por `eventId`; BFF `GET /api/session/ws-ticket` y hook `useOrdersRealtime` con el badge de estado en el KDS.
- **Archivos/rutas:** `apps/api/src/modules/realtime/**`, `apps/api/src/modules/auth/{auth.controller,auth.service}.ts`, `apps/api/src/modules/orders/orders.service.ts`, `apps/api/src/app.module.ts`, `apps/web/lib/realtime.ts`, `apps/web/app/api/session/ws-ticket/route.ts`, `apps/web/components/erp/{OrdersView,useOrdersRealtime}.tsx`, `docs/websockets.md`
- **Criterio de aceptación:** el KDS recibe la comanda sin refrescar; reconexión sin duplicados; solo recibe eventos de su tenant/sucursal; contrato documentado. **Cumplido** (el pintado de la comanda en la columna sigue en AYCDS-25/26/28 porque el KDS aún lee del estado local).
- **Evidencia:** 127 unit (gateway, ticket y eventos), 38 e2e (handshake real con Socket.io y aislamiento A/B), 55 web y smoke real contra PostgreSQL 16: el KDS recibe `order.created` con el folio, `order.updated` en la transición y `table.status` al ocupar/liberar; el ticket da 401 en la API HTTP; la empresa B no recibe nada.

### AYCDS-16 — [30.0] API mesas reservas Libre-Ocupada-Reservada

- **Semana:** 9-10 | **Responsable:** David Piñarreta | **Estado Jira:** Listo | **Avance:** 100%
- **Descripción Jira:** “Estados + bloqueo aforo RF-05 CT-FG-02 + tests.”
- **Qué debe hacerse:**
  1. Crear módulo `tables`: listar, crear, editar y cambiar estado de mesas por sucursal.
  2. Crear módulo `reservations`: crear, listar por fecha, confirmar, cancelar y marcar no-show.
  3. Validar aforo contra `capacidad` y evitar solapamiento de reservas.
  4. Impedir que una mesa esté `RESERVADA` y `OCUPADA` a la vez.
  5. Aplicar RLS y roles (`ADMIN_GLOBAL`, `GERENTE_SUCURSAL`, `MESERO`, `CAJERO`).
  6. Agregar tests unitarios, de base de datos y e2e.
- **Archivos/rutas:** `apps/api/src/modules/tables/**`, `apps/api/src/modules/reservations/**`, `apps/api/src/app.module.ts`, `apps/api/test/**`
- **Criterio de aceptación:** CRUD y transiciones válidas; reserva con aforo excedido o solapada devuelve 409; cross-tenant devuelve 404; tests verdes.
- **Evidencia:** Swagger actualizado, tests y prueba real con dos sucursales.
  - `apps/api/src/modules/tables/**` y `apps/api/src/modules/reservations/**` con DTOs, controladores y servicios.
  - `apps/api/src/common/sequences/**` + migración `20261027120000_secuencias_tenant` (tabla `secuencias` con RLS por empresa).
  - Tests: 88 unit (9 nuevos de mesas, 12 de reservas, 5 de secuencias), 32 e2e (16 nuevos) y 34 DB (7 nuevos) verdes.
  - Prueba real contra PostgreSQL 16 (`localhost:5433`): CRUD de mesas en dos sucursales, duplicado 409, aforo 409, solapamiento 409, bloqueo con reserva 409, liberación de mesa al cancelar la última reserva, `RSV-20261031-0001` por secuencia y aislamiento cross-tenant (404).

### AYCDS-20 - [31.0] API órdenes POS e inmutabilidad

- **Semana:** 9-10 | **Responsable:** David Piñarreta | **Estado Jira:** Listo | **Avance:** 100%
- **Descripción Jira:** "Captura comanda, envío cocina, bloquea anular en preparación RF-06 RF-07 CT-FG-02."
- **Qué se hizo:**
  1. Precio resuelto en el servidor: `CreateOrderDto` ya no acepta `precioUnitario` (400 con `forbidNonWhitelisted`); `OrdersService` validaba cada plato contra la lista de precios activa y usaba `combos.precio_fijo` para combos (AYCDS-22 lo pasó a consultas en lote, mismo criterio).
  2. `mesero_id` sale del JWT (`TenantContextService`), nunca del body.
  3. `numero_orden` sale de `SequencesService` (`ORD-000123`) sobre la tabla `secuencias` con RLS por empresa.
  4. La mesa pasa a `OCUPADA` al crear la orden y se libera (a `LIBRE`, o `RESERVADA` si queda reserva activa) al llegar a un estado terminal, sin pisar `MANTENIMIENTO`.
  5. `ANULADA` solo desde `POR_CONFIRMAR`: `EN_COCINA` y `LISTO` responden 400 y el trigger `trg_ordenes_inmutable` lanza `DB_ORDEN_ANULACION_TARDIA` (migración `20261028120000_ordenes_anulacion_estricta`).
  6. `PAGADA`/`CERRADA`/`ANULADA` son terminales (409) y toda alta y cambio de estado se registra en `auditoria`.
  7. Tests: 19 unit de `OrdersService`, e2e del contrato (precio inyectado 400) y spec DB con transiciones, anulación tardía y numeración única.
- **Archivos/rutas:** `apps/api/src/modules/orders/**`, `apps/api/src/modules/pricing/**`, `apps/api/src/common/sequences/**`, migración `20261028120000_ordenes_anulacion_estricta`, `apps/api/test/db/orders-pos.db-spec.ts`
- **Criterio de aceptación:** total calculado por el servidor; no se puede anular en preparación; orden pagada inmutable; mesa cambia de estado correctamente; tests verdes. **Cumplido.**
- **Evidencia:** 107 unit, 33 e2e, 40 DB y `lint`/`check-types`/`build` en verde; smoke real contra PostgreSQL 16 con dos órdenes concurrentes (`ORD-000002`/`ORD-000003`), precio inyectado rechazado con 400, anulación tardía 400, orden pagada 409, mesa liberada y cross-tenant 404.

### AYCDS-22 — [32.0] Optimizar Comanda alta concurrencia

- **Semana:** 9-10 | **Responsable:** Sonny De La Cruz | **Estado Jira:** Listo | **Avance:** 100%
- **Descripción Jira:** “Índices tablas pico almuerzo/cena RNF-03 + carga.”
- **Qué se hizo:**
  1. Script de carga Node puro (`apps/api/test/load/orders-load.mjs`): login `MESERO`, altas de 2 líneas en bucle cerrado con rampa y calentamiento, 4xx/5xx por status y muestreo de `pg_stat_activity` (conexiones totales/activas y **esperando lock**). Scripts `perf:seed`, `perf:reset` y `perf:load` en `apps/api/package.json`.
  2. Dataset reproducible: `db/scripts/perf/seed-perf.sql` genera 50 000 órdenes `PERF-%` + 150 000 líneas repartidas en 8 mesas; `reset-perf.sql` borra solo ese dataset. `explain-orders.sql` corre 6 `EXPLAIN (ANALYZE, BUFFERS)` como `fogoneria_rls` dentro de `BEGIN/ROLLBACK`, y `explain-bypassrls.sql` compara el mismo listado con estadísticas visibles.
  3. Línea base (solo altas, 50 concurrentes): 64–66 rps, p95 **1034–1092 ms**, 8–9 sesiones esperando lock. Causa: el upsert de `secuencias` se ejecutaba dentro de la transacción del request y retenía el lock de la fila `(empresa_id, tipo)` durante toda la comanda.
  4. Optimización: el folio pasa a **una sentencia autocommit en el pool de plataforma** (`prisma.raw`), fuera de la transacción del request; los cuatro `set_config` del contexto RLS se juntan en una sentencia; los precios se resuelven en lote (platos + combos + `precios_platos`, sin N+1 por línea); `DATABASE_POOL_MAX` queda configurable (default 10, se midió 20 sin mejora). Sin índices nuevos: el plan de escritura ya era correcto.
  5. Test de concurrencia real de folios (`test/db/sequences-concurrency.db-spec.ts`): 50 altas simultáneas sin repetir número, contador por empresa y series `ORD`/`RSV` independientes.
  6. Documentación de resultados, `EXPLAIN` y límites en `docs/explain-orders.md`; decisiones en `docs/decisiones.md`.
- **Archivos/rutas:** `apps/api/src/common/sequences/sequences.service.ts`, `apps/api/src/prisma/prisma.service.ts`, `apps/api/src/modules/orders/orders.service.ts`, `apps/api/src/config/env.validation.ts`, `apps/api/test/load/orders-load.mjs`, `apps/api/test/db/sequences-concurrency.db-spec.ts`, `db/scripts/perf/**`, `ops/perf/results/**`, `docs/explain-orders.md`
- **Criterio de aceptación:** carga reproducible; p95 dentro del umbral acordado (≤ 500 ms a 50 concurrentes); sin errores 5xx; mejoras documentadas. **Cumplido** en el escenario de altas: p95 307–326 ms, ~186 órdenes/s y 0 errores.
- **Evidencia:** 127 unit, 43 DB (3 nuevos), `lint`/`check-types`/`build` en verde; 6 corridas de 50 concurrentes (`ops/perf/results/final-escritura-c50-r*.json`), 2 de 25 y 2 de 10; `explain-before.txt` vs `explain-after.txt` con el mismo plan (no se agregaron índices). Hallazgo abierto: el listado del KDS bajo RLS no ve estadísticas y recorre ~50k filas (157 ms vs 0,075 ms con estadísticas); no se cambió la seguridad y queda documentado con opciones.

### AYCDS-25 — [33.0] App Mesero generar-estados-entregado

- **Semana:** 9-10 | **Responsable:** Joshua Chávez | **Estado Jira:** Listo (merge [PR #17](https://github.com/SebJoq21/fogoneria-system/pull/17) · `b56865b`) | **Avance:** 100%
- **Descripción Jira:** “UI tablet Generar pedido, Estados, Entregado PR-FG-21.”
- **Qué se hizo:**
  1. `apps/web/lib/orders-api.ts`: `listOrders`, `getOrder`, `createOrder`, `updateOrderStatus` sobre el BFF (el navegador nunca ve el access token). El payload no manda precio: `CreateOrderDto` lo rechaza con 400.
  2. `apps/web/lib/order-mapping.ts`: única traducción entre la API y la UI (7 estados, folio `ORD-000123` como id visible, `apiId` para los PATCH, `mesero_id` → `waiterId`, mesa UUID → `tableApiId`, modificadores → `notas` con el tope de 500 caracteres del DTO).
  3. `ModulesProvider`: con sesión real, `orders` sale de la API (`refreshOrders` con `ordersLoading`/`ordersError`); `createOrderFromAccount` hace `POST /orders` y marca las líneas enviadas solo si el servidor aceptó; `advanceOrder` hace `PATCH` y propaga el 400/409 del servidor. Sin sesión se conserva el modo demo.
  4. `MozoView`/`AccountPanel`: mesa real (`GET /tables`), envío asíncrono con resultado visible, "Mis comandas" por `mesero_id`, entregar y anular (solo `POR_CONFIRMAR`, el servidor decide), badge del canal en vivo y recarga por `order.created`/`order.updated`/`table.status`.
  5. `OrdersView` (KDS) dejó de mutar el estado local: confirmar y marcar listo usan `PATCH /orders/:id/status`, así el flujo mesero → cocina → mesero es real.
- **Archivos/rutas:** `apps/web/lib/orders-api.ts`, `apps/web/lib/tables-api.ts`, `apps/web/lib/order-mapping.ts`, `apps/web/components/dashboard/ModulesProvider.tsx`, `apps/web/components/erp/MozoView.tsx`, `apps/web/components/erp/OrdersView.tsx`, `apps/web/components/erp/mozo/**`, `apps/web/components/erp/useOrdersRealtime.ts`
- **Criterio de aceptación:** el mesero crea un pedido real, lo ve en cocina y lo marca entregado; no se usan mocks para órdenes; errores visibles. **Cumplido** (el mapa de mesas sigue en AYCDS-26).
- **Evidencia:** captura del flujo, tests web y prueba contra API/BD reales.

### AYCDS-26 — [34.0] Mapa mesas croquis + agenda reservas

- **Semana:** 9-10 | **Responsable:** Diego Arévalo | **Estado Jira:** Por hacer | **Avance:** 40%
- **Descripción Jira:** “Interactivo colores + realtime PR-FG-05 PR-FG-13.”
- **Qué debe hacerse:**
  1. Conectar `/app/mesas` y `/app/modulos/reservas` a la API de mesas/reservas.
  2. Mostrar colores por estado real: libre, ocupada, reservada.
  3. Implementar agenda por fecha con crear/editar/confirmar/cancelar/no-show.
  4. Bloquear/liberar mesa y reflejar el cambio en el mapa.
  5. Actualizar el mapa en tiempo real con los eventos de órdenes/mesas.
  6. Respetar permisos por rol.
- **Archivos/rutas:** `apps/web/app/app/mesas/**`, `apps/web/app/app/modulos/reservas/**`, `apps/web/components/erp/BookingsModule.tsx`, `SalonTablesView.tsx`, `BookingsWorkspace.tsx`, `apps/web/lib/tables-api.ts`, `apps/web/lib/reservations-api.ts`
- **Criterio de aceptación:** el mapa refleja la BD; una reserva bloquea la mesa; cancelar la libera; cambios visibles sin refrescar.
- **Evidencia:** captura de mapa/agenda, tests y prueba con dos sesiones.

### AYCDS-28 — [35.0] Integración Mesero-Cocina-Mesas e2e

- **Semana:** 10 | **Responsable:** Sebastián Chicata | **Estado Jira:** Por hacer | **Avance:** 0%
- **Descripción Jira:** “Coordina flujo venta completo RNF-02 video demo.”
- **Qué debe hacerse:**
  1. Integrar 14, 16, 20, 25 y 26 en un flujo único.
  2. Probar: mesero crea pedido → cocina recibe → marca listo → mesero entrega → mesa vuelve a libre.
  3. Agregar e2e de API y, si el tiempo alcanza, e2e de navegador.
  4. Grabar video demo de 2–3 minutos.
  5. Documentar el guion y las credenciales usadas.
- **Archivos/rutas:** `apps/api/test/**`, `apps/web/e2e/**` si se agrega Playwright, `docs/demo-flujo-venta.md`
- **Criterio de aceptación:** flujo completo sin refrescar; sin mocks; CI verde; video y guion adjuntos.
- **Evidencia:** test e2e, video, capturas y comentario en Jira.

---

## 5. Orden de dependencias y bloqueos

```text
16 API mesas/reservas ──► 26 Mapa/agenda ──┐
20 API órdenes POS ────► 25 App Mesero ────┼──► 28 e2e
14 Gateway WS ──────────────────────────────┘
22 Carga/índices ──────► 20 y 28
```

| Tarea bloqueada | Depende de | Motivo |
|---|---|---|
| 14 Gateway | 20 API órdenes | Necesita eventos y contrato de estados |
| 16 API mesas/reservas | 32/42/53 (hechas) | Modelo y RLS ya existen |
| 20 API órdenes | 16 API mesas + 60 pricing (hecha) | Necesita mesa y precio de servidor |
| 22 Carga | 20 API órdenes | Se mide sobre el flujo real de creación |
| 25 App Mesero | 20 + 14 | Necesita API y eventos |
| 26 Mapa/agenda | 16 + 14 | Necesita API y eventos |
| 28 e2e | 14, 16, 20, 25, 26 | Integra todo |

**Ruta crítica:** `16 → 20 → 14 → 25 → 28`.
**Paralelo:** `22` puede desarrollarse tras `20` en paralelo con `14`, pero se mergea después de `14`; `26` se desarrolla después de `25`.

### 5.1 Orden obligatorio de PRs (sin stacked)

**Regla:** un PR por tarea Jira, siempre desde `origin/development` actualizado. No se permite un PR apilado sobre otro: la base de cada PR es `development`, no la rama del PR anterior.

| Orden | PR | Tarea | Responsable | Rama | Condición para abrir/mergear |
|---|---|---|---|---|---|
| 1 | PR-1 | AYCDS-16 | David Piñarreta | `feat/aycds-16-mesas-reservas-david` | Base `development`; merge primero |
| 2 | PR-2 | AYCDS-20 | David Piñarreta | `feat/aycds-20-ordenes-pos-david` | Base `development` con PR-1 mergeado |
| 3 | PR-3 | AYCDS-14 | David Piñarreta | `feat/aycds-14-websockets-david` | Base `development` con PR-2 mergeado |
| 4 | PR-4 | AYCDS-22 | Sonny De La Cruz | `feat/aycds-22-carga-comandas-sonny` | Base `development` con PR-2 mergeado; puede desarrollarse en paralelo con PR-3; rebase antes del merge; merge después de PR-3 |
| 5 | PR-5 | AYCDS-25 | Joshua Chávez | `feat/aycds-25-app-mesero-joshua` | Base `development` con PR-3 mergeado |
| 6 | PR-6 | AYCDS-26 | Diego Arévalo | `feat/aycds-26-mapa-agenda-diego` | Base `development` con PR-5 mergeado; rebase antes del merge |
| 7 | PR-7 | AYCDS-28 | Sebastián Chicata | `feat/aycds-28-e2e-sebastian` | Base `development` con PR-6 mergeado; último PR |

**Reglas duras:**
- No crear una rama desde otra rama de tarea; siempre `git switch development`, `git pull` y luego `git switch -c <rama>`.
- No mergear un PR si su predecesor no está en `development`.
- Un PR = una tarea Jira = un objetivo verificable. No mezclar refactors no relacionados.
- Título sugerido: `[AYCDS-XX] <descripción corta>`.
- Si `development` avanzó, rebasar la rama y volver a correr CI antes del merge.
- El PR de documentación (`docs/tareas-semanas-9-10-sebastian`) va separado y se mergea antes de PR-1.

**Riesgos de conflicto:**
- `apps/api/src/app.module.ts`: PR-1, PR-2 y PR-3.
- `apps/api/src/modules/orders/orders.module.ts`: PR-2 y PR-3.
- `apps/web/components/dashboard/ModulesProvider.tsx`: PR-5 y PR-6.
- Migraciones/secuencias: PR-2 y PR-4.
- `docs/TAREAS-SEMANAS-9-10.md`: todos los PRs que actualicen avance; resolver a favor del estado real.

---

## 6. Checklist por responsable

### David Piñarreta — Backend
- [ ] **14** Gateway WebSockets + contrato de eventos
- [x] **16** API mesas/reservas + estados/aforo
- [ ] **20** API órdenes POS: precio servidor, número seguro, mesa, inmutabilidad

### Sonny De La Cruz — Base de datos
- [ ] **22** Script de carga, `EXPLAIN` y optimización de comandas

### Joshua Chávez — Frontend mesero
- [ ] **25** App Mesero real: generar, estados y entregado

### Diego Arévalo — Frontend mesas/reservas
- [ ] **26** Mapa interactivo + agenda de reservas realtime

### Sebastián Chicata — QA / DevOps
- [ ] **28** Integración e2e, video demo y cierre de evidencias
- [ ] **58/66** Smoke con Docker y firmas del acta

---

## 7. Definición de Terminado (DoD)

Una tarea se considera **Listo** solo si cumple:

1. El código compila (`pnpm build`).
2. Pasan `pnpm lint` y `pnpm check-types`.
3. Las pruebas nuevas pasan (`pnpm test`, `test:e2e`, `test:db` cuando aplique).
4. No quedan mocks en el flujo intervenido.
5. La funcionalidad está verificada con el stack real: `docker compose up --build`.
6. La documentación o README correspondiente está actualizada.
7. El cambio está commiteado y Jira tiene evidencia.
8. El PR sale de `development`, tiene un solo Jira y el CI está verde.
9. No se usó un PR apilado; la rama tiene como base `development`.

### Comandos de verificación

```bash
docker compose up -d --build
docker compose ps
curl http://localhost:3001/api/v1/health

pnpm lint
pnpm check-types
pnpm build
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter api test:db
```

---

## 8. Reglas para actualizar Jira

- Mover la tarea a **En curso** al iniciar.
- Mover a **Listo** solo con DoD cumplido y evidencia.
- Comentar en Jira: qué se hizo, archivos tocados y cómo verificarlo.
- Mantener labels `semana-X` y `sprint-3`.
- Actualizar esta bitácora y el porcentaje de la tabla maestra.

---

## 9. Bitácora de avance

| Fecha | Tarea | Responsable | Cambio realizado | Evidencia |
|---|---|---|---|---|
| 2026-10-26 | — | — | Línea base S9–S10: 7 tareas, 24% global | Este documento |
| 2026-10-26 | — | Sebastián Chicata | Revisión post-pull: `development` en `372ee0a`, PR #7–#9 mergeados, 0 PRs abiertos; se define el orden obligatorio de PRs sin stacked y ramas con el nombre del responsable | `git log`, `gh pr list`, sección 5.1 |
| 2026-10-26 | 14/16/20/22/25/26 | Sebastián Chicata | Revisión de código: no existen módulos API `tables`, `reservations` ni `realtime`; `MozoView` y `BookingsModule` siguen con estado local; `orders.service.ts` mantiene precio del cliente, `Date.now()` y anulación en preparación | `apps/api/src/app.module.ts`, `orders.service.ts`, `ModulesProvider.tsx` |
| 2026-10-28 | 16 | David Piñarreta | Cierra AYCDS-16: módulos `tables` y `reservations`, tabla `secuencias` con folios atómicos, estados de mesa derivados, aforo y solapamiento ±90 min en hora de Lima; 88 unit + 32 e2e + 34 DB verdes y prueba real con dos sucursales | PR-1 `feat/aycds-16-mesas-reservas-david`, `docs/decisiones.md` |
| 2026-10-28 | 20 | David Piñarreta | Cierra AYCDS-20: precio resuelto en servidor (`precioUnitario` fuera del DTO), `mesero_id` del JWT, `numero_orden` por secuencia, mesa `OCUPADA`/liberada, `ANULADA` solo desde `POR_CONFIRMAR` + trigger `DB_ORDEN_ANULACION_TARDIA`, auditoría y tests. Global 44% | PR [#12](https://github.com/SebJoq21/fogoneria-system/pull/12); 107 unit, 33 e2e, 40 DB; smoke con 2 órdenes concurrentes |
| 2026-10-28 | 14 | David Piñarreta | Cierra AYCDS-14 ([PR #13](https://github.com/SebJoq21/fogoneria-system/pull/13), merge `f1f7b2d`): gateway `/orders` con rooms por tenant/sucursal, ticket WS de 60 s (`scope: ws`, no abre la API HTTP), eventos `order.created`/`order.updated`/`table.status`, cliente web con backoff + dedupe y contrato en `docs/websockets.md`. Global 58% | 127 unit, 38 e2e (Socket.io real, aislamiento A/B), 40 DB, 55 web; smoke real 16/16 contra PostgreSQL 16; CI 40641677208 en verde |
| 2026-10-28 | 22 | Sonny De La Cruz | Cierra AYCDS-22: script de carga y dataset de 50k órdenes; línea base 1034–1092 ms p95 a 50 concurrentes por el lock del folio dentro de la transacción; folio en autocommit, `set_config` único y precios en lote → p95 307–326 ms, ~186 órdenes/s y 0 esperas de lock. Sin índices nuevos. Global 69% | 127 unit, 43 DB, `explain-before/after/bypassrls` en `ops/perf/results/`; `docs/explain-orders.md` |
| 2026-10-28 | 25 | Joshua Chávez | Implementa AYCDS-25 y abre [PR #17](https://github.com/SebJoq21/fogoneria-system/pull/17) para revisión: `lib/orders-api.ts` + `lib/tables-api.ts` + `lib/order-mapping.ts`; `MozoView`/`AccountPanel` crean la comanda real sin precio, avanzan estados y anulan solo `POR_CONFIRMAR`; `orders` del provider sale de la API; el KDS confirma y marca listo con `PATCH`. Global 77% | 72 tests web (17 nuevos de `orders-api`/`order-mapping`), 127 api, `lint`, `check-types` y `build` verdes; Jira en "En curso" con comentario de evidencia |
| 2026-10-28 | 25 | Joshua Chávez | CI del [PR #17](https://github.com/SebJoq21/fogoneria-system/pull/17) en verde (`Lint, tipos y pruebas`, run 40757839946, 1m53s); PR `MERGEABLE` y pendiente de revisión | Jira `AYCDS-25` en "En curso" con comentarios de evidencia |
| 2026-10-28 | 25 | Joshua Chávez | Mergeado [PR #17](https://github.com/SebJoq21/fogoneria-system/pull/17) en `development` (`b56865b`); AYCDS-25 a **Listo**. Global 77% (5 de 7 tareas) | CI `40757839946` en verde antes del merge |
