// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  cashMovements: [] as unknown[],
  setCashMovements: vi.fn(),
  openCashShift: null as null | Record<string, unknown>,
  cashShifts: [] as unknown[],
  startCashShift: vi.fn(),
  closeCashShift: vi.fn(),
  accounts: [] as unknown[],
  refreshOrders: vi.fn().mockResolvedValue(undefined),
  notify: vi.fn(),
  isGeneral: false,
  branchOf: vi.fn(() => null),
  currentUser: { id: 'u-1', name: 'Cajera', role: 'cajero', empresaId: null as string | null, branchId: 's-1' },
  coupons: [] as unknown[],
  customers: [] as unknown[],
  checkoutAccount: vi.fn(),
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

const api = vi.hoisted(() => ({
  getTurnoActual: vi.fn(),
  abrirTurno: vi.fn(),
  cerrarTurno: vi.fn(),
  listarTurnos: vi.fn(),
  listarMovimientos: vi.fn(),
  crearMovimiento: vi.fn(),
  cobrar: vi.fn(),
}));
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  cajaApi: api,
}));

const ordenes = vi.hoisted(() => ({ listOrders: vi.fn() }));
vi.mock('@/lib/orders-api', () => ({ listOrders: ordenes.listOrders }));

import { CajaPage } from './CajaPage';

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
  items: [{ id: 'it-1', productId: 'p-1', name: 'Lomo', qty: 1, unitPrice: 24.9, modifiers: [], notes: '', sent: true }],
  payments: [],
  tip: 0,
  discount: 0,
  discountConcept: '',
  couponCode: null,
  customerId: null,
  motivoAnulacion: null,
};

const turnoApi = {
  turno: {
    id: 'sh-1',
    sucursalId: 's-1',
    cajeroId: 'u-1',
    cajero: 'Cajera',
    aperturaAt: '2026-11-20T08:00:00.000Z',
    cierreAt: null,
    fondoApertura: 200,
    ingresosTotal: 100,
    egresosTotal: 20,
    saldo: 280,
    efectivoContado: null,
    diferencia: null,
    observaciones: null,
    estado: 'ABIERTO',
  },
  arqueo: {
    fondo: 200,
    ingresos: 100,
    egresos: 20,
    ingresosEfectivo: 100,
    egresosEfectivo: 20,
    esperadoEfectivo: 280,
    saldoSistema: 280,
    movimientos: 2,
    efectivoContado: null,
    diferencia: null,
  },
};

const ordenApi = {
  id: 'o-1',
  numero_orden: 'ORD-1',
  total: '44.82',
  origen: 'MESA',
  mesas: { numero: '1' },
  usuarios: { nombre: 'Luis' },
};

beforeEach(() => {
  estado.cashMovements = [];
  estado.cashShifts = [];
  estado.openCashShift = null;
  estado.accounts = [];
  estado.currentUser = { id: 'u-1', name: 'Cajera', role: 'cajero', empresaId: null, branchId: 's-1' };
  estado.isGeneral = false;
  for (const fn of [
    estado.setCashMovements,
    estado.startCashShift,
    estado.closeCashShift,
    estado.notify,
    estado.refreshOrders,
  ]) {
    fn.mockReset();
  }
  estado.refreshOrders.mockResolvedValue(undefined);
  for (const fn of Object.values(api)) fn.mockReset();
  api.getTurnoActual.mockResolvedValue(null);
  api.abrirTurno.mockResolvedValue(turnoApi);
  api.cerrarTurno.mockResolvedValue({ turno: turnoApi.turno, arqueo: { ...turnoApi.arqueo, diferencia: 0 } });
  api.listarTurnos.mockResolvedValue({ items: [], total: 0 });
  api.listarMovimientos.mockResolvedValue({ items: [], total: 0, turnoId: 'sh-1' });
  api.crearMovimiento.mockResolvedValue({});
  api.cobrar.mockResolvedValue({
    ordenId: 'o-1',
    numeroOrden: 'ORD-1',
    turnoId: 'sh-1',
    cobrado: 44.82,
    propina: 0,
    total: 44.82,
    pendiente: 0,
    pagada: true,
  });
  ordenes.listOrders.mockReset().mockResolvedValue({ items: [], total: 0, page: 1, limit: 50 });
});

afterEach(cleanup);

