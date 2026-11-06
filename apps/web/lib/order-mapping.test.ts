import { describe, expect, it } from "vitest";
import {
  apiStatusToUi,
  canSendAccount,
  channelFromOrigen,
  notesOfItem,
  orderFromApi,
  orderItemsFromAccount,
  reconcileAccounts,
  kdsBoardFromApi,
  minutosDeSla,
  slaTone,
} from "./order-mapping";
import type { ApiOrder, ApiOrdersBoard } from "./orders-api";
import type { AccountItem, TableAccount } from "./domain";

const orden: ApiOrder = {
  id: "11111111-1111-4111-8111-111111111111",
  numero_orden: "ORD-000123",
  estado: "EN_COCINA",
  origen: "MESA",
  empresa_id: "22222222-2222-4222-8222-222222222222",
  sucursal_id: "33333333-3333-4333-8333-333333333333",
  mesa_id: "44444444-4444-4444-8444-444444444444",
  mesero_id: "55555555-5555-4555-8555-555555555555",
  subtotal: "24.90",
  descuento_cupon: "0.00",
  total: "24.90",
  created_at: "2026-10-28T18:30:00.000Z",
  confirmacion_at: "2026-10-28T18:31:00.000Z",
  listo_at: null,
  entrega_at: null,
  detalles_orden: [
    {
      id: "66666666-6666-4666-8666-666666666666",
      tipo: "PLATO",
      plato_id: "77777777-7777-4777-8777-777777777777",
      combo_id: null,
      cantidad: 2,
      precio_unitario: "12.45",
      subtotal: "24.90",
      notas: "Sin cebolla",
    },
    {
      id: "88888888-8888-4888-8888-888888888888",
      tipo: "COMBO",
      plato_id: null,
      combo_id: "99999999-9999-4999-8999-999999999999",
      cantidad: 1,
      precio_unitario: "0.00",
      subtotal: "0.00",
      notas: null,
      detalles_orden_modificadores: [
        { opcion_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", precio_extra: "0.00" },
      ],
    },
  ],
  mesas: { id: "44444444-4444-4444-8444-444444444444", numero: "4", zona: "Salón" },
  usuarios: { id: "55555555-5555-4555-8555-555555555555", nombre: "Ana Beltrán" },
};

function accountWith(items: AccountItem[]): TableAccount {
  return {
    id: "CT-1",
    branchId: "sucursal-1",
    tableId: null,
    tableApiId: "44444444-4444-4444-8444-444444444444",
    label: "Mesa 4",
    customer: "",
    waiter: "Ana Beltrán",
    openedAt: "2026-10-28T18:00:00.000Z",
    closedAt: null,
    status: "abierta",
    items,
    payments: [],
    tip: 0,
    discount: 0,
    discountConcept: "",
    couponCode: null,
    customerId: null,
    motivoAnulacion: null,
  };
}

function item(overrides: Partial<AccountItem> = {}): AccountItem {
  return {
    id: "AI-1",
    productId: "77777777-7777-4777-8777-777777777777",
    name: "Lomo Saltado",
    qty: 2,
    unitPrice: 12.45,
    modifiers: [],
    notes: "",
    sent: false,
    ...overrides,
  };
}

describe("apiStatusToUi", () => {
  it("traduce los 7 estados de la API a los de la UI", () => {
    expect(apiStatusToUi("POR_CONFIRMAR")).toBe("pendiente");
    expect(apiStatusToUi("EN_COCINA")).toBe("cocina");
    expect(apiStatusToUi("LISTO")).toBe("listo");
    expect(apiStatusToUi("ENTREGADO")).toBe("entregado");
    expect(apiStatusToUi("PAGADA")).toBe("entregado");
    expect(apiStatusToUi("CERRADA")).toBe("entregado");
    expect(apiStatusToUi("ANULADA")).toBe("anulado");
  });

  it("cae en pendiente con un estado desconocido", () => {
    expect(apiStatusToUi("LO_QUE_SEA")).toBe("pendiente");
  });
});

describe("channelFromOrigen", () => {
  it("mapea el origen de la orden al canal de la UI", () => {
    expect(channelFromOrigen("MESA")).toBe("Mesa");
    expect(channelFromOrigen("BARRA")).toBe("Llevar");
    expect(channelFromOrigen("MOSTRADOR")).toBe("Llevar");
    expect(channelFromOrigen("DELIVERY")).toBe("Web");
    expect(channelFromOrigen("WEB")).toBe("Web");
  });
});

describe("orderFromApi", () => {
  it("usa el folio como id visible y guarda el uuid en apiId", () => {
    const mapped = orderFromApi(orden, { nameOf: () => "Lomo Saltado" });

    expect(mapped.id).toBe("ORD-000123");
    expect(mapped.apiId).toBe(orden.id);
    expect(mapped.status).toBe("cocina");
    expect(mapped.amount).toBe(24.9);
    expect(mapped.customer).toBe("Mesa 4");
    expect(mapped.waiter).toBe("Ana Beltrán");
    expect(mapped.channel).toBe("Mesa");
    expect(mapped.createdAt).toBe(orden.created_at);
  });

  it("resuelve el nombre del plato con el catálogo y conserva las notas", () => {
    const mapped = orderFromApi(orden, {
      nameOf: (platoId, tipo) => (tipo === "COMBO" ? "Combo Parrillero" : `Plato ${platoId}`),
    });

    expect(mapped.items[0].name).toBe("Plato 77777777-7777-4777-8777-777777777777");
    expect(mapped.items[0].qty).toBe(2);
    expect(mapped.items[0].notes).toBe("Sin cebolla");
    expect(mapped.items[1].name).toBe("Combo Parrillero");
  });

  it("muestra 'Para llevar' en una orden de barra sin mesa", () => {
    const mapped = orderFromApi({ ...orden, mesas: null, origen: "BARRA" });
    expect(mapped.customer).toBe("Para llevar");
    expect(mapped.channel).toBe("Llevar");
  });
});

describe("notesOfItem", () => {
  it("junta modificadores y nota libre en el único campo de texto del DTO", () => {
    const notas = notesOfItem(
      item({
        modifiers: [
          { optionId: "o1", name: "Sin ají", extra: 0 },
          { optionId: "o2", name: "Bien cocido", extra: 0 },
        ],
        notes: "Para compartir",
      }),
    );
    expect(notas).toBe("Sin ají, Bien cocido · Para compartir");
  });

  it("devuelve undefined cuando no hay nada que enviar", () => {
    expect(notesOfItem(item())).toBeUndefined();
  });

  it("recorta a 500 caracteres (límite de OrderItemDto.notas)", () => {
    const notas = notesOfItem(item({ notes: "x".repeat(700) }));
    expect(notas?.length).toBe(500);
  });
});

describe("orderItemsFromAccount", () => {
  it("solo envía las líneas pendientes y nunca el precio", () => {
    const account = accountWith([
      item({ id: "AI-1" }),
      item({ id: "AI-2", sent: true, productId: "88888888-8888-4888-8888-888888888888" }),
    ]);

    const lines = orderItemsFromAccount(account);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({
      tipo: "PLATO",
      platoId: "77777777-7777-4777-8777-777777777777",
      cantidad: 2,
    });
    expect(lines[0]).not.toHaveProperty("precioUnitario");
    expect(lines[0]).not.toHaveProperty("unitPrice");
  });

  it("manda los modificadores como nota", () => {
    const account = accountWith([
      item({ modifiers: [{ optionId: "o1", name: "Sin cebolla", extra: 0 }] }),
    ]);
    expect(orderItemsFromAccount(account)[0].notas).toBe("Sin cebolla");
  });
});

describe("canSendAccount", () => {
  it("exige cuenta abierta y al menos una línea pendiente", () => {
    expect(canSendAccount(accountWith([]))).toBe(false);
    expect(canSendAccount(accountWith([item({ sent: true })]))).toBe(false);
    expect(canSendAccount(accountWith([item()]))).toBe(true);
    expect(canSendAccount({ ...accountWith([item()]), status: "anulada" })).toBe(false);
  });
});

describe("reconcileAccounts", () => {
  it("crea una cuenta abierta si la API tiene una comanda abierta sin cuenta local", () => {
    const result = reconcileAccounts([], [orden]);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("abierta");
    expect(result[0].tableId).toBe(4);
    expect(result[0].label).toBe("Mesa 4");
    expect(result[0].items).toHaveLength(2);
    expect(result[0].items[0].sent).toBe(true);
  });

  it("mantiene abierta la cuenta local existente y vincula la orden creada", () => {
    const local = accountWith([item({ sent: false })]);
    local.tableApiId = orden.mesa_id;
    local.tableId = 4;
    const result = reconcileAccounts([local], [orden]);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("abierta");
    expect(result[0].orderApiIds).toContain(orden.id);
    expect(result[0].items[0].sent).toBe(true);
  });

  it("marca cobrada una cuenta abierta si su orden pasó a PAGADA", () => {
    const pagada: ApiOrder = { ...orden, estado: "PAGADA" };
    const local = { ...accountWith([item({ sent: true })]), orderApiIds: [pagada.id] };
    const result = reconcileAccounts([local], [pagada]);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("cobrada");
  });
});

const tableroApi: ApiOrdersBoard = {
  generadoAt: "2026-11-06T12:00:00.000Z",
  slaMinutos: 20,
  ventanaDias: 7,
  limite: 200,
  truncado: false,
  columnas: [
    {
      estado: "POR_CONFIRMAR" as const,
      total: 1,
      ordenes: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          numeroOrden: "ORD-000123",
          estado: "POR_CONFIRMAR" as const,
          origen: "MESA",
          sucursalId: "33333333-3333-4333-8333-333333333333",
          mesaId: "44444444-4444-4444-8444-444444444444",
          mesa: { id: "44444444-4444-4444-8444-444444444444", numero: "Mesa 4" },
          mesero: "Ana",
          total: 24.9,
          items: 2,
          ingresoAt: "2026-11-06T11:50:00.000Z",
          confirmacionAt: null,
          listoAt: null,
          minutos: 10,
          alertaSla: false,
          excedidoPor: null,
        },
      ],
    },
    { estado: "EN_COCINA" as const, total: 0, ordenes: [] },
    { estado: "LISTO" as const, total: 0, ordenes: [] },
    { estado: "ENTREGADO" as const, total: 0, ordenes: [] },
  ],
  metricas: { abiertas: 1, fueraDeSla: 0, promedioEsperaMin: 4, promedioPreparacionMin: 9 },
};

