# Plan F6c — POS: cuentas, caja, comprobantes y promociones

Estado: **F6c1, F6c2 y F6c3 implementados**. `ModulesProvider` queda como fachada sin estado propio (ver §10); su retiro físico está bloqueado por las ~20 vistas que usan `useModules()`.
Base: `origin/development` en `47301f7` (#136 mergeado, F6c2 cerrado).

## 1. Punto de partida

Lo que sigue en `ModulesProvider` y por qué no se movió en F6b:

| Slice | Dueño actual | Acoplamiento real |
|---|---|---|
| `accounts` | `ModulesProvider` | `openAccount`/`annulAccount` escriben también `scopes.tables`; `localSendToKitchen` escribe `scopes.orders`; `checkoutAccount` escribe `receipts` + `coupons` + `scopes.cash` y llama `addPoints` |
| `cashShifts` + `scopes.cash` | `ModulesProvider` | el cobro inserta movimientos en el turno abierto; la anulación de comprobante inserta el egreso contrario |
| `receipts` + `sunatContingencia` | `ModulesProvider` | se emiten dentro del cobro (mismo `setState`) y la anulación revierte caja |
| `combos` + `coupons` | `ModulesProvider` | el cupón se consume dentro del cobro; el combo se resuelve al armar la cuenta |
| `orders`/`scopes` | `ModulesProvider` | demo local + `liveOrders` de la API; las cuentas guardan `orderApiIds` |

El nudo es `scopes` (`BranchScope = { orders, tables, cash }`): es un hub por sucursal que tres módulos escriben. `checkoutAccount` hace **una sola** actualización de estado con cinco slices; separarlo sin diseño deja el cobro a medias si un setter falla o si el orden cambia.

## 2. Restricciones del patrón vigente

1. `FeatureProviders` es **generado** (`pnpm gen:modules`) y monta `<Provider>{children}</Provider>` **sin props**: un provider no puede recibir callbacks de `ModulesProvider`.
2. El orden del registry es el de `modules/catalog.json`: `orders` (10) → `cash` (12) → `receipts` (13) → `promotions` (16) → `crm` (17). Un provider **solo puede consumir contextos de providers anteriores** (ancestros).
3. Por (1) y (2), la orquestación entre módulos que no son ancestros (p. ej. caja → CRM) no puede vivir en un provider: vive en una **capa compartida por debajo de todos** (`ModulesProvider`), que sí ve todos los contextos.
4. La sesión/BFF sigue siendo la autoridad: con sesión, cuentas/caja/comprobantes operan contra la API; sin sesión se mantiene el demo local. Los providers nuevos solo cambian **quién posee el estado demo**, no las reglas.

## 3. Diseño por módulo

### 3.1 `AccountsProvider` — `features/orders/provider.tsx` (F6c1, implementado)

**Posee:** `TableAccount[]` (cuentas, items, pagos, propina, descuento, `orderApiIds`).

**Expone:**

```ts
{ accounts, setAccounts: Dispatch<SetStateAction<TableAccount[]>>, resetAccounts }
```

`setAccounts` se expone como dispatch para que las acciones que hoy viven en `ModulesProvider` (`openAccount`, `addAccountItems`, `updateAccountItem`, `removeAccountItem`, `sendToKitchen`, `annulAccount`, `checkoutAccount`) sigan funcionando con actualizaciones funcionales sin leer estado obsoleto en callbacks async.

**Persistencia/sync:** `fogoneria:orders:v1:<tenant>` + `BroadcastChannel fogoneria:orders-sync:<tenant>` (`lib/module-store.ts`, mismo contrato que F6b).

**Migración:** `accounts` sale del `ErpState` v2 y se purga en el loader de `ModulesProvider` antes del primer guardado (`migrateLegacyArray`, merge por `id`). El remapeo slug→UUID del seed que hacía `prepareOps` pasa a un **efecto propio e idempotente** que depende de `accounts`, `realBranches` y la sucursal activa: remapea tanto si las sucursales ya están al montar (cuentas hidratadas después por el provider) como si llegan más tarde, y devuelve el mismo array cuando no hay nada que cambiar. La condición de sesión (`hasSession`, sin `tenantLoading`/`tenantError`, con `empresaId` y al menos una sucursal real) se mantiene para no tocar el demo.

**Qué NO se mueve todavía (y por qué):**

- `openAccount`/`annulAccount` siguen en `ModulesProvider`: escriben `scopes.tables` (`patchTableStatus`), que pertenece a otro hub.
- `sendToKitchen`/`createOrderFromAccount`: escriben `scopes.orders` y llaman a la API + `refreshOrders`.
- `checkoutAccount`: es el coordinador de facto (ver 3.5).

El piloto demuestra lo importante: persistencia, sync, migración/purga y que el checkout sigue funcionando leyendo el provider. Las acciones se moverán cuando `scopes` tenga dueño (3.6).

### 3.2 `CashProvider` — `features/cash/provider.tsx` (F6c2, implementado)

**Posee:** `cashShifts: CashShift[]` y los movimientos por sucursal (antes `scopes[id].cash`).

**Expone:** `cashShifts`, `movementsByBranch`, `movementsOf(branchId)`, `allMovements(branchIds)`, `activeShift(branchId)`, `startShift`, `closeShift`, `addMovements`, `reverseMovements`, `setMovements`/`setMovementsByBranch`/`setShifts` (fachada), `remapBranches`, `resetCash`.

- `activeShift(branchId)` reemplaza el memo `openCashShift` (una sola caja abierta por sucursal) y `closeShift` calcula el arqueo con `expectedCashFor`.
- El cobro entra por `addMovements`; la anulación de comprobante, por `reverseMovements`. `ModulesProvider` conserva `setCashMovements` como fachada con la misma distribución por sucursal que `applyWrite` (vista `todas`).
- Persistencia: `fogoneria:cash:v1:<tenant>` con `{ shifts, movementsByBranch }`.
- **Remapeo slug→UUID:** `remapBranches(map)` es idempotente (turnos y claves de movimientos) y `ModulesProvider` lo invoca en un efecto que depende de los turnos, los movimientos y `realBranches`, con la misma guardia que las cuentas (funciona si las sucursales llegan antes o después del montaje).

### 3.3 `ReceiptsProvider` — `features/receipts/provider.tsx` (F6c2, implementado)

**Posee:** `receipts: Receipt[]` y `sunatContingencia: boolean` (el ciclo SUNAT es del documento, no de caja).

**Expone:** `receipts`, `sunatContingencia`, `addReceipt`, `setReceipts`, `patchReceipt`, `removeReceipt`, `enviarSunat`, `generarResumenDiario`, `toggleSunatContingencia`, `resetReceipts`.

- `enviarSunat` y `generarResumenDiario` viven aquí (solo tocan comprobantes); el puerto de facturación y `cpeFromReceipt` no cambian.
- La **anulación** la orquesta `ModulesProvider` (necesita cuentas para los métodos de pago y caja para el egreso): calcula la NC/baja y llama `patchReceipt` + `addReceipt` + `cash.reverseMovements` + `enviarSunat`. El provider no importa caja (una feature no importa otra); recibe las escrituras ya resueltas.
- Persistencia `fogoneria:receipts:v1:<tenant>`; migra `receipts` + `sunatContingencia`.

### 3.4 `PromotionsProvider` — `features/promotions/provider.tsx` (F6c2, implementado)

**Posee:** `combos` y `coupons` demo (la API manda con sesión vía `promocionesApi`).

**Expone:** `combos`, `setCombos`, `coupons`, `setCoupons`, `consumeCoupon(code)`, `restoreCoupon(code)`, `resetPromotions`.

- `consumeCoupon` concentra el incremento de `used` y `restoreCoupon` lo revierte en la compensación del coordinador; el cálculo del descuento (`parseCouponDiscount`) se queda en `lib/domain.ts` y el importe lo sigue resolviendo el servidor cuando hay sesión.
- **La poda de combos se queda en `ModulesProvider`**, no aquí: `CatalogoProvider` se monta **debajo** de `FeatureProviders` (el orden del registry no aplica), así que ningún provider de feature ve el catálogo. El efecto de poda usa el `setCombos` del provider.
- Persistencia `fogoneria:promotions:v1:<tenant>`; migra `combos` + `coupons` (merge por `id`/`code`).

### 3.5 `CheckoutCoordinator` — capa compartida, **no** feature (F6c2, implementado)

- `apps/web/lib/checkout.ts`: `runCheckout(input, context, writes, hooks)` puro, sin React.
- `apps/web/components/dashboard/providers/checkout.tsx`: `useCheckout({ onCommitted, onPostCommitFailed, retryDelayMs })` arma los puertos con `useAccounts`/`useCash`/`useReceipts`/`usePromotions`/`useCrm` y expone `checkoutAccount`. `ModulesProvider` lo reexporta como `useModules().checkoutAccount`.

**Orden aplicado:** validar → cuenta → caja → comprobante → cupón → puntos (CRM). La liberación de mesa, `enviarSunat` y `closeAccountOrders` van en `onCommitted` (post-commit, no se compensan): el coordinador acepta handlers síncronos o promesas, reintenta hasta 3 veces con backoff exponencial y avisa con `onPostCommitFailed` al agotar. El post-commit es idempotente en lo que importa: `patchStatus` se repite sin efecto y `enviarSunat` se ejecuta una sola vez por comprobante (guard en `ModulesProvider`).

**Idempotencia:**

- Si existe un comprobante `Pagada` con `accountId`, devuelve ese mismo sin escribir (protege reintentos y estados a medias).
- `useCheckout` mantiene un mapa síncrono de comprobantes por cuenta y espejos de cuentas/comprobantes/cupones actualizados en efectos y handlers: dos clics en el mismo frame cobran una sola vez.
- Una cuenta que no está `abierta` devuelve `null` sin efectos.

**Compensación:** cada paso apila su reverso (`restoreAccount`, `removeCashMovements`, `removeReceipt`, `restoreCoupon`) y, si un paso lanza, se deshacen en orden inverso antes de relanzar. Los puntos se aplican al final (`addPoints` no lanza en el demo) y `afterCommit` corre fuera del `try`: un fallo de SUNAT o de la API no revierte una venta ya cobrada.

### 3.6 `scopes`, reservas y tickets (F6c3, implementado)

- `scopes.orders` → `features/orders/provider.tsx` (segundo store del módulo, `fogoneria:orders-demo:v1:<tenant>`); `useOrdersDemo` expone `ordersByBranch`, `setOrdersForBranches` (vista activa/agregada con `lib/branch-scope.ts`), `setBranchOrders`, `ensureDemoOrders` y `resetOrdersDemo`.
- `scopes.tables` → `features/tables/provider.tsx` (`fogoneria:tables-demo:v1:<tenant>`); `patchStatus` replica el parche slug/UUID que hacía `ModulesProvider`.
- `reservations` → `features/reservations/provider.tsx` (`fogoneria:reservations:v1:<tenant>`). La API sigue mandando con sesión (`liveReservations` en `ModulesProvider`).
- `tickets` → `components/dashboard/providers/tickets.tsx` (capa compartida, `fogoneria:tickets:v1:<tenant>`): no hay módulo backend de soporte. Se monta en `app/layout.tsx`.
- El loader de `ModulesProvider` migra los cuatro slices, borra `fogoneria:erp:v2:<tenant>` y deja de escribir estado propio. `ErpState` queda solo como tipo legacy de lectura.
- El provider de órdenes compone dos stores (cuentas + comandas demo) porque `module.ts` declara un único provider por feature.
- **Remapeo slug→UUID de scopes (H2):** `useOrdersDemo.remapBranches` y `TablesProvider.remapBranches` mueven las **claves** (no hay `branchId` interno en `Order`/`Table`) y fusionan por `id` si la clave destino ya existe. `ModulesProvider` los invoca en efectos que dependen de los datos y de `realBranches`, igual que cuentas y caja: funcionan si las sucursales están al montar o llegan después, y son idempotentes.

## 4. Migración y purga (contrato común)

| Slice | Clave nueva | Campo legacy | Estrategia |
|---|---|---|---|
| `accounts` | `fogoneria:orders:v1:<tenant>` | `accounts` | merge por `id`; remapeo slug→UUID en el efecto de sucursales |
| `cashShifts` + `scopes.cash` | `fogoneria:cash:v1:<tenant>` | `cashShifts`, `scopes[*].cash` | merge por `id`; `scopes` se guarda sin `cash` |
| `receipts` + `sunatContingencia` | `fogoneria:receipts:v1:<tenant>` | `receipts`, `sunatContingencia` | merge por `id` (los recibos no se reescriben entre tenants) |
| `combos` + `coupons` | `fogoneria:promotions:v1:<tenant>` | `combos`, `coupons` | merge por `id`/`code`; poda de combos al refrescar catálogo |
| `scopes.orders` | `fogoneria:orders-demo:v1:<tenant>` | `scopes[*].orders` | merge por `id` por sucursal |
| `scopes.tables` | `fogoneria:tables-demo:v1:<tenant>` | `scopes[*].tables` | merge por `id` por sucursal |
| `reservations` | `fogoneria:reservations:v1:<tenant>` | `reservations` | merge por `id` |
| `tickets` | `fogoneria:tickets:v1:<tenant>` | `tickets` | merge por `id` |

F6c3: el loader migra **todo** y después borra `fogoneria:erp:v2:<tenant>`; ya no se guarda un estado vacío. Los providers tienen su propio `BroadcastChannel`, así que el canal `fogoneria:erp-sync` desaparece.

Reglas:

1. La purga ocurre en el **loader de `ModulesProvider`**, antes de su primer `saveErpState` (evita la carrera padre→hijo que se corrigió en #133).
2. Los providers leen su clave; si no existe, el loader la crea desde el legacy. El fallback de solo lectura (`readLegacyErpField`) queda para montajes aislados en tests.
3. Sin sesión (`anon`) y tenant demo conservan datos demo; un tenant nuevo arranca vacío.
4. `resetDemoData` llama a todos los `reset*`.

## 5. Tests

- **Unit (puros):** `lib/checkout.test.ts` (9): orden de escrituras, comprobante/IGV, propina, cupón, puntos, idempotencia, cuenta no abierta, compensación en cada fallo (incluido el reverso de puntos) y post-efecto que no revierte.
- **Hook del coordinador:** `components/dashboard/providers/checkout.test.tsx` (6): doble clic (M1), reintento del post-commit síncrono, rechazo asíncrono con backoff y aviso al agotar (M2), y limpieza de la idempotencia al resetear/cambiar de empresa (L2).
- **Providers:** `features/{orders,tables,reservations,cash,receipts,promotions}/provider.test.tsx` y `components/dashboard/providers/tickets.test.tsx`: hidratación demo, persistencia por tenant, sync y cambio de tenant, remapeo slug→UUID de las claves de comandas/mesas, turnos/arqueo, SUNAT, cupones y escritura por sucursal.
- **Helpers:** `lib/branch-scope.test.ts` (vista activa/agregada) y `lib/module-store.test.ts` (migración de caja, comprobantes, promociones, scopes, reservas y tickets).
- **Integración:** `module-migration.integration.test.tsx` siembra el `ErpState` legacy completo, verifica todas las claves nuevas, el borrado del `ErpState` y que remontar no duplica; cubre el remapeo slug→UUID de cuentas, caja, comandas y mesas con sucursales al montar y después (H2/L1).
- **Regresión:** `ModulesProvider.actions.test.tsx` (11) sigue cubriendo abrir → items → enviar → cobrar con cupón → anular → caja → SUNAT montando todos los providers reales.


## 6. Criterios para retirar `ModulesProvider`

- [x] `accounts`, `cashShifts`/`cash`, `receipts`, `combos`/`coupons`, `scopes` (orders/tables), `reservations` y `tickets` tienen provider dueño.
- [x] El checkout vive en `useCheckout` y `ModulesProvider` solo lo reexporta.
- [x] `ErpState` ya no se escribe: el loader migra y borra la clave legacy.
- [x] `fogoneria:erp:v2:<tenant>` no recibe escrituras de negocio.
- [x] `checkoutAccount` conserva orden, idempotencia y errores con tests de regresión y de compensación.
- [x] `check:boundaries` sigue en 0 y ninguna feature importa otra.
- [ ] `ModulesProvider` eliminado del layout (bloqueado: ~20 vistas usan `useModules()`; ver §10).

## 7. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Perder atomicidad del cobro (5 slices en un `setState`) | Cobro sin caja o sin comprobante | Coordinador con orden fijo + guard de idempotencia + test de regresión del flujo completo |
| `scopes` compartido entre cuentas/caja/órdenes | Escrituras cruzadas y pérdida de datos | F6c2 introduce `addMovements`/`reverseMovements`; F6c3 separa `orders`/`tables` |
| Remapeo slug→UUID al mover `accounts` | Cuentas invisibles en la sucursal | Efecto idempotente por `accounts`+`realBranches`+sucursal activa; tests de integración con sucursales al montar y después |
| Doble cobro por doble clic | Dos comprobantes y dos ingresos | Guard `checkingOut` + comprobante único por cuenta |
| Providers nuevos sin cobertura | Sonar `new_coverage` < 80 | Tests de provider y del coordinador en el mismo PR |
| Cambio de comportamiento del demo | Regresión visible | `ModulesProvider.actions.test.tsx` intacto salvo el wrapper |

## 8. Fases

**F6c1 (mergeado en #135).** `AccountsProvider` con estado + persistencia/sync + migración/purga + remapeo; acciones y checkout siguen en `ModulesProvider` consumiendo el provider.

**F6c2 (mergeado en #136).** `CashProvider` + `ReceiptsProvider` + `PromotionsProvider` + `CheckoutCoordinator`; `scopes` se reduce a `orders`/`tables` y `ErpState` pierde caja, comprobantes y promociones.

**F6c3 (este PR).** Fixes M1/M2/L1/L2, `scopes.orders`/`scopes.tables`/`reservations`/`tickets` con provider, `ErpState` vaciado y borrado. `ModulesProvider` queda como fachada; su retiro físico es el único pendiente (§10).

## 10. Retiro de `ModulesProvider` (bloqueado)

`ModulesProvider` ya **no posee estado de negocio**: solo conserva el estado derivado de la API (`liveOrders`, `liveTables`, `liveReservations` y sus errores/loading) y la orquestación (abrir/enviar/anular/cobrar, `branchOf`, `resetDemoData`). El `ErpState` se migra y se borra; no hay `save` propio.

Para eliminarlo del layout hay que sustituir `useModules()` en ~20 vistas y rutas. Propuesta:

1. `useCheckout` ya cubre el cobro; exponer `useBranchScope()` (sucursal activa + `branchOf`) y `useOrdersLive()`/`useTablesLive()`/`useReservationsLive()` en la capa compartida.
2. Migrar las vistas módulo a módulo (mesas, reservas, mozo/KDS, caja, comprobantes, gastos, inventario, promociones, CRM, RRHH, BI, configuración).
3. Cuando no queden consumidores, borrar `ModulesProvider`, `lib/persistence.ts` y la entrada de `app/layout.tsx`; los tests de integración pasan a montar solo `FeatureProviders` + `CatalogoProvider` + `TicketsProvider`.

No se hace en este PR para no tocar >20 vistas en el mismo cambio que mueve scopes/reservas/tickets (riesgo de regresión y revisión).

## 9. Decisiones

1. El coordinador **no** es provider: necesita contextos posteriores en el registry y no posee estado.
2. Los providers nuevos no calculan reglas: reciben movimientos/importes ya calculados por `lib/domain.ts` y el coordinador.
3. La idempotencia del cobro se resuelve en el coordinador, no en cada provider.
4. `scopes` no se migra como bloque: se vacía por slice cuando cada dueño exista.