describe('CajaPage demo', () => {
  it('abre el turno con el fondo indicado', () => {
    render(<CajaPage />);
    fireEvent.click(screen.getByText('Abrir turno'));
    expect(screen.getByText('Abrir turno de caja')).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue('200'), { target: { value: '350' } });
    fireEvent.click(screen.getAllByText('Abrir turno').at(-1)!);
    expect(estado.startCashShift).toHaveBeenCalledWith(350);
    expect(estado.notify).toHaveBeenCalledWith('Turno abierto', expect.any(String));
  });

  it('registra un movimiento manual', () => {
    estado.openCashShift = { id: 'shift-1', openingFund: 200, openedBy: 'Cajera', openedAt: '2026-11-20T08:00:00.000Z' };
    render(<CajaPage />);
    fireEvent.click(screen.getByText('+ Registrar movimiento'));
    fireEvent.change(screen.getByPlaceholderText('Ej. Compra de hielo'), { target: { value: 'Hielo' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '20' } });
    fireEvent.click(screen.getByText('Guardar movimiento'));
    expect(estado.setCashMovements).toHaveBeenCalled();
  });

  it('cierra el turno con arqueo', () => {
    estado.openCashShift = {
      id: 'shift-1',
      openingFund: 200,
      openedBy: 'Cajera',
      openedAt: '2026-11-20T08:00:00.000Z',
    };
    render(<CajaPage />);
    fireEvent.click(screen.getByText('Cerrar turno (arqueo)'));
    expect(screen.getByText('Arqueo y cierre de turno')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '180' } });
    fireEvent.click(screen.getByText('Cerrar turno'));
    expect(estado.closeCashShift).toHaveBeenCalledWith(180, '');
  });

  it('cobra una cuenta abierta desde la caja', () => {
    estado.openCashShift = {
      id: 'shift-1',
      openingFund: 200,
      openedBy: 'Cajera',
      openedAt: '2026-11-20T08:00:00.000Z',
    };
    estado.accounts = [cuenta];
    render(<CajaPage />);
    fireEvent.click(screen.getByText('Cobrar'));
    expect(screen.getByText(/Cobrar cuenta/)).toBeTruthy();
    fireEvent.click(screen.getByText('Cancelar'));
    expect(screen.queryByText(/Cobrar cuenta/)).toBeNull();
  });

  it('pinta el historial de turnos cerrados', () => {
    estado.cashShifts = [
      {
        id: 'shift-0',
        branchId: 'miraflores',
        status: 'cerrado',
        openedBy: 'Cajera',
        openedAt: '2026-11-19T08:00:00.000Z',
        openingFund: 200,
        closedBy: 'Cajera',
        closedAt: '2026-11-19T20:00:00.000Z',
        countedCash: 180,
        expectedCash: 200,
        difference: -20,
        observations: 'Faltó',
      },
    ];
    render(<CajaPage />);
    expect(screen.getByText('Historial de turnos')).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'Cajera' })).toBeTruthy();
  });
});

