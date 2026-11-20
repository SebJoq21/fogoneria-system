# catalog — especificación

**Estado:** API real · **Última revisión:** 2026-11-19

## 1. Propósito

Maestro de carta: categorías, platos, grupos y opciones de modificadores, y su asignación a platos. Los precios **no** viven aquí: viven en `pricing`.

## 2. Superficies

| Capa | Dónde vive | Estado |
|---|---|---|
| Backend | `apps/api/src/modules/catalog/` | real |
| Web | `apps/web/features/catalogo/` (`ProductsView`, `CategoriesView`, `ModifiersView`, `PriceListsView`) | real (lectura/escritura vía provider) |
| Contrato | `packages/contracts/src/catalogo.ts` | sí (solo lectura) |
| Datos | `categorias`, `platos`, `grupos_modificadores`, `opciones_modificadores`, `platos_grupos_modificadores` | `20261019000000_init`, `20261020120200_soft_delete` |

## 3. API

| Método | Ruta | Roles | Qué hace |
|---|---|---|---|
| `GET` | `/catalog/categories` | autenticado | Lista categorías |
| `POST` | `/catalog/categories` | admin/sucursal | Crea |
| `PATCH` | `/catalog/categories/:id` | admin/sucursal | Edita |
| `DELETE` | `/catalog/categories/:id` | admin/sucursal | Baja lógica |
| `GET` | `/catalog/dishes` | autenticado | Lista platos (`limit`, `page`) |
| `GET` | `/catalog/dishes/:id` | autenticado | Detalle |
| `POST` | `/catalog/dishes` | admin/sucursal | Crea plato |
| `PATCH` | `/catalog/dishes/:id` | admin/sucursal | Edita / activa |
| `DELETE` | `/catalog/dishes/:id` | admin/sucursal | Baja lógica |
| `PUT` | `/catalog/dishes/:id/modifier-groups` | admin/sucursal | Asigna grupos |
| `GET` | `/catalog/modifier-groups` | autenticado | Lista grupos y opciones |
| `POST` | `/catalog/modifier-groups` | admin/sucursal | Crea |
| `PATCH` | `/catalog/modifier-groups/:id` | admin/sucursal | Edita con sync por `id` |
| `DELETE` | `/catalog/modifier-groups/:id` | admin/sucursal | Baja |

Reglas:
- Grupos de modificadores se actualizan **por `id`** en transacción: ids repetidos o ajenos → 400; borrar una opción usada en `detalles_orden_modificadores` → 409.
- `platos` y `categorias` tienen `deleted_at`; los únicos son parciales.
- Los ids del catálogo son **UUID** en todo el ERP.

## 4. Datos

- `platos`: `nombre`, `descripcion`, `categoria_id`, `activo`, `deleted_at`.
- `grupos_modificadores` / `opciones_modificadores`: nombre y `precio_extra` (recargo que hoy cobra caja).
- `platos_grupos_modificadores`: puente.
- RLS solo por empresa (catálogo global).

## 5. UI y rutas

- `/app/productos/platos` (+ `/nuevo`) → `ProductsView`.
- `/app/productos/categorias` → `CategoriesView`; `/modificadores` → `ModifiersView`; `/precios` → `PriceListsView`.
- `features/catalogo/api.ts` lee por SDK y pagina platos; las mutaciones siguen en `ModulesProvider` (`lib/catalog-api.ts`).
- La carta virtual del demo vive en `app/demo/[id]` (`CartaVirtualView` en `components/erp/catalog`).

## 6. Pruebas

| Suite | Archivo |
|---|---|
| Unit | `src/modules/catalog/catalog.service.spec.ts` (incluye sync de modificadores) |
| Web | `features/catalogo/catalogo.test.ts` |

## 7. Deuda conocida

- El estado del catálogo sigue en `ModulesProvider` (Fase 4, etapa 3 en curso).
- `lib/catalog-api.ts` convive con `features/catalogo/api.ts`; el primero debe retirarse al cerrar la etapa.
- `CartaVirtualView` sigue en `components/erp/catalog`.

## 8. Trazabilidad

- Jira: AYCDS-60 (API), AYCDS-63 (UI).
- PRs: #2, #50, #52 (pricing).
- Docs: [modelo-datos](../../docs/modelo-datos.md), [decisiones](../../docs/decisiones.md) (UUID, precio fuera del producto).

## 9. Próximos pasos

1. Terminar la etapa 3: estado del catálogo en su feature.
2. Retirar `lib/catalog-api.ts` cuando la feature sea dueña del estado.
