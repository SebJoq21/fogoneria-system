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
  ApiBoardOrder,
  ApiOrder,
  ApiOrderDetail,
  ApiOrderOrigen,
  ApiOrdersBoard,
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

  const tableNum = order.mesas?.numero
    ? parseInt(order.mesas.numero.replace(/\D/g, ""), 10) || null
    : null;

  return {
    id: order.numero_orden,
    apiId: order.id,
    tableId: tableNum,
    mesaApiId: order.mesa_id ?? undefined,
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

/**
 * Reconcilia las cuentas locales con las comandas de la API (AYCDS-25).
 * Asegura que cualquier orden abierta en la API tenga una cuenta abierta
 * visible para meseros y cajeros, y que las órdenes cerradas marquen la cuenta
 * correspondiente como cerrada o anulada.
 */
export function reconcileAccounts(
  currentAccounts: TableAccount[],
  apiOrders: ApiOrder[],
  nameOf: (platoId: string | null, tipo: string) => string = (id, tipo) =>
    tipo === "COMBO" ? "Combo" : "Plato",
): TableAccount[] {
  const OPEN_API_STATES = ["POR_CONFIRMAR", "EN_COCINA", "LISTO", "ENTREGADO"];
  const TERMINAL_API_STATES = ["PAGADA", "CERRADA", "ANULADA"];

  const openOrders = apiOrders.filter((o) => OPEN_API_STATES.includes(o.estado));
  const terminalOrderIds = new Set(
    apiOrders.filter((o) => TERMINAL_API_STATES.includes(o.estado)).map((o) => o.id),
  );

  const matchedOrderIds = new Set<string>();

  // 1. Actualizar cuentas existentes
  const updatedAccounts = currentAccounts.map((acc) => {
    // Si la cuenta estaba abierta pero todas sus órdenes en la API ya terminaron
    if (
      acc.status === "abierta" &&
      acc.orderApiIds &&
      acc.orderApiIds.length > 0 &&
      acc.orderApiIds.every((id) => terminalOrderIds.has(id))
    ) {
      const allAnuladas = acc.orderApiIds.every((id) => {
        const ord = apiOrders.find((o) => o.id === id);
        return ord?.estado === "ANULADA";
      });
      return {
        ...acc,
        status: allAnuladas ? ("anulada" as const) : ("cobrada" as const),
        closedAt: acc.closedAt ?? new Date().toISOString(),
      };
    }

    if (acc.status !== "abierta") {
      return acc;
    }

    // Buscar si alguna orden abierta de la API corresponde a esta cuenta
    const matchingOrder = openOrders.find((o) => {
      if (acc.orderApiIds?.includes(o.id)) return true;
      if (o.mesa_id && acc.tableApiId && o.mesa_id === acc.tableApiId) return true;
      if (o.mesas?.numero && acc.tableId != null) {
        const num = parseInt(o.mesas.numero.replace(/\D/g, ""), 10);
        return num === acc.tableId;
      }
      return false;
    });

    if (matchingOrder) {
      matchedOrderIds.add(matchingOrder.id);
      const nextOrderIds = Array.from(
        new Set([...(acc.orderApiIds ?? []), matchingOrder.id]),
      );

      let nextItems = acc.items;
      if (nextItems.length === 0 && (matchingOrder.detalles_orden ?? []).length > 0) {
        nextItems = matchingOrder.detalles_orden.map((detail) => ({
          id: detail.id,
          productId: detail.plato_id ?? detail.combo_id ?? "",
          name: nameOf(detail.plato_id, detail.tipo),
          qty: detail.cantidad,
          unitPrice: Number(detail.precio_unitario),
          modifiers: (detail.detalles_orden_modificadores ?? []).map((m) => ({
            optionId: m.opcion_id,
            name: m.opcion_id,
            extra: Number(m.precio_extra ?? 0),
          })),
          notes: detail.notas ?? "",
          sent: true,
        }));
      } else {
        nextItems = nextItems.map((item) => ({ ...item, sent: true }));
      }

      return {
        ...acc,
        orderApiIds: nextOrderIds,
        tableApiId: acc.tableApiId ?? matchingOrder.mesa_id ?? null,
        items: nextItems,
        waiter: acc.waiter || matchingOrder.usuarios?.nombre || "Mesero",
      };
    }

    return acc;
  });

  // 2. Para órdenes abiertas en la API que aún no tienen cuenta en este cliente
  const newAccounts: TableAccount[] = [];
  for (const openOrder of openOrders) {
    if (matchedOrderIds.has(openOrder.id)) continue;

    const alreadyCovered = updatedAccounts.some((a) => {
      if (a.status !== "abierta") return false;
      if (a.orderApiIds?.includes(openOrder.id)) return true;
      if (openOrder.mesa_id && a.tableApiId === openOrder.mesa_id) return true;
      if (openOrder.mesas?.numero && a.tableId != null) {
        const num = parseInt(openOrder.mesas.numero.replace(/\D/g, ""), 10);
        return num === a.tableId;
      }
      return false;
    });

    if (!alreadyCovered) {
      const tableNum = openOrder.mesas?.numero
        ? parseInt(openOrder.mesas.numero.replace(/\D/g, ""), 10) || null
        : null;
      const label = openOrder.mesas?.numero
        ? (openOrder.mesas.numero.startsWith("Mesa") ? openOrder.mesas.numero : `Mesa ${openOrder.mesas.numero}`)
        : "Para llevar";

      const accItems: AccountItem[] = (openOrder.detalles_orden ?? []).map((detail) => ({
        id: detail.id,
        productId: detail.plato_id ?? detail.combo_id ?? "",
        name: nameOf(detail.plato_id, detail.tipo),
        qty: detail.cantidad,
        unitPrice: Number(detail.precio_unitario),
        modifiers: (detail.detalles_orden_modificadores ?? []).map((m) => ({
          optionId: m.opcion_id,
          name: m.opcion_id,
          extra: Number(m.precio_extra ?? 0),
        })),
        notes: detail.notas ?? "",
        sent: true,
      }));

      newAccounts.push({
        id: openOrder.mesa_id ? `CT-mesa-${openOrder.mesa_id}` : `CT-order-${openOrder.id}`,
        branchId: openOrder.sucursal_id,
        tableId: tableNum,
        tableApiId: openOrder.mesa_id ?? null,
        orderApiIds: [openOrder.id],
        label,
        customer: "Consumidor final",
        waiter: openOrder.usuarios?.nombre || "Mesero",
        openedAt: openOrder.created_at,
        closedAt: null,
        status: "abierta",
        items: accItems,
        payments: [],
        tip: 0,
        discount: Number(openOrder.descuento_cupon ?? 0),
        discountConcept: "",
        couponCode: null,
        customerId: null,
        motivoAnulacion: null,
      });
    }
  }

  return [...newAccounts, ...updatedAccounts];
}

/* -------------------------------------------------------------------------- */
/* Tablero del KDS (AYCDS-41)                                                 */
/* -------------------------------------------------------------------------- */

/** Columnas del tablero, en el mismo orden que devuelve la API. */
export const KDS_COLUMNS: { status: OrderStatus; label: string }[] = [
  { status: "pendiente", label: "Por confirmar" },
  { status: "cocina", label: "En cocina" },
  { status: "listo", label: "Listo" },
  { status: "entregado", label: "Entregado" },
];

export type KdsOrder = {
  /** Folio visible (`ORD-000123`). */
  id: string;
  apiId: string;
  status: OrderStatus;
  customer: string;
  channel: Order["channel"];
  waiter?: string;
  amount: number;
  items: number;
  createdAt: string;
  /** Base del reloj de SLA: confirmación o, si no la hay, ingreso. */
  slaBaseAt: string;
  alertaSla: boolean;
  excedidoPor: number | null;
  mesa: { id: string; numero: string } | null;
};

export type KdsColumn = {
  status: OrderStatus;
  label: string;
  orders: KdsOrder[];
};

export type KdsBoard = {
  columns: KdsColumn[];
  slaMinutos: number;
  truncado: boolean;
  generadoAt: string;
  metricas: {
    abiertas: number;
    fueraDeSla: number;
    promedioEsperaMin: number | null;
    promedioPreparacionMin: number | null;
  };
};

/** Minutos desde la base del SLA; se recalcula en la vista cada 30 s. */
export function minutosDeSla(baseAt: string, now: number = Date.now()): number {
  const base = new Date(baseAt).getTime();
  if (Number.isNaN(base)) return 0;
  return Math.max(0, Math.floor((now - base) / 60000));
}

/**
 * Urgencia de la comanda: el servidor marca `alertaSla` a los 20 min, la vista
 * adelanta el ámbar a los 10 para que la cocina lo vea venir.
 */
export function slaTone(
  minutos: number,
  alertaSla: boolean,
  slaMinutos: number,
): "neutral" | "warning" | "danger" {
  if (alertaSla || minutos > slaMinutos) return "danger";
  return minutos > 10 ? "warning" : "neutral";
}

export function kdsOrderFromApi(item: ApiBoardOrder): KdsOrder {
  const channel = channelFromOrigen(item.origen);
  return {
    id: item.numeroOrden,
    apiId: item.id,
    status: apiStatusToUi(item.estado),
    customer: item.mesa?.numero ? `Mesa ${item.mesa.numero}` : channel === "Llevar" ? "Para llevar" : channel,
    channel,
    ...(item.mesero ? { waiter: item.mesero } : {}),
    amount: Number(item.total ?? 0),
    items: item.items,
    createdAt: item.ingresoAt,
    slaBaseAt: item.confirmacionAt ?? item.ingresoAt,
    alertaSla: item.alertaSla,
    excedidoPor: item.excedidoPor,
    mesa: item.mesa,
  };
}

/** Traduce el tablero de la API a la forma que pinta el KDS. */
export function kdsBoardFromApi(board: ApiOrdersBoard): KdsBoard {
  const porEstado = new Map(board.columnas.map((columna) => [apiStatusToUi(columna.estado), columna]));

  return {
    columns: KDS_COLUMNS.map(({ status, label }) => ({
      status,
      label,
      orders: (porEstado.get(status)?.ordenes ?? []).map(kdsOrderFromApi),
    })),
    slaMinutos: board.slaMinutos,
    truncado: board.truncado,
    generadoAt: board.generadoAt,
    metricas: board.metricas,
  };
}