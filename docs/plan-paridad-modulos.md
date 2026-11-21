# Plan de paridad de módulos backend ↔ frontend

> **Objetivo:** que cada módulo tenga el **mismo ID, nombre y cantidad** en backend, frontend, contratos y spec, con una persona responsable y PRs que no se pisen. Un PR de módulo no debe tocar archivos compartidos ni obligar a rebase.

## 1. Auditoría actual (2026-11-21, `development` `ca99e99`)

| Capa | Cantidad | Estado |
|---|---:|---|
| Backend `apps/api/src/modules/*` | **20** | Cada uno con `index.ts` público; fronteras baseline **0** |
| Frontend `apps/web/features/*` | **12** | Agrupados y con nombres en español; no 1:1 |
| Contratos `packages/contracts/src/*.ts` | **14** subpaths | Nombres en español y `plataforma` agrupando 5 módulos |
| Specs `specs/modulos/*.md` | **21** | 20 backend + `plataforma` (web); falta paridad |
| Rutas `/app/*` | 33 | Varias pantallas en `components/erp/*`, fuera de features |

### 1.1 Backend (20, canónicos)

`auth`, `tenant`, `onboarding`, `saas`, `billing`, `audit`, `catalog`, `pricing`, `tables`, `reservations`, `orders`, `realtime`, `cash`, `receipts`, `expenses`, `inventory`, `promotions`, `crm`, `staff`, `bi`.

### 1.2 Frontend actual (12) vs objetivo (20)

| Frontend actual | Backend que cubre | Acción |
|---|---|---|
| `catalogo` | `catalog` + `pricing` | **Dividir** en `catalog` y `pricing` |
| `salon` | `tables` + `reservations` | **Dividir** en `tables` y `reservations` |
| `plataforma` | `auth` + `tenant` + `onboarding` + `saas` + `billing` | **Dividir** en 5 features |
| `ordenes` | `orders` | Renombrar a `orders` |
| `caja` | `cash` | Renombrar a `cash` |
| `comprobantes` | `receipts` | Renombrar a `receipts` |
| `gastos` | `expenses` | Renombrar a `expenses` |
| `inventario` | `inventory` | Renombrar a `inventory` |
| `promociones` | `promotions` | Renombrar a `promotions` |
| `rrhh` | `staff` | Renombrar a `staff` |
| `crm` | `crm` | ✅ Alineado |
| `bi` | `bi` | ✅ Alineado |
| — | `audit` | **Crear** feature (consulta de auditoría) |
| — | `realtime` | **Crear** feature (transporte/hooks; sin ruta) |

**Neto:** 12 + 1 (catálogo) + 1 (salón) + 4 (plataforma) + 1 (audit) + 1 (realtime) = **20**.

### 1.3 Contratos actuales (14) → objetivo (20)

Renombrar: `caja→cash`, `catalogo→catalog`, `comprobantes→receipts`, `gastos→expenses`, `inventario→inventory`, `mesas→tables`, `ordenes→orders`, `promociones→promotions`, `reservas→reservations`, `rrhh→staff`, `tiempo-real→realtime`. Dividir `plataforma→auth, tenant, onboarding, saas, billing`. Añadir `pricing` y `audit`. `crm` y `bi` quedan.

Los archivos viejos se mantienen como **alias deprecados** (`export * from './nuevo'`) durante una release; los subpaths antiguos siguen funcionando y se eliminan después.

### 1.4 Vistas fuera de feature

`components/erp/`: `MozoView`, `AccountPanel`, `AddItemModal`, `BookingsWorkspace`, `StaffModule`, `RolesView`, `StaffWorkspace`, `CartaVirtualView`. **(Resuelto en F3/F5: `components/erp` quedó eliminado.)**

## 2. Catálogo canónico (mismo ID en las 3 capas)

Sin prefijo `mod-` para no renombrar 20 carpetas del backend; el ID es el nombre exacto en `apps/api/src/modules/<id>`, `apps/web/features/<id>` y `packages/contracts/src/<id>.ts`. Si el equipo prefiere `mod-<id>`, se aplica igual en las tres capas en una fase única.

