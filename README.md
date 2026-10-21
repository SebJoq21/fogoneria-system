# Fogonería System

ERP/CRM multitenant para restaurantes: API NestJS, web Next.js y PostgreSQL 16 con aislamiento por fila (RLS).

## Requisitos

- Node.js >= 24 y pnpm 11
- Docker con Compose (PostgreSQL local en `localhost:5433`)

## Inicio rápido (local)

```sh
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm --filter api db:up
pnpm --filter api db:deploy
pnpm --filter api db:seed
pnpm --filter api db:rls:roles
pnpm --filter api db:rls:force
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001/api/v1
- Swagger: http://localhost:3001/api/docs

En PowerShell usa `Copy-Item` en lugar de `cp`. El orden importa: el seed corre antes de activar `FORCE ROW LEVEL SECURITY`.

Credenciales demo: `admin@mirestaurante.com` / `Fogoneria123!` (también `super@fogoneria.com`, `sucursal@`, `cocina@`, `mesero@` y `caja@mirestaurante.com`).

## Docker Compose

```sh
docker compose up --build
```

Levanta PostgreSQL, aplica migraciones y seed, crea los roles RLS y arranca API y web. Para un entorno limpio:

```sh
docker compose down -v
docker compose up --build
```

`schema=fogoneria` se mantiene en todas las URLs. `SESSION_COOKIE_SECURE=false` solo aplica al Compose local por HTTP; en producción debe quedar en `true`.

## Pruebas

```sh
pnpm --filter api test
pnpm --filter api test:db
pnpm --filter api test:e2e
pnpm --filter web test
pnpm --filter web check-types
pnpm --filter web lint
pnpm build
```

`test:db` requiere `DATABASE_URL_TEST` apuntando a una base **descartable** (trunca empresas y leads). Los tests de base usan PostgreSQL real con RLS forzado.

## Documentación

- `docs/arquitectura.md`: visión general y capas.
- `docs/modelo-datos.md` y `docs/rls-modelo.md`: modelo físico, políticas y roles.
- `docs/errores-db.md`: códigos SQLSTATE y traducción a HTTP.
- `docs/explain-rls.md`: evidencia de planes e índices.
- `docs/acta-qa-aycds-66.md`: matriz QA, RBAC y aislamiento.
- `docs/backlog.md`: pendientes priorizados P0–P3.
- `docs/decisiones.md`: decisiones vigentes.
- `docs/TAREAS-SEMANAS-5-8.md`: avance por tarea.
- `docs/SESION.md`: estado entre sesiones.

## Estructura

```text
apps/api        API NestJS + Prisma + PostgreSQL
apps/web        Next.js (App Router) + BFF /api/backend
db/scripts/rls  Roles y activación de FORCE RLS
docker/initdb   Creación de la base auxiliar de migraciones
docs            Arquitectura, modelo, QA y seguimiento
```
