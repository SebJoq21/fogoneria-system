import { afterEach, describe, expect, it, vi } from 'vitest';
import { listMovements, listShifts } from './cash-api';
import { getReceipt, listReceipts } from './receipts-api';
import {
  apiReservationStatusOf,
  limaDateKey,
  limaTimeOf,
  reservationFromApi,
  reservationsFromApi,
  reservationStatusFromApi,
  shapeFromApi,
  shapeToApi,
  tableNumberFromLabel,
} from './table-mapping';
import type { Table } from './erp';

const fetchMock = vi.fn();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch() {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(json({}));
}

describe('cash-api: consultas de turnos y movimientos', () => {
  it('arma la query del historial con todos los filtros', async () => {
    stubFetch();
    await listShifts({ desde: '2026-11-01', hasta: '2026-11-20', page: 2, limit: 10 });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/backend/cash/shifts?desde=2026-11-01&hasta=2026-11-20&page=2&limit=10',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('sin filtros no agrega query', async () => {
    stubFetch();
    await listShifts();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/backend/cash/shifts',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('filtra movimientos por turno y tipo', async () => {
    stubFetch();
    await listMovements({ turnoId: 't-1', tipo: 'EGRESO' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/backend/cash/movements?turnoId=t-1&tipo=EGRESO',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('sin filtros consulta el turno abierto', async () => {
    stubFetch();
    await listMovements();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/backend/cash/movements',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('receipts-api: consultas del comprobante', () => {
  it('arma la query con fecha, tipo, estado y paginación', async () => {
    stubFetch();
    await listReceipts({ fecha: '2026-11-20', tipo: 'BOLETA', estado: 'PAGADA', page: 1, limit: 20 });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/backend/receipts?fecha=2026-11-20&tipo=BOLETA&estado=PAGADA&page=1&limit=20',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('sin filtros no agrega query', async () => {
    stubFetch();
    await listReceipts();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/backend/receipts',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('busca el detalle por id', async () => {
    stubFetch();
    await getReceipt('c-1');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/backend/receipts/c-1',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('table-mapping: variantes de presentación', () => {
  it('traduce formas en ambos sentidos', () => {
    expect(shapeToApi('round')).toBe('REDONDA');
    expect(shapeToApi('rect')).toBe('RECTANGULAR');
    expect(shapeFromApi('REDONDA')).toBe('round');
    expect(shapeFromApi('RECTANGULAR')).toBe('rect');
    expect(shapeFromApi(null)).toBe('rect');
  });

  it('extrae el número de mesa de la etiqueta', () => {
    expect(tableNumberFromLabel('Mesa 12')).toBe('12');
    expect(tableNumberFromLabel('  mesa   7 ')).toBe('7');
    expect(tableNumberFromLabel('Terraza 3')).toBe('Terraza 3');
    expect(tableNumberFromLabel('123456789012345')).toBe('1234567890');
    expect(tableNumberFromLabel('   ')).toBe('');
  });

  it('maneja fechas inválidas y válidas de Lima', () => {
    expect(limaDateKey('no-fecha')).toBe('');
    expect(limaDateKey('2026-11-20T12:00:00.000Z')).toBe('2026-11-20');
    expect(limaTimeOf('no-fecha')).toBe('');
    expect(limaTimeOf('2026-11-20T15:00:00.000Z')).toMatch(/\d{2}:\d{2}/);
  });

  it('traduce los estados de reserva en ambos sentidos', () => {
    expect(reservationStatusFromApi('POR_CONFIRMAR')).toBe('por_confirmar');
    expect(reservationStatusFromApi('EJECUTADA')).toBe('llego');
    expect(reservationStatusFromApi('CANCELADA')).toBe('cancelada');
    expect(reservationStatusFromApi('NO_SHOW')).toBe('no_show');
    expect(reservationStatusFromApi('CONFIRMADA')).toBe('confirmada');
    expect(apiReservationStatusOf('por_confirmar')).toBe('POR_CONFIRMAR');
    expect(apiReservationStatusOf('llego')).toBe('EJECUTADA');
    expect(apiReservationStatusOf('cancelada')).toBe('CANCELADA');
    expect(apiReservationStatusOf('no_show')).toBe('NO_SHOW');
    expect(apiReservationStatusOf('confirmada')).toBe('CONFIRMADA');
  });

  it('mapea la reserva con mesa conocida, mesa ausente o mesa caída', () => {
    const tables = [
      { id: 4, label: 'Mesa 4', seats: 4, shape: 'rect', status: 'libre', zone: 'Salón', apiId: 'mesa-4' },
    ] as Table[];
    const api = {
      id: 'r-1',
      codigo: 'RSV-1',
      sucursal_id: 's-1',
      empresa_id: 'e-1',
      creada_por: null,
      mesa_id: 'mesa-4',
      cliente_nombre: 'Ana',
      telefono: null,
      nro_comensales: 4,
      fecha_hora: '2026-11-20T20:00:00-05:00',
      estado: 'CONFIRMADA' as const,
      canal: null,
      notas: null,
    };
    expect(reservationFromApi(api, tables)).toMatchObject({
      tableId: 4,
      tableApiId: 'mesa-4',
      phone: '',
      notes: '',
      time: expect.any(String),
    });

    const sinMesa = reservationFromApi(
      { ...api, mesa_id: null, mesas: null } as never,
      tables,
    );
    expect(sinMesa.tableId).toBeNull();
    expect(sinMesa.tableApiId).toBeNull();

    const mesaCaida = reservationFromApi({ ...api, mesa_id: 'mesa-9' }, tables);
    expect(mesaCaida.tableId).toBeNull();
    expect(reservationsFromApi([api], tables)).toHaveLength(1);
  });
});
