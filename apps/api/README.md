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
    sequences/    SequencesService: folios por empresa (ORD, RSV)
  prisma/         PrismaService (adapter pg) + PrismaModule global
  modules/
    auth/         POST /auth/login, GET /auth/me, POST /auth/ws-ticket
    tenant/       contexto, empresa actual, sucursales
    tables/       mesas por sucursal + bloqueo/liberación
    reservations/ reservas con aforo, solapamiento y estados
    orders/       órdenes con transiciones de estado
    realtime/     gateway Socket.io /orders (eventos de comanda y mesa)
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
| POST | `/auth/ws-ticket` | autenticado (ticket de 60 s para Socket.io) |
| GET | `/health` | público |
| GET | `/tenant`, `/tenant/context`, `/tenant/branches` | autenticado |
| GET | `/tables`, `/tables/:id` | autenticado |
| POST/PATCH/DELETE | `/tables`, `/tables/:id` | admin, sucursal |
| PATCH | `/tables/:id/status` (solo `LIBRE`/`MANTENIMIENTO`) | admin, sucursal |
| GET | `/reservations`, `/reservations/:id` | autenticado |
| POST/PATCH | `/reservations`, `/reservations/:id` | admin, sucursal, mesero, cajero |
| PATCH | `/reservations/:id/status` | admin, sucursal, mesero, cajero |
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

## Mesas y reservas (AYCDS-16)

- `GET /tables` devuelve las mesas de la sucursal del token, con filtros `estado` y `zona`.
- `POST/PATCH/DELETE /tables` es de `ADMIN_GLOBAL`/`GERENTE_SUCURSAL`. La baja es lógica (`deleted_at`) y el trigger `soft_delete_row` queda como respaldo.
- `PATCH /tables/:id/status` solo acepta `LIBRE` y `MANTENIMIENTO`: `OCUPADA` y `RESERVADA` los derivan las órdenes y las reservas. Una mesa con orden abierta o reserva activa no se bloquea ni se borra (409).
- `POST /reservations` valida aforo contra `mesas.capacidad` (409) y solapamiento de ±90 min en la misma mesa (409). El `codigo` (`RSV-YYYYMMDD-NNNN`) sale de la tabla `secuencias`, no del reloj.
- `GET /reservations?fecha=YYYY-MM-DD` filtra el día completo en hora de Lima (UTC-05:00).
- Transiciones: `POR_CONFIRMAR → CONFIRMADA|CANCELADA`, `CONFIRMADA → EJECUTADA|CANCELADA|NO_SHOW`. Los estados terminales no se reabren.
- La mesa pasa a `RESERVADA` al reservar, a `OCUPADA` al ejecutar y vuelve a `LIBRE` al cancelar/no-show solo si no quedan reservas activas ni órdenes abiertas.

## Órdenes POS (AYCDS-20)

- `POST /orders` **no acepta precios**: el `ValidationPipe` (`forbidNonWhitelisted`) devuelve 400 si el body trae `precioUnitario`. El servidor resuelve el plato con `PricingService.resolvePrice` sobre `listaPrecioId` (o la lista activa) y el combo con `combos.precio_fijo`, y calcula `subtotal`/`total` con 2 decimales.
- `mesero_id` sale del JWT y `numero_orden` de la tabla `secuencias` (`ORD-000123`), nunca de `Date.now()`.
- Al crear, la mesa pasa a `OCUPADA`; al llegar a `PAGADA`/`CERRADA`/`ANULADA` se libera en la misma transacción (vuelve a `RESERVADA` si queda una reserva activa y nunca pisa `MANTENIMIENTO`).
- Transiciones: `POR_CONFIRMAR → EN_COCINA|ANULADA`, `EN_COCINA → LISTO`, `LISTO → ENTREGADO`, `ENTREGADO → PAGADA|CERRADA`. **`ANULADA` solo desde `POR_CONFIRMAR`**: una comanda en preparación se entrega y se compensa (400 en la API, `DB_ORDEN_ANULACION_TARDIA` en la base).
- Los estados terminales devuelven 409 ante cualquier cambio. Cada alta y cada transición se registran en `auditoria`.
- `ADMIN_GLOBAL` (sin sucursal en el token) deduce la sucursal de la mesa o la recibe en `sucursalId`; sin mesa ni sucursal, 400.

## Tiempo real (AYCDS-14)

- `POST /auth/ws-ticket` (autenticado) firma un JWT de **60 s** con `scope: 'ws'`, `empresaId`, `sucursalId` y `rol`. `JwtStrategy` rechaza cualquier token con `scope`, así que el ticket **no** abre la API HTTP.
- `OrdersGateway` (namespace `/orders`) verifica el ticket en el handshake y une al socket al room `empresa:<id>` (roles sin sucursal) o `empresa:<id>:sucursal:<id>` (operativos). `order:subscribe` añade `order:<id>` validando el tenant.
- Eventos con sobre `{ eventId, at, data }`: `order.created`, `order.updated` y `table.status`. Se emiten al crear la comanda, en cada transición del KDS y al ocupar/liberar la mesa.
- Contrato completo, rooms y límites (sin Redis adapter: los rooms viven en el proceso): `docs/websockets.md`.

## Folios por empresa

`secuencias` (`empresa_id`, `tipo`, `valor`) se incrementa con una sola sentencia atómica (`INSERT ... ON CONFLICT ... RETURNING`) dentro de la transacción del request. Evita `Date.now()` y `COUNT(*)`, que se repiten bajo concurrencia. Hoy se usa para `numero_orden` (`ORD-000123`) y `codigo` de reserva.

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
