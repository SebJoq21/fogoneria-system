# Plan de seguridad, Code Scanning y Sonar

> Estado al 2026-11-20. Objetivo: **0 alertas abiertas de CodeQL**, **0 vulnerabilidades high de Dependabot**, `pnpm audit --audit-level high` verde y **Sonar en verde en todos los aspectos** (gate OK, ratings A, cobertura ≥65 %, duplicación ≤3 %, hotspots 100 %).

## 1. Punto de partida

| Fuente | Estado |
|---|---|
| Dependabot | **46** abiertas: 19 high, 21 medium, 6 low (todas en `pnpm-lock.yaml`) |
| CodeQL | **3** abiertas: 1 high (`js/polynomial-redos`), 2 medium (`js/indirect-command-line-injection`, `js/http-to-file-access`) |
| Sonar | **12 vulnerabilidades** (5 `secrets:S6698`, 2 `docker:S6471`, 2 `docker:S6505`, 3 en `.agents/**`), **15 code smells** |
| Sonar cobertura | **42.1 %** (líneas 35.5 %, ramas 59.3 %) |
| Sonar ratings | Security **E**, Reliability A, Maintainability A |
| Sonar duplicación / hotspots | 0.7 % / 0 |
| Secrets escaneados | 0 alertas abiertas |

### Quick wins ya aplicados

- CodeQL: email sin regex, `execFileSync` en `check-pr-scope.mjs`, reporte de carga sin body de red.
- Sonar: `S7773` (Number.parseInt/isNaN), `S8786` (regex de email/SKU/descuento), `S6848` (Modal/Drawer/PlanModals nativos).
- Docker: `USER node` en runtime y `--ignore-scripts` en los installs de build.
- Sonar: exclusión de `.agents/**` (skills vendoreadas) y `apps/web/e2e/**`.

## 2. Plan A — Vulnerabilidades y Code Scanning

### A1. CodeQL (P0, 1 día)

| Alerta | Archivo | Acción | Criterio |
|---|---|---|---|
| `js/polynomial-redos` | `packages/contracts/src/plataforma.ts` | Validación de email sin regex (`isValidEmail`) y reutilizarla en el wizard. | Alerta cerrada; tests de emails válidos/ inválidos. |
| `js/indirect-command-line-injection` | `scripts/check-pr-scope.mjs` | `execFileSync('git', ['diff','--name-only', ...])`, sin shell. | Alerta cerrada; el job `Un PR por módulo` sigue verde. |
| `js/http-to-file-access` | `apps/api/test/load/orders-load.mjs` | El body de error va a consola; el JSON solo guarda `kind`/`status`. | Alerta cerrada; el reporte de carga sigue siendo útil. |

Después: `codeql.yml` sigue con `security-extended` y cron semanal; no activar default setup para no duplicar.

### A2. Dependabot (P0/P1, 1 semana)

1. **Mapa de dependencias:** `pnpm why <paquete>` para `undici`, `effect`, `nanoid`, `source-map-js`, `brace-expansion`, `vite`, `launch-editor`, `minimatch`, `@vitest/mocker`, `@humanfs/node`.
2. **Ola 1 (high, runtime/build):** subir los padres directos (`next`, `vitest`, `vite`, `prisma`, `@nestjs/cli`, `eslint`) y, si el padre aún no publica el fix, `pnpm.overrides` acotado en el `package.json` raíz.
   - `undici`: revisar si entra al runtime de Next/API; si es dev, baja prioridad pero se corrige igual.
   - `effect`: viene de `@prisma/config`; actualizar Prisma o override.
   - `brace-expansion`/`minimatch`: vía ESLint/glob; override a la versión parcheada.
   - `vite`/`launch-editor`: dev server; actualizar Vitest/Vite.
3. **Ola 2 (medium/low):** mismo procedimiento; agrupar en un PR de dependencias.
4. **Cierre:** `pnpm audit --audit-level high` de advisory a **bloqueante**; `pnpm audit --audit-level moderate` como segundo gate cuando high esté en 0.
5. **Dependabot:** mantener grupos minor/patch e `ignore` de majors que rompen el runtime; los majors se revisan en PR de plataforma.
6. **Trivy:** mantener bloqueante OS/base; documentar CVEs npm residuales en `.trivyignore` con fecha y dueño.

**Aceptación:** 0 high en Dependabot, `pnpm audit --audit-level high` exit 0, imágenes Docker construyen y pasan Trivy.

### A3. Docker y secretos locales (P1, 3 días)

