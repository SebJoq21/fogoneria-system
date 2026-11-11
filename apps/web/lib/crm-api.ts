/* Cliente del CRM de la API (AYCDS-40).

   El segmento lo calcula el servidor a partir de las visitas (no se edita a
   mano) y los puntos se mueven con ajustes auditados. La web solo traduce. */

import { apiFetch } from "./api";

export type ApiSegmento = "NUEVO" | "FRECUENTE" | "VIP";
export type ApiPointsType = "GANANCIA" | "CANJE" | "CADUCIDAD";

export type ApiCustomer = {
  id: string;
  nombre: string;
  telefono: string;
  segmento: ApiSegmento;
  visitas: number;
  puntos: number;
  ultima_visita: string | null;
  created_at: string;
};

export type ApiPointsMovement = {
  id: string;
  tipo: ApiPointsType;
  puntos: number;
  motivo: string | null;
  created_at: string;
  orden_id: string | null;
};

export type ApiCustomerDetail = ApiCustomer & {
  movimientos_puntos: ApiPointsMovement[];
};

export type ApiCustomerList = {
  items: ApiCustomer[];
  total: number;
  page: number;
  limit: number;
};

export type ListCustomersParams = {
  segmento?: ApiSegmento;
  q?: string;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
};

function query(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (typeof valor === "string" && valor !== "") q.set(clave, valor);
    if (typeof valor === "number") q.set(clave, String(valor));
  }
  const texto = q.toString();
  return texto ? `?${texto}` : "";
}

export async function listCustomers(params: ListCustomersParams = {}): Promise<ApiCustomerList> {
  return apiFetch<ApiCustomerList>(`/crm/customers${query(params)}`, {
    signal: params.signal,
  });
}

export async function getCustomer(id: string, signal?: AbortSignal): Promise<ApiCustomerDetail> {
  return apiFetch<ApiCustomerDetail>(`/crm/customers/${id}`, { signal });
}

export async function createCustomer(input: {
  nombre: string;
  telefono: string;
}): Promise<ApiCustomer> {
  return apiFetch<ApiCustomer>("/crm/customers", { method: "POST", body: input });
}

export async function adjustPoints(
  id: string,
  input: { tipo: ApiPointsType; puntos: number; motivo?: string; sucursalId?: string },
): Promise<ApiCustomer> {
  // La API devuelve el cliente recalculado (saldo nuevo), no el movimiento.
  return apiFetch<ApiCustomer>(`/crm/customers/${id}/points`, {
    method: "POST",
    body: input,
  });
}

/** Etiqueta del segmento que usa el ERP. */
export function segmentLabel(segmento: ApiSegmento): "Nuevo" | "Frecuente" | "VIP" {
  switch (segmento) {
    case "VIP":
      return "VIP";
    case "FRECUENTE":
      return "Frecuente";
    default:
      return "Nuevo";
  }
}

/** Fecha corta (`dd/mm/aaaa`) para "última visita"; `—` si nunca vino. */
export function lastVisitLabel(fecha: string | null): string {
  if (!fecha) return "—";
  const dia = fecha.slice(0, 10);
  const [anio, mes, diaMes] = dia.split("-");
  return `${diaMes}/${mes}/${anio}`;
}
