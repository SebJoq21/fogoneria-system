// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  hasSession: false,
  receipts: [] as unknown[],
  setReceipts: vi.fn(),
  annulReceipt: vi.fn(),
  enviarSunat: vi.fn(),
  generarResumenDiario: vi.fn(),
  sunatContingencia: false,
  toggleSunatContingencia: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

const api = vi.hoisted(() => ({ listar: vi.fn(), emitir: vi.fn(), anular: vi.fn() }));
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  comprobantesApi: api,
  comprobanteARecibo: () => ({
    id: 'B001-1',
    type: '03',
    at: '2026-11-20T12:00:00.000Z',
    date: 'Hoy',
    customer: 'Ana',
    docType: '',
    docNumber: '',
    subtotal: 50,
    igv: 9,
    total: 59,
    status: 'Pagada',
    source: 'ORD-1',
    estadoSunat: 'en_cola',
    intentosEnvio: 0,
  }),
}));

const ordenes = vi.hoisted(() => ({ listOrders: vi.fn() }));
vi.mock('@/lib/orders-api', () => ({ listOrders: ordenes.listOrders }));

import { ComprobantesPage } from './ComprobantesPage';

const recibo = (overrides: Record<string, unknown> = {}) => ({
  id: 'B001-1',
  type: '03',
  at: '2026-11-20T12:00:00.000Z',
  date: 'Hoy',
  customer: 'Ana',
  docType: '',
  docNumber: '',
  subtotal: 50,
  igv: 9,
  total: 59,
  status: 'Pagada',
  source: 'Mesa 4',
  estadoSunat: 'en_cola',
  intentosEnvio: 0,
  ...overrides,
});

const comprobante = (overrides: Record<string, unknown> = {}) => ({
  id: 'c-1',
  sucursalId: 's-1',
  tipo: 'BOLETA',
  serieNumero: 'B001-1',
  ordenId: 'o-1',
  ordenNumero: 'ORD-1',
  clienteRef: '20123456786',
  total: 118,
  estado: 'PAGADA',
  emitidoPor: null,
  anuladoPor: null,
  anuladoAt: null,
  motivoAnulacion: null,
  createdAt: '2026-11-20T12:00:00.000Z',
  ...overrides,
});

const ordenApi = { id: 'o-1', numero_orden: 'ORD-1', total: '118', origen: 'MESA' };

beforeEach(() => {
  estado.hasSession = false;
  estado.receipts = [
    recibo({ id: 'B001-1', customer: 'Ana', cdr: { numero: '0000-1', fecha: 'Hoy', codigo: '0', mensaje: 'OK' } }),
    recibo({ id: 'B001-2', type: '03', status: 'Anulada', motivoAnulacion: 'Duplicado', bajaResumenId: 'RC-pendiente' }),
  ];
  estado.sunatContingencia = false;
  for (const fn of [
    estado.setReceipts,
    estado.annulReceipt,
    estado.enviarSunat,
    estado.generarResumenDiario,
    estado.toggleSunatContingencia,
    estado.notify,
  ]) {
    fn.mockReset();
  }
  estado.generarResumenDiario.mockReturnValue({ resumenId: 'RC-1', count: 1 });
  for (const fn of Object.values(api)) fn.mockReset();
  api.listar.mockResolvedValue([comprobante()]);
  api.emitir.mockResolvedValue({
    comprobante: { ...comprobante(), id: 'c-2', serieNumero: 'B001-2' },
  });
  api.anular.mockResolvedValue({});
  ordenes.listOrders.mockReset().mockResolvedValue({ items: [ordenApi], total: 1, page: 1, limit: 50 });
});

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});

afterEach(cleanup);

function irAGestion() {
  fireEvent.click(screen.getAllByRole('button', { name: 'Emitir comprobante' })[0]!);
}

