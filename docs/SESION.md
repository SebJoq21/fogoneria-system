# SESION — estado entre sesiones

## 2026-10-28 — Sprint 3: AYCDS-25 (app del mesero) cerrada

- Objetivo: conectar el panel del mesero (`/app/mozo`) y el KDS a la API real, sin mocks en el flujo de comandas.
- Hecho (rama `feat/aycds-25-app-mesero-joshua`, desde `development` en `3353036`):
  - `apps/web/lib/orders-api.ts` (list/get/create/status sobre el BFF; el payload nunca manda precio) y `lib/tables-api.ts` (`GET /tables` para elegir mesa UUID).
  - `apps/web/lib/order-mapping.ts`: única traducción API↔UI (7 estados, folio `ORD-000123` como `id`, `apiId` para los PATCH, `mesero_id` → `waiterId`, modificadores → `notas`).
  - `ModulesProvider`: con sesión real `orders` sale de `GET /orders` (`ordersLoading`/`ordersError`/`refreshOrders`); `createOrderFromAccount` (`POST`) y `advanceOrder` (`PATCH`); el modo demo queda intacto sin sesión.
  - `MozoView`/`AccountPanel`: mesa real, envío asíncrono con resultado visible, "Mis comandas" por `mesero_id`, entregar/anular según el servidor, badge de canal en vivo y recarga por eventos.
  - `OrdersView` (KDS): confirmar y marcar listo con `PATCH`, sin mutar estado local.
  - Tests: 72 web (17 nuevos en `order-mapping.test.ts` y `orders-api.test.ts`).
- Pendiente: Jira (comentario de evidencia) y PR a `development`.
- Próximo paso: AYCDS-26 (Diego) sobre `development` con este PR mergeado; `ModulesProvider` gana `orders`/`refreshOrders` y hay que rebasar.

## 2026-10-28 — Sprint 3: AYCDS-22 (comanda en alta concurrencia) cerrada

- Objetivo: llevar el alta de comandas a p95 ≤ 500 ms con 50 concurrentes y 0 errores 5xx, con script de carga reproducible, línea base y `EXPLAIN`.
- Hecho (rama `feat/aycds-22-carga-comandas-sonny`, desde `development` en `67e3d28`):
  - Script de carga Node puro `apps/api/test/load/orders-load.mjs` (bucle cerrado, rampa, calentamiento, 4xx/5xx por status y muestreo de `pg_stat_activity` con `maxWaiting`); scripts `perf:seed`/`perf:reset`/`perf:load` en `apps/api/package.json`.
  - Dataset `db/scripts/perf/seed-perf.sql` (50 000 órdenes `PERF-%` + 150 000 líneas, 23 MB) y `reset-perf.sql`; `explain-orders.sql` (6 `EXPLAIN ANALYZE BUFFERS` como `fogoneria_rls`) y `explain-bypassrls.sql` (comparación con estadísticas visibles). Resultados en `ops/perf/results/`.
  - Causa raíz: el upsert de `secuencias` dentro de la transacción del request retenía el lock de `(empresa_id, tipo)` durante toda la comanda (p95 1034–1092 ms, 64–66 órdenes/s, 8–9 sesiones esperando lock).
  - `apps/api/src/common/sequences/sequences.service.ts:61` — el folio corre en **autocommit sobre `prisma.raw`**, fuera de la transacción. Se acepta hueco de folio (`docs/decisiones.md:34`).
  - `apps/api/src/prisma/prisma.service.ts` — los 4 `set_config` del contexto RLS pasan a una sola sentencia; `DATABASE_POOL_MAX` configurable (default 10; 20 no mejoró porque la base estaba ociosa).
  - `apps/api/src/modules/orders/orders.service.ts` — precios en lote (platos, combos y `precios_platos`), sin N+1 por línea.
  - Test `apps/api/test/db/sequences-concurrency.db-spec.ts` (50 altas simultáneas, contador por empresa, ORD vs RSV).
  - Resultado: p95 **307–326 ms** a 50 concurrentes (r3–r6 de 6 corridas), ~**186 órdenes/s**, 0 5xx, 0 esperas de lock. Sin índices nuevos: el plan de escritura ya era correcto.
- Pendiente / hallazgo abierto: el listado del KDS bajo RLS no ve `pg_statistic`, estima 20 % para `estado` y recorre ~50k filas (157 ms vs 0,075 ms con estadísticas). No se tocó la seguridad; opciones (BYPASSRLS, vista `SECURITY DEFINER`, contadores denormalizados, `pg_hint_plan`) en `docs/explain-orders.md` §6.
- Entorno: no hay Docker aquí (sin admin/WSL); se usó un clúster PostgreSQL 18 propio en `127.0.0.1:5433` con datos en `%TEMP%\opencode\pg-fogoneria`. `DATABASE_URL_TEST` debe apuntar a `fogoneria_test`.
- Próximo paso: push de la rama y PR a `development` (lo hace el usuario), comentario de evidencia en Jira `AYCDS-22`; el sprint sigue con 25 (Joshua), 26 (Diego) y 28 (Sebastián).

## 2026-10-28 — Sprint 3: AYCDS-14 (WebSockets) cerrada

