# Calidad — gates y verificación

**Última revisión:** 2026-11-20. Lo que **bloquea** un merge es lo que corre en CI; lo demás es apoyo local.

## 1. Gates locales (raíz)

| Comando | Qué valida | Falla si |
|---|---|---|
| `pnpm lint` | ESLint web + `check-styles.mjs` (tokens/estilos) + Oxlint API + lint de paquetes | estilo crudo, regla de lint |
| `pnpm check-types` | `tsc --noEmit` en api, web y contratos | error de tipos |
| `pnpm check:boundaries` | `scripts/check-module-boundaries.mjs` sobre el baseline | import nuevo entre módulos (baseline **0**) |
| `pnpm build` | Next build + Nest build + paquetes | error de compilación |
| `pnpm --filter api test` | Vitest unit (33 archivos, 305 tests, en `src/modules` + `src/common`) | test rojo |
| `pnpm --filter api test:e2e` | 15 archivos con Prisma mockeado (realtime levanta Socket.io real) | contrato HTTP/WS roto |
| `pnpm --filter api test:db` | 18 `*.db-spec.ts` contra PostgreSQL real (RLS forzado) | aislamiento, trigger o migración rota |
| `pnpm --filter web test` | 33 archivos Vitest, 268 tests (features, lib, proxy, route handlers) | test rojo |
| `pnpm --filter api test:cov` | unit + cobertura v8 con thresholds **71/54/64/72** | cobertura bajo el ratchet |
| `pnpm --filter web test:coverage` | 268 tests + cobertura v8 con thresholds **57/53/52/58** | cobertura bajo el ratchet |
| `pnpm --filter web e2e` | Playwright (Chromium) contra API + web + PostgreSQL sembrado; login real y RBAC por rol | flujo de navegador roto |
| `pnpm --filter api openapi:export` | compila la API y escribe `docs/openapi.json` desde `AppModule` sin abrir puerto | documento OpenAPI inválido |
| `pnpm check:specs` | `scripts/check-specs.mjs`: cobertura, estructura y enlaces de `specs/**` + diff del PR contra la spec del módulo | módulo/feature sin spec, enlace roto o código sin spec actualizada |

> `test:db` requiere `DATABASE_URL_TEST` a una base **descartable**: los specs truncan `empresas` y `leads_cotizaciones`.

> `e2e` requiere build previo (`pnpm build`), PostgreSQL migrado/sembrado y `SESSION_COOKIE_SECURE=false` sobre HTTP local. Playwright arranca la API (3001) y la web (3000) con `webServer`; `pnpm --filter web e2e:install` instala Chromium.

## 2. CI (`.github/workflows/ci.yml`)

Concurrencia: los runs de PR se cancelan al pushear de nuevo (`cancel-in-progress` solo en `pull_request`); un push a `development` (merge) **nunca** se cancela, para que el commit de merge tenga su CI completo.

Job **`Lint, tipos y pruebas`** — corre en `push` a `development` y en PR a `development`/`main`:

```text
pnpm install --frozen-lockfile
pnpm audit --audit-level high      (bloqueante: altas/críticas)
pnpm check:boundaries
pnpm --filter api db:generate
pnpm --filter api db:deploy        (Postgres 16 service)
pnpm --filter api db:rls:roles
pnpm --filter api db:rls:force
pnpm lint
pnpm check-types
pnpm --filter api test:cov
pnpm --filter api test:e2e
pnpm --filter api test:db
pnpm --filter web test:coverage
pnpm build
```

Sube artifacts `coverage-api` y `coverage-web` (`lcov.info`) para el job de Sonar.

Job **`Un PR por módulo`** — solo en `pull_request`:

```text
node scripts/check-pr-scope.mjs origin/<base> <head-sha>
```

- Revisa que el diff toque **un solo módulo**. Archivos compartidos (docs, CI, prisma, tests, design system) no cuentan.
- Excepción controlada: etiqueta **`multi-modulo`** (debe justificarse en el PR).

