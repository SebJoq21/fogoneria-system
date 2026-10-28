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
| Cerradas (Listo) | **2** |
| En curso | **0** |
| Por hacer | **5** |
| Avance global (promedio simple) | **44%** |
| Avance funcional end-to-end | **≈28%** |

**Diagnóstico:** la base de autenticación, RLS, catálogo, precios y órdenes ya existe. Sin embargo, el flujo Semanas 9–10 no está conectado: la UI de mesero, KDS, mesas y reservas trabaja con estado local/mocks, no hay API de mesas/reservas, no hay WebSockets y la API de órdenes todavía confía en el precio enviado por el cliente. El objetivo es cerrar el flujo **mesero → cocina → mesero → mesa**, con estados en tiempo real y pruebas end-to-end.

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
| S9 | 14, 16, 20, 22, 25, 26 | 51% |
| S10 | 28 y cierre de 16/20/25/26 | 0% |
| **Global** | **7 tareas** | **44%** |

### Avance por responsable

| Responsable | Tareas | Avance personal |
|---|---|---|
| David Piñarreta | 14, 16, 20 | 67% |
| Sonny De La Cruz | 22 | 25% |
| Joshua Chávez | 25 | 40% |
| Diego Arévalo | 26 | 40% |
| Sebastián Chicata | 28 | 0% |

---

## 3. Tabla maestra de tareas

| Jira | Tarea | Sem. | Responsable | Estado Jira | Avance | Ya existe | Falta |
|---|---|---|---|---|---|---|---|
| AYCDS-14 | [29.0] Gateway WebSockets Mesero-Cocina | 9 | David Piñarreta | Por hacer | 0% | `OrdersService.updateStatus` con transiciones; KDS `OrdersView` con estado local | Gateway Socket.io, autenticación WS, rooms por tenant/sucursal, eventos de comanda, cliente web y pruebas |
| AYCDS-16 | [30.0] API mesas reservas Libre-Ocupada-Reservada | 9-10 | David Piñarreta | Listo | 100% | Módulos API `tables` y `reservations` (CRUD, estados manuales vs derivados, aforo ±90 min, hora de Lima, folios por secuencia); RLS por empresa con `secuencias`; tests unit/e2e/db; UI `BookingsModule` y `SalonTablesView` | — (conectar la UI a la API queda en AYCDS-26) |
| AYCDS-20 | [31.0] API órdenes POS e inmutabilidad | 9-10 | David Piñarreta | Listo | 100% | Precio resuelto en servidor, `mesero_id` del JWT, `numero_orden` por secuencia, mesa `OCUPADA`→liberada en estado terminal, `ANULADA` solo desde `POR_CONFIRMAR` (API 400 + trigger `DB_ORDEN_ANULACION_TARDIA`), auditoría; 19 unit + e2e + 6 DB | — |
| AYCDS-22 | [32.0] Optimizar Comanda alta concurrencia | 9-10 | Sonny De La Cruz | Por hacer | 25% | Índices `idx_ordenes_tenant_sucursal_estado`, `idx_ordenes_tenant_fecha`, `idx_detalles_orden`; baseline en `docs/explain-rls.md` | Script de carga, línea base de comandas, `EXPLAIN`, optimización y documentación de p95/errores |
| AYCDS-25 | [33.0] App Mesero generar-estados-entregado | 9-10 | Joshua Chávez | Por hacer | 40% | `MozoView`, `AccountPanel`, `AddItemModal`; UI de cuentas y estados | Conectar a API real, crear pedido, avanzar estados, marcar entregado, anular pendiente, layout tablet y tests |
| AYCDS-26 | [34.0] Mapa mesas croquis + agenda reservas | 9-10 | Diego Arévalo | Por hacer | 40% | Mapa/agenda en `BookingsModule`, `SalonTablesView` y `/app/mesas`; CRUD local | API real, estados en vivo, reservas por fecha, bloqueo/liberación y permisos |
| AYCDS-28 | [35.0] Integración Mesero-Cocina-Mesas e2e | 10 | Sebastián Chicata | Por hacer | 0% | Suites unit/DB/e2e existentes; CI verde | Flujo completo mesero → KDS → entregado, prueba e2e, guion y video demo |

---

## 4. Fichas por tarea

