// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  coupons: [
    { code: 'BURGER10', discount: '10% OFF', used: 0, limit: 10, expires: '30 Nov 2026' },
    { code: 'PISCO5', discount: '$5.00 Descuento', used: 10, limit: 10, expires: '15 Dic 2026' },
  ],
  customers: [{ id: 1, name: 'Ana', phone: '987654321', points: 10, visits: 1, segment: 'Nuevo', lastVisit: 'Hoy' }],
  checkoutAccount: vi.fn(),
  openCashShift: { id: 'shift-1' },
  notify: vi.fn(),
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

import { CheckoutModal } from './CheckoutModal';
import type { TableAccount } from '@/lib/domain';

const cuenta = {
  id: 'acc-1',
  branchId: 'miraflores',
  tableId: 1,
  label: 'Mesa 1',
  customer: 'Ana',
  waiter: 'Luis',
  openedAt: '2026-11-20T12:00:00.000Z',
  closedAt: null,
  status: 'abierta',
  items: [{ id: 'it-1', productId: 'p-1', name: 'Lomo', qty: 2, unitPrice: 24.9, modifiers: [], notes: '', sent: true }],
  payments: [],
  tip: 0,
  discount: 0,
  discountConcept: '',
  couponCode: null,
  customerId: null,
  motivoAnulacion: null,
} as TableAccount;

const recibo = { id: 'B001-1', total: 44.82 } as never;

beforeEach(() => {
  estado.checkoutAccount.mockReset().mockReturnValue(recibo);
  estado.notify.mockReset();
});

afterEach(cleanup);

describe('CheckoutModal', () => {
  it('cobra el total con un pago simple', () => {
    const onClose = vi.fn();
    render(<CheckoutModal account={cuenta} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /^Cobrar \$/ }));
    expect(estado.checkoutAccount).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'acc-1', payments: [{ method: 'Efectivo', amount: 49.8 }] }),
    );
    expect(onClose).toHaveBeenCalledWith(recibo);
    expect(estado.notify).toHaveBeenCalledWith('Cuenta cobrada', expect.any(String));
  });

  it('aplica cupÃ³n, propina y cliente y completa el pendiente', () => {
    render(<CheckoutModal account={cuenta} onClose={() => {}} />);
    const combos = screen.getAllByRole('combobox');
    fireEvent.change(combos[0]!, { target: { value: 'BURGER10' } });
    fireEvent.change(combos[1]!, { target: { value: '1' } });
    fireEvent.change(screen.getAllByPlaceholderText('0.00')[0]!, { target: { value: '5' } });
    fireEvent.click(screen.getByText('Completar pendiente'));
    fireEvent.click(screen.getByRole('button', { name: /^Cobrar \$/ }));
    expect(estado.checkoutAccount).toHaveBeenCalledWith(
      expect.objectContaining({ couponCode: 'BURGER10', customerId: 1, tip: 5 }),
    );
  });

  it('no permite factura sin RUC', () => {
    render(<CheckoutModal account={cuenta} onClose={() => {}} />);
    const combos = screen.getAllByRole('combobox');
    fireEvent.change(combos[2]!, { target: { value: '01' } });
    expect((screen.getByRole('button', { name: /^Cobrar \$/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('cancelar cierra sin cobrar', () => {
    const onClose = vi.fn();
    render(<CheckoutModal account={cuenta} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancelar'));
    expect(onClose).toHaveBeenCalledWith(null);
    expect(estado.checkoutAccount).not.toHaveBeenCalled();
  });
});




