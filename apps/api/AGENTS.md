# apps/api — AGENTS.md

NestJS 12 + ESM puro (`"type": "module"`, `module/nodenext`). Vitest 4 (no Jest), Oxlint (no ESLint).

## Dónde está qué

- `src/main.ts` + `src/bootstrap.ts` + `src/swagger.ts` — bootstrap, prefijo `/api/v1`, CORS, `ValidationPipe`, Swagger en `/api/docs`. Puerto `3001`.
- `src/app.module.ts` — wiring de módulos, guards globales (`JwtAuthGuard`, `RolesGuard`) e interceptor de tenant.
- `src/config/env.validation.ts` — valida `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CORS_ORIGIN`, `DATABASE_SCHEMA`, `DATABASE_POOL_MAX` (conexiones por cliente de Prisma; default 10).
- `src/prisma/` — `PrismaService` (adapter pg, `raw` y `scoped`) + extensión de tenant.
- `src/common/` — `context/` (AsyncLocalStorage + scope), `decorators/`, `guards/`, `dto/`, `types/`, `utils/`.
- `src/modules/` — `auth`, `tenant`, `tables` (mesas por sucursal), `reservations` (reservas con aforo y solapamiento), `orders`, `realtime` (gateway Socket.io), `catalog`, `pricing`, `saas`, `billing`, `onboarding` (alta pública de tenant), `audit`. Cada uno con controller/service/dto.
- `src/modules/realtime/` — `@Global` con `OrdersGateway` (namespace `/orders`), `RealtimeService` (fachada que usan los servicios) y el contrato en `realtime.types.ts`. Rooms `empresa:<id>` (roles sin sucursal) y `empresa:<id>:sucursal:<id>` (operativos); `order:<id>` vía `order:subscribe`. Sobre `{ eventId, at, data }`. Contrato completo en `docs/websockets.md`.
- `src/common/sequences` — folios por empresa (`ORD`, `RSV`) sobre la tabla `secuencias`; el SQL crudo se califica con `DATABASE_SCHEMA` porque no pasa por Prisma. **El upsert corre en autocommit sobre `prisma.raw`, fuera de la transacción del request** (AYCDS-22): dentro de ella el lock de la fila se retiene hasta el commit y serializa las altas de la empresa. Si la creación falla después, el folio queda con hueco (aceptado). No volver a moverlo a la transacción.
- `src/main.ts` — body parser acotado (`bodyParser: false` + `json/urlencoded`): 4 MB solo en `/api/v1/onboarding` (logo en data URL) y 100 KB en el resto. No subir el límite global.
- `src/common/guards/rate-limit.guard.ts` — límite por IP en memoria para endpoints públicos (`ONBOARDING_RATE_LIMIT`, `ONBOARDING_RATE_WINDOW_MS`). Sin dependencias inyectadas: config por `process.env` + `configure()` para tests.
- `test/{app,auth,onboarding,orders,tables,reservations,realtime}.e2e-spec.ts` — e2e con Prisma mockeado (`realtime` levanta Socket.io real en un puerto efímero). Configs: `vitest.config.ts` (unit `*.spec.ts`), `vitest.config.e2e.ts`, `vitest.config.db.ts` (PostgreSQL real), `oxlint.json`, `nest-cli.json`.

## Reglas api

- Imports internos SIEMPRE con sufijo `.js` (ej: `./app.module.js`). Sin eso rompe `nodenext`.
- Estructura por dominio: `src/modules/<dominio>/{*.controller.ts,*.service.ts,*.dto.ts,*.spec.ts}`. No acumular en `app.*`.
- Todo endpoint con body/query usa DTO + `class-validator`; el `ValidationPipe` es global (`whitelist`, `forbidNonWhitelisted`, `transform`).
- Toda ruta privada usa `@Roles(...)` si no es para cualquier autenticado; `@Public()` solo para login, health e info.
- Las queries de negocio usan `prisma.scoped` (filtro automático de tenant); auth y consola SaaS usan `prisma.raw`. `findUnique/update/delete/upsert` no se auto-filtran: validar pertenencia con `findFirst`/`updateMany`.
- DB = PostgreSQL + Prisma 7 (decisión vigente, ver `docs/decisiones.md`). No introducir otro ORM.
- Órdenes (AYCDS-20): el precio **nunca** viene del cliente. El DTO no acepta `precioUnitario` (el `forbidNonWhitelisted` lo rechaza) y `OrdersService` resuelve los precios **en lote** (AYCDS-22): un `findMany` de platos, uno de combos y uno de `precios_platos` por comanda, y combos con `combos.precio_fijo`. No volver a consultar plato/precio por línea (N+1). `mesero_id` sale del JWT y `numero_orden` de `SequencesService`. `ANULADA` solo desde `POR_CONFIRMAR`: una comanda en cocina se entrega y se compensa, y el trigger `trg_ordenes_inmutable` aplica la misma regla.
- Tiempo real (AYCDS-14): el handshake **no** usa el access token. `POST /auth/ws-ticket` firma un JWT de 60 s con `scope: 'ws'` y `JwtStrategy` rechaza cualquier token con `scope` (el ticket no abre la API HTTP). Los servicios emiten por `RealtimeService`, nunca por el gateway directo; el gateway solo se usa dentro del módulo `realtime`. Un rol con sucursal no entra al room de empresa (evita eventos duplicados).
- `strictPropertyInitialization: false` en `tsconfig.json` — no confiarse, inicializar igual.

## Comandos

- `pnpm --filter api dev | build | test | test:e2e | lint | check-types`.
- `test` = `vitest run` (unit), `test:e2e` usa su propio config.
