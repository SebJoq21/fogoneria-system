# realtime — especificación

**Estado:** API real (gateway Socket.io) · **Última revisión:** 2026-11-21

## 1. Propósito

Sincronizar mesero ↔ cocina ↔ caja sin refrescar: comanda creada, cambio de estado, alerta de SLA y estado de mesa. El navegador **nunca** usa el access token.

## 2. Superficies

| Capa | Dónde vive | Estado |
|---|---|---|
| Backend | `apps/api/src/modules/realtime/` (`orders.gateway.ts`, `realtime.service.ts`) | real |
| Web | `apps/web/features/realtime/` (reexporta `lib/realtime.ts` y `lib/orders-realtime.ts`) | real (infra, sin ruta) |
| Contrato | `packages/contracts/src/realtime.ts` | sí |
| Datos | ninguna tabla propia | — |

## 3. Protocolo

- Namespace `/orders`; autenticación con `auth.ticket` (JWT de 60 s, `scope: 'ws'`).
- `POST /api/v1/auth/ws-ticket` firma el ticket; el BFF `GET /api/session/ws-ticket` lo entrega (`no-store`).
- `JwtStrategy` rechaza cualquier token con `scope`: el ticket no abre HTTP.
- Rooms: `empresa:<id>`, `empresa:<id>:sucursal:<id>`, `order:<id>` (con validación de tenant).
- Un rol operativo **no** entra al room de empresa: evita eventos duplicados.
- Sobre único `{ eventId, at, data }`; el cliente deduplica por `eventId` (ventana 200).

Eventos: `order.created`, `order.updated`, `order.sla`, `table.status`, `auth.error`.

## 4. Emisión

- `OrdersService` emite al crear, en cada transición y al ocupar/liberar mesa.
- `OrdersSlaCron` emite `order.sla` una sola vez por comanda.
- `RealtimeService` es la fachada; `OrdersGateway` **no** se exporta (solo uso interno del módulo).

## 5. Cliente web

- `connectOrdersRealtime(...)` con `reconnection: false`; backoff propio 1 s → 30 s + jitter y ticket nuevo por intento.
- Sin sesión (401 del BFF) no reintenta: queda `offline`.
- Estados de UI: `connecting | connected | reconnecting | offline`.
- Un **solo** socket refresca tablero y comandas; no abrir un segundo `connectOrdersRealtime`.

## 6. Pruebas

- Cobertura (2026-11-20): se añadieron tests de controlador, DTO, mapper y ramas de error para subir la cobertura de Sonar; sin cambios de comportamiento.

| Suite | Archivo |
|---|---|
| Unit | `src/modules/realtime/orders.gateway.spec.ts` |
| e2e | `test/realtime.e2e-spec.ts` (Socket.io real, aislamiento A/B) |
| Web | `lib/realtime.test.ts`, `app/api/session/ws-ticket/route.test.ts` |

## 7. Deuda conocida

- **Sin Redis adapter**: los rooms viven en memoria del proceso; con más de una instancia hace falta `@socket.io/redis-adapter`.
- Los eventos se emiten después de escribir: si se pierde el mensaje, el cliente lo recupera con la siguiente lectura HTTP.
- El contrato se ejecuta con type stripping de Node 24; el barrel de contratos no se usa en la API.

## 8. Trazabilidad

- Jira: AYCDS-14, AYCDS-30 (evento `order.sla`).
- PRs: #13, #22, #62.
- Docs: [websockets](../../docs/websockets.md).

## 9. Próximos pasos

1. Redis adapter antes de escalar la API horizontalmente.
2. Métricas de conexiones/reconexiones si se opera en producción.
