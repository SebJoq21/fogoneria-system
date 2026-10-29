/* Adaptador API ↔ UI de mesas y reservas (AYCDS-26).

   La API identifica mesas con UUID (`mesas.id`) y reservas con UUID + folio.
   La UI del ERP usa `Table.id` numérico (cuentas, traspasos y `deriveTableStatus`)
   y estados cortos. Este módulo es el único punto que conoce ambas formas.

   Reglas:
   - `MANTENIMIENTO` se muestra como mesa bloqueada (`blocked: true`) y estado
     `reservada`, porque `TableStatus` solo tiene libre/ocupada/reservada.
   - `POR_CONFIRMAR` es un estado propio de la agenda; `EJECUTADA` se muestra
     como "Llegó" y los terminales como cancelada/no-show. */

import type { Reservation, ReservationStatus, Table, TableShape, TableStatus } from "./erp";
import type { ApiReservation, ApiReservationState } from "./reservations-api";
import type { ApiTable } from "./tables-api";

/** FNV-1a 32 bits: mismo UUID → mismo id numérico entre recargas. */
export function stableTableId(apiId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < apiId.length; i += 1) {
    hash ^= apiId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  // Entero positivo seguro para `Table.id`.
  return hash & 0x7fffffff;
}

export function tableStatusFromApi(estado: ApiTable["estado"]): TableStatus {
  switch (estado) {
    case "OCUPADA":
      return "ocupada";
    case "RESERVADA":
    case "MANTENIMIENTO":
      return "reservada";
    case "LIBRE":
    default:
      return "libre";
  }
}

export function tableFromApi(api: ApiTable, id = stableTableId(api.id)): Table {
  return {
    id,
    label: /^mesa\s/i.test(api.numero) ? api.numero : `Mesa ${api.numero}`,
    seats: api.capacidad,
    shape: (api.forma === "REDONDA" ? "round" : "rect") as TableShape,
    status: tableStatusFromApi(api.estado),
    zone: api.zona?.trim() || "Salón",
    apiId: api.id,
    branchId: api.sucursal_id,
    blocked: api.estado === "MANTENIMIENTO",
  };
}

/** Convierte el listado y resuelve colisiones de hash sin romper la estabilidad. */
export function tablesFromApi(list: ApiTable[]): Table[] {
  const used = new Set<number>();
  return list.map((api) => {
    let id = stableTableId(api.id);
    while (used.has(id)) id = id === 0x7fffffff ? 1 : id + 1;
    used.add(id);
    return tableFromApi(api, id);
  });
}

export function shapeToApi(shape: TableShape): "REDONDA" | "RECTANGULAR" {
  return shape === "round" ? "REDONDA" : "RECTANGULAR";
}

export function shapeFromApi(forma: string | null | undefined): TableShape {
  return forma === "REDONDA" ? "round" : "rect";
}

/** `numero` visible de la API a partir de la etiqueta de la UI. */
export function tableNumberFromLabel(label: string): string {
  const trimmed = label.trim();
  return trimmed.replace(/^mesa\s+/i, "").slice(0, 10) || trimmed.slice(0, 10);
}

const LIMA_TZ = "America/Lima";

/** Hoy en hora de Lima (`YYYY-MM-DD`), no en UTC del navegador. */
export function limaTodayKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: LIMA_TZ }).format(now);
}

/** Día de Lima de un ISO de la API (evita el corrimiento a UTC del día siguiente). */
export function limaDateKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return limaTodayKey(date);
}

/** `2026-10-29` + `20:00` → ISO con el offset fijo de Lima (UTC-05). */
export function reservationDateIso(day: string, hour: string): string {
  const [h = "00", m = "00"] = hour.split(":");
  return `${day}T${h.padStart(2, "0")}:${m.padStart(2, "0")}:00-05:00`;
}

/** Hora legible en Lima a partir del ISO de la API. */
export function limaTimeOf(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: LIMA_TZ,
  });
}

export function reservationStatusFromApi(estado: ApiReservationState): ReservationStatus {
  switch (estado) {
    case "POR_CONFIRMAR":
      return "por_confirmar";
    case "EJECUTADA":
      return "llego";
    case "CANCELADA":
      return "cancelada";
    case "NO_SHOW":
      return "no_show";
    case "CONFIRMADA":
    default:
      return "confirmada";
  }
}

export function apiReservationStatusOf(status: ReservationStatus): ApiReservationState {
  switch (status) {
    case "por_confirmar":
      return "POR_CONFIRMAR";
    case "llego":
      return "EJECUTADA";
    case "cancelada":
      return "CANCELADA";
    case "no_show":
      return "NO_SHOW";
    case "confirmada":
    default:
      return "CONFIRMADA";
  }
}

/**
 * Reserva de la API a la forma de la agenda.
 * `tableId` sale del UUID de la mesa; si la mesa ya no está en el mapa, queda null.
 */
export function reservationFromApi(api: ApiReservation, tables: Table[]): Reservation {
  const mesaId = api.mesa_id ?? api.mesas?.id ?? null;
  const table = mesaId ? tables.find((candidate) => candidate.apiId === mesaId) : undefined;
  return {
    id: api.id,
    code: api.codigo,
    customer: api.cliente_nombre,
    guests: api.nro_comensales,
    phone: api.telefono ?? "",
    date: api.fecha_hora,
    time: limaTimeOf(api.fecha_hora),
    status: reservationStatusFromApi(api.estado),
    notes: api.notas ?? "",
    tableId: table?.id ?? null,
    tableApiId: mesaId,
  };
}

export function reservationsFromApi(list: ApiReservation[], tables: Table[]): Reservation[] {
  return list.map((reservation) => reservationFromApi(reservation, tables));
}
