/* Cliente de caja de la API (AYCDS-46).

   Todo pasa por el BFF: el navegador no tiene el access token. El contrato
   vive en `apps/api/src/modules/cash/dto/cash.dto.ts`.

   Reglas del dominio que conviene recordar:
   - `PAGADA` no se escribe desde órdenes: se cobra con `POST /cash/charges`.
   - Una sucursal tiene un solo turno `ABIERTO` (índice único en la base).
   - Los totales del turno los calcula el servidor desde los movimientos. */

import { apiFetch } from "./api";

export type ApiCashMethod = "EFECTIVO" | "TARJETA" | "YAPE" | "TRANSFERENCIA";
export type ApiMovementType = "INGRESO" | "EGRESO";
export type DecimalLike = string | number;

export type ApiShift = {
  id: string;
  empresa_id: string;
  sucursal_id: string;
  cajero_id: string | null;
  apertura_at: string;
  cierre_at: string | null;
  fondo_apertura: DecimalLike;
  ingresos_total: DecimalLike;
  egresos_total: DecimalLike;
  saldo: DecimalLike | null;
  efectivo_contado: DecimalLike | null;
  diferencia: DecimalLike | null;
  observaciones: string | null;
  estado: "ABIERTO" | "CERRADO";
  usuarios?: { id: string; nombre: string } | null;
};

export type ApiArqueo = {
  fondo: number;
  ingresos: number;
  egresos: number;
  ingresosEfectivo: number;
  egresosEfectivo: number;
  esperadoEfectivo: number;
  saldoSistema: number;
  movimientos: number;
  efectivoContado: number | null;
  diferencia: number | null;
};

export type ApiShiftState = { turno: ApiShift; arqueo: ApiArqueo } | null;

export type ApiCashMovement = {
  id: string;
  turno_id: string;
  tipo: ApiMovementType;
  concepto: string;
  monto: DecimalLike;
  metodo: ApiCashMethod;
  orden_id: string | null;
  gasto_id: string | null;
  created_at: string;
  usuarios?: { id: string; nombre: string } | null;
};

export type ApiCashMovementList = {
  items: ApiCashMovement[];
  total: number;
  page: number;
  limit: number;
  turnoId: string;
};

export type ApiChargeResult = {
  ordenId: string;
  numeroOrden: string;
  turnoId: string;
  cobrado: number;
  propina: number;
  total: number;
  pendiente: number;
  pagada: boolean;
};

export async function getCurrentShift(signal?: AbortSignal): Promise<ApiShiftState> {
  const state = await apiFetch<ApiShiftState>("/cash/shifts/current", { signal });
  return state?.turno ? state : null;
}

export async function openShift(fondoApertura: number): Promise<ApiShiftState> {
  return apiFetch<ApiShiftState>("/cash/shifts", {
    method: "POST",
    body: { fondoApertura },
  });
}

export async function closeShift(
  id: string,
  input: { efectivoContado: number; observaciones?: string },
): Promise<{ turno: ApiShift; arqueo: ApiArqueo }> {
  return apiFetch<{ turno: ApiShift; arqueo: ApiArqueo }>(
    `/cash/shifts/${id}/close`,
    {
      method: "PATCH",
      body: {
        efectivoContado: input.efectivoContado,
        ...(input.observaciones ? { observaciones: input.observaciones } : {}),
      },
    },
  );
}

export async function listShifts(params: {
  desde?: string;
  hasta?: string;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
} = {}): Promise<{ items: ApiShift[]; total: number }> {
  const search = new URLSearchParams();
  if (params.desde) search.set("desde", params.desde);
  if (params.hasta) search.set("hasta", params.hasta);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return apiFetch(`/cash/shifts${query ? `?${query}` : ""}`, { signal: params.signal });
}

export async function listMovements(
  params: { turnoId?: string; tipo?: ApiMovementType; signal?: AbortSignal } = {},
): Promise<ApiCashMovementList> {
  const search = new URLSearchParams();
  if (params.turnoId) search.set("turnoId", params.turnoId);
  if (params.tipo) search.set("tipo", params.tipo);
  const query = search.toString();
  return apiFetch<ApiCashMovementList>(`/cash/movements${query ? `?${query}` : ""}`, {
    signal: params.signal,
  });
}

export async function createMovement(input: {
  tipo: ApiMovementType;
  concepto: string;
  monto: number;
  metodo: ApiCashMethod;
}): Promise<ApiCashMovement> {
  return apiFetch<ApiCashMovement>("/cash/movements", {
    method: "POST",
    body: input,
  });
}

export async function chargeOrder(input: {
  ordenId: string;
  metodo: ApiCashMethod;
  monto?: number;
  propina?: number;
}): Promise<ApiChargeResult> {
  return apiFetch<ApiChargeResult>("/cash/charges", {
    method: "POST",
    body: {
      ordenId: input.ordenId,
      metodo: input.metodo,
      ...(input.monto !== undefined ? { monto: input.monto } : {}),
      ...(input.propina !== undefined ? { propina: input.propina } : {}),
    },
  });
}

/** Los métodos del dominio (`Efectivo`, `Yape`, …) al enum de la API. */
export function metodoFromUi(label: string): ApiCashMethod {
  switch (label.trim().toLowerCase()) {
    case "tarjeta":
      return "TARJETA";
    case "yape":
    case "plin":
      return "YAPE";
    case "transferencia":
      return "TRANSFERENCIA";
    default:
      return "EFECTIVO";
  }
}

/** Enum de la API a la etiqueta que usa la UI. */
export function metodoToUi(metodo: ApiCashMethod): string {
  switch (metodo) {
    case "TARJETA":
      return "Tarjeta";
    case "YAPE":
      return "Yape";
    case "TRANSFERENCIA":
      return "Transferencia";
    default:
      return "Efectivo";
  }
}

export function tipoToUi(tipo: ApiMovementType): "Ingreso" | "Egreso" {
  return tipo === "INGRESO" ? "Ingreso" : "Egreso";
}
