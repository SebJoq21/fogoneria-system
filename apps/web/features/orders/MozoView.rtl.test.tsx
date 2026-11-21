// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  currentUser: { id: 'u-1', name: 'Luis', role: 'mesero', empresaId: null as string | null },
  accounts: [] as unknown[],
  openAccount: vi.fn(),
  orders: [] as unknown[],
  ordersLoading: false,
  ordersError: null as string | null,
  refreshOrders: vi.fn().mockResolvedValue(undefined),
  advanceOrder: vi.fn().mockResolvedValue(true),
  tables: [{ id: 1, label: 'Mesa 1', zone: 'Salón', status: 'libre', seats: 4 }],
  products: [{ id: 'p-1', name: 'Lomo' }],
  priceOf: vi.fn(() => 24.9),
  notify: vi.fn(),
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

const vivo = vi.hoisted(() => ({ status: 'offline' as string }));
vi.mock('@/lib/orders-realtime', () => ({
  useOrdersRealtime: () => ({ status: vivo.status, lastEvent: null }),
}));

const mesas = vi.hoisted(() => ({ listTables: vi.fn() }));
vi.mock('@/lib/tables-api', () => ({ listTables: mesas.listTables }));

vi.mock('./mozo/AccountPanel', () => ({
  AccountPanel: ({ account, onBack }: { account: { label: string }; onBack: () => void }) => (
    <div>
      <p>Panel {account.label}</p>
      <button type="button" onClick={onBack}>
        Volver
      </button>
    </div>
  ),
}));

import { MozoView } from './MozoView';

const cuenta = (overrides: Record<string, unknown> = {}) => ({
  id: 'acc-1',
  branchId: 'miraflores',
  tableId: 1,
  label: 'Mesa 1',
  customer: 'Ana',
  waiter: 'Luis',
  openedAt: '2026-11-20T12:00:00.000Z',
  closedAt: null,
  status: 'abierta',
  items: [{ id: 'it-1', productId: 'p-1', name: 'Lomo', qty: 1, unitPrice: 24.9, modifiers: [], notes: '', sent: false }],
  payments: [],
  tip: 0,
  discount: 0,
  discountConcept: '',
  couponCode: null,
  customerId: null,
  motivoAnulacion: null,
  ...overrides,
});

const orden = (overrides: Record<string, unknown> = {}) => ({
  id: 'ORD-1',
  customer: 'Ana',
  waiter: 'Luis',
  waiterId: 'u-1',
  status: 'pendiente',
  time: '12:00',
  items: [
    { productId: 'p-1', name: 'Lomo', qty: 2, modifiers: ['Medio'], notes: '' },
    { productId: null, name: 'Chicha', qty: 1, modifiers: [], notes: '' },
  ],
  amount: 74.7,
  ...overrides,
});

beforeEach(() => {
  estado.currentUser = { id: 'u-1', name: 'Luis', role: 'mesero', empresaId: null };
  estado.accounts = [];
  estado.orders = [];
  estado.ordersLoading = false;
  estado.ordersError = null;
  estado.openAccount.mockReset().mockReturnValue('acc-1');
  estado.refreshOrders.mockReset().mockResolvedValue(undefined);
  estado.advanceOrder.mockReset().mockResolvedValue(true);
  estado.notify.mockReset();
  estado.priceOf.mockReset().mockReturnValue(24.9);
  vivo.status = 'offline';
  mesas.listTables.mockReset().mockResolvedValue([
    { id: 't-1', numero: '7', zona: 'Terraza', estado: 'LIBRE', capacidad: 4, forma: 'RECTANGULAR' },
  ]);
});

afterEach(cleanup);

