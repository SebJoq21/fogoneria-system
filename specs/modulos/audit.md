# audit — especificación

**Estado:** API real (solo servicio) · **Última revisión:** 2026-11-19

## 1. Propósito

Registrar eventos de negocio relevantes (alta, cobro, anulación, suspensión, ajustes) en una tabla append-only. Es transversal: los módulos la usan sin depender de su implementación.

## 2. Superficies

| Capa | Dónde vive | Estado |
|---|---|---|
| Backend | `apps/api/src/modules/audit/` (`AuditService.record`) | real |
| Web | — | no aplica |
| Contrato | — | no aplica |
| Datos | `auditoria` | `20261019000000_init` + triggers de inmutabilidad |

## 3. Uso

```ts
await this.audit.record({
  empresaId, sucursalId, usuarioId,
  accion: 'CREAR' | 'ANULAR' | 'SUSPENDER' | …,
  entidad: 'orden' | 'comprobante' | 'empresa' | …,
  entidadId, detalle: { … },
});
```

- `AuditService` es `@Global` (`AuditModule`) y se importa por `../audit/index.js`.
- La auditoría **nunca** tumba la operación principal: captura el error y emite un warning.
- Usa `prisma.raw` para escribir (no depende de un tenant activo).

## 4. Datos

- `auditoria`: `empresa_id`, `sucursal_id`, `usuario_id`, `accion`, `entidad`, `entidad_id`, `detalle` (JSON), `ip`, `created_at`.
- Append-only: el trigger `DB_AUDITORIA_INMUTABLE` bloquea `UPDATE`/`DELETE` con SQLSTATE `45000` (ver [errores-db](../../docs/errores-db.md)).

## 5. Módulos que auditan

`cash`, `expenses`, `receipts`, `inventory`, `stock-alerts`, `promotions`, `crm`, `billing`, `onboarding`, `saas`, `orders`.

## 6. Pruebas

| Suite | Archivo |
|---|---|
| DB (inmutabilidad) | `test/db/inmutabilidad.db-spec.ts` |
| Unit | pendiente de verificar (no hay `audit.service.spec.ts`) |

## 7. Deuda conocida

- Sin unit test del servicio (bajo riesgo: falla silenciosa).
- No hay consulta HTTP de auditoría para el usuario final.

## 8. Trazabilidad

- Jira: AYCDS-62 (inmutabilidad), ola plataforma (import por `index`).
- PRs: #6, #64.
- Docs: [errores-db](../../docs/errores-db.md), [rls-modelo](../../docs/rls-modelo.md).

## 9. Próximos pasos

1. Endpoint de consulta de auditoría por entidad (solo admin).
2. Retención/particionado cuando la tabla crezca.
