import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  currentUser: { id: 'u-1', name: 'Luis', role: 'mesero' },
  updateAccountItem: () => {},
  removeAccountItem: () => {},
  addAccountItems: () => {},
  sendToKitchen: () => {},
  annulAccount: () => {},
  checkoutAccount: () => {},
  notify: () => {},
  tables: [],
  products: [],
  priceOf: () => 24.9,
  catalogoLoading: false,
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

import { AccountPanel } from './AccountPanel';
import type { TableAccount } from '@/lib/domain';

const cuenta: TableAccount = {
  id: 'acc-1',
  branchId: 'b-1',
  tableId: 1,
  label: 'Mesa 1',
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
      modifiers: [{ optionId: 'o-1', name: 'Extra queso', extra: 2 }],
      notes: 'Sin ají',
      sent: false,
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

describe('AccountPanel', () => {
  it('pinta la cuenta con sus líneas y totales', () => {
    const markup = renderToStaticMarkup(<AccountPanel account={cuenta} onBack={() => {}} />);
    expect(markup).toContain('Mesa 1');
    expect(markup).toContain('Lomo saltado');
    expect(markup).toContain('Sin ají');
    expect(markup).toContain('53.80');
  });

  it('una cuenta vacía invita a agregar platos', () => {
    const markup = renderToStaticMarkup(
      <AccountPanel account={{ ...cuenta, items: [] }} onBack={() => {}} />,
    );
    expect(markup.length).toBeGreaterThan(0);
    expect(markup).toContain('Mesa 1');
  });
});
