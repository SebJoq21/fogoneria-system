# Matriz de trazabilidad

**Última revisión:** 2026-11-20. Fuente: `docs/TAREAS-SEMANAS-*.md`, `docs/PLAN-MODULOS-Y-PROPIEDAD.md`, `docs/SESION.md`, `docs/decisiones.md`, `gh pr list --state merged` y `git log`.

> **Cómo leerla:** el estado refleja el **código mergeado**, no siempre el tablero Jira. Donde Jira va por detrás se indica en la columna Estado. `Pendiente` = sin PR merged.

## 1. Semanas 5–8 (Sprint 1–2)

| Jira | Objetivo | Módulo(s) | PR / commit | Estado | Evidencia |
|---|---|---|---|---|---|
| AYCDS-32 | Modelo Prisma (41 tablas, 27 enums) | datos | #1 | Listo | `apps/api/prisma/schema.prisma`, [modelo-datos](../docs/modelo-datos.md) |
| AYCDS-42 | Migración inicial + seed idempotente | datos | #1 | Listo | `prisma/migrations/20261019000000_init`, `prisma/seed.ts` |
| AYCDS-44 | Scaffold NestJS modular | plataforma | #2 | Listo | `apps/api/src/app.module.ts`, `bootstrap.ts` |
| AYCDS-48 | Auth JWT + estado del tenant | auth | #2 | Listo | `auth.service.spec.ts`, `test/auth.e2e-spec.ts` |
| AYCDS-53 | Contexto tenant + extensión Prisma | tenant | #2 | Listo | `prisma/tenant.extension.ts`, `tenant-scope.spec.ts` |
| AYCDS-55 | Rutas protegidas por rol (cookie HttpOnly + BFF) | plataforma/sesión | #4, #5 | Listo | `proxy.ts`, `lib/session.ts`, `app/api/backend/**` |
| AYCDS-57 | Login real + onboarding RUC/logo | auth, onboarding | #3, #9 | Listo | `OnboardingPage`, `onboarding.e2e-spec.ts` |
| AYCDS-58 | Dockerfiles, Compose y CI | operación | #7 | **Parcial** (CI verde; smoke Compose limpio pendiente) | `.github/workflows/ci.yml`, `docs/backlog.md` |
| AYCDS-60 | API catálogo + PriceList | catalog, pricing | #2 | Listo | `catalog.service.spec.ts`, `pricing.service.spec.ts` |
| AYCDS-61 | API SaaS + ciclo de suscripción | saas, billing | #2 | Listo | `saas.service.spec.ts`, `billing.service.spec.ts` |
| AYCDS-62 | Índices, RLS, soft-delete e inmutabilidad | datos | #6 | Listo | `migrations/2026102012*`, `test/db/**`, [rls-modelo](../docs/rls-modelo.md) |
| AYCDS-63 | UI catálogo contra la API | catalogo | #3 | Listo | `features/catalogo/**` |
| AYCDS-65 | UI consola SaaS | plataforma | #3, #7 | Listo | `features/plataforma/SaasPage.tsx` |
| AYCDS-66 | QA aislamiento y RBAC + acta 1 | QA | #7, #8 | **Parcial** (acta sin firmas) | [acta-qa-aycds-66](../docs/acta-qa-aycds-66.md) |

## 2. Semanas 9–10 (Sprint 3)

| Jira | Objetivo | Módulo(s) | PR / commit | Estado | Evidencia |
|---|---|---|---|---|---|
| AYCDS-14 | Gateway WebSockets + ticket WS | realtime | #13 (`f1f7b2d`) | Listo | `orders.gateway.spec.ts`, `test/realtime.e2e-spec.ts` |
| AYCDS-16 | API mesas y reservas | tables, reservations | #11 | Listo | `test/db/tables-reservas.db-spec.ts` |
| AYCDS-20 | Órdenes POS e inmutabilidad | orders, pricing | #12 | Listo | `orders.service.spec.ts`, `orders-pos.db-spec.ts` |
| AYCDS-22 | Alta de comandas en concurrencia | orders, `common/sequences` | #16 | Listo | [explain-orders](../docs/explain-orders.md), `sequences-concurrency.db-spec.ts` |
| AYCDS-25 | Panel del mesero contra la API | orders (mozo) | #17 (`b56865b`) | Listo | `components/erp/MozoView.tsx`, `lib/order-mapping.ts` |
| AYCDS-26 | Mapa de mesas + agenda de reservas | tables, reservations (salon) | #18 | Listo | `features/salon/**`, `lib/table-mapping.ts` |
| AYCDS-28 | E2E del flujo mesero→cocina→mesa | QA | — | **Pendiente** (0 %) | — |

## 3. Semanas 11–12 (Sprint KDS, caja y comprobantes)

