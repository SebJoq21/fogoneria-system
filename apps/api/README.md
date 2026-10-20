# API Fogonería

Backend NestJS 12 (ESM) con PostgreSQL 16 + Prisma 7.

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

3. Generar el cliente Prisma:

```bash
pnpm --filter api db:generate
```

## Base de datos

| Comando | Uso |
|---|---|
| `db:generate` | Genera el cliente en `src/generated/prisma` (ignorado por git) |
| `db:validate` | Valida `prisma/schema.prisma` |
| `db:deploy` | Aplica migraciones pendientes (CI/producción) |
| `db:migrate` | Crea una migración en desarrollo |
| `db:seed` | Carga los datos demo (idempotente) |
| `db:reset` | Borra y recrea la base; vuelve a migrar y sembrar |
| `db:studio` | Abre Prisma Studio |

Flujo inicial:

```bash
pnpm --filter api db:deploy
pnpm --filter api db:seed
```

La migración `20261019000000_init` crea el esquema `fogoneria`, 41 tablas, 27 enums, 22 triggers, 4 vistas y los índices parciales. Requiere permisos para `CREATE EXTENSION`; en producción las extensiones pueden crearse antes con un usuario administrador.

## Desarrollo

```bash
pnpm --filter api dev
pnpm --filter api check-types
pnpm --filter api lint
pnpm --filter api test
pnpm --filter api test:e2e
```

`prebuild` y `precheck-types` ejecutan `prisma generate` para que el cliente exista antes de compilar.
