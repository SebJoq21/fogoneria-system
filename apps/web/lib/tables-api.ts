/* Mesas reales de la sucursal (AYCDS-25).

   El mesero abre la cuenta contra una mesa de la API: `mesas.id` es UUID y es
   lo que viaja en `POST /orders` como `mesaId`. Los estados `OCUPADA` y
   `RESERVADA` los derivan las órdenes y las reservas, no el cliente. */

import { apiFetch } from "./api";

export type ApiTableState = "LIBRE" | "OCUPADA" | "RESERVADA" | "MANTENIMIENTO";

export type ApiTable = {
  id: string;
  numero: string;
  capacidad: number;
  zona: string | null;
  estado: ApiTableState;
  forma: string;
  sucursal_id: string;
};

export type ListTablesParams = {
  estado?: ApiTableState;
  zona?: string;
  sucursalId?: string;
  signal?: AbortSignal;
};

export async function listTables(params: ListTablesParams = {}): Promise<ApiTable[]> {
  const search = new URLSearchParams();
  if (params.estado) search.set("estado", params.estado);
  if (params.zona) search.set("zona", params.zona);
  if (params.sucursalId) search.set("sucursalId", params.sucursalId);
  const query = search.toString();
  return apiFetch<ApiTable[]>(`/tables${query ? `?${query}` : ""}`, { signal: params.signal });
}