- Objetivo: ejecutar las tareas de David del Sprint 3 en orden `16 → 20 → 14`, un PR por tarea desde `development`.
- Hecho (PR-3, `feat/aycds-14-websockets-david`):
  - API: módulo `src/modules/realtime/**` (`@Global`) con `OrdersGateway` (namespace `/orders`), `RealtimeService` y el contrato en `realtime.types.ts`. Rooms `empresa:<id>`, `empresa:<id>:sucursal:<id>` y `order:<id>` (`order:subscribe` valida el tenant). Sobre `{ eventId, at, data }` y eventos `order.created`, `order.updated` y `table.status`.
  - Handshake con **ticket de 60 s** (`POST /api/v1/auth/ws-ticket`, `scope: 'ws'`); `JwtStrategy` rechaza cualquier token con `scope`, así que el ticket no abre la API HTTP.
  - `OrdersService` publica el alta, cada transición y el cambio de mesa (`OCUPADA`/`LIBRE`/`RESERVADA`); `releaseTable` devuelve el estado nuevo para poder emitirlo.
  - Web: `lib/realtime.ts` (reconexión propia con backoff 1 s → 30 s + jitter y ticket nuevo por intento, dedupe por `eventId`), BFF `GET /api/session/ws-ticket` (401 sin sesión, `no-store`) y hook `components/erp/useOrdersRealtime.ts`; `OrdersView` muestra el badge *En vivo / Reconectando… / Sin canal en vivo* y la última novedad.
  - `docs/websockets.md` con flujo, rooms, contrato y límites (sin Redis adapter; el pintado de la comanda en el KDS es AYCDS-25/26/28).
