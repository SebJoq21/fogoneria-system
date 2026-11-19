/**
 * Cliente del módulo CRM (AYCDS-40).
 *
 * Habla con el BFF (`/api/backend`) a través del SDK compartido. La API
 * responde snake_case; aquí se traduce al contrato (`@fogoneria/contracts/crm`).
 * El segmento lo calcula el servidor a partir de las visitas: la web solo lo
 * pinta. Los puntos se mueven con ajustes auditados y el saldo lo recalcula la
 * API; este cliente nunca lo escribe a mano.
 */

import { createClient, queryString } from '@fogoneria/sdk';
import {
  esSegmentoCliente,
  esTipoMovimientoPuntos,
  type AjustePuntosInput,
  type Cliente,
  type ClienteDetalle,
  type ClienteInput,
  type ConfigLealtad,
  type MovimientoPuntos,
  type SegmentoCliente,
} from '@fogoneria/contracts/crm';

export const crmClient = createClient({ baseUrl: '/api/backend' });

type DecimalLike = string | number;

/** Cliente tal como lo devuelve la API (`snake_case`). */
export type ApiCliente = {
  id: string;
  nombre: string;
  telefono: string;
  segmento: string;
  visitas: number;
  puntos: number;
  ultima_visita: string | null;
  created_at: string;
};

export type ApiMovimientoPuntos = {
  id: string;
  tipo: string;
  puntos: number;
  motivo: string | null;
  created_at: string;
  orden_id: string | null;
};

export type ApiClienteDetalle = ApiCliente & {
  movimientos_puntos: ApiMovimientoPuntos[];
};

export type ApiClienteList = {
  items: ApiCliente[];
  total: number;
  page: number;
  limit: number;
};

export type ApiConfigLealtad = {
  puntos_por_moneda: DecimalLike;
  caducidad_meses: number;
  umbral_frecuente: number;
  umbral_vip: number;
};

export type ListaClientes = {
  items: Cliente[];
  total: number;
  page: number;
  limit: number;
};

export type ResultadoConsumos = {
  puntos: number;
  clientes: number;
};

export type ListarClientesParams = {
  q?: string;
  segmento?: SegmentoCliente;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
};

export function toCliente(raw: ApiCliente): Cliente {
  return {
    id: raw.id,
    nombre: raw.nombre,
    telefono: raw.telefono,
    segmento: esSegmentoCliente(raw.segmento) ? raw.segmento : 'NUEVO',
    visitas: Number(raw.visitas ?? 0),
    puntos: Number(raw.puntos ?? 0),
    ultimaVisita: raw.ultima_visita ?? null,
    createdAt: raw.created_at,
  };
}

export function toMovimientoPuntos(raw: ApiMovimientoPuntos): MovimientoPuntos {
  return {
    id: raw.id,
    tipo: esTipoMovimientoPuntos(raw.tipo) ? raw.tipo : 'GANANCIA',
    puntos: Number(raw.puntos ?? 0),
    motivo: raw.motivo,
    createdAt: raw.created_at,
    ordenId: raw.orden_id ?? null,
  };
}

export function toClienteDetalle(raw: ApiClienteDetalle): ClienteDetalle {
  return {
    ...toCliente(raw),
    movimientos: (raw.movimientos_puntos ?? []).map(toMovimientoPuntos),
  };
}

export function toConfigLealtad(raw: ApiConfigLealtad): ConfigLealtad {
  return {
    puntosPorMoneda: Number(raw.puntos_por_moneda ?? 0),
    caducidadMeses: Number(raw.caducidad_meses ?? 0),
    umbralFrecuente: Number(raw.umbral_frecuente ?? 0),
    umbralVip: Number(raw.umbral_vip ?? 0),
  };
}

export const crmApi = {
  async listar(params: ListarClientesParams = {}): Promise<ListaClientes> {
    const raw = await crmClient.get<ApiClienteList>(
      `/crm/customers${queryString({
        q: params.q,
        segmento: params.segmento,
        page: params.page,
        limit: params.limit,
      })}`,
      { signal: params.signal },
    );
    return {
      items: raw.items.map(toCliente),
      total: raw.total,
      page: raw.page,
      limit: raw.limit,
    };
  },

  async ficha(id: string, signal?: AbortSignal): Promise<ClienteDetalle> {
    const raw = await crmClient.get<ApiClienteDetalle>(`/crm/customers/${id}`, { signal });
    return toClienteDetalle(raw);
  },

  async crear(input: ClienteInput): Promise<Cliente> {
    const raw = await crmClient.post<ApiCliente>('/crm/customers', {
      nombre: input.nombre,
      telefono: input.telefono,
    });
    return toCliente(raw);
  },

  /** La API devuelve el cliente recalculado (saldo nuevo), no el movimiento. */
  async ajustarPuntos(id: string, input: AjustePuntosInput): Promise<Cliente> {
    const raw = await crmClient.post<ApiCliente>(`/crm/customers/${id}/points`, {
      tipo: input.tipo,
      puntos: input.puntos,
      ...(input.motivo ? { motivo: input.motivo } : {}),
      ...(input.sucursalId ? { sucursalId: input.sucursalId } : {}),
    });
    return toCliente(raw);
  },

  async config(signal?: AbortSignal): Promise<ConfigLealtad> {
    const raw = await crmClient.get<ApiConfigLealtad>('/crm/config', { signal });
    return toConfigLealtad(raw);
  },

  async actualizarConfig(input: Partial<ConfigLealtad>): Promise<ConfigLealtad> {
    const raw = await crmClient.patch<ApiConfigLealtad>('/crm/config', {
      ...(input.puntosPorMoneda !== undefined
        ? { puntosPorMoneda: input.puntosPorMoneda }
        : {}),
      ...(input.caducidadMeses !== undefined ? { caducidadMeses: input.caducidadMeses } : {}),
      ...(input.umbralFrecuente !== undefined
        ? { umbralFrecuente: input.umbralFrecuente }
        : {}),
      ...(input.umbralVip !== undefined ? { umbralVip: input.umbralVip } : {}),
    });
    return toConfigLealtad(raw);
  },

  /** Reprocesa consumos pendientes de puntos (el worker corre cada 5 min). */
  async procesarConsumos(): Promise<ResultadoConsumos> {
    return crmClient.post<ResultadoConsumos>('/crm/process', {});
  },
};
