/**
 * Cliente del módulo BI (AYCDS-35/45).
 *
 * Habla con el BFF (`/api/backend`) a través del SDK compartido. La API ya
 * devuelve los importes agregados y en camelCase, así que aquí no hay mapeo de
 * campos: solo se normaliza la forma de los reportes con lista (`items`).
 * El rango siempre viaja en día de Lima y el servidor resuelve la sucursal del
 * token (el `ADMIN_GLOBAL` puede pedir el agregado de la empresa).
 */

import { createClient, queryString } from '@fogoneria/sdk';
import { ultimosDias } from '@fogoneria/kernel';
import {
  DIAS_VISTA_BI,
  type CobroMetodo,
  type Pnl,
  type PnlDia,
  type PlatoTop,
  type RangoBi,
  type ReporteBi,
} from '@fogoneria/contracts/bi';

export const biClient = createClient({ baseUrl: '/api/backend' });

function rangoQuery(rango: RangoBi): string {
  return queryString({
    desde: rango.desde,
    hasta: rango.hasta,
    sucursalId: rango.sucursalId,
  });
}

/** Rango de la vista de analíticas: últimos `dias` días en hora de Lima. */
export function rangoVista(dias: number = DIAS_VISTA_BI, now: Date = new Date()): RangoBi {
  return ultimosDias(dias, now);
}

/** Lista de un reporte; una respuesta vacía o nula se lee como lista vacía. */
export function itemsDe<T>(reporte: ReporteBi<T> | null | undefined): T[] {
  return Array.isArray(reporte?.items) ? reporte.items : [];
}

export const biApi = {
  async pnl(rango: RangoBi, signal?: AbortSignal): Promise<Pnl> {
    return biClient.get<Pnl>(`/bi/pnl${rangoQuery(rango)}`, { signal });
  },

  async serie(rango: RangoBi, signal?: AbortSignal): Promise<PnlDia[]> {
    const reporte = await biClient.get<ReporteBi<PnlDia>>(
      `/bi/pnl/daily${rangoQuery(rango)}`,
      { signal },
    );
    return itemsDe(reporte);
  },

  async platosTop(
    rango: RangoBi & { limit?: number },
    signal?: AbortSignal,
  ): Promise<PlatoTop[]> {
    const reporte = await biClient.get<ReporteBi<PlatoTop>>(
      `/bi/top-dishes${queryString({
        desde: rango.desde,
        hasta: rango.hasta,
        sucursalId: rango.sucursalId,
        limit: rango.limit,
      })}`,
      { signal },
    );
    return itemsDe(reporte);
  },

  async cobrosPorMetodo(rango: RangoBi, signal?: AbortSignal): Promise<CobroMetodo[]> {
    const reporte = await biClient.get<ReporteBi<CobroMetodo>>(
      `/bi/sales-by-method${rangoQuery(rango)}`,
      { signal },
    );
    return itemsDe(reporte);
  },
};
