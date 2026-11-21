# staff — especificación

**Estado:** Mixto (asistencia/turnos reales; directorio/roles/propinas demo) · **Última revisión:** 2026-11-19

## 1. Propósito

Personal del restaurante: plan de turnos, marcación de asistencia y reparto del pozo de propinas del día. La propina se **suma de lo cobrado**, no se escribe a mano.

## 2. Superficies

| Capa | Dónde vive | Estado |
|---|---|---|
| Backend | `apps/api/src/modules/staff/` | real |
| Web | `apps/web/features/rrhh/` (`AttendancePage`, `ShiftsPage`) | real |
| Contrato | `packages/contracts/src/rrhh.ts` | sí |
| Datos | `empleados`, `roles_empresa`, `turnos_plan`, `asistencias`, `pozos_propinas`, `repartos_propinas`, `ordenes.propina` | `20261019000000_init` |

## 3. API

| Método | Ruta | Roles | Qué hace |
|---|---|---|---|
| `GET` | `/staff/employees` | autenticado | Personal con su rol |
| `GET` | `/staff/shifts` | autenticado | Plan de turnos del día |
| `POST` | `/staff/shifts` | admin/sucursal | Asigna turno |
| `DELETE` | `/staff/shifts/:id` | admin/sucursal | Quita turno |
| `GET` | `/staff/attendance` | autenticado | Marcación del día |
| `POST` | `/staff/attendance` | admin, sucursal, cajero | Upsert de marcación |
| `GET` | `/staff/tips` | autenticado | Pozos del día |
| `GET` | `/staff/tips/:id` | autenticado | Detalle del pozo |
| `POST` | `/staff/tips/calculate` | admin/sucursal | Calcula y reparte |
| `POST` | `/staff/tips/:id/confirm` | admin/sucursal | Confirma reparto (idempotente) |

Reglas:
- Pozo = suma de `ordenes.propina` del día en la sucursal.
- Reparten **solo** asistencias `PRESENTE`/`TARDANZA`; una `FALTA` no cobra.
- Reparto exacto al céntimo (`repartirPropinas`: base truncada + residuo de a un céntimo); la suma cuadra con el pozo.
- Un pozo por sucursal y día (409 si se repite); confirmar es idempotente.
- La marcación es upsert por `(empleado_id, fecha)`.
- El plan de turnos **sí** se puede borrar (es operativo, no contable). Los pozos no: se confirman.
- `ADMIN_GLOBAL` indica `sucursalId` en el body donde aplique.

## 4. Datos

- `empleados`: `usuario_id`, `rol_empresa_id`, `sucursal_id`, `activo`, `deleted_at`.
- `turnos_plan`: empleado + fecha + `bloque_turno` (`MANANA|TARDE|NOCHE|DESCANSO`), único.
- `asistencias`: estado (`PRESENTE|TARDANZA|FALTA|DESCANSO`), hora; único por empleado/fecha.
- `pozos_propinas`: total, fecha, sucursal, estado (`CALCULADO|REPARTIDO`), único por sucursal/día.
- `repartos_propinas`: importe por empleado (append-only).

## 5. UI y rutas

- `/app/modulos/personal/asistencia` → `AttendancePage`: KPIs, marcación y pozos.
- `/app/modulos/personal/turnos` → `ShiftsPage`: asignar/quitar turno por empleado, día y bloque.
- `/app/modulos/personal/{directorio,roles,propinas}` → `StaffModule`/`RolesView` (**demo**).

## 6. Pruebas

- Cobertura p4 (2026-11-20): ramas de datos, errores 400/404/409, filtros y transiciones con Prisma mockeado; sin cambios de comportamiento.

- Cobertura Fase 1 (2026-11-20): tests de hooks (BI, RRHH, catálogo), DTO de precios y componentes del shell con RTL/jsdom; sin cambios de comportamiento.

- Cobertura p2 (2026-11-20): tests de ramas de error y servicios (Prisma/tenant extension, promociones, precios, caja, RRHH, CRM) y SSR de providers/páginas; sin cambios de comportamiento.

- Cobertura (2026-11-20): se añadieron tests de controlador, DTO, mapper y ramas de error para subir la cobertura de Sonar; sin cambios de comportamiento.

- Refactor de duplicación (2026-11-20): empresa, sucursal y filtro salen de `TenantScopedService` (`apps/api/src/common/tenant/branch-scope.ts`); reglas, mensajes y scoping no cambian.

| Suite | Archivo |
|---|---|
| Unit | `staff.service.spec.ts`, `staff.rules.spec.ts` |
| e2e | `test/staff.e2e-spec.ts` |
| DB | `test/db/propinas.db-spec.ts` |
| Web | `features/rrhh/rrhh.test.ts` |

## 7. Deuda conocida

- Directorio, roles y propinas siguen demo (observación 6 del plan).
- No hay horario contractual ni control de horas extra.
- El reparto asume partes iguales; no hay porcentaje por rol.

## 8. Trazabilidad

- Jira: AYCDS-33 (API), AYCDS-45 (UI).
- PRs: #33, #42, #43.
- Docs: [decisiones](../../docs/decisiones.md) (pozo desde propina cobrada, reparto exacto).

## 9. Próximos pasos

1. Conectar directorio/roles/propinas o retirarlos del menú.
2. Reparto ponderado por rol si el negocio lo pide.
