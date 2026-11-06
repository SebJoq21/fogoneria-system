"use client";

/* Hook del tablero del KDS (AYCDS-41).
   Lee `GET /orders/board` (una sola llamada con columnas, SLA y métricas) y
   expone `refresh` para que la vista lo dispare con los eventos en vivo.
   Sin sesión no llama a la API: la vista cae al estado local del demo.

   No se guarda un `loading` aparte: mientras no hay tablero ni error, la vista
   muestra "Cargando comandas…". Los refrescos por evento son silenciosos, que
   es lo que se quiere en una pantalla siempre encendida. */

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { kdsBoardFromApi, type KdsBoard } from "@/lib/order-mapping";
import { getOrdersBoard } from "@/lib/orders-api";

export type OrdersBoardState = {
  board: KdsBoard | null;
  loading: boolean;
  error: string | null;
  refresh: (signal?: AbortSignal) => Promise<void>;
};

export function useOrdersBoard(enabled: boolean): OrdersBoardState {
  const [board, setBoard] = useState<KdsBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Descarta respuestas viejas si se disparan dos refrescos seguidos. */
  const requestId = useRef(0);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!enabled) return;
      const id = requestId.current + 1;
      requestId.current = id;

      try {
        const payload = await getOrdersBoard({ signal });
        if (id !== requestId.current) return;
        setBoard(kdsBoardFromApi(payload));
        setError(null);
      } catch (cause) {
        if (signal?.aborted || id !== requestId.current) return;
        setError(
          cause instanceof ApiError
            ? cause.message
            : "No se pudo cargar el tablero del KDS.",
        );
      }
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    // El primer fetch arranca en el siguiente tick: así el efecto no dispara
    // un render en cascada (regla `react-hooks/set-state-in-effect`).
    const timer = setTimeout(() => {
      void refresh(controller.signal);
    }, 0);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [enabled, refresh]);

  return {
    board: enabled ? board : null,
    loading: enabled && board === null && error === null,
    error: enabled ? error : null,
    refresh,
  };
}
