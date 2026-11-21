# modules/

Fuente de verdad de la **paridad de módulos** backend ↔ frontend ↔ contratos ↔ specs.

- `catalog.json` — catálogo canónico de los 20 módulos (ID, tipo, owner, estado, rutas, nav y legado). Estados: `pending`, `in-progress`, `aligned`.
- `<id>/module.json` — manifiesto de cada módulo (`id`, `kind`, `owner`, `status`, `routes`); es la pieza que edita el dueño.
- `pnpm check:modules` — reporte de avance (no falla); `--strict` será el gate cuando cierre la migración.
- `pnpm gen:modules` — regenera `apps/api/src/modules/registry.ts`, `apps/web/features/registry.ts` y `apps/web/lib/modules-nav.ts` desde el catálogo, los manifiestos y los `features/<id>/module.ts` existentes. No editar esos tres archivos a mano.
- `pnpm gen:modules --check` — falla si un generado quedó desactualizado (lo usa el CI cuando se active el gate).
- `pnpm gen:modules --sync-manifests` — crea los `module.json` que falten a partir del catálogo.

## Estado (2026-11-21)

Fases 0–2 ejecutadas: manifiestos 20/20, backend 20/20, frontend 12/20, contratos canónicos 2/20 (+7 alias deprecados), specs 20/20 canónicas.

Los subpaths antiguos de contratos (`caja`, `comprobantes`, `gastos`, `inventario`, `ordenes`, `promociones`, `rrhh`) quedan como alias `@deprecated` de sus equivalentes (`cash`, `receipts`, `expenses`, `inventory`, `orders`, `promotions`, `staff`) durante una release.

Pendiente: splits de `catalogo`, `salon` y `plataforma`, features `audit`/`realtime`, providers por módulo (Fase 6) y Prisma multi-archivo (Fase 7). Documento completo: [`docs/plan-paridad-modulos.md`](../docs/plan-paridad-modulos.md).