Job **`Specs al día`** — solo en `pull_request`:

```text
node scripts/check-specs.mjs --base origin/<base>
```

- Exige una spec por módulo/feature, las secciones mínimas de la plantilla y enlaces relativos válidos.
- Si el diff toca código de un módulo/feature, exige que cambie su spec; los cambios compartidos (providers, layout, contracts, kernel, sdk, prisma) exigen `specs/trazabilidad.md` o una spec de módulo.
- Excepción `SPECS_SKIP=1` (o `--skip`) justificada en el PR; el reviewer valida que la spec describa el cambio real, no solo que el archivo se haya tocado.

Job **`E2E (Playwright)`** — push y PR:

```text
PostgreSQL 16 service (fogoneria_test)
pnpm --filter api db:generate
pnpm --filter api db:deploy
pnpm --filter api db:rls:roles
pnpm --filter api db:rls:force
pnpm --filter api db:seed
pnpm --filter web e2e:install          (Chromium + deps)
pnpm build
pnpm --filter web exec playwright test
```

- `playwright.config.ts` arranca API (3001) y web (3000) con `webServer`; sin sesión no hay demo.
- Tests: login real admin/mesero/cajero, dashboard y RBAC (un rol no abre rutas ajenas).
- Publica `playwright-report` como artifact con `if: always()`.

Job **`OpenAPI`** — push y PR:

```text
pnpm --filter api openapi:export                 (nest build + docs/openapi.json)
python3 -m venv "$RUNNER_TEMP/openapi-venv"
"$RUNNER_TEMP/openapi-venv/bin/pip" install openapi-spec-validator
"$RUNNER_TEMP/openapi-venv/bin/openapi-spec-validator" docs/openapi.json
```

- El export corre sobre `dist/` (mismo artefacto desplegado), sin abrir puerto ni conectar a la base.
- Publica `openapi-spec` (`docs/openapi.json`) como artifact.

Job **`Migraciones forward-only`** — push y PR:

```text
pnpm --filter api db:generate
psql ... CREATE DATABASE fogoneria_shadow
pnpm --filter api db:deploy              (1.ª vez)
pnpm --filter api db:deploy              (2.ª vez: idempotencia)
pnpm --filter api exec prisma migrate status
pnpm --filter api exec prisma migrate diff --from-migrations prisma/migrations \
  --to-config-datasource --exit-code
```

- El drift aplica las migraciones en una **base shadow** aparte y las compara con la base real ya migrada: detecta DDL manual o migraciones editadas sin bloquearse por nombres de constraints/índices del SQL histórico (exit 2 si difieren).
- `SHADOW_DATABASE_URL` apunta a `fogoneria_shadow` (Prisma 7 rechaza usar la misma base).
- No hay `down`: la migración es la fuente ejecutable; la estrategia es forward-only.

Job **`Dependency review`** — push y PR (en push no revisa nada, para que el gate no vea un job skipped):

```text
actions/dependency-review-action@v5.0.0
  fail-on-severity: high
  comment-summary-in-pr: on-failure   (solo pull_request)
```

- Compara las dependencias que agrega/cambia el PR contra el Dependency Graph (ya poblado por pnpm) y bloquea severidad `high`.
- Permisos del job: `contents: read`, `pull-requests: write`.

Job **`Imágenes Docker y Trivy`** — push y PR:

```text
hadolint (API, web) con .hadolint.yaml (failure-threshold: error)
docker build -f apps/api/Dockerfile -t fogoneria-api:ci .
docker build -f apps/web/Dockerfile -t fogoneria-web:ci .
trivy image (OS/base, CRITICAL/HIGH, ignore-unfixed)   (bloqueante: exit-code 1; paquetes npm vía pnpm audit/Dependabot)
```

Job **`CI requerido`** — solo PR, `needs: [quality, docker, dependency-review, sonar, e2e, openapi, migrations]`, `if: always()`; falla si algún job queda en `failure`, `cancelled` o `skipped`. El ruleset de `development` exige **`CI requerido` + `Specs al día` + `Un PR por módulo`** (1 aprobación + bypass del dueño). Los dos últimos viven en `pr.yml` (solo `pull_request`) para que los pushes a development no muestren jobs skipped.