| ID | Backend | Frontend objetivo | Contrato | Rutas | Estado |
|---|---|---|---|---|---|
| `auth` | `modules/auth` | `features/auth` | `auth.ts` | `/`, `/recuperar` | pendiente |
| `tenant` | `modules/tenant` | `features/tenant` | `tenant.ts` | shell + `BranchSwitcher` | pendiente |
| `onboarding` | `modules/onboarding` | `features/onboarding` | `onboarding.ts` | `/onboarding` | pendiente |
| `saas` | `modules/saas` | `features/saas` | `saas.ts` | `/saas` | pendiente |
| `billing` | `modules/billing` | `features/billing` | `billing.ts` | `/saas` (tab) | pendiente |
| `audit` | `modules/audit` | `features/audit` | `audit.ts` | `/app/auditoria` (nueva) | pendiente |
| `catalog` | `modules/catalog` | `features/catalog` | `catalog.ts` | `/app/productos/*` | pendiente |
| `pricing` | `modules/pricing` | `features/pricing` | `pricing.ts` | `/app/productos/precios` | pendiente |
| `tables` | `modules/tables` | `features/tables` | `tables.ts` | `/app/mesas`, `/maestro` | pendiente |
| `reservations` | `modules/reservations` | `features/reservations` | `reservations.ts` | `/app/modulos/reservas/agenda` | pendiente |
| `orders` | `modules/orders` | `features/orders` | `orders.ts` | `/app/ordenes`, `/app/cocina`, `/app/mozo` | pendiente |
| `realtime` | `modules/realtime` | `features/realtime` | `realtime.ts` | sin ruta (transporte) | pendiente |
| `cash` | `modules/cash` | `features/cash` | `cash.ts` | `/app/caja` | pendiente |
| `receipts` | `modules/receipts` | `features/receipts` | `receipts.ts` | `/app/comprobantes` | pendiente |
| `expenses` | `modules/expenses` | `features/expenses` | `expenses.ts` | `/app/gastos` | pendiente |
| `inventory` | `modules/inventory` | `features/inventory` | `inventory.ts` | `/app/modulos/inventario/*` | pendiente |
| `promotions` | `modules/promotions` | `features/promotions` | `promotions.ts` | `/app/combos`, `/app/promociones` | pendiente |
| `crm` | `modules/crm` | `features/crm` | `crm.ts` | `/app/clientes`, fidelización | ✅ |
| `staff` | `modules/staff` | `features/staff` | `staff.ts` | `/app/modulos/personal/*` | pendiente |
| `bi` | `modules/bi` | `features/bi` | `bi.ts` | `/app/analiticas` | ✅ |

## 3. Regla de independencia y rebase

### 3.1 Un módulo = una carpeta por capa

```
apps/api/src/modules/<id>/          # backend (index.ts público)
apps/web/features/<id>/             # frontend (api.ts, hooks.ts, views, index.ts, module.ts)
packages/contracts/src/<id>.ts      # contrato + validadores
specs/modulos/<id>.md               # spec
```

Un PR de módulo solo toca esas rutas. Si necesita una pieza compartida, se abre un PR `chore/plataforma` con `multi-modulo` **antes**; nunca se mezcla con el módulo.

### 3.2 Archivos compartidos: generados, no editados

| Archivo compartido | Hoy | Estrategia |
|---|---|---|
| `apps/api/src/app.module.ts` | 20 imports manuales | `modules/registry.ts` **generado** desde las carpetas (`gen:modules`) |
| `app/layout.tsx` (providers) | composición manual | `features/registry.ts` generado; cada feature exporta `Provider` opcional |
| `AppSidebar`/`AppTopBar` (nav) | listas manuales | nav desde `module.ts` de cada feature; generador |
| `packages/contracts/package.json` | 14 subpaths manuales | `exports: { "./*": "./src/*.ts" }` (wildcard), sin editar por módulo |
| `packages/contracts/src/index.ts` | barrel | deprecado; la API usa subpaths |
| `prisma/schema.prisma` | archivo único | `prisma/schema/<id>.prisma` + `core.prisma` (spike Prisma 7) |
| `packages/contracts/src/plataforma.ts` | 5 módulos | dividir + alias deprecados |
| `components/erp/*` | vistas legacy | mover a su feature; el shell no importa `components/erp` |
| `ModulesProvider` | estado global | providers por módulo; composición generada |
| `pnpm-lock.yaml` | compartido | los PRs de módulo no cambian dependencias |
| `specs/trazabilidad.md` | tabla compartida | una fila por PR; opcional changelog por módulo |

### 3.3 Manifiesto y generación

- `modules/<id>/module.json` (uno por módulo, propiedad del dueño): `id`, `owner`, `routes`, `status`, `kind` (`ui|api|infra`).
- `scripts/gen-modules.mjs` genera:
  - `apps/api/src/modules/registry.ts`
  - `apps/web/features/registry.ts` (providers)
  - `apps/web/lib/modules-nav.ts` (sidebar/topbar)
