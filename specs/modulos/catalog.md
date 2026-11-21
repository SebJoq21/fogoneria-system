# catalog — especificación

**Estado:** API real · catálogo web con `CatalogoProvider` (Fase 4 etapa 3) · **Última revisión:** 2026-11-19

## 1. Propósito

Maestro de carta: categorías, platos, grupos y opciones de modificadores, y su asignación a platos. Los precios **no** viven aquí: viven en `pricing`.

## 2. Superficies

| Capa | Dónde vive | Estado |
|---|---|---|
| Backend | `apps/api/src/modules/catalog/` | real |
| Web | `apps/web/features/catalogo/` (`ProductsView`, `CategoriesView`, `ModifiersView`, `PriceListsView`) | real (lectura/escritura vía provider) |
| Contrato | `packages/contracts/src/catalogo.ts` | sí (tipos, inputs y validadores; el cliente de lectura vive en la feature) |
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
- `features/catalogo/api.ts` lee por SDK y pagina platos. El **estado y las mutaciones** viven en `CatalogoProvider`/`useCatalogoState` (`components/dashboard/providers/catalog.tsx`), que usa `lib/catalog-api.ts` como cliente de escritura; `ModulesProvider` solo los reexpone por compatibilidad. Layout: `Theme > Session > Notifications > Tenant > Catalogo > Modules`.
- La carta virtual del demo vive en `app/demo/[id]` (`CartaVirtualView` en `components/erp/catalog`).

## 6. Pruebas

- Cobertura p4 (2026-11-20): ramas de datos, errores 400/404/409, filtros y transiciones con Prisma mockeado; sin cambios de comportamiento.

- Cobertura p3 (2026-11-20): RTL de las páginas del módulo con provider y APIs mockeados (estados, permisos y acciones); sin cambios de comportamiento.

- Cobertura Fase 1 (2026-11-20): tests de hooks (BI, RRHH, catálogo), DTO de precios y componentes del shell con RTL/jsdom; sin cambios de comportamiento.

- Cobertura (2026-11-20): se añadieron tests de controlador, DTO, mapper y ramas de error para subir la cobertura de Sonar; sin cambios de comportamiento.

| Suite | Archivo |
|---|---|
| Unit | `src/modules/catalog/catalog.service.spec.ts` (incluye sync de modificadores) |
| Web | `features/catalogo/catalogo.test.ts` |

## 7. Deuda conocida

- El **cliente de escritura** sigue en `lib/catalog-api.ts`; moverlo a `features/catalogo/api.ts` para que la feature sea dueña de todo el acceso.
- `CartaVirtualView` sigue en `components/erp/catalog`.
- La poda de combos corre en `ModulesProvider` sobre `catalogVersion` (un render después del snapshot); si se mueve a promociones, ajustar el contrato.

## 8. Trazabilidad

- Jira: AYCDS-60 (API), AYCDS-63 (UI).
- PRs: #2, #50, #52 (pricing), #73 (CatalogoProvider, Fase 4 etapa 3).
- Docs: [modelo-datos](../../docs/modelo-datos.md), [decisiones](../../docs/decisiones.md) (UUID, precio fuera del producto), [MODULARIZACION](../../docs/MODULARIZACION.md) (Fase 4 etapa 3).

## 9. Próximos pasos

1. Mover el cliente de escritura de `lib/catalog-api.ts` a `features/catalogo/api.ts`.
2. Retirar `CartaVirtualView` de `components/erp/catalog` cuando la carta virtual tenga feature.
3. Evaluar mover la poda de combos a promociones.
