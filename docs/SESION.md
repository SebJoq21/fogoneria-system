# SESION — estado entre sesiones

## 2026-11-21 — F6c2: caja, comprobantes y promociones + coordinador de cobro

- **Providers:** `CashProvider` (turnos + movimientos por sucursal con `addMovements`/`reverseMovements` y `remapBranches`), `ReceiptsProvider` (comprobantes + contingencia SUNAT) y `PromotionsProvider` (combos/cupones con `consumeCoupon`/`restoreCoupon`), todos sobre `lib/module-store.ts`.
- **Migración/purga:** el loader de `ModulesProvider` extrae `cashShifts` + `scopes[*].cash`, `receipts` + `sunatContingencia` y `combos` + `coupons` antes del primer guardado; `ErpState` queda en `reservations`, `tickets` y `scopes` (orders/tables). La poda de combos sigue en `ModulesProvider` porque el catálogo se monta debajo de `FeatureProviders`.
- **Coordinador:** `lib/checkout.ts` (puro) + `components/dashboard/providers/checkout.tsx`; orden cuenta → caja → comprobante → cupón → puntos, idempotencia por comprobante `Pagada` y mapas síncronos, compensación inversa si un paso falla. `onCommitted` libera mesa, envía a SUNAT y cierra comandas (post-commit, no se compensa).
- **Tests:** `lib/checkout.test.ts` (9, con fallos entre slices), `lib/module-store.test.ts` (+10), providers de caja/comprobantes/promociones e integración de migración ampliada.
- Verificado: web **942** tests, types, lint, build, paridad 20/20/20/20, boundaries 0 y specs.

## 2026-11-21 — F6c: diseño POS + piloto `AccountsProvider`

- **Diseño:** `docs/plan-f6c-pos.md` — `AccountsProvider` (orders), `CashProvider` (turnos + movimientos por sucursal), `ReceiptsProvider`, `PromotionsProvider` y `CheckoutCoordinator` en capa compartida (`lib/checkout.ts` + hook), con orden del cobro, idempotencia, migración/purga, tests y fases F6c1–F6c3.
- **Piloto (F6c1):** `features/orders/provider.tsx` (`AccountsProvider`/`useAccounts`) dueño de `accounts`, con `fogoneria:orders:v1:<tenant>` y `BroadcastChannel`; el loader de `ModulesProvider` migra/purga `accounts` del `ErpState` y un efecto propio e idempotente remapea slug→UUID (corre con `accounts`, `realBranches` y la sucursal activa, así funcione con sucursales al montar o después; cubierto por dos tests de integración).
- **L1 diferido:** el test de fallo entre `accounts` y `receipts`/`cash` durante el cobro no es viable sin el coordinador (no hay punto de inyección); queda documentado en `docs/plan-f6c-pos.md` §5 y se implementa en F6c2.
- **Sin mover todavía:** abrir/enviar/anular/cobrar siguen en `ModulesProvider` (escriben `scopes` y orquestan caja/comprobantes/CRM). `checkoutAccount` solo cambió `state.accounts` por `accounts` del provider.
- **Estado:** providers fuera de `ModulesProvider`: tenant, orders/cuentas, expenses, inventory, crm y staff (6).
- Verificado: web **910** tests, types, lint, build, `check:modules --strict` 20/20/20/20, `gen:modules --check`, boundaries 0 y `check:specs`.

## 2026-11-21 — Paridad F6b (timeboxed): gastos, inventario y personal fuera de `ModulesProvider`

