# Modularización — backend + frontend por módulo

**Fecha:** 2026-11-19 · **Estado:** Fases 0–2 implementadas (fundaciones, RRHH y catálogo/precios) + olas **salón**, **dinero** y **operación** de la Fase 3 (`tables`, `reservations`, `orders`/KDS; `receipts`, `cash`, `expenses`; `inventory`, `promotions`).

Una persona debe poder avanzar **RRHH** tocando solo `modules/rrhh` (contratos + API + web) y su página de ruta, sin abrir caja, órdenes ni el estado global.

---

## 1. Estructura objetivo

```
apps/
  web/                        # shell: rutas delgadas + sesión + layout
  api/                        # composition root: registra módulos
  worker/                     # cron, outbox (fase posterior)

modules/                      # una carpeta por módulo = una unidad de trabajo
  rrhh/
    contracts/                # @fogoneria/rrhh-contracts  (tipos + validadores)
    api/                      # @fogoneria/rrhh-api        (NestJS)
    web/                      # @fogoneria/rrhh-web        (React)
  orders/
  cash/
  inventory/
  ...

packages/
  kernel/                     # Money, fechas Lima, redondeos (sin dependencias)
  sdk/                        # createClient del BFF + ApiError
  contracts/                  # contratos compartidos (hoy empieza con RRHH)
  ui/                         # design system
  config/                     # eslint/ts/tailwind
```

### Backend de un módulo

```
modules/rrhh/api/src/
  domain/            reglas puras (turnos, propinas)
  application/       casos de uso + puertos
  infrastructure/    Prisma + adaptadores
  api/               controller + DTOs
  index.ts           API pública (módulo Nest + tokens)
```

### Frontend de un módulo

```
modules/rrhh/web/src/
  views/             componentes de pantalla
  hooks/             estado y fetching del módulo
  api.ts             cliente con @fogoneria/sdk + contratos
  index.ts           exporta las vistas
```

La ruta queda en tres líneas:

```tsx
// apps/web/app/app/modulos/personal/asistencia/page.tsx
import { StaffAttendancePage } from "@fogoneria/rrhh-web";
export default function Page() { return <StaffAttendancePage />; }
```

### Fase transitoria (hoy)

Mientras se migra, el frontend vive en `apps/web/features/<módulo>/` con las mismas reglas (no importa otras features ni `components/erp/*`). Cuando el módulo madura, se mueve a `modules/<módulo>/web` sin cambiar sus imports internos.

---

## 2. Reglas de dependencia

### Backend

- Un módulo solo importa el **`index` público** de otro.
- Prohibido usar el Prisma de otro módulo o leer sus tablas.
- `domain/` no importa Nest, Prisma ni HTTP.
- `application/` depende de puertos, no de adaptadores.
- Síncrono: puerto (`PricingPort`, `TablesPort`). Asíncrono: evento/outbox.

### Frontend

- Una feature importa: sus contratos, `@fogoneria/sdk`, `@fogoneria/kernel`, `@/components/ui` y el contexto de plataforma (sesión/tenant/sucursal).
- **No** importa otra feature, ni `components/erp/*`, ni la app, ni la API.
- El estado de negocio vive en la feature; `ModulesProvider` queda solo para plataforma.
- Navegación entre módulos por URL, no por import de componentes.

### Datos

| Módulo | Tablas |
|---|---|
| `rrhh` | empleados, roles_empresa, turnos_plan, asistencias, pozos_propinas, repartos_propinas |
| `orders` | ordenes, detalles_orden, detalles_orden_modificadores |
| `tables` | mesas |
| `reservations` | reservas |
| `cash` | turnos_caja, movimientos_caja |
| `receipts` | comprobantes, secuencias |
| `expenses` | gastos, proveedores |
| `inventory` | insumos, stocks_sucursal, movimientos_inventario, escandallos, alertas |
| `promotions` | combos, cupones, canjes, reglas |
| `crm` | clientes, movimientos_puntos, config_lealtad |
| `catalog` | categorias, platos, grupos/opciones |
| `pricing` | listas_precios, precios_platos |
| `bi` | solo vistas de lectura |
| `platform` | empresas, sucursales, usuarios, suscripciones, auditoría |

---

## 3. Cómo se hace cumplir (ya implementado)

