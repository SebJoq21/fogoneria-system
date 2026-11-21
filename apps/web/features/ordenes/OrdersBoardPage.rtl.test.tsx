// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  orders: [] as unknown[],
  advanceOrder: vi.fn(),
  ordersLoading: false,
  ordersError: null as string | null,
  refreshOrders: vi.fn().mockResolvedValue(undefined),
  activeBranch: { id: 's-1', name: 'Miraflores', short: 'MIR' },
  isGeneral: false,
  branchOf: vi.fn((): { short: string } | null => null),
  currentUser: { id: 'u-1', name: 'Chef', role: 'cocina', empresaId: null as string | null },
  notify: vi.fn(),
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));
vi.mock('@/lib/use-now', () => ({ useNow: () => {} }));

const tablero = vi.hoisted(() => ({
  board: null as unknown,
  loading: false,
  error: null as string | null,
  refresh: vi.fn().mockResolvedValue(undefined),
  liveStatus: 'offline',
  lastEvent: null as unknown,
}));
vi.mock('./hooks', () => ({
  useTableroOrdenes: () => ({
    board: tablero.board,
    loading: tablero.loading,
    error: tablero.error,
    refresh: tablero.refresh,
  }),
  useOrdersRealtime: () => ({ status: tablero.liveStatus, lastEvent: tablero.lastEvent }),
}));

import { OrdersBoardPage } from './OrdersBoardPage';

const pedido = (overrides: Record<string, unknown> = {}) => ({
  id: 'ORD-1',
  apiId: 'a-1',
  status: 'pendiente',
  customer: 'Mesa 1',
  channel: 'Salón',
  amount: 74.7,
  items: 2,
  createdAt: '2026-11-20T12:00:00.000Z',
  slaBaseAt: '2026-11-20T12:00:00.000Z',
  alertaSla: false,
  excedidoPor: null,
  mesa: { id: 'm-1', numero: '1' },
  ...overrides,
});

const board = {
  columns: [
    { status: 'pendiente', label: 'Por confirmar', orders: [pedido()] },
    { status: 'cocina', label: 'En cocina', orders: [pedido({ id: 'ORD-2', apiId: 'a-2', status: 'cocina', alertaSla: true })] },
    { status: 'listo', label: 'Listos', orders: [] },
    { status: 'entregado', label: 'Entregados', orders: [] },
  ],
  slaMinutos: 20,
  truncado: true,
  generadoAt: '2026-11-20T12:30:00.000Z',
  metricas: { abiertas: 5, fueraDeSla: 2, promedioEsperaMin: 4, promedioPreparacionMin: 8 },
};

beforeEach(() => {
  estado.orders = [];
  estado.advanceOrder.mockReset().mockResolvedValue(true);
  estado.ordersLoading = false;
  estado.ordersError = null;
  estado.refreshOrders.mockReset().mockResolvedValue(undefined);
  estado.isGeneral = false;
  estado.currentUser = { id: 'u-1', name: 'Chef', role: 'cocina', empresaId: null };
  estado.notify.mockReset();
  tablero.board = null;
  tablero.loading = false;
  tablero.error = null;
  tablero.refresh.mockReset().mockResolvedValue(undefined);
  tablero.liveStatus = 'offline';
  tablero.lastEvent = null;
});

afterEach(cleanup);

describe('OrdersBoardPage cocina', () => {
  beforeEach(() => {
    estado.currentUser = { id: 'u-1', name: 'Chef', role: 'cocina', empresaId: 'e-1' };
    tablero.board = board;
    tablero.liveStatus = 'connected';
  });

  it('muestra el tablero, el SLA y confirma la recepción', async () => {
    render(<OrdersBoardPage mode="cocina" />);
    expect(screen.getByText(/fuera de SLA/)).toBeTruthy();
    expect(screen.getByText(/Se muestran las 2 comandas/)).toBeTruthy();
    expect(screen.getByText('En vivo')).toBeTruthy();

    fireEvent.click(screen.getByText('Confirmar recepción'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(estado.advanceOrder.mock.calls[0]![1]).toBe('cocina'));
    expect(estado.notify).toHaveBeenCalledWith('Pedido en cocina', expect.any(String));
    expect(tablero.refresh).toHaveBeenCalled();
  });

  it('marca listo y avisa si falla', async () => {
    render(<OrdersBoardPage mode="cocina" />);
    fireEvent.click(screen.getByText('Marcar listo'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Marcar listo' }).at(-1)!);
    await waitFor(() => expect(estado.advanceOrder.mock.calls[0]![1]).toBe('listo'));
    expect(estado.notify).toHaveBeenCalledWith('Orden lista', expect.any(String));

    estado.advanceOrder.mockResolvedValue(false);
    fireEvent.click(screen.getByText('Marcar listo'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Marcar listo' }).at(-1)!);
    await waitFor(() =>
      expect(estado.notify).toHaveBeenCalledWith('No se pudo marcar listo', expect.any(String)),
    );
  });

  it('muestra error del tablero y reintenta', () => {
    tablero.board = null;
    tablero.loading = true;
    tablero.error = 'Tablero caído';
    render(<OrdersBoardPage mode="cocina" />);
    expect(screen.getByText('Cargando comandas…')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Tablero caído');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(tablero.refresh).toHaveBeenCalled();
  });
});

describe('OrdersBoardPage demo', () => {
  it('agrupa el estado local y reintenta contra el provider', () => {
    estado.orders = [{ ...pedido(), id: 'ORD-9', apiId: 'a-9' }];
    estado.ordersLoading = true;
    estado.ordersError = 'Sin comandas';
    render(<OrdersBoardPage />);
    expect(screen.getByText(/Comandas de/)).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Sin comandas');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(estado.refreshOrders).toHaveBeenCalled();
    expect(screen.getAllByText('Sin comandas aquí.').length).toBe(4);
  });

  it('pinta el resumen y los canales de una comanda real', () => {
    estado.isGeneral = true;
    estado.currentUser = { id: 'u-9', name: 'Dueño', role: 'admin', empresaId: 'e-1' };
    estado.branchOf.mockReturnValue({ short: 'MIR' });
    tablero.board = board;
    render(<OrdersBoardPage />);
    expect(screen.getAllByText('Salón').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$74.70').length).toBeGreaterThan(0);
    expect(screen.getAllByText('MIR').length).toBeGreaterThan(0);
    expect(screen.queryByText('Confirmar recepción')).toBeNull();
  });
});
