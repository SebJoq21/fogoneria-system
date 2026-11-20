# crm — especificación

**Estado:** API real; fidelización demo · **Última revisión:** 2026-11-19

## 1. Propósito

Conocer al comensal: historial de visitas, segmento derivado y puntos por consumo. El segmento **no se edita a mano**: sale de las comandas pagadas.

## 2. Superficies

| Capa | Dónde vive | Estado |
|---|---|---|
| Backend | `apps/api/src/modules/crm/` | real |
| Web | `apps/web/features/crm/` (`ClientesPage` real, `LoyaltyPage` demo, hub) | Mixto |
| Contrato | `packages/contracts/src/crm.ts` | sí |
| Datos | `clientes`, `movimientos_puntos`, `config_lealtad`, `canjes_cupones`, `ordenes` | `20261019000000_init` |

## 3. API

| Método | Ruta | Roles | Qué hace |
|---|---|---|---|
| `GET` | `/crm/customers` | autenticado | Lista/busca/filtra por segmento |
| `GET` | `/crm/customers/:id` | autenticado | Ficha con últimos movimientos |
| `GET` | `/crm/customers/:id/points` | autenticado | Historial de puntos |
| `POST` | `/crm/customers` | admin, sucursal, cajero, mesero | Alta (teléfono único) |
| `PATCH` | `/crm/customers/:id` | admin, sucursal, cajero | Edita |
| `POST` | `/crm/customers/:id/points` | admin, sucursal | Ajuste (cortesía/canje/caducidad) |
| `POST` | `/crm/customers/:id/recalculate` | admin, sucursal | Recalcula visitas/segmento |
| `POST` | `/crm/process` | admin, sucursal | Fuerza el worker de consumos |
| `GET` | `/crm/config` | admin, sucursal | Configuración de lealtad |
| `PATCH` | `/crm/config` | admin, sucursal | Actualiza umbrales/puntos |

Reglas:
- `visitas` = comandas `PAGADA` del cliente; `segmento` se **deriva** por umbrales de `config_lealtad` (`FRECUENTE` ≥5, `VIP` ≥20 por defecto).
- Puntos por consumo: **worker** (cron cada 5 min + `POST /crm/process`), idempotente por movimiento `GANANCIA` de la orden; el cobro no depende del CRM.
- El movimiento guarda el importe en positivo; el signo lo da el tipo (`GANANCIA` suma, `CANJE`/`CADUCIDAD` restan).
- El saldo se recalcula desde los movimientos; canje > saldo → **400**.
- El ajuste manual exige `sucursalId` para `ADMIN_GLOBAL` (el token no la trae).

## 4. Datos

- `clientes`: `nombre`, `telefono` (único por empresa), `visitas`, `puntos`, `segmento`, `ultima_visita`, `deleted_at`.
- `movimientos_puntos`: `tipo`, `puntos`, `orden_id`, `sucursal_id`; append-only.
- `config_lealtad`: `puntos_por_moneda`, umbrales de segmento.

## 5. UI y rutas

- `/app/clientes` → `ClientesPage`: búsqueda por nombre/teléfono, filtro por segmento, ficha con movimientos y ajuste.
- `/app/modulos/fidelizacion/regla` → `LoyaltyPage` (**demo**); `crmApi.config()`/`actualizarConfig()` listos para conectarla.
- `/app/modulos/fidelizacion` → `LoyaltyHubPage`.

## 6. Pruebas

- Cobertura p2 (2026-11-20): tests de ramas de error y servicios (Prisma/tenant extension, promociones, precios, caja, RRHH, CRM) y SSR de providers/páginas; sin cambios de comportamiento.

- Cobertura (2026-11-20): se añadieron tests de controlador, DTO, mapper y ramas de error para subir la cobertura de Sonar; sin cambios de comportamiento.

| Suite | Archivo |
|---|---|
| Unit | `crm.service.spec.ts`, `crm.rules.spec.ts` |
| e2e | `test/crm.e2e-spec.ts` |
| DB | `test/db/crm.db-spec.ts` |
| Web | `features/crm/crm.test.ts` |

## 7. Deuda conocida

- `LoyaltyPage` sigue demo (reglas de fidelización).
- `customers`/`coupons` del demo siguen en `ModulesProvider` hasta la Fase 4.
- Los puntos otorgados por consumo dependen del worker: si el cron no corre, se puede forzar con `POST /crm/process`.

## 8. Trazabilidad

- Jira: AYCDS-31 (API), AYCDS-40 (UI).
- PRs: #32, #41.
- Docs: [decisiones](../../docs/decisiones.md) (segmento derivado, worker de puntos).

## 9. Próximos pasos

1. Conectar `LoyaltyPage` a `/crm/config`.
2. Evaluar canje en el cobro (hoy es ajuste manual).
