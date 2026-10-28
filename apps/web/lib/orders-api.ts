/* Cliente de órdenes de la API (AYCDS-25).

   El navegador no tiene el access token: todo pasa por el BFF
   (`/api/backend/...`), que adjunta el Bearer de la cookie HttpOnly.
   El contrato vive en `apps/api/src/modules/orders/dto/**`.

   Ojo: el precio NO se envía. `CreateOrderDto` no acepta `precioUnitario` y
   el `ValidationPipe` global (`forbidNonWhitelisted`) responde 400 si viaja. */

import { apiFetch } from "./api";

export type ApiOrderStatus =
  | "POR_CONFIRMAR"
  | "EN_COCINA"
  | "LISTO"
  | "ENTREGADO"
  | "PAGADA"
  | "CERRADA"
  | "ANULADA";

export type ApiOrderItemType = "PLATO" | "COMBO";

export type ApiOrderOrigen = "MESA" | "BARRA" | "DELIVERY" | "MOSTRADOR" | "WEB";

/** Los `Decimal` de Prisma viajan como string en el JSON. */
export type DecimalLike = string | number;

export type ApiOrderDetail = {
  id: string;
  tipo: ApiOrderItemType;
  plato_id: string | null;
  combo_id: string | null;
  cantidad: number;
  precio_unitario: DecimalLike;
  subtotal: DecimalLike;
  notas: string | null;
  detalles_orden_modificadores?: { opcion_id: string; precio_extra: DecimalLike }[];
};

export type ApiOrder = {
  id: string;
  numero_orden: string;
  estado: ApiOrderStatus;
  origen: ApiOrderOrigen | string;
  empresa_id: string;
  sucursal_id: string;
  mesa_id: string | null;
  mesero_id: string | null;
  subtotal: DecimalLike;
  descuento_cupon: DecimalLike;
  total: DecimalLike;
  created_at: string;
  confirmacion_at: string | null;
  listo_at: string | null;
  entrega_at: string | null;
  detalles_orden: ApiOrderDetail[];
  mesas?: { id: string; numero: string; zona: string | null } | null;
  usuarios?: { id: string; nombre: string } | null;
};

export type ApiOrderList = {
  items: ApiOrder[];
  total: number;
  page?: number;
  limit?: number;
};

export type ListOrdersParams = {
  estado?: ApiOrderStatus;
  sucursalId?: string;
  mesaId?: string;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
};

export type CreateOrderItemInput = {
  tipo: ApiOrderItemType;
  platoId?: string;
  comboId?: string;
  cantidad: number;
  notas?: string;
};

export type CreateOrderInput = {
  /** Solo `ADMIN_GLOBAL` para una orden sin mesa. */
  sucursalId?: string;
  mesaId?: string;
  clienteId?: string;
  origen?: ApiOrderOrigen;
  listaPrecioId?: string;
  descuento?: number;
  items: CreateOrderItemInput[];
};

function queryOf(params: ListOrdersParams): string {
  const search = new URLSearchParams();
  if (params.estado) search.set("estado", params.estado);
  if (params.sucursalId) search.set("sucursalId", params.sucursalId);
  if (params.mesaId) search.set("mesaId", params.mesaId);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function listOrders(params: ListOrdersParams = {}): Promise<ApiOrderList> {
  return apiFetch<ApiOrderList>(`/orders${queryOf(params)}`, { signal: params.signal });
}

export async function getOrder(id: string, signal?: AbortSignal): Promise<ApiOrder> {
  return apiFetch<ApiOrder>(`/orders/${id}`, { signal });
}

export async function createOrder(input: CreateOrderInput): Promise<ApiOrder> {
  return apiFetch<ApiOrder>("/orders", {
    method: "POST",
    body: {
      ...(input.sucursalId ? { sucursalId: input.sucursalId } : {}),
      ...(input.mesaId ? { mesaId: input.mesaId } : {}),
      ...(input.clienteId ? { clienteId: input.clienteId } : {}),
      ...(input.origen ? { origen: input.origen } : {}),
      ...(input.listaPrecioId ? { listaPrecioId: input.listaPrecioId } : {}),
      ...(input.descuento ? { descuento: input.descuento } : {}),
      items: input.items,
    },
  });
}

export async function updateOrderStatus(
  id: string,
  estado: ApiOrderStatus,
): Promise<ApiOrder> {
  return apiFetch<ApiOrder>(`/orders/${id}/status`, {
    method: "PATCH",
    body: { estado },
  });
}
