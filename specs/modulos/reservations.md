# reservations — especificación

**Estado:** API real · **Última revisión:** 2026-11-19

## 1. Propósito

Agenda de reservas con aforo y control de solapamiento por mesa. Ocupa y libera la mesa de forma derivada, sin que el usuario tenga que cambiar el estado a mano.

## 2. Superficies

| Capa | Dónde vive | Estado |
|---|---|---|
| Backend | `apps/api/src/modules/reservations/` | real |
| Web | `apps/web/features/salon/ReservasPage.tsx` | real |
| Contrato | `packages/contracts/src/reservas.ts` | sí |
| Datos | `reservas`, `mesas`, `secuencias` | `20261027120000_secuencias_tenant` |

## 3. API

| Método | Ruta | Roles | Qué hace |
|---|---|---|---|
| `GET` | `/api/v1/reservations` | autenticado | Lista por `fecha` (día de Lima) |
| `GET` | `/api/v1/reservations/:id` | autenticado | Detalle |
| `POST` | `/api/v1/reservations` | admin, sucursal, mesero, cajero | Crea reserva |
| `PATCH` | `/api/v1/reservations/:id` | mismos | Edita (solo `POR_CONFIRMAR`) |
| `PATCH` | `/api/v1/reservations/:id/status` | mismos | Confirma, ejecuta, cancela, no-show |

Reglas:
- `nro_comensales > mesas.capacidad` → **409**.
- Misma mesa con otra reserva activa a menos de **90 min** → **409**.
- Edición solo en `POR_CONFIRMAR`; los estados terminales (`EJECUTADA`, `CANCELADA`, `NO_SHOW`) no se reabren.
- Código `RSV-YYYYMMDD-NNNN` por `SequencesService` (tabla `secuencias`).
- Cancelar la última reserva activa libera la mesa.

## 4. Datos

- `reservas`: `codigo`, `mesa_id`, `cliente_nombre`, `telefono`, `fecha_hora`, `nro_comensales`, `estado` (`POR_CONFIRMAR|CONFIRMADA|EJECUTADA|CANCELADA|NO_SHOW`), `notas`.
- Fechas en `TIMESTAMPTZ`; el filtro por día usa `America/Lima` (UTC-05:00 fijo).

## 5. UI y rutas

- `/app/modulos/reservas/agenda` → `ReservasPage`: filtro por fecha, alta/edición, confirmar, cancelar, no-show y «Llegó» (abre cuenta en la mesa real).
- El estado se refresca con `refreshReservations` y eventos de mesa/orden.
- Permiso de gestión: `canManageReservations` (admin/sucursal); mesero/cajero pueden crear vía API.

## 6. Pruebas

- Cobertura p4 (2026-11-20): ramas de datos, errores 400/404/409, filtros y transiciones con Prisma mockeado; sin cambios de comportamiento.

- Cobertura p3 (2026-11-20): tests de ramas de error de órdenes/SaaS/reservas/mesas y variantes de sesión en caja, comprobantes, clientes e inventario; sin cambios de comportamiento. Se amplió con RTL de páginas y flujos (estados, permisos y acciones).

- Cobertura (2026-11-20): se añadieron tests de controlador, DTO, mapper y ramas de error para subir la cobertura de Sonar; sin cambios de comportamiento.

| Suite | Archivo |
|---|---|
| Unit | `src/modules/reservations/reservations.service.spec.ts` |
| e2e | `test/reservations.e2e-spec.ts` |
| DB | `test/db/tables-reservas.db-spec.ts` |
| Web | `lib/reservations-api.test.ts`, `features/salon/salon.test.ts` |

## 7. Deuda conocida

- No hay vista de calendario mensual ni recordatorios (WhatsApp/email).
- El aforo se controla por mesa; no hay aforo global del salón.

## 8. Trazabilidad

- Jira: AYCDS-16 (API), AYCDS-26 (agenda).
- PRs: #11, #18.
- Docs: [decisiones](../../docs/decisiones.md) (ventana de ±90 min, día de Lima).

## 9. Próximos pasos

1. Recordatorios y confirmación por canal externo (fuera del piloto).
2. Validar aforo agregado si se permiten reservas sin mesa.
