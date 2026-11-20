# Flujos críticos

**Última revisión:** 2026-11-19. Cada flujo indica actor, pasos, endpoints, datos y spec de módulo. Los contratos exactos viven en las specs enlazadas.

## 1. Login, sesión y RBAC

```text
navegador → / (LoginPage) → POST /api/session
           → API POST /auth/login (estado del tenant)
           → cookies HttpOnly: fogoneria.session + fogoneria.token
           → redirect por ROLE_HOME
```

- La API rechaza `SUSPENDED`/`EXPIRED`/`LEAD`/`NO_CALIFICADO` y trials vencidos.
- `proxy.ts` valida firma, expiración (15 min deslizante, 8 h tope) y `canViewPath` en cada request.
- El navegador **nunca** ve el access token: todo pasa por el BFF.
- Recuperación: `/recuperar` abre un `mailto:` a soporte; no hay reset automático.
- Specs: [auth](../modulos/auth.md) · [plataforma](../modulos/plataforma.md) · [roles](roles-permisos.md).

## 2. Onboarding de una empresa

1. `/onboarding` (público) pide razón social, RUC y logo (data URL ≤2 MB).
2. El cliente valida RUC (módulo 11) y envía `POST /onboarding` por el BFF (única ruta pública).
3. La API valida RUC y duplicados (409), y en una transacción crea: empresa `TRIAL` (`mrr 0`), sucursal matriz, admin `ADMIN_GLOBAL`, lista de precios «Carta», lead `GANADO` y evento de auditoría.
4. Auto-login y redirect por rol.
- Límites: rate limit 5/10 min por IP; body de 4 MB solo en esa ruta; el DTO **no** acepta `plan` (400).
- Specs: [onboarding](../modulos/onboarding.md) · [plataforma](../modulos/plataforma.md).

## 3. Comanda: mesero → cocina → caja

```text
mesero abre cuenta (mesa) → agrega líneas → POST /orders (sin precio)
   → order.created (WS) → KDS confirma → PATCH /orders/:id/status (EN_COCINA)
   → cocina marca LISTO → mesero ENTREGADO (descuenta kardex)
   → caja cobra POST /cash/charges → PAGADA → libera mesa
   → POST /receipts (solo PAGADA) → B001/F001/T001
```

- Precio resuelto por `PricingPort`; `mesero_id` del JWT; folio `ORD-000123` por `secuencias`.
- `ANULADA` solo desde `POR_CONFIRMAR` (400 después; trigger `DB_ORDEN_ANULACION_TARDIA`).
- `PAGADA` **no** se escribe por `PATCH /orders/:id/status`: solo caja.
- Al `ENTREGADO` corre el kardex por receta (idempotente, stock ≥ 0).
- Eventos: `order.created`, `order.updated`, `order.sla`, `table.status`.
- Specs: [orders](../modulos/orders.md) · [realtime](../modulos/realtime.md) · [cash](../modulos/cash.md) · [inventory](../modulos/inventory.md).

## 4. Mesas y reservas

1. `GET /tables` hidrata el mapa por sucursal; `OCUPADA`/`RESERVADA` los derivan órdenes y reservas.
2. `POST /reservations` valida aforo (`capacidad`) y solapamiento de ±90 min en la misma mesa (409).
3. La agenda filtra por `fecha=YYYY-MM-DD` en hora de Lima.
4. Confirmar/cancelar/no-show por `PATCH /reservations/:id/status`; «Llegó» abre cuenta sobre la mesa real.
5. Bloqueo manual: `PATCH /tables/:id/status` con `MANTENIMIENTO`/`LIBRE` (409 si hay orden abierta o reserva activa).
- Specs: [tables](../modulos/tables.md) · [reservations](../modulos/reservations.md).

## 5. Comprobantes y reversión

1. Solo una comanda `PAGADA` puede emitir (`POST /receipts`).
2. Serie por tipo (`B001` boleta, `F001` factura, `T001` ticket), correlativo por empresa en `secuencias`.
3. Documento: factura exige RUC con dígito; boleta acepta DNI de 8; ticket no pide.
4. IGV derivado: `base = total / 1.18`, `igv = total - base` (no se persiste).
5. Anulación con motivo (`POST /receipts/:id/void`): estado `ANULADA` + actor + fecha. La reversión de caja y kardex la hacen **triggers** (`docs/errores-db.md`); sin turno abierto → `DB_REVERSION_SIN_TURNO` (409).
6. SUNAT queda **«pendiente de OSE»**; el CDR simulado solo existe en el demo.
- Specs: [receipts](../modulos/receipts.md) · [cash](../modulos/cash.md).

## 6. CRM y puntos

1. El cliente se registra en la comanda; al cobrar se asocia `cliente_id`.
2. Un worker (cron 5 min + `POST /crm/process`) busca comandas `PAGADA` sin movimiento `GANANCIA`, otorga `total × puntos por sol` y recalcula `visitas` y `segmento`.
3. El segmento se **deriva** de las visitas (`NUEVO`/`FRECUENTE`/`VIP` por umbrales de `config_lealtad`).
4. Ajuste manual (`POST /crm/customers/:id/points`): cortesía, canje o caducidad; el saldo se recalcula desde los movimientos; canje > saldo → 400.
- Specs: [crm](../modulos/crm.md).

## 7. RRHH y propinas

1. `GET /staff/employees` lista el personal con su rol.
2. Plan de turnos: `POST /staff/shifts` / `DELETE /staff/shifts/:id` (operativo, sí se borra).
3. Marcación del día: `POST /staff/attendance` (upsert por empleado + fecha; `PRESENTE|TARDANZA|FALTA|DESCANSO`).
4. `POST /staff/tips/calculate` suma `ordenes.propina` del día en la sucursal y reparte **solo** entre `PRESENTE`/`TARDANZA`, exacto al céntimo.
5. `POST /staff/tips/:id/confirm` es idempotente; un pozo por sucursal y día (409 si se repite).
- Specs: [staff](../modulos/staff.md).

## 8. BI (analíticas)

1. `GET /bi/pnl?desde&hasta` devuelve ventas, comprobado, venta sin comprobante, gastos, margen y propinas.
2. `pnl/daily`, `top-dishes` y `sales-by-method` completan la vista.
3. Lee las vistas `v_bi_*` (siempre `security_invoker`) **dentro** de la transacción del request; rango ≤366 días; sucursal del token.
4. Día de Lima (UTC-05:00 fijo). La propina se informa aparte: no es ingreso.
- Specs: [bi](../modulos/bi.md) · [vistas BI](../../docs/bi-vistas.md).

## Flujos de apoyo

| Flujo | Resumen | Spec |
|---|---|---|
| Kardex por escandallo | Al `ENTREGADO` explota receta (y combos), descuenta stock con concurrencia optimista, omite platos sin receta | [inventory](../modulos/inventory.md) |
| Semáforo y alertas de stock | `GET /inventory/stock` + cron 10 min + webhook HMAC opcional | [inventory](../modulos/inventory.md) |
| Gasto pagado en efectivo | `POST /expenses/:id/pay` inserta `EGRESO` en caja (`CASH_PORT`); otros métodos solo cambian estado | [expenses](../modulos/expenses.md) |
| Cupón y combo | `POST /orders` recibe `cuponCodigo`; el servidor valida, calcula y consume el uso; combo no puede superar la suma de sus platos | [promotions](../modulos/promotions.md) |
| Ciclo SaaS | `TRIAL → EXPIRED → SUSPENDED` por cron 03:00; suspender/reactivar desde `/saas` | [saas](../modulos/saas.md) · [billing](../modulos/billing.md) |
