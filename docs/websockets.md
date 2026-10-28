# WebSockets — comandas en vivo (AYCDS-14)

Sincronización mesero ↔ cocina sin refrescar. El transporte es **Socket.io**
(namespace `/orders`) sobre la misma API NestJS; el navegador **nunca** usa el
access token: pide un ticket efímero de 60 s.

## 1. Flujo de autenticación

```text
navegador ──► GET /api/session/ws-ticket        (BFF, cookie HttpOnly de sesión)
           ◄── { ticket, expiresIn: 60 }
navegador ──► io("/orders", { auth: { ticket } })  (handshake)
           ◄── connected   (room de tenant/sucursal)
```

1. `GET /api/session/ws-ticket` (BFF de Next) exige la cookie firmada
   `fogoneria.session`; sin ella responde **401** y no toca la API.
2. El BFF llama a `POST /api/v1/auth/ws-ticket` con el `Bearer` de la cookie
   HttpOnly `fogoneria.token` y devuelve **solo** `{ ticket, expiresIn }` con
   `Cache-Control: no-store`.
3. La API firma un JWT de **60 s** con `scope: 'ws'`, `sub`, `empresaId`,
   `sucursalId` y `rol`.
4. El gateway verifica firma, vigencia y `scope === 'ws'`; cualquier otra cosa
   emite `auth.error` y desconecta.

> **Por qué un ticket y no el access token:** el ticket no abre la API HTTP.
> `JwtStrategy` rechaza cualquier token con `scope`, así que un ticket filtrado
> no sirve para llamar endpoints y caduca en un minuto.

## 2. Rooms

| Room | Quién entra | Uso |
|---|---|---|
| `empresa:<empresaId>` | Roles **sin** sucursal (`ADMIN_GLOBAL`, `SUPERADMIN` si tuviera empresa) | Recibe toda la empresa |
| `empresa:<empresaId>:sucursal:<sucursalId>` | Roles operativos (`GERENTE_SUCURSAL`, `MESERO`, `CAJERO`, `COCINA`) | Solo su sucursal |
| `order:<ordenId>` | Quien haga `order:subscribe` de una comanda de su tenant | Detalle de una comanda |

Un operativo **no** entra al room de empresa: así cada evento llega una sola
vez. Toda emisión va a `[empresa, sucursal]` (+ `order:<id>` si aplica) con
`.to(a).to(b).emit()`, que es una unión y no duplica el mensaje.

Un cliente de otra empresa no puede recibir eventos ni adivinando el
`ordenId` (el servidor busca la comanda con el `empresa_id` del ticket).

## 3. Contrato de eventos

Todos los mensajes llevan el mismo sobre:

```ts
interface RealtimeEnvelope<T> {
  eventId: string;  // UUID por emisión: el cliente descarta duplicados
  at: string;       // ISO 8601 UTC del servidor
  data: T;
}
```

### `order.created`

Se emite al crear una comanda (`POST /orders`), después de escribir en la base.

```json
{
  "eventId": "3f0c…",
  "at": "2026-10-28T05:34:41.112Z",
  "data": {
    "ordenId": "…", "numeroOrden": "ORD-000042", "estado": "POR_CONFIRMAR",
    "origen": "MESA", "sucursalId": "…", "mesaId": "…",
    "total": 36, "creadaAt": "2026-10-28T05:34:41.100Z"
  }
}
```

### `order.updated`

Se emite en cada transición del KDS (`PATCH /orders/:id/status`).

```json
{
  "eventId": "…", "at": "…",
  "data": {
    "ordenId": "…", "numeroOrden": "ORD-000042",
    "de": "EN_COCINA", "a": "LISTO", "sucursalId": "…", "mesaId": "…"
  }
}
```

### `table.status`

Estado de mesa derivado: al ocuparla (`create`) y al liberarla al llegar a un
estado terminal.

```json
{
  "eventId": "…", "at": "…",
  "data": { "mesaId": "…", "numero": "Mesa 1", "de": "OCUPADA", "a": "LIBRE", "sucursalId": "…" }
}
```

### `auth.error`

Solo en el handshake, antes de desconectar:

| Mensaje | Motivo |
|---|---|
| `Falta el ticket de WebSocket` | `handshake.auth.ticket` ausente o no string |
| `El ticket expiró o no es válido` | Firma o vigencia inválida |
| `El ticket no sirve para WebSockets` | Es un access token HTTP (sin `scope: 'ws'`) |
| `El ticket no tiene empresa` | Sesión sin `empresaId` (alta de superadmin) |

## 4. Cliente (`apps/web/lib/realtime.ts`)

- `connectOrdersRealtime({ onOrderCreated, onOrderUpdated, onTableStatus, onStatus })`
  devuelve la función para cerrar el canal.
- **Reconexión propia** (Socket.io con `reconnection: false`) con backoff
  exponencial 1 s → 30 s + jitter. Cada intento pide un ticket nuevo, así que
  un corte de más de 60 s no deja credenciales vencidas.
- **Deduplicación** por `eventId` con ventana de 200 eventos
  (`createDeduper`), porque el servidor puede reentregar tras reconectar.
- Sin sesión (401 en el BFF) **no reintenta**: se queda `offline`.
- La URL del socket es `NEXT_PUBLIC_API_URL` sin el sufijo `/api/v1`;
  `NEXT_PUBLIC_REALTIME_URL` la sobrescribe si el socket vive en otro host.

Estados que consume la UI: `connecting`, `connected`, `reconnecting`, `offline`.

Hook: `components/erp/useOrdersRealtime.ts` — el KDS (`OrdersView`) muestra el
badge *En vivo / Reconectando… / Sin canal en vivo* y la última novedad.

## 5. Pruebas

| Suite | Qué cubre |
|---|---|
| `src/modules/realtime/orders.gateway.spec.ts` | Rooms por rol, rechazo de tickets (ausente, vencido, HTTP, sin empresa), `order:subscribe` (UUID, cross-empresa, cross-sucursal), sobre de los eventos |
| `src/modules/auth/auth.service.spec.ts` | `ws-ticket` de 60 s con `scope: 'ws'` y rechazo sin empresa |
| `test/realtime.e2e-spec.ts` | Socket.io real: handshake sin ticket, access token como ticket, evento solo a la sucursal del tenant, `ADMIN_GLOBAL` sin duplicados, A no recibe de B |
| `app/api/session/ws-ticket/route.test.ts` (web) | BFF: 401 sin sesión, Bearer de la cookie, 502 upstream, propagación de 401 |
| `lib/realtime.test.ts` (web) | Base URL y deduplicador |

## 6. Límites conocidos

- **Sin Redis adapter**: los rooms viven en memoria del proceso. Con más de una
  instancia de la API hace falta `@socket.io/redis-adapter` (queda fuera del
  sprint).
- El KDS sigue leyendo las comandas del estado local del ERP: los eventos ya
  llegan, pero pintar la comanda en la columna es AYCDS-25/26/28 (conectar la
  UI a la API).
- Los eventos se emiten **después** de escribir: si se pierde el mensaje, el
  cliente lo recupera con su siguiente lectura HTTP.
