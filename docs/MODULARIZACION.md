# Modularización — backend + frontend por módulo

**Fecha:** 2026-11-19 · **Estado:** Fases 0–2 implementadas (fundaciones, RRHH y catálogo/precios).

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
| Baseline de acoplamientos históricos | `scripts/module-boundaries.baseline.json` (24 al inicio) |
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
- **Pendiente para la ola de órdenes:** `PricingPort` público y que `orders` deje de leer `precios_platos`/`PricingService` (hoy está en el baseline histórico).

### Fase 3 — Olas (un PR por módulo, backend + frontend)

| Ola | Módulos |
|---|---|
| Salón | `tables` → `reservations` → `orders` |
| Dinero | `receipts` → `cash` → `expenses` |
| Operación | `inventory` → `promotions` |
| Personas | `crm` |
| Lectura | `bi` → `realtime` |
| Plataforma | `auth`, `tenant`, `saas`, `billing`, `onboarding`, `audit` |

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
- Baseline de acoplamientos: **decreciente** (24 al inicio).
- PRs de un solo módulo: **100 %**.
- `--filter` por módulo: verde.
- p95 y bundle sin regresión.