Workflow **`CodeQL`** (`.github/workflows/codeql.yml`) — push/PR a `development`/`main` + cron semanal, `javascript-typescript` con `security-extended` y `security-events: write`.

Workflow **`PR`** (`.github/workflows/pr.yml`) — solo `pull_request`: `Un PR por módulo` (alcance del PR) y `Specs al día` (spec del módulo tocado). Ambos son required checks del ruleset.

Plan de seguridad y Sonar: [`docs/plan-seguridad-sonar.md`](../../docs/plan-seguridad-sonar.md).

**Dependabot** (`.github/dependabot.yml`) — npm (raíz pnpm), github-actions y Docker (API/web), semanal, grupos minor+patch.

Sonar **`SonarCloud`** — push/PR, `needs: quality`; instala dependencias (el analizador TS resuelve los `tsconfig` de los workspaces), descarga `coverage-api`/`coverage-web`/`coverage-contracts`, ejecuta `SonarSource/sonarqube-scan-action` con `SONAR_TOKEN` y `sonar-project.properties` (`qualitygate.wait=false` temporal). Automatic Analysis está desactivado: este job es la única vía de análisis. Sin token (forks/Dependabot) el scan se omite y el job no falla. El análisis excluye `.github/**`, `scripts/**`, `apps/api/scripts/**`, migraciones SQL, configs y specs: son infra validada por sus propios jobs y no deben arrastrar `new_coverage`.

> **Gate de cobertura:** el gate custom `Fogoneria` (coverage overall ≥65, ratings, duplicación y hotspots, sin `new_coverage`) está creado en SonarCloud, pero la organización rechaza asignarlo por API (`Organization ... is not allowed to modify Quality gates`). Mientras no se asigne, el **check externo** usa el gate default Sonar way (`new_coverage ≥80`) y puede quedar rojo en PRs de infra; el gate efectivo de cobertura es el de **Vitest** (API 71/54/64/72; Web 57/53/52/58).
>
> **2026-11-20:** cobertura overall Sonar **65.6 %** (nuevo código 81.1 %), 0 vulnerabilidades/code smells/hotspots, ratings A; gate default **OK**. Tests: API 594, Web 646, contratos 111.

> **Dependency Review:** activo como job del CI (`fail-on-severity: high`). El Dependency Graph ya está poblado por `pnpm-lock.yaml`; `pnpm audit --audit-level high` es bloqueante dentro de `quality` (0 altas; queda 1 moderado de `minimatch` 9 en dev tooling).

Workflows de producción (post-deploy y vigilancia):

- **`Verify API production`** (`verify-api-production.yml`): `deployment_status` de Railway (`test-fogoneria / production`) o manual; falla si el deploy falló y verifica `/api/v1/health` (`status=ok`) y `/api/v1`.
- **`Verify web production`** (`verify-web-production.yml`): `status` de Vercel en `development` o manual; falla si el deploy falló y verifica `/` (200 + `lang="es"`) y `/recuperar` (200).
- **`Daily production smoke`** (`smoke.yml`): diario 11:00 UTC + manual; API health/info y web `/` + `/recuperar`.

Los tres viven fuera del CI a propósito: un deploy que espera los checks del commit no debe esperar al job que verifica ese deploy.

## 3. Qué cubre cada suite

| Suite | Cobertura real |
|---|---|
| Unit API | reglas de servicio, SLA, validadores, guards, secuencias, RUC, filtro de errores DB |
| e2e API | contratos HTTP por módulo + Socket.io real con aislamiento A/B |
| DB | RLS, soft-delete, inmutabilidad, email global, kardex, caja, comprobantes, propinas, BI, concurrencia de folios |
| Web | RBAC/proxy, sesión/firma, BFF, ticket WS, deduplicación, mapeos API↔UI y clientes de cada feature |
| Playwright | login real, redirección por rol y bloqueo de rutas ajenas (humo E2E full-stack) |
| OpenAPI | contrato exportado desde `AppModule` y validado contra el estándar OpenAPI 3 |
| Migraciones | deploy idempotente, estado y drift entre migraciones aplicadas y base real |
| Dependency review | nuevas dependencias del PR contra el graph, bloquea severidad high |
| Verify production | health/info del API y home/recuperación del web tras cada deploy |
| Daily smoke | API y web desplegados, todos los días |

