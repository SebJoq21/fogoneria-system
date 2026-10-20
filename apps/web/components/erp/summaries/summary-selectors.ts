import type {
  CashMovement,
  Coupon,
  Customer,
  Expense,
  Ingredient,
  Order,
  Receipt,
  StockMovement,
  Table,
} from "@/lib/erp";
import type { Combo, PriceList, Product, ProductCategory } from "@/lib/erp-catalog";
import type { SummaryKpi } from "./ModuleSummary";

export const parseMoney = (v: string): number => Number(String(v).replace(/[$,\s]/g, "")) || 0;
export const fmtMoney = (v: number): string => `$${v.toFixed(2)}`;

/* ---------- Mesas ---------- */
export function mesasSummary(tables: Table[]): { kpis: SummaryKpi[]; donut: { name: string; v: number }[] } {
  const libre = tables.filter((t) => t.status === "libre").length;
  const ocupada = tables.filter((t) => t.status === "ocupada").length;
  const reservada = tables.filter((t) => t.status === "reservada").length;
  const occ = tables.length === 0 ? 0 : Math.round((ocupada / tables.length) * 100);
  return {
    kpis: [
      { label: "Mesas totales", value: String(tables.length), hint: `${tables.reduce((s, t) => s + t.seats, 0)} asientos` },
      { label: "Ocupación", value: `${occ}%`, hint: `${ocupada} en servicio` },
      { label: "Libres", value: String(libre), hint: "disponibles ahora" },
      { label: "Reservadas", value: String(reservada), hint: "siguiente turno" },
    ],
    donut: [
      { name: "Libres", v: libre },
      { name: "Ocupadas", v: ocupada },
      { name: "Reservadas", v: reservada },
    ],
  };
}

/* ---------- Órdenes / Cocina / Mozo ---------- */
export function ordenesSummary(orders: Order[]): { kpis: SummaryKpi[]; bars: { name: string; v: number }[] } {
  const live = orders.filter((o) => o.status !== "anulado");
  const pendiente = live.filter((o) => o.status === "pendiente").length;
  const cocina = live.filter((o) => o.status === "cocina").length;
  const listo = live.filter((o) => o.status === "listo").length;
  const entregado = live.filter((o) => o.status === "entregado").length;
  const total = live.reduce((s, o) => s + o.amount, 0);
  const ticket = live.length === 0 ? 0 : total / live.length;
  return {
    kpis: [
      { label: "Comandas activas", value: String(live.length), hint: `${pendiente} por confirmar` },
      { label: "Por confirmar", value: String(pendiente), hint: "esperan recepción" },
      { label: "En cocina", value: String(cocina), hint: "por preparar" },
      { label: "Ticket promedio", value: fmtMoney(ticket), hint: `${fmtMoney(total)} acumulado` },
    ],
    bars: [
      { name: "Por conf.", v: pendiente },
      { name: "Cocina", v: cocina },
      { name: "Listo", v: listo },
      { name: "Entregado", v: entregado },
    ],
  };
}

/* ---------- Caja ---------- */
export function cajaSummary(cash: CashMovement[]): {
  kpis: SummaryKpi[];
  byMethod: { name: string; v: number }[];
  ingresos: number;
  egresos: number;
} {
  const ingresos = cash.filter((m) => m.kind === "Ingreso").reduce((s, m) => s + m.amount, 0);
  const egresos = cash.filter((m) => m.kind === "Egreso").reduce((s, m) => s + m.amount, 0);
  const methods = [...new Set(cash.map((m) => m.method))];
  return {
    kpis: [
      { label: "Saldo del turno", value: fmtMoney(ingresos - egresos), hint: "ingresos menos egresos" },
      { label: "Ingresos", value: fmtMoney(ingresos), hint: `${cash.filter((m) => m.kind === "Ingreso").length} movimientos` },
      { label: "Egresos", value: fmtMoney(egresos), hint: `${cash.filter((m) => m.kind === "Egreso").length} movimientos` },
      { label: "Movimientos", value: String(cash.length), hint: "del turno" },
    ],
    byMethod: methods.map((m) => ({
      name: m,
      v: Math.round(cash.filter((x) => x.method === m && x.kind === "Ingreso").reduce((s, x) => s + x.amount, 0)),
    })),
    ingresos,
    egresos,
  };
}