| Regla | Dónde |
|---|---|
| Un PR = un módulo | `scripts/check-pr-scope.mjs` + job CI `Un PR por módulo` |
| Nadie importa internals de otro módulo | `scripts/check-module-boundaries.mjs` + job CI `Fronteras de módulos` |
| Baseline de acoplamientos históricos | `scripts/module-boundaries.baseline.json` (22 tras las Fases 1–2; **21** tras la ola salón; **14** tras la ola dinero; **7** tras la ola operación) |
| Paquetes compartidos | `@fogoneria/kernel`, `@fogoneria/sdk`, `@fogoneria/contracts` |
| Contratos de módulo | `packages/contracts/src/<módulo>.ts` |

El chequeo de fronteras falla solo con **violaciones nuevas** (ratchet): al refactorizar un módulo se eliminan sus entradas del baseline.

---

## 4. Diagnóstico de acoplamiento (auditoría 2026-11-19)

### Backend — los 5 más peligrosos

1. **`cash → orders` en la misma transacción.** `CashService.charge` llama `OrdersService.markPaid` y escribe `ordenes.propina`; caja no se puede extraer sin partir la comanda.
2. **`orders` orquesta inventory + promotions + sequences + realtime/audit** en la misma tx; la lógica de precios está triplicada (pricing/orders/promotions).
3. **`tables ↔ reservations ↔ orders` comparten `mesas`, `ordenes`, `reservas`** y reparten las reglas de estado.
4. **La reversión financiera vive en triggers de BD** (caja/kardex) invisibles para el DI: cambiar receipts/cash sin revisar triggers produce doble reversión o ninguna.
5. **`onboarding`, `saas` y `billing` escriben el mismo agregado tenant** con reglas duplicadas y `prisma.raw` (bypass RLS).

### Frontend — los 5 más difíciles de cortar

1. `ModulesProvider` es un god-context del que cada vista toma 3–15 campos.
2. El catálogo (`products/priceOf/modifierGroups`) lo usan mozo, combos, inventario, carta y checkout.
3. `accounts → checkoutAccount → openCashShift → receipts` comparten estado local de cuenta/caja.
4. El modo dual API/demo (`hasSession`) está replicado en 12 vistas.
5. Tenant/sucursal y el mapeo UUID→id numérico (`table-mapping`) atraviesan mesas, mozo y caja.

Estos son los puntos que las olas deben cortar en ese orden.

---

## 5. Fases

### Fase 0 — Fundaciones ✅ (este PR)

- `packages/kernel`, `packages/sdk`, `packages/contracts` (RRHH inicial).
- `scripts/check-module-boundaries.mjs` + baseline + job CI **`Fronteras de módulos`**.
- `pr-scope` reconoce `apps/web/features/<m>/**` y `packages/contracts/src/<m>.ts`.
- `transpilePackages` en Next.

### Fase 1 — Piloto RRHH ✅ (PR `refactor/rrhh-modulo`)

- `apps/web/features/rrhh/`: `api.ts` (SDK + contratos), `hooks.ts` (`useAttendance`, `useShifts`), `AttendancePage`, `ShiftsPage`, demo aislado.
- Las rutas de asistencia y turnos solo importan `@/features/rrhh` (la página conserva guard y cabecera).
- `apps/api/src/modules/staff/index.ts` como API pública; `app.module` importa el `index`.
- La feature no importa `components/erp/*` ni otras features; usa `@fogoneria/sdk`, `@fogoneria/contracts` y `@fogoneria/kernel`.
- Criterio: avanzar RRHH toca `features/rrhh/**` + sus rutas + `staff/**`; hecho.

### Fase 2 — Piloto catálogo + precios ✅ (PR #50)

- `packages/contracts/src/catalogo.ts` con tipos, inputs, validadores y helpers.
- Feature `catalogo` con productos, categorías, modificadores y precios; cliente SDK de solo lectura y fachada sobre el provider.
- `catalog/index.ts` y `pricing/index.ts` públicos; rutas de productos importan la feature.
- `summaries` se movió a `components/dashboard` para que una feature pueda usarlo sin importar `components/erp`.
- **`PricingPort` implementado:** `orders` inyecta `PRICING_PORT` y pide los precios en lote; ya no lee `precios_platos`, `listas_precios` ni `PricingService`. La lista activa y las validaciones viven en Precios.

### Fase 3 — Olas (un PR por módulo, backend + frontend)