- `USER node` en ambos runtime (hecho); verificar que `prisma migrate deploy` y el server standalone arrancan como `node` en Compose.
- `--ignore-scripts` en builds (hecho); si Prisma/Next lo requiere, ejecutar explícitamente `pnpm --filter api db:generate` y documentar la excepción.
- `docker-compose.yml` y `env.validation.ts`: las credenciales `fogoneria_app/postgres` son **defaults de desarrollo**. Opciones:
  - Añadir `.env.example` raíz y exigir `POSTGRES_PASSWORD` en Compose (`${POSTGRES_PASSWORD:?}`), o
  - marcarlas como **false positive** en Sonar con justificación (dev local, no producción) y mantener el arranque sin `.env`.
- `secrets:S6698` en `.agents/**` ya desaparece por exclusión.

**Aceptación:** Sonar sin `secrets:S6698`/`docker:S6505`/`docker:S6471` abiertos; Compose documentado.

## 3. Plan B — Sonar en verde

### B1. Vulnerabilidades (P0, 2 días)

- 5 `secrets:S6698` (Compose/env dev): resolver con env vars o false positive justificado.
- 2 `docker:S6505`: `--ignore-scripts` + scripts explícitos, o false positive si el build lo exige.
- 2 `docker:S6471`: `USER node` (hecho).
- 3 en `.agents/**`: exclusión (hecho).

### B2. Code smells (P0, 1 día)

- `S7773` (7): `Number.parseInt`/`Number.isNaN` (hecho).
- `S8786` (4): email, SKU y descuento sin regex (hecho).
- `S6848` (4): Modal/Drawer/PlanModals con elementos nativos (hecho).

### B3. Cobertura 42.1 % → ≥65 % (P1, 2 semanas)

1. **Medir bien:** el 42.1 % incluye archivos sin lcov. Configurar `coverage.include`/`all` en Vitest para que el reporte refleje todo el código de producción y excluir solo demo/e2e/configs/migraciones.
2. **API (prioridad):** tests de `auth`, `tenant`, `saas`, `billing`, `audit`, `onboarding`, `staff`, `crm`, `bi`, `inventory`, `promotions`, `cash`, `receipts`, `expenses` (servicios y controladores con casos 4xx/409).
3. **Web:** tests de `features/*` (caja, comprobantes, gastos, inventario, promociones, crm, bi, salón, órdenes, catálogo, RRHH, plataforma), `components/ui` (Modal/Drawer/Toast) y mapeos (`order-mapping`, `table-mapping`, `receipt-mapping`).
4. **Ratchet:** subir thresholds de Vitest por PR (API 71→75→80; Web 57→62→70) y no bajarlos.
5. **Sonar:** `coverage.exclusions` solo para `src/generated`, `*.config.*`, `*.d.ts`, `app/demo/**`; nada de excluir lógica para maquillar.

**Aceptación:** cobertura overall ≥65 %, nuevo código ≥80 %, gate default OK.

### B4. Mantenibilidad y duplicación (P2, continuo)

- Duplicación 0.7 % (ya ≤3 %); mantener.
- Hotspots 0; revisar 100 % si aparecen.
- Reliability/Maintainability A; no introducir `S3776`/complejidad alta en módulos nuevos.

### B5. Gate y gobierno (P1)

- El gate custom `Fogoneria` (overall ≥65) sigue sin asignar por permisos de la organización. Mientras tanto:
  - El **check externo** usa el gate default (`new_coverage ≥80`, ratings, hotspots) y debe quedar verde.
  - `sonar.qualitygate.wait=false` se mantiene para no duplicar el fallo en el job; cuando el overall esté ≥65 y el gate esté asignado, poner `true`.
- Revisar semanalmente `/api/qualitygates/project_status?branch=development` y los issues nuevos.
- Rotar el `SONAR_TOKEN` y usar un **project analysis token** con solo `Execute Analysis`.

**Aceptación:** `project_status=OK` en `development` y en cada PR; Security/Reliability/Maintainability A; cobertura ≥65; duplicación ≤3; hotspots 100.

## 4. Orden de ejecución

1. **Día 1:** merge de quick wins (CodeQL + S7773/S8786/S6848 + Docker user/ignore-scripts + `.agents`).
2. **Día 2-3:** secretos de Compose/env y `docker:S6505`; verificar Sonar.
3. **Semana 1:** ola 1 Dependabot (high) + `pnpm audit` high bloqueante.
4. **Semana 2:** cobertura API/Web por módulo hasta 65 %; ola 2 Dependabot.
5. **Cierre:** `project_status=OK`, 0 CodeQL, 0 high Dependabot; actualizar `docs/SESION.md` y el tablero.

## 5. Evidencia y seguimiento

- `gh api repos/kallanka-org/fogoneria-system/code-scanning/alerts?state=open`
- `gh api repos/kallanka-org/fogoneria-system/dependabot/alerts?state=open`
- `pnpm audit --audit-level high`
- Sonar: `qualitygates/project_status`, `issues/search`, `measures/component` (branch `development`).
- Cada PR de este plan actualiza `specs/operacion/calidad.md` y este documento.
