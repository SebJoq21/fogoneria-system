# Arquitectura — Fogonería System

SaaS ERP gastronómico multitenant (1 empresa → N sucursales). Monorepo `pnpm + turbo`.

## apps/web (Next.js 16 + React 19 + Tailwind v4)

- Rutas: `/` login por rol → `/app/*` ERP (`DashboardShell`: `AppSidebar` + `AppTopBar`), `/saas` consola superadmin standalone, `/onboarding`, `/demo/[id]`, `/terminos`.
- Dominios ERP en `/app`: inicio, mesas (+`maestro`), órdenes, carta, cocina (KDS), mozo, caja, comprobantes, inventario, combos, promociones, clientes, reservas, gastos, analíticas, personal, platos/productos (`platos|categorias|modificadores|precios`), fidelización, pagos, soporte, configuración.
- Estado: `ModulesProvider.tsx` (contexto global + `localStorage` para el usuario y los datos del ERP; la autorización ya no depende de `localStorage`). El catálogo y las listas de precios ya vienen de la API (`lib/catalog-api.ts`); el resto del ERP sigue mock.
- Sesión: `app/api/session/route.ts` valida credenciales contra la API y emite la cookie HttpOnly/SameSite `fogoneria.session`, firmada con HS256 (`lib/session.ts`, `jose`, `SESSION_SECRET`, 8 h); `proxy.ts` verifica firma/expiración y aplica `ROLE_HOME`/`canViewPath`. Logout borra la cookie en servidor (`lib/session-api.ts`).
- Cliente API: `lib/api.ts` (`NEXT_PUBLIC_API_URL`, JWT en `fogoneria:token` para `/api/v1`, `ApiError`), `lib/auth-api.ts` (login), `lib/onboarding-api.ts` (RUC + alta de tenant), `lib/catalog-api.ts` (catálogo/precios) y `lib/session-api.ts` (BFF de sesión).
- Datos en `lib/`: `auth.ts` (roles + `ROLE_HOME` + `canViewPath` + mapeo rol/sucursal de la API), `session.ts` (firma/verificación de la cookie), `tenancy.ts` (sucursales miraflores/surco/san-isidro + `todas`), `permissions.ts` (cocina/mozo/caja), `erp.ts` (órdenes/mesas/caja/inventario/personal), `erp-catalog.ts` (tipos + `priceOf()`/`categoryName()`, sin mocks), `dashboard.ts`, `demo.ts`.
- Tests: Vitest (`pnpm --filter web test`) para la matriz de acceso por rol y la firma/expiración de la sesión.
- DS propio `components/ui/` + tokens `@theme` en `app/globals.css` + gate `scripts/check-styles.mjs`. `app/demo/*` exento del gate.

## apps/api (NestJS 12 + Prisma 7)

- `GET /api/v1` (info), `GET /api/v1/health` y Swagger en `/api/docs`. Prefijo global `/api/v1`, `ValidationPipe` global, CORS por `CORS_ORIGIN`. Puerto `3001`.
- Módulos: `auth` (JWT/Passport, login valida estado del tenant), `tenant` (contexto y sucursales), `orders` (órdenes + transiciones), `catalog` (categorías/platos/modificadores), `pricing` (listas y precios), `saas` (alta/listado/suspensión/MRR), `billing` (cron diario de morosidad), `onboarding` (`POST /onboarding` público: RUC → empresa TRIAL + admin + lead) y `audit`.
- Aislamiento multitenant: `TenantContextService` (AsyncLocalStorage) + extensión Prisma que inyecta `empresa_id`/`sucursal_id`; `SUPERADMIN` opera con bypass. Modelos hijos heredan el filtro del padre. `findUnique/update/delete/upsert` se validan en el servicio.
- Datos: `prisma/schema.prisma` (41 modelos, 27 enums), migración `20261019000000_init`, seed demo idempotente (contraseña demo `Fogoneria123!`) y cliente Prisma 7 con `@prisma/adapter-pg`. Ver `docs/modelo-datos.md` y `apps/api/README.md`.
- Tests: Vitest unitario + e2e con Prisma mockeado (28 unit + 7 e2e). Verificación real contra PostgreSQL 16 con `docker compose` (`localhost:5433`): `db:deploy`, `db:seed`, login, CRUD, SaaS y aislamiento con 2 empresas. Dockerfiles y CI siguen pendientes (tarea 58).

## packages/* (starter sin usar)

- `@repo/ui|eslint-config|typescript-config` intactos de `create-turbo`. `web` no depende de `@repo/ui`.
