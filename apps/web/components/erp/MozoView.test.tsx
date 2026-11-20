import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  currentUser: { id: 'u-1', name: 'Luis Mesero', role: 'mesero', empresaId: 'e-1', branchId: 's-1' },
  accounts: [
    {
      id: 'acc-1',
      branchId: 'b-1',
      tableId: 1,
      label: 'Mesa 1',
      customer: 'Ana',
      waiter: 'Luis Mesero',
      openedAt: '2026-11-20T12:00:00.000Z',
      closedAt: null,
      status: 'abierta',
      items: [],
      payments: [],
      tip: 0,
      discount: 0,
      discountConcept: '',
      couponCode: null,
      customerId: null,
      motivoAnulacion: null,
    },
  ],
  openAccount: () => {},
  orders: [
    {
      id: 'ORD-000001',
      apiId: 'o-1',
      status: 'entregado',
      customer: 'Mesa 1',
      channel: 'Mesa',
      waiter: 'Luis Mesero',
      amount: 44.9,
      items: 2,
      createdAt: '2026-11-20T12:00:00.000Z',
    },
  ],
  ordersLoading: false,
  ordersError: null,
  refreshOrders: () => {},
  advanceOrder: () => {},
  tables: [{ id: 1, label: 'Mesa 1', seats: 4, shape: 'round', status: 'libre', zone: 'Salón' }],
  products: [],
  priceOf: () => 24.9,
  notify: () => {},
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

import { MozoView } from './MozoView';

describe('MozoView', () => {
  it('pinta las cuentas abiertas del mesero', () => {
    const markup = renderToStaticMarkup(<MozoView />);
    expect(markup).toContain('Mesa 1');
    expect(markup).toContain('Nueva cuenta');
  });

  it('muestra el canal en vivo y la pestaña de comandas', () => {
    const markup = renderToStaticMarkup(<MozoView />);
    expect(markup).toContain('Mis comandas');
    expect(markup).toContain('Sin canal en vivo');
  });
});
