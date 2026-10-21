# Tareas pendientes — Semanas 5 a 8 (Jira AYCDS)

**Proyecto:** Automatización y Control de Software — ERP Fogonería
**Fuente:** Jira `AYCDS` (https://proyectouniversidad.atlassian.net/jira/software/projects/AYCDS)
**Sprints:** Sprint 1 y Sprint 2
**Rango:** Semanas 5 a 8 (tareas 15.0 a 28.0)
**Repositorio de trabajo:** `fogoneria-system` (monorepo pnpm + Turbo: `apps/api`, `apps/web`, `db/`)
**Fecha de corte:** 2026-10-20
**Elaborado por:** Sebastián Chicata

---

## 1. Resumen ejecutivo

| Indicador | Valor |
|---|---|
| Tareas del rango | **14** |
| Cerradas (Listo) | **12** (AYCDS-32, 42, 44, 48, 53, 55, 57, 60, 61, 62, 63, 65) |
| En curso | **2** (AYCDS-58 90%, AYCDS-66 95%) |
| Por hacer | **0** |
| Avance global (promedio simple) | **99%** |
| Avance funcional end-to-end | **≈85–90%** |

**Diagnóstico:** el sistema está conectado de punta a punta. Frontend Next.js (47 rutas), API NestJS, PostgreSQL 16 con RLS nativo y consola SaaS real. Verificado contra la base real: login, onboarding, catálogo, precios, aislamiento cross-tenant, suspensión/reactivación y email global. Dockerfiles multi-stage y workflow CI creados; queda ejecutar el pipeline en GitHub, el smoke completo de Compose y adjuntar `EXPLAIN` como evidencia de rendimiento.

> **Advertencia:** AYCDS-58, 62 y 66 están funcionalmente implementadas, pero se mantienen "En curso" hasta correr el CI en GitHub, completar el smoke de `docker compose up` y firmar el acta QA. La 63 y 65 ya consumen las APIs 60 y 61 y fueron verificadas en vivo.
>
> **Jira:** sincronizar manualmente AYCDS-44/48/53/55/57/60/61/63/65 con la evidencia de esta bitácora.

---

## 2. Metodología del porcentaje

- El **% de avance** se estima por **evidencia real en el código**, no por el estado en Jira.
- Se usa **promedio simple por tarea** (todas las tareas pesan igual), según lo acordado por el equipo.
- La columna **"Ya existe"** indica lo verificado en el repositorio; **"Falta"** indica la brecha para cerrar la tarea.
- Los porcentajes son estimaciones de planificación y deben actualizarse en la bitácora (sección 9).

### Avance por semana

| Semana | Tareas | Avance |
|---|---|---|
| S5 | 32, 44, 55 | 100% |
| S5-6 | 48, 57, 58 | 97% |
| S6 | 42, 53 | 100% |
| S7 | 62 | 100% |
| S7-8 | 60, 61, 63, 65 | 100% |
| S8 | 66 | 95% |
| **Global** | **14 tareas** | **99%** |

### Avance por responsable

| Responsable | Tareas | Avance personal |
|---|---|---|
| David Piñarreta | 44, 48, 53, 60, 61 | 100% |
| Sonny De La Cruz | 32, 42, 62 | 100% |
| Joshua Chávez | 55, 65 | 100% |
| Diego Arévalo | 57, 63 | 100% |
| Sebastián Chicata | 58, 66 | 93% |

---

## 3. Tabla maestra de tareas

| Jira | Tarea | Sem. | Responsable | Estado Jira | Avance | Ya existe | Falta |
|---|---|---|---|---|---|---|---|
| AYCDS-32 | [15.0] Modelo datos `schema.prisma` ERP/CRM | 5 | Sonny | Listo | 100% | `schema.prisma` (41 modelos, 27 enums), `prisma.config.ts`, ER en `docs/modelo-datos.md` | — |
| AYCDS-44 | [17.0] Setup modular NestJS Auth/Tenant/Orders | 5 | David | Listo | 100% | Módulos auth/tenant/orders/catalog/pricing/saas/billing, `PrismaService`, `ConfigModule` validado, `ValidationPipe`, prefijo `/api/v1`, health y Swagger | — |
| AYCDS-55 | [20.0] Setup Next.js rutas protegidas por rol | 5 | Joshua | Listo | 100% | 47 rutas, `proxy.ts`, RBAC de UI, cookie HttpOnly firmada + BFF `/api/backend`, logout server-side y 37 tests; login verificado en vivo | — |
| AYCDS-48 | [18.0] Auth JWT Passport + estado Tenant | 5-6 | David | Listo | 100% | JWT/Passport, `JwtAuthGuard`/`RolesGuard` globales, login valida usuario y estado del tenant, seed con bcrypt, tests unit/e2e, colección Postman | — |
| AYCDS-57 | [21.0] Login y Onboarding logo/RUC | 5-6 | Diego | Listo | 100% | Login real, wizard de 3 pasos con RUC (módulo 11), logo, alta transaccional y auto-login; onboarding verificado contra PostgreSQL | — |
| AYCDS-58 | [22.0] Kanban, CI y Docker Compose | 5-6 | Sebastián | En curso | 90% | Dockerfiles multi-stage api/web, Compose db+migrate+roles+api+web, workflow CI, `.dockerignore` y `docs/backlog.md`; imágenes api/web construidas y probadas | Correr CI en GitHub y smoke completo de `docker compose up` en volumen limpio |
| AYCDS-42 | [16.0] Postgres migraciones y seed demo | 6 | Sonny | Listo | 100% | Migración `20261019000000_init`, `prisma/seed.ts` idempotente, scripts `db:*` | — |
| AYCDS-53 | [19.0] Middleware RLS `tenant_id`/`branch_id` | 6 | David | Listo | 100% | `TenantContextService` + `runWithTenant` fija contexto por transacción; extensión Prisma, bypass SUPERADMIN, aislamiento y escritura cruzada probados con 2 empresas | — |
| AYCDS-62 | [25.0] Índices RLS y triggers soft-delete | 7 | Sonny | Listo | 100% | 7 migraciones, RLS con FORCE activo, roles `fogoneria_rls`/`fogoneria_saas`, 27 pruebas DB, soft-delete, inmutabilidad y `EXPLAIN` documentado | — |
| AYCDS-60 | [23.0] API catálogo maestro y PriceList | 7-8 | David | Listo | 100% | CRUD de categorías, platos y modificadores; listas de precios, upsert masivo y `resolvePrice`; DTOs validados, Swagger y tests | — |
| AYCDS-61 | [24.0] Consola SaaS alta Tenant + cron morosidad | 7-8 | David | Listo | 100% | Endpoints SaaS, alta de tenant transaccional, suspender/reactivar/plan, métricas MRR, cron diario 03:00 y auditoría; tests | — |
| AYCDS-63 | [26.0] UI catálogo Maestro/precios/carta | 7-8 | Diego | Listo | 100% | `/app/productos` consume la API real: CRUD, listas de precios y carta; verificado contra PostgreSQL | — |
| AYCDS-65 | [27.0] UI consola SaaS MRR empresas | 7-8 | Joshua | Listo | 100% | `/saas` conectada a `/saas/tenants` y `/saas/metrics`; suspender/reactivar verificado, MRR y estados reales | — |
| AYCDS-66 | [28.0] QA aislamiento y RBAC + acta 1 | 8 | Sebastián | En curso | 95% | Suites 52 unit + 27 DB + 10 e2e + 37 web, pruebas cross-tenant y `docs/acta-qa-aycds-66.md` | Firmas del acta y cierre en Jira |

---

## 4. Fichas por tarea

### AYCDS-32 — [15.0] Modelo datos `schema.prisma` ERP/CRM

- **Semana:** 5 | **Responsable:** Sonny De La Cruz | **Estado Jira:** Listo | **Avance:** 100%
- **Descripción Jira:** "Modelo completo todas entidades RNF-01 RDES-01. ER + schema versionado."
- **Qué debe hacerse:**
  1. Crear `apps/api/prisma/schema.prisma` con `datasource db` (PostgreSQL) y `generator client`.
  2. Migrar las **41 tablas** y **27 enums** de `db/fogoneria_schema.sql` a modelos Prisma, manteniendo nombres en `snake_case` (introspección con `prisma db pull`).
  3. Definir relaciones, claves foráneas, índices y restricciones (`@@unique`, `@@index`, índices parciales).
  4. Agregar `DATABASE_URL` y `SHADOW_DATABASE_URL` a `.env.example`.
  5. Documentar el diagrama entidad-relación (Mermaid) en `docs/modelo-datos.md`.
- **Archivos/rutas:** `apps/api/prisma/schema.prisma`, `apps/api/prisma.config.ts`, `apps/api/.env.example`, `docs/modelo-datos.md`
- **Criterio de aceptación:** `prisma validate` y `prisma format` sin errores; paridad 1:1 de tablas y enums con el SQL; ER documentado.
- **Evidencia:** 41 modelos y 27 enums validados; `prisma generate` produce el cliente en `src/generated/prisma`; índices parciales `uq_usuarios_email_global` y `uq_empleados_usuario` introspeccionados con `partialIndexes`.

---

### AYCDS-44 — [17.0] Setup modular NestJS Auth/Tenant/Orders

- **Semana:** 5 | **Responsable:** David Piñarreta | **Estado Jira:** Listo | **Avance:** 100%
- **Descripción Jira:** "Estructura AuthModule TenantModule OrdersModule RDES-03 + README."
- **Qué debe hacerse:**
  1. Crear `apps/api/src/modules/auth`, `apps/api/src/modules/tenant` y `apps/api/src/modules/orders` con `module`, `controller` y `service`.
  2. Crear un `PrismaModule`/`PrismaService` global y registrarlo en `app.module.ts`.
  3. Configurar `ConfigModule` para leer `.env` y `ValidationPipe` global.
  4. Aplicar prefijo global `/api/v1` y habilitar CORS.
  5. Agregar endpoint `GET /api/v1/health` y actualizar el README de la API con la estructura.
- **Archivos/rutas:** `apps/api/src/modules/**`, `apps/api/src/app.module.ts`, `apps/api/src/main.ts`, `apps/api/README.md`
- **Criterio de aceptación:** `pnpm --filter api build` compila; `GET /api/v1/health` responde; los tres módulos están registrados.
- **Evidencia:** `src/modules/{auth,tenant,orders,catalog,pricing,saas,billing}` registrados en `app.module.ts`; `PrismaModule` y `TenantContextModule` globales; `ConfigModule` con validación (`config/env.validation.ts`); `ValidationPipe` global y prefijo `/api/v1` (`bootstrap.ts`); health y Swagger (`/api/docs`). Verificado con `check-types`, `lint`, `build`, 25 tests unitarios y 7 e2e. Verificado contra PostgreSQL 16 real (`docker compose`, `db:deploy`, `db:seed`): health, login y endpoints autenticados OK.

---

### AYCDS-55 — [20.0] Setup Next.js rutas protegidas por rol

- **Semana:** 5 | **Responsable:** Joshua Chávez | **Estado Jira:** Listo | **Avance:** 100%
- **Descripción Jira:** "App Router Tailwind shadcn rutas /app /cocina /mozo /saas RDES-01 RF-02."
- **Qué debe hacerse:**
  1. Revisar y mantener las rutas del App Router: `/app`, `/app/cocina`, `/app/mozo`, `/saas` (el repo usa design system propio en lugar de shadcn; documentar la decisión).
  2. Reforzar la protección **server-side** en `apps/web/proxy.ts` para todas las rutas privadas.
  3. Reemplazar las cookies planas (`fogoneria.role`, `fogoneria.branch`) por cookie **HttpOnly, firmada y SameSite** o JWT emitido por la API.
  4. Implementar redirects por rol con `ROLE_HOME` y `canViewPath` (`lib/auth.ts`).
  5. Eliminar la confianza en `localStorage` para autorización y agregar pruebas de acceso por rol.
- **Archivos/rutas:** `apps/web/proxy.ts`, `apps/web/lib/auth.ts`, `apps/web/lib/permissions.ts`, `apps/web/components/auth/**`
- **Criterio de aceptación:** un usuario que accede por URL a una ruta de otro rol es redirigido; la sesión no puede alterarse desde DevTools; rutas privadas sin sesión redirigen al login.
- **Evidencia:** `proxy.ts` verifica en cada request la cookie `fogoneria.session` HttpOnly/SameSite firmada con HS256 (`lib/session.ts`, `jose`, `SESSION_SECRET`), con ventana deslizante de 15 min y tope absoluto de 8 h, emitida por `app/api/session/route.ts` (rate limit 5/10 min, `Cache-Control: no-store`). El access token de la API vive en `fogoneria.token` (HttpOnly) y solo lo usa el BFF `app/api/backend/[...path]`; ya no hay JWT en `localStorage`. Logout server-side (`/api/session/logout`) borra ambas cookies y redirige con 303. `appRoleFromApi`/`appUserFromApi` fallan cerrado ante rol o sucursal desconocidos (cajero incluido) y no se usan empresa/sucursales demo con sesión. Pruebas: `lib/auth.test.ts`, `lib/session.test.ts`, `proxy.test.ts`, `app/api/session/route.test.ts`, `app/api/session/logout/route.test.ts` y `app/api/backend/[...path]/route.test.ts` (**37/37**). `lint`, `check-types` y `build` (47 rutas) verdes. Verificado en vivo con la API y PostgreSQL: login por `/api/session`, cookie HttpOnly y métricas vía BFF. Se añadió `SESSION_COOKIE_SECURE=false` para HTTP local en Compose; en producción queda `true`.

---

### AYCDS-48 — [18.0] Auth JWT Passport + estado Tenant

- **Semana:** 5-6 | **Responsable:** David Piñarreta | **Estado Jira:** Listo | **Avance:** 100%
- **Descripción Jira:** "Login valida Trial/Activa/Suspendida RF-01 RF-02 + Postman."
- **Qué debe hacerse:**
  1. Implementar `POST /api/v1/auth/login` con validación de credenciales y hash `bcrypt`/`argon2`.
  2. Instalar y configurar `@nestjs/jwt`, `@nestjs/passport` y la estrategia JWT.
  3. Implementar guard global, decorador `@Roles()` y `@Public()`.
  4. Validar el estado del tenant: **Trial / Activa / Suspendida** (RF-01, RF-02) y rechazar login cuando corresponda.
  5. Añadir colección Postman y pruebas unitarias/e2e del login.
- **Archivos/rutas:** `apps/api/src/modules/auth/**`, `apps/api/src/common/guards/**`, `apps/api/src/common/decorators/**`, `docs/postman/`
- **Criterio de aceptación:** login devuelve JWT válido; tenant suspendido recibe 403; tests verdes; colección Postman incluida.
- **Evidencia:** `auth.service.ts` valida `estado` del usuario y bloquea tenants `SUSPENDED`/`EXPIRED`/`LEAD`/`NO_CALIFICADO` y trials vencidos; `JwtStrategy` + guards globales (`common/guards`); decoradores `@Public`, `@Roles`, `@CurrentUser`; seed con hash real bcrypt (`Fogoneria123!`); `docs/postman/fogoneria-api.postman_collection.json`; tests de login y RBAC en `auth.service.spec.ts` y `test/auth.e2e-spec.ts`. Verificado contra PostgreSQL real: login con los 6 usuarios demo, JWT aceptado y tenant suspendido rechazado con 403.

---

### AYCDS-53 — [19.0] Middleware RLS `tenant_id`/`branch_id`

- **Semana:** 6 | **Responsable:** David Piñarreta | **Estado Jira:** Listo | **Avance:** 100%
- **Descripción Jira:** "Aislamiento geografico inyeccion auto RD-02 RNF-01 CT-FG-01 + tests."
- **Qué debe hacerse:**
  1. Resolver `empresa_id` y `sucursal_id` desde el JWT en cada request (contexto de tenant).
  2. Implementar middleware/interceptor o **Prisma Client Extension** que inyecte automáticamente esos filtros en las consultas.
  3. Bloquear lecturas/escrituras cruzadas entre empresas y sucursales.
  4. Escribir pruebas de aislamiento (empresa A no ve datos de empresa B).
- **Archivos/rutas:** `apps/api/src/modules/tenant/**`, `apps/api/src/common/context/**`, `apps/api/prisma/prisma.service.ts`
- **Criterio de aceptación:** todas las consultas operativas quedan filtradas por tenant/sucursal; las pruebas de aislamiento pasan; no se puede forzar otro tenant desde el body o query.
- **Evidencia:** `TenantContextService` (AsyncLocalStorage) + `TenantContextInterceptor`; extensión `withTenantScope` (`prisma/tenant.extension.ts`) que inyecta `empresa_id`/`sucursal_id` en `findMany`, `findFirst`, `count`, `aggregate`, `groupBy`, `updateMany`, `deleteMany`, `create` y `createMany`; SUPERADMIN con bypass; `tenant-scope.spec.ts` cubre merge por AND e inyección en creates. Prueba real con 2 empresas: la empresa B ve solo su sucursal y 0 órdenes/categorías de A. `runWithTenant` fija `app.empresa_id`, `app.sucursal_id`, `app.usuario_id` y `app.bypass` por transacción; con FORCE RLS activo se verificaron lectura y escritura cruzadas (404/rechazo) y el bypass del rol SaaS.

---

### AYCDS-57 — [21.0] Login y Onboarding logo/RUC

- **Semana:** 5-6 | **Responsable:** Diego Arévalo | **Estado Jira:** Listo | **Avance:** 100%
- **Descripción Jira:** "Pantallas login + wizard onboarding PR-01 PR-02 + Auth backend."
- **Qué debe hacerse:**
  1. Conectar la pantalla `/` al endpoint real de login; hoy el campo contraseña es decorativo.
  2. Mostrar estados de carga, error de credenciales y mensajes de tenant suspendido.
  3. Completar el wizard `/onboarding` (3 pasos) con razón social, RUC y logo.
  4. Implementar subida de logo (archivo o URL) y creación del tenant vía API.
  5. Persistir los datos y redirigir según el rol al finalizar.
- **Archivos/rutas:** `apps/web/app/page.tsx`, `apps/web/components/auth/**`, `apps/web/app/onboarding/page.tsx`, `apps/web/components/onboarding/**`, `apps/api/src/modules/onboarding/**`
- **Criterio de aceptación:** login real contra la API; onboarding crea empresa/RUC/logo en la base de datos; errores visibles para el usuario.
- **Evidencia:** `lib/api.ts` (cliente `fetch` al BFF con `ApiError`), `lib/auth-api.ts` y `lib/auth.ts` (`appUserFromApi`, `branchSlugFromApi`); el JWT nunca toca `localStorage`, vive en la cookie HttpOnly `fogoneria.token`. `LoginContent.tsx` con login real, estado `loading`, botones demo (`Fogoneria123!`) y mensajes de error/tenant suspendido; `OnboardingContent.tsx` con los 3 pasos, validación de RUC (módulo 11), `DropZone` con archivo/URL de logo (data URL ≤2 MB), `submitOnboarding()` y auto-login + redirect por rol. **Backend:** `apps/api/src/modules/onboarding/**` expone `POST /api/v1/onboarding` (`@Public()`): valida RUC, rechaza duplicados (409) y en una transacción crea empresa TRIAL con `logo_url`, sucursal matriz, admin con bcrypt, lista "Carta", lead `GANADO` y auditoría; body parser de 4 MB solo en esa ruta. Verificado en vivo: alta QA con RUC `20100000301`, login del admin creado y acceso a la API bajo RLS.

---

### AYCDS-58 — [22.0] Kanban, CI y Docker Compose

- **Semana:** 5-6 | **Responsable:** Sebastián Chicata | **Estado Jira:** En curso | **Avance:** 90%
- **Descripción Jira:** "Tablero, backlog priorizado, lint/test, docker Postgres+api+web RDES-01."
- **Qué debe hacerse:**
  1. Crear `docker-compose.yml` con servicios `postgres`, `api` y `web`.
  2. Crear `Dockerfile` multi-stage para `apps/api` y `apps/web`, más `.dockerignore`.
  3. Crear `.github/workflows/ci.yml` con `pnpm install`, `lint`, `check-types`, `test`, `test:e2e` y `build`.
  4. Agregar `.env.example` con las variables necesarias.
  5. Documentar el tablero y el backlog priorizado (puede ser `docs/backlog.md`).
- **Archivos/rutas:** `docker-compose.yml`, `apps/api/Dockerfile`, `apps/web/Dockerfile`, `.github/workflows/ci.yml`, `.env.example`, `docs/backlog.md`
- **Criterio de aceptación:** `docker compose up` levanta el stack; el pipeline CI pasa en un PR; backlog documentado y priorizado.
- **Evidencia:** Compose completo (`db`, `migrate`, `roles`, `api`, `web`) con PostgreSQL 16 en 5433, healthchecks, volumen `pgdata` y shadow DB. `apps/api/Dockerfile` y `apps/web/Dockerfile` multi-stage (Next `standalone`), `.dockerignore` y `docs/backlog.md` priorizado. Workflow `.github/workflows/ci.yml` con Postgres 16, migraciones, roles RLS, FORCE, lint, tipos, suite unit/DB/web y build. Imágenes construidas y probadas: API responde health/login/6 platos; web sirve la home (200); `docker compose config` válido. Falta ejecutar el pipeline en GitHub y el smoke completo en un volumen limpio.

---

### AYCDS-42 — [16.0] Postgres migraciones y seed demo

- **Semana:** 6 | **Responsable:** Sonny De La Cruz | **Estado Jira:** Listo | **Avance:** 100%
- **Descripción Jira:** "Migraciones iniciales + tenant/sucursales demo RDES-01."
- **Qué debe hacerse:**
  1. Crear la migración inicial `20261019000000_init` a partir del DDL de `db/fogoneria_schema.sql` (sin los INSERT demo).
  2. Crear `apps/api/prisma/seed.ts` idempotente con: empresa demo (`Mi Restaurante S.A.C.`, RUC `20123456786`), 3 sucursales, roles, usuarios demo y catálogo base.
  3. Agregar scripts `db:deploy`, `db:migrate`, `db:seed`, `db:reset` y `db:studio` al `package.json` de la API.
  4. Documentar el procedimiento en el README de la API.
- **Archivos/rutas:** `apps/api/prisma/migrations/**`, `apps/api/prisma/seed.ts`, `apps/api/package.json`, `apps/api/README.md`
- **Criterio de aceptación:** `prisma migrate deploy` y `db seed` funcionan en una base limpia; ejecutar el seed dos veces no duplica datos.
- **Evidencia:** `migrate deploy` aplicado en base limpia (41 tablas, 27 enums, 22 triggers, 4 vistas); seed ejecutado dos veces con conteos estables; la migración conserva CHECKs, triggers y vistas que Prisma no modela.

---

### AYCDS-62 — [25.0] Índices RLS y triggers soft-delete

- **Semana:** 7 | **Responsable:** Sonny De La Cruz | **Estado Jira:** Listo | **Avance:** 100%
- **Descripción Jira:** "Constraints RLS + inmutabilidad contable RD-01 RCAL-03."
- **Qué debe hacerse:**
  1. Crear índices por `empresa_id`, `sucursal_id` y claves de búsqueda frecuentes.
  2. Implementar políticas `ROW LEVEL SECURITY` y `ENABLE ROW LEVEL SECURITY` en las tablas operativas.
  3. Agregar columnas `deleted_at` y triggers/filtros de soft-delete.
  4. Implementar restricciones de inmutabilidad contable (RD-01, RCAL-03) para movimientos de caja/comprobantes.
  5. Verificar planes con `EXPLAIN` y agregar pruebas.
- **Archivos/rutas:** `apps/api/prisma/migrations/2026102012*/**`, `apps/api/prisma/schema.prisma`, `apps/api/test/db/**`, `db/scripts/rls/**`, `docs/rls-modelo.md`, `docs/errores-db.md`, `docs/modelo-datos.md`
- **Criterio de aceptación:** `EXPLAIN` usa los índices; RLS bloquea cruces de tenant; el borrado lógico es verificable; no se puede alterar un registro contable cerrado.
- **Evidencia:** migraciones `20261020120000_indices_tenant`, `20261020120100_rls_tenant`, `20261020120200_soft_delete` y `20261020120300_inmutabilidad_contable`; 21 índices nuevos; RLS en 40 tablas (empresa, empresa+sucursal, hijas por `EXISTS`, `movimientos_caja` vía turno, `usuarios` con superadmin oculto); 16 entidades con `deleted_at`/`deleted_by` y únicos parciales; triggers de turnos, caja, comprobantes, kardex, puntos, auditoría, órdenes, líneas y gastos con SQLSTATE `45000`; `schema.prisma` validado con `prisma validate`; 27 specs en `apps/api/test/db/` (`DATABASE_URL_TEST`); `db/scripts/rls/000-roles.sql` y `010-force-rls.sql`; catálogo de errores en `docs/errores-db.md`. Migraciones y FORCE aplicados en `fogoneria_db` y `fogoneria_test`; `EXPLAIN (ANALYZE, BUFFERS)` de órdenes, turnos y kardex en `docs/explain-rls.md` (usan `idx_ordenes_tenant_fecha`, `idx_turnos_tenant_fecha` y `idx_movinv_tenant_insumo_fecha`).

---

### AYCDS-60 — [23.0] API catálogo maestro y PriceList

- **Semana:** 7-8 | **Responsable:** David Piñarreta | **Estado Jira:** Listo | **Avance:** 100%
- **Descripción Jira:** "CRUD platos/categorias/modificadores + listas por canal RF-03 CT-FG-06 Swagger."
- **Qué debe hacerse:**
  1. Implementar CRUD de platos, categorías y grupos/opciones de modificadores.
  2. Implementar listas de precios (`PriceList`) por canal y precios por plato.
  3. Crear DTOs con validación y guards por rol.
  4. Documentar los endpoints con Swagger/OpenAPI en `/api/docs`.
  5. Escribir pruebas unitarias/e2e de los endpoints.
- **Archivos/rutas:** `apps/api/src/modules/catalog/**`, `apps/api/src/modules/pricing/**`, `apps/api/src/main.ts`
- **Criterio de aceptación:** CRUD completo documentado en Swagger; filtrado por tenant; pruebas verdes.
- **Evidencia:** `catalog.controller.ts` (categorías, platos, grupos/opciones, asignación a platos) y `pricing.controller.ts` (listas, precios, activación, `resolvePrice`); DTOs con `class-validator`; roles `ADMIN_GLOBAL`/`GERENTE_SUCURSAL` en escrituras; Swagger en `/api/docs`; `catalog.service.spec.ts` y `pricing.service.spec.ts` verdes. Verificado contra PostgreSQL real: alta de categoría → plato → lista → precio 12.5 → `resolve` → edición → baja lógica.

---

### AYCDS-61 — [24.0] Consola SaaS alta Tenant + cron morosidad

- **Semana:** 7-8 | **Responsable:** David Piñarreta | **Estado Jira:** Listo | **Avance:** 100%
- **Descripción Jira:** "Endpoints /saas ciclo suscripcion + cron suspension RF-01 CT-FG-01."
- **Qué debe hacerse:**
  1. Implementar endpoints `/api/v1/saas`: alta de tenant, listado de empresas y detalle de suscripción.
  2. Implementar el ciclo de suscripción (Trial → Activa → Suspendida).
  3. Implementar suspensión/reactivación y auditoría de cambios.
  4. Programar el cron de morosidad con `@nestjs/schedule`.
  5. Alimentar la UI `/saas` (tarea 65) con estos endpoints.
- **Archivos/rutas:** `apps/api/src/modules/saas/**`, `apps/api/src/modules/billing/**`, `apps/api/src/app.module.ts`
- **Criterio de aceptación:** alta y cron probados; el estado de la suscripción se refleja en el login; acciones auditadas.
- **Evidencia:** `saas.controller.ts` (alta, listado, detalle, suspender, reactivar, cambio de plan, historial y métricas MRR); alta transaccional en `saas.service.ts`; `billing.scheduler.ts` con `@Cron(EVERY_DAY_AT_3AM)` y ciclo `TRIAL → EXPIRED → SUSPENDED`; cada transición escribe `suscripciones_eventos` y `auditoria`; `saas.service.spec.ts` y `billing.service.spec.ts` verdes. Verificado contra PostgreSQL real: alta de tenant `TRIAL`, `/saas/tenants`, `/saas/metrics`, suspensión (login 403) y reactivación (login OK).

---

### AYCDS-63 — [26.0] UI catálogo Maestro/precios/carta virtual

- **Semana:** 7-8 | **Responsable:** Diego Arévalo | **Estado Jira:** Listo | **Avance:** 100%
- **Descripción Jira:** "Panel Maestro, modificadores, listas, carta PR-FG-08."
- **Qué debe hacerse:**
  1. Conectar `/app/productos` (Maestro, Categorías, Modificadores, Listas de precios y Carta virtual) a la API de catálogo (tarea 60).
  2. Reemplazar los datos mock de `apps/web/lib/erp-catalog.ts` por llamadas reales a la API.
  3. Implementar estados de carga, error y listas vacías.
  4. Validar formularios y permisos por rol en la UI.
  5. Probar el flujo completo de alta/edición de plato y publicación de la carta virtual.
- **Archivos/rutas:** `apps/web/app/app/productos/**`, `apps/web/components/erp/catalog/**`, `apps/web/lib/erp-catalog.ts`, `apps/web/lib/catalog-api.ts`
- **Criterio de aceptación:** CRUD real desde la UI; la carta virtual muestra datos de la base de datos; no quedan mocks en el módulo.
- **Evidencia:** `lib/catalog-api.ts` agrupa `GET /catalog/categories`, `GET /catalog/dishes?limit=100`, `GET /catalog/modifier-groups` y `GET /pricing/price-lists` + precios por lista, y las mutaciones (`createCategory`, `createDish`, `setDishActive`, `createModifierGroup`, `createPriceList`, `activatePriceList`, `setPrices`); `ModulesProvider.tsx` mantiene el catálogo en estado (`catalogLoading`/`catalogError`/`refreshCatalog`) y expone las mutaciones, con lo que `ProductsView`, `CategoriesView`, `ModifiersView` y `PriceListsView` dejaron de usar mocks; `lib/erp-catalog.ts` quedó solo con tipos/helpers (`priceOf`, `categoryName`) y los `id` del catálogo pasaron de numéricos a UUID (también en `erp`, `domain`, `dashboard`, `tenancy`, `AddItemModal` y los resúmenes), y se subió `ErpState` a v2 para no persistir el catálogo. `catalog.service.ts` incluye `platos_grupos_modificadores` en el listado. Verificado en vivo contra PostgreSQL: listado de 6 platos demo, alta/baja lógica de categoría y lectura de listas de precios bajo RLS; `lint`, `check-types` y `build` (47 rutas) verdes.

---

### AYCDS-65 — [27.0] UI consola SaaS MRR empresas

- **Semana:** 7-8 | **Responsable:** Joshua Chávez | **Estado Jira:** Listo | **Avance:** 100%
- **Descripción Jira:** "KPIs MRR, grilla empresas, Suspender/Reactivar PR-FG-03."
- **Qué debe hacerse:**
  1. Conectar `/saas` a los endpoints de la tarea 61.
  2. Mostrar KPIs de MRR calculados con datos reales.
  3. Implementar la grilla de empresas con estado de suscripción.
  4. Implementar las acciones Suspender/Reactivar con confirmación y feedback.
  5. Restringir el acceso a `superadmin`.
- **Archivos/rutas:** `apps/web/app/saas/page.tsx`, `apps/web/components/dashboard/**`, `apps/web/lib/auth.ts`
- **Criterio de aceptación:** las acciones persisten en la API; los KPIs salen de datos reales; solo `superadmin` accede.
- **Evidencia:** `apps/web/lib/saas-api.ts` consume `GET /saas/tenants`, `GET /saas/metrics`, `POST /saas/tenants/:id/suspend` y `POST /saas/tenants/:id/reactivate`; `app/saas/page.tsx` muestra KPIs reales, estados `ACTIVE/TRIAL/SUSPENDED/EXPIRED`, confirmación `ConfirmDialog` y feedback. Verificado en vivo: tenant QA en TRIAL con 0 platos, suspensión → login/API 403, reactivación → acceso restaurado; MRR y métricas desde la API. Ruta restringida a `superadmin` por `proxy.ts`.

---

### AYCDS-66 — [28.0] QA aislamiento y RBAC + acta 1

- **Semana:** 8 | **Responsable:** Sebastián Chicata | **Estado Jira:** En curso | **Avance:** 95%
- **Descripción Jira:** "Pruebas multi-tenant y roles RNF-01 RF-02 + informe mensual."
- **Qué debe hacerse:**
  1. Diseñar el plan de pruebas de aislamiento multi-tenant (empresa A vs. empresa B).
  2. Probar la matriz RBAC por rol y ruta (`superadmin`, `admin`, `sucursal`, `cocina`, `mesero`).
  3. Automatizar los casos críticos (CT-FG-01) y dejarlos corriendo en CI.
  4. Documentar evidencias y redactar el **acta mensual 1** en `docs/`.
  5. Actualizar los estados de Jira con las evidencias.
- **Archivos/rutas:** `apps/api/test/**`, `apps/web/**/*.test.*`, `docs/actas/acta-01.md`, `.github/workflows/ci.yml`
- **Criterio de aceptación:** suite de aislamiento/RBAC en CI; acta 1 adjunta; Jira actualizado.
- **Evidencia:** 52 pruebas unitarias API, 27 de base de datos (RLS, soft-delete, inmutabilidad, email global), 10 e2e y 37 web. Casos reales: empresa A no ve platos de B (0 vs 6), lectura cruzada 404, escritura cruzada rechazada, tenant suspendido 403, email activo duplicado rechazado y reutilización tras soft-delete. Acta en `docs/acta-qa-aycds-66.md`; CI en `.github/workflows/ci.yml`. Falta firmar el acta y cerrar Jira.

---

## 5. Orden de dependencias y bloqueos

### 5.1 Grafo de dependencias con responsables

```text
Sonny (32 Prisma) ──► Sonny (42 Migraciones/seed)
                              │
David (44 NestJS modular) ────┴──► David (48 JWT)
                                        │
                                        ▼
                                  David (53 Tenant/RLS)
                                        │
                        ┌───────────────┴───────────────┐
                        ▼                               ▼
              David (60 API catálogo)          David (61 API SaaS/cron)
                        │                               │
                        ▼                               ▼
              Diego (63 UI catálogo)          Joshua (65 UI SaaS)

Sonny (62 Índices/RLS/soft-delete) ────────────┘ (refuerza a David en 53)
Sebastián (58 Docker/CI) ── en paralelo desde S5
Sebastián (66 QA) ───────── al final, cuando 48/53 (David) y 60/61 (David) estén listos
```

**Ruta crítica con nombres:**
`32 (Sonny) → 42 (Sonny) → 44 (David) → 48 (David) → 53 (David) → 60/61 (David) → 63 (Diego) / 65 (Joshua) → 66 (Sebastián)`

### 5.2 Matriz de bloqueos (quién bloquea a quién)

| Tarea bloqueada | Responsable | Depende de | Responsable de la dependencia | Motivo |
|---|---|---|---|---|
| 42 Migraciones | Sonny De La Cruz | 32 Prisma | Sonny De La Cruz | Necesita el schema definido |
| 48 JWT | David Piñarreta | 44 NestJS + 42 Seed | David Piñarreta + Sonny De La Cruz | Necesita módulos y usuarios/tenants en BD |
| 53 RLS tenant | David Piñarreta | 48 JWT + 32/42 | David Piñarreta + Sonny De La Cruz | Necesita claims del token y modelos |
| 60 API catálogo | David Piñarreta | 44, 48, 53 + 32/42 | David Piñarreta + Sonny De La Cruz | Necesita auth, tenant y modelos |
| 61 API SaaS | David Piñarreta | 44, 48, 53 + 32/42 | David Piñarreta + Sonny De La Cruz | Necesita auth, tenant y modelos |
| 63 UI catálogo | Diego Arévalo | 60 API catálogo | David Piñarreta | Sin API solo hay mocks |
| 65 UI SaaS | Joshua Chávez | 61 API SaaS | David Piñarreta | Sin API solo hay mocks |
| 66 QA | Sebastián Chicata | 48, 53, 60, 61 + 58 | David Piñarreta + Sebastián Chicata | Requiere funcionalidad real y CI |

**Completadas (12):** 32, 42, 62 (Sonny); 44, 48, 53, 60, 61 (David); 55, 65 (Joshua); 57, 63 (Diego). **En curso:** 58 (Sebastián, 90%: falta CI en GitHub y smoke Compose) y 66 (Sebastián, 95%: falta firmar acta).

### 5.3 Matriz de inicio: ¿puede cada uno avanzar cuando quiera?

**Respuesta corta:** no todos pueden avanzar libremente. Hay **dependencia dura** en la cadena backend; el frontend y DevOps sí pueden arrancar de inmediato con mocks/scaffold.

| Tarea | Responsable | ¿Inicia hoy? | Depende de (responsable) | Tipo |
|---|---|---|---|---|
| 32 Prisma | Sonny De La Cruz | **Hecha** | — | Base de todo |
| 42 Migraciones | Sonny De La Cruz | **Hecha** | 32 (Sonny) | Dura |
| 44 NestJS modular | David Piñarreta | **Hecha** | 32 resuelto | Blanda (scaffold) |
| 48 JWT | David Piñarreta | **Hecha** | 44 (David); 42 resuelto | Dura para cerrar |
| 53 RLS tenant | David Piñarreta | **Hecha** | 48 (David); 32/42 resueltos | Dura |
| 55 Rutas protegidas | Joshua Chávez | **Hecha** | — | Independiente |
| 57 Login/onboarding | Diego Arévalo | **Hecha** | 48 (David) resuelto | Blanda |
| 58 Docker/CI | Sebastián Chicata | **Parcial (90%)** | — | Independiente |
| 60 API catálogo | David Piñarreta | **Hecha** | 44/48/53 (David) + 32/42 (Sonny) | Dura |
| 61 API SaaS | David Piñarreta | **Hecha** | 44/48/53 (David) + 32/42 (Sonny) | Dura |
| 62 Índices/RLS | Sonny De La Cruz | **Hecha** | 32/42 resueltos | Dura para cerrar |
| 63 UI catálogo | Diego Arévalo | **Hecha** | 60 (David) resuelto | Blanda |
| 65 UI SaaS | Joshua Chávez | **Hecha** | 61 (David) para datos reales | Blanda |
| 66 QA | Sebastián Chicata | **95%** | 48/53 + 60/61 + 58 | Última |

**Definiciones:**
- **Dependencia dura:** no se puede *cerrar* la tarea sin la otra.
- **Dependencia blanda:** se puede avanzar en paralelo (UI con mock, scaffold, diseño), pero el cierre espera.

**Semáforo por persona (qué puede hacer desde hoy):**
- **Sonny De La Cruz:** empieza **hoy con 32**; luego 42 y 62. No espera a nadie.
- **David Piñarreta:** empieza **hoy con el scaffold de 44** y el diseño de 48; no puede cerrar 48/53/60/61 hasta que Sonny entregue 32 y 42.
- **Joshua Chávez:** empieza **hoy con 55** y la UI de 65; el cierre de 65 espera la API 61 de David.
- **Diego Arévalo:** 57 y 63 ya están integradas a la API (48 y 60 de David); solo falta la verificación en vivo contra la base de datos.
- **Sebastián Chicata:** empieza **hoy con 58**; 66 se ejecuta al final.

### 5.4 Riesgo y mitigación

- **Riesgo:** David Piñarreta concentra 5 tareas y toda la ruta crítica (`44 → 48 → 53 → 60/61`). Si se retrasa, se detienen 63 (Diego), 65 (Joshua) y 66 (Sebastián).
- **Mitigación:** **Sonny De La Cruz** adelanta 32/42/62 y luego refuerza 53; **Sebastián Chicata** deja 58/CI listo para 66; **Diego Arévalo** y **Joshua Chávez** avanzan UI con mocks sin esperar, pero no cierran hasta que **David Piñarreta** entregue 60 y 61.

**Regla de trabajo paralelo:** se permite avanzar en tareas blandas con mocks, pero **no se marca "Listo"** una tarea cuya dependencia dura no exista; la integración se valida en la tarea dependiente.

---

## 6. Checklist por responsable

### David Piñarreta — Backend / APIs
- [x] **44** Crear módulos `auth`, `tenant`, `orders`, `PrismaModule`, `ConfigModule`, prefijo `/api/v1`
- [x] **48** Login con JWT + Passport, guards, `@Roles`, validación Trial/Activa/Suspendida, Postman
- [ ] **53** Contexto de tenant + inyección automática de `empresa_id`/`sucursal_id`, tests de aislamiento
- [x] **60** CRUD catálogo + `PriceList` por canal + Swagger + tests
- [x] **61** Endpoints `/saas`, ciclo de suscripción, suspensión/reactivación, cron de morosidad

### Sonny De La Cruz — Base de datos
- [x] **32** `schema.prisma` con 41 tablas y 27 enums + ER documentado
- [x] **42** Migración inicial + seed demo idempotente + `.env.example`
- [x] **62** Índices + políticas RLS + soft-delete + inmutabilidad contable — *implementado en migraciones y `schema.prisma`; falta correr `EXPLAIN` y `test:db` contra PostgreSQL y activar FORCE*

### Joshua Chávez — Frontend / RBAC y SaaS
- [ ] **55** Protección server-side de rutas, cookie segura/JWT, redirects por rol — *código completo y testeado; falta la verificación en vivo contra API + PostgreSQL*
- [ ] **65** Conectar `/saas` a la API: MRR, grilla de empresas, suspender/reactivar

### Diego Arévalo — Frontend / Auth y catálogo
- [ ] **57** Login real + onboarding con razón social, RUC y logo — *código completo y testeado; falta la verificación en vivo contra PostgreSQL para marcarla Listo*
- [ ] **63** Conectar `/app/productos` a la API y eliminar mocks de catálogo — *código completo y testeado; falta la verificación en vivo contra PostgreSQL para marcarla Listo*

### Sebastián Chicata — DevOps / QA
- [ ] **58** Docker Compose (Postgres local listo) + Dockerfiles + CI + backlog documentado
- [ ] **66** QA multi-tenant/RBAC + acta 1 + actualización de Jira

---

## 7. Definición de Terminado (DoD)

Una tarea se considera **Listo** solo si cumple:

1. El código está implementado y compila (`pnpm build`).
2. Pasan `pnpm lint` y `pnpm check-types`.
3. Las pruebas nuevas pasan (`pnpm test`, `test:e2e` cuando aplique).
4. No quedan mocks en el flujo intervenido (para tareas de integración).
5. La funcionalidad está verificada contra la API/BD real.
6. La documentación o README correspondiente está actualizado.
7. El cambio está commiteado y el estado de Jira actualizado con evidencia.

### Comandos de verificación

```bash
pnpm install
pnpm lint
pnpm check-types
pnpm build
pnpm --filter api test
pnpm --filter api test:e2e
docker compose up --build
```

---

## 8. Reglas para actualizar Jira

- Mover la tarea a **En curso** al iniciar el trabajo.
- Mover a **Listo** solo cuando se cumpla el DoD y exista evidencia (commit/PR, captura o test).
- Agregar un comentario en Jira con: qué se hizo, archivos tocados y cómo verificarlo.
- Mantener las labels `semana-X` y `sprint-N`; no renombrar las tareas.
- Actualizar esta bitácora y el porcentaje de la tabla maestra.

---

## 9. Bitácora de avance

| Fecha | Tarea | Responsable | Cambio realizado | Evidencia |
|---|---|---|---|---|
| 2026-10-19 | — | — | Línea base: 14 tareas, 26% global | Este documento |
| 2026-10-19 | 32 y 42 | Sonny De La Cruz | Prisma 7.10.1, `schema.prisma`, migración inicial y seed demo idempotente; 41 tablas, 27 enums, 22 triggers y 4 vistas | `apps/api/prisma/**`, `docs/modelo-datos.md` |
| 2026-10-20 | 44, 48, 53, 60, 61 | David Piñarreta | Backend modular NestJS: auth JWT, guards RBAC, contexto de tenant + extensión Prisma, catálogo/precios, consola SaaS y cron de morosidad; Swagger, colección Postman y tests | `apps/api/src/**`, `docs/postman/**`; `check-types`, `lint`, `build`, 25 unit + 7 e2e verdes |
| 2026-10-20 | 58 (parcial) | David / Sebastián | Docker Compose de PostgreSQL 16 en `localhost:5433` con shadow DB, healthcheck y scripts `db:*`; verificación contra base real | `docker-compose.yml`, `docker/initdb/01-shadow.sql`, `apps/api/package.json`; `db:deploy` + `db:seed` OK |
| 2026-10-20 | 44, 48, 53, 60, 61 | David Piñarreta | Verificación real: login de 6 usuarios, CRUD catálogo/precios, alta/suspensión/reactivación de tenant, métricas MRR y aislamiento con 2 empresas; fix de `PrismaService` (composición en vez de herencia) | API en `:3001` contra Postgres en `:5433`; 25 unit + 7 e2e verdes; tenant B ve 1 sucursal y 0 órdenes de A |
| 2026-10-20 | 57 | Diego Arévalo | Login real con JWT (`lib/api.ts`, `lib/auth-api.ts`), wizard de onboarding de 3 pasos con validación de RUC y logo, y módulo público `POST /api/v1/onboarding` (empresa TRIAL + sucursal matriz + admin + lead + auditoría) | `apps/web/lib/{api,auth-api,onboarding-api,auth}.ts`, `components/auth/LoginContent.tsx`, `components/onboarding/**`, `apps/api/src/modules/onboarding/**`; `onboarding.service.spec.ts` 3/3 verdes; `lint` + `check-types` web verdes |
| 2026-10-20 | 63 | Diego Arévalo | `/app/productos` conectado a la API de catálogo/precios: CRUD real de productos, categorías, modificadores y listas, con UUID en todo el ERP y catálogo fuera de `localStorage` (v2) | `apps/web/lib/catalog-api.ts`, `components/dashboard/ModulesProvider.tsx`, `components/erp/catalog/**`, `lib/{erp-catalog,persistence,domain,erp,dashboard,tenancy}.ts`; `lint` + `check-types` web verdes |
| 2026-10-20 | 57 | Diego Arévalo | Revisión P0/P1: RUC SUNAT con dígito verificador correcto (400 si inválido), alta pública sin `plan` (TRIAL forzado), RUC/email duplicado → 409, logo y longitudes validadas, rate limit 5/10 min por IP, body de 4 MB solo en `/onboarding` y login ambiguo → 409 | `apps/api/src/common/utils/ruc.ts`, `apps/api/src/modules/{onboarding,auth}/**`, `apps/api/src/common/guards/rate-limit.guard.ts`, `apps/api/src/main.ts`, `apps/web/lib/{onboarding-api,domain}.ts`; `ruc.spec` 7, `auth.service.spec` 8, `onboarding.e2e-spec` 3 |
| 2026-10-20 | 63 | Diego Arévalo | Revisión P0/P1: modificadores por `id` (sync transaccional, 400 ids ajenos/repetidos, 409 si la opción está en órdenes), tenant y sucursales hidratados de la API, paginación de platos + abort de peticiones, rol real `cajero` en el RBAC y rollback de altas de plato/lista | `apps/api/src/modules/catalog/{catalog.service.ts,dto/modifier-group.dto.ts}`, `apps/web/lib/{tenant-api,catalog-api,auth,permissions}.ts`, `apps/web/components/dashboard/{ModulesProvider,AppSidebar,DashboardShell}.tsx`, `apps/web/proxy.ts`; `catalog.service.spec` 10; `api test` 52 + e2e 10, `web build` 45 rutas |
| 2026-10-20 | 55 (95%) | Joshua Chávez | Sesión HttpOnly + BFF sobre `development`: cookie `fogoneria.session` firmada HS256 con ventana deslizante de 15 min y tope de 8 h, refresh en `proxy.ts`; access token de la API movido a cookie HttpOnly (`fogoneria.token`) y BFF `/api/backend`; logout server-side con 303; rate limit 5/10 min; role/sucursal desconocidos fallan cerrado (cajero incluido); sin tenant demo con sesión. 34 tests web (proxy, route, logout, BFF, RBAC). Falta verificación en vivo | `apps/web/lib/{session,backend,session-api,auth}.ts`, `app/api/session/**`, `app/api/backend/[...path]/route.ts`, `proxy.ts`, `components/dashboard/ModulesProvider.tsx`; `test` 34/34, `lint`, `check-types` y `build` (47 rutas) verdes |
| 2026-10-20 | 62 (85%) | Sonny De La Cruz | Índices compuestos/parciales, RLS en 40 tablas con roles separados y contexto `app.*`, soft-delete en 16 maestras con únicos parciales y `restore_row`, e inmutabilidad de turnos/caja/comprobantes/kardex/puntos/auditoría/órdenes/gastos con SQLSTATE `45000`. `schema.prisma` sincronizado y validado; 25 specs de BD y catálogo de errores | 4 migraciones `2026102012*`, `apps/api/prisma/schema.prisma`, `apps/api/test/db/**`, `db/scripts/rls/**`, `docs/{rls-modelo,errores-db,modelo-datos}.md`; `prisma validate` OK; pendiente `migrate deploy` + `EXPLAIN` + `test:db` en Postgres |
| 2026-10-20 | 53 y 62 | David / Sonny | RLS runtime: `runWithTenant` fija `app.empresa_id/sucursal_id/usuario_id/bypass` por transacción, migración de política INSERT para onboarding, rol `fogoneria_saas` con BYPASSRLS y FORCE aplicado en `fogoneria_db` y `fogoneria_test`. 27 pruebas DB (incluye escritura cruzada) y `EXPLAIN` de órdenes/turnos/kardex | `apps/api/src/prisma/prisma.service.ts`, `common/context/tenant.interceptor.ts`, `migrations/20261020120400_rls_onboarding`, `db/scripts/rls/000-roles.sql`, `docs/explain-rls.md`; 27/27 DB |
| 2026-10-20 | 57, 63 y 65 | Diego / Joshua | Verificación en vivo: login, onboarding real, catálogo/precios y consola SaaS. `/saas` consume tenants/métricas y suspender/reactivar con confirmación; tenant suspendido recibe 403. Fix de `express` faltante y `SESSION_COOKIE_SECURE` para HTTP local | `apps/web/lib/saas-api.ts`, `app/saas/page.tsx`, `lib/session.ts`, `docker-compose.yml`; tenant QA 0 platos, suspensión 403, reactivación OK, 37 tests web |
| 2026-10-20 | 58 (90%) | Sebastián Chicata | Dockerfiles multi-stage api/web (Next standalone), Compose con `migrate`/`roles`/`api`/`web`, `.dockerignore`, workflow CI con Postgres+RLS y `docs/backlog.md`. Imágenes construidas: API health/login/6 platos, web 200 | `apps/{api,web}/Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.github/workflows/ci.yml`, `docs/backlog.md`; `docker compose config` OK |
| 2026-10-20 | 66 (95%) | Sebastián Chicata | Acta QA con matriz RBAC, aislamiento multi-tenant, sesión/BFF, suspensión y email global; suites 52 unit + 27 DB + 10 e2e + 37 web | `docs/acta-qa-aycds-66.md`; pendiente firmas y Jira |
