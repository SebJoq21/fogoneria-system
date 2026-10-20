<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# apps/web — AGENTS.md

Next.js 16.3.4 + React 19 + Tailwind v4 (CSS-first, sin `tailwind.config`). Sin `src/`: App Router en `app/`.

## Dónde está qué

- `app/` — rutas: `/` login, `/app/*` ERP bajo `DashboardShell`, `/saas` consola superadmin, `/onboarding`, `/demo/[id]`, `/terminos`.
- `components/ui/` — único DS válido (`Button`, `Card`, `fields`, `data-table`, `Modal`, `Drawer`, `Tabs`, `KpiCard`, `cn`). No crear estilos crudos fuera.
- `components/erp/` + `components/dashboard/` — vistas por dominio. `lib/` — mocks: `auth.ts`, `tenancy.ts`, `permissions.ts`, `erp.ts`, `erp-catalog.ts`, `dashboard.ts`.
- `proxy.ts` — RBAC con cookies planas (fase mocks). `scripts/check-styles.mjs` — gate de estilos en `pnpm lint`.

## Reglas web (evitan los errores repetidos)

- Precio vive en `PriceList`, nunca en `Product`. Usar `priceOf()` / `categoryNameOf()` de `lib/erp-catalog.ts`.
- Catálogo global, operación scoped por sucursal (`ModulesProvider.applyWrite`). Vista `todas` es agregada de lectura.
- RBAC espejo: `lib/auth.ts:canViewPath` == `proxy.ts`. Roles: `superadmin|admin|sucursal|cocina|mesero` (`ROLE_HOME` en `lib/auth.ts`).
- UI: `Button href` con `<a>` está permitido aquí; no usar `<img>` crudo salvo `app/demo/*` (exento del gate).
- Solo pesos `400/500`, salvo etiquetas de hub (`Másteres e informes` 18px y títulos de columna 16px) que van en `semibold` (600) por decisión de diseño. Escala `12/13/14/16/18/24`, tokens `@theme` en `app/globals.css`.
- RSC delgados que delegan a client; sin `fetch`/Server Actions aún (mocks en `ModulesProvider` + `localStorage`).
- Toda acción de 1 click que mute estado usa `ui/ConfirmDialog` (Aceptar/Cancelar; `danger` en destructivas). Los formularios con `Guardar` no la necesitan. Precios se confirman con Enter/blur, nunca por tecla.
- El mesero abre cuenta y atiende (`canOpenAccount`); solo `sucursal` cobra y opera caja (`canCheckout`, `canOperateCash`); cocina solo su KDS. Estados de mesa derivados de cuenta/reserva (`deriveTableStatus`); bloqueo manual de mesa solo sucursal.
- Norma de hub (dueño): resumen arriba → `Acceso rápido` → `Informes y másteres` (ambos 18px semibold, componente `HubBlocks` en `erp/workspace-ui.tsx`). Si un bloque va vacío no se pinta (ej: Analíticas).
- Nombres = sidebar; al renombrar una ruta actualizar `AppTopBar`.

## Comandos

- `pnpm --filter web dev | build | lint | check-types` (`lint` = `eslint && node scripts/check-styles.mjs`).
