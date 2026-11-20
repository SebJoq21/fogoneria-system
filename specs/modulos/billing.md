# billing — especificación

**Estado:** API real (solo cron/servicio) · **Última revisión:** 2026-11-19

## 1. Propósito

Mantener el ciclo de vida de la suscripción sin intervención manual: vencer trials y suspender morosos. No tiene controller HTTP.

## 2. Superficies

| Capa | Dónde vive | Estado |
|---|---|---|
| Backend | `apps/api/src/modules/billing/` (`billing.service.ts`, `billing.scheduler.ts`) | real |
| Web | — | no aplica |
| Contrato | — | no aplica |
| Datos | `empresas`, `suscripciones_eventos`, `auditoria` | `20261019000000_init` |

## 3. API

No expone endpoints. Se ejecuta por `@Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'billing-delinquency' })`.

Reglas:
- `TRIAL → EXPIRED` al vencer `trial_fin`.
- `EXPIRED → SUSPENDED` tras `BILLING_GRACE_DAYS` (5 por defecto).
- Cada transición escribe `suscripciones_eventos` y `auditoria`.
- El login consulta el estado; no depende del cron para rechazar.

## 4. Datos

- `empresas.estado`, `trial_fin`, `plan_actual`.
- `suscripciones_eventos` (append-only por política de auditoría).

## 5. Pruebas

| Suite | Archivo |
|---|---|
| Unit | `src/modules/billing/billing.service.spec.ts` |
| e2e | pendiente de verificar |

## 6. Deuda conocida

- Sin e2e del scheduler (observación 9 del plan de módulos).
- No hay facturación real ni cobro recurrente: solo cambio de estado.

## 7. Trazabilidad

- Jira: AYCDS-61.
- PR: #2 (`feat/api-david`).
- Docs: [decisiones](../../docs/decisiones.md).

## 8. Próximos pasos

1. Test de integración con reloj simulado.
2. Documentar `BILLING_GRACE_DAYS` en `.env.example` si se hace configurable.
