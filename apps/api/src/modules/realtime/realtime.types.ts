import { randomUUID } from 'node:crypto';

/**
 * Contrato de eventos en vivo (AYCDS-14).
 *
 * Todo mensaje viaja con un sobre `{ eventId, at, data }`:
 *   - `eventId` es único por emisión y permite descartar duplicados cuando el
 *     cliente reconecta (Socket.io puede reentregar en un reintento).
 *   - `at` es la marca de tiempo del servidor (ISO 8601, UTC).
 *
 * El contrato completo está en `docs/websockets.md`.
 */

export const REALTIME_NAMESPACE = '/orders';

export const REALTIME_EVENT = {
  orderCreated: 'order.created',
  orderUpdated: 'order.updated',
  tableStatus: 'table.status',
  authError: 'auth.error',
} as const;

export type RealtimeEventName =
  (typeof REALTIME_EVENT)[keyof typeof REALTIME_EVENT];

export interface RealtimeEnvelope<T> {
  eventId: string;
  at: string;
  data: T;
}

/** Alta de comanda (mesero o POS). */
export interface OrderCreatedPayload {
  ordenId: string;
  numeroOrden: string;
  estado: string;
  origen: string;
  sucursalId: string;
  mesaId: string | null;
  total: number;
  creadaAt: string;
}

/** Cambio de estado del KDS. */
export interface OrderUpdatedPayload {
  ordenId: string;
  numeroOrden: string;
  de: string;
  a: string;
  sucursalId: string;
  mesaId: string | null;
}

/** Estado de mesa derivado (ocupada, reservada, libre, mantenimiento). */
export interface TableStatusPayload {
  mesaId: string;
  numero: string | null;
  de: string | null;
  a: string;
  sucursalId: string;
}

/** Room de la empresa: solo se unen los roles sin sucursal (`ADMIN_GLOBAL`). */
export function companyRoom(empresaId: string): string {
  return `empresa:${empresaId}`;
}

/** Room operativo: tenant + sucursal. */
export function branchRoom(empresaId: string, sucursalId: string): string {
  return `empresa:${empresaId}:sucursal:${sucursalId}`;
}

/** Room de una comanda concreta (`order:subscribe`). */
export function orderRoom(ordenId: string): string {
  return `order:${ordenId}`;
}

export function envelope<T>(data: T): RealtimeEnvelope<T> {
  return { eventId: randomUUID(), at: new Date().toISOString(), data };
}