- Los archivos generados se commitean y se regeneran en CI; si dos PRs los tocan, se resuelve con `pnpm gen:modules` (no a mano).

### 3.4 Contratos

- Wildcard de subpaths; sin editar `package.json`.
- Alias deprecados por una release; ningún import nuevo a los nombres viejos.
- La API importa subpaths (`@fogoneria/contracts/<id>`), nunca el barrel.

### 3.5 Base de datos

- **Spike:** confirmar soporte de esquema multi-archivo en Prisma 7 (`prismaSchemaFolder`). Si aplica, `prisma/schema/core.prisma` (empresas, sucursales, usuarios, enums compartidos) + `<id>.prisma` por módulo.
- Migraciones: una carpeta `<timestamp>_<id>_<detalle>` por PR; no se edita una migración ya aplicada.
- Si el multi-archivo no es viable, mantener `schema.prisma` con secciones por módulo y un check que impida mezclar tablas de dos módulos en un mismo PR.

## 4. Fases

| Fase | Qué | Duración | Salida |
|---|---|---|---|
| **0. Manifiesto** | Catálogo canónico, `module.json`, `check:modules` (reporte), mapa de owners | 2-3 días | Diagnóstico 20/12/14/21 y baseline |
| **1. Piloto `crm`** | `module.ts`, nav/provider generado, ruta delgada, PR de un solo módulo | 3-5 días | Prueba de cero rebase |
| **2. Renombres 1:1** | `orders`, `cash`, `receipts`, `expenses`, `inventory`, `promotions`, `staff` + contratos/alias | 1 semana | 19 features (faltan splits) |
| **3. Splits catálogo/salón** | `catalog`+`pricing`, `tables`+`reservations`; mover `components/erp` | 1-2 semanas | 21? no: 20 con plataforma aún agrupada |
| **4. Split plataforma** | `auth`, `tenant`, `onboarding`, `saas`, `billing`; la sesión sigue en `lib/session`/BFF | 1-2 semanas | 20 features casi completas |
| **5. Audit/realtime** | `features/audit` (endpoint read-only), `features/realtime` (transporte) | 3-5 días | 20/20/20/20 |
| **6. Providers/estado** | Providers por módulo, registry generado, retirar `ModulesProvider` | 1-2 semanas | Cero estado global compartido |
| **7. Backend/DB** | `index.ts` estándar, puertos, Prisma multi-archivo, migraciones por módulo | 1 semana | Backend y DB sin archivos calientes |
| **8. Gates/ownership** | `check:modules --strict`, `check:boundaries` 0, `CODEOWNERS`, PR template/Jira | 2-3 días | MRs por módulo con revisión correcta |
| **9. Validación** | Simular 2 PRs en paralelo, build/test/E2E, training | 1 semana | Sin conflictos ni rebase |

## 5. CI y gobierno

- **`check:modules`** (`--strict`): 20 backend = 20 frontend = 20 contratos = 20 specs; IDs únicos; archivos mínimos (`index.ts`, `api.ts`, `module.ts`); ruta existente; owner.
- **`check:boundaries`**: baseline 0; una feature no importa otra ni `components/erp`; un módulo backend solo importa el `index` público de otro.
- **`check:pr-scope`** lee el manifiesto y exige un solo `<id>`; `multi-modulo` solo para infra.
- **`CODEOWNERS`** por módulo (4 rutas por ID). El ruleset mantiene 1 aprobación + bypass del dueño; `require_code_owner_review` se activa al cerrar la migración.
- **Jira**: un componente por módulo y el campo `Módulo` en la plantilla de PR.
- **Contratos**: check de que no se importa el barrel en la API y de que no se usan subpaths viejos.

## 6. Criterios de aceptación

1. `20/20/20/20` (backend, frontend, contratos, specs) con IDs idénticos.
2. `pnpm check:modules --strict` y `check:boundaries` verdes.
3. Cero imports de `components/erp/*` desde features; `components/erp` vacío o solo UI compartida.
4. Un PR de módulo toca solo sus 4 rutas + su `module.json`; los generados se regeneran.
5. Dos ramas de módulos distintos se mergean sin conflictos (prueba con `git merge-tree` o PRs simultáneos).
6. `lint`, `check-types`, tests, E2E, build, specs y Sonar verdes.
7. Cada módulo tiene owner (CODEOWNERS) y spec al día.

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Big-bang de renombres | Alias de contratos y PRs por ola; no renombrar todo de golpe |
| `ModulesProvider` acopla todo | Fase 6: providers por módulo antes de exigir independencia total |
| `plataforma` incluye sesión | La sesión no se mueve: `lib/session`, BFF y `proxy` siguen siendo autoridad |
| `audit` no tiene endpoint | Añadir `GET /audit` read-only (admin) antes de la feature |
| `realtime` no tiene UI | Módulo `kind: infra` con transporte/hooks; sin ruta |
| Prisma multi-archivo | Spike con Prisma 7; fallback a secciones + check de tablas |
| Conflictos en contratos | Wildcard de subpaths y alias; no editar `package.json` |
| CI más lento | Jobs API/Web separados y sharding si supera 10 min |
| Equipo no disponible para CODEOWNERS | Mantener bypass del dueño; asignar owners igual en el manifiesto |

