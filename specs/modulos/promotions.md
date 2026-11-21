# promotions — especificación

**Estado:** API real; UI demo · **Última revisión:** 2026-11-19

## 1. Propósito

Combos a precio fijo, cupones y reglas horarias. El objetivo es que una promo no infle el precio y que el descuento lo calcule el servidor.

## 2. Superficies

| Capa | Dónde vive | Estado |
|---|---|---|
| Backend | `apps/api/src/modules/promotions/` | real |
| Web | `apps/web/features/promociones/` (`CombosPage`, `PromocionesPage` demo, `api.ts` listo) | Mixto |
| Contrato | `packages/contracts/src/promociones.ts` | sí |
| Datos | `combos`, `combos_platos`, `cupones`, `canjes_cupones`, `reglas_horarias_promos` | `20261019000000_init` |

## 3. API

| Método | Ruta | Roles | Qué hace |
|---|---|---|---|
| `GET` | `/promotions/combos` | autenticado | Lista combos con `precioReferencia`/`ahorro` |
| `POST` | `/promotions/combos` | admin/sucursal | Crea combo |
| `PATCH` | `/promotions/combos/:id` | admin/sucursal | Edita |
| `DELETE` | `/promotions/combos/:id` | admin/sucursal | Baja |
| `GET` | `/promotions/coupons` | autenticado | Lista cupones |
| `POST` | `/promotions/coupons` | admin/sucursal | Crea cupón |
| `PATCH` | `/promotions/coupons/:id` | admin/sucursal | Edita |
| `DELETE` | `/promotions/coupons/:id` | admin/sucursal | Baja |
| `POST` | `/promotions/coupons/:codigo/validate` | autenticado | Valida y calcula **sin consumir** |
| `GET` | `/promotions/schedule` | autenticado | Reglas horarias y si aplican ahora |

Reglas:
- **Anti-inflación**: `precio_fijo` no puede superar la suma de sus platos a la lista activa; `precioReferencia` y `ahorro` salen de `PRICING_PORT`.
- `POST /orders` recibe `cuponCodigo`, **nunca** un importe; el servidor valida, calcula, consume el uso con actualización condicional y registra `canjes_cupones`.
- Cupón: código único por empresa, porcentaje ≤100, límite de usos y vigencia.
- `GET /promotions/schedule` es **informativo**: aplicar el beneficio al cobro requiere tipificar la regla en el modelo.

## 4. Datos

- `combos` (`precio_fijo`, `activo`), `combos_platos` (`cantidad`).
- `cupones` (`codigo`, `tipo` `PORCENTAJE|MONTO`, `valor`, `usos_maximos`, `usos_actuales`, `vigente_desde/hasta`).
- `canjes_cupones`: consumo por orden (inmutable).
- `reglas_horarias_promos`: día/hora de Lima, ventanas que cruzan medianoche.

## 5. UI y rutas

- `/app/combos` → `CombosPage`; `/app/promociones` → `PromocionesPage`. Ambas siguen con estado demo.
- `features/promociones/api.ts` (`promocionesApi`) cubre combos, cupones, validación y schedule.
- El descuento siempre lo calcula la API; la UI solo muestra.

## 6. Pruebas

- Cobertura p4 (2026-11-20): ramas de datos, errores 400/404/409, filtros y transiciones con Prisma mockeado; sin cambios de comportamiento.

- Cobertura p3 (2026-11-20): RTL de las páginas del módulo con provider y APIs mockeados (estados, permisos y acciones); sin cambios de comportamiento.

- Cobertura p2 (2026-11-20): tests de ramas de error y servicios (Prisma/tenant extension, promociones, precios, caja, RRHH, CRM) y SSR de providers/páginas; sin cambios de comportamiento.

- Cobertura (2026-11-20): se añadieron tests de controlador, DTO, mapper y ramas de error para subir la cobertura de Sonar; sin cambios de comportamiento.

| Suite | Archivo |
|---|---|
| Unit | `promotions.service.spec.ts`, `promotions.rules.spec.ts` |
| e2e | `test/promotions.e2e-spec.ts` |
| Web | `features/promociones/promociones.test.ts` |

## 7. Deuda conocida

- `CombosPage`/`PromocionesPage` no consumen `/promotions` (observación 3 del plan; AYCDS-27).
- Las reglas horarias no se aplican al cobro (solo se informan).
- No hay promo automática por carrito ni acumulación de cupones.

## 8. Trazabilidad

- Jira: AYCDS-19 (API), AYCDS-27 (UI, pendiente).
- PR: #29.
- Docs: [decisiones](../../docs/decisiones.md) (descuento del servidor, anti-inflación).

## 9. Próximos pasos

1. Conectar las dos vistas a `promocionesApi` (AYCDS-27).
2. Tipificar el beneficio de las reglas horarias si se quiere aplicar solo.
