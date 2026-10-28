/* Adaptador API ↔ UI de comandas (AYCDS-25).

   La API habla `POR_CONFIRMAR | EN_COCINA | LISTO | ENTREGADO | PAGADA |
   CERRADA | ANULADA` y numera con folio (`ORD-000123`). La UI del ERP usa
   `pendiente | cocina | listo | entregado | anulado` y una `id` visible.
   Este módulo es el único punto que conoce ambas formas: si el contrato de la
   API cambia, se ajusta aquí y no en las vistas.

   El importe lo resuelve el servidor (AYCDS-20): aquí solo se lee. */

import type { AccountItem, TableAccount } from "./domain";
import { elapsedLabel } from "./domain";
import type { Order, OrderItem, OrderStatus } from "./erp";
import type {
  ApiOrder,
  ApiOrderDetail,
  ApiOrderOrigen,
  CreateOrderItemInput,
} from "./orders-api";

/** Estados que el KDS/mesero pueden escribir desde la UI. */
export const UI_TO_API_STATUS: Partial<Record<OrderStatus, "EN_COCINA" | "LISTO" | "ENTREGADO" | "ANULADA">> = {
  cocina: "EN_COCINA",
  listo: "LISTO",
  entregado: "ENTREGADO",
  anulado: "ANULADA",
};

export function apiStatusToUi(estado: string): OrderStatus {
  switch (estado) {
    case "EN_COCINA":
      return "cocina";
    case "LISTO":
      return "listo";
    case "ENTREGADO":
    case "PAGADA":
    case "CERRADA":
      return "entregado";
    case "ANULADA":
      return "anulado";
    case "POR_CONFIRMAR":
    default:
      return "pendiente";
  }
}

export function channelFromOrigen(origen: ApiOrderOrigen | string): Order["channel"] {
  switch (origen) {
    case "MESA":
      return "Mesa";
    case "BARRA":
    case "MOSTRADOR":
      return "Llevar";
    default:
      return "Web";
  }
}

/** `"13:42"` en hora de Lima, para la tarjeta de la comanda. */
export function timeOf(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Lima",
  });
}

function customerOf(order: ApiOrder): string {
  if (order.mesas?.numero) return `Mesa ${order.mesas.numero}`;
  const channel = channelFromOrigen(order.origen);
  return channel === "Llevar" ? "Para llevar" : channel;
}

function modifiersOf(detail: ApiOrderDetail): string[] {
  return (detail.detalles_orden_modificadores ?? []).map((modifier) => {
    const extra = Number(modifier.precio_extra ?? 0);
    return extra > 0 ? `+${extra.toFixed(2)}` : modifier.opcion_id;
  });
}

/**
 * Convierte una orden de la API a la forma que consumen `OrdersView` (KDS),
 * `MozoView` y los resúmenes del dashboard.
 *
 * `nameOf` resuelve el nombre del plato con el catálogo del tenant, porque
 * `detalles_orden` solo trae `plato_id`.
 */
export function orderFromApi(
  order: ApiOrder,
  options: { nameOf?: (platoId: string | null, tipo: string) => string } = {},
): Order {
  const resolve = options.nameOf ?? ((platoId: string | null, tipo: string) =>
    tipo === "COMBO" ? "Combo" : "Plato");

  const items: OrderItem[] = (order.detalles_orden ?? []).map((detail) => ({
    productId: detail.plato_id ?? detail.combo_id ?? undefined,
    name: resolve(detail.plato_id, detail.tipo),
    qty: detail.cantidad,
    modifiers: modifiersOf(detail),
    ...(detail.notas ? { notes: detail.notas } : {}),
  }));

  return {
    id: order.numero_orden,
    apiId: order.id,
    tableId: null,
    customer: customerOf(order),
    items,
    amount: Number(order.total),
    time: timeOf(order.created_at),
    elapsed: elapsedLabel(order.created_at),
    createdAt: order.created_at,
    status: apiStatusToUi(order.estado),
    channel: channelFromOrigen(order.origen),
    ...(order.usuarios?.nombre ? { waiter: order.usuarios.nombre } : {}),
    ...(order.mesero_id ? { waiterId: order.mesero_id } : {}),
  };
}

/** Une modificadores y nota libre en el único campo de texto del DTO. */
export function notesOfItem(item: AccountItem): string | undefined {
  const partes = [item.modifiers.map((modifier) => modifier.name).join(", "), item.notes.trim()]
    .filter((parte) => parte.length > 0);
  if (partes.length === 0) return undefined;
  // `OrderItemDto.notas` está limitado a 500 caracteres en la API.
  return partes.join(" · ").slice(0, 500);
}

/**
 * Líneas que viajan al `POST /orders`.
 *
 * El DTO no acepta `precioUnitario` ni modificadores: el importe lo resuelve
 * el servidor y los modificadores van como texto en `notas`. El recargo de un
 * modificador (`extra > 0`) sigue cobrándose en Caja, que trabaja con la
 * cuenta local; el alta de líneas lo advierte al mesero.
 */
export function orderItemsFromAccount(account: TableAccount): CreateOrderItemInput[] {
  return account.items
    .filter((item) => !item.sent)
    .map((item) => {
      const notas = notesOfItem(item);
      return {
        tipo: "PLATO" as const,
        platoId: item.productId,
        cantidad: item.qty,
        ...(notas ? { notas } : {}),
      };
    });
}

/** La cuenta está lista para una comanda real. */
export function canSendAccount(account: TableAccount): boolean {
  return account.status === "abierta" && orderItemsFromAccount(account).length > 0;
}