| Ola | Módulos | Estado |
|---|---|---|
| Salón | `tables` → `reservations` → `orders` | ✅ hecha |
| Dinero | `receipts` → `cash` → `expenses` | ✅ hecha |
| Operación | `inventory` → `promotions` | ✅ hecha |
| Personas | `crm` | pendiente |
| Lectura | `bi` → `realtime` | pendiente |
| Plataforma | `auth`, `tenant`, `saas`, `billing`, `onboarding`, `audit` | pendiente |

#### Ola salón ✅ (2026-11-19) — PR #54

- **Contratos:** `packages/contracts/src/{mesas,reservas,ordenes}.ts` (estados, inputs,
  validadores, etiquetas y helpers de día/hora de Lima) y sus subpath exports.
- **Backend:** `tables/index.ts`, `reservations/index.ts` y `orders/index.ts` públicos;
  `app.module.ts` los consume por el `index`. `orders.service.ts` pasó de
  `../audit/audit.service.js` a `../audit/index.js` (baseline 22 → **21**).
- **Web:** `features/salon/` (`api.ts` SDK+contratos, `hooks.ts` fachada de
  `ModulesProvider`, `MesasPage`, `ReservasPage`, `SalonTablesPage` y el
  `BookingsModule`/`SalonTablesView` movidos) y `features/ordenes/`
  (`api.ts` de solo lectura del tablero, `hooks.ts`, `OrdersBoardPage` y el KDS movido).
  Las rutas `/app/mesas`, `/app/mesas/maestro`, `/app/modulos/reservas/agenda`,
  `/app/ordenes` y `/app/cocina` solo importan su feature; conservan guard,
  cabecera y el redirect por rol del maestro.
- **Hooks compartidos:** `lib/orders-realtime.ts`, `lib/orders-board.ts` (ahora
  recibe el fetcher; por defecto el cliente de la API) y `lib/use-now.ts`, porque
  salón, KDS y mozo los usan y una feature no puede importar `components/erp/*`.
- **Acoplamiento restante (consciente):** el estado de negocio sigue en
  `ModulesProvider` (mesas/cuentas/reservas/comandas) hasta la Fase 4; `mozo` y
  `caja` siguen viviendo en `components/erp/*` y consumen los hooks de `lib/`.
  Backend: `cash → orders` (markPaid) y `orders → inventory/promotions/realtime`
  permanecen en el baseline (no se tocó lógica de negocio).

#### Ola dinero ✅ (2026-11-19)

- **Contratos:** `packages/contracts/src/{caja,comprobantes,gastos}.ts` (turnos,
  movimientos, arqueo, cobro, comprobantes con `desgloseIgv`, gastos y
  categorías, validadores y etiquetas) + subpath exports `./caja`,
  `./comprobantes` y `./gastos`.
- **Backend — puertos:** `ORDERS_PORT`/`OrdersPort` (`markPaid`) lo provee
  `OrdersModule` con `useExisting` y lo exporta; `CASH_PORT`/`CashPort`
  (`egresoDeGasto`) lo provee `CashModule`. `cash` ya no importa
  `orders.service/module` y `expenses` ya no importa `cash.service/module`:
  dependen del `index` público y del token. `receipts/index.ts`,
  `cash/index.ts` y `expenses/index.ts` son la API pública; `app.module` los
  consume por el `index`.
- **Auditoría:** `cash`, `expenses` y `receipts` pasan a `../audit/index.js`.
  Baseline **21 → 14** (7 acoplamientos resueltos, 0 excepciones nuevas).
- **Web:** `HubBlocks`/`ChartCard` se movieron a
  `components/dashboard/workspace-ui.tsx` (capa compartida: una feature no
  puede importar `components/erp/*`). Features `caja` (`CajaPage`,
  `CheckoutModal`, cliente SDK + contratos), `comprobantes`
  (`ComprobantesPage`, `comprobanteARecibo`, SUNAT «pendiente de OSE») y
  `gastos` (`GastosPage`, cliente listo para AYCDS-27). Las rutas `/app/caja`,
  `/app/comprobantes` y `/app/gastos` solo importan su feature y conservan
  cabecera y guard.
- **Acoplamiento restante (consciente):** el estado de negocio sigue en
  `ModulesProvider` hasta la Fase 4; `MozoView` (aún en `components/erp/`)
  importa `CheckoutModal` desde `@/features/caja` hasta la ola de mozo;
  `lib/cash-api.ts` y `lib/receipts-api.ts` quedan como clientes legados (solo
  los usan sus tests) y se retiran en la Fase 4.

