# Arquitectura — Fogonería System

SaaS ERP gastronómico multitenant (1 empresa → N sucursales). Monorepo `pnpm + turbo`.

## apps/web (Next.js 16 + React 19 + Tailwind v4)

- Rutas: `/` login por rol → `/app/*` ERP (`DashboardShell`: `AppSidebar` + `AppTopBar`), `/saas` consola superadmin standalone, `/onboarding`, `/demo/[id]`, `/terminos`.
- Dominios ERP en `/app`: inicio, mesas (+`maestro`), órdenes, carta, cocina (KDS), mozo, caja, comprobantes, inventario, combos, promociones, clientes, reservas, gastos, analíticas, personal, platos/productos (`platos|categorias|modificadores|precios`), fidelización, pagos, soporte, configuración.
- Estado: `ModulesProvider.tsx` (contexto global mock + `localStorage` + cookies `fogoneria.role|branch`). Sin backend: sin `fetch`, sin Server Actions.
- Datos mock en `lib/`: `auth.ts` (roles + `ROLE_HOME` + `canViewPath`), `tenancy.ts` (sucursales miraflores/surco/san-isidro + `todas`), `permissions.ts` (cocina/mozo/caja), `erp.ts` (órdenes/mesas/caja/inventario/personal), `erp-catalog.ts` (productos + listas de precio + `priceOf()`), `dashboard.ts`, `demo.ts`.
- DS propio `components/ui/` + tokens `@theme` en `app/globals.css` + gate `scripts/check-styles.mjs`. `app/demo/*` exento del gate.

## apps/api (NestJS 12, scaffold)

- Solo `GET / → Hello World!` (`app.controller.ts` + `app.service.ts`). Puerto `3001`. Sin módulos, auth, validación, CORS ni config todavía.
- Capa de datos lista: `prisma/schema.prisma` (41 modelos, 27 enums), migración `20261019000000_init`, seed demo idempotente y cliente Prisma 7 con `@prisma/adapter-pg`. Ver `docs/modelo-datos.md`.

## packages/* (starter sin usar)

- `@repo/ui|eslint-config|typescript-config` intactos de `create-turbo`. `web` no depende de `@repo/ui`.
