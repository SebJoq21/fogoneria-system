/**
 * API pública del módulo Tiempo real (AYCDS-14).
 *
 * `RealtimeService` es la fachada que publican los servicios de dominio; los
 * rooms y el contrato de eventos salen de `@fogoneria/contracts/tiempo-real`.
 * El `OrdersGateway` es un detalle del módulo: no se exporta.
 */
export { RealtimeModule } from './realtime.module.js';
export { RealtimeService } from './realtime.service.js';
export {
  REALTIME_EVENT,
  REALTIME_NAMESPACE,
  branchRoom,
  companyRoom,
  orderRoom,
} from './realtime.types.js';
export type {
  OrderCreatedPayload,
  OrderSlaPayload,
  OrderUpdatedPayload,
  RealtimeEnvelope,
  RealtimeEventName,
  TableStatusPayload,
} from './realtime.types.js';
