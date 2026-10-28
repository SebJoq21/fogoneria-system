# Arquitectura — Fogonería System

SaaS ERP gastronómico multitenant (1 empresa → N sucursales). Monorepo `pnpm + turbo`.

## apps/web (Next.js 16 + React 19 + Tailwind v4)

- Rutas: `/` login por rol → `/app/*` ERP (`DashboardShell`: `AppSidebar` + `AppTopBar`), `/saas` consola superadmin standalone, `/onboarding`, `/demo/[id]`, `/terminos`.
- Dominios ERP en `/app`: inicio, mesas (+`maestro`), órdenes, carta, cocina (KDS), mozo, caja, comprobantes, inventario, combos, promociones, clientes, reservas, gastos, analíticas, personal, platos/productos (`platos|categorias|modificadores|precios`), fidelización, pagos, soporte, configuración.
- Estado: `ModulesProvider.tsx` (contexto global + `localStorage` para el usuario y los datos del ERP; la autorización ya no depende de `localStorage`). El catálogo y las listas de precios ya vienen de la API (`lib/catalog-api.ts`); el resto del ERP sigue mock.
- Sesión: `app/api/session/route.ts` valida credenciales contra la API y emite `fogoneria.session` (HttpOnly/SameSite, HS256 con `SESSION_SECRET`, ventana deslizante de 15 min y tope de 8 h) y `fogoneria.token` (access token de la API, también HttpOnly). `proxy.ts` verifica firma/expiración/tope, refresca la sesión y aplica `ROLE_HOME`/`canViewPath`; el logout server-side (`/api/session/logout`) borra ambas cookies y redirige con 303.
- Tiempo real: `app/api/session/ws-ticket/route.ts` (BFF, `no-store`) canjea el Bearer de la cookie por un ticket de 60 s de la API; `lib/realtime.ts` abre Socket.io `/orders` con ese ticket, reconecta con backoff y deduplica por `eventId`. `OrdersView` muestra el estado del canal. Contrato en `docs/websockets.md`.
- Cliente API: el navegador llama al BFF `app/api/backend/[...path]`, que adjunta el Bearer desde la cookie HttpOnly (el JWT ya no está en `localStorage`). `lib/api.ts` expone `apiFetch`/`ApiError`; `lib/auth-api.ts` es el login server-side; `lib/onboarding-api.ts` y `lib/catalog-api.ts` usan el BFF; `lib/session-api.ts` es el cliente de sesión.
- Datos en `lib/`: `auth.ts` (roles + `ROLE_HOME` + `canViewPath` + mapeo rol/sucursal fail-closed), `session.ts` (firma/verificación), `backend.ts` (cookie del token), `session-rate-limit.ts` (5/10 min por IP), `tenancy.ts` (sucursales + `todas`), `permissions.ts` (cocina/mozo/caja), `erp.ts`, `erp-catalog.ts`, `dashboard.ts`, `demo.ts`.
- Tests: Vitest (`pnpm --filter web test`, 55 tests) para RBAC, firma/expiración, proxy, route handlers de login/logout, BFF, ticket WS y deduplicador.
- DS propio `components/ui/` + tokens `@theme` en `app/globals.css` + gate `scripts/check-styles.mjs`. `app/demo/*` exento del gate.

## apps/api (NestJS 12 + Prisma 7)

- `GET /api/v1` (info), `GET /api/v1/health` y Swagger en `/api/docs`. Prefijo global `/api/v1`, `ValidationPipe` global, CORS por `CORS_ORIGIN`. Puerto `3001`.
- Módulos: `auth` (JWT/Passport, login valida estado del tenant, `POST /auth/ws-ticket` para el canal en vivo), `tenant` (contexto y sucursales), `tables` (mesas por sucursal + bloqueo/liberación), `reservations` (reservas con aforo, solapamiento y estados), `orders` (POS: precio resuelto en servidor, `mesero_id` del JWT, folio por secuencia y estados del KDS), `realtime` (`OrdersGateway` Socket.io `/orders`, rooms por empresa/sucursal y eventos de comanda), `catalog` (categorías/platos/modificadores), `pricing` (listas y precios), `saas` (alta/listado/suspensión/MRR), `billing` (cron diario de morosidad), `onboarding` (`POST /onboarding` público: RUC → empresa TRIAL + admin + lead) y `audit`.
- Folios: `common/sequences` + tabla `secuencias` (`empresa_id`, `tipo`, `valor`) incrementada con una sentencia atómica dentro de la transacción del request; hoy emite `numero_orden` y `codigo` de reserva. Nada de `Date.now()` ni `COUNT(*)` para numerar.
- Aislamiento multitenant: `TenantContextService` (AsyncLocalStorage) + extensión Prisma que inyecta `empresa_id`/`sucursal_id`; `SUPERADMIN` opera con bypass. Modelos hijos heredan el filtro del padre. `findUnique/update/delete/upsert` se validan en el servicio.
- Datos: `prisma/schema.prisma` (41 modelos, 27 enums), migración `20261019000000_init`, seed demo idempotente (contraseña demo `Fogoneria123!`) y cliente Prisma 7 con `@prisma/adapter-pg`. Ver `docs/modelo-datos.md` y `apps/api/README.md`.
- Tests: Vitest unitario (127) + e2e con Prisma mockeado (38, con Socket.io real en `realtime`) + DB (40). Verificación real contra PostgreSQL 16 con `docker compose` (`localhost:5433`): `db:deploy`, `db:seed`, login, CRUD, SaaS, WebSockets y aislamiento con 2 empresas. Dockerfiles y CI siguen pendientes (tarea 58).

## packages/* (starter sin usar)

- `@repo/ui|eslint-config|typescript-config` intactos de `create-turbo`. `web` no depende de `@repo/ui`.
