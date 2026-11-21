// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  hasSession: false,
  customers: [] as unknown[],
  setCustomers: vi.fn(),
  notify: vi.fn(),
  activeBranchId: 's-1',
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

const api = vi.hoisted(() => ({
  listar: vi.fn(),
  ficha: vi.fn(),
  crear: vi.fn(),
  ajustarPuntos: vi.fn(),
}));
vi.mock('./api', () => ({ crmApi: api }));

import { ClientesPage } from './ClientesPage';

const cliente = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Rosa Pérez',
  phone: '+51 987 654 321',
  email: '',
  segment: 'VIP',
  visits: 21,
  points: 1240,
  lastVisit: 'Hoy',
  birthday: '',
  notes: '',
  ...overrides,
});

const apiCliente = {
  id: 'c-1',
  nombre: 'Rosa Pérez',
  telefono: '987654321',
  segmento: 'VIP',
  visitas: 21,
  puntos: 1240,
  ultimaVisita: '2026-11-19',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const detalle = {
  ...apiCliente,
  movimientos: [
    { id: 'm-1', tipo: 'GANANCIA', puntos: 12, motivo: 'Consumo', ordenId: 'o-1', createdAt: '2026-11-19' },
    { id: 'm-2', tipo: 'CANJE', puntos: 5, motivo: null, ordenId: null, createdAt: '2026-11-20' },
  ],
};

beforeEach(() => {
  estado.hasSession = false;
  estado.activeBranchId = 's-1';
  estado.customers = [
    cliente(),
    cliente({ id: 2, name: 'Jorge', phone: '+51 955 128 774', segment: 'Nuevo', points: 10 }),
  ];
  estado.setCustomers.mockReset();
  estado.notify.mockReset();
  for (const fn of Object.values(api)) fn.mockReset();
  api.listar.mockResolvedValue({ items: [apiCliente], total: 1, page: 1, limit: 100 });
  api.ficha.mockResolvedValue(detalle);
  api.crear.mockResolvedValue(apiCliente);
  api.ajustarPuntos.mockResolvedValue(detalle);
});

afterEach(cleanup);

describe('ClientesPage demo', () => {
  it('registra un cliente nuevo en el estado local', () => {
    render(<ClientesPage />);
    fireEvent.click(screen.getByText('+ Nuevo cliente'));
    fireEvent.change(screen.getByPlaceholderText(/Rosa/), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByPlaceholderText(/999 888/), { target: { value: '987654321' } });
    fireEvent.click(screen.getByText('Registrar cliente'));
    expect(estado.setCustomers).toHaveBeenCalled();
    expect(estado.notify).toHaveBeenCalledWith('Cliente registrado', expect.any(String));
  });
});

describe('ClientesPage con sesión', () => {
  it('lista desde la API y abre la ficha con movimientos', async () => {
    estado.hasSession = true;
    render(<ClientesPage />);
    await waitFor(() => expect(screen.getByText('Rosa Pérez')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Rosa Pérez/ }));

    await waitFor(() => expect(api.ficha).toHaveBeenCalledWith('c-1'));
    await waitFor(() => expect(screen.getByText(/Consumo/)).toBeTruthy());
  });

  it('ajusta puntos válidos y recarga la ficha', async () => {
    estado.hasSession = true;
    render(<ClientesPage />);
    await waitFor(() => expect(screen.getByText('Rosa Pérez')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Rosa Pérez/ }));
    await waitFor(() => expect(screen.getByText('Ajustar puntos')).toBeTruthy());

    fireEvent.click(screen.getByText('Ajustar puntos'));
    fireEvent.change(screen.getByPlaceholderText(/Cortes.a por demora/), {
      target: { value: 'Cortesía' },
    });
    fireEvent.change(screen.getAllByRole('spinbutton')[0]!, { target: { value: '5' } });
    fireEvent.click(screen.getByText('Aplicar'));

    await waitFor(() =>
      expect(api.ajustarPuntos).toHaveBeenCalledWith('c-1', {
        tipo: 'GANANCIA',
        puntos: 5,
        sucursalId: 's-1',
        motivo: 'Cortesía',
      }),
    );
    expect(estado.notify).toHaveBeenCalledWith('Puntos actualizados', '+5 en Rosa Pérez.');
    await waitFor(() => expect(api.ficha).toHaveBeenCalledTimes(2));
  });

  it('rechaza un canje mayor al saldo sin llamar a la API', async () => {
    estado.hasSession = true;
    render(<ClientesPage />);
    await waitFor(() => expect(screen.getByText('Rosa Pérez')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Rosa Pérez/ }));
    await waitFor(() => expect(screen.getByText('Ajustar puntos')).toBeTruthy());
    fireEvent.click(screen.getByText('Ajustar puntos'));
    fireEvent.change(screen.getAllByRole('combobox')[1]!, { target: { value: 'CANJE' } });
    fireEvent.change(screen.getAllByRole('spinbutton')[0]!, { target: { value: '99999' } });
    fireEvent.click(screen.getByText('Aplicar'));

    expect(estado.notify).toHaveBeenCalledWith('Ajuste inválido', expect.any(String));
    expect(api.ajustarPuntos).not.toHaveBeenCalled();
  });

  it('registra cliente contra la API y muestra el error de listado', async () => {
    estado.hasSession = true;
    api.listar.mockRejectedValueOnce(new Error('CRM caído'));
    render(<ClientesPage />);
    await waitFor(() => expect(screen.getByText('CRM caído')).toBeTruthy());

    fireEvent.click(screen.getByText('+ Nuevo cliente'));
    fireEvent.change(screen.getByPlaceholderText(/Rosa/), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByPlaceholderText(/999 888/), { target: { value: '987654321' } });
    fireEvent.click(screen.getByText('Registrar cliente'));
    await waitFor(() => expect(api.crear).toHaveBeenCalledWith({ nombre: 'Ana', telefono: '987654321' }));
  });

  it('avisa si falla el alta o el ajuste', async () => {
    estado.hasSession = true;
    api.crear.mockRejectedValue(new Error('Teléfono duplicado'));
    api.ajustarPuntos.mockRejectedValue(new Error('Sin permiso'));
    api.ficha.mockRejectedValue(new Error('No existe'));
    render(<ClientesPage />);
    await waitFor(() => expect(screen.getByText('Rosa Pérez')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /Rosa Pérez/ }));
    await waitFor(() =>
      expect(estado.notify).toHaveBeenCalledWith('No se pudo abrir la ficha', 'No existe'),
    );

    fireEvent.click(screen.getByText('+ Nuevo cliente'));
    fireEvent.change(screen.getByPlaceholderText(/Rosa/), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByPlaceholderText(/999 888/), { target: { value: '987654321' } });
    fireEvent.click(screen.getByText('Registrar cliente'));
    await waitFor(() =>
      expect(estado.notify).toHaveBeenCalledWith('No se pudo registrar', 'Teléfono duplicado'),
    );
  });
});