describe("tablero del KDS (AYCDS-41)", () => {
  it("traduce las columnas en el orden del KDS", () => {
    const board = kdsBoardFromApi(tableroApi);

    expect(board.columns.map((columna) => columna.status)).toEqual([
      "pendiente",
      "cocina",
      "listo",
      "entregado",
    ]);
    expect(board.slaMinutos).toBe(20);
    expect(board.metricas.abiertas).toBe(1);
  });

  it("usa la confirmación como base del SLA y cae al ingreso", () => {
    const board = kdsBoardFromApi(tableroApi);
    const [comanda] = board.columns[0].orders;

    expect(comanda.slaBaseAt).toBe("2026-11-06T11:50:00.000Z");
    expect(comanda.customer).toBe("Mesa Mesa 4");
    expect(comanda.items).toBe(2);
    expect(comanda.waiter).toBe("Ana");
  });

  it("prefiere la confirmación cuando existe", () => {
    const conConfirmacion = structuredClone(tableroApi);
    conConfirmacion.columnas[0].ordenes[0].confirmacionAt = "2026-11-06T11:55:00.000Z";

    const [comanda] = kdsBoardFromApi(conConfirmacion).columns[0].orders;

    expect(comanda.slaBaseAt).toBe("2026-11-06T11:55:00.000Z");
  });

  it("calcula minutos y tono del SLA", () => {
    const base = "2026-11-06T12:00:00.000Z";
    const ahora = new Date("2026-11-06T12:11:00.000Z").getTime();

    expect(minutosDeSla(base, ahora)).toBe(11);
    expect(slaTone(9, false, 20)).toBe("neutral");
    expect(slaTone(11, false, 20)).toBe("warning");
    expect(slaTone(21, false, 20)).toBe("danger");
    expect(slaTone(5, true, 20)).toBe("danger");
  });

  it("no rompe con una fecha inválida", () => {
    expect(minutosDeSla("no-es-fecha")).toBe(0);
  });
});