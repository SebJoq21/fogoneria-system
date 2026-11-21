import { randomUUID } from 'node:crypto';
import {
  REALTIME_EVENT,
  REALTIME_NAMESPACE,
  salaEmpresa,
  salaOrden,
  salaSucursal,
} from '@fogoneria/contracts/realtime';
import type {
  MesaEstadoEvento,
  OrdenActualizadaEvento,
  OrdenCreadaEvento,
  OrdenSlaEvento,
  SobreEvento,
} from '@fogoneria/contracts/realtime';

/**
 * Contrato de eventos en vivo (AYCDS-14).
 *
 * La fuente única vive en `@fogoneria/contracts/realtime` (nombres, sobre y
 * rooms); aquí solo se conservan los alias que ya usaba la API y la fábrica del
 * sobre con `eventId` del servidor. El detalle operativo está en
 * `docs/websockets.md`.
 */

export { REALTIME_EVENT, REALTIME_NAMESPACE };

export type RealtimeEventName =
  (typeof REALTIME_EVENT)[keyof typeof REALTIME_EVENT];

/** `{ eventId, at, data }`: `eventId` permite descartar duplicados al reconectar. */
export type RealtimeEnvelope<T> = SobreEvento<T>;

/** Alias del contrato compartido (nombres históricos de la API). */
export type OrderCreatedPayload = OrdenCreadaEvento;
export type OrderUpdatedPayload = OrdenActualizadaEvento;
export type OrderSlaPayload = OrdenSlaEvento;
export type TableStatusPayload = MesaEstadoEvento;

/** Rooms del contrato: `empresa:<id>`, `empresa:<id>:sucursal:<id>` y `order:<id>`. */
export {
  salaEmpresa as companyRoom,
  salaSucursal as branchRoom,
  salaOrden as orderRoom,
};

export function envelope<T>(data: T): RealtimeEnvelope<T> {
  return { eventId: randomUUID(), at: new Date().toISOString(), data };
}
