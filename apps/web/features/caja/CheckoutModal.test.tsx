import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  coupons: [] as unknown[],
  customers: [] as unknown[],
  checkoutAccount: () => {},
  openCashShift: () => {},
  notify: () => {},
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

import { CheckoutModal } from './CheckoutModal';
import type { TableAccount } from '@/lib/domain';

const cuenta: TableAccount = {
  id: 'acc-1',
  branchId: 'b-1',
  tableId: 4,
  label: 'Mesa 4',
  customer: 'Ana',
  waiter: 'Luis',
  openedAt: '2026-11-20T12:00:00.000Z',
  closedAt: null,
  status: 'abierta',
  items: [
    {
      id: 'it-1',
      productId: 'p-1',
      name: 'Lomo saltado',
      qty: 2,
      unitPrice: 24.9,
      modifiers: [],
      notes: '',
      sent: true,
    },
  ],
  payments: [],
  tip: 0,
  discount: 0,
  discountConcept: '',
  couponCode: null,
  customerId: null,
  motivoAnulacion: null,
};

describe('CheckoutModal', () => {
  it('pinta el cobro con el total de la cuenta', () => {
    const markup = renderToStaticMarkup(<CheckoutModal account={cuenta} onClose={() => {}} />);
    expect(markup).toContain('Cobrar cuenta · Mesa 4');
    expect(markup).toContain('Cobrar $49.80');
    expect(markup).toContain('Total a pagar');
  });

  it('con propina y cupón recalcula el total', () => {
    estado.coupons = [
      { id: 1, code: 'PARRILLA10', kind: 'percent', value: 10, used: 0, limit: 10, active: true, expires: '2026-12-31' },
    ];
    const markup = renderToStaticMarkup(<CheckoutModal account={cuenta} onClose={() => {}} />);
    expect(markup).toContain('Propina');
    expect(markup).toContain('Cupón');
    expect(markup).toContain('Boleta');
    estado.coupons = [];
  });
});
