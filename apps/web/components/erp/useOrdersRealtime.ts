"use client";

/* Hook de eventos en vivo del KDS (AYCDS-14).
   Solo conecta con sesión real: en demo/sin API el canal queda `offline` y la
   pantalla sigue funcionando con el estado local. */

import { useEffect, useState } from "react";
import {
  connectOrdersRealtime,
  type RealtimeStatus,
} from "@/lib/realtime";

export type LiveOrderEvent = {
  id: string;
  title: string;
  detail: string;
  at: string;
};

export function useOrdersRealtime(enabled: boolean): {
  status: RealtimeStatus;
  lastEvent: LiveOrderEvent | null;
} {
  const [status, setStatus] = useState<RealtimeStatus>("offline");
  const [lastEvent, setLastEvent] = useState<LiveOrderEvent | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const stop = connectOrdersRealtime({
      onStatus: setStatus,
      onOrderCreated: (event) =>
        setLastEvent({
          id: event.data.ordenId,
          title: `Nueva comanda ${event.data.numeroOrden}`,
          detail: `${event.data.origen} · ${event.data.total.toFixed(2)}`,
          at: event.at,
        }),
      onOrderUpdated: (event) =>
        setLastEvent({
          id: event.data.ordenId,
          title: `${event.data.numeroOrden}: ${event.data.a}`,
          detail: `${event.data.de} → ${event.data.a}`,
          at: event.at,
        }),
      onTableStatus: (event) =>
        setLastEvent({
          id: event.data.mesaId,
          title: `Mesa ${event.data.numero ?? ""}`.trim(),
          detail: `${event.data.de ?? "—"} → ${event.data.a}`,
          at: event.at,
        }),
    });

    return stop;
  }, [enabled]);

  return {
    status: enabled ? status : "offline",
    lastEvent: enabled ? lastEvent : null,
  };
}
