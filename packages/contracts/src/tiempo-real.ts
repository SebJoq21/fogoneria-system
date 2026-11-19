/**
 * Contrato de eventos en vivo (AYCDS-14).
 *
 * Una sola verdad para la API y la web: nombres de evento, sobre
 * `{ eventId, at, data }` y rooms de Socket.io. El transporte (gateway en la
 * API, `lib/realtime.ts` en la web) no define nombres propios.
 *
 * El detalle operativo (ticket de 60 s, reconexión, rooms por tenant) está en
 * `docs/websockets.md`.
 */

export const REALTIME_NAMESPACE = '/orders';

export const REALTIME_EVENT = {
  orderCreated: 'order.created',
  orderUpdated: 'order.updated',
  orderSla: 'order.sla',
  tableStatus: 'table.status',
  authError: 'auth.error',
} as const;

/** Eventos de dominio del canal en vivo. */
export type EventoTiempoReal =
  | 'order.created'
  | 'order.updated'
  | 'order.sla'
  | 'table.status';

/** Rechazo del handshake (ticket vencido, sin empresa, ticket no-WS). */
export type EventoTiempoRealError = 'auth.error';

/**
 * Sobre de todo mensaje: `eventId` es único por emisión y permite descartar
 * duplicados cuando el cliente reconecta; `at` es la hora del servidor.
 */
export interface SobreEvento<T> {
  eventId: string;
  at: string;
  data: T;
}

/** Alta de comanda (mesero o POS). */
export interface OrdenCreadaEvento {
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
export interface OrdenActualizadaEvento {
  ordenId: string;
  numeroOrden: string;
  de: string;
  a: string;
  sucursalId: string;
  mesaId: string | null;
}

/** Alerta de SLA: la comanda lleva más de 20 min sin entregarse (AYCDS-30). */
export interface OrdenSlaEvento {
  ordenId: string;
  numeroOrden: string;
  estado: string;
  sucursalId: string;
  mesaId: string | null;
  minutos: number;
  slaMinutos: number;
}

/** Estado de mesa derivado (ocupada, reservada, libre, mantenimiento). */
export interface MesaEstadoEvento {
  mesaId: string;
  numero: string | null;
  de: string | null;
  a: string;
  sucursalId: string;
}

/** Room de la empresa: solo se unen los roles sin sucursal (`ADMIN_GLOBAL`). */
export function salaEmpresa(empresaId: string): string {
  return `empresa:${empresaId}`;
}

/** Room operativo: tenant + sucursal. */
export function salaSucursal(empresaId: string, sucursalId: string): string {
  return `empresa:${empresaId}:sucursal:${sucursalId}`;
}

/** Room de una comanda concreta (`order:subscribe`). */
export function salaOrden(ordenId: string): string {
  return `order:${ordenId}`;
}
