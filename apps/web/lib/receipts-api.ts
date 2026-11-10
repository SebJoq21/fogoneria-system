/* Cliente de comprobantes de la API (AYCDS-46).

   El comprobante se emite **solo sobre una comanda PAGADA**: el cobro va por
   caja (`POST /cash/charges`). La anulación solo cambia el estado; la reversión
   de caja y stock la aplican los triggers de la base (AYCDS-39). */

import { apiFetch } from "./api";

export type ApiReceiptType = "BOLETA" | "FACTURA" | "TICKET";
export type ApiReceiptStatus = "PAGADA" | "ANULADA";
export type DecimalLike = string | number;

export type ApiReceipt = {
  id: string;
  empresa_id: string;
  sucursal_id: string;
  tipo: ApiReceiptType;
  serie_numero: string;
  orden_id: string;
  cliente_ref: string | null;
  total: DecimalLike;
  estado: ApiReceiptStatus;
  emitido_por: string | null;
  anulado_por: string | null;
  anulado_at: string | null;
  motivo_anulacion: string | null;
  created_at: string;
  ordenes?: { id: string; numero_orden: string; total?: DecimalLike } | null;
  usuarios_comprobantes_emitido_porTousuarios?: { id: string; nombre: string } | null;
  usuarios_comprobantes_anulado_porTousuarios?: { id: string; nombre: string } | null;
};

export type ApiIgv = { base: number; igv: number; total: number; tasa: number };

export type ApiReceiptList = {
  items: ApiReceipt[];
  total: number;
  page: number;
  limit: number;
};

export type ListReceiptsParams = {
  fecha?: string;
  tipo?: ApiReceiptType;
  estado?: ApiReceiptStatus;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
};

export async function listReceipts(params: ListReceiptsParams = {}): Promise<ApiReceiptList> {
  const search = new URLSearchParams();
  if (params.fecha) search.set("fecha", params.fecha);
  if (params.tipo) search.set("tipo", params.tipo);
  if (params.estado) search.set("estado", params.estado);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const query = search.toString();

  return apiFetch<ApiReceiptList>(`/receipts${query ? `?${query}` : ""}`, {
    signal: params.signal,
  });
}

export async function getReceipt(id: string, signal?: AbortSignal) {
  return apiFetch<{ comprobante: ApiReceipt; desglose: ApiIgv }>(`/receipts/${id}`, {
    signal,
  });
}

export async function createReceipt(input: {
  ordenId: string;
  tipo: ApiReceiptType;
  clienteRef?: string;
}): Promise<{ comprobante: ApiReceipt; desglose: ApiIgv }> {
  return apiFetch<{ comprobante: ApiReceipt; desglose: ApiIgv }>("/receipts", {
    method: "POST",
    body: {
      ordenId: input.ordenId,
      tipo: input.tipo,
      ...(input.clienteRef ? { clienteRef: input.clienteRef } : {}),
    },
  });
}

export async function voidReceipt(
  id: string,
  motivo: string,
): Promise<{ comprobante: ApiReceipt; desglose: ApiIgv }> {
  return apiFetch<{ comprobante: ApiReceipt; desglose: ApiIgv }>(`/receipts/${id}/void`, {
    method: "POST",
    body: { motivo },
  });
}

/** Etiqueta del tipo para la UI. */
export function receiptTypeLabel(tipo: ApiReceiptType): string {
  switch (tipo) {
    case "FACTURA":
      return "Factura";
    case "TICKET":
      return "Ticket";
    default:
      return "Boleta";
  }
}

/** Código SUNAT que usa la UI del ERP (`01`, `03`, `07`). */
export function receiptSunatCode(tipo: ApiReceiptType): "01" | "03" | "07" {
  if (tipo === "FACTURA") return "01";
  return "03";
}

/** `"2026-11-06"` en hora de Lima, para el filtro por día. */
export function fechaLima(now: Date = new Date()): string {
  const lima = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  return lima.toISOString().slice(0, 10);
}