describe('ComprobantesPage demo', () => {
  it('envía a SUNAT, muestra el CDR y anula con motivo', () => {
    render(<ComprobantesPage />);
    irAGestion();
    fireEvent.click(screen.getAllByText('Enviar')[0]);
    expect(estado.enviarSunat).toHaveBeenCalled();

    fireEvent.click(screen.getByText('CDR'));
    expect(screen.getByText('0000-1')).toBeTruthy();
    fireEvent.click(screen.getByText('Cerrar'));

    fireEvent.click(screen.getByText('Anular'));
    fireEvent.change(screen.getByPlaceholderText('Ej. Error en los datos del cliente'), {
      target: { value: 'Error de datos' },
    });
    fireEvent.click(screen.getByText('Anular comprobante'));
    expect(estado.annulReceipt).toHaveBeenCalledWith('B001-1', 'Error de datos');
  });

  it('genera el resumen diario y alterna contingencia', () => {
    render(<ComprobantesPage />);
    irAGestion();
    fireEvent.click(screen.getByText(/Resumen diario/));
    expect(estado.generarResumenDiario).toHaveBeenCalled();
    expect(estado.notify).toHaveBeenCalledWith('Resumen diario generado', expect.any(String));

    fireEvent.click(screen.getByText(/Contingencia SUNAT/));
    expect(estado.toggleSunatContingencia).toHaveBeenCalled();
    expect(estado.notify).toHaveBeenCalledWith('Contingencia activada', expect.any(String));
  });

  it('emite una boleta demo y la agrega a la lista', () => {
    render(<ComprobantesPage />);
    irAGestion();
    fireEvent.click(screen.getByText('+ Emitir comprobante'));
    fireEvent.change(screen.getByPlaceholderText('Ej. Mesa 4'), { target: { value: 'Mesa 4' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '59' } });
    fireEvent.click(screen.getByText('Emitir'));
    expect(estado.setReceipts).toHaveBeenCalled();
    expect(estado.enviarSunat).toHaveBeenCalled();
  });

  it('valida factura con RUC y muestra la nota de crédito', () => {
    render(<ComprobantesPage />);
    irAGestion();
    fireEvent.click(screen.getByText('+ Emitir comprobante'));
    fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: '01' } });
    fireEvent.change(screen.getByPlaceholderText('Ej. Mesa 4'), { target: { value: 'Mesa 4' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '118' } });
    expect(screen.getByText('Emitir').closest('button')!.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText('20123456789'), { target: { value: '20123456786' } });
    fireEvent.click(screen.getByText('Emitir'));
    expect(estado.setReceipts.mock.calls[0]![0][0]).toEqual(
      expect.objectContaining({ type: '01', docType: '6', docNumber: '20123456786' }),
    );
  });

  it('navega desde el panel a la tabla de emitidos', async () => {
    render(<ComprobantesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Emitidos/ }));
    expect(await screen.findByText('Número')).toBeTruthy();
  });
});

