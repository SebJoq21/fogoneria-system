# pricing — especificación

**Estado:** API real · **Última revisión:** 2026-11-19

## 1. Propósito

Listas de precios por canal y resolución del precio de un plato. Es la **única** fuente de precio: ni el producto ni la orden lo guardan.

## 2. Superficies

| Capa | Dónde vive | Estado |
|---|---|---|
| Backend | `apps/api/src/modules/pricing/` | real |
| Web | `apps/web/features/catalogo/PriceListsView.tsx` | real |
| Contrato | `packages/contracts/src/catalogo.ts` (tipos de lista/precio) | sí |
| Datos | `listas_precios`, `precios_platos` | `20261019000000_init` |

## 3. API

| Método | Ruta | Roles | Qué hace |
|---|---|---|---|
| `GET` | `/pricing/price-lists` | autenticado | Lista listas |
| `POST` | `/pricing/price-lists` | admin/sucursal | Crea |
| `PATCH` | `/pricing/price-lists/:id` | admin/sucursal | Edita |
| `DELETE` | `/pricing/price-lists/:id` | admin/sucursal | Baja |
| `POST` | `/pricing/price-lists/:id/activate` | admin/sucursal | Activa una lista |
| `GET` | `/pricing/price-lists/:id/prices` | autenticado | Precios de la lista |
| `PUT` | `/pricing/price-lists/:id/prices` | admin/sucursal | Upsert masivo de precios |
| `GET` | `/pricing/resolve` | autenticado | Precio resuelto por plato/lista |

Reglas:
- Solo **una lista activa** por empresa; `resolvePrice` usa la indicada o la activa.
- **`PricingPort` (`PRICING_PORT`)**: `OrdersService` y `PromotionsService` piden precios en lote; no leen `precios_platos` ni `listas_precios`.
- El precio es `NUMERIC(12,2)`; la conversión a número se hace en el borde.

## 4. Datos

- `listas_precios`: `nombre`, `activa`, `vigencia_desde`, `vigencia_hasta`, `empresa_id`.
- `precios_platos`: `lista_id`, `plato_id`, `precio` (PK compuesta).
- La lista activa alimenta la comanda y el `precioReferencia` de los combos.

## 5. UI y rutas

- `/app/productos/precios` → `PriceListsView`: crear/activar listas y editar precios con Enter/blur (nunca por tecla).
- El precio se pinta con `priceOf(productId, lists)` de `lib/erp-catalog.ts`.

## 6. Pruebas

| Suite | Archivo |
|---|---|
| Unit | `src/modules/pricing/pricing.service.spec.ts` |
| Web | `features/catalogo/catalogo.test.ts` |

## 7. Deuda conocida

- No hay historial de cambios de precio.
- No hay precios por sucursal: la lista es de empresa.
- Las columnas `vigencia_desde`/`vigencia_hasta` existen en `listas_precios`; la resolución actual usa la lista activa (verificar si la vigencia se aplica al cotizar).

## 8. Trazabilidad

- Jira: AYCDS-60.
- PRs: #2, #50, #52 (`PricingPort`).
- Docs: [decisiones](../../docs/decisiones.md) (precio en PriceList, puerto de precios).

## 9. Próximos pasos

1. Vigencia por fecha si se requiere promoción de precios.
2. Precio por sucursal (hoy el canal se modela con listas).
