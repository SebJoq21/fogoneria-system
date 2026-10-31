/* Mesas reales de la sucursal (AYCDS-25/26).

   `mesas.id` es UUID y es lo que viaja en `POST /orders` como `mesaId` y en
   `POST /reservations` como `mesaId`. Los estados `OCUPADA` y `RESERVADA` los
   derivan las órdenes y las reservas; el cliente solo puede fijar `LIBRE` y
   `MANTENIMIENTO` (bloqueo manual, AYCDS-26). */

import { apiFetch } from "./api";

export type ApiTableState = "LIBRE" | "OCUPADA" | "RESERVADA" | "MANTENIMIENTO";

export type ApiTableShape = "REDONDA" | "RECTANGULAR";

export type ApiTable = {
  id: string;
  numero: string;
  capacidad: number;
  zona: string | null;
  estado: ApiTableState;
  forma: ApiTableShape | string;
  sucursal_id: string;
};

export type ListTablesParams = {
  estado?: ApiTableState;
  zona?: string;
  sucursalId?: string;
  signal?: AbortSignal;
};

export type CreateTableInput = {
  numero: string;
  capacidad: number;
  zona?: string;
  forma?: ApiTableShape;
  /** Solo ADMIN_GLOBAL: los roles con sucursal la heredan del JWT. */
  sucursalId?: string;
};

export type UpdateTableInput = {
  numero?: string;
  capacidad?: number;
  zona?: string;
  forma?: ApiTableShape;
};

export async function listTables(params: ListTablesParams = {}): Promise<ApiTable[]> {
  const search = new URLSearchParams();
  if (params.estado) search.set("estado", params.estado);
  if (params.zona) search.set("zona", params.zona);
  if (params.sucursalId) search.set("sucursalId", params.sucursalId);
  const query = search.toString();
  return apiFetch<ApiTable[]>(`/tables${query ? `?${query}` : ""}`, { signal: params.signal });
}

export async function createTable(input: CreateTableInput): Promise<ApiTable> {
  return apiFetch<ApiTable>("/tables", {
    method: "POST",
    body: {
      numero: input.numero,
      capacidad: input.capacidad,
      ...(input.zona ? { zona: input.zona } : {}),
      ...(input.forma ? { forma: input.forma } : {}),
      ...(input.sucursalId ? { sucursalId: input.sucursalId } : {}),
    },
  });
}

export async function updateTable(id: string, input: UpdateTableInput): Promise<ApiTable> {
  return apiFetch<ApiTable>(`/tables/${id}`, {
    method: "PATCH",
    body: {
      ...(input.numero !== undefined ? { numero: input.numero } : {}),
      ...(input.capacidad !== undefined ? { capacidad: input.capacidad } : {}),
      ...(input.zona !== undefined ? { zona: input.zona } : {}),
      ...(input.forma !== undefined ? { forma: input.forma } : {}),
    },
  });
}

/** Bloqueo manual: `MANTENIMIENTO` bloquea y `LIBRE` vuelve a disponible. */
export async function updateTableStatus(
  id: string,
  estado: "LIBRE" | "MANTENIMIENTO",
): Promise<ApiTable> {
  return apiFetch<ApiTable>(`/tables/${id}/status`, {
    method: "PATCH",
    body: { estado },
  });
}

export async function deleteTable(id: string): Promise<ApiTable> {
  return apiFetch<ApiTable>(`/tables/${id}`, { method: "DELETE" });
}
