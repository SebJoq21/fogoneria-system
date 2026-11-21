'use client';

/**
 * Hooks del tablero de órdenes.
 *
 * El refresco genérico vive en `@/lib/orders-board` (solo depende del contrato);
 * aquí se inyecta el cliente del módulo. El canal en vivo es el compartido de
 * `@/lib/orders-realtime`: un solo socket por pantalla.
 */

import { useCallback } from 'react';
import { useOrdersBoard, type OrdersBoardState } from '@/lib/orders-board';
import { useOrdersRealtime } from '@/lib/orders-realtime';
import type { TableroParams } from './api';
import { ordenesApi } from './api';

export function useTableroOrdenes(
  enabled: boolean,
  params: Omit<TableroParams, 'signal'> = {},
): OrdersBoardState {
  const { sucursalId, dias, limite } = params;
  const fetchBoard = useCallback(
    (signal?: AbortSignal) => ordenesApi.getTablero({ sucursalId, dias, limite, signal }),
    [sucursalId, dias, limite],
  );
  return useOrdersBoard(enabled, fetchBoard);
}

export { useOrdersRealtime };
export type { LiveEventKind, LiveOrderEvent } from '@/lib/orders-realtime';
