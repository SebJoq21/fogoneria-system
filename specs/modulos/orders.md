# orders — especificación

**Estado:** API real (KDS y mesero); cuentas aún locales · **Última revisión:** 2026-11-19

## 1. Propósito

Registrar la comanda, resolver su precio en el servidor, numerarla por empresa y moverla por el flujo del KDS hasta `PAGADA`. Es el corazón del POS.

## 2. Superficies

| Capa | Dónde vive | Estado |
|---|---|---|
| Backend | `apps/api/src/modules/orders/` | real |
| Web KDS | `apps/web/features/ordenes/` (`OrdersBoardPage`) | real |
| Web mesero | `apps/web/components/erp/MozoView.tsx` + `components/erp/mozo/**` | real (comandas), cuentas locales |
| Contrato | `packages/contracts/src/ordenes.ts` | sí |
| Datos | `ordenes`, `detalles_orden`, `detalles_orden_modificadores`, `secuencias` | `20261019000000_init`, `20261027120000_secuencias_tenant`, `20261028120000_ordenes_anulacion_estricta`, `20261106120000_ordenes_sla_indice`, `20261106160000_caja_turnos_propina` |

## 3. API

| Método | Ruta | Roles | Qué hace |
|---|---|---|---|
| `GET` | `/api/v1/orders` | autenticado | Lista del tenant/sucursal |
| `GET` | `/api/v1/orders/board` | autenticado | Tablero KDS con SLA y métricas (`dias` ≤30, `limite` ≤500) |
| `GET` | `/api/v1/orders/:id` | autenticado | Detalle |
| `POST` | `/api/v1/orders` | admin, sucursal, mesero, cajero | Crea comanda (sin precio) |
| `PATCH` | `/api/v1/orders/:id/status` | admin, sucursal, cocinero, mesero, cajero | Avanza estado (no `PAGADA`) |

Reglas:
- El **precio lo pone el servidor**: `CreateOrderDto` no acepta `precioUnitario` (400). `OrdersService` cotiza por `PRICING_PORT` en lote; los combos usan `combos.precio_fijo`.
- `mesero_id` sale del JWT; `numero_orden` de `SequencesService` (autocommit, fuera de la tx; un hueco es aceptado).
- Estados: `POR_CONFIRMAR → EN_COCINA → LISTO → ENTREGADO → PAGADA/CERRADA`; `ANULADA` solo desde `POR_CONFIRMAR` (400 después; trigger `DB_ORDEN_ANULACION_TARDIA`).
- `PAGADA` **no** se escribe por esta ruta: la pone caja con `POST /cash/charges`.
- Al `ENTREGADO`: kardex por receta (idempotente) y evento `order.updated`.
- `orders/board` calcula SLA de 20 min desde `confirmacion_at ?? ingreso_at`; el cron marca `alerta_sla` y emite `order.sla`.

## 4. Datos

- `ordenes`: `numero_orden`, `estado`, `origen` (`MESA|WEB|DELIVERY|BARRA`), `mesa_id`, `mesero_id`, `cliente_id`, `lista_precio_id`, `subtotal`, `descuento_cupon`, `total`, `propina`, `alerta_sla`, marcas de tiempo (`ingreso_at`, `confirmacion_at`, `listo_at`, `entrega_at`).
- `detalles_orden` / `detalles_orden_modificadores`: líneas y modificadores.
- Inmutabilidad: `UPDATE`/`DELETE` bloqueados en estados terminales (`docs/rls-modelo.md`).

## 5. UI y rutas

- `/app/ordenes` y `/app/cocina` → `OrdersBoardPage` (4 columnas, contadores, SLA en vivo, canal en vivo).
- `/app/mozo` → `MozoView` con `AccountPanel`: mesa real (`GET /tables`), enviar comanda, «Mis comandas» por `mesero_id`, entregar/anular, badge del canal.
- `lib/order-mapping.ts` es el único traductor API↔UI (estados, folio como `id`, `apiId`, modificadores → `notas` ≤500).
- Un solo socket refresca tablero y comandas (`lib/orders-realtime.ts`).

## 6. Pruebas

- Cobertura p3 (2026-11-20): tests de ramas de error de órdenes/SaaS/reservas/mesas y variantes de sesión en caja, comprobantes, clientes e inventario; sin cambios de comportamiento.

- Cobertura (2026-11-20): se añadieron tests de controlador, DTO, mapper y ramas de error para subir la cobertura de Sonar; sin cambios de comportamiento.

| Suite | Archivo |
|---|---|
| Unit | `orders.service.spec.ts`, `orders.sla.spec.ts`, `orders.sla.cron.spec.ts`, `dto/create-order.dto.spec.ts` |
| e2e | `test/orders.e2e-spec.ts` |
| DB | `orders-pos.db-spec.ts`, `orders-sla.db-spec.ts`, `sequences-concurrency.db-spec.ts` |
| Web | `features/ordenes/ordenes.test.ts`, `lib/order-mapping.test.ts`, `lib/orders-api.test.ts` |

## 7. Deuda conocida

- «Cerrar cuenta» en el panel del mesero intenta `PAGADA` por `PATCH` y recibe 400 (observación 4 del plan): derivar a Caja o guiar al usuario.
- Los modificadores viajan como nota; el recargo se cobra en caja. Falta `items[].modificadores` si se quiere recargo en la comanda.
- La «cuenta» (`TableAccount`) sigue en `localStorage`; no hay API de cuentas.
- `MozoView` aún no es feature (`components/erp/*`).
- **Deuda RLS del KDS:** el planificador no ve `pg_statistic` de las tablas con RLS y el tablero recorre ~50k filas en vez de usar `idx_ordenes_estado` (157 ms vs 0,075 ms). Opciones en `docs/explain-orders.md` §6/§7: vista/función `SECURITY DEFINER`, contadores denormalizados o `pg_hint_plan`. No dar `BYPASSRLS` al rol de negocio.

## 8. Trazabilidad

- Jira: AYCDS-20 (POS), AYCDS-25 (mesero), AYCDS-30/41 (KDS+SLA), AYCDS-22 (concurrencia).
- PRs: #12, #16, #17, #22, #25.
- Docs: [explain-orders](../../docs/explain-orders.md), [decisiones](../../docs/decisiones.md), [websockets](../../docs/websockets.md).

## 9. Próximos pasos

1. Cerrar la observación 4 (derivar cobro a Caja).
2. API de cuentas para sacar `TableAccount` de `localStorage`.
3. Mover `MozoView` a `features/mozo` en una ola posterior.
