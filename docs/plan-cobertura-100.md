# Plan de cobertura 100 % útil y duplicación

> Estado base 2026-11-20 (`development` `854a111`): Sonar overall **65.6 %** (líneas 66.0, ramas 64.9), nuevo código **81.1 %**, duplicación **0.7 %**, 0 vulnerabilidades/code smells/hotspots, ratings A.

## 1. Qué significa “100 %” aquí

El 100 % literal de un ERP full-stack incluye scripts de seed/backup, generados, JSON de Postman, CSS y ramas defensivas de UI; perseguirlo produce tests frágiles y no aporta valor. El plan usa **100 % útil**:

| Ámbito | Objetivo | Exclusión permitida |
|---|---|---|
| Código nuevo de cada PR | **≥90 %** (ideal 100 %) | Solo generados/infra justificados |
| API: servicios, controladores, guards, DTOs | **≥95 % líneas / ≥90 % ramas** | `prisma/seed.ts`, `rls-roles.ts` (scripts) |
| Contratos compartidos | **100 %** | — |
| Web: `lib/`, `features/`, providers | **≥85 % líneas / ≥75 % ramas** | `app/demo/**`, e2e, configs |
| Web: páginas/RSC delgadas | **≥80 %** | Wrappers sin lógica |
| UI primitivas (`components/ui`) | **≥90 %** | — (SSR + RTL) |
| **Overall Sonar** | **≥80 %** | Generados, seed, demo, scripts, docs/ops |
| **Duplicación** | **≤0.2 %** | — |
| Hotspots / vulnerabilidades / code smells | **0 / 0 / 0** | — |

**Presupuesto de excepciones:** máximo 2 % de archivos de producción sin cubrir, cada uno con motivo en `specs/operacion/calidad.md` y fecha de revisión. Nada de excluir lógica de negocio para maquillar la métrica.

## 2. Gap actual

### Top archivos sin cubrir (Sonar, uncovered / ncloc)

| Archivo | Uncovered | ncloc | Cobertura |
|---|---:|---:|---:|
| `apps/web/components/dashboard/ModulesProvider.tsx` | 367 | 1.439 | 0 % |
| `apps/web/features/salon/BookingsModule.tsx` | 176 | 825 | 27 % |
| `apps/web/features/caja/CajaPage.tsx` | 138 | 830 | 34 % |
| `apps/web/features/comprobantes/ComprobantesPage.tsx` | 133 | 659 | 17 % |
| `apps/api/prisma/seed.ts` | 119 | 1.533 | 0 % (excluir) |
| `apps/web/features/salon/SalonTablesView.tsx` | 89 | 359 | 21 % |
| `apps/web/features/rrhh/hooks.ts` | 81 | 178 | 0 % |
| `apps/web/components/erp/MozoView.tsx` | 81 | 389 | 30 % |
| `apps/web/features/crm/ClientesPage.tsx` | 76 | 368 | 21 % |
| `apps/web/features/plataforma/OnboardingPage.tsx` | 66 | 407 | 32 % |
| `apps/web/components/dashboard/providers/catalog.tsx` | 59 | 284 | 27 % |
| `apps/web/features/catalogo/ModifiersView.tsx` | 54 | 285 | 32 % |
| `apps/web/features/catalogo/ProductsView.tsx` | 47 | 359 | 36 % |
| `apps/web/features/catalogo/PriceListsView.tsx` | 43 | 242 | 42 % |
| `apps/web/features/caja/CheckoutModal.tsx` | 42 | 302 | 38 % |
| `apps/web/features/plataforma/SaasPage.tsx` | 38 | 241 | 31 % |
| `apps/web/features/catalogo/CategoriesView.tsx` | 35 | 175 | 30 % |
| `apps/web/features/inventario/InventoryPage.tsx` | 35 | 250 | 41 % |
| `apps/web/features/promociones/CombosPage.tsx` | 33 | 207 | 27 % |
| `apps/web/features/ordenes/OrdersBoardPage.tsx` | 32 | 314 | 60 % |
| `apps/web/components/erp/RolesView.tsx` | 30 | 169 | 37 % |
| `apps/web/components/erp/mozo/AccountPanel.tsx` | 28 | 264 | 66 % |
| `apps/web/components/dashboard/providers/tenant.tsx` | 28 | 199 | 56 % |
| `apps/web/lib/orders-board.ts` | 25 | 60 | 0 % |
| `apps/web/components/dashboard/AppTopBar.tsx` | 24 | 156 | 0 % |
| `apps/web/features/gastos/GastosPage.tsx` | 20 | 196 | 37 % |
| `apps/web/features/bi/hooks.ts` | 20 | 52 | 0 % |
| `apps/web/components/dashboard/BranchSwitcher.tsx` | 18 | 109 | 0 % |

