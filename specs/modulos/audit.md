# audit — especificación

**Estado:** API real; consulta `GET /audit` y feature web · **Última revisión:** 2026-11-21

## 1. Propósito

Registrar eventos de negocio relevantes (alta, cobro, anulación, suspensión, ajustes) en una tabla append-only y exponer una consulta **de solo lectura** para el administrador de la empresa.

## 2. Superficies

| Capa | Dónde vive | Estado |
|---|---|---|
| Backend | `apps/api/src/modules/audit/` (`AuditService.record`, `AuditController.list`) | real |
| Web | `apps/web/features/audit/` (`AuditPage`) → `/app/auditoria` | real |
| Contrato | `packages/contracts/src/audit.ts` (`EventoAuditoria`, topes) | sí |
| Datos | `auditoria` | `20261019000000_init` + triggers de inmutabilidad |

## 3. API

| Método | Ruta | Roles | Qué hace |
|---|---|---|---|
| `GET` | `/api/v1/audit?limit=50` | `ADMIN_GLOBAL` | Últimos eventos de la empresa del token (`limit` 1–200) |

- La empresa sale del JWT; nunca del query. `ADMIN_GLOBAL` sin empresa recibe 400.
- `AuditService.record` sigue siendo interno y best-effort: un fallo de auditoría no tumba la operación principal.

## 4. Datos

- `auditoria`: `empresa_id`, `sucursal_id`, `usuario_id`, `accion`, `entidad`, `entidad_id`, `detalle` (JSON), `ip`, `created_at`.
- Append-only: el trigger `DB_AUDITORIA_INMUTABLE` bloquea `UPDATE`/`DELETE` con SQLSTATE `45000` (ver [errores-db](../../docs/errores-db.md)).

## 5. UI y rutas

- `/app/auditoria` → `AuditPage`: últimos 100 eventos con fecha, acción, entidad, usuario y detalle.
- Solo `admin`; el enlace aparece en Administración del sidebar.

## 6. Módulos que auditan

`cash`, `expenses`, `receipts`, `inventory`, `stock-alerts`, `promotions`, `crm`, `billing`, `onboarding`, `saas`, `orders`.

## 7. Pruebas

| Suite | Archivo |
|---|---|
| Unit | `src/modules/audit/audit.service.spec.ts`, `audit.controller.spec.ts` |
| DB (inmutabilidad) | `test/db/inmutabilidad.db-spec.ts` |
| Web | `features/audit/audit.test.ts` |

## 8. Deuda conocida

- Sin filtros por entidad/fecha ni paginación por cursor; hoy es una foto de los últimos eventos.
- Sin retención/particionado cuando la tabla crezca.

## 9. Trazabilidad

- Jira: AYCDS-62 (inmutabilidad), ola de paridad F5 (consulta y feature).
- PRs: #6, #64, #131.
- Docs: [errores-db](../../docs/errores-db.md), [rls-modelo](../../docs/rls-modelo.md).

## 10. Próximos pasos

1. Filtros por entidad/fecha y paginación por cursor.
2. Retención/particionado cuando la tabla crezca.
