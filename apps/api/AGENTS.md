# apps/api — AGENTS.md

NestJS 12 + ESM puro (`"type": "module"`, `module/nodenext`). Vitest 4 (no Jest), Oxlint (no ESLint).

## Dónde está qué

- `src/main.ts` + `src/bootstrap.ts` + `src/swagger.ts` — bootstrap, prefijo `/api/v1`, CORS, `ValidationPipe`, Swagger en `/api/docs`. Puerto `3001`.
- `src/app.module.ts` — wiring de módulos, guards globales (`JwtAuthGuard`, `RolesGuard`) e interceptor de tenant.
- `src/config/env.validation.ts` — valida `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CORS_ORIGIN`, `DATABASE_SCHEMA`.
- `src/prisma/` — `PrismaService` (adapter pg, `raw` y `scoped`) + extensión de tenant.
- `src/common/` — `context/` (AsyncLocalStorage + scope), `decorators/`, `guards/`, `dto/`, `types/`, `utils/`.
- `src/modules/` — `auth`, `tenant`, `orders`, `catalog`, `pricing`, `saas`, `billing`, `onboarding` (alta pública de tenant), `audit`. Cada uno con controller/service/dto.
- `src/main.ts` — body parser propio a 4 MB (`bodyParser: false` + `json/urlencoded`) para el logo del onboarding en data URL.
- `test/app.e2e-spec.ts` y `test/auth.e2e-spec.ts` — e2e con Prisma mockeado. Configs: `vitest.config.ts` (unit `*.spec.ts`), `vitest.config.e2e.ts`, `oxlint.json`, `nest-cli.json`.

## Reglas api

- Imports internos SIEMPRE con sufijo `.js` (ej: `./app.module.js`). Sin eso rompe `nodenext`.
- Estructura por dominio: `src/modules/<dominio>/{*.controller.ts,*.service.ts,*.dto.ts,*.spec.ts}`. No acumular en `app.*`.
- Todo endpoint con body/query usa DTO + `class-validator`; el `ValidationPipe` es global (`whitelist`, `forbidNonWhitelisted`, `transform`).
- Toda ruta privada usa `@Roles(...)` si no es para cualquier autenticado; `@Public()` solo para login, health e info.
- Las queries de negocio usan `prisma.scoped` (filtro automático de tenant); auth y consola SaaS usan `prisma.raw`. `findUnique/update/delete/upsert` no se auto-filtran: validar pertenencia con `findFirst`/`updateMany`.
- DB = PostgreSQL + Prisma 7 (decisión vigente, ver `docs/decisiones.md`). No introducir otro ORM.
- `strictPropertyInitialization: false` en `tsconfig.json` — no confiarse, inicializar igual.

## Comandos

- `pnpm --filter api dev | build | test | test:e2e | lint | check-types`.
- `test` = `vitest run` (unit), `test:e2e` usa su propio config.