Además: `apps/web/features/catalogo/hooks.ts` (140 ncloc, 0 %), `apps/web/components/dashboard/DashboardShell.tsx` (85, 0 %), `MetricsCharts.tsx` (69, 0 %), `MenuPreview.tsx` (58, 0 %), `apps/web/lib/orders-board.ts` (60, 0 %), `packages/sdk/src/index.ts` (97, 0 %), DTOs de API (`cash`, `crm`, `catalog`, `pricing`, `receipts`) sin tests.

### Duplicación actual (0.7 %)

| Bloque | Líneas | Archivos |
|---|---:|---|
| `expenses.service.ts:269` ↔ `staff.service.ts:382` | 46 | mismo bloque de listado/filtros |
| `expenses:269` ↔ `staff:382` ↔ `cash:514` | 37 | resolución de sucursal/where |
| `tables:176` ↔ `expenses:282` ↔ `staff:395` ↔ `crm:499` ↔ `cash:527` | 24-28 | scoping por sucursal + paginación |
| `order-mapping.ts:237` ↔ `:291` | 13 | mapeo de orden duplicado |
| `catalog.tsx` ↔ `ModulesProvider.tsx` | 22 | helpers de demo/persistencia |

## 3. Fases

### Fase 0 — Higiene de medición (1-2 días)

- Excluir del **análisis/cobertura** lo que no es producción: `apps/api/prisma/seed.ts`, `rls-roles.ts`, `apps/web/app/demo/**`, `**/scripts/**`, `docs/**`, `ops/**`, `db/**`, `docker-compose.yml`, `skills-lock.json`, `**/*.postman_collection.json`.
- Incluir todo el código de producción en el lcov (`coverage.include`/`all` en Vitest) para que Sonar y Vitest midan lo mismo.
- Añadir lcov de `test:db` (Prisma/RLS) al scan y publicar un resumen de cobertura por PR.
- **Aceptación:** diferencia Sonar vs Vitest ≤2 puntos; exclusiones documentadas; sin archivos de negocio excluidos.

### Fase 1 — Quick wins web (2-3 días) → ~68-70 %

- Tests de `lib/orders-board.ts`, `features/bi/hooks.ts`, `rrhh/hooks.ts`, `catalogo/hooks.ts`, `AppTopBar`, `BranchSwitcher`, `MenuPreview`, `MetricsCharts`, `DashboardShell`, `Toast`, `packages/sdk/src/index.ts`.
- DTOs de API (`cash`, `crm`, `catalog`, `pricing`, `receipts`) con `class-validator`.
- Introducir `@testing-library/react` + `jsdom` **solo** para componentes interactivos (decisión en el PR; SSR para los puros).
- **Aceptación:** web ≥68 %, overall ≥68 %, thresholds de Vitest intactos o subidos.

### Fase 2 — Providers y estado (1 semana) → ~73-75 %

