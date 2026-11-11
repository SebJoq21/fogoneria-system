<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# apps/web — AGENTS.md

Next.js 16.3.4 + React 19 + Tailwind v4 (CSS-first, sin `tailwind.config`). Sin `src/`: App Router en `app/`.

## Dónde está qué

- `app/` — rutas: `/` login, `/app/*` ERP bajo `DashboardShell`, `/saas` consola superadmin, `/onboarding`, `/demo/[id]`, `/terminos`.
- `components/ui/` — único DS válido (`Button`, `Card`, `fields`, `data-table`, `Modal`, `Drawer`, `Tabs`, `KpiCard`, `cn`). No crear estilos crudos fuera.
- `components/erp/` + `components/dashboard/` — vistas por dominio. `lib/` — estado/dominio: `auth.ts`, `tenancy.ts`, `permissions.ts`, `erp.ts`, `erp-catalog.ts`, `dashboard.ts`; clientes de API: `api.ts`, `auth-api.ts`, `onboarding-api.ts`, `catalog-api.ts`, `tenant-api.ts`, `realtime.ts` (Socket.io `/orders`), `cash-api.ts` (caja) y `receipts-api.ts` (comprobantes); sesión: `session.ts` (servidor, firma HS256) y `session-api.ts` (cliente del BFF).
- `proxy.ts` — RBAC server-side con la cookie HttpOnly `fogoneria.session` (firmada, 15 min con refresh); la emite `app/api/session/route.ts`. `scripts/check-styles.mjs` — gate de estilos en `pnpm lint`.

## Reglas web (evitan los errores repetidos)

- Precio vive en `PriceList`, nunca en `Product`. Usar `priceOf(productId, lists)` / `categoryName(categoryId, categories)` de `lib/erp-catalog.ts` (ids de catálogo = UUID de la API).
- Catálogo global, operación scoped por sucursal (`ModulesProvider.applyWrite`). Vista `todas` es agregada de lectura.
- RBAC espejo: `lib/auth.ts:canViewPath` == `proxy.ts`, que verifica la cookie firmada `fogoneria.session` (no `localStorage`). Roles: `superadmin|admin|sucursal|cajero|cocina|mesero` (`ROLE_HOME` en `lib/auth.ts`). `cajero` = rol real de la API (`API_ROLE.CAJERO`), solo `/app`, `/app/caja` y `/app/comprobantes`. No volver a autorizar con cookies planas ni con el usuario de `localStorage`.
- Tiempo real (AYCDS-14): el navegador **nunca** usa el access token. `lib/realtime.ts` pide un ticket de 60 s a `GET /api/session/ws-ticket` (BFF, 401 sin sesión) y lo pasa como `auth.ticket`; cada reconexión pide uno nuevo. La reconexión es propia (`reconnection: false`, backoff 1 s → 30 s + jitter) y los eventos se deduplican por `eventId`. Contrato en `docs/websockets.md`.
- Tablero del KDS (AYCDS-41): `OrdersView` lee el tablero real con `useOrdersBoard` → `getOrdersBoard()` (`/orders/board`). Un **solo** socket (`useOrdersRealtime`) refresca tablero y comandas con `order.created`, `order.updated` y `order.sla`; no abrir un segundo `connectOrdersRealtime`. La regla de urgencia vive en `kdsBoardFromApi`/`slaTone` (ámbar >10 min, rojo >20) y la base del reloj es `confirmacionAt ?? ingresoAt`. Sin sesión la vista cae al estado local del demo.
- Caja (AYCDS-46): `CajaView` opera contra `lib/cash-api.ts` cuando hay sesión —turno y arqueo del servidor, movimientos, historial y cobro de comandas `ENTREGADO`— y cae al estado local sin sesión. **No** se marca `PAGADA` desde órdenes: el cobro es `POST /cash/charges` (pago parcial + propina) y luego se refresca caja y órdenes.
- Comprobantes (AYCDS-46 p2): `ComprobantesView` lista/emite/anula contra `lib/receipts-api.ts` cuando hay sesión. La emisión **solo** acepta una comanda `PAGADA` de la API (el importe lo pone el servidor); sin sesión se mantiene el flujo demo con `ModulesProvider`. **SUNAT queda «pendiente de OSE»**: no se inventa CDR ni resumen diario con la API real; esas acciones solo existen en el demo.
- Inventario (AYCDS-24): `InventoryMovementsView` lee el kardex de `lib/inventory-api.ts` (`/inventory/movements`) y pinta el semáforo con `/inventory/stock` cuando hay sesión; sin sesión cae al demo. El maestro de insumos, ajustes y recetas de `InventoryModule` **sigue en demo** — es lo que falta de la 24.
- CRM (AYCDS-40): `ClientesView` lista/busca/filtra por segmento contra `lib/crm-api.ts`, abre la ficha con sus últimos movimientos de puntos y ajusta (cortesía/canje/caducidad). El ajuste **manda `sucursalId`** (el `ADMIN_GLOBAL` no lo lleva en el token) y el segmento lo calcula el servidor: no se edita a mano.
- Tenant y sucursales se hidratan de la API (`lib/tenant-api.ts` → `/tenant`, `/tenant/branches`) en `ModulesProvider`; `DEMO_COMPANY` y `GENERAL_BRANCH` son el fallback sin sesión.
- UI: `Button href` con `<a>` está permitido aquí; no usar `<img>` crudo salvo `app/demo/*` (exento del gate).
- Solo pesos `400/500`, salvo etiquetas de hub (`Másteres e informes` 18px y títulos de columna 16px) que van en `semibold` (600) por decisión de diseño. Escala `12/13/14/16/18/24`, tokens `@theme` en `app/globals.css`.
- RSC delgados que delegan a client. Login/onboarding y catálogo/precios ya llaman a la API (`lib/api.ts` + `NEXT_PUBLIC_API_URL`); el resto del ERP sigue con estado en `ModulesProvider` + `localStorage`.
- Toda acción de 1 click que mute estado usa `ui/ConfirmDialog` (Aceptar/Cancelar; `danger` en destructivas). Los formularios con `Guardar` no la necesitan. Precios se confirman con Enter/blur, nunca por tecla.
- El mesero abre cuenta y atiende (`canOpenAccount`); `sucursal` y `cajero` cobran y operan caja (`canCheckout`, `canOperateCash`); cocina solo su KDS. Estados de mesa derivados de cuenta/reserva (`deriveTableStatus`); bloqueo manual de mesa solo sucursal.
- Norma de hub (dueño): resumen arriba → `Acceso rápido` → `Informes y másteres` (ambos 18px semibold, componente `HubBlocks` en `erp/workspace-ui.tsx`). Si un bloque va vacío no se pinta (ej: Analíticas).
- Nombres = sidebar; al renombrar una ruta actualizar `AppTopBar`.

## Comandos

- `pnpm --filter web dev | build | lint | check-types | test` (`lint` = `eslint && node scripts/check-styles.mjs`; `test` = Vitest).
