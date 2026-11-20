import { describe, expect, it, vi } from 'vitest';
import { RealtimeService } from './realtime.service.js';
import type { OrdersGateway } from './orders.gateway.js';

function build() {
  const gateway = {
    emitOrderCreated: vi.fn(),
    emitOrderUpdated: vi.fn(),
    emitTableStatus: vi.fn(),
    emitOrderSla: vi.fn(),
  };
  return { service: new RealtimeService(gateway as unknown as OrdersGateway), gateway };
}

describe('RealtimeService', () => {
  it('publica el alta de comanda por el gateway', () => {
    const { service, gateway } = build();
    const payload = { ordenId: 'o-1' } as never;
    service.orderCreated('e-1', payload);
    expect(gateway.emitOrderCreated).toHaveBeenCalledWith('e-1', payload);
  });

  it('publica la actualización de comanda', () => {
    const { service, gateway } = build();
    const payload = { ordenId: 'o-1', a: 'EN_COCINA' } as never;
    service.orderUpdated('e-1', payload);
    expect(gateway.emitOrderUpdated).toHaveBeenCalledWith('e-1', payload);
  });

  it('publica el estado de mesa', () => {
    const { service, gateway } = build();
    const payload = { mesaId: 'm-1', a: 'OCUPADA' } as never;
    service.tableStatus('e-1', payload);
    expect(gateway.emitTableStatus).toHaveBeenCalledWith('e-1', payload);
  });

  it('publica la alerta de SLA', () => {
    const { service, gateway } = build();
    const payload = { ordenId: 'o-1', minutos: 21 } as never;
    service.orderSla('e-1', payload);
    expect(gateway.emitOrderSla).toHaveBeenCalledWith('e-1', payload);
  });
});
