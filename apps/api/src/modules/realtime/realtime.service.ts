import { Injectable } from '@nestjs/common';
import { OrdersGateway } from './orders.gateway.js';
import type {
  OrderCreatedPayload,
  OrderUpdatedPayload,
  TableStatusPayload,
} from './realtime.types.js';

/**
 * Fachada que usan los servicios de dominio para publicar eventos en vivo.
 *
 * Los servicios no conocen Socket.io: si el gateway no está montado (tests
 * unitarios, scripts de mantenimiento) las llamadas son no-op.
 */
@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: OrdersGateway) {}

  orderCreated(empresaId: string, payload: OrderCreatedPayload): void {
    this.gateway.emitOrderCreated(empresaId, payload);
  }

  orderUpdated(empresaId: string, payload: OrderUpdatedPayload): void {
    this.gateway.emitOrderUpdated(empresaId, payload);
  }

  tableStatus(empresaId: string, payload: TableStatusPayload): void {
    this.gateway.emitTableStatus(empresaId, payload);
  }
}
