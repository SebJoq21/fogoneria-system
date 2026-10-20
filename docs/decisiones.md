# Decisiones vigentes

- [2026-09-12] Fase 3 backend = **Postgres + Prisma**. No introducir otro ORM sin revertir esto. `docker-compose` sigue pendiente (tarea 58).
- [2026-10-19] Prisma **7.10.1** con `prisma.config.ts`, generator `prisma-client` y `@prisma/adapter-pg`; esquema PostgreSQL `fogoneria` vía `DATABASE_URL?schema=fogoneria`.
- [2026-10-19] Las migraciones en `apps/api/prisma/migrations` son la **fuente ejecutable**; `db/fogoneria_schema.sql` queda como referencia del DDL y del seed histórico.
- [2026-10-19] El seed demo vive en `apps/api/prisma/seed.ts`, usa Prisma Client y es idempotente (`skipDuplicates` + IDs deterministas).
- [2026-09-12] Auth web actual = **mock con cookies planas** (`proxy.ts` + `lib/auth.ts`). No apto para prod; la API real revalidará JWT + tenant.
- [2026-10-20] Auth API = **JWT (Passport) + bcryptjs**. El login valida usuario activo y estado del tenant (`TRIAL`/`ACTIVE`); `SUSPENDED`/`EXPIRED`/`LEAD`/`NO_CALIFICADO` y trial vencido se rechazan. Contraseña demo única: `Fogoneria123!`.
- [2026-10-20] Aislamiento multitenant de la API = **AsyncLocalStorage + Prisma Client Extension** (`prisma.scoped`), no RLS nativo todavía. SUPERADMIN opera con bypass. El RLS de PostgreSQL queda para la tarea 62; no duplicar la lógica en controllers.
- [2026-10-20] La API expone **`/api/v1`** con `ValidationPipe` global y Swagger en `/api/docs`; los DTO viven junto a cada módulo. Las queries de negocio usan `scoped`; auth y consola SaaS usan `raw`.
- [2026-10-20] Ciclo SaaS: `TRIAL → EXPIRED` al vencer `trial_fin` y `EXPIRED → SUSPENDED` tras `BILLING_GRACE_DAYS` (5 por defecto), ejecutado por cron diario a las 03:00. Cada transición se audita.
- [2026-09-12] Precio vive en **PriceList**, nunca en `Product`. Consumir vía `priceOf()` (`lib/erp-catalog.ts`).
- [2026-09-12] Catálogo/clientes globales; operación (órdenes/mesas/caja) **scoped por sucursal**. Vista `todas` solo agregada.
- [2026-09-12] Memoria del agente en capas: `AGENTS.md` (always-on mínimo) + `opencode.json:instructions` (referencia) + `docs/SESION.md` (sesión rotativa) + `/guardar-contexto` y `/retomar`.