| Jira | Objetivo | Módulo(s) | PR | Estado | Evidencia |
|---|---|---|---|---|---|
| AYCDS-30 | Tablero KDS + SLA 20 min | orders, realtime | #22 | Listo | `orders.sla.spec.ts`, `orders-sla.db-spec.ts` |
| AYCDS-39 | Reversión financiera por triggers | datos, cash, inventory | #23 | Listo | `reversion-financiera.db-spec.ts` |
| AYCDS-34 | Caja: turnos, arqueo y cobro | cash | #24 | Listo | `cash.service.spec.ts`, `caja.db-spec.ts` |
| AYCDS-36 | Comprobantes: correlativo y anulación | receipts | #26 | Listo | `receipts.service.spec.ts`, `comprobantes.db-spec.ts` |
| AYCDS-41 | UI KDS Kanban con SLA | ordenes | #25 | Listo | `features/ordenes/**` |
| AYCDS-46 | UI caja + comprobantes contra API | caja, comprobantes | #30, #38 | Listo | `features/caja/**`, `features/comprobantes/**` |
| AYCDS-50 | Acta CT-FG-03 (caja/comprobantes) | QA | #39 | **Parcial** (acta mergeada, firma pendiente) | [acta-qa-aycds-50](../docs/acta-qa-aycds-50.md) |

## 4. Semanas 13–14 (inventario, gastos y comercial)

| Jira | Objetivo | Módulo(s) | PR | Estado | Evidencia |
|---|---|---|---|---|---|
| AYCDS-11 | Kardex por escandallo al entregar | inventory, orders | #28 | Listo | `kardex.db-spec.ts`, `inventory.service.spec.ts` |
| AYCDS-13 | Semáforo de stock + webhook n8n | inventory | #37 | Listo (Jira puede decir «En revisión») | `stock-alerts.service.spec.ts`, `alertas-stock.db-spec.ts` |
| AYCDS-17 | Gastos con cruce a caja | expenses, cash | #31 | Listo | `expenses.service.spec.ts`, `gastos.db-spec.ts` |
| AYCDS-19 | Combos anti-inflación y cupones | promotions, orders | #29 | Listo | `promotions.rules.spec.ts`, `promotions.e2e-spec.ts` |
| AYCDS-23 | Modelo de escandallos N-M | datos | — | **Pendiente** (tabla existe; falta merma/rendimiento) | `escandallos_recetas` |
| AYCDS-24 | UI kardex + semáforo | inventario | #40 | **Parcial 80 %** (maestro y ajustes demo) | `features/inventario/MovementsPage.tsx` |
| AYCDS-27 | UI gastos, combos y promos | gastos, promociones | — | **Pendiente** (clientes listos) | `features/gastos/api.ts`, `features/promociones/api.ts` |
| AYCDS-29 | Pruebas cruzadas kardex↔ventas | QA | — | **Pendiente** | — |

## 5. Semanas 15–16 (CRM, RRHH, BI y cierre)

| Jira | Objetivo | Módulo(s) | PR | Estado | Evidencia |
|---|---|---|---|---|---|
| AYCDS-31 | CRM: segmentos derivados y puntos | crm | #32 | Listo | `crm.service.spec.ts`, `crm.db-spec.ts` |
| AYCDS-33 | RRHH: turnos, asistencia y propinas | staff | #33 | Listo | `staff.rules.spec.ts`, `propinas.db-spec.ts` |
| AYCDS-35 | API BI (P&L, ranking, métodos) | bi | #36 | Listo | `bi.service.spec.ts`, `bi-endpoints.db-spec.ts` |
| AYCDS-38 | Vistas BI + backup/restore | bi, datos | #35 | Listo | `migrations/20261107120000_vistas_bi`, [respaldo-recuperacion](../docs/respaldo-recuperacion.md) |
| AYCDS-40 | UI CRM (clientes, ficha, puntos) | crm | #41 | Listo | `features/crm/ClientesPage.tsx` |
| AYCDS-45 | UI RRHH y analíticas | rrhh, bi | #42, #43 | Listo | `features/rrhh/**`, `features/bi/**` |
| AYCDS-49 | QA integral CT-01…09 + deploy Docker | QA | — | **Pendiente** | — |
| AYCDS-52 | Ensayo y sustentación | docs | — | **Pendiente** | — |

## 6. Modularización y plataforma (PRs sin Jira de tarea)

