import {
  initialCashMovements,
  initialOrders,
  initialTables,
  isoToday,
  type CashMovement,
  type Order,
  type Table,
} from "./erp";
import type { CashShift, TableAccount } from "./domain";

/* Multitenant: una cuenta (RUC) administra N sucursales.
   Catálogo, clientes y maestros son de la empresa (compartidos);
   la operación (órdenes, mesas, caja) vive por sucursal. */

export type Branch = {
  id: string;
  name: string;
  short: string;
  address: string;
  phone: string;
  isMain: boolean;
  status: "Abierta" | "Cerrada";
};

export const company = {
  legalName: "Mi Restaurante S.A.C.",
  ruc: "20123456789",
};

export const initialBranches: Branch[] = [
  { id: "miraflores", name: "Miraflores · Matriz", short: "Miraflores", address: "Av. José Pardo 456, Miraflores", phone: "+51 987 654 321", isMain: true, status: "Abierta" },
  { id: "surco", name: "Surco", short: "Surco", address: "Av. Encalada 1420, Surco", phone: "+51 955 231 884", isMain: false, status: "Abierta" },
  { id: "san-isidro", name: "San Isidro", short: "San Isidro", address: "Av. Camino Real 390, San Isidro", phone: "+51 901 447 220", isMain: false, status: "Cerrada" },
];

export const GENERAL_BRANCH: Branch = {
  id: "todas",
  name: "Todas las sucursales",
  short: "General",
  address: "Vista consolidada · 3 locales",
  phone: "",
  isMain: false,
  status: "Abierta",
};

export const ALL_BRANCHES: Branch[] = [GENERAL_BRANCH, ...initialBranches];

export const BRANCH_IDS = initialBranches.map((b) => b.id);

export type BranchScope = {
  orders: Order[];
  tables: Table[];
  cash: CashMovement[];
};

const surcoOrders: Order[] = [
  { id: "#PD-2088", customer: "Mesa 2", items: [{ name: "Ají de Gallina", qty: 2 }], amount: 36.0, time: "13:40", elapsed: "hace 8 min", createdAt: isoToday("13:40"), status: "pendiente", channel: "Mesa" },
  { id: "#PD-2087", customer: "Rosa Paredes", items: [{ name: "Lomo Saltado", qty: 1 }, { name: "Chicha Morada", qty: 2 }], amount: 30.0, time: "13:22", elapsed: "hace 26 min", createdAt: isoToday("13:22"), status: "listo", channel: "Web" },
  { id: "#PD-2086", customer: "Mesa 5", items: [{ name: "Pisco Sour", qty: 2 }], amount: 20.0, time: "13:05", elapsed: "hace 43 min", createdAt: isoToday("13:05"), status: "entregado", channel: "Mesa" },
];

const sanIsidroOrders: Order[] = [
  { id: "#PD-3015", customer: "Mesa 1", items: [{ name: "Ceviche Clásico", qty: 1 }], amount: 15.0, time: "13:48", elapsed: "hace 2 min", createdAt: isoToday("13:48"), status: "pendiente", channel: "Mesa" },
  { id: "#PD-3014", customer: "Luis Vega", items: [{ name: "Tequeños de Lomo", qty: 1 }], amount: 8.0, time: "13:30", elapsed: "hace 20 min", createdAt: isoToday("13:30"), status: "entregado", channel: "Web" },
];

const surcoTables: Table[] = initialTables.map((t, i) => ({
  ...t,
  id: 10 + t.id,
  label: `Mesa ${t.id}`,
  zone: ["Salón", "Terraza", "Barra"][i % 3],
  status: "libre" as const,
}));

const sanIsidroTables: Table[] = initialTables.slice(0, 6).map((t) => ({
  ...t,
  id: 20 + t.id,
  zone: t.id % 2 === 0 ? "Salón" : "Terraza",
  status: "libre" as const,
}));

const surcoCash: CashMovement[] = [
  { id: 11, at: isoToday("13:50"), datetime: "Hoy 13:50", concept: "Venta mesa 2", kind: "Ingreso", amount: 36.0, method: "Efectivo" },
  { id: 12, at: isoToday("12:10"), datetime: "Hoy 12:10", concept: "Venta web #PD-2087", kind: "Ingreso", amount: 30.0, method: "Yape" },
  { id: 13, at: isoToday("09:00"), datetime: "Hoy 09:00", concept: "Fondo de apertura", kind: "Ingreso", amount: 150.0, method: "Efectivo" },
];

const sanIsidroCash: CashMovement[] = [
  { id: 21, at: isoToday("13:48"), datetime: "Hoy 13:48", concept: "Venta mesa 1", kind: "Ingreso", amount: 15.0, method: "Tarjeta" },
  { id: 22, at: isoToday("09:00"), datetime: "Hoy 09:00", concept: "Fondo de apertura", kind: "Ingreso", amount: 100.0, method: "Efectivo" },
];

export const initialScopes: Record<string, BranchScope> = {
  miraflores: { orders: initialOrders, tables: initialTables, cash: initialCashMovements },
  surco: { orders: surcoOrders, tables: surcoTables, cash: surcoCash },
  "san-isidro": { orders: sanIsidroOrders, tables: sanIsidroTables, cash: sanIsidroCash },
};

/** Turnos de caja abiertos de la demo (el fondo coincide con el movimiento seed). */
export const initialCashShifts: CashShift[] = [
  { id: "CH-miraflores-hoy", branchId: "miraflores", status: "abierto", openedBy: "Rosa Quispe", openedAt: isoToday("09:00"), openingFund: 200, closedBy: null, closedAt: null, countedCash: null, expectedCash: null, difference: null, observations: "" },
  { id: "CH-surco-hoy", branchId: "surco", status: "abierto", openedBy: "Turno Surco", openedAt: isoToday("09:00"), openingFund: 150, closedBy: null, closedAt: null, countedCash: null, expectedCash: null, difference: null, observations: "" },
  { id: "CH-san-isidro-hoy", branchId: "san-isidro", status: "abierto", openedBy: "Turno San Isidro", openedAt: isoToday("09:00"), openingFund: 100, closedBy: null, closedAt: null, countedCash: null, expectedCash: null, difference: null, observations: "" },
];

/** Cuenta abierta de demo: el mapa de mesas refleja la operación real. */
export const initialAccounts: TableAccount[] = [
  {
    id: "CT-demo-1",
    branchId: "miraflores",
    tableId: 2,
    label: "Mesa 2",
    customer: "Valeria Ríos",
    waiter: "Ana Beltrán",
    openedAt: isoToday("13:35"),
    closedAt: null,
    status: "abierta",
    items: [
      { id: "AI-demo-1", productId: 3, name: "Lomo Saltado", qty: 2, unitPrice: 22, modifiers: [{ optionId: "tam-grande", name: "Grande", extra: 4 }], notes: "", sent: true },
      { id: "AI-demo-2", productId: 6, name: "Chicha Morada", qty: 1, unitPrice: 4, modifiers: [], notes: "Sin azúcar", sent: false },
    ],
    payments: [],
    tip: 0,
    discount: 0,
    discountConcept: "",
    couponCode: null,
    customerId: null,
    motivoAnulacion: null,
  },
];
