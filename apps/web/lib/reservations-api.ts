/* Agenda de reservas de la API (AYCDS-26).
   Contrato: `apps/api/src/modules/reservations/dto/reservation.dto.ts`.
   El día se filtra en hora de Lima (`fecha=YYYY-MM-DD`), no por UTC. */

import { apiFetch } from "./api";

export type ApiReservationState =
  | "POR_CONFIRMAR"
  | "CONFIRMADA"
  | "EJECUTADA"
  | "CANCELADA"
  | "NO_SHOW";

export type ApiReservation = {
  id: string;
  codigo: string;
  empresa_id: string;
  sucursal_id: string;
  mesa_id: string;
  cliente_nombre: string;
  telefono: string | null;
  nro_comensales: number;
  fecha_hora: string;
  estado: ApiReservationState;
  canal: string | null;
  notas: string | null;
  creada_por: string | null;
  mesas?: { id: string; numero: string; zona: string | null } | null;
};

export type ApiReservationList = {
  items: ApiReservation[];
  total: number;
  page?: number;
  limit?: number;
};

export type ListReservationsParams = {
  /** Día completo en hora de Lima (`YYYY-MM-DD`). */
  fecha?: string;
  estado?: ApiReservationState;
  mesaId?: string;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
};

export type ReservationInput = {
  mesaId: string;
  clienteNombre: string;
  telefono?: string;
  nroComensales: number;
  /** ISO con offset de Lima, ej. `2026-10-29T20:00:00-05:00`. */
  fechaHora: string;
  canal?: string;
  notas?: string;
};

function queryOf(params: ListReservationsParams): string {
  const search = new URLSearchParams();
  if (params.fecha) search.set("fecha", params.fecha);
  if (params.estado) search.set("estado", params.estado);
  if (params.mesaId) search.set("mesaId", params.mesaId);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function listReservations(
  params: ListReservationsParams = {},
): Promise<ApiReservationList> {
  return apiFetch<ApiReservationList>(`/reservations${queryOf(params)}`, {
    signal: params.signal,
  });
}

export async function createReservation(input: ReservationInput): Promise<ApiReservation> {
  return apiFetch<ApiReservation>("/reservations", {
    method: "POST",
    body: {
      mesaId: input.mesaId,
      clienteNombre: input.clienteNombre,
      ...(input.telefono ? { telefono: input.telefono } : {}),
      nroComensales: input.nroComensales,
      fechaHora: input.fechaHora,
      ...(input.canal ? { canal: input.canal } : {}),
      ...(input.notas ? { notas: input.notas } : {}),
    },
  });
}

export async function updateReservation(
  id: string,
  input: Partial<ReservationInput>,
): Promise<ApiReservation> {
  return apiFetch<ApiReservation>(`/reservations/${id}`, {
    method: "PATCH",
    body: {
      ...(input.mesaId ? { mesaId: input.mesaId } : {}),
      ...(input.clienteNombre ? { clienteNombre: input.clienteNombre } : {}),
      ...(input.telefono !== undefined ? { telefono: input.telefono } : {}),
      ...(input.nroComensales !== undefined ? { nroComensales: input.nroComensales } : {}),
      ...(input.fechaHora ? { fechaHora: input.fechaHora } : {}),
      ...(input.canal !== undefined ? { canal: input.canal } : {}),
      ...(input.notas !== undefined ? { notas: input.notas } : {}),
    },
  });
}

export async function updateReservationStatus(
  id: string,
  estado: ApiReservationState,
): Promise<ApiReservation> {
  return apiFetch<ApiReservation>(`/reservations/${id}/status`, {
    method: "PATCH",
    body: { estado },
  });
}
