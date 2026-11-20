import { describe, expect, it } from 'vitest';
import {
  REALTIME_EVENT,
  REALTIME_NAMESPACE,
  salaEmpresa,
  salaOrden,
  salaSucursal,
} from './tiempo-real';

describe('contrato de tiempo real', () => {
  it('fija el namespace y los nombres de evento una sola vez', () => {
    expect(REALTIME_NAMESPACE).toBe('/orders');
    expect(REALTIME_EVENT).toEqual({
      orderCreated: 'order.created',
      orderUpdated: 'order.updated',
      orderSla: 'order.sla',
      tableStatus: 'table.status',
      authError: 'auth.error',
    });
  });

  it('arma las salas por empresa, sucursal y comanda', () => {
    expect(salaEmpresa('emp-1')).toBe('empresa:emp-1');
    expect(salaSucursal('emp-1', 'suc-1')).toBe('empresa:emp-1:sucursal:suc-1');
    expect(salaOrden('ord-1')).toBe('order:ord-1');
  });
});
