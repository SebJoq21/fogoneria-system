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
| `pnpm check:specs` | `scripts/check-specs.mjs`: cobertura, estructura y enlaces de `specs/**` + diff del PR contra la spec del módulo | módulo/feature sin spec, enlace roto o código sin spec actualizada |

> `test:db` requiere `DATABASE_URL_TEST` a una base **descartable**: los specs truncan `empresas` y `leads_cotizaciones`.

## 2. CI (`.github/workflows/ci.yml`)

Job **`Lint, tipos y pruebas`** — corre en `push` a `development` y en PR a `development`/`main`:

```text
pnpm install --frozen-lockfile
pnpm check:boundaries
pnpm --filter api db:generate
pnpm --filter api db:deploy        (Postgres 16 service)
pnpm --filter api db:rls:roles
pnpm --filter api db:rls:force
pnpm lint
pnpm check-types
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter api test:db
pnpm --filter web test
pnpm build
```

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

## 3. Qué cubre cada suite

| Suite | Cobertura real |
|---|---|
| Unit API | reglas de servicio, SLA, validadores, guards, secuencias, RUC, filtro de errores DB |
| e2e API | contratos HTTP por módulo + Socket.io real con aislamiento A/B |
| DB | RLS, soft-delete, inmutabilidad, email global, kardex, caja, comprobantes, propinas, BI, concurrencia de folios |
| Web | RBAC/proxy, sesión/firma, BFF, ticket WS, deduplicación, mapeos API↔UI y clientes de cada feature |

## 4. Gates no automatizados (revisión humana)

- **Un PR = un módulo** y revisión por otra persona (CODEOWNERS/protección diferidos hasta cerrar el avance masivo; ver [plan](../../docs/PLAN-MODULOS-Y-PROPIEDAD.md) §3).
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

## 7. Enlaces

- [Plan de módulos y revisión](../../docs/PLAN-MODULOS-Y-PROPIEDAD.md)
- [Modularización](../../docs/MODULARIZACION.md)
- [Actas de QA](../../docs/acta-qa-aycds-66.md) · [acta CT-FG-03](../../docs/acta-qa-aycds-50.md)
- [Trazabilidad](../trazabilidad.md)
