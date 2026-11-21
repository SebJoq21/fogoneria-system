# Plan F6c — POS: cuentas, caja, comprobantes y promociones

Estado: **F6c1 implementado en este PR** (piloto `AccountsProvider`). F6c2 queda diseñado, sin implementar.
Base: `origin/development` en `7633c3d` (#134 mergeado, F6b cerrado).

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

### 3.2 `CashProvider` — `features/cash/provider.tsx` (F6c2)

**Posee:** `cashShifts: CashShift[]` y `cashMovements` por sucursal (hoy `scopes[id].cash`).

**Expone:**

```ts
{
  cashShifts, movementsOf(branchId), activeShift(branchId),
  startShift(fund), closeShift(counted, observations),
  addMovements(branchId, movements), reverseMovements(branchId, movements),
  setCashShifts, resetCash
}
```

- `activeShift(branchId)` reemplaza el memo `openCashShift` (una sola caja abierta por sucursal).
- `addMovements`/`reverseMovements` son las dos únicas puertas de escritura: el cobro y la anulación dejan de tocar `scopes` a mano.
- Persistencia: `fogoneria:cash:v1:<tenant>` con `{ shifts, movementsByBranch }`; el loader migra `cashShifts` + `scopes[*].cash` (los scopes quedan sin `cash`).
- `scopes` se queda con `orders`/`tables` hasta F6c3.

### 3.3 `ReceiptsProvider` — `features/receipts/provider.tsx` (F6c2)

**Posee:** `receipts: Receipt[]` y `sunatContingencia: boolean` (el ciclo SUNAT es del documento, no de caja).

**Expone:** `receipts`, `emitReceipt(receipt)`, `patchReceipt(id, patch)`, `annulReceipt(id, motivo, reverse)`, `sunatContingencia`, `toggleSunatContingencia`, `resetReceipts`.

La anulación **no** revierte caja por sí sola: recibe `reverse` (movimientos ya calculados) o llama a `useCash()` (es ancestro: cash 12 < receipts 13) para insertarlos. La numeración (`nextReceiptNumber`) y el desglose IGV siguen en `lib/domain.ts`; el provider no calcula reglas.

Persistencia `fogoneria:receipts:v1:<tenant>`; migra `receipts` + `sunatContingencia`.

### 3.4 `PromotionsProvider` — `features/promotions/provider.tsx` (F6c2)

**Posee:** `combos` y `coupons` demo (la API manda con sesión vía `promocionesApi`).

**Expone:** `combos`, `setCombos`, `coupons`, `setCoupons`, `consumeCoupon(code)`, `resetPromotions`.

- `consumeCoupon` concentra el incremento de `used` que hoy hace el checkout; el cálculo del descuento (`parseCouponDiscount`) se queda en `lib/domain.ts` y el importe lo sigue resolviendo el servidor cuando hay sesión.
- La poda de combos huérfanos tras refrescar catálogo (hoy en `ModulesProvider`) se mueve aquí; depende de `useCatalogoState()` (catálogo 6 < promotions 16, es ancestro).
- Persistencia `fogoneria:promotions:v1:<tenant>`; migra `combos` + `coupons`.

### 3.5 `CheckoutCoordinator` — capa compartida, **no** feature

Ubicación propuesta:

- `apps/web/lib/checkout.ts`: función pura `runCheckout(input, ports)` con los puertos inyectados (testeable sin React).
- `apps/web/components/dashboard/providers/checkout.tsx`: hook `useCheckout()` que arma los puertos con `useAccounts`/`useCash`/`useReceipts`/`usePromotions`/`useCrm`/`useCatalogoState` y expone `checkoutAccount(input)`.
- `ModulesProvider` reexporta `checkoutAccount` (compatibilidad con `useModules()`).

**Por qué no es un provider:** necesita ver **todos** los contextos (incluido CRM, que está después de caja/comprobantes) y no posee estado propio; montarlo como provider lo obligaría a estar al final del registry y a mezclar orquestación con estado.

**Orden de operaciones (se preserva el actual):**

1. Validar cuenta `abierta`; si no, `null` sin efectos.
2. Calcular `accountTotals`, cupón y total; `splitIgv`.
3. Generar el comprobante (`nextReceiptNumber`, estado `en_cola`).
4. **Efectos de estado en un solo lote:** `accounts` (cobrada + pagos + propina + descuento), `receipts` (nuevo), `promotions` (cupón consumido), `cash` (ingresos con `shiftId` del turno abierto), `tables` (liberar mesa si `tableId`).
5. Post-efectos: `enviarSunat(receipt)` (nunca bloquea la venta), `addPoints(customerId, floor(total))`, `closeAccountOrders(account, "PAGADA")` (API), `refreshOrders`.

**Idempotencia (nueva, defensa del coordinador):**

- Guard `checkingOut` por `accountId` (Set en un `useRef`) para ignorar el doble clic mientras corre el cobro.
- Invariante: **una cuenta `cobrada` no se vuelve a cobrar** (ya la garantiza `status === "abierta"`); el coordinador además rechaza si ya existe un comprobante `Pagada` con `accountId` (protege tras un fallo parcial).
- La anulación es idempotente por estado (`status === "Anulada"` → no-op), como hoy.

**Errores:**

- Los setters de estado del demo no lanzan (localStorage best-effort), así que el lote no deja estados a medias en la práctica; el coordinador igual aplica el orden "dinero antes que comanda" y documenta que un fallo de API en `closeAccountOrders` **no** revierte el cobro (hoy tampoco lo hace: la comanda queda abierta y se cierra al reintentar/entregar).
- `throw` de `sendToKitchen` no cambia: la UI muestra el error y la cuenta sigue abierta.

### 3.6 `scopes` (F6c3, fuera de este plan)

Para mover `openAccount`/`sendToKitchen`/`advanceOrder` completos hace falta dueño de `scopes.orders` y `scopes.tables`:

- `scopes.orders` → `OrdersProvider` (o `AccountsProvider`, mismo feature) con persistencia `fogoneria:orders-demo:v1`.
- `scopes.tables` → feature `tables` (hoy es estado derivado + parches de estado; con sesión la API manda). Antes hay que decidir si el parche `ocupada`/`libre` sigue: `deriveTableStatus` ya deriva `ocupada` de las cuentas abiertas, así que probablemente se elimine en vez de migrarse.
- Con eso, `ModulesProvider` se queda solo con `tickets`, `payments` y la composición.

## 4. Migración y purga (contrato común)

| Slice | Clave nueva | Campo legacy | Estrategia |
|---|---|---|---|
| `accounts` | `fogoneria:orders:v1:<tenant>` | `accounts` | merge por `id`; remapeo slug→UUID en el efecto de sucursales |
| `cashShifts` + `scopes.cash` | `fogoneria:cash:v1:<tenant>` | `cashShifts`, `scopes[*].cash` | merge por `id`; `scopes` se guarda sin `cash` |
| `receipts` + `sunatContingencia` | `fogoneria:receipts:v1:<tenant>` | `receipts`, `sunatContingencia` | merge por `id` (los recibos no se reescriben entre tenants) |
| `combos` + `coupons` | `fogoneria:promotions:v1:<tenant>` | `combos`, `coupons` | merge por `id`/`code`; poda de combos al refrescar catálogo |

Reglas:

1. La purga ocurre en el **loader de `ModulesProvider`**, antes de su primer `saveErpState` (evita la carrera padre→hijo que se corrigió en #133).
2. Los providers leen su clave; si no existe, el loader la crea desde el legacy. El fallback de solo lectura (`readLegacyErpField`) queda para montajes aislados en tests.
3. Sin sesión (`anon`) y tenant demo conservan datos demo; un tenant nuevo arranca vacío.
4. `resetDemoData` llama a todos los `reset*`.

## 5. Tests

- **Unit (puros):** `runCheckout` con puertos falsos (orden de llamadas, cupón, propina, idempotencia, cuenta no abierta, doble cobro).
- **Provider:** hidratación demo/legacy, persistencia por tenant, sync sin eco, reset y guardia de cambio de tenant (patrón F6b).
- **Integración:** `module-migration.integration.test.tsx` siembra un `ErpState` legacy con todos los slices y verifica las claves nuevas, la purga y que remontar no duplica. Incluye el remapeo slug→UUID de `accounts` en los dos órdenes posibles: sucursales disponibles **al montar** y sucursales que **llegan después**; en ambos casos comprueba `branchId`/`tableId` y que una segunda pasada no duplica ni pierde cuentas.
- **Regresión:** `ModulesProvider.actions.test.tsx` sigue cubriendo el flujo completo (abrir → items → enviar → cobrar → anular → caja) montando los providers reales.

### L1 (fallo entre `accounts` y `receipts`/`cash`) — diferido a F6c2

El test de fallo parcial durante `checkoutAccount` **no es viable en F6c1**:

1. No hay punto de inyección. `setAccounts` (provider) y `setState` (receipts/cash/cupones/mesa) se ejecutan en el mismo handler y React los agrupa; los updaters son puros (map/patch) y no hay un puerto que se pueda hacer fallar entre ambos sin mockear internals de React.
2. Forzar el fallo con un mock del provider de cuentas mediría el mock, no la garantía: la atomicidad real no existe entre providers (no hay transacción), y lo que hoy evita el estado a medias es el batching, no un contrato.
3. La garantía correcta es de F6c2: `runCheckout` calcula todo, valida idempotencia (cuenta `abierta`, sin comprobante `Pagada` previo) y aplica el lote en un orden fijo. Ahí sí se puede testear con puertos falsos: un puerto que lanza deja `accounts`/`receipts`/`cash` sin cambios y no se duplica al reintentar.

Mientras tanto, la consistencia del camino feliz está cubierta: `ModulesProvider.actions.test.tsx` verifica que tras el cobro hay comprobante `Pagada`, cuenta `cobrada` y movimiento de caja en el turno.


## 6. Criterios para retirar `ModulesProvider`

- [ ] `accounts`, `cashShifts`/`cash`, `receipts`, `combos`/`coupons` y `scopes` tienen provider dueño.
- [ ] El checkout vive en `useCheckout` y `ModulesProvider` solo lo reexporta.
- [ ] `ErpState` queda en `tickets` + `payments` (o también migrados).
- [ ] `fogoneria:erp:v2:<tenant>` no recibe escrituras de negocio (solo datos de shell si quedan).
- [ ] `checkoutAccount` conserva orden, idempotencia y errores con tests de regresión.
- [ ] `check:boundaries` sigue en 0 y ninguna feature importa otra.

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

**F6c1 (este PR).** `AccountsProvider` con estado + persistencia/sync + migración/purga + remapeo; acciones y checkout siguen en `ModulesProvider` consumiendo el provider. Sin cambios de reglas ni de API.

**F6c2.** `CashProvider` + `ReceiptsProvider` + `PromotionsProvider` + `CheckoutCoordinator`; `scopes` se reduce a `orders`/`tables`. Tests del coordinador y de regresión del cobro.

**F6c3 (fuera de F6c).** Dueño de `scopes.orders` y `scopes.tables`; retiro de `ModulesProvider` según el checklist de §6.

## 9. Decisiones

1. El coordinador **no** es provider: necesita contextos posteriores en el registry y no posee estado.
2. Los providers nuevos no calculan reglas: reciben movimientos/importes ya calculados por `lib/domain.ts` y el coordinador.
3. La idempotencia del cobro se resuelve en el coordinador, no en cada provider.
4. `scopes` no se migra como bloque: se vacía por slice cuando cada dueño exista.