describe('ComprobantesPage con sesión', () => {
  beforeEach(() => {
    estado.hasSession = true;
  });

  it('lista comprobantes y comandas pagadas desde la API', async () => {
    render(<ComprobantesPage />);
    await waitFor(() => expect(api.listar).toHaveBeenCalled());
    irAGestion();
    await waitFor(() => expect(screen.getByText('B001-1')).toBeTruthy());
    expect(screen.getByText('Pendiente de OSE')).toBeTruthy();
    expect(screen.getByText('Ana')).toBeTruthy();
  });

  it('emite una boleta sobre una comanda pagada', async () => {
    render(<ComprobantesPage />);
    await waitFor(() => expect(ordenes.listOrders).toHaveBeenCalled());
    irAGestion();
    fireEvent.click(screen.getByText('+ Emitir comprobante'));
    await waitFor(() => expect(screen.getByText(/ORD-1/)).toBeTruthy());
    fireEvent.change(screen.getAllByRole('combobox').at(-1)!, { target: { value: 'o-1' } });
    fireEvent.click(screen.getByText('Emitir'));

    await waitFor(() =>
      expect(api.emitir).toHaveBeenCalledWith({ ordenId: 'o-1', tipo: 'BOLETA' }),
    );
    expect(estado.notify).toHaveBeenCalledWith('Comprobante emitido', expect.stringContaining('B001-2'));
    await waitFor(() => expect(api.listar).toHaveBeenCalledTimes(2));
  });

  it('emite una factura con RUC como referencia del cliente', async () => {
    render(<ComprobantesPage />);
    await waitFor(() => expect(ordenes.listOrders).toHaveBeenCalled());
    irAGestion();
    fireEvent.click(screen.getByText('+ Emitir comprobante'));
    await waitFor(() => expect(screen.getByText(/ORD-1/)).toBeTruthy());
    fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: '01' } });
    fireEvent.change(screen.getByPlaceholderText('20123456789'), { target: { value: '20123456786' } });
    fireEvent.change(screen.getAllByRole('combobox').at(-1)!, { target: { value: 'o-1' } });
    fireEvent.click(screen.getByText('Emitir'));

    await waitFor(() =>
      expect(api.emitir).toHaveBeenCalledWith({
        ordenId: 'o-1',
        tipo: 'FACTURA',
        clienteRef: '20123456786',
      }),
    );
  });

  it('avisa si la emisión falla', async () => {
    api.emitir.mockRejectedValue(new Error('La comanda no está pagada'));
    render(<ComprobantesPage />);
    await waitFor(() => expect(ordenes.listOrders).toHaveBeenCalled());
    irAGestion();
    fireEvent.click(screen.getByText('+ Emitir comprobante'));
    await waitFor(() => expect(screen.getByText(/ORD-1/)).toBeTruthy());
    fireEvent.change(screen.getAllByRole('combobox').at(-1)!, { target: { value: 'o-1' } });
    fireEvent.click(screen.getByText('Emitir'));
    await waitFor(() =>
      expect(estado.notify).toHaveBeenCalledWith('No se pudo emitir', 'La comanda no está pagada'),
    );
  });

  it('anula por UUID y avisa si el comprobante ya no está', async () => {
    render(<ComprobantesPage />);
    await waitFor(() => expect(api.listar).toHaveBeenCalled());
    irAGestion();
    await waitFor(() => expect(screen.getByText('Anular')).toBeTruthy());
    fireEvent.click(screen.getByText('Anular'));
    fireEvent.change(screen.getByPlaceholderText('Ej. Error en los datos del cliente'), {
      target: { value: 'Error de datos' },
    });
    fireEvent.click(screen.getByText('Anular comprobante'));
    await waitFor(() => expect(api.anular).toHaveBeenCalledWith('c-1', 'Error de datos'));
    expect(estado.notify).toHaveBeenCalledWith('Comprobante anulado', expect.stringContaining('B001-1'));
  });

  it('avisa los errores de anulación y de carga', async () => {
    api.anular.mockRejectedValue(new Error('Sin turno'));
    const { unmount } = render(<ComprobantesPage />);
    await waitFor(() => expect(api.listar).toHaveBeenCalled());
    irAGestion();
    await waitFor(() => expect(screen.getByText('Anular')).toBeTruthy());
    fireEvent.click(screen.getByText('Anular'));
    fireEvent.change(screen.getByPlaceholderText('Ej. Error en los datos del cliente'), {
      target: { value: 'Error' },
    });
    fireEvent.click(screen.getByText('Anular comprobante'));
    await waitFor(() =>
      expect(estado.notify).toHaveBeenCalledWith('No se pudo anular', 'Sin turno'),
    );

    unmount();
    api.listar.mockRejectedValue(new Error('API caída'));
    render(<ComprobantesPage />);
    irAGestion();
    await waitFor(() => expect(screen.getByText(/API caída/)).toBeTruthy());
  });
});



