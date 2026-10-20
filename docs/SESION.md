# SESION — estado entre sesiones

## 2026-10-19 — Tareas 32 y 42: Prisma 7, migración inicial y seed demo

- Objetivo: desbloquear la fundación backend con `schema.prisma`, migraciones PostgreSQL y datos demo.
- Hecho:
  - Prisma 7.10.1 + `@prisma/adapter-pg` + `prisma.config.ts`; `schema.prisma` con 41 modelos, 27 enums e índices parciales (`apps/api/prisma/schema.prisma`).
  - Migración `20261019000000_init` desde el DDL, con CHECKs, 22 triggers y 4 vistas; verificada en base limpia.
  - Seed demo idempotente (`apps/api/prisma/seed.ts`): empresa, 3 sucursales, usuarios, catálogo, inventario, caja y RRHH.
  - Documentación: `docs/modelo-datos.md`, README de API, `TAREAS-SEMANAS-5-8.md` (global 37%, Sonny 72%).
- Pendiente: PR de `feat/prisma-schema` a `development`.
- Próximo paso: David retoma 44/48 sobre el schema y el seed ya listos.
- Verificado: `api check-types`, `api lint`, `api build`, `api test`, `api test:e2e`, `pnpm lint` raíz, `migrate deploy`, seed 2 veces sin duplicar.
- Extra: se agregó `@babel/preset-typescript` a la raíz para que `@repo/ui` lint resuelva el preset en pnpm estricto (falla preexistente).

## 2026-09-13 — Bloque grande sin commitear: sidebar, nombres, confirms, hubs, tipos, consola, breadcrumb

- Objetivo: dejar el ERP navegable, seguro y consistente (dueño) en una sola jornada; todo verificado pero SIN commit.
- Hecho:
  - Sidebar: 4 grupos (Principal/Carta/Clientes/Administración); Cocina y Mis órdenes solo-rol (`AppSidebar.tsx:42-77`, `DashboardShell.tsx:11-17`, `lib/auth.ts:56-57`); densidad `py-1.5/gap-0.5`, etiquetas `mt-5 mb-3` + `pb-5` en grupo; todo el nav a 14px.
  - Nombres: títulos generales (`lib/erp.ts:18,30,42,54` sin prefijos); URLs `articulos→platos`, `trabajadores→personal` (git `R`); `Carta virtual` absorbida como tab de Platos (ruta `/app/carta` eliminada); sin duplicados grupo/ítem (`Carta virtual`, tab `Maestro`, `Comensales`).
  - Seguridad: `ui/ConfirmDialog.tsx` + `danger` en `ui/Button.tsx`; confirms en 16 acciones (mesas, cocina, mozo, catálogo, comprobantes, precios con Enter/blur, promos); dueño sin operar mesas (`canChangeTableStatus`, Drawer lectura).
  - Hubs: norma `HubBlocks` (`workspace-ui.tsx`: `Acceso rápido` arriba + `Informes y másteres` debajo, 18px semibold, links en grilla; bloque vacío no se pinta); 5 hubs + bloques en Combos/Promociones/Comprobantes/Gastos (Analíticas sin bloques); Gastos/Comprobantes con tabs Panel/gestión; tira `ui/Tabs` en Platos.
  - Tipos: escala `12/13/14/16/18/24` (`globals.css`, `AGENTS.md`); jerarquía hubs 14/16/18 semibold; `text-section`=24 títulos, `text-display`=24 números/marca.
  - Consola Next 16 limpia: `next/script beforeInteractive` (`app/layout.tsx`) + `ThemeProvider` con `useSyncExternalStore`; fix key duplicada `Categorías` (`CategoriesView.tsx:55`).
  - Breadcrumb automático (`ui/Breadcrumb.tsx` + `lib/breadcrumbs.ts:trailFor`, 39 rutas) en `DashboardShell`.
  - Fix preexistente api: `test/app.e2e-spec.ts` sin `supertest/types`.
  - Verificado: `pnpm lint` 3/3 OK, `pnpm check-types` 3/3 OK, `api test` 1/1 + `test:e2e` 1/1.
- Pendiente: commit del bloque (64 archivos, +936/−344); `packages/ui` starter sin decidir; `*.tsbuildinfo` commiteado.
- Próximo paso: recorrido visual en `dev` por rol y commit.

## Historial 2026-09-12 — Memoria del agente + revisión 100%

- Montado sistema en capas (`AGENTS.md` raíz + anidados, `opencode.json`, `/guardar-contexto`, `/retomar`, `docs/`); decisión fase 3 = Postgres + Prisma.
- Revisión: web ERP mock avanzado, api scaffold, sin CI/Docker/`.env`.

## Historial previo — Frontend anterior

- `git log`: temas, onboarding, demo y planes previos al sistema turbo (commits `style(tema)`, `refactor(ui)`, `feat(operacion)`, `feat(pedidos)`); base reemplazada por monorepo actual (`b5ca606`).