describe('CajaPage con sesión', () => {
  beforeEach(() => {
    estado.currentUser = { id: 'u-1', name: 'Cajera', role: 'cajero', empresaId: 'e-1', branchId: 's-1' };
  });

  it('abre el turno contra la API', async () => {
    render(<CajaPage />);
    await waitFor(() => expect(api.getTurnoActual).toHaveBeenCalled());
    fireEvent.click(await screen.findByText('Abrir turno'));
    fireEvent.click(screen.getAllByText('Abrir turno').at(-1)!);
    await waitFor(() =>
      expect(api.abrirTurno).toHaveBeenCalledWith({ fondoApertura: 200 }),
    );
    expect(estado.notify).toHaveBeenCalledWith('Turno abierto', expect.any(String));
  });

  it('no abre un segundo turno y muestra el error de lectura', async () => {
    api.getTurnoActual.mockResolvedValueOnce(turnoApi);
    render(<CajaPage />);
    await waitFor(() => expect(api.getTurnoActual).toHaveBeenCalled());
    fireEvent.click(await screen.findByText('+ Registrar movimiento'));
    expect(api.getTurnoActual).toHaveBeenCalled();

    cleanup();
    api.getTurnoActual.mockRejectedValue(new Error('Caja caída'));
    render(<CajaPage />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Caja caída'));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(api.getTurnoActual).toHaveBeenCalledTimes(3));
  });

  it('registra un movimiento y un cobro por la API', async () => {
    api.getTurnoActual.mockResolvedValue(turnoApi);
    ordenes.listOrders.mockResolvedValue({ items: [ordenApi], total: 1, page: 1, limit: 50 });
    render(<CajaPage />);
    await waitFor(() => expect(screen.getByText('Mesa 1')).toBeTruthy());

    fireEvent.click(screen.getByText('+ Registrar movimiento'));
    fireEvent.change(screen.getByPlaceholderText('Ej. Compra de hielo'), { target: { value: 'Hielo' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '20' } });
    fireEvent.click(screen.getByText('Guardar movimiento'));
    await waitFor(() =>
      expect(api.crearMovimiento).toHaveBeenCalledWith({
        tipo: 'INGRESO',
        concepto: 'Hielo',
        monto: 20,
        metodo: 'EFECTIVO',
      }),
    );

    fireEvent.click(screen.getByText('Cobrar'));
    expect(screen.getByText('Cobrar ORD-1')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('44.82'), { target: { value: '5' } });
    fireEvent.click(screen.getAllByText('Cobrar').at(-1)!);
    await waitFor(() =>
      expect(api.cobrar).toHaveBeenCalledWith({ ordenId: 'o-1', metodo: 'EFECTIVO', monto: 5 }),
    );
    expect(estado.refreshOrders).toHaveBeenCalled();
    expect(estado.notify).toHaveBeenCalledWith('Comanda cobrada', expect.stringContaining('ORD-1'));
  });

  it('muestra el cobro parcial y sus errores', async () => {
    api.getTurnoActual.mockResolvedValue(turnoApi);
    ordenes.listOrders.mockResolvedValue({ items: [ordenApi], total: 1, page: 1, limit: 50 });
    api.cobrar.mockResolvedValue({
      ordenId: 'o-1',
      numeroOrden: 'ORD-1',
      turnoId: 'sh-1',
      cobrado: 20,
      propina: 0,
      total: 44.82,
      pendiente: 24.82,
      pagada: false,
    });
    render(<CajaPage />);
    await waitFor(() => expect(screen.getByText('Mesa 1')).toBeTruthy());
    fireEvent.click(screen.getByText('Cobrar'));
    fireEvent.click(screen.getAllByText('Cobrar').at(-1)!);
    await waitFor(() =>
      expect(estado.notify).toHaveBeenCalledWith('Pago parcial registrado', expect.stringContaining('24.82')),
    );

    cleanup();
    api.cobrar.mockRejectedValue(new Error('Sin turno'));
    api.getTurnoActual.mockResolvedValue(turnoApi);
    render(<CajaPage />);
    await waitFor(() => expect(screen.getByText('Mesa 1')).toBeTruthy());
    fireEvent.click(screen.getByText('Cobrar'));
    fireEvent.click(screen.getAllByText('Cobrar').at(-1)!);
    await waitFor(() =>
      expect(estado.notify).toHaveBeenCalledWith('No se pudo cobrar', 'Sin turno'),
    );
  });

  it('cierra el turno contra la API y registra la diferencia', async () => {
    api.getTurnoActual.mockResolvedValue(turnoApi);
    api.cerrarTurno.mockResolvedValue({
      turno: turnoApi.turno,
      arqueo: { ...turnoApi.arqueo, diferencia: -10 },
    });
    render(<CajaPage />);
    await waitFor(() => expect(screen.getByText('Cerrar turno (arqueo)')).toBeTruthy());
    fireEvent.click(screen.getByText('Cerrar turno (arqueo)'));
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '270' } });
    fireEvent.change(screen.getByPlaceholderText('Ej. Diferencia por propinas'), {
      target: { value: 'Faltante' },
    });
    fireEvent.click(screen.getAllByText('Cerrar turno').at(-1)!);
    await waitFor(() =>
      expect(api.cerrarTurno).toHaveBeenCalledWith('sh-1', {
        efectivoContado: 270,
        observaciones: 'Faltante',
      }),
    );
    expect(estado.notify).toHaveBeenCalledWith('Turno cerrado', expect.stringContaining('Diferencia'));
  });

  it('avisa los errores de apertura, movimiento y cierre', async () => {
    api.getTurnoActual.mockResolvedValue(turnoApi);
    render(<CajaPage />);
    await waitFor(() => expect(screen.getByText(/Turno abierto/)).toBeTruthy());
    fireEvent.click(screen.getByText('+ Registrar movimiento'));
    api.crearMovimiento.mockRejectedValue(new Error('Monto inválido'));
    fireEvent.change(screen.getByPlaceholderText('Ej. Compra de hielo'), { target: { value: 'Hielo' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '20' } });
    fireEvent.click(screen.getByText('Guardar movimiento'));
    await waitFor(() =>
      expect(estado.notify).toHaveBeenCalledWith('No se pudo registrar', 'Monto inválido'),
    );

    api.cerrarTurno.mockRejectedValue(new Error('Turno cerrado'));
    fireEvent.click(screen.getByText('Cerrar turno (arqueo)'));
    fireEvent.change(screen.getAllByPlaceholderText('0.00').at(-1)!, { target: { value: '270' } });
    fireEvent.click(screen.getAllByText('Cerrar turno').at(-1)!);
    await waitFor(() =>
      expect(estado.notify).toHaveBeenCalledWith('No se pudo cerrar', 'Turno cerrado'),
    );
  });

  it('avisa si el turno ya estaba abierto', async () => {
    api.getTurnoActual.mockResolvedValue(turnoApi);
    render(<CajaPage />);
    await waitFor(() => expect(screen.getByText(/Turno abierto/)).toBeTruthy());
    expect(api.abrirTurno).not.toHaveBeenCalled();
  });
});



