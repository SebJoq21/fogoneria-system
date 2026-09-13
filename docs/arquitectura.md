# Arquitectura — Fogonería System

SaaS ERP gastronómico multitenant (1 empresa → N sucursales). Monorepo `pnpm + turbo`.

## apps/web (Next.js 16 + React 19 + Tailwind v4)

- Rutas: `/` login por rol → `/app/*` ERP (`DashboardShell`: `AppSidebar` + `AppTopBar`), `/saas` consola superadmin standalone, `/onboarding`, `/demo/[id]`, `/terminos`.
- Dominios ERP en `/app`: inicio, mesas (+`maestro`), órdenes, carta, cocina (KDS), mozo, caja, comprobantes, inventario, combos, promociones, clientes, reservas, gastos, analíticas, personal, platos/productos (`articulos|categorias|modificadores|precios|valorizado|resumen-categoria`), fidelización, pagos, soporte, configuración.
- Estado: `ModulesProvider.tsx` (contexto global mock + `localStorage` + cookies `fogoneria.role|branch`). Sin backend: sin `fetch`, sin Server Actions.
- Datos mock en `lib/`: `auth.ts` (roles + `ROLE_HOME` + `canViewPath`), `tenancy.ts` (sucursales miraflores/surco/san-isidro + `todas`), `permissions.ts` (cocina/mozo/caja), `erp.ts` (órdenes/mesas/caja/inventario/personal), `erp-catalog.ts` (productos + listas de precio + `priceOf()`), `dashboard.ts`, `demo.ts`.
- DS propio `components/ui/` + tokens `@theme` en `app/globals.css` + gate `scripts/check-styles.mjs`. `app/demo/*` exento del gate.

## apps/api (NestJS 12, scaffold)

- Solo `GET / → Hello World!` (`app.controller.ts` + `app.service.ts`). Puerto `3001`. Sin DB, auth, validación, CORS, config.

## packages/* (starter sin usar)

- `@repo/ui|eslint-config|typescript-config` intactos de `create-turbo`. `web` no depende de `@repo/ui`.
