# Acta de QA — CT-FG-03: caja, cobro y comprobantes (AYCDS-50)

**Fecha:** 2026-11-10
**Responsable:** Sebastián Chicata (firma pendiente) · **Ejecución técnica:** David Piñarreta
**Ambiente:** PostgreSQL 16 local (`localhost:5433`), API NestJS (`localhost:3001`), web Next.js 16
**Alcance:** turnos de caja, cobro de comandas, emisión/anulación de comprobantes, reversión financiera, propinas y kardex.

> Este documento reúne la evidencia de los controles `CT-FG-03` sobre el código de `development` (`b34bfd7`). No sustituye la firma del responsable; la deja lista para firmar.

## 1. Resultado general

**Aprobado.** Los siete controles se ejecutaron contra la API y la base reales. Aparecieron dos defectos en el camino (reversión de propina y errores `DB_*` devueltos como 500); ambos se corrigieron y quedaron con test de regresión.

| Suite | Resultado |
|---|---|
| API unitarias | **297/297** |
| API e2e (Prisma mockeado) | **112/112** |
| API base de datos (RLS, caja, comprobantes, kardex, reversión) | **109/109** |
| Web (RBAC, clientes de API, mapeos) | **135/135** |
| Lint / check-types / build | 3/3 tareas OK · build web 0 errores |
| CI | verde en cada PR (`#30`, `#35`, `#36`, `#37`, `#38`) |

## 2. Matriz de controles

| Control | Qué verifica | Evidencia | Resultado |
|---|---|---|---|
| **CT-FG-03.1** | Una sola caja abierta por sucursal | Índice `uq_turnos_abierto_sucursal`; `cash.service.spec.ts`; DB `caja.db-spec.ts` | OK |
| **CT-FG-03.2** | El cobro solo lo hace caja y deja el turno cuadrado | `POST /cash/charges` → `OrdersService.markPaid`; totales derivados de `movimientos_caja`; smoke de la 34 (esperado 380 / diferencia 0) | OK |
| **CT-FG-03.3** | `PAGADA` no se escribe por la ruta de órdenes | `PATCH /orders/:id/status` responde **400** para `PAGADA`; `orders.service.spec.ts` | OK |
| **CT-FG-03.4** | El comprobante se emite sobre una comanda pagada y con correlativo propio | `POST /receipts` (409 si no está pagada); series `B001/F001/T001` en `secuencias`; `receipts.service.spec.ts` y DB `comprobantes.db-spec.ts` | OK |
| **CT-FG-03.5** | Anular compensa caja y stock, nunca edita el histórico | Triggers de AYCDS-39; egreso al turno abierto; `DB_REVERSION_SIN_TURNO` → **409**; DB `reversion-financiera.db-spec.ts` | OK |
| **CT-FG-03.6** | La propina no se revierte al anular | Fix en los triggers (la propina es del personal, no ingreso del negocio); DB de reversión | OK |
| **CT-FG-03.7** | El kardex descuenta al entregar y no deja stock negativo | `InventoryService.consumeOrder` idempotente por `SALIDA`; `CHECK` de no negativos; DB `kardex.db-spec.ts` | OK |

## 3. Evidencia por PR

| Tarea | PR | Qué dejó |
|---|---|---|
| AYCDS-39 reversión | #23 | Triggers de compensación + `DB_REVERSION_SIN_TURNO` |
| AYCDS-34 caja | #24 | Turnos, cobro con propina y arqueo |
| AYCDS-36 comprobantes | #26 | Emisión por serie, IGV derivado y anulación |
| AYCDS-11 kardex | #28 | Consumo por escandallo al `ENTREGADO` |
| AYCDS-46 caja UI | #30 | `CajaView` contra la API |
| AYCDS-46 comprobantes UI | #38 | `ComprobantesView` contra la API; SUNAT «pendiente de OSE» |

## 4. Smoke de cierre (2026-11-10)

Ejecutado contra `fogoneria_db` con datos demo:

| Paso | Resultado |
|---|---|
| `GET /receipts?limit=100` sin fecha | 200, 11 comprobantes |
| `GET /orders?estado=PAGADA` | 200, 16 comandas |
| Emisión sobre comanda pagada | **201**, total del servidor (36.00), IGV 30.51 + 5.49 |
| Anulación con turno abierto | **ANULADA**, reversión aplicada por triggers |
| Segunda anulación | **409** (no se edita el histórico) |
| `GET /receipts` sin token | **401** |

## 5. Hallazgos y acciones

| # | Hallazgo | Acción | Estado |
|---|---|---|---|
| 1 | Anular devolvía la **propina** al negocio | Trigger corregido: la propina no se compensa | Cerrado (PR #23) |
| 2 | Fechas imposibles en el listado de comprobantes | Validación de rango en el DTO y el servicio | Cerrado (PR #26) |
| 3 | `pg_restore` fallaba por 150 000 líneas huérfanas del dataset perf | `reset-perf.sql` borra las hijas antes de la comanda | Cerrado (PR #35) |
| 4 | Vistas BI sin RLS (`fogoneria_app` es `BYPASSRLS`) | `security_invoker = true` en todas las vistas | Cerrado (PR #35) |
| 5 | `DB_REVERSION_SIN_TURNO` salía como **500** | `DatabaseExceptionFilter`: `DB_*` → 409/422/404/403 | Cerrado (PR #38) |

## 6. Reproducción

```powershell
# 1. Base de test con migraciones y RLS
$env:DATABASE_URL='postgresql://fogoneria_app:fogoneria_app@localhost:5433/fogoneria_test?schema=fogoneria'
pnpm --filter api db:deploy
pnpm --filter api db:rls:roles
pnpm --filter api db:rls:force

# 2. Suites
$env:DATABASE_URL_TEST=$env:DATABASE_URL
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter api test:db
pnpm --filter web test

# 3. Gates
pnpm lint; pnpm check-types; pnpm --filter web build
```

## 7. Firma

| Rol | Nombre | Fecha | Firma |
|---|---|---|---|
| Responsable QA | Sebastián Chicata | | |
| Ejecución técnica | David Piñarreta | 2026-11-10 | |

**Observaciones del responsable:** _(pendiente al firmar)_