### AYCDS-14 — [29.0] Gateway WebSockets Mesero-Cocina

- **Semana:** 9 | **Responsable:** David Piñarreta | **Estado Jira:** Por hacer | **Avance:** 0%
- **Descripción Jira:** “Socket.io sincronización comandas RNF-02 RDES-02 eventos docs.”
- **Qué debe hacerse:**
  1. Instalar `@nestjs/websockets`, `@nestjs/platform-socket.io` y `socket.io` en la API.
  2. Crear `OrdersGateway` con namespace `/orders`, rooms `empresa:<id>:sucursal:<id>` y `order:<id>`.
  3. Autenticar el handshake con JWT y validar tenant/sucursal.
  4. Emitir eventos al crear orden, cambiar estado y marcar listo/entregado.
  5. Definir contrato de eventos y documentarlo en `docs/websockets.md`.
  6. Implementar cliente/reconexión en la web y pruebas de gateway.
- **Archivos/rutas:** `apps/api/src/modules/orders/orders.gateway.ts`, `apps/api/src/modules/orders/orders.module.ts`, `apps/api/src/app.module.ts`, `apps/web/lib/realtime.ts`, `apps/web/components/erp/OrdersView.tsx`, `docs/websockets.md`
- **Criterio de aceptación:** el KDS recibe la comanda sin refrescar; reconexión sin duplicados; solo recibe eventos de su tenant/sucursal; contrato documentado.
- **Evidencia:** prueba de gateway + captura de dos navegadores (mesero y cocina), logs de eventos y documento de contrato.

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
  1. Precio resuelto en el servidor: `CreateOrderDto` ya no acepta `precioUnitario` (400 con `forbidNonWhitelisted`); `OrdersService` usa `PricingService.resolvePrice` para platos y `combos.precio_fijo` para combos, validando existencia y estado activo.
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

- **Semana:** 9-10 | **Responsable:** Sonny De La Cruz | **Estado Jira:** Por hacer | **Avance:** 25%
- **Descripción Jira:** “Índices tablas pico almuerzo/cena RNF-03 + carga.”
- **Qué debe hacerse:**
  1. Crear un script de carga reproducible para creación de comandas en pico.
  2. Medir línea base: latencia p50/p95, errores 5xx y conexiones.
  3. Revisar `EXPLAIN (ANALYZE, BUFFERS)` de las consultas de orden/detalle/mesa.
  4. Ajustar índices o queries solo si el plan lo justifica.
  5. Documentar resultados antes/después en `docs/explain-orders.md`.
- **Archivos/rutas:** `apps/api/test/load/**` o `ops/load/**`, `docs/explain-orders.md`, migración de índices si aplica
- **Criterio de aceptación:** carga reproducible; p95 dentro del umbral acordado; sin errores 5xx; mejoras documentadas.
- **Evidencia:** script, salida de carga, `EXPLAIN` y conclusión técnica.

### AYCDS-25 — [33.0] App Mesero generar-estados-entregado

- **Semana:** 9-10 | **Responsable:** Joshua Chávez | **Estado Jira:** Por hacer | **Avance:** 40%
- **Descripción Jira:** “UI tablet Generar pedido, Estados, Entregado PR-FG-21.”
- **Qué debe hacerse:**
  1. Conectar `MozoView` y `AccountPanel` a la API real de órdenes.
  2. Crear pedido desde la cuenta/mesa y enviarlo a cocina.
  3. Mostrar estados `POR_CONFIRMAR`, `EN_COCINA`, `LISTO`, `ENTREGADO`.
  4. Permitir marcar entregado y anular solo si está `POR_CONFIRMAR`.
  5. Agregar layout tablet, estados de carga/error y actualización por WebSocket.
  6. Reemplazar el estado local de órdenes por datos de la API.
- **Archivos/rutas:** `apps/web/app/app/mozo/page.tsx`, `apps/web/components/erp/MozoView.tsx`, `apps/web/components/erp/mozo/**`, `apps/web/lib/orders-api.ts`, `apps/web/components/dashboard/ModulesProvider.tsx`
- **Criterio de aceptación:** el mesero crea un pedido real, lo ve en cocina y lo marca entregado; no se usan mocks para órdenes; errores visibles.
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