| Fase | Alcance | PR | Evidencia |
|---|---|---|---|
| 0 | `@fogoneria/{kernel,sdk,contracts}` + gate de fronteras | #48 | `scripts/check-module-boundaries.mjs`, baseline 24 |
| 1 | Piloto RRHH | #49, #51 | `features/rrhh/**`, `staff/index.ts` |
| 2 | Catálogo + precios | #50, #52 | `features/catalogo/**`, `PRICING_PORT` |
| 3 · salón | mesas, reservas, KDS | #54, #57 | `features/salon`, `features/ordenes` |
| 3 · dinero | receipts, cash, expenses | #56, #59 | `features/{caja,comprobantes,gastos}` |
| 3 · operación | inventory, promotions | #58, #61 | `features/{inventario,promociones}` |
| 3 · personas | crm | #60 | `features/crm` |
| 3 · lectura | bi, realtime | #62, #63, #65 | `features/bi`, `@fogoneria/contracts/tiempo-real` |
| 3 · plataforma | auth, tenant, saas, billing, onboarding, audit | #64 | baseline **0** |
| 4 · etapa 1 | `SessionProvider`, `NotificationsProvider` | #66 | `components/dashboard/providers/{session,notifications}.tsx` |
| 4 · etapa 2 | `TenantProvider` | #70 | `providers/tenant.tsx`, `lib/tenant-scope.ts` |
| 4 · etapa 3 | `CatalogoProvider` (catálogo/precios) | #73 | `providers/catalog.tsx`, `features/catalogo/hooks.ts` |

## 7. Infraestructura y despliegue

| Cambio | PR | Evidencia |
|---|---|---|
| Plantilla de PR + `pr-scope` (un PR = un módulo) | #47 | `.github/pull_request_template.md`, `scripts/check-pr-scope.mjs` |
| Seed idempotente sin turno cerrado | #44 | `prisma/seed.ts` |
| Limpieza de demo conservando cuentas/catálogo | #45 | `db/scripts/demo/limpiar-demo.sql` |
| `output: standalone` condicional en Vercel | #67 | `apps/web/next.config.ts` |
| Variables de la web en `globalEnv` de Turbo | #68 | `turbo.json` |
| Script idempotente de roles RLS | #69 | `apps/api/prisma/rls-roles.ts` |
| Login limpio + recuperación por soporte | #71 | `features/plataforma/{LoginPage,RecoverPage}.tsx`, `lib/support.ts` |
| Runbook Vercel + Railway | #72 | [despliegue](../docs/despliegue.md) |
| Repo de specs docs-as-code + trazabilidad | #74 | [specs/README](README.md), `docs/INDICE.md` |
| CI Fase A: check agregado, Docker/Trivy, CodeQL y Dependabot | #76 | `.github/workflows/{ci,codeql}.yml`, `.github/dependabot.yml` |
| CI Fase B: cobertura API/web, artifacts lcov y Sonar CI | #88 | `sonar-project.properties`, `vitest.config.*`, `.github/workflows/ci.yml` |
| CI Fase C: E2E Playwright, OpenAPI y migraciones forward-only | #94 | `apps/web/e2e/auth.spec.ts`, `apps/web/playwright.config.ts`, `apps/api/scripts/export-openapi.mjs`, `.github/workflows/ci.yml` |

## 8. Pendientes sin PR (backlog vivo)

| Tema | Módulo | Referencia |
|---|---|---|
| Endpoints de insumos y ajuste con motivo | inventory | observación 1 del [plan](../docs/PLAN-MODULOS-Y-PROPIEDAD.md) |
| `GastosPage` contra `/expenses` | gastos | observación 2 (AYCDS-27) |
| `CombosPage`/`PromocionesPage` contra `/promotions` | promociones | observación 3 (AYCDS-27) |
| «Cerrar cuenta» del mesero deriva a Caja | orders | observación 4 |
| E2E full-stack (mesa→cocina→caja→comprobante) | QA | observación 12 (AYCDS-49) |
| Directorio/roles/propinas RRHH | staff | observación 6 |
| Pantallas heredadas (pagos, soporte, configuración, carta) | — | observación 7 |
| Migrar rate limits a Redis | onboarding/auth | observación 13 |
| Redis adapter de Socket.io | realtime | [websockets](../docs/websockets.md) §6 |

## 9. Hitos de commit recientes

| Commit | Qué |
|---|---|
| `22f4f32` | CI Fase A mergeada (#76) |
| `39b58c7` | Repo de specs docs-as-code + trazabilidad (#74) |
| `1a6d3d1` | `CatalogoProvider` extraído (etapa 3, #73) |
| `9771f72` | Producción en Vercel (`development`) verificada |
| `a9c2238` | `TenantProvider` extraído (etapa 2) |
| `909f77b` | Ola plataforma con frontera en 0 |
| `742db8a` | Ola lectura (BI + realtime) |
| `7ed9fcb` | Ola personas (CRM) |
| `e68c843` | Ola operación (inventory + promotions) |
| `e9dabdc` | Ola dinero (receipts + cash + expenses) |
| `eb57d76` | Quick wins seguridad/Sonar (CodeQL, S7773/S8786/S6848, checks PR-only) |
| `eec5632` | Ola salón (mesas, reservas, KDS) |
