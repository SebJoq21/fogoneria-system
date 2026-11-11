/* Cliente de RRHH de la API (AYCDS-45).

   Asistencia = upsert por empleado y día; el pozo de propinas se calcula sobre
   lo cobrado y se reparte entre los presentes. La UI solo orquesta. */

import { apiFetch } from "./api";

export type ApiAttendanceState = "PRESENTE" | "TARDANZA" | "FALTA" | "DESCANSO";

export type ApiEmployee = {
  id: string;
  nombre: string;
  sucursal_id: string;
  activo: boolean;
  roles_empresa?: { id: string; nombre: string } | null;
};

export type ApiAttendance = {
  id: string;
  empleado_id: string;
  fecha: string;
  estado: ApiAttendanceState;
  hora_entrada: string | null;
  hora_salida: string | null;
  fuente: string | null;
  empleados?: { id: string; nombre: string } | null;
};

export type ApiTipPool = {
  id: string;
  fecha: string;
  total: string | number;
  nro_beneficiarios: number;
  estado: "CALCULADO" | "REPARTIDO";
  _count?: { repartos_propinas: number };
};

export type ApiShift = {
  id: string;
  fecha: string;
  bloque: "MANANA" | "TARDE" | "NOCHE";
  empleados?: { id: string; nombre: string } | null;
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

export async function listEmployees(
  params: { activo?: boolean; signal?: AbortSignal } = {},
): Promise<ApiEmployee[]> {
  const q = params.activo === undefined ? "" : query({ activo: String(params.activo) });
  return apiFetch<ApiEmployee[]>(`/staff/employees${q}`, { signal: params.signal });
}

export async function listAttendance(
  params: { fecha?: string; sucursalId?: string; signal?: AbortSignal } = {},
): Promise<ApiAttendance[]> {
  return apiFetch<ApiAttendance[]>(
    `/staff/attendance${query({ fecha: params.fecha, sucursalId: params.sucursalId })}`,
    { signal: params.signal },
  );
}

export async function listShifts(
  params: { fecha?: string; sucursalId?: string; signal?: AbortSignal } = {},
): Promise<ApiShift[]> {
  return apiFetch<ApiShift[]>(
    `/staff/shifts${query({ fecha: params.fecha, sucursalId: params.sucursalId })}`,
    { signal: params.signal },
  );
}

export async function markAttendance(input: {
  empleadoId: string;
  fecha?: string;
  sucursalId?: string;
  estado: ApiAttendanceState;
  horaEntrada?: string;
  horaSalida?: string;
  fuente?: string;
}): Promise<ApiAttendance> {
  return apiFetch<ApiAttendance>("/staff/attendance", { method: "POST", body: input });
}

export async function listTips(
  params: { sucursalId?: string; signal?: AbortSignal } = {},
): Promise<ApiTipPool[]> {
  return apiFetch<ApiTipPool[]>(`/staff/tips${query({ sucursalId: params.sucursalId })}`, {
    signal: params.signal,
  });
}

export async function calculateTips(input: {
  fecha?: string;
  sucursalId?: string;
}): Promise<ApiTipPool> {
  return apiFetch<ApiTipPool>("/staff/tips/calculate", { method: "POST", body: input });
}

export async function confirmTip(id: string): Promise<ApiTipPool> {
  return apiFetch<ApiTipPool>(`/staff/tips/${id}/confirm`, { method: "POST", body: {} });
}

/** Etiqueta de la UI para el estado de asistencia. */
export function attendanceLabel(estado: ApiAttendanceState): "Presente" | "Tardanza" | "Falta" | "Descanso" {
  switch (estado) {
    case "TARDANZA":
      return "Tardanza";
    case "FALTA":
      return "Falta";
    case "DESCANSO":
      return "Descanso";
    default:
      return "Presente";
  }
}