- **Migrados:** `ExpensesProvider` (gastos demo), `InventoryProvider` (insumos + kardex demo) y `StaffProvider` (roles del maestro de personal), todos sobre `lib/module-store.ts`: persistencia `fogoneria:<id>:v1:<tenant>`, `BroadcastChannel` `fogoneria:<id>-sync:<tenant>` con `sourceId`/dedupe/reset y guardia para no guardar el valor del tenant anterior al cambiar de empresa.
- **Migración legacy:** el loader de `ModulesProvider` purga `expenses`, `ingredients`/`movements` y `roles` del `ErpState` v2 antes del primer guardado (mismo patrón que CRM). `ModulesProvider` reexporta estado y setters para no tocar las vistas.
- **Bloqueados:** `orders` y `cash` siguen en `ModulesProvider` porque dependen de `scopes` por sucursal, cuentas locales y el checkout; `receipts`/`promotions` cuelgan del mismo flujo. No se forzó el split.
- **Estado:** providers fuera de `ModulesProvider`: tenant, crm, expenses, inventory y staff (5/20). PR [#134](https://github.com/kallanka-org/fogoneria-system/pull/134) abierto, sin merge.
- Verificado: web **906** tests, `check:modules --strict` 20/20/20/20, `gen:modules --check`, boundaries 0, types, lint, build y `check:specs`.

## 2026-11-21 — Paridad F6 (timeboxed): shell generado + providers piloto

- **Shell:** `AppSidebar` consume `modules-nav.ts` (grupos/roles/iconos/rutas) con `components/dashboard/module-icons.ts`; `AppTopBar` usa `moduleTitles` generado (incluye `detailTitles`) y `app/layout.tsx` usa `FeatureProviders` de `features/registry.ts`.
- **Providers:** `TenantProvider` movido a `features/tenant/provider.tsx`; `CrmProvider`/`useCrm` (`features/crm/provider.tsx`) dueño del estado demo de clientes: persiste `fogoneria:crm:v1:<tenant>` y sincroniza entre pestañas con `BroadcastChannel` propio ignorando el eco. La migración/purga de `customers` del `ErpState` v2 corre en el loader de `ModulesProvider`, antes de su primer guardado (evita la carrera padre→hijo). `ModulesProvider` reexporta `customers`/`setCustomers`.
- **Resto:** órdenes, cuentas, caja, gastos, inventario, promociones y comprobantes siguen en `ModulesProvider` (F6 completo pendiente).
- Verificado: web **885** tests, `check:modules --strict`, `gen:modules --check`, boundaries 0, types, lint y build.

## 2026-11-21 — Paridad F7: Prisma multi-archivo por módulo

- **Spike:** Prisma 7.10.1 soporta schema multi-archivo (GA desde 6.7, sin flag); `prisma.config.ts:schema` acepta una carpeta y `generate`/`validate`/`migrate diff` la combinan. El `output` del cliente es relativo a la carpeta, así que quedó `../../src/generated/prisma`.
- **Split:** `apps/api/prisma/schema/` con `core.prisma` (generator, datasource, `empresas`/`sucursales`/`usuarios`/`roles_empresa`/`secuencias` + enums compartidos) y 15 `<id>.prisma` (audit, billing, cash, catalog, crm, expenses, inventory, orders, pricing, promotions, receipts, reservations, saas, staff, tables). `auth`, `tenant`, `onboarding`, `bi` y `realtime` no tienen tablas propias.
- **DDL intacto:** `prisma migrate diff --from-schema <monolito> --to-schema prisma/schema` = «No difference detected»; migraciones, RLS y triggers sin tocar. Sin PostgreSQL local en este entorno: `migrate diff --from-migrations` y `test:db` no se pudieron ejecutar (reportado).
- **Gates:** `check:pr-scope` mapea `schema/<id>.prisma` a su módulo (`core.prisma` compartido). Verificado `api test` 683, `check-types`, `build`, `lint` y `check:modules --strict` 20/20/20/20.
- **Docs:** `modelo-datos`, `arquitectura`, `plan-paridad-modulos` (Fase 7), `modules/README`, `AGENTS.md` (raíz y api), `apps/api/README` y `docs/decisiones.md`.
- **Próximo:** completar F6 (providers por módulo); la convención de migraciones `<timestamp>_<id>_<detalle>` se aplica al agregar la primera tabla nueva.

## 2026-11-21 — Paridad F4/F5 + strict 20/20/20/20

- **Hardening:** BOM quitado de 5 páginas de productos; duplicado de `tables` fuera del barrel; `module.ts` en las 8 features que faltaban.
- **F4:** `features/auth`, `tenant`, `onboarding`, `saas` y `billing`; contratos `auth/tenant/onboarding/saas/billing` con alias `plataforma`; `lib/platform-api.ts` concentra el HTTP y la sesión (`lib/session.ts`, BFF, `proxy.ts`) no se movió. `/saas` compone SaaS + `BillingSummary`.
- **F5:** `GET /audit` read-only (admin, Swagger y controller spec), `features/audit` con `/app/auditoria`; `features/realtime` reexporta transporte/hook; `components/erp` eliminado (mozo → `orders`, staff/roles → `staff`).
- **Strict:** `check:modules --strict` **20/20/20/20** verde y cableado en CI; 12 alias deprecados.
- Verificado: api **683** unit + **112** e2e; web **880**; contracts **133**; lint, check-types, builds, boundaries 0 y specs.

## 2026-11-21 — Paridad F3 + hardening

- **Hardening:** `check-pr-scope` con IDs canónicos y alias (catalog/pricing, tables/reservations, platform); `check-specs` mapea las 14 features; `gen:modules --check` corre en CI y normaliza EOL (LF/CRLF); `registry.spec` verifica que `AppModule` importa `MODULE_REGISTRY`; README 9/20 corregido.
- **F3a:** `features/catalog` (Products/Categories/Modifiers + `CartaVirtualView`) y `features/pricing` (PriceListsView); contratos `catalog`+`pricing` con alias `catalogo`; `/app/productos/*` intactas.
- **F3b:** `features/tables` (MesasPage, SalonTablesPage, SalonTablesView) y `features/reservations` (ReservasPage, BookingsModule, BookingsWorkspace); contratos `tables`/`reservations` con alias `mesas`/`reservas`. La UI compartida mapa/agenda queda en `components/dashboard/salon` hasta el split fino.
- **Estado:** manifiestos 20/20, backend 20/20, frontend **14/20**, contratos **13/20** (+10 alias), specs 20/20 canónicas.
- Verificado: api **680** unit + **112** e2e; web **866**; contracts **122**; lint, check-types, builds, `check:boundaries` 0 y `check:specs` OK.

## 2026-11-21 — Paridad de módulos: Fases 0–2

- **Fase 0:** `modules/<id>/module.json` en los 20 módulos; `scripts/gen-modules.mjs` (`pnpm gen:modules`) genera `apps/api/src/modules/registry.ts` (consumido por `app.module.ts`), `apps/web/features/registry.ts` y `apps/web/lib/modules-nav.ts` (el shell aún usa su lista). `check:modules` valida manifiestos y reporta **backend 20/20, frontend 12/20, contratos 9/20 (+7 alias), specs 20/20**; step advisory en `quality`.
- **Fase 1:** `features/crm/module.ts` alimenta el registry y la entrada de nav generada; test `lib/modules-registry.test.ts`; `/app/clientes` intacta.
- **Fase 2:** renombres 1:1 `orders`, `cash`, `receipts`, `expenses`, `inventory`, `promotions`, `staff` en features y contratos. Subpaths antiguos (`caja`, `comprobantes`, `gastos`, `inventario`, `ordenes`, `promociones`, `rrhh`) quedan como alias `@deprecated`. Imports, mocks, specs, `check-specs`, `check-pr-scope`, catálogo y `AGENTS.md` actualizados. Sin splits, providers ni cambios de estado.
- Verificado: api **680** unit + **112** e2e; web **865**; contracts **119**; lint, check-types, builds, `check:boundaries` (0) y `check:specs` OK.

## 2026-11-21 — Plan de paridad de módulos 1:1

- **Auditoría:** 20 módulos backend, **12** features frontend, **14** contratos y **21** specs; no hay paridad.
- **Plan:** `docs/plan-paridad-modulos.md` con catálogo canónico de 20 IDs, mapeo actual→objetivo, estrategia de rebase (generadores, contratos wildcard, Prisma multi-archivo, providers), fases 0-9 y criterios de aceptación.
- **Artefactos:** `modules/catalog.json` (20 módulos, owner/estado/rutas/legado), `scripts/check-module-parity.mjs` (`pnpm check:modules`; `--strict` cuando termine) y `modules/README.md`.
- **Baseline:** backend 20/20, frontend 12/20, contratos 14/20, specs 20/20 (+`plataforma` sobrante). Próximo: Fase 0/1 (metadata por módulo, generadores, piloto `crm`).
- `development` en `ca99e99`, 0 PRs abiertos; sin cambios de código de producción.

## 2026-11-21 — Cierre cobertura 100 % útil y duplicación 0

- **Sonar:** overall **87.2 %** (líneas 90.6, ramas 82.6), nuevo código **93.4 %**; gate **OK**; ratings **A**; 0 vulnerabilidades/code smells/hotspots.
- **Duplicación:** **0.0 %** (0 líneas, 0 bloques) tras extraer `branch-scope`, helpers de filtros, `order-mapping` y tipos de catálogo (#123).
- **API:** 98.04/91.75; **Web:** 89.4/77.3; **contratos:** 100/98.3. Tests: **677 / 832 / 111**.
- **Fase 6:** `test:db` emite lcov, CI publica `coverage-db`, Sonar lo consume; thresholds API 96/90/96/96, Web 85/75/80/85, contratos 100/95/100/100 (#125).
- `development` en `ee054c9`, CI success, **0 PRs abiertos**. Plan cerrado en [`docs/plan-cobertura-100.md`](plan-cobertura-100.md).

## 2026-11-20 — Cierre seguridad/Sonar al 100 %

- **Dependabot:** 46 → **1** (moderada `minimatch` 9, dev tooling); **0 high**. `pnpm audit --audit-level high` es **bloqueante** (#111, #113).
- **CodeQL:** 3 → **0**.
- **Sonar:** cobertura **42.7 → 65.6 %** (nuevo código 81.1 %); gate **OK**; Security/Reliability/Maintainability **A**; 0 vulnerabilidades, 0 code smells, 0 hotspots; duplicación 0.7 %.
- **Secretos:** `.env.example` raíz + Compose sin defaults; README actualizado (#111).
- **Tests:** API **594**, Web **646**, contratos **111** (#115, #116, #117).
- `development` en `0dd2be8`, **0 PRs abiertos**; plan cerrado en [`docs/plan-seguridad-sonar.md`](plan-seguridad-sonar.md).

## 2026-11-20 — Quick wins de seguridad + plan Sonar

- **CodeQL:** 3 alertas corregidas (email sin regex, `execFileSync` en `check-pr-scope`, reporte de carga sin body de red).
- **Sonar:** `S7773`/`S8786`/`S6848` corregidos; `.agents/**` y `apps/web/e2e/**` excluidos; Docker runtime con `USER node` y builds con `--ignore-scripts`.
- **Skipped:** los checks PR-only (`Specs al día`, `Un PR por módulo`) salen a `pr.yml`; el ruleset exige `CI requerido`, `Specs al día` y `Un PR por módulo`.
- **Plan:** [`docs/plan-seguridad-sonar.md`](plan-seguridad-sonar.md) con las olas de Dependabot (46: 19 high), CodeQL, secretos, cobertura 42.1→65 % y gate de Sonar.

## 2026-11-20 — Paridad CI/CD con Taller (G3)

- **Workflows:** `dependency-review` dentro de `ci.yml` (`actions/dependency-review-action@v5`, `fail-on-severity: high`), `verify-api-production.yml` (`deployment_status` de Railway), `verify-web-production.yml` (`status` de Vercel en `development`) y `smoke.yml` (diario 11:00 UTC + manual). El gate `CI requerido` incluye `dependency-review`.
- **Actions:** checkout/setup-node v7, upload-artifact v7, download-artifact v8, sonarqube-scan v8.5; `pnpm/action-setup` v5; CodeQL v4.39.3. Mismo set que Taller, pineado por SHA.
- **GitHub:** `has_wiki=false` para igualar Taller; secret scanning, push protection y Dependabot security updates ya estaban ON; el ruleset mantiene `CI requerido` como required check.
- **No copiado a propósito:** `e2e-real.yml` (LLM real, específico de Taller) y los `sonar-*` temporales (ya sin archivo). Fogoneria cubre E2E determinista en CI + smoke de producción.

## 2026-11-20 — CI: Sonar verde, required check y concurrencia

- **Sonar:** el check externo fallaba en `development` por `new_coverage 1.6` (`scripts/check-specs.mjs`, 187 líneas sin cobertura). Se excluyen del scan `scripts/**`, migraciones SQL, `.github/**`, `apps/api/scripts/**`, configs y specs; el job Sonar instala dependencias para resolver los `tsconfig` de los workspaces. Gate de rama **OK** (`new_coverage 100`), check externo **success** en `adf2709`.
- **Concurrencia:** `cancel-in-progress` solo aplica a PRs; los merges a `development` corren su CI completo. Antes, el merge siguiente cancelaba el run anterior (#84, #95, #96, #100–#102) y el commit quedaba sin validar.
- **Ruleset:** `CI requerido` es required status check del ruleset de `development` (1 aprobación + bypass del dueño). PR #106 mergeado (`adf2709`).

## 2026-11-20 — CI Fase C: E2E Playwright, OpenAPI y Prisma forward-only

- **Playwright:** `@playwright/test@1.65.1` en `apps/web`; `playwright.config.ts` (baseURL 3000, `webServer` con API 3001 + web 3000, 1 worker, retries 0/1, HTML report). `e2e/auth.spec.ts` cubre carga del login, admin→dashboard, mesero→`/app/mozo` (caja bloqueada), navegación admin a mesas/comensales/caja y cajero→`/app/caja` (mesas bloqueadas). `pnpm --filter web e2e` / `e2e:install`; Vitest excluye `e2e/**`.
- **CI:** jobs `e2e` (Postgres 16 + migraciones + roles RLS + FORCE + seed + build + Playwright; artifact `playwright-report`), `openapi` (`openapi:export` + `openapi-spec-validator`; artifact `openapi-spec`) y `migrations` (deploy ×2 + `migrate status` + drift migraciones vs base real). Los tres entran en `needs` del gate `CI requerido`.
- **OpenAPI:** `apps/api/src/swagger.ts` expone `buildSwaggerConfig`/`createOpenApiDocument`; `scripts/export-openapi.mjs` corre sobre `dist/` (tsx no emite `design:paramtypes`) y escribe `docs/openapi.json` (ignorado por git). Validado localmente: OpenAPI 3.0.0, 115 KB, `openapi-spec-validator: OK`.
- **Migraciones:** el CI aplica `db:deploy` dos veces sobre Postgres limpio, verifica `migrate status` y detecta drift con `migrate diff --from-migrations prisma/migrations --to-config-datasource --exit-code` (migraciones en shadow DB vs base real migrada; detecta DDL manual sin el ruido de nombres del SQL histórico). Sin rollback: forward-only. Sin PostgreSQL local no se ejecutó el job completo aquí.
- **Verificado:** web **268** tests, `test:coverage` sin cambios, `check-types`, `lint`, build (49 rutas); api **305** tests, `check-types`, `lint`, build; Playwright local: login real contra el build (`1 passed`) y suite completa con API fake en 3001 (`5/5`, valida cookie/proxy/RBAC); API/web arrancan con los comandos del `webServer` (health 200, login 200); YAML válido con Python. El E2E contra API+PostgreSQL reales queda para CI (no hay Docker/Postgres local).
- **PR:** #94 mergeado (`ddea9f4`) con **todo el CI en verde**, incluido el check externo `SonarCloud Code Analysis`. El gate default pasa porque `.github/**`, `apps/api/scripts/**`, configs y specs quedan fuera del scan y `swagger.ts` gana test unitario (`swagger.spec.ts`); el gate custom `Fogoneria` sigue sin asignar y ya no bloquea. `.github/dependabot.yml` ignora los majors que reabrían ruido (Node 26, vitest 5, `@types/node` 26, actions v7).

## 2026-11-20 — CI Fase B: cobertura y Sonar CI

- **Cobertura:** `apps/api/vitest.config.ts` y `apps/web/vitest.config.mts` con provider v8, reporter `text`+`lcov`, `coverage/lcov.info` y thresholds **API 71/54/64/72**, **Web 57/53/52/58**. Medición final: API 76.02/59.54/69.58/77.55; Web 62.61/58.88/57.91/63.73. `@vitest/coverage-v8` declarado en web + `test:coverage`.
- **CI:** `quality` genera `coverage-api`/`coverage-web`; job `sonar` descarga ambos, corre `sonarqube-scan-action` con `SONAR_TOKEN` y `sonar.qualitygate.wait=true`; `sonar` entra en el gate agregado. `sonar-project.properties` con sources/exclusions/lcov.
- **Trivy:** bloqueante (`exit-code: 1`); el compilador nativo de TypeScript (Go) se elimina de la imagen runtime del API.
- **Gate Sonar:** custom `Fogoneria` creado (coverage overall ≥65) pero SonarCloud rechaza asignarlo por API (`Organization ... is not allowed to modify Quality gates`). Hasta resolver permiso/plan, el gate efectivo es Vitest.
- **PR:** #88 con CI verde; pendiente de aprobación de Seb/Sonny/Jossua/Diego (sin admin bypass). Luego Fase C: Playwright E2E, OpenAPI y Prisma forward-only.

## 2026-11-20 — CI Fase A + Sonar (PR #76)

- **SonarCloud:** `SONAR_TOKEN` quedó como Repository secret; organización **`kallanka-org`**, proyecto **`kallanka-org_fogoneria-system`**. Automatic Analysis corre en PRs y el gate actual (new code) está verde. El token pasó por el chat: rotarlo por un project analysis token.
- **CI Fase A (PR #76, mergeado):** check agregado `CI requerido` (`needs` + `always`, falla por failure/cancelled/skipped), Docker build API/web + hadolint + Trivy advisory, CodeQL `security-extended` semanal, Dependabot agrupado y `pnpm audit` advisory. Sin CODEOWNERS ni cambios de branch protection.
- **Adaptaciones:** Dependency Review no funciona con pnpm sin dependency submission (Dependency Graph 0 manifests, 403); Trivy es advisory por CVEs de la base. Ambos se vuelven bloqueantes en Fase B.
- **Próximo (Fase B):** cobertura web/API + lcov, desactivar Automatic Analysis y pasar a Sonar CI scan con gate de cobertura overall y `qualitygate.wait`; dependency submission; Trivy bloqueante con base actualizada.

## 2026-11-19 — Repo de specs + Fase 4 etapa 3 (catálogo)

- **Specs (docs-as-code):** nuevo `specs/` con `README`, plantilla de módulo, producto (visión, roles, flujos), **21 specs de módulos** (20 backend + `plataforma`), `trazabilidad.md` (44 tareas Jira de S5–S16 + 25 PRs) y operación (despliegue/calidad). `docs/INDICE.md` es la portada de docs. **169 enlaces relativos, 0 rotos**. Deuda detectada: `saas`/`billing` sin e2e, `tenant`/`audit` sin unit, AYCDS-24 al 80 %, SUNAT pendiente de OSE y vigencia de listas de precios por verificar.
- **Fase 4 etapa 3:** `components/dashboard/providers/catalog.tsx` (`CatalogoProvider` + `useCatalogoState`) saca catálogo/precios de `ModulesProvider`, que los reexpone para no tocar las vistas. `features/catalogo` usa el provider directo; la poda de combos pasa a `catalogVersion`. Layout `Theme > Session > Notifications > Tenant > Catalogo > Modules`.
- **Verificado:** web **268** tests, `check-types`, `lint`, build (49 rutas) y `check:boundaries` (0); api `check-types`.
- **Próximo (etapa 4):** gastos → inventario → promociones → CRM → comprobantes → órdenes/cuentas → mesas/reservas → caja/turnos, un paso por PR.

## 2026-11-19 — Deploy Vercel + Railway (handoff)

- **Vercel:** Production Branch = `development`; producción `development@9771f72` en https://fogoneria-system.vercel.app (login limpio, `/recuperar` 200, BFF login 200). Env `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_REALTIME_URL` apuntan a Railway, `SESSION_SECRET` y `SESSION_COOKIE_SECURE=true`. La branch se cambia vía `PATCH /v9/projects/{id}/branch` (el MCP/`update_project` lo descarta).
- **Railway:** proyecto `test-fogoneria`, servicios `fogoneria-system` (API) y `Postgres 18`. API con `apps/api/Dockerfile` desde la raíz del monorepo, preDeploy `npx prisma migrate deploy`, healthcheck `/api/v1/health`, watchPatterns de apps/api + packages/{contracts,kernel} + lock/workspace. Schema **`fogoneria`** (`public` vacío), 14 migraciones y seed demo.
- **RLS:** `fogoneria_rls` (sin BYPASSRLS) y `fogoneria_saas` (con BYPASSRLS) provisionados con `apps/api/prisma/rls-roles.ts` (#69); `DATABASE_URL_RLS`/`DATABASE_URL_SAAS` apuntan a esos roles y `DATABASE_URL` queda en `postgres` solo para migraciones. Sin `FORCE ROW LEVEL SECURITY`. Verificado: health/login/tenant/branches/catálogo/tablero/BI 200.
- **Riesgo:** antes de usuarios reales, rotar `JWT_SECRET`/`SESSION_SECRET` y decidir si el seed demo sigue público (hoy la contraseña demo es conocida).
- Runbook completo y 8 gotchas en [`docs/despliegue.md`](despliegue.md).
- **Próximo:** Fase 4 etapa 3 (bajar el estado de negocio de `ModulesProvider` a las features).

## 2026-11-19 — Modularización Fase 4, etapa 2 (`TenantProvider`)

- **Objetivo:** extraer de `ModulesProvider` la empresa, las sucursales y la sucursal activa, sin mover todavía el estado de negocio ni cambiar la API que consumen las ~20 vistas.
- **Hecho:**
  - `apps/web/lib/tenant-scope.ts`: `resolveActiveBranch` (usuario → guardada vigente → primera real → `todas`), `matchesBranch` (slug/UUID del dataset demo) y `branchIdsOf`; **8 tests** en `lib/tenant-scope.test.ts`.
  - `components/dashboard/providers/tenant.tsx`: `TenantProvider` + `useTenant` (`tenant`, `company`, `branches`, `realBranches`, `branchIds`, `activeBranch`, `activeBranchId`, `isGeneral`, `writeBranchId`, `loading`, `error`, `setActiveBranch`, `refreshTenant`). Hidrata `/tenant` + `/tenant/branches` con `Promise.all` + `AbortController`, **una vez por `empresaId`**, con snapshot atado a la empresa; persiste `fogoneria:branch:<empresaId>`; con sesión nunca cae a demo y en error deja `tenant: null` + vista general.
  - `SessionProvider` expone `ready` (fin de la hidratación) sin quitar campos. `app/layout.tsx`: `Theme > Session > Notifications > Tenant > Modules`.
  - `ModulesProvider` ya no declara snapshot de tenant, `activeBranchId`, memo de `company`/`branches`, la carga de `/tenant` ni `setActiveBranch`: los consume de `useTenant()` y los reexpone en su `value`. `branchOf` sigue leyendo `state.scopes` y `prepareOps` se dispara al llegar `realBranches`.
- **Anti-flash:** la demo solo se pinta con `ready && !hasSession`; con sesión y aún hidratando, `loading: true`, `branches: []` y el rol operativo conserva su sucursal para no escribir en `todas`.
- **Verificado:** web **265** tests (32 archivos), `check-types`, `lint` (estilos OK), build OK; `check:boundaries` OK (baseline 0); api `check-types` OK. Sin dependencias nuevas y sin tocar `lib/session.ts`, `proxy.ts` ni el BFF.
- **Pendiente (etapa 3):** vaciar el estado de negocio de `ModulesProvider` hacia las features, empezando por catálogo → gastos → inventario; `useModules` sigue como fachada de compatibilidad y las features nuevas usan `useTenant`.
- **Riesgo conocido:** durante la hidratación del tenant las llamadas con `sucursalId` pueden salir sin filtro (vista agregada) y se repiten al resolverse la sucursal; no hay cambio visual, solo un request extra.

## 2026-11-19 — Login limpio + recuperación por soporte

- **Objetivo:** dejar el portal solo de inicio de sesión y ofrecer un camino honesto cuando se olvida la contraseña.
- **Hecho:**
  - `LoginPage` sin “Cuentas demo por rol” ni CTA “Regístrate” (la ruta `/onboarding` sigue existiendo); nuevo enlace “¿Olvidaste tu contraseña?” → `/recuperar`.
  - `lib/auth.ts` sin `demoUsers`/`findDemoUser`/`DEMO_PASSWORD` (solo los usaba el login); se conservan `ROLE_LABEL`, `ROLE_HOME`, mapeos de rol y RBAC. El login sigue en `useModules().login` → `/api/session`.
  - `lib/support.ts` (`SUPPORT_EMAIL`, `supportMailto` con `URLSearchParams` y espacios como `%20`) + `support.test.ts` (3 casos). No hay endpoint de reset ni envío automático: el formulario abre el cliente de correo (`mailto:`) con asunto y cuerpo prellenados.
  - `features/plataforma/RecoverPage.tsx` (shell del login, correo opcional, “Solicitar ayuda”, correo de soporte visible y “Volver a iniciar sesión”), exportada en el índice; ruta delgada `app/recuperar/page.tsx` con metadata. `/recuperar` no está en el matcher de `proxy.ts`: es pública.
- **Verificado:** web **268** tests (33 archivos), `check-types`, `lint` (estilos OK) y build OK (49 rutas, `/recuperar` estática); `check:boundaries` OK (baseline 0). Sin dependencias nuevas y sin tocar `/onboarding`, el BFF ni `proxy.ts`.

## 2026-11-19 — Modularización Fase 4, etapa 1 (Session + Notifications)

- **Objetivo:** extraer de `ModulesProvider` la sesión y los avisos sin cambiar la API pública que consumen las ~20 vistas (`useModules().login/logout/currentUser/hasSession/notify/...`).
- **Hecho:**
  - `components/dashboard/providers/session.tsx`: `SessionProvider` + `useSession` (`currentUser`, `hasSession`, `login`, `logout`). Login en `/api/session`, logout en `/api/session/logout`, persistencia `fogoneria:user` y limpieza de `fogoneria:branch:<empresaId>`.
  - `components/dashboard/providers/notifications.tsx`: `NotificationsProvider` + `useNotifications` en memoria (`notifications`, `hasUnread`, `notify`, `clearUnread`); `components/ui/Toast.tsx:4` lo consume. Helper puro `lib/notifications.ts` (ids únicos + dedupe del mismo ms).
  - `lib/session-state.ts`: `parseSessionUser`, `storeSessionUser`, `clearSessionUser`, `branchStorageKey`, `tenantKeyOf`.
  - `ModulesProvider.tsx:437-438` toma ambos contextos y los reexpone en su `value` (`:1736`); ya no declara estado de sesión/avisos. `app/layout.tsx:35-39` anida `Session > Notifications > Modules`. `ErpState` deja de persistir `notifications`/`hasUnread`.
- **Verificado:** web **257** tests (31 archivos), `check-types`, `lint` (estilos OK), build OK (48 rutas); `check:boundaries` OK (baseline 0); api `check-types` OK. Sin dependencias nuevas.
- **Auditoría (12/12 PASS):** la etapa es apta para merge; se añadieron 2 tests de `storeSessionUser`/`clearSessionUser` (escritura y limpieza de usuario, sucursal y cookies planas).
- **Pendiente (etapa 2):** `TenantProvider` + vaciar el estado de negocio de `ModulesProvider` hacia las features. `useModules` sigue siendo la fachada de compatibilidad.
- **Nota:** los toasts ya no se persisten ni se sincronizan entre pestañas (decisión de la etapa: estado en memoria).

## 2026-11-19 — Modularización Fase 3, ola plataforma (PR #64, mergeado)

- **Contratos:** `packages/contracts/src/plataforma.ts` (`RolWeb`, `UsuarioSesion`, `Empresa`, `Sucursal`, `EstadoEmpresa`, `PlanEmpresa`, `EmpresaSaas`, `MetricasSaas`, `OnboardingInput`, `OnboardingResultado`, `RespuestaLogin`, etiquetas, `estadoEmpresaTone`, `rolDesdeApi`, `isValidRuc`, `validarOnboarding`, `toOnboardingPayload`) + subpath `./plataforma`. El login **no** se movió: `/api/session` y `lib/session.ts` siguen siendo la autoridad de la cookie HttpOnly.
- **Backend:** `auth`, `tenant`, `saas`, `billing` y `onboarding` exponen `index.ts` público; `app.module.ts` los importa por el `index.js`, `realtime.module.ts` toma `AuthModule` de `../auth/index.js`, y `billing`/`onboarding`/`saas` pasan a `../audit/index.js`. Sin cambios de reglas (JWT/Passport, bcrypt, rate limit, cron de morosidad, RLS, transacciones).
- **Baseline 4 → 0** (`--write-baseline`): salen `realtime → auth` y los tres `audit` directos. Ratchet en cero, sin excepciones nuevas.
- **Web:** `features/plataforma/` (`api.ts` SDK + contratos para onboarding/SaaS y mapeo de tenant listo para Fase 4, `LoginPage`, `OnboardingPage`, `DropZone`, `SaasPage`, `index.ts`, `plataforma.test.ts`). Rutas `/`, `/onboarding` y `/saas` delgadas. Retirados `lib/onboarding-api.ts` y `lib/saas-api.ts`. No se tocaron `lib/session.ts`, `lib/backend.ts`, `proxy.ts`, `app/api/session/**` ni `app/api/backend/**`.
- Verificado: web **244** tests (29 archivos), `check-types`, `lint` (estilos OK), build OK (48 rutas); api **305** unit + **112** e2e + `check-types` + build; contracts `check-types`; `check:boundaries` OK (**0** históricas, 0 nuevas).
- Próximo: **Fase 4** — vaciar `ModulesProvider` hacia contextos de plataforma (`Session`, `Tenant`, `Notifications`) y conectar `plataformaApi.empresa()/sucursales()`; después, ola de mozo.

## 2026-11-19 — Modularización Fase 3, ola lectura (PR #62, mergeado)

- **Contratos:** `packages/contracts/src/bi.ts` (`RangoBi`, `Pnl`, `PnlDia`, `PlatoTop`, `CobroMetodo`, `ReporteBi`, `calcularMargen`, `etiquetaMetodoPago`) y `tiempo-real.ts` (`EventoTiempoReal`, `SobreEvento<T>`, payloads de orden/mesa, `REALTIME_EVENT`, `salaEmpresa`/`salaSucursal`/`salaOrden`) + subpaths `./bi` y `./tiempo-real`. La API agrega `@fogoneria/contracts` como dependencia de workspace y el Dockerfile copia `packages/contracts` (Node 24 ejecuta el `.ts` del contrato en runtime).
- **Backend:** `bi/index.ts` y `realtime/index.ts` públicos (`BiModule`/`BiService`, `RealtimeModule`/`RealtimeService` + contrato; `OrdersGateway` no se exporta). `app.module.ts` importa ambos por el `index`; `orders.service.ts` y `orders.sla.cron.ts` usan `../realtime/index.js`. `realtime.types.ts` reexporta el contrato con alias históricos. Sin cambios de rooms, eventos ni SQL de BI.
- **Web:** `features/bi/` (`api.ts` SDK+contratos, `hooks.ts` con `useBi` y rango de 7 días de Lima, `AnaliticasPage`, `index.ts`, `bi.test.ts`); `/app/analiticas` solo importa la feature; se retiraron `lib/bi-api.ts` y su test. `lib/realtime.ts` importa tipos/constantes de `@fogoneria/contracts/tiempo-real` y sigue siendo transporte compartido (sin feature web).
- Baseline **6 → 4** (`--write-baseline`): salen `orders → realtime` ×2; queda `realtime → auth` para plataforma.
- Verificado: web **230** tests (28 archivos), `check-types`, `lint` (estilos OK), build OK (48 rutas); api **305** unit + **112** e2e + `check-types` + build; `check:boundaries` OK (4 históricas, 0 nuevas).
- **Auditoría (11/12 PASS, 1 doc):** la tabla de olas ya marca lectura ✅; specs de órdenes tipan contra `realtime/index.js`; el barrel de contratos queda prohibido en la API (Node type stripping) y `websockets.md` describe la paridad de eventos.
- Próximo: ola **plataforma** (`realtime → auth` y auditoría directa en billing/onboarding/saas), después Fase 4 (vaciar `ModulesProvider`).

## 2026-11-19 — Modularización Fase 3, ola personas (PR #60, mergeado)

- **Contratos:** `packages/contracts/src/crm.ts` (segmentos, cliente y detalle, movimientos de puntos, config de lealtad, inputs, etiquetas y `validarAjustePuntos`) + subpath `./crm`. El segmento lo calcula el servidor; la web solo lo pinta.
- **Backend:** `crm/index.ts` público (`CrmModule`, `CrmService`, `ConfigLealtad`); `app.module.ts` importa por el `index` y `crm.service.ts` usa `../audit/index.js`. Sin cambios de reglas, worker de consumos ni triggers. Baseline **7 → 6** (`--write-baseline`).
- **Web:** `features/crm/` (`api.ts` SDK+contratos, `ClientesPage` con búsqueda/filtro/ficha/ajuste, `LoyaltyPage` demo, `LoyaltyHubPage`, `index.ts`) y `crm.test.ts` (12). `ModuleGate` y las rutas `/app/clientes` y `/app/modulos/fidelizacion/regla` importan la feature. Retirados `lib/crm-api.ts` y su test (los reemplaza la feature).
- **Acoplamiento restante:** `customers`/`coupons` demo siguen en `ModulesProvider` (Fase 4); `LoyaltyPage` aún no consume `crmApi.config()` (cliente listo); el ajuste manda `sucursalId` para `ADMIN_GLOBAL`. Backend en baseline: `orders → realtime` ×2, `realtime → auth` y `audit` directo en billing/onboarding/saas.
- Verificado: **224** web tests (28 archivos), `lint` (estilos OK), `check-types`, build OK (48 rutas); api **305** unit + **112** e2e + check-types; `check:boundaries` OK (baseline **6**, 0 nuevas).
- **Auditoría (12/12 PASS):** sin hallazgos funcionales; solo se ajustó el conteo de tests de `crm.test.ts` (12).
- Próximo: ola **lectura** (`bi` + `realtime`), después Fase 4 (vaciar `ModulesProvider`).

## 2026-11-19 — Modularización Fase 3, ola operación (PR #58, mergeado)

- **Contratos:** `packages/contracts/src/inventario.ts` (semáforo, kardex, filtros, `ConsumoResultado`, etiquetas, `movimientoCantidadLabel`) y `promociones.ts` (combos, cupones, cupón resuelto, reglas horarias, `estadoCupon`, `etiquetaDescuento` — el importe del descuento lo calcula el servidor) + subpaths `./inventario|./promociones`. `caja` e `inventario` comparten `etiquetaTipoMovimiento`: el root conserva el de caja y el inventario va por su subpath (export explícito en `src/index.ts`).
- **Backend:** `inventory/index.ts` (`InventoryModule`, `InventoryService`, `ConsumptionResult`) y `promotions/index.ts` (`PromotionsModule`, `PromotionsService`, `CuponResuelto`) públicos; `orders.module`/`orders.service` importan por el `index`. `app.module.ts` registra **InventoryModule y PromotionsModule explícitamente** (antes promociones solo se montaba por órdenes). Auditoría de inventory/stock-alerts/promotions por `../audit/index.js`; sin cambios de reglas, triggers ni tablas.
- **`PRICING_PORT` en promociones:** `PromotionsService` inyecta el puerto y `PromotionsModule` importa `PricingModule`; `precioReferencia`/anti-inflación salen de `resolvePrices` y el módulo ya no lee `precios_platos`/`listas_precios`. El spec de promociones se adaptó al nuevo constructor (4.º argumento).
- **Web:** `features/inventario/` (`api.ts` SDK+contratos, `InventoryPage` con el maestro demo de AYCDS-24, `MovementsPage` con semáforo y kardex de la API, `InventoryHubPage`) y `features/promociones/` (`api.ts` SDK para combos/cupones/validación/schedule, `CombosPage`, `PromocionesPage`). `ModuleGate` importa el hub desde la feature; las rutas de stock, movimientos, combos y promociones solo importan su feature. Se retiraron `lib/inventory-api.ts` y su test (los cubre la feature).
- **Acoplamiento restante:** insumos, combos y cupones siguen en `ModulesProvider` (Fase 4); `CombosPage`/`PromocionesPage` aún no consumen `promocionesApi` (cliente listo). El kardex y el semáforo ya leen la API con sesión. Backend en baseline: `orders → realtime` ×2, `realtime → auth` y `audit` directo en billing/crm/onboarding/saas.
- Verificado: **217** web tests (28 archivos), `lint` (estilos OK), `check-types`, build OK (48 rutas); api **305** unit + **112** e2e + check-types; `check:boundaries` OK (baseline **14 → 7**, 0 nuevas).
- **Auditoría (12/12 PASS):** `MovementsPage` usa `semaforoDeStock` (un solo camino para el resumen) y `horaDeApi` documenta que Prisma serializa `time` como ISO con `Z` sin convertir la hora de pared de Lima; su test lo fija.
- Próximo: ola **personas** (`crm`), después Fase 4 (vaciar `ModulesProvider`).

## 2026-11-19 — Modularización Fase 3, ola dinero (PR #56, mergeado)

- **Contratos:** `packages/contracts/src/caja.ts`, `comprobantes.ts` y `gastos.ts` (turnos/movimientos/arqueo/cobro, comprobantes con `desgloseIgv` y SUNAT «pendiente de OSE», gastos con categorías y pago en efectivo) + subpaths `./caja|./comprobantes|./gastos`. Los re-exporta `src/index.ts`.
- **Backend — puertos:** `ORDERS_PORT`/`OrdersPort` (`markPaid`) provisto por `OrdersModule` con `useExisting`; `CASH_PORT`/`CashPort` (`egresoDeGasto`) por `CashModule`. `cash` y `expenses` ya no importan services/módulos internos: consumen el `index` público y el token. `receipts|cash|expenses/index.ts` públicos; `app.module.ts` importa por el `index`. Auditoría de los tres por `../audit/index.js`. Sin cambios de reglas, triggers ni tablas. Baseline **21 → 14** (`--write-baseline`).
- **Web:** `HubBlocks`/`ChartCard` movidos a `components/dashboard/workspace-ui.tsx` (9 imports actualizados). Features `caja` (`CajaPage`, `CheckoutModal`, `api.ts` SDK+contratos), `comprobantes` (`ComprobantesPage`, `comprobanteARecibo`) y `gastos` (`GastosPage`, cliente `gastosApi` listo para AYCDS-27). Rutas `/app/caja`, `/app/comprobantes` y `/app/gastos` solo importan la feature; guard y cabecera intactos.
- **Bug corregido en el camino:** la anulación de comprobantes con sesión mandaba la serie (`B001-…`) a `POST /receipts/:id/void`; ahora la página resuelve el UUID desde la fila (la tabla sigue mostrando la serie).
- **Acoplamiento restante:** el estado de negocio sigue en `ModulesProvider` (Fase 4); `MozoView` (aún en `components/erp/`) sigue cobrando con `checkoutAccount` del provider y el `CheckoutModal` queda en `features/caja` para que la ola de mozo lo importe desde ahí; `lib/cash-api.ts` y `lib/receipts-api.ts` quedan como clientes legados (solo los usan sus tests). Backend conserva en baseline `orders → inventory/promotions/realtime` y `→ audit` en billing/crm/inventory/onboarding/promotions/saas.
- **Caja sin `hooks.ts`:** `CajaPage` consume `useModules()` directamente porque el provider sigue siendo el dueño del estado (mismo criterio que `features/ordenes`); no se duplica estado.
- Verificado: **199** web tests (27 archivos), `lint` (estilos OK), `check-types`, build OK (48 rutas); api **305** unit + **112** e2e + check-types; `check:boundaries` OK (14 históricas, 0 nuevas, 0 resueltas pendientes).
- **Auditoría (11/12 PASS):** los specs de caja/gastos tipan contra `OrdersPort`/`CashPort` (no contra services); el CDR/resumen diario simulados están gateados por `!hasSession`, así que cumplen la decisión de AYCDS-46 p2 (mock solo en demo).
- Próximo: ola **operación** (`inventory → promotions`) con el mismo patrón; después Fase 4 (vaciar `ModulesProvider`).

## 2026-11-19 — Modularización Fase 3, ola salón (PR #54, mergeado)

- **Contratos:** `packages/contracts/src/mesas.ts`, `reservas.ts` y `ordenes.ts` (estados, inputs, validadores, etiquetas, SLA y helpers de Lima) + subpaths `./mesas|./reservas|./ordenes`.
- **Backend:** `tables/index.ts`, `reservations/index.ts` y `orders/index.ts` públicos; `app.module.ts` importa por el `index`. `orders.service.ts` usa `../audit/index.js`. Sin cambios de lógica. Baseline de fronteras **22 → 21** (`--write-baseline`).
- **Web:** `features/salon/` (`api.ts` SDK+contratos, `hooks.ts` sobre `ModulesProvider`, `MesasPage`, `ReservasPage`, `SalonTablesPage`, `BookingsModule` y `SalonTablesView` movidos) y `features/ordenes/` (`api.ts` solo lectura de `/orders/board`, `hooks.ts`, `OrdersBoardPage` y KDS movido). Rutas de mesas/reservas/órdenes/cocina solo importan la feature; guard, cabecera y redirect del maestro intactos.
- **Hooks compartidos:** `lib/orders-realtime.ts`, `lib/orders-board.ts` (fetcher inyectable; default cliente de la API) y `lib/use-now.ts`; `MozoView`/`AccountPanel` solo cambian el import.
- **Acoplamiento restante:** el estado sigue en `ModulesProvider` (Fase 4); mozo/caja permanecen en `components/erp/*`; backend conserva en baseline `cash → orders` y `orders → inventory/promotions/realtime`.
- Verificado: **179** web tests (24 archivos), `lint` (estilos OK), `check-types`, build OK (48 rutas); api **305** unit + **112** e2e + check-types; `check:boundaries` OK (21 históricas, 0 nuevas).
- **Auditoría (10/10 tras correcciones):** `contracts/ordenes.ts` gana `OrdenInput`/`OrdenItemInput` + `validarOrden` (el alias queda en `lib/orders-api.ts`); `salon.test.ts` cubre estados/formas desconocidos; `docs/websockets.md` apunta a `lib/orders-realtime.ts`.
- Próximo: ola **dinero** (`receipts → cash → expenses`) con el mismo patrón; después Fase 4 (vaciar `ModulesProvider`).

## 2026-11-19 — Modularización: Fases 0–2 + auditoría de la Fase 1

- **Fase 0 (PR #48, mergeado):** `@fogoneria/kernel` (money/fechas Lima), `@fogoneria/sdk` (cliente BFF) y `@fogoneria/contracts` (RRHH). `scripts/check-module-boundaries.mjs` con baseline de 24 acoplamientos históricos y job CI **Fronteras de módulos**. `pr-scope` reconoce `features/<m>` y `contracts/src/<m>.ts`. Documento `docs/MODULARIZACION.md` con el diagnóstico (5 acoplamientos backend + 5 frontend).
- **Fase 1 (PR #49, mergeado):** `apps/web/features/rrhh/` con `api.ts` (SDK + contratos), `hooks.ts` (`useAttendance`, `useShifts`), `AttendancePage`, `ShiftsPage` y demo aislado. Las rutas de asistencia y turnos solo importan la feature. `apps/api/src/modules/staff/index.ts` como API pública.
- **Fase 2 (PR #50, mergeado, etiqueta `multi-modulo`):** `packages/contracts/src/catalogo.ts`; `apps/web/features/catalogo/` con `api.ts` (SDK, lectura), `hooks.ts` (`useCatalogo` sobre el provider) y las 4 vistas de catálogo movidas; `catalog/index.ts` y `pricing/index.ts` públicos; `summaries` movido a `components/dashboard` para que la feature no importe `components/erp`.
- **Auditoría de la Fase 1 (10/10 PASS) y correcciones aplicadas:** borrado `lib/staff-api.ts` (código muerto) y `bi-staff-api.test.ts` → `bi-api.test.ts`; `audit/index.ts` público (staff lo importa sin violar frontera); baseline 24 → **23**; test de `toTurno`; docs sincronizados (`AGENTS.md`, `PLAN-MODULOS-Y-PROPIEDAD.md`, `MODULARIZACION.md`, este archivo).
- **Independencia lograda:** RRHH toca solo `features/rrhh/**` + rutas + `staff/**`; catálogo, `features/catalogo/**` + rutas de productos + `catalog|pricing/**`. Ninguna feature importa `components/erp/*` ni otra feature.
- Verificado: **163** web tests (22 archivos), **305** API unit, **112** e2e, `lint` 3/3, `check-types` 6/6, `check:boundaries` OK (22 históricas, 0 nuevas), build web OK.
- **PricingPort cerrado (PR #52):** `OrdersService` inyecta `PRICING_PORT` (token de Nest del módulo Precios) y recibe `{ listaId, precios }` en lote; ya no toca `precios_platos`, `listas_precios` ni `PricingService`. 3 tests nuevos del puerto y baseline **22**.
- **Deuda conocida:** el estado del catálogo sigue en `ModulesProvider` hasta la Fase 4; `CartaVirtualView` sigue en `components/erp/catalog`; `orders.module` mantiene imports históricos de inventory/promotions (baseline).
- Próximo: Fase 3, ola salón (`tables → reservations → orders`).

## 2026-11-18 — Auditoría por módulos + reglas de revisión y alcance

- **Auditoría completa** (API + web + datos + infra): 20 módulos backend (17 con controlador, 106 endpoints), 33 rutas de app, 302 unit / 112 e2e / 109 DB / 148 web, lint/types/build en verde. Sin hallazgos nuevos de código.
- **Estado por módulo:** catálogo, precios, órdenes/KDS, mesas/reservas, caja, comprobantes, CRM, BI, SaaS y onboarding al 90–100 %; inventario 80 %, RRHH 80 %, gastos 50 %, promociones 40 %; pagos/soporte/configuración/carta son mock sin tarea.
- **Modelo acordado:** propiedad **colectiva** (todos trabajan en todo) con **un PR = un módulo**. La regla «nadie aprueba su propio PR» (CODEOWNERS + protección de rama) queda **diferida** hasta cerrar el avance masivo.
- **Implementado:** `.github/pull_request_template.md` (módulo + checklist), `scripts/check-pr-scope.mjs` y job de CI **`Un PR por módulo`** (excepción con etiqueta `multi-modulo`). **CODEOWNERS y protección de rama: diferidos.**
- **Entregable:** `docs/PLAN-MODULOS-Y-PROPIEDAD.md` actualizado: inventario, reglas de revisión/protección de rama, regla de alcance con ejemplos, guardia semanal, modelo de issues por componente, 14 observaciones y plan de 3 semanas.
- **Pendiente:** avance masivo por módulos; al cerrarlo, crear `CODEOWNERS` y activar la protección (1 aprobación + Code Owners + checks). Crear los 15 componentes en Jira y convertir las observaciones 1–8 en issues.

## 2026-11-11 — Demo levantada y seed idempotente

- **Stack de demo corriendo:** PostgreSQL 16 (`localhost:5433`, contenedor `fogoneria-postgres`), API en `http://localhost:3001` (Swagger `/api/docs`) y web en `http://localhost:3000`.
- **Fix real:** el seed fallaba al re-ejecutarse con `DB_TURNO_CERRADO` (el turno demo quedaba cerrado por una corrida de caja y el trigger prohíbe insertar movimientos). Ahora, si el turno no está `ABIERTO`, el seed omite los movimientos de ejemplo: es idempotente y no reabre una caja cerrada.
- **Verificado:** login por el BFF (200 + cookies `fogoneria.session`/`fogoneria.token`), BI por BFF (ventas 288, margen -312), y 12 rutas del ERP en 200. RBAC: mesero `/app/caja` → 307 y `/app/mozo` 200; cajero `/app/caja` 200 y `/app/productos` 307; superadmin `/saas` 200; cocina `/app/caja` 307.
- **Base limpia para la demo (2026-11-11):** `pnpm --filter api db:demo:clean` borra lo operativo y los datos de ejemplo y conserva cuentas (1 empresa, 3 sucursales, 6 usuarios), catálogo (4 categorías, 6 platos, 3 listas con 18 precios), 14 mesas y los insumos/recetas. Respaldos previos en `%TEMP%\opencode\backups`; también se eliminaron los 3 tenants de prueba (`Smoke` y dos sin nombre) que quedaban soft-deleted.
- **Credenciales demo:** `admin@mirestaurante.com`, `caja@mirestaurante.com`, `mesero@mirestaurante.com`, `cocina@mirestaurante.com`, `super@fogoneria.com` — contraseña `Fogoneria123!`.
- Próximo paso: recorrido de demo por rol; después 24 (20 %) y 27.

## 2026-11-10 — Auditoría + AYCDS-45 (RRHH y analíticas) al 100 %

- **Auditoría** de `development` (`4ed719a`): árbol limpio, 0 ramas sin mergear, sin marcas de deuda fuera de lo generado; `lint` y `check-types` 3/3; api **302** unit, **112** e2e, **109** DB; web **143**; build OK. Sin hallazgos nuevos.
- Hecho (rama `feat/aycds-45-ui-rrhh`): `lib/staff-api.ts` y `lib/bi-api.ts`; `StaffAttendanceView` marca asistencia del día (Presente/Tardanza/Falta) y lista/confirma pozos; `AnaliticasView` pinta P&L, serie de 7 días y ranking de platos desde `/bi`. Ambas caen al demo sin sesión.
- **Hallazgo del smoke:** `GET /staff/attendance` daba **400** para `ADMIN_GLOBAL` (sucursal obligatoria, igual que mesas/gastos/puntos); los clientes y la vista ahora mandan `sucursalId`.
- Verificado: 148 web tests (+5 de BI/staff), lint/types/build OK; smoke real: P&L (ventas 288, gastos 600, margen -312, propinas 105), serie 2 días, top 1 plato; staff 6 empleados, marca TARDANZA y pozo REPARTIDO 105.
- **Cierre de la 45:** `StaffTurnosView` (asignar/quitar turno por empleado, día y bloque) y bloque de **cobros por método** en analíticas. Smoke real: turno creado y quitado, métodos EFECTIVO 198.
- Próximo paso: cerrar ese 20 % o AYCDS-27 (gastos/combos/promos).

## 2026-11-10 — AYCDS-40 (CRM en la UI) lista para revisión

- Objetivo: conectar el maestro de clientes a la API del CRM (lista, ficha y puntos).
- Hecho (rama `feat/aycds-40-ui-crm`): `lib/crm-api.ts` (listar/buscar/filtrar, ficha con movimientos, alta y ajuste de puntos) y `ClientesView` contra la API: búsqueda por nombre/teléfono, filtro por segmento, ficha con los últimos movimientos y ajuste (cortesía/canje/caducidad). Sin sesión conserva el demo.
- **Hallazgo del smoke:** el ajuste de puntos devolvía **400** para `ADMIN_GLOBAL` porque `sucursalId` es obligatorio en el body (AYCDS-31); la vista ahora manda `activeBranchId`. También se corrigió el tipo de retorno: la API devuelve el **cliente recalculado**, no el movimiento.
- Verificado: 5 tests del cliente (143 web), lint/types/build OK; smoke real: 7 clientes, ficha con `ultima_visita`, ajuste +5 y canje de 3 con saldo recalculado.
- Nota: el `id` numérico del modelo de la UI se deriva de visitas+puntos porque la tabla usa `Customer`; la clave real de la fila es el teléfono.
- Próximo paso: AYCDS-45 (RRHH + analíticas) o AYCDS-27 (gastos/combos/promos).

## 2026-11-10 — AYCDS-24 (kardex + semáforo) al 80 %

- Objetivo: empezar las tareas de UI con la API ya cerrada.
- Hecho (rama `feat/aycds-24-inventario`): **API** `GET /inventory/movements` (kardex con insumo, unidad, folio y ventana de fechas, `limit` ≤500) en `InventoryService.listMovements`; **web** `lib/inventory-api.ts` (stock + kardex) y `InventoryMovementsView` contra la API con el semáforo (`agotados/bajos/óptimos`) arriba; fallback demo sin sesión.
- Verificado: 5 unit del servicio, 3 del cliente web, 138 web tests, lint/types/build OK; smoke real: movimientos con folio `ORD-050009`, `tipo=VOLADOR` → 400, semáforo 1/1/4.
- **Falta de la 24 (20 %)**: el maestro de insumos, los ajustes y las recetas de `InventoryModule` siguen en demo; necesitan endpoints de insumos/stock por insumo antes de conectarse.
- Próximo paso: AYCDS-40 (CRM) o 27 (gastos/combos/promos), misma receta: cliente API + vista.

## 2026-11-10 — Cierre de S11–S16: 46 p2, filtro de errores y acta 50

- Objetivo: cerrar las tareas que quedaban en revisión y dejar el sistema listo para el acta.
- **Merges:** #36 (35 BI), #37 (13 semáforo) y #38 (46 p2). Jira **46 → Listo** y **13 → Listo**; comentario de corrección en 39.
- **46 p2 (PR #38):** `ComprobantesView` lista/emite/anula contra `/receipts`; emisión solo sobre comanda `PAGADA` con importe del servidor; SUNAT «pendiente de OSE» (sin CDR simulado, el mock queda en demo). `lib/receipt-mapping.ts` + 7 tests.
- **Bug encontrado y corregido (PR #38):** anular sin turno de caja devolvía **500** (`DB_REVERSION_SIN_TURNO`). Nuevo `DatabaseExceptionFilter` global que mapea los `DB_*` de `docs/errores-db.md` a 409/422/404/403 y RLS `42501` a 403; solo atrapa errores de Prisma.
- **AYCDS-50 (acta):** `docs/acta-qa-aycds-50.md` con matriz CT-FG-03, evidencia por PR, smoke de cierre y 5 hallazgos; firma de Sebastián pendiente. TAREAS S11–S12 al **100 %**.
- Verificado en `development` (`b34bfd7`): api **297** unit, **112** e2e, **109** DB; web **135**; lint/types/build OK; smoke 46 p2 **8/8**.
- Próximo paso: PR del acta; después quedan las tareas de UI/QA del equipo (24, 27, 40, 45, 49, 52).

## 2026-11-10 — Merges de S13–S16, AYCDS-13 y arranque del cierre

- Objetivo: cerrar la revisión pendiente y seguir con la última tarea de API de S13–S14.
- **Merges:** #28 (11), #29 (19), #31 (17), #32 (31), #33 (33), #34 (docs), #35 (38) y #36 (35) aprobados y mergeados; Jira 11/17/19/31/33/38 → **Listo** con evidencia. 46 y 13 quedan En curso.
- **AYCDS-13** (rama `feat/aycds-13-semaforo-stock`): `GET /inventory/stock` (semáforo desde `v_stock_bajo`), `POST /inventory/alerts/check` y cron cada 10 min; tabla `alertas_stock` (una alerta vigente por insumo y sucursal, se borra al reponer) y webhook HMAC `X-Fogoneria-Signature`. Sin `STOCK_WEBHOOK_URL` no envía: deja `notificado_at = null` y auditoría.
- **Code review de la 13:** URL y secreto pasan de `process.env` a `ConfigService` (se leen una vez, igual que `DATABASE_SCHEMA`); los tests inyectan la config.
- Verificado (13): 12 unit, 5 e2e, 6 DB y smoke real 13/13; `migrate deploy` en `fogoneria_test` y `fogoneria_db`.
- 46 parte 2 **hecha**: `ComprobantesView` lista, emite (solo comanda `PAGADA`) y anula contra `/receipts`; SUNAT visible como «pendiente de OSE», sin CDR simulado. `lib/receipt-mapping.ts` + 7 tests. 135 web tests, lint, types y build OK.
- Próximo paso: mergear #37 (hecho) y el PR de la 46 p2; después 50 (acta).

## 2026-11-07 — AYCDS-35 (API de BI) implementada, en espera de #38

- Objetivo: exponer los reportes de P&L, ranking y cobros por método sobre las vistas de AYCDS-38.
- Hecho (rama local `feat/aycds-35-bi-api`, **encima de** `feat/aycds-38-vistas-bi`): módulo `bi` con `GET /bi/pnl`, `/bi/pnl/daily`, `/bi/top-dishes` y `/bi/sales-by-method` (solo `ADMIN_GLOBAL` y `GERENTE_SUCURSAL`); rango obligatorio con tope de 366 días, sucursal del token y agregado de empresa para el admin; los importes salen como number redondeado a 2.
- Clave: las consultas corren **dentro de la transacción del request** (`tenantContext.get()?.tx`); las vistas son `security_invoker` y fuera de esa tx devuelven 0 filas. No se filtra `empresa_id` en el SQL: lo pone RLS.
- Verificado: 194 unit (+14), 70 e2e (+7), 5 DB nuevos contra las vistas, `check-types` y smoke real **16/16** (P&L, serie diaria, ranking, métodos, 403 de mesero y cajero, 400 de rango invertido y >12 meses, y acotado por sucursal).
- **PR abierto** tras el merge de #38: rebase a `development` y PR de un solo commit (la tarea consume esas vistas).
- Próximo paso: AYCDS-13 (semáforo + webhook) cuando entre #28; AYCDS-46 parte 2 espera decisión del usuario sobre el mock SUNAT.

## 2026-11-07 — AYCDS-38 (vistas BI + backup/restore) lista para revisión

- Objetivo: cerrar la tarea sin dependencias del rango (vistas de BI y respaldo probado) mientras siguen abiertos #28–#34.
- Hecho (rama `feat/aycds-38-vistas-bi`, desde `development`): migración `20261107120000_vistas_bi` con 6 vistas (`v_bi_ventas_dia`, `v_bi_gastos_dia`, `v_bi_comprobado_dia`, `v_bi_pl_dia`, `v_bi_platos_top`, `v_bi_cobros_metodo`) en día de Lima; `db:backup`/`db:restore` en PowerShell (dump con `docker cp`, verificación de conteos y bloqueo sobre `fogoneria_db`); `docs/bi-vistas.md` y `docs/respaldo-recuperacion.md` (RPO ≤24 h / RTO ≤30 min).
- **Hallazgo de seguridad:** `fogoneria_app` es superusuario con `BYPASSRLS`, así que una vista creada por él **no aplica RLS** (las 4 vistas del esquema inicial dejaban ver datos de otra empresa). Se corrigió con `security_invoker = true` en todas, verificado con un test DB de aislamiento.
- **Hallazgo de datos:** el primer `pg_restore` falló por 150 000 líneas de `detalles_orden` huérfanas del volumen perf: `reset-perf.sql` borraba con `session_replication_role = replica`, que **no ejecuta los CASCADE**. Ahora borra las hijas explícitamente.
- Verificado: 9 tests DB nuevos (`bi.db-spec.ts`), `migrate deploy` en `fogoneria_test` y `fogoneria_db`, backup 0,28 MB en 0,4 s y restore en 3,3 s con 6 vistas BI y conteos coherentes.
- Pendiente: revisión de #28–#34 y de este PR; Jira 38 a En revisión con la evidencia. La ficha `docs/TAREAS-SEMANAS-15-16.md` se actualiza cuando entre el PR #34 (evita PRs apilados).
- Próximo paso: AYCDS-35 (API de BI) cuando entre #31 (gastos), consumiendo estas vistas; AYCDS-13 cuando entre #28.
## 2026-11-07 — Ficha de S15-S16 y espera de merges

- Objetivo: cerrar el hueco documental de la última fase mientras se aprueban los seis PRs abiertos (#28, #29, #30, #31, #32, #33). Ninguno se mergeó todavía.
- Hecho: `docs/TAREAS-SEMANAS-15-16.md` con las 8 tareas del rango (31, 33, 35, 38, 40, 45, 49, 52), fichas de las de API, dependencias, ruta crítica (`38 → 35 → 45 → 49 → 52`), orden de PRs y DoD. Refleja el estado real: 31 y 33 en revisión con su evidencia; 35 bloqueada por 17 (PR #31) y 38.
- Auditoría: `development` sin cambios (`d1689d7`), árbol limpio, `pnpm lint` 3/3.
- Pendiente: que se aprueben y mergeen los seis PRs; después mover 11/17/19/31/33 a **Listo** en Jira y seguir con la decisión de la 46 parte 2 (mock SUNAT) y la 13 (semáforo, necesita la 11).
- Próximo paso: al mergear #31 o #28, arrancar AYCDS-38 (vistas BI) o AYCDS-13 según lo que entre primero.
## 2026-11-06 — AYCDS-33 (RRHH y propinas) lista para revisión

- Objetivo: cerrar la última tarea backend de David que no dependía de nada abierto.
- Hecho (PR-F1, `feat/aycds-33-rrhh-propinas`): módulo `staff` con personal (lista con rol), plan de turnos (listar/asignar/quitar, único por empleado+día+bloque), asistencia (upsert por empleado y día con `PRESENTE/TARDANZA/FALTA/DESCANSO`) y propinas: `POST /staff/tips/calculate` suma `ordenes.propina` del día y reparte entre los presentes con reparto exacto al céntimo; `POST /staff/tips/:id/confirm` lo marca `REPARTIDO` (idempotente).
- Verificado: 198 unit (+18), 73 e2e (+10), 73 DB (+7), `check-types` y smoke real **17/17** (dos empleados, propina 105, reparto 105 exacto entre 2, 409 al recalcular, confirm idempotente y 403 del mesero).
- Hallazgo: el smoke falló al principio porque `ADMIN_GLOBAL` no lleva sucursal; `calculate` exige `sucursalId` en el body (igual que mesas, gastos y puntos).
- Pendiente: revisión de #28 (11), #29 (19), #30 (46 p1), #31 (17), #32 (31) y este.
- Próximo paso: AYCDS-35 (BI) cuando entre la 17, o la parte 2 de la 46.
## 2026-11-06 — AYCDS-31 (CRM: segmentos y puntos) lista para revisión

- Objetivo: seguir con la siguiente tarea de David de S15–S16 sin esperar merges.
- Hecho (PR-E1, `feat/aycds-31-crm`): módulo `crm` con comensales (listado por segmento y búsqueda, alta con teléfono único, edición, ficha con movimientos), historial y ajuste manual de puntos, configuración de lealtad (`GET/PATCH /crm/config`) y `POST /crm/process`.
- **Worker de consumos**: cron cada 5 minutos que busca comandas `PAGADA` con cliente y sin movimiento `GANANCIA`, otorga `total × puntos por sol` y recalcula visitas y segmento desde las fuentes. No toca el cobro: un fallo del CRM no tumba una venta; es idempotente por movimiento de la orden.
- **Segmento derivado**: `visitas` = comandas pagadas y `NUEVO/FRECUENTE/VIP` por umbrales de `config_lealtad`; repetir el proceso no infla nada.
- Verificado: 200 unit (+20), 73 e2e (+10), 71 DB (+5), `check-types` y smoke real **15/15** (cliente NUEVO → cobro con cliente → worker 36 puntos → visita 1 → reproceso 0 → canje 26 → base `1/26/NUEVO`).
- Hallazgo corregido en el smoke: `ADMIN_GLOBAL` no lleva sucursal en el token, así que el ajuste de puntos ahora acepta `sucursalId` en el body (misma regla que mesas y gastos).
- Pendiente: revisión de #28 (11), #29 (19), #30 (46 p1), #31 (17) y este; AYCDS-13 espera el merge de la 11.
- Próximo paso: AYCDS-33 (RRHH) o AYCDS-13 al mergear la 11.
## 2026-11-06 — AYCDS-17 (gastos → caja) lista para revisión

- Objetivo: avanzar la siguiente tarea de David de S13–S14 sin esperar merges.
- Hecho (PR-D1, `feat/aycds-17-gastos`): módulo `expenses` con listado (estado, categoría, vencidos, sucursal), resumen (por pagar, vencido, pagado del mes), alta, edición y **pago**. En efectivo el egreso entra en `movimientos_caja` con `gasto_id` vía `CashService.egresoDeGasto` (turno abierto obligatorio); con tarjeta/transferencia/Yape solo cambia el estado. Un gasto pagado en caja no se edita (409, y `DB_GASTO_PAGADO` en la base) ni se borra.
- Verificado: 193 unit (+13), 71 e2e (+8), 71 DB (+5), `check-types` y smoke real **16/16** (gasto 120 en efectivo → esperado de caja 380 y diferencia 0; transferencia sin movimiento; doble pago 409; edición de pagado 409; resumen 600 del mes).
- Nota: la ficha de S13–S14 vive en la rama del PR #28 (aún abierta); al mergearse se actualiza la fila de AYCDS-17 allí.
- Pendiente: revisión de #28 (11), #29 (19), #30 (46 parte 1) y este; AYCDS-13 espera el merge de la 11.
- Próximo paso: AYCDS-13 (semáforo + webhook) al mergear la 11, o la parte 2 de la 46.
## 2026-11-06 — S11-S12 cerrado y arranque de S13-S14 (kardex)

- Objetivo: cerrar la Fase A y empezar las tareas de David de S13–S14.
- **Fase A cerrada**: #23 (39), #24 (34), #25 (41) y #26 (36) fueron aprobados y mergeados. Jira 39/34/41/36 → Listo con comentario de evidencia. CI de `development` en verde tras cada merge (2m25 / 1m48 / 1m50 / 2m19).
- Auditoría en `development`: `pnpm lint` 3/3, `check-types` 3/3, api **180** unit, **63** e2e, **66** DB, web **108** y build OK.
- Hecho (PR-B1, `feat/aycds-11-kardex`): módulo `inventory` con `InventoryService.consumeOrder()`, invocado desde `OrdersService` al pasar a `ENTREGADO`. Explota recetas (y combos), es idempotente por `SALIDA`, omite platos sin receta y descuenta con concurrencia optimista **sin bajar de cero** (la base tiene un `CHECK` de no negativos).
- Hallazgo: mi primer intento creaba el stock en negativo y la base lo rechazó (`23514`). Corregido con `Math.max(0, …)` + reintento optimista.
- Verificado: 188 unit (+8), 72 DB (+6), `check-types` y smoke real **9/9** (Lomo Saltado: 12 → 11 kg, 3 movimientos, reintento sin descontar).
- Hecho (PR-B2, `feat/aycds-19-combos-promos`): módulo `promotions` con combos (CRUD + **bloqueo anti-inflación** y `precioReferencia`/`ahorro`), cupones (CRUD, código único, validación de porcentaje), `POST /promotions/coupons/:codigo/validate`, `GET /promotions/schedule` con reglas horarias. **`POST /orders` ya no acepta `descuento`**: recibe `cuponCodigo`, el servidor calcula, consume el uso con actualización condicional y registra `canjes_cupones`.
- Verificado: 216 unit (+26), 72 e2e (+9), 108 web; `check-types` y smoke real **14/14** (combo inflado 400, cupón 10 % sobre 44 → 4.40, orden 39.60, canje registrado, `descuento` inyectado 400).
- Hecho (PR-C1, `feat/aycds-46-ui-caja`): `lib/cash-api.ts` y `lib/receipts-api.ts` (turno, arqueo, movimientos, cobro, comprobantes) y `CajaView` contra la API: turno y arqueo del servidor, movimientos del turno, historial, apertura/cierre y cobro de comandas `ENTREGADO` con pago parcial y propina. Sin sesión mantiene el demo. 20 tests nuevos en los clientes.
- **AYCDS-46 queda al 60 %**: falta `ComprobantesView`, que hoy tiene el ciclo SUNAT mock (CDR, resumen diario, contingencia) que la API no expone; sustituirlo perdería esa demo. Decisión pendiente: listar/emitir/anular por API dejando SUNAT como «pendiente de OSE», o esperar la integración real.
- Verificado: 128 tests web, `check-types`, `lint` y `build` OK.
- Pendiente: revisión de PR-B1 (11), PR-B2 (19) y PR-C1 (46 parcial); AYCDS-13 espera el merge de la 11; AYCDS-17 (gastos) ya está desbloqueada.
- Próximo paso: cerrar la parte 2 de la 46 (comprobantes) y luego AYCDS-17.

## 2026-11-06 — Fase A (S11-S12): 30 y 36 listas para revisión

- Objetivo: cerrar las 7 tareas de S11-S12 en orden `30 → 39 → 34 → 36 → 41 → 46 → 50`, un PR por tarea desde `development`, con revisión de otra persona.
- Hecho (PR-A1, `feat/aycds-30-kds-sla`, **mergeado** #22): tablero `/orders/board` con SLA de 20 min, `order.sla` y cron; medición e índice parcial (`docs/explain-orders.md` §7).
- Hecho (PR-A5, `feat/aycds-36-comprobantes`): módulo `receipts` con emisión solo sobre comanda `PAGADA`, correlativo por serie en `secuencias` (`B001/F001/T001`), RUC (módulo 11) / DNI validado, IGV derivado y anulación con motivo. La reversión de caja/stock queda a los triggers de AYCDS-39 (#23). Smoke real 14/14.
- **Corrección de proceso:** las ramas de 34 y 41 se habían creado encima de 39 (PRs apilados). Se rebasaron sobre `development` y se force-pushearon (#24 y #25 quedaron con su diff limpio).
- Verificado: 162 unit, 52 e2e, 54 DB, `check-types`, `lint` y `build` OK.
- Pendiente: revisión y merge de #23 (39, Sonny), #24 (34), #25 (41, Joshua) y el PR de la 36.
- Próximo paso: AYCDS-46 (UI caja/comprobantes) cuando 34 y 36 estén en `development`; AYCDS-50 después.

## 2026-11-06 — Fase A (S11-S12): plan y AYCDS-30 (KDS con SLA)

- Objetivo: cerrar las 7 tareas de S11-S12 en orden `30 → 39 → 34 → 36 → 41 → 46 → 50`, con un PR por tarea desde `development`.
- Hecho (PR-0, `chore/sprint-11-12-plan-ci`): `docs/TAREAS-SEMANAS-11-12.md` (fichas, dependencias, ruta crítica, DoD), 3 decisiones en `docs/decisiones.md` y `api test:e2e` agregado al CI (no se ejecutaba).
- Hecho (PR-A1, `feat/aycds-30-kds-sla`):
  - `GET /orders/board?dias&limite&sucursalId` con las 4 columnas, `alertaSla` y métricas (abiertas, fuera de SLA, espera y preparación medias) en una llamada.
  - `apps/api/src/modules/orders/orders.sla.ts`: SLA de 20 min desde `confirmacion_at ?? ingreso_at`; única fuente del cálculo (umbrales 19/20/21 cubiertos).
  - `OrdersSlaCron` cada minuto: marca `alerta_sla` una sola vez y emite `order.sla` (`RealtimeService`/gateway/`docs/websockets.md`).
  - Migración `20261106120000_ordenes_sla_indice`: índice parcial `idx_ordenes_sla_pendiente` (el barrido pasó de 83 ms a 0,072 ms).
  - Medición del tablero en `docs/explain-orders.md` §7: 1,56 ms acotado vs 81 ms sin ventana. **No se tocó RLS** (decisión: medir primero).
- Verificado: `check-types`, `lint`, `build` OK; 146 unit (+12), 43 e2e (+5), 49 DB (+6) y `EXPLAIN` real con el dataset de 50k órdenes (`perf:seed`, luego `perf:reset`).
- **Cambio de proceso:** los PR ya no se mergean solos. Se abren con reviewer (el dueño de la tarea) y los mergea otra persona; Jira pasa a Listo después del merge.
- Hecho (PR-A4, `feat/aycds-41-ui-kds`): `getOrdersBoard()` en `lib/orders-api.ts`, `kdsBoardFromApi`/`minutosDeSla`/`slaTone` en `lib/order-mapping.ts`, hook `useOrdersBoard` y `OrdersView` contra el tablero (contadores, SLA en vivo, refresco por `order.created`/`order.updated`/`order.sla`). Sin sesión cae al estado local del demo.
- Pendiente: revisión y merge de PR-A4 (41, Joshua). Los PR #23 (39) y #24 (34) siguen abiertos; la 36 no depende del merge para programarse, pero la 46 sí espera la 34.
- Próximo paso: AYCDS-36 (comprobantes) y, después, la 46 cuando la 34 entre.

## 2026-10-29 — Sprint 3: AYCDS-26 (mapa de mesas + agenda de reservas) implementada

- Objetivo: ejecutar la tarea de Diego (AYCDS-26) sobre `development` (`d969cb2`), sin tocar lo de Sebastián (AYCDS-28). Además, dejar el checklist del sprint con el estado real y aclarar la autoría de AYCDS-22.
- Docs previos (misma sesión):
  - `docs/TAREAS-SEMANAS-9-10.md`: checklist por responsable al día (14/16/20/22/25 cerradas; 26 en curso; 28 pendiente) y nota de que los commits firmados como **Gabriel** en AYCDS-22 son de **Sonny De La Cruz**.
  - `docs/TAREAS-SEMANAS-5-8.md`: se marcaron 53, 55, 57, 62, 63 y 65 como cerradas y se quitaron notas de "falta verificación" ya resueltas.
- Hecho (rama `feat/aycds-26-mapa-agenda-diego`):
  - `apps/web/lib/tables-api.ts` completo (`list`, `create`, `update`, `status`, `delete`) y `apps/web/lib/reservations-api.ts` nuevo (`list` por día, `create`, `update`, `status`).
  - `apps/web/lib/table-mapping.ts`: UUID→`Table.id` estable (FNV-1a), estados (`MANTENIMIENTO` → bloqueada + `reservada`), forma/etiqueta/número, folio, `POR_CONFIRMAR`, día y hora de Lima con offset `-05:00`.
  - `ModulesProvider`: `hasSession`, `liveTables`/`liveReservations` con `tablesLoading`/`tablesError` y `reservationsLoading`/`reservationsError`; `refreshTables()` y `refreshReservations(fecha?)`; hidratación al iniciar sesión o cambiar de sucursal.
  - `BookingsModule`: mapa con colores reales y bloqueo visible, agenda por fecha con crear/editar/confirmar/cancelar/no-show/llegó (abre cuenta sobre la mesa real), bloqueo/liberación y refresco por `order.created`/`order.updated`/`table.status`.
  - `SalonTablesView`: CRUD real (número, capacidad, zona, forma) y columna de sucursal en la vista agregada.
  - `deriveTableStatus` respeta `OCUPADA` del servidor; `Table` gana `apiId`/`branchId`/`blocked`; `Reservation` gana `code`/`tableApiId` y el estado `por_confirmar`.
  - Tests nuevos: `table-mapping.test.ts`, `tables-api.test.ts`, `reservations-api.test.ts` (26 pruebas).
- Verificado: `check-types` OK, `test` 98/98 (14 archivos), `lint` OK (`check-styles: OK`), `build` OK (48 rutas).
- Pendiente: smoke real con `docker compose up --build` (este entorno **no** tiene Docker ni `psql`) y PR a `development`. El código no se mergea sin revisión.
- Próximo paso: revisar el PR de AYCDS-26; después queda AYCDS-28 (Sebastián) y los heredados 58/66.

## 2026-10-28 — Sprint 3: AYCDS-25 (app del mesero) cerrada y mergeada

- Objetivo: conectar el panel del mesero (`/app/mozo`) y el KDS a la API real, sin mocks en el flujo de comandas.
- Hecho (rama `feat/aycds-25-app-mesero-joshua`, desde `development` en `3353036`):
  - `apps/web/lib/orders-api.ts` (list/get/create/status sobre el BFF; el payload nunca manda precio) y `lib/tables-api.ts` (`GET /tables` para elegir mesa UUID).
  - `apps/web/lib/order-mapping.ts`: única traducción API↔UI (7 estados, folio `ORD-000123` como `id`, `apiId` para los PATCH, `mesero_id` → `waiterId`, modificadores → `notas`).
  - `ModulesProvider`: con sesión real `orders` sale de `GET /orders` (`ordersLoading`/`ordersError`/`refreshOrders`); `createOrderFromAccount` (`POST`) y `advanceOrder` (`PATCH`); el modo demo queda intacto sin sesión.
  - `MozoView`/`AccountPanel`: mesa real, envío asíncrono con resultado visible, "Mis comandas" por `mesero_id`, entregar/anular según el servidor, badge de canal en vivo y recarga por eventos.
  - `OrdersView` (KDS): confirmar y marcar listo con `PATCH`, sin mutar estado local.
  - Tests: 72 web (17 nuevos en `order-mapping.test.ts` y `orders-api.test.ts`).
- Pendiente: smoke real con API + PostgreSQL como evidencia adicional (el CI y las suites 72 web + 127 api ya están en verde).
- Próximo paso: AYCDS-26 (Diego) desde `origin/development` con `b56865b`; `ModulesProvider` ya expone `orders`/`refreshOrders`/`advanceOrder` y hay que rebasar su rama.

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
