# Arquitectura — Fogonería System

SaaS ERP gastronómico multitenant (1 empresa → N sucursales). Monorepo `pnpm + turbo`.

## apps/web (Next.js 16 + React 19 + Tailwind v4)

- Rutas: `/` login por rol → `/app/*` ERP (`DashboardShell`: `AppSidebar` + `AppTopBar`), `/saas` consola superadmin standalone, `/onboarding`, `/demo/[id]`, `/terminos`.
- Dominios ERP en `/app`: inicio, mesas (+`maestro`), órdenes, carta, cocina (KDS), mozo, caja, comprobantes, inventario, combos, promociones, clientes, reservas, gastos, analíticas, personal, platos/productos (`platos|categorias|modificadores|precios`), fidelización, pagos, soporte, configuración.
- Estado: `ModulesProvider.tsx` (contexto global mock + `localStorage` + cookies `fogoneria.role|branch`). Sin backend: sin `fetch`, sin Server Actions.
- Datos mock en `lib/`: `auth.ts` (roles + `ROLE_HOME` + `canViewPath`), `tenancy.ts` (sucursales miraflores/surco/san-isidro + `todas`), `permissions.ts` (cocina/mozo/caja), `erp.ts` (órdenes/mesas/caja/inventario/personal), `erp-catalog.ts` (productos + listas de precio + `priceOf()`), `dashboard.ts`, `demo.ts`.
- DS propio `components/ui/` + tokens `@theme` en `app/globals.css` + gate `scripts/check-styles.mjs`. `app/demo/*` exento del gate.

## apps/api (NestJS 12 + Prisma 7)

- `GET /api/v1` (info), `GET /api/v1/health` y Swagger en `/api/docs`. Prefijo global `/api/v1`, `ValidationPipe` global, CORS por `CORS_ORIGIN`. Puerto `3001`.
- Módulos: `auth` (JWT/Passport, login valida estado del tenant), `tenant` (contexto y sucursales), `orders` (órdenes + transiciones), `catalog` (categorías/platos/modificadores), `pricing` (listas y precios), `saas` (alta/listado/suspensión/MRR), `billing` (cron diario de morosidad) y `audit`.
- Aislamiento multitenant: `TenantContextService` (AsyncLocalStorage) + extensión Prisma que inyecta `empresa_id`/`sucursal_id`; `SUPERADMIN` opera con bypass. Modelos hijos heredan el filtro del padre. `findUnique/update/delete/upsert` se validan en el servicio.
- Datos: `prisma/schema.prisma` (41 modelos, 27 enums), migración `20261019000000_init`, seed demo idempotente (contraseña demo `Fogoneria123!`) y cliente Prisma 7 con `@prisma/adapter-pg`. Ver `docs/modelo-datos.md` y `apps/api/README.md`.
- Tests: Vitest unitario + e2e con Prisma mockeado. Verificación real contra PostgreSQL 16 con `docker compose` (`localhost:5433`): `db:deploy`, `db:seed`, login, CRUD, SaaS y aislamiento con 2 empresas. Dockerfiles y CI siguen pendientes (tarea 58).

## packages/* (starter sin usar)

- `@repo/ui|eslint-config|typescript-config` intactos de `create-turbo`. `web` no depende de `@repo/ui`.