- `ModulesProvider` (acciones de cuentas, órdenes, caja, inventario, promociones, CRM, comprobantes) con storage/API mockeados; extraer reducers/helpers puros si hace falta.
- `catalog.tsx`, `tenant.tsx`, `Session`, `Notifications`, `CatalogoProvider`.
- **Aceptación:** providers ≥75 % líneas; overall ≥73 %; sin tests de implementación frágiles.

### Fase 3 — Páginas y flujos (1-2 semanas) → ~80 %

- `CajaPage`, `ComprobantesPage`, `CheckoutModal`, `BookingsModule`, `SalonTablesView`, `MozoView`/`AccountPanel`/`AddItemModal`, `ClientesPage`, `OnboardingPage`, `SaasPage`, `Products/Categories/Modifiers/PriceLists`, `InventoryPage`, `CombosPage`/`PromocionesPage`, `GastosPage`, `OrdersBoardPage`, `RolesView`.
- Cubrir los 4 estados (carga, vacío, error, éxito) y permisos por rol.
- **Aceptación:** web ≥80 % líneas / ≥70 % ramas; overall ≥80 %; nuevo código ≥90 %.

### Fase 4 — API y datos (3-5 días) → ~82-85 %

- Ramas de datos de `orders`, `saas`, `reservations`, `pricing`, `cash`, `crm`, `staff`; `prisma.service`/`tenant.extension` con `test:db` + cobertura.
- DTOs y validadores restantes.
- **Aceptación:** API ≥97 % líneas / ≥90 % ramas; overall ≥82 %.

### Fase 5 — Duplicación ≤0.2 % (1 semana)

- Extraer `common/tenant/branch-scope.ts` (resolución de sucursal/where) y reutilizarlo en `expenses`, `staff`, `cash`, `crm`, `tables`.
- Extraer el bloque de listado/filtros compartido (`expenses`/`staff` 46 líneas) a un helper de paginación/búsqueda.
- `order-mapping.ts`: unificar los dos mapeos de 13 líneas en `mapOrderBase`.
- `catalog.tsx`/`ModulesProvider`: helpers de demo/persistencia compartidos.
- **Aceptación:** duplicación ≤0.2 %, tests de los helpers, sin over-abstraction.

### Fase 6 — Gates y gobierno (1 día)

- Subir thresholds de Vitest por paquete (API 95/90/95/95; Web 80/70/75/80; contratos 100) y ratchet por PR.
- `pnpm audit --audit-level high` y `coverage` como gates bloqueantes.
- Revisión mensual de exclusiones y de los 2 % de excepciones.
- **Aceptación:** un PR que baje cobertura o duplicación falla el CI; el equipo revisa el reporte en cada PR.

## 4. Riesgos y no-objetivos

- **No** testear generados, seeds, backups, JSON de Postman, CSS ni ramas defensivas inalcanzables.
- **No** usar snapshots masivos ni tests que copien la implementación.
- **No** excluir lógica de negocio para subir el número.
- El CI puede pasar de ~4-5 min a 8-10 min; si ocurre, dividir `quality` en API/Web y usar sharding de Vitest.
- `ModulesProvider` y las páginas son el 60 % del gap; sin RTL/jsdom no se cubren bien. La dependencia se decide en Fase 1 con un PR pequeño.

## 5. Comandos y evidencia

```bash
pnpm --filter api test:cov
pnpm --filter web test:coverage
pnpm --filter @fogoneria/contracts test:coverage
pnpm --filter api test:db   # cobertura RLS/Prisma
pnpm audit --audit-level high
```

- Sonar: `measures/component` (branch `development`), `duplications/show`, `qualitygates/project_status`.
- Cada PR actualiza `specs/operacion/calidad.md` y este documento.

## 6. Próximo paso

Ejecutar **Fase 0 + Fase 1** en una rama `test/cobertura-100-f1`, con PR pequeño y CI verde. Después, Fase 2 y 3 en olas separadas para no bloquear el resto del equipo.
