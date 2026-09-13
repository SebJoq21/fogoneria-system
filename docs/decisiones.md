# Decisiones vigentes

- [2026-09-12] Fase 3 backend = **Postgres + Prisma**. Aún sin schema ni `docker-compose`. No introducir otro ORM sin revertir esto.
- [2026-09-12] Auth web actual = **mock con cookies planas** (`proxy.ts` + `lib/auth.ts`). No apto para prod; la API real revalidará JWT + tenant.
- [2026-09-12] Precio vive en **PriceList**, nunca en `Product`. Consumir vía `priceOf()` (`lib/erp-catalog.ts`).
- [2026-09-12] Catálogo/clientes globales; operación (órdenes/mesas/caja) **scoped por sucursal**. Vista `todas` solo agregada.
- [2026-09-12] Memoria del agente en capas: `AGENTS.md` (always-on mínimo) + `opencode.json:instructions` (referencia) + `docs/SESION.md` (sesión rotativa) + `/guardar-contexto` y `/retomar`.
