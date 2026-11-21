// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hoy = '2026-11-20';
const salon = vi.hoisted(() => ({
  tables: [] as unknown[],
  setTables: vi.fn(),
  reservations: [] as unknown[],
  setReservations: vi.fn(),
  accounts: [] as unknown[],
  openAccount: vi.fn(),
  currentUser: { id: 'u-1', name: 'Diego', role: 'sucursal', empresaId: null as string | null, branchId: 's-1' },
  hasSession: false,
  notify: vi.fn(),
  refreshTables: vi.fn().mockResolvedValue(undefined),
  refreshReservations: vi.fn().mockResolvedValue(undefined),
  tablesLoading: false,
  tablesError: null as string | null,
  reservationsLoading: false,
  reservationsError: null as string | null,
}));

const vivo = vi.hoisted(() => ({ status: 'offline' }));
vi.mock('./hooks', () => ({
  useSalon: () => salon,
  useSalonEnVivo: () => ({ status: vivo.status, lastEvent: null }),
}));

const api = vi.hoisted(() => ({
  listMesas: vi.fn(),
  createReserva: vi.fn(),
  updateReserva: vi.fn(),
  updateReservaEstado: vi.fn(),
  updateMesaEstado: vi.fn(),
}));
vi.mock('./api', () => ({ salonApi: api }));

import { BookingsModule } from './BookingsModule';

const mesa = { id: 1, label: 'Mesa 1', seats: 4, shape: 'rect', status: 'libre', zone: 'Salón', apiId: 'm-1' };
const reserva = (overrides: Record<string, unknown> = {}) => ({
  id: 'r-1',
  customer: 'Camila',
  guests: 4,
  phone: '+51 999',
  date: `${hoy}T20:00:00.000Z`,
  time: '20:00',
  status: 'por_confirmar',
  notes: '',
  tableId: 1,
  ...overrides,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-20T15:00:00.000Z'));
  salon.tables = [mesa];
  salon.reservations = [reserva(), reserva({ id: 'r-2', customer: 'Jorge', status: 'confirmada' })];
  salon.accounts = [];
  salon.currentUser = { id: 'u-1', name: 'Diego', role: 'sucursal', empresaId: null, branchId: 's-1' };
  salon.hasSession = false;
  salon.tablesError = null;
  salon.reservationsError = null;
  salon.tablesLoading = false;
  salon.reservationsLoading = false;
  salon.setTables.mockReset();
  salon.setReservations.mockReset();
  salon.notify.mockReset();
  salon.openAccount.mockReset().mockReturnValue('acc-1');
  salon.refreshTables.mockReset().mockResolvedValue(undefined);
  salon.refreshReservations.mockReset().mockResolvedValue(undefined);
  vivo.status = 'offline';
  for (const fn of Object.values(api)) fn.mockReset();
  api.listMesas.mockResolvedValue([
    { id: 'tm-1', numero: '1', zona: 'Salón', estado: 'LIBRE', capacidad: 4, forma: 'RECTANGULAR' },
  ]);
  api.createReserva.mockResolvedValue({});
  api.updateReserva.mockResolvedValue({});
  api.updateReservaEstado.mockResolvedValue({});
  api.updateMesaEstado.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('BookingsModule agenda', () => {
  it('crea una reserva desde el formulario', () => {
    render(<BookingsModule view="agenda" />);
    fireEvent.click(screen.getByText('+ Nueva reserva'));
    fireEvent.change(screen.getByPlaceholderText('Ej. Camila Duarte'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByPlaceholderText('+51 999 999 999'), { target: { value: '987654321' } });
    fireEvent.click(screen.getByText('Crear reserva'));
    expect(salon.setReservations).toHaveBeenCalled();
  });

  it('confirma una reserva por confirmar', () => {
    render(<BookingsModule view="agenda" />);
    fireEvent.click(screen.getByText('Confirmar'));
    expect(salon.setReservations).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'r-1', status: 'confirmada' }),
      expect.any(Object),
    ]);
  });

  it('cancela una reserva con confirmación', () => {
    render(<BookingsModule view="agenda" />);
    fireEvent.click(screen.getAllByText('Cancelar')[0]);
    fireEvent.click(screen.getAllByText('Cancelar reserva').at(-1)!);
    expect(salon.setReservations).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'r-1', status: 'cancelada' }),
      expect.any(Object),
    ]);
  });

  it('marca no-show una reserva confirmada', () => {
    render(<BookingsModule view="agenda" />);
    fireEvent.click(screen.getByText('No-show'));
    fireEvent.click(screen.getAllByText('Marcar no-show').at(-1)!);
    expect(salon.setReservations).toHaveBeenCalledWith([
      expect.any(Object),
      expect.objectContaining({ id: 'r-2', status: 'no_show' }),
    ]);
  });

  it('edita una reserva por confirmar', () => {
    render(<BookingsModule view="agenda" />);
    fireEvent.click(screen.getByText('Editar'));
    expect(screen.getByText('Editar reserva')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Ej. Camila Duarte'), { target: { value: 'Camila R.' } });
    fireEvent.click(screen.getByText('Guardar cambios'));
    expect(salon.setReservations).toHaveBeenCalled();
  });

  it('muestra la agenda vacía y los errores de carga', () => {
    salon.reservations = [];
    salon.reservationsError = 'Reservas caídas';
    render(<BookingsModule view="agenda" />);
    expect(screen.getByText('Reservas caídas')).toBeTruthy();
    expect(screen.getByText(/Sin reservas para esta fecha/)).toBeTruthy();
  });

  it('filtra por fecha en modo demo', () => {
    render(<BookingsModule view="agenda" />);
    fireEvent.change(screen.getByLabelText('Filtrar por fecha'), { target: { value: '2026-11-21' } });
    expect(screen.getByText(/Sin reservas para esta fecha/)).toBeTruthy();
  });

  it('registra la llegada y abre la cuenta de la mesa', () => {
    render(<BookingsModule view="agenda" />);
    fireEvent.click(screen.getByText('Llegó'));
    expect(salon.openAccount).toHaveBeenCalledWith(
      expect.objectContaining({ tableId: 1, customer: 'Jorge' }),
    );
    expect(salon.notify).toHaveBeenCalledWith('Cuenta abierta', expect.any(String));
    expect(salon.setReservations).toHaveBeenCalledWith([
      expect.any(Object),
      expect.objectContaining({ id: 'r-2', status: 'llego' }),
    ]);
  });
});