/* ---------- Comprobantes ---------- */
export function comprobantesSummary(receipts: Receipt[]): { kpis: SummaryKpi[]; donut: { name: string; v: number }[] } {
  const pagadas = receipts.filter((r) => r.status === "Pagada");
  const anuladas = receipts.filter((r) => r.status === "Anulada");
  const total = pagadas.reduce((s, r) => s + r.total, 0);
  return {
    kpis: [
      { label: "Emitidos", value: String(receipts.length), hint: "series B001/F001/NC01" },
      { label: "Pagadas", value: String(pagadas.length), hint: fmtMoney(total) },
      { label: "Anuladas", value: String(anuladas.length), hint: anuladas.length === 0 ? "sin anulaciones" : "requieren revisión" },
      { label: "Total cobrado", value: fmtMoney(total), hint: "solo pagadas" },
    ],
    donut: [
      { name: "Pagadas", v: pagadas.length },
      { name: "Anuladas", v: anuladas.length },
    ],
  };
}

/* ---------- Inventario ---------- */
export function inventarioSummary(ingredients: Ingredient[]): { kpis: SummaryKpi[]; bars: { name: string; v: number }[] } {
  const optimo = ingredients.filter((i) => i.state === "Óptimo").length;
  const bajo = ingredients.filter((i) => i.state === "Bajo").length;
  const agotado = ingredients.filter((i) => i.state === "Agotado").length;
  return {
    kpis: [
      { label: "Insumos", value: String(ingredients.length), hint: "en maestro" },
      { label: "Óptimos", value: String(optimo), hint: "sobre mínimo" },
      { label: "Bajos", value: String(bajo), hint: "por reponer" },
      { label: "Agotados", value: String(agotado), hint: agotado > 0 ? "acción inmediata" : "sin quiebres" },
    ],
    bars: [
      { name: "Óptimo", v: optimo },
      { name: "Bajo", v: bajo },
      { name: "Agotado", v: agotado },
    ],
  };
}

export function kardexSummary(movs: StockMovement[]): { kpis: SummaryKpi[]; bars: { name: string; v: number }[] } {
  const e = movs.filter((m) => m.type === "Entrada").length;
  const s = movs.filter((m) => m.type === "Salida").length;
  const a = movs.filter((m) => m.type === "Ajuste").length;
  return {
    kpis: [
      { label: "Movimientos", value: String(movs.length), hint: "kardex" },
      { label: "Entradas", value: String(e), hint: "recepciones" },
      { label: "Salidas", value: String(s), hint: "ventas y consumo" },
      { label: "Ajustes", value: String(a), hint: "mermas y correcciones" },
    ],
    bars: [
      { name: "Entradas", v: e },
      { name: "Salidas", v: s },
      { name: "Ajustes", v: a },
    ],
  };
}

/* ---------- Combos / Promos ---------- */
export function combosSummary(combos: Combo[]): { kpis: SummaryKpi[]; bars: { name: string; v: number }[] } {
  const activos = combos.filter((c) => c.status === "Activo");
  const avg = activos.length === 0 ? 0 : activos.reduce((s, c) => s + c.price, 0) / activos.length;
  return {
    kpis: [
      { label: "Combos", value: String(combos.length), hint: `${activos.length} activos` },
      { label: "Precio prom.", value: fmtMoney(avg), hint: "precio fijo" },
      { label: "Activos", value: String(activos.length), hint: "a la venta" },
      { label: "Inactivos", value: String(combos.length - activos.length), hint: "pausados" },
    ],
    bars: activos.slice(0, 6).map((c) => ({ name: c.name.slice(0, 10), v: Math.round(c.price) })),
  };
}

export function promosSummary(coupons: Coupon[], scheduledActive: number): { kpis: SummaryKpi[]; bars: { name: string; v: number }[] } {
  const used = coupons.reduce((s, c) => s + c.used, 0);
  const cap = coupons.reduce((s, c) => s + c.limit, 0);
  return {
    kpis: [
      { label: "Cupones", value: String(coupons.length), hint: `${used}/${cap} usos` },
      { label: "Canjes", value: String(used), hint: "acumulados" },
      { label: "Programadas", value: String(scheduledActive), hint: "activas por horario" },
      { label: "Uso", value: cap === 0 ? "—" : `${Math.round((used / cap) * 100)}%`, hint: "del cupo total" },
    ],
    bars: coupons.slice(0, 6).map((c) => ({ name: c.code.slice(0, 8), v: c.used })),
  };
}