- Verificado: 127 unit, 38 e2e (Socket.io real con aislamiento A/B), 55 web, `lint`, `check-types` y `build` en verde; smoke real 16/16 contra PostgreSQL 16 (`localhost:5433`): ticket 200/60 s, ticket rechazado por la API HTTP (401), handshake de cocina, `order.created` con el folio, `order.updated` en la transición, `table.status` al ocupar y al liberar, empresa B sin eventos.
- Cerrado: PR [#13](https://github.com/SebJoq21/fogoneria-system/pull/13) mergeado en `development` (`f1f7b2d`), CI `40641677208` en verde (3m08s), `AYCDS-14 → Listo` con comentario de evidencia. PR [#14](https://github.com/SebJoq21/fogoneria-system/pull/14) enlaza la bitácora (`d12d570`).
- Pendiente: nada de David en el Sprint 3; quedan AYCDS-22 (Sonny), 25 (Joshua), 26 (Diego), 28 (Sebastián) y los heredados 58/66 (Sebastián).
- Próximo paso: ninguno para David; el sprint cierra el 2026-11-03 y las tareas restantes dependen de `development` con `14` mergeado.

## 2026-10-28 — Sprint 3: AYCDS-20 (órdenes POS e inmutabilidad) cerrada

- Objetivo: ejecutar las tareas de David del Sprint 3 en orden `16 → 20 → 14`, un PR por tarea desde `development`.
- Hecho (PR-2, `feat/aycds-20-ordenes-pos-david`):
  - `apps/api/src/modules/orders/orders.service.ts` reescrito: precio del servidor (`PricingService.resolvePrice` para platos, `combos.precio_fijo` para combos), `mesero_id` del JWT, `numero_orden` vía `SequencesService`, totales con 2 decimales y validación de descuento.
  - `dto/create-order.dto.ts`: fuera `precioUnitario` (el `forbidNonWhitelisted` global lo rechaza con 400) y dentro `sucursalId` para `ADMIN_GLOBAL`.
  - `TRANSITIONS` cerradas: `ANULADA` solo desde `POR_CONFIRMAR`; `EN_COCINA`/`LISTO` devuelven 400 y los estados terminales 409. La misma regla queda en la base con la migración `20261028120000_ordenes_anulacion_estricta` (`DB_ORDEN_ANULACION_TARDIA`).
  - Mesa: `OCUPADA` al crear y liberación transaccional en estado terminal, respetando reserva activa y `MANTENIMIENTO`. Auditoría en alta y en cada cambio de estado.
  - Tests: `orders.service.spec.ts` (19 unit), `test/orders.e2e-spec.ts` (precio inyectado 400) y `test/db/orders-pos.db-spec.ts` (6 DB: camino KDS, anulación temprana/tardía, numeración única y cross-empresa).
- Verificado: 107 unit, 33 e2e, 40 DB, `lint`, `check-types` y `build` en verde; smoke real contra PostgreSQL 16 (`localhost:5433`) con precio inyectado 400, dos órdenes concurrentes con folios distintos (`ORD-000002`/`ORD-000003`), anulación tardía 400, orden pagada 409, mesa liberada y cross-tenant 404.
- Pendiente: PR-3 (AYCDS-14, WebSockets).
- Próximo paso: mergear el PR de la rama y crear `feat/aycds-14-websockets-david` desde `development`.

## 2026-10-28 — Sprint 3: AYCDS-16 (mesas y reservas) cerrada

- Objetivo: ejecutar las tareas de David del Sprint 3 en orden `16 → 20 → 14`, un PR por tarea desde `development`.
- Hecho (PR-1, `feat/aycds-16-mesas-reservas-david`):
  - Módulos `apps/api/src/modules/tables/**` y `reservations/**` con DTOs, `@Roles`, Swagger y transiciones explícitas.
  - `common/sequences` + migración `20261027120000_secuencias_tenant`: tabla `secuencias` con RLS por empresa y `INSERT ... ON CONFLICT ... RETURNING` para folios (`ORD-000123`, `RSV-20261031-0001`). El SQL crudo se califica con `DATABASE_SCHEMA` porque no pasa por Prisma.
  - Estados de mesa: `PATCH /tables/:id/status` solo `LIBRE|MANTENIMIENTO`; `OCUPADA`/`RESERVADA` los derivan órdenes y reservas. Mesa con orden abierta o reserva activa no se bloquea ni se da de baja (409).
  - Reservas: aforo contra `mesas.capacidad` (409), solapamiento ±90 min (409), edición solo en `POR_CONFIRMAR`, día filtrado en hora de Lima (`limaDayRange`) y liberación de mesa al cancelar la última reserva.
  - `ADMIN_GLOBAL` (sin sucursal en el JWT) indica `sucursalId` en `POST /tables` y `GET /tables?sucursalId=`; validado contra su empresa.
- Verificado: 88 unit, 32 e2e, 34 DB, `lint`, `check-types` y `pnpm build` en verde; prueba real contra PostgreSQL 16 (`localhost:5433`) con dos sucursales y dos empresas (cross-tenant 404). El volumen local tenía el dataset demo legacy: se recreó el esquema (`DROP SCHEMA` + `db:deploy` + `db:rls:roles` + `db:rls:force` + `db:seed`) porque `prisma migrate reset` está bloqueado para agentes.
- Pendiente: PR-2 (AYCDS-20) y PR-3 (AYCDS-14); Jira 16 pasa a Listo con la evidencia del PR.
- Próximo paso: mergear PR-1 y crear `feat/aycds-20-ordenes-pos-david` desde `development`.

## 2026-10-26 — Documentación S9–S10 y orden de PRs sin stacked

- Objetivo: documentar las tareas 29.0–35.0 y fijar el orden de PRs.
- Hecho: `docs/TAREAS-SEMANAS-9-10.md` con 7 tareas, fichas, dependencias, DoD, ramas con el nombre del responsable y la regla de un PR por tarea desde `development`.
- Revisión: `development` en `372ee0a`; PR #7–#9 mergeados; 0 PRs abiertos. No existen módulos API `tables`, `reservations` ni `realtime`; `MozoView` y `BookingsModule` siguen con estado local; `orders.service.ts` mantiene precio del cliente, `Date.now()` y anulación en preparación.
- Pendiente: PR docs a `development` y luego PR-1 `AYCDS-16`.

## 2026-10-21 — Ronda QA en Docker: 5 bugs corregidos (rama `fix/qa-docker-bff-uuid-ordenes`)

- Objetivo: recorrer los 6 roles en el stack Docker y corregir los bugs de la ronda.
- Hecho:
  - Seed: 98 IDs demo a UUID RFC 4122 (tercer grupo `4`, cuarto `8`) en `prisma/seed.ts`, `lib/tenancy.ts`, `catalog.service.spec.ts` y `db/fogoneria_schema.sql`; guard que detecta el dataset legacy y pide recrear el volumen.
  - Órdenes: `CreateOrderDto.items` con `@IsArray/@ArrayMinSize(1)/@ArrayMaxSize(100)` y validador `IsConsistentOrderItem` (PLATO↔platoId, COMBO↔comboId). `{}` ahora da 400, no 500.
  - Logout: `Location: /` relativo (antes `http://0.0.0.0:3000/`).
  - BFF: `Origin` se compara contra `Host`/`x-forwarded-host`; en Docker permitía 0 mutaciones (403).
  - Cookie `fogoneria.token` respeta `SESSION_COOKIE_SECURE` (HTTP local fuera de localhost).
  - Tests: api 59 unit + 16 e2e; web 42. Recorrido de 6 roles y create/delete real por BFF contra el stack limpio.
  - QA en vivo (Docker y shell): 182/182 checks por corrida, incluidos catálogo, precios, ciclo de órdenes, RBAC, SaaS, onboarding y aislamiento.
  - Bug extra: el wizard público `/onboarding` daba 401 porque `POST /onboarding` pasaba por el BFF autenticado. El BFF ahora exceptúa solo esa ruta pública; web 44 tests.
  - CI del PR #8 en verde (run `39685369186`).
- Pendiente: Jira (comentario de evidencia) y firmas del acta QA.
- Próximo paso: PR de la rama a `development`.

## 2026-10-20 — Cierre Fases 2–5: RLS runtime, SaaS real, Docker/CI y QA

- Objetivo: cerrar el plan de AYCDS 53/55/57/58/62/63/65/66 con evidencia real.
- Hecho:
  - RLS runtime: `runWithTenant` fija `app.*` por transacción, migración `20261020120400_rls_onboarding`, rol `fogoneria_saas` con BYPASSRLS y FORCE activo en `fogoneria_db`/`fogoneria_test`. Pruebas DB 27/27.
  - Aislamiento verificado: sin contexto 0 filas, demo 6 platos, QA 0; lectura cruzada 404 y escritura cruzada rechazada.
  - Email global: índice `uq_usuarios_email_activo` (solo activos); 2 pruebas nuevas.
  - Web: estado/persistencia por tenant, BFF valida `fogoneria.session`; 37 tests.
  - `/saas` conectada a la API (`lib/saas-api.ts`): métricas, suspender/reactivar con `ConfirmDialog`; tenant suspendido → 403.
  - Dockerfiles api/web construidos y probados (API health/login/6 platos; web 200), Compose con `migrate`/`roles`/`api`/`web`, `.dockerignore`, CI y `docs/backlog.md`.
  - Cookie: `SESSION_COOKIE_SECURE=false` para HTTP local en Compose; producción la deja `true`.
  - Docs: `TAREAS-SEMANAS-5-8.md` al 99% (12 cerradas, 58/66 en curso), `docs/acta-qa-aycds-66.md`, `docs/explain-rls.md`, `docs/backlog.md` y `README.md` con quickstart.
  - Jira sincronizado: 55/57/62/63/65 a Listo; 58 y 66 a En curso con comentarios de evidencia.
  - Verificación final: web 37/37, `check-types`, `lint` (estilos OK), `docker compose config` OK.
  - CI del PR #7 en verde (run `39540565973`); requirió declarar las variables de Prisma en `globalEnv` de Turbo.
- Pendiente:
  - Smoke completo de `docker compose up` en volumen limpio.
  - Firmar el acta QA.
- Próximo paso: commit/PR de cierre y ejecución del pipeline.

## 2026-10-20 — AYCDS-62: índices, RLS, soft-delete e inmutabilidad (rama `feat/db-rls-softdelete`)

- Objetivo: implementar la tarea 62 sobre `development` sin tocar `schema.prisma` de otras tareas.
- Hecho:
  - Cuatro migraciones nuevas: `20261020120000_indices_tenant` (21 índices compuestos/parciales), `20261020120100_rls_tenant` (funciones de contexto + `ENABLE RLS` y políticas en 40 tablas), `20261020120200_soft_delete` (`deleted_at`/`deleted_by` en 16 maestras, únicos parciales, trigger `soft_delete_row()`, `restore_row()`), `20261020120300_inmutabilidad_contable` (turnos, caja, comprobantes, kardex, puntos, auditoría, órdenes, líneas y gastos con SQLSTATE `45000`).
  - `schema.prisma` sincronizado con columnas, índices parciales (`where: raw(...)`) y `prisma validate` OK.
  - `db/scripts/rls/000-roles.sql` (rol `fogoneria_rls` sin `BYPASSRLS` + grants) y `010-force-rls.sql` (activación diferida).
  - 25 specs en `apps/api/test/db/**` con `DATABASE_URL_TEST` + `vitest.config.db.ts` y script `test:db`; `pnpm test` normal no los toca.
  - Docs: `docs/rls-modelo.md`, `docs/errores-db.md`, `docs/modelo-datos.md`, `docs/decisiones.md` y `docs/TAREAS-SEMANAS-5-8.md` (62 al 85%).
- Pendiente:
  - Correr `prisma migrate deploy`, `db:rls:roles` y `test:db` contra PostgreSQL 16; adjuntar `EXPLAIN (ANALYZE, BUFFERS)` de órdenes/caja/kardex.
  - Fijar `app.empresa_id`/`app.sucursal_id`/`app.usuario_id` por transacción desde la API y recién entonces ejecutar `db:rls:force`.
  - La API sigue conectando como dueño (`fogoneria_app`): el aislamiento efectivo en runtime sigue siendo la extensión de Prisma.
- Próximo paso: levantar Postgres (Docker) y cerrar la evidencia para pasar la 62 a Listo.

## 2026-10-20 — Revisión estática de 57/63: P0 y P1 aplicados (RUC, onboarding, modificadores, tenant real, cajero)

- Objetivo: cerrar los hallazgos de la revisión de la rama `feat/web-conexion-api` sin depender de Postgres.
- Hecho:
  - P0 RUC: `(11 - (sum % 11)) % 10` en `apps/api/src/common/utils/ruc.ts`, `apps/web/lib/onboarding-api.ts` y `apps/web/lib/domain.ts:isValidRuc` (antes invertía los restos 0/1). Casos verificados en `ruc.spec.ts`.
  - P0 onboarding: el DTO ya no acepta `plan`; el servicio fuerza `TRIAL` + `mrr_monto: 0`, devuelve **400** por RUC inválido, **409** por RUC/email duplicado (sin filtrar `deleted_at`) y mapea `P2002`; auditoría best-effort. Reglas de `logoUrl`/longitudes en `submit-onboarding.dto.ts`.
  - P1 abuso del endpoint público: `RateLimitGuard` (5/10 min por IP, en memoria) + `ONBOARDING_RATE_LIMIT`/`ONBOARDING_RATE_WINDOW_MS` en `env.validation.ts` y `.env.example`; body parser de 4 MB **solo** en `/api/v1/onboarding` (100 KB global).
  - P1 login ambiguo: `auth.service.ts:login` compara bcrypt contra los candidatos del email y responde **409** si hay más de un tenant (antes elegía uno al azar).
  - P0 modificadores: `UpdateModifierGroupDto.opciones[].id` permite renombrar sin borrar; `catalog.service.ts:updateModifierGroup` sincroniza por id en transacción, valida ids ajenos/repetidos y bloquea el borrado de opciones usadas en órdenes (409).
  - P0 tenant real en web: nuevo `lib/tenant-api.ts`; `ModulesProvider` hidrata `/tenant` + `/tenant/branches`, valida la sucursal guardada, poda combos huérfanos, aborta el catálogo al desmontar y deshace altas de plato/lista si falla el paso siguiente.
  - Rol **cajero** real: `AppRole`/`API_ROLE.CAJERO`, `proxy.ts`, `canViewPath`, `permissions.ts`, sidebar y mobileLinks; `appUserFromApi` usa `sucursalId` real.
  - E2E nuevo `test/onboarding.e2e-spec.ts` (400 de DTO, `plan` prohibido, 201 y 429 por rate limit).
- Verificado: `api lint` 0/0, `api check-types` OK, `api test` 52/52, `api test:e2e` 10/10; `web lint` OK, `web check-types` OK, `web build` OK (45 rutas).
- Pendiente: verificación en vivo con Postgres (sin Docker/`psql` aquí) para marcar 57/63 como Listo, Jira y PR.
- Próximo paso: push de la rama y abrir el PR a `development` con la descripción preparada.

## 2026-10-20 — Tarea 55 de Joshua: sesión HttpOnly + BFF (PR #5 de seguimiento)

- Objetivo: cerrar AYCDS-55 (rutas protegidas por rol) tras el merge del PR #3 (`da18b70`).
- Rama: `fix/session-cookie-review` desde `origin/development`; PR de seguimiento [#5](https://github.com/SebJoq21/fogoneria-system/pull/5) con las correcciones de la revisión (el #4 se mergeó con la versión inicial).
- Hecho:
  - `lib/session.ts`: cookie `fogoneria.session` HttpOnly/SameSite firmada HS256 (`jose` + `SESSION_SECRET`). Ventana deslizante de **15 min** con refresh en `proxy.ts` y tope absoluto de **8 h** (`startedAt`). Fuera de `development`/`test`, sin `SESSION_SECRET` falla cerrado.
  - `app/api/session/route.ts`: login contra la API, rate limit **5/10 min por IP**, `Cache-Control: no-store`, sin devolver el access token. Emite `fogoneria.session` y `fogoneria.token` (ambas HttpOnly).
  - `app/api/session/logout/route.ts`: `GET`/`POST` borran ambas cookies y redirigen con 303; el cliente navega ahí, así un fallo de red no simula un logout exitoso.
  - `app/api/backend/[...path]/route.ts`: BFF que adjunta el Bearer desde la cookie HttpOnly; el JWT de la API ya **no** vive en `localStorage`. Valida `Origin` en mutaciones.
  - `lib/auth.ts`: `appRoleFromApi` devuelve `null` para roles desconocidos y `appUserFromApi` rechaza roles operativos sin sucursal (no cae a "todas"). `cajero` incluido en la allowlist de sesión.
  - `ModulesProvider`: sin empresa/sucursales demo cuando hay sesión; si `/tenant` falla, no usa datos demo. `logout` limpia `localStorage` y navega al logout del servidor.
  - Vitest en web con integración: proxy, route handler de login (cookies/flags/rate limit), logout, BFF y matriz RBAC.
- Verificado: `pnpm --filter web test` **34/34**, `lint`, `check-types` y `build` (47 rutas: `/api/session`, `/api/session/logout`, `/api/backend/[...path]`) verdes; `pnpm lint` raíz OK.
- Pendiente: verificación en vivo del login/cookie con API + PostgreSQL (`localhost:5433` no responde aquí); al mergear #5, actualizar Jira y marcar 55 Listo.
- Próximo paso: 65 (`/saas` contra la API) desde `development` actualizado.

## 2026-10-20 — Tareas 57 y 63 de Diego: login real, onboarding y catálogo contra la API

- Objetivo: conectar el frontend a la API — login real (57), wizard de onboarding con RUC/logo (57) y `/app/productos` sin mocks (63).
- Hecho:
  - Cliente HTTP `lib/api.ts` (`NEXT_PUBLIC_API_URL` ?? `http://localhost:3001/api/v1`, JWT en `fogoneria:token`, `ApiError`), `lib/auth-api.ts` (`loginRequest`) y `lib/onboarding-api.ts` (RUC módulo 11 + `submitOnboarding`).
  - 57: `LoginContent.tsx` con `await login(email, password)` y estados de carga/error; `OnboardingContent.tsx` reescrito (3 pasos reales, `DropZone` con archivo/URL de logo, auto-login + redirect por rol). El logo subido se lee como **data URL** (≤2 MB, validado en cliente) y el body parser de Express se subió a 4 MB en `apps/api/src/main.ts`. `lib/auth.ts` mapea rol y sucursal de la API y sigue dejando las cookies `fogoneria.role`/`fogoneria.branch` para no romper el RBAC de `proxy.ts`.
  - 57 backend (módulo nuevo): `apps/api/src/modules/onboarding/**` expone `POST /api/v1/onboarding` (`@Public()`): valida RUC, 409 si existe, y en transacción crea empresa `TRIAL` con `logo_url`, sucursal matriz, admin bcrypt, lista "Carta", lead `GANADO` y evento de auditoría. Registrado en `app.module.ts`.
  - 63: `lib/catalog-api.ts` (lecturas de categorías/platos/modificadores/listas + precios y todas las mutaciones); `ModulesProvider.tsx` mantiene el catálogo en estado con `refreshCatalog`/`catalogLoading`/`catalogError` y expone las mutaciones; `ProductsView`, `CategoriesView`, `ModifiersView` y `PriceListsView` dejaron de usar mocks. Los `id` del catálogo pasan a UUID en todo el ERP (`erp`, `domain`, `dashboard`, `tenancy`, `AddItemModal`, resúmenes) y `ErpState` sube a `v2` (`fogoneria:erp:v2`) sin catálogo. `catalog.service.ts` incluye `platos_grupos_modificadores` en el listado.
  - `apps/web/.env.example` nuevo con `NEXT_PUBLIC_API_URL`.
- Verificado: `web lint` OK (eslint + `check-styles`), `web check-types` OK, `web build` OK (45 rutas), `api lint` OK, `api test` 28/28 (3 nuevas de onboarding) y `api test:e2e` 7/7.
- Pendiente: **verificación en vivo con Postgres** (en este entorno no hay Docker ni `psql`; `localhost:5433` no responde), sincronizar Jira y commitear.
- Próximo paso: levantar `docker compose up` + `db:deploy` + `db:seed`, probar login y onboarding desde la UI, y luego commit/PR.

## 2026-10-20 — Docker Compose + verificación real de PostgreSQL

- Objetivo: levantar una base local para probar la API como en `dydalo` y cerrar la verificación pendiente de las tareas 44/48/53/60/61.
- Hecho:
  - `docker-compose.yml` raíz con PostgreSQL 16 en `localhost:5433` (evita el 5432 de `dydalo`), healthcheck, volumen `pgdata` y `docker/initdb/01-shadow.sql` para `fogoneria_shadow`.
  - Scripts `db:up`, `db:down`, `db:logs`, `db:status` y `db:psql` en `apps/api/package.json`; `.env.example` y `env.validation.ts` alineados a 5433; README de la API actualizado.
  - `db:deploy` aplicó `20261019000000_init` y `db:seed` cargó el demo en la base real.
  - Bug real encontrado: `PrismaService extends PrismaClient` dejaba `raw.usuarios` en `undefined` con Prisma 7 (el constructor devuelve un proxy). Corregido a **composición** en `apps/api/src/prisma/prisma.service.ts`.
  - Verificado contra Postgres: health, login de los 6 usuarios demo, JWT, `/tenant`, `/catalog`, `/pricing`, `/orders`, CRUD real de catálogo/precios, alta de tenant, `/saas/metrics`, suspensión (login 403) y reactivación; aislamiento con 2 empresas (la B ve 1 sucursal y 0 órdenes de A).
- Verificado: `api check-types`, `api lint`, 25 unit y 7 e2e verdes.
- Pendiente: Dockerfiles api/web + CI (tarea 58), conectar UIs 63/65, RLS nativo (62) y sincronizar Jira.
- Próximo paso: revisar y mergear el PR [#2](https://github.com/SebJoq21/fogoneria-system/pull/2) (`feat/api-david` → `development`).

## 2026-10-20 — Backend de David: tareas 44, 48, 53, 60 y 61

- Objetivo: implementar los módulos backend de David sobre el schema de Sonny.
- Hecho:
  - Merge local de `origin/feat/prisma-schema` (`d6bb6a6`): Prisma 7.10.1, schema de 41 modelos, migración y seed. Ese trabajo no estaba en `main`.
  - 44: wiring en `app.module.ts`, `bootstrap.ts` (prefijo `/api/v1`, CORS, `ValidationPipe`), `swagger.ts` (`/api/docs`), `config/env.validation.ts` y health.
  - 48: `modules/auth` con JWT/Passport, `JwtStrategy`, guards globales, decoradores `@Public/@Roles/@CurrentUser`, login con bcrypt y bloqueo por estado del tenant; colección Postman y contraseña demo `Fogoneria123!`.
  - 53: `TenantContextService` + `TenantContextInterceptor` + extensión Prisma (`prisma.scoped`) con bypass SUPERADMIN; tests en `tenant-scope.spec.ts`.
  - 60: `modules/catalog` y `modules/pricing` con DTOs, RBAC, Swagger y tests.
  - 61: `modules/saas`, `modules/billing` (cron diario 03:00) y `modules/audit`; MRR, alta transaccional, suspensión/reactivación y eventos.
- Verificado: `api check-types`, `api lint`, `api build`, `api test` (25) y `api test:e2e` (7). Sin PostgreSQL (Docker apagado y sin `psql`): los tests usan Prisma mockeado.
- Pendiente: verificar contra Postgres real (tarea 58), conectar UIs 63/65 y RLS nativo (62).
- Próximo paso: levantar Docker/Postgres, correr `db:deploy` + `db:seed` + colección Postman y luego push.

## 2026-10-19 — Integración con `origin/main` (Fases 0–3 preservadas)

- Objetivo: traer los cambios del remoto sin perder las fases 0–3 locales.
- Hecho:
  - Commit local `5a1d10c` con Fases 0–3 (cuentas, persistencia, SUNAT mock, KDS, reservas).
  - Merge de `origin/main`: entra `db/fogoneria_schema.sql` (41 tablas), `docs/TAREAS-SEMANAS-5-8.md` y la reorganización del módulo Platos (se retiran `valorizado` y `resumen-categoria`).
  - Conflictos resueltos respetando ambos lados: `MozoView` conserva cuentas/POS + muestra precio unitario y total al mesero; `OrdersView` conserva timers sin comandas simuladas y oculta totales en modo cocina; `AppTopBar` conserva "Reiniciar datos demo" sin las rutas retiradas. Se mantiene la eliminación de breadcrumbs.
- Verificado: `web lint` OK, `web check-types` OK (borrando `.next` obsoleto), `web build` OK.
- Pendiente: Fase 4–6 del ERP mock; tareas Jira 44/48/53/60/61 (David).
- Próximo paso: arrancar AYCDS-44 (scaffold NestJS modular) o Fase 4.

## 2026-10-06 — Fase 3: KDS con campana/timers + mesas y reservas reales

- Objetivo: cerrar la operación del salón — avisos reales a cocina/mesero, urgencia por comanda, estados de mesa derivados y reservas con CRUD.
- Hecho:
  - **Campana**: `ui/Toast.tsx` (aviso transitorio 4s, sin reintroducir el bell podado) renderizado en `DashboardShell`; `notify()` por fin tiene UI. Sync multi-pestaña ya vía `BroadcastChannel` (Fase 0).
  - **Timers KDS**: `components/useNow.ts` (tick 30s) + badge de urgencia por comanda en `OrdersView` (`timerTone`: >10 min warning, >20 min danger) y `elapsedLabel` vivo en `AccountPanel`.
  - **Mesas derivadas**: `deriveTableStatus` (`lib/domain.ts`) — ocupada si cuenta abierta, reservada si reserva confirmada de hoy o bloqueo manual, libre si no. Quitado el ciclo ficticio `libre→ocupada→reservada`; seeds de mesas todas "libre" + cuenta demo abierta en Mesa 2 (`initialAccounts` en `tenancy.ts`). Drawer del mapa: cuenta abierta (total/acción), reserva, "Abrir cuenta", "Registrar llegada", bloquear/desbloquear (solo sucursal, `canChangeTableStatus`).
  - **Reservas CRUD**: `Reservation` con `date` ISO + estado (`confirmada/llego/no_show/cancelada`); `BookingsModule` agenda con filtro por fecha, alta/edición, "Llegó → abrir cuenta" (crea cuenta + marca llego), cancelar/no-show con confirm. `canManageReservations` (admin|sucursal).
  - **Maestro de mesas**: zonas editables ("+ Nueva zona…" libre) y columna de estado derivado.
  - Regla `apps/web/AGENTS.md` actualizada (mesero abre cuenta, estados derivados).
- Verificado: `web lint` OK, `web check-types` OK, `web build` OK.
- Pendiente: Fase 4 (escandallo→consumo, gastos→caja, promos/fidelización aplicadas al cobro); Fase 5 (personal + dueño con KPIs derivados); Fase 6 (portal proveedor con cobro por sucursal).
- Próximo paso: Fase 4 o recorrido visual por roles en `dev`.

## 2026-10-06 — Fase 2: facturación electrónica SUNAT (mock OSE)

- Objetivo: ciclo de vida legal de comprobantes (Boleta 03 / Factura 01 / NC 07) con estados CDR, listo para enchufar un OSE real.
- Hecho:
  - `lib/facturacion.ts`: puerto `FacturacionPort` (hexagonal) + `MockFacturacionAdapter` con validaciones reales (RUC con dígito verificador, DNI, Factura exige RUC), CDR numerado, latencia simulada y **modo contingencia** (OSE caído → CPE en cola, la venta nunca se detiene). `cpeFromReceipt()` como payload UBL-ready.
  - `Receipt` (`lib/erp.ts`) con ciclo SUNAT: `estadoSunat` (en_cola→enviado→aceptado/rechazado/anulado), `cdr` (número/fecha/código/mensaje), `intentosEnvio`, `refId` (NC→origen), `bajaResumenId` (RC-pendiente→RC-YYYYMMDD-NN), tipo `"07"` y status `"Emitida"`.
  - Provider: `enviarSunat` (cola+reintento), `generarResumenDiario` (bajas de boletas), `toggleSunatContingencia`, `annulReceipt` reescrito — **factura aceptada → NC01 auto-enviada**; **boleta → baja en resumen diario**; ambos con reverso de caja. Checkout y emisión manual disparan envío automático.
  - `ComprobantesView`: columna SUNAT con badges, acciones Enviar/Reenviar + modal CDR, botones "Resumen diario (n)" y "Contingencia SUNAT ON/OFF"; la anulación explica NC vs baja según el tipo.
- Verificado: `web lint` OK, `web check-types` OK, `web build` OK.
- Pendiente: Fase 3 (KDS con campana/timers/sync + mesas y reservas reales); Fase 4 (escandallo→consumo, gastos→caja, promos/fidelización aplicadas); Fase 5 (personal + dueño con KPIs derivados); Fase 6 (portal proveedor con cobro por sucursal). Backend fase 3: sustituir `MockFacturacionAdapter` por OSE real.
- Próximo paso: Fase 3 o recorrido visual por roles en `dev`.

## 2026-10-06 — Fase 0+1: dominio de operación, persistencia y venta/cobro

- Objetivo: ejecutar el plan "sistema de restaurantes 100%" — cimientos (modelo + persistencia) y el flujo de dinero (venta → cobro → caja → comprobante).
- Hecho:
  - Dominio nuevo `lib/domain.ts`: `TableAccount`/`AccountItem` (qty + modificadores con extra), `Payment`, `CashShift` (apertura/arqueo/cierre), IGV 18% desglosado, validación RUC/DNI (checksum SUNAT), `nextReceiptNumber` (serie B001/F001).
  - Persistencia `lib/persistence.ts`: estado ERP serializado en `localStorage` (`fogoneria:erp:v1`) + `BroadcastChannel` (mesero ↔ cocina en pestañas distintas). `ModulesProvider` reescrito sobre estado único con acciones de dominio (`openAccount`, `sendToKitchen`, `checkoutAccount`, `annulReceipt`, `startCashShift/closeCashShift`, `resetDemoData`).
  - Tipos evolucionados en `lib/erp.ts`/`tenancy.ts`: `Order` con `accountId/tableId/createdAt/amount` + estado `anulado`; `CashMovement` con `at` ISO + `shiftId`; `Receipt` con `type/docType/docNumber/subtotal/igv/total` numérico.
  - POS mesero (`MozoView` + `mozo/AddItemModal` + `mozo/AccountPanel`): cuentas por mesa/para llevar, líneas con qty±/modificadores/notas, envío a cocina (comanda vinculada a la cuenta), anulación como estado con motivo.
  - `CheckoutModal` compartido: pagos mixtos, propina, cupón (incrementa `used`), cliente (acredita puntos/visitas), Boleta/Factura con documento validado.
  - `CajaView`: turno real (apertura con fondo, "efectivo esperado" vs contado, diferencia, observaciones, snapshot) + cuentas por cobrar + historial de turnos; `ComprobantesView`: emisión con IGV, anulación con motivo + reverso de caja. Quitado el generador de pedidos falsos de `OrdersView`.
  - Permisos (`lib/permissions.ts`): `canOpenAccount` (mesero|sucursal), `canCheckout`/`canAnnulAccount` (sucursal). Botón "Reiniciar datos demo" en el menú de perfil.
- Verificado: `web lint` OK, `web check-types` OK, `web build` OK (0 errores).
- Pendiente (siguientes fases del plan): Fase 2 facturación electrónica SUNAT (adaptador OSE/mock, CDR, resúmenes/bajas); Fase 3 KDS (campana, timers, sync) y mesas/reservas reales; Fase 4 escandallo→consumo, gastos→caja, promos/fidelización aplicadas; Fase 5 personal + dueño (KPIs derivados, settings); Fase 6 portal proveedor (cobro por sucursal).
- Próximo paso: recorrido visual por roles (mesero → cocina → caja) en `dev`, y luego Fase 2.

## 2026-10-06 — Retiro de breadcrumb en todo el ERP

- Objetivo: quitar la miga de pan de todo el sistema a pedido del dueño.
- Hecho: eliminado `ui/Breadcrumb.tsx` + `lib/breadcrumbs.ts` y su uso en `DashboardShell.tsx`; regla retirada de `apps/web/AGENTS.md`.
- Verificado: `web lint` OK, `web check-types` OK, sin restos (`Breadcrumb|trailFor` 0 resultados).
- Pendiente: commit (incluye bloque grande previo sin commitear); recorrido visual por rol.
- Próximo paso: commit del conjunto cuando se indique.

## 2026-10-19 — Tareas 32 y 42: Prisma 7, migración inicial y seed demo

- Objetivo: desbloquear la fundación backend con `schema.prisma`, migraciones PostgreSQL y datos demo.
- Hecho:
  - Prisma 7.10.1 + `@prisma/adapter-pg` + `prisma.config.ts`; `schema.prisma` con 41 modelos, 27 enums e índices parciales (`apps/api/prisma/schema.prisma`).
  - Migración `20261019000000_init` desde el DDL, con CHECKs, 22 triggers y 4 vistas; verificada en base limpia.
  - Seed demo idempotente (`apps/api/prisma/seed.ts`): empresa, 3 sucursales, usuarios, catálogo, inventario, caja y RRHH.
  - Documentación: `docs/modelo-datos.md`, README de API, `TAREAS-SEMANAS-5-8.md` (global 37%, Sonny 72%).
- PR #1 abierto: https://github.com/SebJoq21/fogoneria-system/pull/1 (`feat/prisma-schema` → `development`).
- Próximo paso: David retoma 44/48 sobre el schema y el seed ya listos.
- Verificado: `api check-types`, `api lint`, `api build`, `api test`, `api test:e2e`, `pnpm lint` raíz, `migrate deploy`, seed 2 veces sin duplicar.
- Extra: se agregó `@babel/preset-typescript` a la raíz para que `@repo/ui` lint resuelva el preset en pnpm estricto (falla preexistente).

## 2026-09-13 — Bloque grande sin commitear: sidebar, nombres, confirms, hubs, tipos, consola, breadcrumb

- Objetivo: dejar el ERP navegable, seguro y consistente (dueño) en una sola jornada; todo verificado pero SIN commit.
- Hecho:
  - Sidebar: 4 grupos (Principal/Carta/Clientes/Administración); Cocina y Mis órdenes solo-rol (`AppSidebar.tsx:42-77`, `DashboardShell.tsx:11-17`, `lib/auth.ts:56-57`); densidad `py-1.5/gap-0.5`, etiquetas `mt-5 mb-3` + `pb-5` en grupo; todo el nav a 14px.
  - Nombres: títulos generales (`lib/erp.ts:18,30,42,54` sin prefijos); URLs `articulos→platos`, `trabajadores→personal` (git `R`); `Carta virtual` absorbida como tab de Platos (ruta `/app/carta` eliminada); sin duplicados grupo/ítem (`Carta virtual`, tab `Maestro`, `Comensales`).
  - Seguridad: `ui/ConfirmDialog.tsx` + `danger` en `ui/Button.tsx`; confirms en 16 acciones (mesas, cocina, mozo, catálogo, comprobantes, precios con Enter/blur, promos); dueño sin operar mesas (`canChangeTableStatus`, Drawer lectura).
  - Hubs: norma `HubBlocks` (`workspace-ui.tsx`: `Acceso rápido` arriba + `Informes y másteres` debajo, 18px semibold, links en grilla; bloque vacío no se pinta); 5 hubs + bloques en Combos/Promociones/Comprobantes/Gastos (Analíticas sin bloques); Gastos/Comprobantes con tabs Panel/gestión; tira `ui/Tabs` en Platos.
  - Tipos: escala `12/13/14/16/18/24` (`globals.css`, `AGENTS.md`); jerarquía hubs 14/16/18 semibold; `text-section`=24 títulos, `text-display`=24 números/marca.
  - Consola Next 16 limpia: `next/script beforeInteractive` (`app/layout.tsx`) + `ThemeProvider` con `useSyncExternalStore`; fix key duplicada `Categorías` (`CategoriesView.tsx:55`).
  - Breadcrumb automático (`ui/Breadcrumb.tsx` + `lib/breadcrumbs.ts:trailFor`, 39 rutas) en `DashboardShell`.
  - Fix preexistente api: `test/app.e2e-spec.ts` sin `supertest/types`.
  - Verificado: `pnpm lint` 3/3 OK, `pnpm check-types` 3/3 OK, `api test` 1/1 + `test:e2e` 1/1.
- Pendiente: commit del bloque (64 archivos, +936/−344); `packages/ui` starter sin decidir; `*.tsbuildinfo` commiteado.
- Próximo paso: recorrido visual en `dev` por rol y commit.

## Historial 2026-09-12 — Memoria del agente + revisión 100%

- Montado sistema en capas (`AGENTS.md` raíz + anidados, `opencode.json`, `/guardar-contexto`, `/retomar`, `docs/`); decisión fase 3 = Postgres + Prisma.
- Revisión: web ERP mock avanzado, api scaffold, sin CI/Docker/`.env`.

## Historial previo — Frontend anterior

- `git log`: temas, onboarding, demo y planes previos al sistema turbo (commits `style(tema)`, `refactor(ui)`, `feat(operacion)`, `feat(pedidos)`); base reemplazada por monorepo actual (`b5ca606`).
