/**
 * Cliente del módulo Gastos (cuentas por pagar y pago en caja).
 *
 * Habla con el BFF (`/api/backend`) a través del SDK compartido. La API
 * responde snake_case; aquí se traduce al contrato
 * (`@fogoneria/contracts/gastos`).
 *
 * Hoy `GastosPage` sigue en el estado demo de `ModulesProvider` (AYCDS-27):
 * este cliente deja listo el contrato para conectar la vista sin duplicar el
 * mapeo. Pagar en efectivo exige turno abierto en el servidor.
 */

import { createClient, queryString } from '@fogoneria/sdk';
import {
  esCategoriaGasto,
  esEstadoPago,
  type CategoriaGasto,
  type EstadoPago,
  type Gasto,
  type GastoInput,
  type PagoGastoInput,
} from '@fogoneria/contracts/gastos';

export const gastosClient = createClient({ baseUrl: '/api/backend' });

type DecimalLike = string | number;

/** Gasto tal como lo devuelve la API (`snake_case`). */
export type ApiGasto = {
  id: string;
  sucursal_id: string;
  concepto: string;
  monto: DecimalLike;
  categoria: string;
  estado_pago: string;
  pagado_en_caja: boolean;
  turno_id: string | null;
  proveedor_id: string | null;
  vencimiento: string | null;
  registrado_por: string | null;
  created_at: string;
  proveedores?: { id: string; nombre: string } | null;
};

export type ApiGastoList = {
  items: ApiGasto[];
  total: number;
  page: number;
  limit: number;
};

export type ResumenGastos = {
  porPagar: number;
  porPagarCantidad: number;
  vencido: number;
  vencidoCantidad: number;
  pagadoMes: number;
  pagadoMesCantidad: number;
};

export function toGasto(raw: ApiGasto): Gasto {
  return {
    id: raw.id,
    sucursalId: raw.sucursal_id,
    concepto: raw.concepto,
    monto: Number(raw.monto ?? 0),
    categoria: esCategoriaGasto(raw.categoria) ? raw.categoria : 'OTROS',
    estadoPago: esEstadoPago(raw.estado_pago) ? raw.estado_pago : 'PENDIENTE',
    pagadoEnCaja: raw.pagado_en_caja,
    turnoId: raw.turno_id,
    proveedorId: raw.proveedor_id,
    proveedor: raw.proveedores?.nombre ?? null,
    vencimiento: raw.vencimiento,
    registradoPor: raw.registrado_por,
    createdAt: raw.created_at,
  };
}

export type ListarGastosParams = {
  estadoPago?: EstadoPago;
  categoria?: CategoriaGasto;
  vencidos?: boolean;
  sucursalId?: string;
  limit?: number;
  signal?: AbortSignal;
};

export const gastosApi = {
  async listar(params: ListarGastosParams = {}): Promise<{ items: Gasto[]; total: number }> {
    const raw = await gastosClient.get<ApiGastoList>(
      `/expenses${queryString({
        estadoPago: params.estadoPago,
        categoria: params.categoria,
        vencidos: params.vencidos === undefined ? undefined : String(params.vencidos),
        sucursalId: params.sucursalId,
        limit: params.limit,
      })}`,
      { signal: params.signal },
    );
    return { items: raw.items.map(toGasto), total: raw.total };
  },

  async resumen(
    params: { sucursalId?: string; signal?: AbortSignal } = {},
  ): Promise<ResumenGastos> {
    return gastosClient.get<ResumenGastos>(
      `/expenses/summary${queryString({ sucursalId: params.sucursalId })}`,
      { signal: params.signal },
    );
  },

  async crear(input: GastoInput): Promise<Gasto> {
    const raw = await gastosClient.post<ApiGasto>('/expenses', {
      concepto: input.concepto,
      monto: input.monto,
      categoria: input.categoria,
      ...(input.sucursalId ? { sucursalId: input.sucursalId } : {}),
      ...(input.proveedorId ? { proveedorId: input.proveedorId } : {}),
      ...(input.vencimiento ? { vencimiento: input.vencimiento } : {}),
    });
    return toGasto(raw);
  },

  /** En efectivo el servidor exige turno abierto y deja el egreso en caja. */
  async pagar(id: string, input: PagoGastoInput): Promise<Gasto> {
    const raw = await gastosClient.post<ApiGasto>(`/expenses/${id}/pay`, {
      metodo: input.metodo,
    });
    return toGasto(raw);
  },
};