describe('MozoView demo', () => {
  it('muestra el vacío de cuentas y abre una cuenta para llevar', () => {
    render(<MozoView />);
    expect(screen.getByText(/No hay cuentas abiertas/)).toBeTruthy();

    fireEvent.click(screen.getByText('+ Nueva cuenta'));
    fireEvent.change(screen.getByPlaceholderText(/Juan P/), { target: { value: 'Rosa' } });
    fireEvent.click(screen.getByText('Abrir cuenta'));
    expect(estado.openAccount).toHaveBeenCalledWith(
      expect.objectContaining({ tableId: null, label: 'Para llevar', customer: 'Rosa' }),
    );
    expect(estado.notify).toHaveBeenCalledWith('Cuenta abierta', expect.any(String));
  });

  it('abre una cuenta de mesa y muestra el panel', () => {
    estado.accounts = [cuenta()];
    render(<MozoView />);
    expect(screen.getByText('Abierta')).toBeTruthy();
    fireEvent.click(screen.getByText('Abrir cuenta'));
    expect(screen.getByText('Panel Mesa 1')).toBeTruthy();
    fireEvent.click(screen.getByText('Volver'));
    expect(screen.getByText('Mesa 1')).toBeTruthy();
  });

  it('anula una comanda pendiente propia', async () => {
    estado.orders = [orden()];
    render(<MozoView />);
    fireEvent.click(screen.getByRole('tab', { name: 'Mis comandas' }));
    expect(screen.getByText('Por confirmar')).toBeTruthy();
    expect(screen.getByText(/\$24.90/)).toBeTruthy();

    fireEvent.click(screen.getByText('Anular comanda'));
    fireEvent.click(screen.getByRole('button', { name: 'Anular' }));
    await waitFor(() => expect(estado.advanceOrder).toHaveBeenCalled());
    expect(estado.advanceOrder.mock.calls[0]![1]).toBe('anulado');
    await waitFor(() => expect(estado.notify).toHaveBeenCalledWith('Comanda anulada', expect.any(String)));
  });

  it('marca entregada una comanda lista', async () => {
    estado.orders = [orden({ status: 'listo' })];
    render(<MozoView />);
    fireEvent.click(screen.getByRole('tab', { name: 'Mis comandas' }));
    expect(screen.getByText('Lista')).toBeTruthy();
    fireEvent.click(screen.getByText('Marcar entregado'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Marcar entregado' }).at(-1)!);
    await waitFor(() => expect(estado.advanceOrder.mock.calls[0]![1]).toBe('entregado'));
    await waitFor(() =>
      expect(estado.notify).toHaveBeenCalledWith('Comanda entregada', expect.any(String)),
    );
  });

  it('avisa si la transición falla y muestra estados de carga/error', async () => {
    estado.orders = [orden()];
    estado.ordersLoading = true;
    estado.ordersError = 'Sin comandas';
    estado.advanceOrder.mockResolvedValue(false);
    render(<MozoView />);
    fireEvent.click(screen.getByRole('tab', { name: 'Mis comandas' }));
    expect(screen.getByText('Cargando comandas…')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Sin comandas');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(estado.refreshOrders).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Anular comanda'));
    fireEvent.click(screen.getByRole('button', { name: 'Anular' }));
    await waitFor(() =>
      expect(estado.notify).toHaveBeenCalledWith('No se pudo anular', expect.any(String)),
    );
  });

  it('muestra vacío cuando no hay comandas propias', () => {
    render(<MozoView />);
    fireEvent.click(screen.getByRole('tab', { name: 'Mis comandas' }));
    expect(screen.getByText(/A.n no tomaste comandas/)).toBeTruthy();
  });
});

describe('MozoView con sesión', () => {
  beforeEach(() => {
    estado.currentUser = { id: 'u-1', name: 'Luis', role: 'mesero', empresaId: 'e-1' };
    vivo.status = 'connected';
  });

  it('carga las mesas de la API y abre la cuenta con su UUID', async () => {
    render(<MozoView />);
    expect(screen.getByText('En vivo')).toBeTruthy();
    fireEvent.click(screen.getByText('+ Nueva cuenta'));
    expect(screen.getByText('Cargando mesas…')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Mesa 7 · Terraza · libre')).toBeTruthy());
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 't-1' } });
    fireEvent.click(screen.getByText('Abrir cuenta'));
    expect(estado.openAccount).toHaveBeenCalledWith(
      expect.objectContaining({ tableId: 7, tableApiId: 't-1', label: 'Mesa 7' }),
    );
  });

  it('muestra el error de mesas y permite abrir para llevar', async () => {
    mesas.listTables.mockRejectedValue(new Error('API caída'));
    render(<MozoView />);
    fireEvent.click(screen.getByText('+ Nueva cuenta'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('API caída'));
    fireEvent.click(screen.getByText('Abrir cuenta'));
    expect(estado.openAccount).toHaveBeenCalledWith(
      expect.objectContaining({ tableId: null, label: 'Para llevar' }),
    );
  });

  it('cae al role sin permiso de apertura', () => {
    estado.currentUser = { id: 'u-2', name: 'Chef', role: 'cocina', empresaId: 'e-1' };
    vivo.status = 'reconnecting';
    render(<MozoView />);
    expect(screen.queryByText('+ Nueva cuenta')).toBeNull();
    expect(screen.getByText(/Reconectando/)).toBeTruthy();
  });
});
