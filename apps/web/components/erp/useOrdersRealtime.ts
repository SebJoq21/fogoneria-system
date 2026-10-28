"use client";

/* Hook de eventos en vivo de comandas (AYCDS-14/25).
   Solo conecta con sesión real: en demo/sin API el canal queda `offline` y la
   pantalla sigue funcionando con el estado local.

   `onEvent` permite reconciliar datos (volver a leer la API) cuando llega una
   novedad; el hook lo guarda en un ref para no reabrir el socket en cada
   render. */

import { useEffect, useRef, useState } from "react";
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

/** Qué cambió: una comanda o una mesa. */
export type LiveEventKind = "order" | "table";

export function useOrdersRealtime(
  enabled: boolean,
  onEvent?: (kind: LiveEventKind) => void,
): {
  status: RealtimeStatus;
  lastEvent: LiveOrderEvent | null;
} {
  const [status, setStatus] = useState<RealtimeStatus>("offline");
  const [lastEvent, setLastEvent] = useState<LiveOrderEvent | null>(null);

  /** El callback no debe formar parte de las dependencias del efecto. */
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled) return;

    const stop = connectOrdersRealtime({
      onStatus: setStatus,
      onOrderCreated: (event) => {
        setLastEvent({
          id: event.data.ordenId,
          title: `Nueva comanda ${event.data.numeroOrden}`,
          detail: `${event.data.origen} · ${event.data.total.toFixed(2)}`,
          at: event.at,
        });
        onEventRef.current?.("order");
      },
      onOrderUpdated: (event) => {
        setLastEvent({
          id: event.data.ordenId,
          title: `${event.data.numeroOrden}: ${event.data.a}`,
          detail: `${event.data.de} → ${event.data.a}`,
          at: event.at,
        });
        onEventRef.current?.("order");
      },
      onTableStatus: (event) => {
        setLastEvent({
          id: event.data.mesaId,
          title: `Mesa ${event.data.numero ?? ""}`.trim(),
          detail: `${event.data.de ?? "—"} → ${event.data.a}`,
          at: event.at,
        });
        onEventRef.current?.("table");
      },
    });

    return stop;
  }, [enabled]);

  return {
    status: enabled ? status : "offline",
    lastEvent: enabled ? lastEvent : null,
  };
}
