# Calidad — gates y verificación

**Última revisión:** 2026-11-19. Lo que **bloquea** un merge es lo que corre en CI; lo demás es apoyo local.

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
| `pnpm check:specs` | `scripts/check-specs.mjs`: cobertura, estructura y enlaces de `specs/**` + diff del PR contra la spec del módulo | módulo/feature sin spec, enlace roto o código sin spec actualizada |

> `test:db` requiere `DATABASE_URL_TEST` a una base **descartable**: los specs truncan `empresas` y `leads_cotizaciones`.

## 2. CI (`.github/workflows/ci.yml`)

Job **`Lint, tipos y pruebas`** — corre en `push` a `development` y en PR a `development`/`main`:

```text
pnpm install --frozen-lockfile
pnpm audit --audit-level high      (advisory: no bloquea)
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

Job **`Imágenes Docker y Trivy`** — push y PR:

```text
hadolint (API, web) con .hadolint.yaml (failure-threshold: error)
docker build -f apps/api/Dockerfile -t fogoneria-api:ci .
docker build -f apps/web/Dockerfile -t fogoneria-web:ci .
trivy image (OS/base, CRITICAL/HIGH, ignore-unfixed)   (bloqueante: exit-code 1; paquetes npm vía pnpm audit/Dependabot)
```

Job **`CI requerido`** — solo PR, `needs: [quality, pr-scope, specs, docker]`, `if: always()`; falla si algún job queda en `failure`, `cancelled` o `skipped`. Es el candidato a único required check; la protección de rama no se cambió todavía.

Workflow **`CodeQL`** (`.github/workflows/codeql.yml`) — push/PR a `development`/`main` + cron semanal, `javascript-typescript` con `security-extended` y `security-events: write`.

**Dependabot** (`.github/dependabot.yml`) — npm (raíz pnpm), github-actions y Docker (API/web), semanal, grupos minor+patch.

Job **`SonarCloud`** — push/PR, `needs: quality`; descarga `coverage-api`/`coverage-web`, ejecuta `SonarSource/sonarqube-scan-action` con `SONAR_TOKEN` y `sonar-project.properties` (`qualitygate.wait=true`). Automatic Analysis está desactivado: este job es la única vía de análisis. Sin token (forks/Dependabot) el scan se omite y el job no falla.

> **Gate de cobertura:** el gate custom `Fogoneria` (coverage overall ≥65, ratings, duplicación y hotspots, sin `new_coverage`) está creado en SonarCloud, pero la organización rechaza asignarlo por API (`Organization ... is not allowed to modify Quality gates`). Mientras se resuelva el permiso/plan, el gate efectivo es el de **Vitest** (API 71/54/64/72; Web 57/53/52/58).

> **Dependency Review:** no está activo todavía. GitHub no genera manifests para `pnpm-lock.yaml` (Dependency Graph vacío) y la API devuelve 403; se usa `pnpm audit` advisory. En Fase B se añade dependency submission, se verifica el graph y recién entonces se vuelve bloqueante.

## 3. Qué cubre cada suite

| Suite | Cobertura real |
|---|---|
| Unit API | reglas de servicio, SLA, validadores, guards, secuencias, RUC, filtro de errores DB |
| e2e API | contratos HTTP por módulo + Socket.io real con aislamiento A/B |
| DB | RLS, soft-delete, inmutabilidad, email global, kardex, caja, comprobantes, propinas, BI, concurrencia de folios |
| Web | RBAC/proxy, sesión/firma, BFF, ticket WS, deduplicación, mapeos API↔UI y clientes de cada feature |

## 4. Gates no automatizados (revisión humana)

- **Un PR = un módulo** y revisión por otra persona (CODEOWNERS diferido; el ruleset tiene 1 aprobación + bypass admin por decisión del dueño).
- Smoke funcional por rol antes de demo/sustentación (mesero → cocina → caja).
- Migraciones: revisar `prisma validate` y que la migración sea la fuente ejecutable.
- Cambios de contrato: actualizar `packages/contracts`, la spec del módulo y `docs/decisiones.md` si es arquitectónico.

## 5. Despliegue

- Vercel build + Railway deploy se validan con healthcheck y la verificación rápida de [despliegue](despliegue.md).
- El CI no despliega: Railway usa `Wait for CI` y `preDeploy` de migraciones.

## 6. Deuda de calidad conocida

- No hay E2E de navegador (Playwright) ni cobertura mínima por módulo.
- `tenant` no tiene unit test; `saas`, `billing` y `audit` no tienen e2e propio (`realtime` sí lo tiene).
- `test:db` no corre en local sin PostgreSQL y base descartable.
- El gate de estilos exime `app/demo/*`.
- **Dependency Review** pendiente: requerir dependency submission para `pnpm-lock.yaml`; hoy `pnpm audit` es advisory.
- **Trivy** es bloqueante para **OS/base** (`exit-code: 1`) desde Fase B; el compilador nativo de TypeScript se excluye de la imagen runtime. Los CVEs de paquetes npm de la imagen se cubren con `pnpm audit`/Dependabot y quedan como deuda de actualización de dependencias.
- **Sonar** ya corre por CI (Automatic Analysis desactivado). El gate custom `Fogoneria` no se pudo asignar por permisos de la organización; el gate efectivo de cobertura son los thresholds de Vitest. Pendiente asignarlo cuando haya permiso/plan.
- CODEOWNERS y protección de rama estricta siguen diferidos (decisión del usuario).

## 7. Enlaces

- [Plan de módulos y revisión](../../docs/PLAN-MODULOS-Y-PROPIEDAD.md)
- [Modularización](../../docs/MODULARIZACION.md)
- [Actas de QA](../../docs/acta-qa-aycds-66.md) · [acta CT-FG-03](../../docs/acta-qa-aycds-50.md)
- [Trazabilidad](../trazabilidad.md)