#### Ola operación ✅ (2026-11-19)

- **Contratos:** `packages/contracts/src/inventario.ts` (semáforo, kardex,
  filtros, `ConsumoResultado`, etiquetas y `movimientoCantidadLabel`) y
  `packages/contracts/src/promociones.ts` (combos, cupones, cupón resuelto,
  reglas horarias, `estadoCupon` y `etiquetaDescuento`) + subpaths
  `./inventario` y `./promociones`. `caja` e `inventario` comparten el nombre
  `etiquetaTipoMovimiento`: el root conserva el de caja por compatibilidad y el
  inventario se consume por su subpath (export explícito en `src/index.ts`).
- **Backend:** `inventory/index.ts` y `promotions/index.ts` son la API pública;
  `app.module` registra **ambos** módulos (antes `PromotionsModule` solo se
  montaba porque lo importaba órdenes, así que su controller dependía de ese
  import). `orders.module`/`orders.service` consumen los `index.js`.
  `inventory.service`, `stock-alerts.service` y `promotions.service` pasan a
  `../audit/index.js`.
- **`PRICING_PORT` en promociones:** `PromotionsService` inyecta el puerto y
  `PromotionsModule` importa `PricingModule`; el precio de referencia de un
  combo y el bloqueo anti-inflación salen de `resolvePrices`, así que el módulo
  ya no lee `precios_platos` ni `listas_precios`. Sin cambios de reglas.
- **Baseline 14 → 7** (audit de inventory ×2 y promotions ×1; imports de
  órdenes a inventory/promotions ×4). Sin excepciones nuevas.
- **Web:** `features/inventario/` (`InventoryPage` con el maestro demo de
  AYCDS-24, `MovementsPage` con semáforo+kardex de la API, `InventoryHubPage`
  con el workspace, `api.ts` SDK+contratos y su test) y
  `features/promociones/` (`CombosPage`, `PromocionesPage`, `api.ts` SDK para
  combos/cupones/validación/schedule y su test). `ModuleGate` importa el hub
  desde la feature; las rutas de stock, movimientos, combos y promociones solo
  importan su feature. `lib/inventory-api.ts` y su test se retiraron: los cubre
  la feature.
- **Acoplamiento restante (consciente):** el estado de insumos, combos y
  cupones sigue en `ModulesProvider` hasta la Fase 4; las vistas de combos y
  promociones aún no consumen `promocionesApi` (el cliente queda listo). El
  kardex ya lee la API cuando hay sesión.

### Fase 4 — Desmontar el estado global

`ModulesProvider` → contextos de plataforma (`Session`, `Tenant`, `Notifications`); cada feature con su estado.

### Fase 5 — Extracción opcional

`worker` (outbox/cron), `realtime` (sockets), `bi` (lectura). Solo con motivo medible.

---

## 6. Criterios de aceptación por módulo

Un módulo está “independiente” cuando:

- [ ] `pnpm turbo run check-types test --filter=<módulo>` pasa sin construir el resto.
- [ ] `pnpm check:boundaries` no reporta imports nuevos desde/hacia él.
- [ ] Su PR toca solo su carpeta + su ruta + su contrato.
- [ ] No lee tablas de otro módulo (puerto o evento).
- [ ] Tiene README con contrato, endpoints y cómo correrlo.
- [ ] Un cambio suyo no obliga a tocar otro módulo.

---

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| Refactor masivo | Un módulo por PR, con tests de regresión |
| Romper la demo | Smoke del módulo en cada PR |
| Baseline que crece | Prohibido agregar entradas nuevas; se reduce al refactorizar |
| Prisma compartido | Mapa de tablas + revisión; esquemas por módulo a futuro |
| Estado global | Se vacía por olas; primero RRHH |

## 8. Métricas

- Violaciones nuevas de fronteras: **0**.
- Baseline de acoplamientos: **decreciente** (24 al inicio, **22** tras las Fases 1–2, **21** tras la ola salón, **14** tras la ola dinero, **7** tras la ola operación).
- PRs por módulo u ola justificada: **100 %** (excepción `multi-modulo` documentada).
- `--filter` por módulo: verde.
- p95 y bundle sin regresión.
