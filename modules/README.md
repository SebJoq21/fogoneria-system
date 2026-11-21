# modules/

Fuente de verdad de la **paridad de módulos** backend ↔ frontend ↔ contratos ↔ specs.

- `catalog.json` — catálogo canónico de los 20 módulos (ID, tipo, owner, estado, rutas, nav y legado). Estados: `pending`, `in-progress`, `aligned`.
- `<id>/module.json` — manifiesto de cada módulo (`id`, `kind`, `owner`, `status`, `routes`); es la pieza que edita el dueño.
- `pnpm check:modules` — reporte de avance; `--strict` es el **gate** del CI (20/20/20/20).
- `pnpm gen:modules` — regenera `apps/api/src/modules/registry.ts`, `apps/web/features/registry.ts` y `apps/web/lib/modules-nav.ts` desde el catálogo, los manifiestos y los `features/<id>/module.ts` existentes. No editar esos tres archivos a mano.
- `pnpm gen:modules --check` — falla si un generado quedó desactualizado; corre en el job `quality` del CI (compara contenido con EOL normalizado).
- `pnpm gen:modules --sync-manifests` — crea los `module.json` que falten a partir del catálogo.

## Estado (2026-11-21)

Fases 0–5 ejecutadas: manifiestos **20/20**, backend **20/20**, frontend **20/20**, contratos canónicos **20/20** (+12 alias deprecados), specs **20/20**. `pnpm check:modules --strict` verde y cableado en CI.

Los subpaths antiguos de contratos (`caja`, `catalogo`, `plataforma`, `tiempo-real`, `comprobantes`, `gastos`, `inventario`, `mesas`, `ordenes`, `promociones`, `reservas`, `rrhh`) quedan como alias `@deprecated` de sus equivalentes (`cash`, `catalog`+`pricing`, `auth`+`tenant`+`onboarding`+`saas`+`billing`, `realtime`, `receipts`, `expenses`, `inventory`, `tables`, `orders`, `promotions`, `reservations`, `staff`) durante una release.

Pendiente: providers por módulo/retirar `ModulesProvider` (Fase 6) y Prisma multi-archivo (Fase 7). Documento completo: [`docs/plan-paridad-modulos.md`](../docs/plan-paridad-modulos.md).
