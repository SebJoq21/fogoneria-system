# API Fogonería

Backend NestJS 12 (ESM) con PostgreSQL 16 + Prisma 7. Multitenant por empresa (`empresa_id`) y sucursal (`sucursal_id`), con auth JWT, RBAC y consola SaaS.

## Requisitos

- Node >=24 (Prisma 7 funciona desde 22.12)
- pnpm 11
- PostgreSQL 16 con las extensiones `pgcrypto` y `citext`

## Configuración

1. Copiar variables de entorno:

```bash
cp .env.example .env
```

2. Ajustar `DATABASE_URL` (incluye `?schema=fogoneria`) y `SHADOW_DATABASE_URL`.
3. Definir `JWT_SECRET` (mínimo 32 caracteres en producción) y, si hace falta, `TRIAL_DAYS` y `BILLING_GRACE_DAYS`.
4. Generar el cliente Prisma:

```bash
pnpm --filter api db:generate
```

## Base de datos

El `docker-compose.yml` de la raíz levanta PostgreSQL 16 en `localhost:5433` (para no chocar con el 5432 de otros proyectos) y crea la base auxiliar `fogoneria_shadow` que usa `prisma migrate dev`.

| Comando | Uso |
|---|---|
| `db:up` | Levanta Postgres y espera a que el healthcheck esté sano |
| `db:down` | Detiene y elimina el contenedor (el volumen `pgdata` se conserva) |
| `db:logs` | Sigue los logs de Postgres |
| `db:status` | Muestra el estado del contenedor |
| `db:psql` | Abre `psql` dentro del contenedor |
| `db:generate` | Genera el cliente en `src/generated/prisma` (ignorado por git) |
| `db:validate` | Valida `prisma/schema.prisma` |
| `db:deploy` | Aplica migraciones pendientes (CI/producción) |
| `db:migrate` | Crea una migración en desarrollo |
| `db:seed` | Carga los datos demo (idempotente) |
| `db:reset` | Borra y recrea la base; vuelve a migrar y sembrar |
| `db:studio` | Abre Prisma Studio |

Flujo inicial:

```bash
pnpm --filter api db:up
pnpm --filter api db:deploy
pnpm --filter api db:seed
```

Si el 5433 también está ocupado, define `POSTGRES_PORT` en un `.env` de la raíz y actualiza `DATABASE_URL`/`SHADOW_DATABASE_URL` en `apps/api/.env`. Para borrar también los datos: `docker compose down -v`.

La migración `20261019000000_init` crea el esquema `fogoneria`, 41 tablas, 27 enums, 22 triggers, 4 vistas y los índices parciales. Requiere permisos para `CREATE EXTENSION`; en producción las extensiones pueden crearse antes con un usuario administrador.

### Usuarios demo

Todos usan la contraseña `Fogoneria123!`:

| Email | Rol |
|---|---|
| `super@fogoneria.com` | SUPERADMIN (consola SaaS) |
| `admin@mirestaurante.com` | ADMIN_GLOBAL |
| `sucursal@mirestaurante.com` | GERENTE_SUCURSAL |
| `cocina@mirestaurante.com` | COCINERO |
| `mesero@mirestaurante.com` | MESERO |
| `caja@mirestaurante.com` | CAJERO |

## Arquitectura de módulos

```text
src/
  main.ts / bootstrap.ts / swagger.ts / app.module.ts
  config/env.validation.ts
  common/
    context/      TenantContextService (AsyncLocalStorage) + extensión de Prisma
    decorators/   @Public, @Roles, @CurrentUser
    guards/       JwtAuthGuard global + RolesGuard global
    dto/          PaginationQueryDto
  prisma/         PrismaService (adapter pg) + PrismaModule global
  modules/
    auth/         POST /auth/login, GET /auth/me
    tenant/       contexto, empresa actual, sucursales
    orders/       órdenes con transiciones de estado
    catalog/      categorías, platos, grupos/opciones de modificadores
    pricing/      listas de precios y precios por plato
    saas/         alta/listado/suspensión/reactivación + métricas MRR
    billing/      cron diario de morosidad
    audit/        registro en `auditoria`
```

### Aislamiento multitenant (tarea 53)

- `TenantContextInterceptor` publica `empresaId`, `sucursalId`, `rol` y `bypass` en `AsyncLocalStorage`.
- La extensión `withTenantScope` inyecta `empresa_id`/`sucursal_id` en `findMany`, `findFirst`, `count`, `aggregate`, `groupBy`, `updateMany`, `deleteMany`, `create` y `createMany`.
- `SUPERADMIN` opera con `bypass` (consola SaaS); el resto siempre queda filtrado.
- `findUnique`, `update`, `delete` y `upsert` no se interceptan porque su `where` exige claves únicas; los servicios validan pertenencia con `findFirst`/`updateMany`.
- Los modelos hijos (`detalles_orden`, `opciones_modificadores`, `precios_platos`) heredan el aislamiento de su padre.

## Endpoints principales

Prefijo global: `/api/v1`. Documentación Swagger: `/api/docs`.

| Método | Ruta | Roles |
|---|---|---|
| POST | `/auth/login` | público |
| GET | `/auth/me` | autenticado |
| GET | `/health` | público |
| GET | `/tenant`, `/tenant/context`, `/tenant/branches` | autenticado |
| GET | `/orders`, `/orders/:id` | autenticado |
| POST | `/orders` | admin, sucursal, mesero, cajero |
| PATCH | `/orders/:id/status` | admin, sucursal, cocina, mesero, cajero |
| GET | `/catalog/categories`, `/catalog/dishes`, `/catalog/modifier-groups` | autenticado |
| POST/PATCH/DELETE | `/catalog/*` | admin, sucursal |
| GET | `/pricing/price-lists`, `/pricing/resolve` | autenticado |
| POST/PATCH/DELETE | `/pricing/price-lists/*` | admin, sucursal |
| POST | `/saas/tenants` | SUPERADMIN |
| GET | `/saas/tenants`, `/saas/tenants/:id`, `/saas/metrics` | SUPERADMIN |
| POST | `/saas/tenants/:id/suspend`, `/reactivate` | SUPERADMIN |
| PATCH | `/saas/tenants/:id/plan` | SUPERADMIN |

La colección Postman está en `docs/postman/fogoneria-api.postman_collection.json`.

## Consola SaaS y morosidad

- Alta de tenant: crea empresa en `TRIAL`, sucursal matriz, usuario `ADMIN_GLOBAL` y evento de suscripción.
- `TRIAL` vencido → `EXPIRED`; tras `BILLING_GRACE_DAYS` (5 por defecto) → `SUSPENDED`.
- El cron corre todos los días a las 03:00 (`@nestjs/schedule`).
- Cada cambio de estado queda en `suscripciones_eventos` y `auditoria`.
- El login rechaza empresas `SUSPENDED`, `EXPIRED`, `LEAD`, `NO_CALIFICADO` y trials vencidos.

## Desarrollo

```bash
pnpm --filter api dev
pnpm --filter api check-types
pnpm --filter api lint
pnpm --filter api test
pnpm --filter api test:e2e
```

`prebuild` y `precheck-types` ejecutan `prisma generate` para que el cliente exista antes de compilar.

> Los tests unitarios y e2e usan Prisma mockeado: no requieren PostgreSQL. La verificación contra la base real se hace con `db:up` + `db:deploy` + `db:seed` y la colección Postman.
