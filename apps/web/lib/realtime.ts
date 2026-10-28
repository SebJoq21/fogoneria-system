/* Cliente de eventos en vivo (AYCDS-14).

   El navegador no tiene el access token: pide un ticket de 60 s al BFF
   (`GET /api/session/ws-ticket`) y lo usa como `auth.ticket` del handshake.
   Al reconectar se pide un ticket nuevo, así que un corte largo no deja al
   cliente con un ticket vencido.

   El contrato de eventos está en `docs/websockets.md` y en
   `apps/api/src/modules/realtime/realtime.types.ts`. */

import { io, type Socket } from "socket.io-client";

export const REALTIME_NAMESPACE = "/orders";

export const REALTIME_EVENT = {
  orderCreated: "order.created",
  orderUpdated: "order.updated",
  tableStatus: "table.status",
  authError: "auth.error",
} as const;

export type RealtimeEventName =
  (typeof REALTIME_EVENT)[keyof typeof REALTIME_EVENT];

export interface RealtimeEnvelope<T> {
  eventId: string;
  at: string;
  data: T;
}

export interface OrderCreatedPayload {
  ordenId: string;
  numeroOrden: string;
  estado: string;
  origen: string;
  sucursalId: string;
  mesaId: string | null;
  total: number;
  creadaAt: string;
}

export interface OrderUpdatedPayload {
  ordenId: string;
  numeroOrden: string;
  de: string;
  a: string;
  sucursalId: string;
  mesaId: string | null;
}

export interface TableStatusPayload {
  mesaId: string;
  numero: string | null;
  de: string | null;
  a: string;
  sucursalId: string;
}

export type RealtimeStatus = "connecting" | "connected" | "reconnecting" | "offline";

export type OrdersRealtimeOptions = {
  onOrderCreated?: (event: RealtimeEnvelope<OrderCreatedPayload>) => void;
  onOrderUpdated?: (event: RealtimeEnvelope<OrderUpdatedPayload>) => void;
  onTableStatus?: (event: RealtimeEnvelope<TableStatusPayload>) => void;
  onStatus?: (status: RealtimeStatus) => void;
  /** Base de la API; por defecto `NEXT_PUBLIC_API_URL` sin el prefijo `/api/v1`. */
  apiUrl?: string;
};

const MAX_SEEN = 200;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

/** Descarta eventos repetidos cuando el servidor reentrega tras reconectar. */
export function createDeduper(limit = MAX_SEEN) {
  const seen: string[] = [];
  const set = new Set<string>();
  return (eventId: string): boolean => {
    if (!eventId) return true;
    if (set.has(eventId)) return false;
    set.add(eventId);
    seen.push(eventId);
    if (seen.length > limit) {
      const oldest = seen.shift();
      if (oldest) set.delete(oldest);
    }
    return true;
  };
}

/** `http://localhost:3001/api/v1` → `http://localhost:3001`. */
export function realtimeBaseUrl(apiUrl?: string): string {
  const raw =
    apiUrl ??
    process.env.NEXT_PUBLIC_REALTIME_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:3001/api/v1";
  const withoutPrefix = raw.replace(/\/api\/v\d+\/?$/, "");
  return withoutPrefix.replace(/\/$/, "");
}

/** Sin sesión válida no se reintenta: el usuario debe volver a entrar. */
export class RealtimeAuthError extends Error {}

async function fetchTicket(): Promise<string> {
  const response = await fetch("/api/session/ws-ticket", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (response.status === 401) {
    throw new RealtimeAuthError(
      "La sesión expiró: vuelve a iniciar sesión para ver el canal en vivo.",
    );
  }
  if (!response.ok) {
    throw new Error("No se pudo abrir el canal en vivo.");
  }
  const data = (await response.json()) as { ticket?: unknown };
  if (typeof data.ticket !== "string" || !data.ticket) {
    throw new Error("Respuesta inválida del canal en vivo.");
  }
  return data.ticket;
}

/**
 * Abre el canal `/orders` y devuelve la función para cerrarlo.
 *
 * Reconexión propia (no la de Socket.io) con backoff exponencial + jitter:
 * cada intento pide un ticket nuevo, así que un corte de más de 60 s no deja
 * al cliente con credenciales vencidas.
 */
export function connectOrdersRealtime(options: OrdersRealtimeOptions = {}): () => void {
  const base = realtimeBaseUrl(options.apiUrl);
  const isFresh = createDeduper();
  let socket: Socket | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let attempt = 0;

  const status = (next: RealtimeStatus) => options.onStatus?.(next);

  const schedule = () => {
    if (disposed) return;
    const delay = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
    const jitter = Math.round(delay * 0.2 * Math.random());
    attempt += 1;
    timer = setTimeout(() => {
      timer = null;
      void open();
    }, delay + jitter);
  };

  const open = async () => {
    if (disposed) return;
    status(attempt === 0 ? "connecting" : "reconnecting");

    let ticket: string;
    try {
      ticket = await fetchTicket();
    } catch (error) {
      if (error instanceof RealtimeAuthError) {
        // Sin sesión no tiene sentido reintentar: se queda offline.
        status("offline");
        return;
      }
      status("offline");
      schedule();
      return;
    }
    if (disposed) return;

    socket = io(`${base}${REALTIME_NAMESPACE}`, {
      auth: { ticket },
      transports: ["websocket", "polling"],
      reconnection: false,
      timeout: 10_000,
    });

    socket.on("connect", () => {
      attempt = 0;
      status("connected");
    });

    socket.on(REALTIME_EVENT.orderCreated, (event: RealtimeEnvelope<OrderCreatedPayload>) => {
      if (isFresh(event?.eventId)) options.onOrderCreated?.(event);
    });
    socket.on(REALTIME_EVENT.orderUpdated, (event: RealtimeEnvelope<OrderUpdatedPayload>) => {
      if (isFresh(event?.eventId)) options.onOrderUpdated?.(event);
    });
    socket.on(REALTIME_EVENT.tableStatus, (event: RealtimeEnvelope<TableStatusPayload>) => {
      if (isFresh(event?.eventId)) options.onTableStatus?.(event);
    });

    // El gateway rechaza y desconecta: no reintentar en bucle, pedir sesión.
    socket.on(REALTIME_EVENT.authError, () => {
      status("offline");
      socket?.close();
      socket = null;
    });

    socket.on("connect_error", () => {
      socket?.close();
      socket = null;
      status("offline");
      schedule();
    });

    socket.on("disconnect", (reason) => {
      socket = null;
      if (disposed) return;
      if (reason === "io client disconnect") return;
      status("reconnecting");
      schedule();
    });
  };

  void open();

  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    timer = null;
    if (socket) {
      socket.removeAllListeners();
      socket.close();
      socket = null;
    }
    status("offline");
  };
}