describe('BookingsModule mapa', () => {
  it('bloquea una mesa desde el mapa', () => {
    salon.reservations = [];
    render(<BookingsModule />);
    fireEvent.click(screen.getByRole('button', { name: /Mesa 1/ }));
    fireEvent.click(screen.getByText('Bloquear mesa'));
    fireEvent.click(screen.getByText('Bloquear'));
    expect(salon.setTables).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1, status: 'reservada' }),
    ]);
    expect(salon.notify).toHaveBeenCalledWith('Mesa bloqueada', 'Mesa 1');
  });

  it('desbloquea una mesa bloqueada', () => {
    salon.reservations = [];
    salon.tables = [{ ...mesa, status: 'reservada', blocked: true }];
    render(<BookingsModule />);
    fireEvent.click(screen.getByRole('button', { name: /Mesa 1/ }));
    fireEvent.click(screen.getByText('Desbloquear mesa'));
    fireEvent.click(screen.getByText('Desbloquear'));
    expect(salon.setTables).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1, status: 'libre' }),
    ]);
  });

  it('muestra la cuenta abierta y la reserva de la mesa', () => {
    salon.reservations = [reserva({ status: 'confirmada' })];
    salon.accounts = [
      {
        id: 'acc-1',
        label: 'Mesa 1',
        status: 'abierta',
        customer: 'Ana',
        waiter: 'Luis',
        tableId: 1,
        items: [{ id: 'it-1', name: 'Lomo', qty: 2, unitPrice: 24.9, modifiers: [], notes: '' }],
        payments: [],
        tip: 0,
        discount: 0,
      },
    ];
    render(<BookingsModule />);
    fireEvent.click(screen.getByRole('button', { name: /Mesa 1/ }));
    expect(screen.getByText(/Cuenta abierta/)).toBeTruthy();
    expect(screen.getByText(/Registrar llegada y abrir cuenta/)).toBeTruthy();
    expect(screen.getByText('Gestionar reservas')).toBeTruthy();
  });

  it('muestra la vista de lectura sin permisos', () => {
    salon.reservations = [];
    salon.currentUser = { id: 'u-3', name: 'Chef', role: 'cocina', empresaId: null, branchId: 's-1' };
    render(<BookingsModule />);
    fireEvent.click(screen.getByRole('button', { name: /Mesa 1/ }));
    expect(screen.getByText('Vista de lectura.')).toBeTruthy();
  });

  it('muestra el error de carga de mesas', () => {
    salon.tablesError = 'Mesas caídas';
    render(<BookingsModule />);
    expect(screen.getByText('Mesas caídas')).toBeTruthy();
  });
});

