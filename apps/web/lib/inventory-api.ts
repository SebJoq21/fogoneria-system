/* Cliente de inventario de la API (AYCDS-24).

   El semáforo sale de `v_stock_bajo` y el kardex de `movimientos_inventario`.
   Ambos leen el tenant de la sesión: la web no manda `empresa_id`. */

import { apiFetch } from "./api";

export type ApiStockState = "AGOTADO" | "BAJO" | "OPTIMO";

export type ApiStockItem = {
  sucursalId: string;
  insumoId: string;
  nombre: string;
  unidad: string;
  cantidad: number;
  stockMinimo: number;
  estado: ApiStockState;
};

export type ApiStockStatus = {
  sucursalId: string | null;
  resumen: { total: number; agotados: number; bajos: number; optimos: number };
  items: ApiStockItem[];
};

export type ApiMovementType = "ENTRADA" | "SALIDA" | "AJUSTE" | "MERMA";

export type ApiMovement = {
  id: string;
  fecha: string;
  tipo: ApiMovementType;
  insumoId: string;
  insumo: string;
  unidad: string;
  cantidad: number;
  stockResultante: number | null;
  motivo: string | null;
  orden: string | null;
};

export type ListMovementsParams = {
  sucursalId?: string;
  insumoId?: string;
  tipo?: ApiMovementType;
  desde?: string;
  hasta?: string;
  limit?: number;
  signal?: AbortSignal;
};

function search(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (typeof valor === "string" && valor !== "") q.set(clave, valor);
    if (typeof valor === "number") q.set(clave, String(valor));
  }
  const query = q.toString();
  return query ? `?${query}` : "";
}

export async function getStockStatus(
  params: { sucursalId?: string; estado?: ApiStockState; signal?: AbortSignal } = {},
): Promise<ApiStockStatus> {
  return apiFetch<ApiStockStatus>(`/inventory/stock${search(params)}`, {
    signal: params.signal,
  });
}

export async function listMovements(
  params: ListMovementsParams = {},
): Promise<{ sucursalId: string | null; items: ApiMovement[] }> {
  return apiFetch<{ sucursalId: string | null; items: ApiMovement[] }>(
    `/inventory/movements${search(params)}`,
    { signal: params.signal },
  );
}

/** Etiqueta de la UI para el tipo de movimiento. */
export function movementTypeLabel(tipo: ApiMovementType): "Entrada" | "Salida" | "Ajuste" | "Merma" {
  switch (tipo) {
    case "ENTRADA":
      return "Entrada";
    case "SALIDA":
      return "Salida";
    case "MERMA":
      return "Merma";
    default:
      return "Ajuste";
  }
}

/** Signo y unidad que ve el almacenero: `-2.5 kg`, `+4 kg`, `0.5 kg`. */
export function movementQtyLabel(movimiento: ApiMovement): string {
  const valor = Number(movimiento.cantidad ?? 0);
  const simbolo =
    movimiento.tipo === "ENTRADA" ? "+" : movimiento.tipo === "AJUSTE" ? "" : "-";
  return `${simbolo}${valor} ${movimiento.unidad}`.trim();
}
