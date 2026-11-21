/**
 * Cliente del módulo Órdenes para el tablero del KDS.
 *
 * Solo lectura: `GET /orders/board` en una llamada (columnas, SLA y métricas).
 * Las mutaciones siguen en `ModulesProvider`, que es quien reconcilia cuentas y
 * comandas del ERP; escribir desde aquí dejaría dos fuentes de verdad.
 */

import { createClient, queryString } from '@fogoneria/sdk';
import type { TableroKds, TableroOrdenes } from '@fogoneria/contracts/orders';
import { kdsBoardFromApi } from '@/lib/order-mapping';

export const ordenesClient = createClient({ baseUrl: '/api/backend' });

export type TableroParams = {
  sucursalId?: string;
  /** Ventana de días de la API (≤30). */
  dias?: number;
  /** Tope de comandas por columna (≤500). */
  limite?: number;
  signal?: AbortSignal;
};

/** Traducción pura API → columnas del KDS (testeable sin red). */
export function tableroDesdeApi(payload: TableroOrdenes): TableroKds {
  return kdsBoardFromApi(payload);
}

export const ordenesApi = {
  /** Tablero del KDS ya traducido al modelo de columnas. */
  async getTablero(params: TableroParams = {}): Promise<TableroKds> {
    const payload = await ordenesClient.get<TableroOrdenes>(
      `/orders/board${queryString({
        sucursalId: params.sucursalId,
        dias: params.dias,
        limite: params.limite,
      })}`,
      { signal: params.signal },
    );
    return tableroDesdeApi(payload);
  },
};