describe('BookingsModule con sesión', () => {
  beforeEach(() => {
    vi.useRealTimers();
    salon.hasSession = true;
    salon.currentUser = { id: 'u-1', name: 'Diego', role: 'sucursal', empresaId: 'e-1', branchId: 's-1' };
    vivo.status = 'connected';
  });

  it('carga mesas y reservas de la API y muestra el canal en vivo', async () => {
    render(<BookingsModule view="agenda" />);
    await waitFor(() => expect(api.listMesas).toHaveBeenCalled());
    expect(salon.refreshReservations).toHaveBeenCalledWith(expect.any(String));
    expect(screen.getAllByText('En vivo').length).toBeGreaterThan(0);
  });

  it('crea una reserva contra la API', async () => {
    render(<BookingsModule view="agenda" />);
    await waitFor(() => expect(api.listMesas).toHaveBeenCalled());
    fireEvent.click(screen.getByText('+ Nueva reserva'));
    fireEvent.change(screen.getByPlaceholderText('Ej. Camila Duarte'), { target: { value: 'Ana' } });
    const mesaSelect = screen.getByRole('combobox');
    fireEvent.change(mesaSelect, { target: { value: '1' } });
    fireEvent.click(screen.getByText('Crear reserva'));

    await waitFor(() =>
      expect(api.createReserva).toHaveBeenCalledWith(
        expect.objectContaining({
          mesaId: 'tm-1',
          clienteNombre: 'Ana',
          comensales: 2,
        }),
      ),
    );
    expect(salon.refreshReservations).toHaveBeenCalled();
    expect(salon.notify).toHaveBeenCalledWith('Reserva creada', expect.any(String));
  });

  it('exige mesa de la API y avisa si falla el guardado', async () => {
    api.listMesas.mockResolvedValue([]);
    api.createReserva.mockRejectedValue(new Error('Aforo excedido'));
    render(<BookingsModule view="agenda" />);
    await waitFor(() => expect(screen.queryByText('Cargando…')).toBeNull());
    fireEvent.click(screen.getByText('+ Nueva reserva'));
    fireEvent.change(screen.getByPlaceholderText('Ej. Camila Duarte'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Crear reserva'));
    expect(salon.notify).toHaveBeenCalledWith(
      'Elige una mesa',
      'La reserva debe estar asociada a una mesa del salón.',
    );
    expect(api.createReserva).not.toHaveBeenCalled();
  });

  it('actualiza una reserva existente por la API', async () => {
    render(<BookingsModule view="agenda" />);
    await waitFor(() => expect(api.listMesas).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Editar'));
    fireEvent.click(screen.getByText('Guardar cambios'));
    await waitFor(() =>
      expect(api.updateReserva).toHaveBeenCalledWith('r-1', expect.objectContaining({ mesaId: 'tm-1' })),
    );
    expect(salon.notify).toHaveBeenCalledWith('Reserva actualizada', expect.any(String));
  });

  it('confirma, cancela y marca no-show por la API', async () => {
    render(<BookingsModule view="agenda" />);
    await waitFor(() => expect(api.listMesas).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Confirmar'));
    await waitFor(() =>
      expect(api.updateReservaEstado).toHaveBeenCalledWith('r-1', 'CONFIRMADA'),
    );

    fireEvent.click(screen.getAllByText('No-show')[0]!);
    fireEvent.click(screen.getAllByText('Marcar no-show').at(-1)!);
    await waitFor(() =>
      expect(api.updateReservaEstado).toHaveBeenCalledWith('r-2', 'NO_SHOW'),
    );
  });

  it('registra la llegada por la API y abre la cuenta', async () => {
    salon.reservations = [reserva({ id: 'r-2', customer: 'Jorge', status: 'confirmada' })];
    render(<BookingsModule view="agenda" />);
    await waitFor(() => expect(api.listMesas).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Llegó'));
    await waitFor(() =>
      expect(api.updateReservaEstado).toHaveBeenCalledWith('r-2', 'EJECUTADA'),
    );
    expect(salon.openAccount).toHaveBeenCalledWith(expect.objectContaining({ tableId: 1 }));
    expect(salon.notify).toHaveBeenCalledWith('Reserva en curso', expect.any(String));
  });

  it('avisa si falla un cambio de estado de reserva', async () => {
    api.updateReservaEstado.mockRejectedValue(new Error('Sin cupo'));
    render(<BookingsModule view="agenda" />);
    await waitFor(() => expect(api.listMesas).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Confirmar'));
    await waitFor(() =>
      expect(salon.notify).toHaveBeenCalledWith('No se pudo actualizar la reserva', 'Sin cupo'),
    );
  });

  it('bloquea y desbloquea la mesa contra la API', async () => {
    salon.reservations = [];
    render(<BookingsModule />);
    await waitFor(() => expect(api.listMesas).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /Mesa 1/ }));
    fireEvent.click(screen.getByText('Bloquear mesa'));
    fireEvent.click(screen.getByText('Bloquear'));
    await waitFor(() =>
      expect(api.updateMesaEstado).toHaveBeenCalledWith('tm-1', 'MANTENIMIENTO'),
    );
    expect(salon.notify).toHaveBeenCalledWith('Mesa bloqueada', 'Mesa 1');

    salon.tables = [{ ...mesa, apiId: 'tm-1', blocked: true, status: 'reservada' }];
    fireEvent.click(screen.getByRole('button', { name: /Mesa 1/ }));
    fireEvent.click(screen.getByText('Desbloquear mesa'));
    fireEvent.click(screen.getByText('Desbloquear'));
    await waitFor(() => expect(api.updateMesaEstado).toHaveBeenCalledWith('tm-1', 'LIBRE'));
  });

  it('avisa si falla el bloqueo de mesa', async () => {
    api.updateMesaEstado.mockRejectedValue(new Error('Mesa con comanda'));
    salon.reservations = [];
    render(<BookingsModule />);
    await waitFor(() => expect(api.listMesas).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /Mesa 1/ }));
    fireEvent.click(screen.getByText('Bloquear mesa'));
    fireEvent.click(screen.getByText('Bloquear'));
    await waitFor(() =>
      expect(salon.notify).toHaveBeenCalledWith('No se pudo cambiar la mesa', 'Mesa con comanda'),
    );
  });
});


