# expenses — especificación

**Estado:** API real; UI demo · **Última revisión:** 2026-11-21

## 1. Propósito

Registrar gastos operativos y cuentas por pagar, y **sacar de caja** el gasto pagado en efectivo. El resto de métodos solo cambia el estado (el banco no está en el cajón).

## 2. Superficies

| Capa | Dónde vive | Estado |
|---|---|---|
| Backend | `apps/api/src/modules/expenses/` | real |
| Web | `apps/web/features/expenses/` (`GastosPage` demo, `api.ts` listo) | Mixto |
| Contrato | `packages/contracts/src/expenses.ts` | sí |
| Datos | `gastos`, `proveedores`, `movimientos_caja` | `20261019000000_init`, `20261106160000_caja_turnos_propina` |

## 3. API

| Método | Ruta | Roles | Qué hace |
|---|---|---|---|
| `GET` | `/expenses` | admin, sucursal, cajero | Lista con filtros (estado, categoría, vencidos, sucursal) |
| `GET` | `/expenses/summary` | mismos | Por pagar, vencido y pagado del mes |
| `POST` | `/expenses` | admin, sucursal | Alta |
| `PATCH` | `/expenses/:id` | admin, sucursal | Edición |
| `POST` | `/expenses/:id/pay` | admin, sucursal, cajero | Paga (en efectivo cruza a caja) |

Reglas:
- **Efectivo** exige turno abierto e inserta `EGRESO` en `movimientos_caja` con `gasto_id`, `pagado_en_caja` y `turno_id`, vía `CASH_PORT.egresoDeGasto` (misma transacción).
- `TARJETA`/`TRANSFERENCIA`/`YAPE` solo marcan `PAGADO`: sin movimiento de caja.
- Pago idempotente: `updateMany` exige `PENDIENTE`; el segundo pago recibe **409**.
- Un gasto pagado en caja **no se edita** (409 + `DB_GASTO_PAGADO`); no se borra: se compensa.

## 4. Datos

- `gastos`: `categoria` (`INSUMOS|SERVICIOS|PERSONAL|ALQUILER|MARKETING|OTROS`), `concepto`, `monto`, `estado_pago` (`PENDIENTE|PAGADO`), `vencimiento`, `pagado_en_caja`, `turno_id`, `proveedor_id`. El método de pago se recibe en el DTO de pago; no se persiste como columna.
- `proveedores`: maestro por empresa.
- Inmutabilidad de gasto pagado en caja (trigger).

## 5. UI y rutas

- `/app/gastos` → `GastosPage` **sigue en el estado demo** de `ModulesProvider`.
- `features/expenses/api.ts` (`gastosApi`) ya cubre listar, resumen, crear y pagar; falta conectarlo (AYCDS-27).
- Sin sesión, la vista mantiene el demo.

## 6. Pruebas

- Cobertura p4 (2026-11-20): ramas de datos, errores 400/404/409, filtros y transiciones con Prisma mockeado; sin cambios de comportamiento.

- Cobertura p3 (2026-11-20): RTL de las páginas del módulo con provider y APIs mockeados (estados, permisos y acciones); sin cambios de comportamiento.

- Cobertura (2026-11-20): se añadieron tests de controlador, DTO, mapper y ramas de error para subir la cobertura de Sonar; sin cambios de comportamiento.

- Refactor de duplicación (2026-11-20): empresa, sucursal y filtro salen de `TenantScopedService` (`apps/api/src/common/tenant/branch-scope.ts`); reglas, mensajes y scoping no cambian.

| Suite | Archivo |
|---|---|
| Unit | `src/modules/expenses/expenses.service.spec.ts` |
| e2e | `test/expenses.e2e-spec.ts` |
| DB | `test/db/gastos.db-spec.ts` |
| Web | `features/expenses/expenses.test.ts` |

## 7. Deuda conocida

- Paridad de módulos (2026-11-21): feature `features/expenses/` y contrato `packages/contracts/src/expenses.ts` con el mismo ID que el backend. El subpath antiguo queda como alias `@deprecated` durante una release.

- La UI no consume `/expenses` (observación 2 del plan de módulos).
- No hay adjuntos de factura ni conciliación bancaria.
- El pago parcial de un gasto no está modelado.

## 8. Trazabilidad

- Jira: AYCDS-17 (API), AYCDS-27 (UI, pendiente).
- PR: #31.
- Docs: [decisiones](../../docs/decisiones.md) (egreso en efectivo, gasto pagado inmutable).

## 9. Próximos pasos

1. Conectar `GastosPage` a `gastosApi` y cerrar AYCDS-27.
2. Adjuntos y vencimiento recurrente si el negocio lo pide.