## 4. Gates no automatizados (revisión humana)

- **Un PR = un módulo** y revisión por otra persona (CODEOWNERS diferido; el ruleset tiene 1 aprobación + bypass admin por decisión del dueño).
- Smoke funcional por rol antes de demo/sustentación (mesero → cocina → caja).
- Migraciones: revisar `prisma validate` y que la migración sea la fuente ejecutable; el CI verifica deploy doble y drift entre migraciones aplicadas y base real.
- Cambios de contrato: actualizar `packages/contracts`, la spec del módulo y `docs/decisiones.md` si es arquitectónico.

## 5. Despliegue

- Vercel build + Railway deploy se validan con healthcheck y la verificación rápida de [despliegue](despliegue.md).
- El CI no despliega: Railway usa `Wait for CI` y `preDeploy` de migraciones.

## 6. Deuda de calidad conocida

- No hay cobertura mínima por módulo.
- El E2E de Playwright cubre autenticación y RBAC; el flujo completo mesa→cocina→caja→comprobante sigue pendiente (AYCDS-49).
- `docs/openapi.json` se genera en CI y no se versiona; si se necesita diff de contrato, publicarlo como artifact o commitearlo con una decisión explícita.
- El job de migraciones prueba deploy doble y drift entre migraciones aplicadas y base real; no prueba rollback: la estrategia es forward-only.
- `tenant` no tiene unit test; `saas`, `billing` y `audit` no tienen e2e propio (`realtime` sí lo tiene).
- `test:db` no corre en local sin PostgreSQL y base descartable.
- El gate de estilos exime `app/demo/*`.
- **Dependency Review** activo en CI (`fail-on-severity: high`); `pnpm audit --audit-level high` es bloqueante y hoy queda 1 moderado (`minimatch` 9 vía `@typescript-eslint`).
- **Trivy** es bloqueante para **OS/base** (`exit-code: 1`) desde Fase B; el compilador nativo de TypeScript se excluye de la imagen runtime. Los CVEs de paquetes npm de la imagen se cubren con `pnpm audit`/Dependabot y quedan como deuda de actualización de dependencias.
- **Sonar** ya corre por CI (Automatic Analysis desactivado). El gate custom `Fogoneria` no se pudo asignar por permisos de la organización; el gate efectivo de cobertura son los thresholds de Vitest. Pendiente asignarlo cuando haya permiso/plan.
- **Cobertura Fase 0 (2026-11-20):** Sonar excluye `apps/api/prisma/seed.ts`, `rls-roles.ts`, `apps/web/app/demo/**`, `**/scripts/**`, `docs/**`, `ops/**`, `db/**`, `docker-compose.yml`, `skills-lock.json` y `**/*.postman_collection.json`; Vitest excluye el mismo conjunto no productivo. `coverage.include` global mediría web en **49.2 % líneas / 45.9 % ramas** (por debajo de los thresholds 58/53), así que no se activa hasta la Fase 6; se documenta la brecha Sonar vs Vitest.
- CODEOWNERS y protección de rama estricta siguen diferidos (decisión del usuario).

## 7. Enlaces

- [Plan de módulos y revisión](../../docs/PLAN-MODULOS-Y-PROPIEDAD.md)
- [Modularización](../../docs/MODULARIZACION.md)
- [Actas de QA](../../docs/acta-qa-aycds-66.md) · [acta CT-FG-03](../../docs/acta-qa-aycds-50.md)
- [Trazabilidad](../trazabilidad.md)