## 8. Comandos

```bash
pnpm check:modules            # reporte de paridad (no falla)
pnpm check:modules --strict   # gate (tras la fase 5)
pnpm check:boundaries
pnpm gen:modules              # regenera registries/nav
pnpm check:specs --base origin/development
```

## 9. Próximo paso

**Ejecutado (2026-11-21, ramas `refactor/paridad-f0-f2`, `refactor/paridad-f3` y `refactor/paridad-f4-f5`):**

- **Fase 0:** `modules/<id>/module.json` en los 20 módulos; `pnpm gen:modules` genera
  el registry de la API (`MODULE_REGISTRY`, consumido por `app.module.ts`), el
  registry de features y `lib/modules-nav.ts`; `pnpm check:modules` valida
  manifiestos y reporta el avance; step advisory en el job `quality`.
- **Fase 1 (piloto `crm`):** `features/crm/module.ts` alimenta el registry y la
  entrada de navegación generada; `/app/clientes` sigue igual.
- **Fase 2 (renombres 1:1):** `orders`, `cash`, `receipts`, `expenses`,
  `inventory`, `promotions` y `staff` en features y contratos, con alias
  deprecados en los subpaths antiguos. Sin splits ni cambios de estado.
- **Fase 3 (splits de catálogo y salón):** `catalog`+`pricing` y
  `tables`+`reservations` en features y contratos, alias deprecados de
  `catalogo`, `mesas` y `reservas`; `CartaVirtualView` y `BookingsWorkspace`
  movidos a su feature. La UI compartida mapa/agenda queda en
  `components/dashboard/salon` hasta el split fino. `check:pr-scope` y
  `check:specs` usan los IDs canónicos; `gen:modules --check` corre en CI con
  EOL normalizado.
- **Fase 4 (plataforma 1→5):** `auth`, `tenant`, `onboarding`, `saas` y
  `billing` como features y contratos propios; `plataforma.ts` queda como alias.
  La sesión (`lib/session.ts`, BFF y `proxy.ts`) **no se movió**. La API HTTP
  compartida vive en `lib/platform-api.ts`.
- **Fase 5 (audit/realtime):** `GET /audit` read-only para admin, feature
  `audit` con `/app/auditoria`; `features/realtime` reexporta el transporte y
  el hook de comandas. `components/erp` quedó vacío: mozo a `orders` y
  staff/roles a `staff`.
- **Fase 7 (Prisma multi-archivo):** el schema pasa de un archivo único a
  `apps/api/prisma/schema/` (`core.prisma` + `<id>.prisma` por módulo, 16
  archivos), con `prisma.config.ts:schema` apuntando a la carpeta y el `output`
  del cliente ajustado a `../../src/generated/prisma`. El DDL no cambia:
  `prisma migrate diff --from-schema <monolito> --to-schema prisma/schema`
  responde «No difference detected» y no se tocaron migraciones ni triggers.
  `check:pr-scope` atribuye `schema/<id>.prisma` a su módulo (`core.prisma`
  sigue compartido). Falta cerrar el resto de la fase 7: migraciones nombradas
  por módulo (`<timestamp>_<id>_<detalle>`), que se hará al agregar tablas.

**Estado:** **20/20/20/20** (backend, frontend, contratos, specs), 12 alias
deprecados, `check:modules --strict` verde y cableado en CI.

**Fase 6 (timeboxed):** el shell consume `modules-nav.ts` (sidebar/topbar y títulos de detalle generados) y `features/registry.ts` (`FeatureProviders`); `TenantProvider` y `CrmProvider` migrados a sus features (clientes con purga legacy y sync entre pestañas). El resto del estado sigue en `ModulesProvider`.

**Siguiente:** completar la Fase 6 (providers por módulo/retirar
`ModulesProvider`); de la Fase 7 queda la convención de migraciones por módulo
(`<timestamp>_<id>_<detalle>`), que se aplica al agregar la primera tabla nueva.
