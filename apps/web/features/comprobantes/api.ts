/**
 * Cliente del módulo Comprobantes.
 *
 * Habla con el BFF (`/api/backend`) a través del SDK compartido. La API
 * responde snake_case; aquí se traduce al contrato
 * (`@fogoneria/contracts/comprobantes`).
 *
 * Lo que **no** se inventa es SUNAT: con API real el comprobante queda
 * «pendiente de OSE» (en cola, sin CDR) hasta que exista la integración.
 */

import { createClient, queryString } from '@fogoneria/sdk';
import {
  SUNAT_PENDIENTE_OSE,
  desgloseIgv,
  esEstadoComprobante,
  esTipoComprobante,
  type Comprobante,
  type DesgloseIgv,
  type EmisionComprobanteInput,
  type EstadoComprobante,
  type TipoComprobante,
} from '@fogoneria/contracts/comprobantes';
import { fmtDateTime } from '@/lib/domain';
import type { Receipt } from '@/lib/erp';

export const comprobantesClient = createClient({ baseUrl: '/api/backend' });

type DecimalLike = string | number;

/** Comprobante tal como lo devuelve la API (`snake_case`). */
export type ApiComprobante = {
  id: string;
  sucursal_id: string;
  tipo: string;
  serie_numero: string;
  orden_id: string;
  cliente_ref: string | null;
  total: DecimalLike;
  estado: string;
  emitido_por: string | null;
  anulado_por: string | null;
  anulado_at: string | null;
  motivo_anulacion: string | null;
  created_at: string;
  ordenes?: { id: string; numero_orden: string; total?: DecimalLike } | null;
};

export type ApiComprobanteList = {
  items: ApiComprobante[];
  total: number;
  page: number;
  limit: number;
};

export function toComprobante(raw: ApiComprobante): Comprobante {
  return {
    id: raw.id,
    sucursalId: raw.sucursal_id,
    tipo: esTipoComprobante(raw.tipo) ? raw.tipo : 'BOLETA',
    serieNumero: raw.serie_numero,
    ordenId: raw.orden_id,
    ordenNumero: raw.ordenes?.numero_orden ?? null,
    clienteRef: raw.cliente_ref,
    total: Number(raw.total ?? 0),
    estado: esEstadoComprobante(raw.estado) ? raw.estado : 'PAGADA',
    emitidoPor: raw.emitido_por,
    anuladoPor: raw.anulado_por,
    anuladoAt: raw.anulado_at,
    motivoAnulacion: raw.motivo_anulacion,
    createdAt: raw.created_at,
  };
}

export function comprobantesDesdeApi(items: ApiComprobante[]): Comprobante[] {
  return items.map(toComprobante);
}

/**
 * Comprobante de la API con la forma que pinta el ERP (`Receipt`).
 *
 * `estadoSunat` queda en `en_cola` con el mensaje «pendiente de OSE»: la API
 * todavía no expone el ciclo tributario y fingir un CDR daría una validez
 * fiscal falsa.
 */
export function comprobanteARecibo(comprobante: Comprobante): Receipt {
  const { base, igv } = desgloseIgv(comprobante.total);
  return {
    id: comprobante.serieNumero,
    type: comprobante.tipo === 'FACTURA' ? '01' : comprobante.tipo === 'NOTA_CREDITO' ? '07' : '03',
    at: comprobante.createdAt,
    date: fmtDateTime(comprobante.createdAt),
    customer: comprobante.clienteRef?.trim() || 'Consumidor final',
    // `cliente_ref` guarda el documento tal cual lo escribió el cajero.
    docType: '',
    docNumber: comprobante.clienteRef ?? '',
    subtotal: base,
    igv,
    total: comprobante.total,
    status: comprobante.estado === 'ANULADA' ? 'Anulada' : 'Emitida',
    source: comprobante.ordenNumero ?? comprobante.ordenId.slice(0, 8),
    motivoAnulacion: comprobante.motivoAnulacion ?? undefined,
    estadoSunat: 'en_cola',
    mensajeSunat: SUNAT_PENDIENTE_OSE,
    intentosEnvio: 0,
  };
}

export type ListarComprobantesParams = {
  fecha?: string;
  tipo?: TipoComprobante;
  estado?: EstadoComprobante;
  limit?: number;
  signal?: AbortSignal;
};

export const comprobantesApi = {
  async listar(params: ListarComprobantesParams = {}): Promise<Comprobante[]> {
    const raw = await comprobantesClient.get<ApiComprobanteList>(
      `/receipts${queryString({
        fecha: params.fecha,
        tipo: params.tipo,
        estado: params.estado,
        limit: params.limit,
      })}`,
      { signal: params.signal },
    );
    return comprobantesDesdeApi(raw.items ?? []);
  },

  /** Solo sobre una comanda `PAGADA`; el importe lo pone el servidor. */
  async emitir(
    input: EmisionComprobanteInput,
  ): Promise<{ comprobante: Comprobante; desglose: DesgloseIgv }> {
    const raw = await comprobantesClient.post<{
      comprobante: ApiComprobante;
      desglose: DesgloseIgv;
    }>('/receipts', {
      ordenId: input.ordenId,
      tipo: input.tipo,
      ...(input.clienteRef ? { clienteRef: input.clienteRef } : {}),
    });
    return { comprobante: toComprobante(raw.comprobante), desglose: raw.desglose };
  },

  /** La reversión de caja y stock la aplican los triggers de la base. */
  async anular(
    id: string,
    motivo: string,
  ): Promise<{ comprobante: Comprobante; desglose: DesgloseIgv }> {
    const raw = await comprobantesClient.post<{
      comprobante: ApiComprobante;
      desglose: DesgloseIgv;
    }>(`/receipts/${id}/void`, { motivo });
    return { comprobante: toComprobante(raw.comprobante), desglose: raw.desglose };
  },
};
