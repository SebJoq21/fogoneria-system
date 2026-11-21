# tables — especificación

**Estado:** API real · **Última revisión:** 2026-11-21

## 1. Propósito

Gestionar el salón: mesas por sucursal, su capacidad, zona y forma, y el bloqueo/liberación manual. Los estados `OCUPADA` y `RESERVADA` **no** se escriben aquí: los derivan órdenes y reservas.

## 2. Superficies

| Capa | Dónde vive | Estado |
|---|---|---|
| Backend | `apps/api/src/modules/tables/` | real |
| Web | `apps/web/features/tables/` (`MesasPage`, `SalonTablesPage`, `SalonTablesView`) | real |
| Contrato | `packages/contracts/src/tables.ts` | sí |
| Datos | `mesas` | `20261019000000_init`, `20261020120200_soft_delete` |

## 3. API

| Método | Ruta | Roles | Qué hace |
|---|---|---|---|
| `GET` | `/api/v1/tables` | autenticado | Lista por sucursal (`estado`, `zona`) |
| `GET` | `/api/v1/tables/:id` | autenticado | Detalle |
| `POST` | `/api/v1/tables` | `ADMIN_GLOBAL`, `GERENTE_SUCURSAL` | Crea mesa |
| `PATCH` | `/api/v1/tables/:id` | admin/sucursal | Edita número, capacidad, zona, forma |
| `PATCH` | `/api/v1/tables/:id/status` | admin/sucursal | Solo `LIBRE` y `MANTENIMIENTO` |
| `DELETE` | `/api/v1/tables/:id` | admin/sucursal | Baja lógica (`deleted_at`) |

Reglas:
- Una mesa con orden abierta o reserva activa **no** se bloquea ni se da de baja → 409.
- `ADMIN_GLOBAL` indica `sucursalId` en body/query; un rol operativo que pida otra sucursal recibe 400. El tenant sigue saliendo del JWT.
- `MANTENIMIENTO` se muestra en la UI como `reservada` + `blocked: true` (no es un cuarto estado de negocio).
- Toda alta/edición/baja emite `table.status` cuando corresponde.

## 4. Datos

- `mesas`: `numero` (único por sucursal), `capacidad`, `zona`, `forma` (`REDONDA|RECTANGULAR`), `estado` (`LIBRE|OCUPADA|RESERVADA|MANTENIMIENTO`), `sucursal_id`, `deleted_at`.
- RLS por empresa/sucursal.

## 5. UI y rutas

- `/app/mesas` → `MesasPage` de `features/tables` (mapa; abre cuenta, registra llegada, bloquea/libera). La vista compartida vive en `components/dashboard/salon/`.
- `/app/mesas/maestro` → `SalonTablesPage` (solo `sucursal`; CRUD y estado derivado).
- `lib/table-mapping.ts` traduce UUID → `Table.id` numérico estable con FNV-1a de 32 bits y resuelve colisiones; `deriveTableStatus` respeta el `OCUPADA` del servidor.
- Refresco por `order.created`, `order.updated` y `table.status`.

## 6. Pruebas

- Cobertura p4 (2026-11-20): ramas de datos, errores 400/404/409, filtros y transiciones con Prisma mockeado; sin cambios de comportamiento.

- Cobertura p3 (2026-11-20): tests de ramas de error de órdenes/SaaS/reservas/mesas y variantes de sesión en caja, comprobantes, clientes e inventario; sin cambios de comportamiento. Se amplió con RTL de páginas y flujos (estados, permisos y acciones).

- Cobertura (2026-11-20): se añadieron tests de controlador, DTO, mapper y ramas de error para subir la cobertura de Sonar; sin cambios de comportamiento.

- Refactor de duplicación (2026-11-20): empresa, sucursal y filtro salen de `TenantScopedService` (`apps/api/src/common/tenant/branch-scope.ts`); reglas, mensajes y scoping no cambian.

| Suite | Archivo |
|---|---|
| Unit | `src/modules/tables/tables.service.spec.ts` |
| e2e | `test/tables.e2e-spec.ts` |
| DB | `test/db/tables-reservas.db-spec.ts` |
| Web | `features/tables/tables.test.ts`, `features/tables/tables-api.test.ts`, `features/tables/SalonTablesView.rtl.test.tsx`, `lib/table-mapping.test.ts` |

## 7. Deuda conocida

- F6c3: `TablesProvider`/`useTables` (`features/tables/provider.tsx`) es dueño de las mesas demo por sucursal (`fogoneria:tables-demo:v1`) y del parche de estado (`patchStatus`). Con sesión la API sigue mandando (`liveTables`).

- Fase 3 de paridad (2026-11-21): `tables` es feature propia y contrato `tables.ts`; la vista compartida del salón sigue en `components/dashboard/salon` hasta el split fino de UI.
- La UI de bloqueo está limitada a `sucursal` (`canChangeTableStatus`); el dueño solo lee.
- No hay plano arrastrable (croquis): el mapa usa zonas y una grilla fija.

## 8. Trazabilidad

- Jira: AYCDS-16 (API), AYCDS-26 (mapa/maestro).
- PRs: #11, #18.
- Docs: [decisiones](../../docs/decisiones.md) (estados derivados, `Table.id`).

## 9. Próximos pasos

1. Editor visual de plano si el negocio lo pide.
2. Añadir e2e de bloqueo con reserva activa.

> **2026-11-20:** `BookingsModule` usa `Number.parseInt` para el número de mesa (`S7773`); sin cambio de contrato.
>
> **2026-11-20:** el test de la agenda fija el reloj en el borde UTC/Lima (`01:20Z` = 20:20 en Lima) para que el filtro por día de Lima no dependa de la hora de ejecución.
