# cash — especificación

**Estado:** API real · **Última revisión:** 2026-11-19

## 1. Propósito

Abrir y cerrar el turno de caja por sucursal, registrar ingresos/egresos y **cobrar** la comanda (pago parcial + propina). Es la única vía para dejar una orden `PAGADA`.

## 2. Superficies

| Capa | Dónde vive | Estado |
|---|---|---|
| Backend | `apps/api/src/modules/cash/` | real |
| Web | `apps/web/features/caja/` (`CajaPage`, `CheckoutModal`, `api.ts`) | real |
| Contrato | `packages/contracts/src/caja.ts` | sí |
| Datos | `turnos_caja`, `movimientos_caja`, `ordenes.propina` | `20261106160000_caja_turnos_propina` |

## 3. API

| Método | Ruta | Roles | Qué hace |
|---|---|---|---|
| `GET` | `/cash/shifts/current` | admin, sucursal, cajero | Turno abierto de la sucursal |
| `GET` | `/cash/shifts` | mismos | Historial de turnos |
| `POST` | `/cash/shifts` | mismos | Abre turno con fondo |
| `PATCH` | `/cash/shifts/:id/close` | mismos | Cierra con arqueo (contado, diferencia, observaciones) |
| `GET` | `/cash/movements` | mismos | Movimientos por turno/tipo |
| `POST` | `/cash/movements` | mismos | Ingreso/egreso manual |
| `POST` | `/cash/charges` | mismos | Cobra comanda con pagos parciales y propina |

Reglas:
- **Una sola caja abierta por sucursal**: índice único parcial `uq_turnos_abierto_sucursal`; el servicio da 409 amable.
- Los totales se **calculan** desde `movimientos_caja` al cerrar; no se acumulan.
- `movimientos_caja` solo acepta inserts en turnos `ABIERTO`; es append-only.
- El cobro entra por `ORDERS_PORT.markPaid` (`useExisting: OrdersService`) en la misma transacción.
- `PAGADA` no se escribe desde `PATCH /orders/:id/status` (400).
- La propina se guarda en `ordenes.propina` y como ingreso con concepto `Propina …`.

## 4. Datos

- `turnos_caja`: `estado` (`ABIERTO|CERRADO`), `fondo_apertura`, totales, `efectivo_contado`, `diferencia`, `observaciones`, `cajero_id`.
- `movimientos_caja`: `tipo` (`INGRESO|EGRESO`), `metodo` (`EFECTIVO|TARJETA|YAPE|TRANSFERENCIA`), `orden_id`, `gasto_id`, `turno_id`.
- Inmutabilidad: turno cerrado no se reabre; movimientos no se editan/borran (`DB_MOVIMIENTO_INMUTABLE`).

## 5. UI y rutas

- `/app/caja` → `CajaPage`: turno y arqueo del servidor, movimientos, historial, apertura/cierre y cobro de comandas `ENTREGADO`.
- Sin sesión cae al estado local del demo.
- `features/caja/api.ts` traduce snake_case → contrato (`@fogoneria/contracts/caja`).
- `lib/cash-api.ts` queda como cliente legado (solo lo usan sus tests).

## 6. Pruebas

- Cobertura p3 (2026-11-20): tests de ramas de error de órdenes/SaaS/reservas/mesas y variantes de sesión en caja, comprobantes, clientes e inventario; sin cambios de comportamiento.

- Cobertura p2 (2026-11-20): tests de ramas de error y servicios (Prisma/tenant extension, promociones, precios, caja, RRHH, CRM) y SSR de providers/páginas; sin cambios de comportamiento.

- Cobertura (2026-11-20): se añadieron tests de controlador, DTO, mapper y ramas de error para subir la cobertura de Sonar; sin cambios de comportamiento.

| Suite | Archivo |
|---|---|
| Unit | `src/modules/cash/cash.service.spec.ts` |
| e2e | `test/cash.e2e-spec.ts` |
| DB | `test/db/caja.db-spec.ts` |
| Web | `features/caja/caja.test.ts`, `lib/cash-api.test.ts` |

## 7. Deuda conocida

- No hay arqueo por denominación de billetes (solo total contado).
- No hay conciliación con tarjeta/Yape (el dinero electrónico solo se registra).
- El turno se identifica por sucursal, no por terminal/caja física.

## 8. Trazabilidad

- Jira: AYCDS-34 (API), AYCDS-46 p1 (UI).
- PRs: #24, #30.
- Docs: [decisiones](../../docs/decisiones.md) (PAGADA solo por caja, totales derivados).

## 9. Próximos pasos

1. Cierre por denominaciones si se pide en operación.
2. Multi-caja por sucursal (hoy una sola abierta).
