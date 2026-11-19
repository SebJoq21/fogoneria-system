/**
 * Cliente del módulo Inventario (semáforo y kardex).
 *
 * Habla con el BFF (`/api/backend`) a través del SDK compartido. La API ya
 * responde camelCase en `/inventory/stock` y `/inventory/movements`, así que
 * el contrato es casi la respuesta tal cual: aquí solo se normaliza el tipo y
 * se arma la fila que pinta la tabla.
 *
 * El maestro de insumos, los ajustes manuales y las recetas siguen en el estado
 * demo de `ModulesProvider` (AYCDS-24): este cliente cubre lo que la API ya
 * expone —semáforo y kardex— sin inventar endpoints.
 */

import { createClient, queryString } from '@fogoneria/sdk';
import {
  etiquetaTipoMovimiento,
  movimientoCantidadLabel,
  resumenStock,
  type EstadoStock,
  type EstadoStockSucursal,
  type FiltroMovimientos,
  type InsumoStock,
  type MovimientoInventario,
  type ResumenStock,
} from '@fogoneria/contracts/inventario';
import { fmtDateTime } from '@/lib/domain';
import type { StockMovement } from '@/lib/erp';

export const inventarioClient = createClient({ baseUrl: '/api/backend' });

export type ListarMovimientosParams = FiltroMovimientos & {
  signal?: AbortSignal;
};

export type KardexApi = {
  sucursalId: string | null;
  items: MovimientoInventario[];
};

export const inventarioApi = {
  async stock(
    params: { sucursalId?: string; estado?: EstadoStock; signal?: AbortSignal } = {},
  ): Promise<EstadoStockSucursal> {
    return inventarioClient.get<EstadoStockSucursal>(
      `/inventory/stock${queryString({
        sucursalId: params.sucursalId,
        estado: params.estado,
      })}`,
      { signal: params.signal },
    );
  },

  async movimientos(params: ListarMovimientosParams = {}): Promise<KardexApi> {
    return inventarioClient.get<KardexApi>(
      `/inventory/movements${queryString({
        sucursalId: params.sucursalId,
        insumoId: params.insumoId,
        tipo: params.tipo,
        desde: params.desde,
        hasta: params.hasta,
        limit: params.limit,
      })}`,
      { signal: params.signal },
    );
  },
};

/** Semáforo listo para pintar: usa el resumen del servidor o lo recalcula. */
export function semaforoDeStock(stock: {
  items: readonly Pick<InsumoStock, 'estado'>[];
  resumen?: ResumenStock;
}): ResumenStock {
  return stock.resumen ?? resumenStock(stock.items);
}

/**
 * Fila del kardex para la tabla. `MERMA` se muestra como `Ajuste`: para el
 * almacenero es una corrección de stock, no una venta.
 */
export function kardexRowFromApi(
  movimiento: MovimientoInventario,
  indice: number,
): StockMovement {
  const etiqueta = etiquetaTipoMovimiento(movimiento.tipo);
  return {
    id: indice + 1,
    datetime: fmtDateTime(movimiento.fecha),
    type: etiqueta === 'Merma' ? 'Ajuste' : etiqueta,
    ingredient: movimiento.insumo,
    qty: movimientoCantidadLabel(movimiento),
    reason:
      movimiento.motivo ??
      (movimiento.orden ? `Comanda ${movimiento.orden}` : 'Sin motivo'),
  };
}

export type { EstadoStock, InsumoStock, MovimientoInventario, ResumenStock };
