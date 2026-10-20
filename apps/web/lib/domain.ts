/* Dominio de la operación del restaurante (Fase 0+1).
   Cuentas por mesa, turnos de caja, pagos y comprobantes.
   Solo tipos y cálculos puros: nada de UI ni React aquí. */

import type { CashMovement, Reservation, Table, TableStatus } from "./erp";

export const IGV_RATE = 0.18;

export const PAYMENT_METHODS = [
  "Efectivo",
  "Yape",
  "Plin",
  "Tarjeta",
  "Transferencia",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/* ---------- Cuenta de mesa ---------- */

export type AccountItemModifier = {
  optionId: string;
  name: string;
  extra: number;
};

export type AccountItem = {
  id: string;
  productId: string;
  name: string;
  qty: number;
  /** Precio unitario base (lista activa), sin extras de modificadores. */
  unitPrice: number;
  modifiers: AccountItemModifier[];
  notes: string;
  /** true cuando ya se envió a cocina como comanda. */
  sent: boolean;
};

export type TableAccountStatus = "abierta" | "cobrada" | "anulada";

export type Payment = {
  method: PaymentMethod;
  amount: number;
  tip: number;
  at: string;
};

export type TableAccount = {
  id: string;
  branchId: string;
  tableId: number | null;
  /** "Mesa 4" o "Para llevar" */
  label: string;
  customer: string;
  waiter: string;
  openedAt: string;
  closedAt: string | null;
  status: TableAccountStatus;
  items: AccountItem[];
  payments: Payment[];
  tip: number;
  discount: number;
  discountConcept: string;
  couponCode: string | null;
  customerId: number | null;
  motivoAnulacion: string | null;
};

/* ---------- Turno de caja ---------- */

export type CashShiftStatus = "abierto" | "cerrado";

export type CashShift = {
  id: string;
  branchId: string;
  status: CashShiftStatus;
  openedBy: string;
  openedAt: string;
  openingFund: number;
  closedBy: string | null;
  closedAt: string | null;
  countedCash: number | null;
  expectedCash: number | null;
  difference: number | null;
  observations: string;
};

/* ---------- Cálculos ---------- */

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function fmtMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** "Hoy 13:42" · "Ayer 20:10" · "5 Oct 09:15" */
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfThat = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfToday - startOfThat) / 86400000);
  if (days === 0) return `Hoy ${time}`;
  if (days === 1) return `Ayer ${time}`;
  return `${d.toLocaleDateString("es-PE", { day: "numeric", month: "short" })} ${time}`;
}

export function elapsedLabel(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "ahora mismo";
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.floor(mins / 60);
  return `hace ${h} h ${mins % 60} min`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function itemLineTotal(item: AccountItem): number {
  const extras = item.modifiers.reduce((s, m) => s + m.extra, 0);
  return round2((item.unitPrice + extras) * item.qty);
}

export function accountTotals(account: TableAccount): {
  subtotal: number;
  discount: number;
  total: number;
  tip: number;
} {
  const subtotal = round2(account.items.reduce((s, i) => s + itemLineTotal(i), 0));
  const discount = round2(Math.min(Math.max(0, account.discount), subtotal));
  return { subtotal, discount, total: round2(subtotal - discount), tip: account.tip };
}

/** Los precios de carta en Perú incluyen IGV; se desglosa hacia atrás. */
export function splitIgv(total: number): { subtotal: number; igv: number } {
  const subtotal = round2(total / (1 + IGV_RATE));
  return { subtotal, igv: round2(total - subtotal) };
}

/** "10% OFF" → porcentaje; "$5.00 Descuento" → monto fijo. */
export function parseCouponDiscount(
  coupon: { discount: string },
  base: number,
): number {
  const pct = coupon.discount.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct) return round2((base * Number(pct[1])) / 100);
  const fixed = coupon.discount.match(/\$\s*(\d+(?:\.\d+)?)/);
  if (fixed) return round2(Math.min(Number(fixed[1]), base));
  return 0;
}

export const SERIE_LABEL: Record<string, string> = { "01": "F001", "03": "B001", "07": "NC01" };

/** Siguiente número de comprobante de una serie (correlativo atómico por lista). */
export function nextReceiptNumber(
  receipts: { id: string }[],
  type: "01" | "03" | "07",
): string {
  const serie = SERIE_LABEL[type] ?? "B001";
  const max = receipts
    .filter((r) => r.id.startsWith(`${serie}-`))
    .reduce((m, r) => Math.max(m, Number(r.id.split("-")[1]) || 0), 0);
  return `${serie}-${max + 1}`;
}

/** Efectivo esperado en caja: fondo + ingresos en efectivo − egresos en efectivo. */
export function expectedCashFor(
  shift: Pick<CashShift, "id" | "openedAt" | "openingFund">,
  movements: CashMovement[],
): number {
  const inShift = movements.filter(
    (m) => m.shiftId === shift.id || (!m.shiftId && m.at >= shift.openedAt),
  );
  const ingresos = inShift
    .filter((m) => m.kind === "Ingreso" && m.method === "Efectivo")
    .reduce((s, m) => s + m.amount, 0);
  const egresos = inShift
    .filter((m) => m.kind === "Egreso" && m.method === "Efectivo")
    .reduce((s, m) => s + m.amount, 0);
  return round2(shift.openingFund + ingresos - egresos);
}

/**
 * Estado real de la mesa: ocupada si tiene cuenta abierta; reservada si hay
 * reserva confirmada de hoy o está bloqueada manualmente; libre en caso contrario.
 */
export function deriveTableStatus(
  table: Table,
  accounts: TableAccount[],
  reservations: Reservation[],
): TableStatus {
  if (accounts.some((a) => a.tableId === table.id && a.status === "abierta")) return "ocupada";
  const today = new Date().toISOString().slice(0, 10);
  const hasReserva = reservations.some(
    (r) =>
      r.tableId === table.id &&
      r.status === "confirmada" &&
      r.date.slice(0, 10) === today,
  );
  if (hasReserva || table.status === "reservada") return "reservada";
  return "libre";
}

/** Valida dígito verificador de RUC (11 dígitos, algoritmo SUNAT). */
export function isValidRuc(ruc: string): boolean {
  if (!/^\d{11}$/.test(ruc)) return false;
  const factors = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(ruc[i]) * factors[i];
  const rest = 11 - (sum % 11);
  const check = rest === 11 ? 0 : rest === 10 ? 1 : rest;
  return check === Number(ruc[10]);
}

export function isValidDni(dni: string): boolean {
  return /^\d{8}$/.test(dni);
}

let seqCounter = 0;

/** Id único local (mock): timestamp + secuencia corta. */
export function newId(prefix: string): string {
  seqCounter = (seqCounter + 1) % 1000;
  return `${prefix}-${Date.now().toString(36)}${seqCounter.toString(36)}`;
}