/* ---------- Carta / Productos ---------- */
export function cartaSummary(products: Product[], categories: ProductCategory[], priceOf: (id: number) => number): {
  kpis: SummaryKpi[];
  bars: { name: string; v: number }[];
} {
  const activos = products.filter((p) => p.status === "Activo");
  const avg = activos.length === 0 ? 0 : activos.reduce((s, p) => s + priceOf(p.id), 0) / activos.length;
  return {
    kpis: [
      { label: "Platos activos", value: String(activos.length), hint: `de ${products.length} en maestro` },
      { label: "Categorías", value: String(categories.length), hint: "en carta" },
      { label: "Precio prom.", value: fmtMoney(avg), hint: "lista activa" },
      { label: "Inactivos", value: String(products.length - activos.length), hint: "ocultos" },
    ],
    bars: categories.map((c) => ({ name: c.name.slice(0, 10), v: activos.filter((p) => p.categoryId === c.id).length })),
  };
}

export function priceListsSummary(lists: PriceList[], products: Product[]): { kpis: SummaryKpi[]; bars: { name: string; v: number }[] } {
  const active = lists.find((l) => l.active);
  const avg = (l: PriceList) => {
    const vals = products.map((p) => l.prices[p.id] ?? 0).filter((v) => v > 0);
    return vals.length === 0 ? 0 : vals.reduce((s, v) => s + v, 0) / vals.length;
  };
  return {
    kpis: [
      { label: "Listas", value: String(lists.length), hint: `activa: ${active?.name ?? "—"}` },
      { label: "Precio prom.", value: active ? fmtMoney(avg(active)) : "—", hint: active?.name ?? "" },
      { label: "Productos", value: String(products.length), hint: "con precio" },
      { label: "Vigencia", value: active?.validTo.slice(5) ?? "—", hint: active?.validFrom ?? "" },
    ],
    bars: lists.map((l) => ({ name: l.name.slice(0, 10), v: Math.round(avg(l)) })),
  };
}

/* ---------- Clientes / Reservas / Gastos ---------- */
export function clientesSummary(customers: Customer[]): { kpis: SummaryKpi[]; donut: { name: string; v: number }[] } {
  const vip = customers.filter((c) => c.segment === "VIP").length;
  const fre = customers.filter((c) => c.segment === "Frecuente").length;
  const points = customers.reduce((s, c) => s + c.points, 0);
  return {
    kpis: [
      { label: "Clientes", value: String(customers.length), hint: "registrados" },
      { label: "VIP", value: String(vip), hint: "alto valor" },
      { label: "Frecuentes", value: String(fre), hint: "recurrentes" },
      { label: "Puntos", value: points.toLocaleString("es-PE"), hint: "circulando" },
    ],
    donut: [
      { name: "VIP", v: vip },
      { name: "Frecuentes", v: fre },
      { name: "Nuevos", v: customers.length - vip - fre },
    ],
  };
}

export function gastosSummary(expenses: Expense[]): { kpis: SummaryKpi[]; bars: { name: string; v: number }[] } {
  const total = expenses.reduce((s, e) => s + parseMoney(e.amount), 0);
  const pagado = expenses.filter((e) => e.status === "Pagado").reduce((s, e) => s + parseMoney(e.amount), 0);
  const byCat: Record<string, number> = {};
  expenses.forEach((e) => {
    byCat[e.category] = (byCat[e.category] ?? 0) + parseMoney(e.amount);
  });
  return {
    kpis: [
      { label: "Gastos", value: fmtMoney(total), hint: `${expenses.length} registros` },
      { label: "Pagado", value: fmtMoney(pagado), hint: "desembolsado" },
      { label: "Pendiente", value: fmtMoney(total - pagado), hint: "por pagar" },
      { label: "Categorías", value: String(Object.keys(byCat).length), hint: "activas" },
    ],
    bars: Object.entries(byCat).slice(0, 6).map(([name, v]) => ({ name: name.slice(0, 10), v: Math.round(v) })),
  };
}

/* ---------- Personal ---------- */
export function personalSummary(employees: { onShift: boolean }[], present: number, marks: number): {
  kpis: SummaryKpi[];
  bars: { name: string; v: number }[];
} {
  const on = employees.filter((e) => e.onShift).length;
  const rate = marks === 0 ? 0 : Math.round((present / marks) * 100);
  return {
    kpis: [
      { label: "Equipo", value: String(employees.length), hint: `${on} en turno` },
      { label: "En turno", value: `${on}/${employees.length}`, hint: "ahora mismo" },
      { label: "Asistencia", value: `${rate}%`, hint: "semanal" },
      { label: "Descanso", value: String(employees.length - on), hint: "fuera de turno" },
    ],
    bars: [
      { name: "En turno", v: on },
      { name: "Descanso", v: employees.length - on },
    ],
  };
}

/* ---------- Fidelización ---------- */
