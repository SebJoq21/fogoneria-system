// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  products: [
    { id: 'p-1', name: 'Lomo', sku: 'LOM', categoryId: 'c-1', price: 24.9, status: 'Activo', modifierGroupIds: ['g-1'] },
    { id: 'p-2', name: 'Chicha', sku: 'CHI', categoryId: 'c-2', price: 8, status: 'Activo', modifierGroupIds: [] },
  ],
  priceOf: vi.fn((id: string) => (id === 'p-2' ? 8 : 24.9)),
  modifierGroups: [
    { id: 'g-1', name: 'TÃ©rmino', required: true, multi: true, options: [{ id: 'o-1', name: 'Medio', extra: 0 }, { id: 'o-2', name: 'Extra queso', extra: 2 }] },
  ],
  currentUser: { id: 'u-1', name: 'Luis', role: 'mesero' },
  updateAccountItem: vi.fn(),
  removeAccountItem: vi.fn(),
  addAccountItems: vi.fn(),
  sendToKitchen: vi.fn().mockResolvedValue({}),
  annulAccount: vi.fn(),
  checkoutAccount: vi.fn(() => ({})),
  notify: vi.fn(),
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

import { AddItemModal } from './AddItemModal';
import { AccountPanel } from './AccountPanel';

const cuenta = {
  id: 'acc-1',
  branchId: 'miraflores',
  tableId: 1,
  label: 'Mesa 1',
  customer: 'Ana',
  waiter: 'Luis',
  openedAt: new Date().toISOString(),
  closedAt: null,
  status: 'abierta',
  items: [
    { id: 'it-1', productId: 'p-1', name: 'Lomo', qty: 2, unitPrice: 24.9, modifiers: [], notes: 'Sin ajÃ­', sent: false },
  ],
  payments: [],
  tip: 0,
  discount: 0,
  discountConcept: '',
  couponCode: null,
  customerId: null,
  motivoAnulacion: null,
};

beforeEach(() => {
  for (const fn of [
    estado.updateAccountItem,
    estado.removeAccountItem,
    estado.addAccountItems,
    estado.sendToKitchen,
    estado.annulAccount,
    estado.checkoutAccount,
    estado.notify,
  ]) {
    fn.mockReset();
  }
  estado.sendToKitchen.mockResolvedValue({});
  estado.checkoutAccount.mockReturnValue({});
});

afterEach(cleanup);

describe('AddItemModal', () => {
  it('elige plato, modificador y cantidad y agrega la lÃ­nea', () => {
    const onAdd = vi.fn();
    render(<AddItemModal onAdd={onAdd} onClose={() => {}} />);
    fireEvent.click(screen.getByText(/Chicha/));
    fireEvent.click(screen.getByText(/Lomo/));
    fireEvent.click(screen.getByText('Medio'));
    fireEvent.click(screen.getByText(/Extra queso/));
    fireEvent.click(screen.getByLabelText('Sumar cantidad'));
    fireEvent.change(screen.getByPlaceholderText('Ej. Sin cebolla'), { target: { value: 'Sin hielo' } });
    fireEvent.click(screen.getByRole('button', { name: /^Agregar/ }));
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'p-1', qty: 2, notes: 'Sin hielo' }),
    );
  });

  it('no permite agregar un plato sin modificador obligatorio', () => {
    render(<AddItemModal onAdd={() => {}} onClose={() => {}} />);
    const agregar = screen.getByRole('button', { name: /^Agregar/ });
    expect((agregar as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('AccountPanel', () => {
  it('agrega una lÃ­nea desde el modal', () => {
    render(<AccountPanel account={cuenta as never} onBack={() => {}} />);
    fireEvent.click(screen.getByText('+ Agregar plato'));
    fireEvent.click(screen.getByText('Medio'));
    fireEvent.click(screen.getByRole('button', { name: /^Agregar/ }));
    expect(estado.addAccountItems).toHaveBeenCalledWith('acc-1', expect.any(Array));
  });

  it('ajusta cantidades y quita lÃ­neas', () => {
    render(<AccountPanel account={cuenta as never} onBack={() => {}} />);
    fireEvent.click(screen.getByLabelText('Sumar Lomo'));
    expect(estado.updateAccountItem).toHaveBeenCalledWith('acc-1', 'it-1', 3);
    fireEvent.click(screen.getByLabelText('Restar Lomo'));
    expect(estado.updateAccountItem).toHaveBeenCalledWith('acc-1', 'it-1', 1);
    fireEvent.click(screen.getByLabelText('Quitar Lomo'));
    fireEvent.click(screen.getByText('Quitar'));
    expect(estado.removeAccountItem).toHaveBeenCalledWith('acc-1', 'it-1');
  });

  it('envÃ­a a cocina tras confirmar', async () => {
    render(<AccountPanel account={cuenta as never} onBack={() => {}} />);
    fireEvent.click(screen.getByText(/Enviar a cocina/));
    fireEvent.click(screen.getByText('Enviar'));
    expect(estado.sendToKitchen).toHaveBeenCalledWith('acc-1');
  });

  it('cobra y libera la mesa', () => {
    const onBack = vi.fn();
    render(<AccountPanel account={cuenta as never} onBack={onBack} />);
    fireEvent.click(screen.getByText('Cobrar y liberar mesa'));
    expect(estado.checkoutAccount).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'acc-1', receiptType: '03' }),
    );
    expect(onBack).toHaveBeenCalled();
  });

  it('anula la cuenta tras confirmar', () => {
    render(<AccountPanel account={cuenta as never} onBack={() => {}} />);
    fireEvent.click(screen.getByText('Anular cuenta'));
    fireEvent.click(screen.getAllByText('Anular cuenta').at(-1)!);
    expect(estado.annulAccount).toHaveBeenCalledWith('acc-1', expect.any(String));
  });
});


