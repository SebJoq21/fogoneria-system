/* Cliente de BI de la API (AYCDS-45).

   Los rangos son obligatorios (máx. 366 días) y la fecha se maneja en día de
   Lima: el servidor ya devuelve los importes agregados y redondeados. */

import { apiFetch } from "./api";

export type ApiPnl = {
  desde: string;
  hasta: string;
  sucursalId: string | null;
  ventas: number;
  comprobado: number;
  ventaSinComprobante: number;
  gastos: number;
  margen: number;
  propinas: number;
};

export type ApiPnlDay = { fecha: string; ventas: number; gastos: number; margen: number };

export type ApiTopDish = {
  platoId: string;
  sku: string | null;
  nombre: string;
  unidades: number;
  ingresos: number;
};

export type ApiSalesMethod = { metodo: string; cobros: number; monto: number };

export type Rango = { desde: string; hasta: string; sucursalId?: string };

function query(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (typeof valor === "string" && valor !== "") q.set(clave, valor);
    if (typeof valor === "number") q.set(clave, String(valor));
  }
  const texto = q.toString();
  return texto ? `?${texto}` : "";
}

export async function getPnl(rango: Rango, signal?: AbortSignal): Promise<ApiPnl> {
  return apiFetch<ApiPnl>(`/bi/pnl${query(rango)}`, { signal });
}

export async function getPnlDaily(
  rango: Rango,
  signal?: AbortSignal,
): Promise<{ items: ApiPnlDay[] }> {
  return apiFetch<{ items: ApiPnlDay[] }>(`/bi/pnl/daily${query(rango)}`, { signal });
}

export async function getTopDishes(
  rango: Rango & { limit?: number },
  signal?: AbortSignal,
): Promise<{ items: ApiTopDish[] }> {
  return apiFetch<{ items: ApiTopDish[] }>(`/bi/top-dishes${query(rango)}`, { signal });
}

export async function getSalesByMethod(
  rango: Rango,
  signal?: AbortSignal,
): Promise<{ items: ApiSalesMethod[] }> {
  return apiFetch<{ items: ApiSalesMethod[] }>(`/bi/sales-by-method${query(rango)}`, { signal });
}

/** Día de Lima en `YYYY-MM-DD`. */
export function diaLima(now: Date = new Date()): string {
  const lima = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  return lima.toISOString().slice(0, 10);
}

/** Rango de los últimos `dias` días (incluye hoy), en día de Lima. */
export function ultimosDias(dias: number, now: Date = new Date()): { desde: string; hasta: string } {
  const hasta = diaLima(now);
  const fin = new Date(`${hasta}T00:00:00.000Z`);
  const inicio = new Date(fin.getTime() - (dias - 1) * 86_400_000);
  return { desde: inicio.toISOString().slice(0, 10), hasta };
}

/** Etiqueta corta del día (`Lun`, `Mar`…) para el gráfico. */
export function diaCorto(fecha: string): string {
  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const date = new Date(`${fecha}T00:00:00.000Z`);
  return dias[date.getUTCDay()] ?? fecha;
}
