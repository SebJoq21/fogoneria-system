# Decisiones vigentes

- [2026-09-12] Fase 3 backend = **Postgres + Prisma**. No introducir otro ORM sin revertir esto. `docker-compose` sigue pendiente (tarea 58).
- [2026-10-19] Prisma **7.10.1** con `prisma.config.ts`, generator `prisma-client` y `@prisma/adapter-pg`; esquema PostgreSQL `fogoneria` vía `DATABASE_URL?schema=fogoneria`.
- [2026-10-19] Las migraciones en `apps/api/prisma/migrations` son la **fuente ejecutable**; `db/fogoneria_schema.sql` queda como referencia del DDL y del seed histórico.
- [2026-10-19] El seed demo vive en `apps/api/prisma/seed.ts`, usa Prisma Client y es idempotente (`skipDuplicates` + IDs deterministas).
- [2026-09-12] Auth web actual = **mock con cookies planas** (`proxy.ts` + `lib/auth.ts`). No apto para prod; la API real revalidará JWT + tenant.
- [2026-09-12] Precio vive en **PriceList**, nunca en `Product`. Consumir vía `priceOf()` (`lib/erp-catalog.ts`).
- [2026-09-12] Catálogo/clientes globales; operación (órdenes/mesas/caja) **scoped por sucursal**. Vista `todas` solo agregada.
- [2026-09-12] Memoria del agente en capas: `AGENTS.md` (always-on mínimo) + `opencode.json:instructions` (referencia) + `docs/SESION.md` (sesión rotativa) + `/guardar-contexto` y `/retomar`.
