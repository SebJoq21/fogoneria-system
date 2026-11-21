import { beforeEach, describe, expect, it, vi } from 'vitest';

const cliente = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  request: vi.fn(),
}));

vi.mock('@fogoneria/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@fogoneria/sdk')>();
  return { ...actual, createClient: () => cliente };
});

import { comprobanteARecibo, comprobantesApi, toComprobante } from './api';

const apiComprobante = {
  id: 'c-1',
  sucursal_id: 's-1',
  tipo: 'BOLETA',
  serie_numero: 'B001-00000042',
  orden_id: 'orden-uuid-123456',
  cliente_ref: null,
  total: '59.00',
  estado: 'PAGADA',
  emitido_por: 'u-1',
  anulado_por: null,
  anulado_at: null,
  motivo_anulacion: null,
  created_at: '2026-11-20T15:00:00.000Z',
  ordenes: { id: 'orden-uuid-123456', numero_orden: 'ORD-000123' },
};

beforeEach(() => {
  for (const fn of Object.values(cliente)) fn.mockReset();
});

describe('toComprobante', () => {
  it('traduce los campos y la orden anidada', () => {
    expect(toComprobante(apiComprobante)).toMatchObject({
      id: 'c-1',
      tipo: 'BOLETA',
      serieNumero: 'B001-00000042',
      ordenNumero: 'ORD-000123',
      total: 59,
      estado: 'PAGADA',
    });
  });

  it('cae a BOLETA/PAGADA y orden null ante valores raros', () => {
    const comprobante = toComprobante({
      ...apiComprobante,
      tipo: 'OTRO',
      estado: 'EMITIDA',
      total: null as unknown as string,
      ordenes: null,
    });
    expect(comprobante.tipo).toBe('BOLETA');
    expect(comprobante.estado).toBe('PAGADA');
    expect(comprobante.total).toBe(0);
    expect(comprobante.ordenNumero).toBeNull();
  });
});

describe('comprobanteARecibo', () => {
  it('deriva base e IGV y deja SUNAT pendiente de OSE', () => {
    const recibo = comprobanteARecibo(toComprobante(apiComprobante));
    expect(recibo).toMatchObject({
      id: 'B001-00000042',
      type: '03',
      customer: 'Consumidor final',
      docNumber: '',
      subtotal: 50,
      igv: 9,
      total: 59,
      status: 'Emitida',
      source: 'ORD-000123',
      estadoSunat: 'en_cola',
      mensajeSunat: 'Pendiente de OSE',
    });
  });

  it('usa el documento del cliente y la serie de factura o nota de crédito', () => {
    const factura = comprobanteARecibo(
      toComprobante({ ...apiComprobante, tipo: 'FACTURA', cliente_ref: '20123456786' }),
    );
    expect(factura).toMatchObject({ type: '01', customer: '20123456786' });
    const nota = comprobanteARecibo(
      toComprobante({ ...apiComprobante, tipo: 'NOTA_CREDITO' }),
    );
    expect(nota.type).toBe('07');
  });

  it('marca anulada y conserva el motivo; usa el id corto si no hay folio', () => {
    const recibo = comprobanteARecibo(
      toComprobante({
        ...apiComprobante,
        estado: 'ANULADA',
        motivo_anulacion: 'Error de emisión',
        ordenes: null,
      }),
    );
    expect(recibo.status).toBe('Anulada');
    expect(recibo.motivoAnulacion).toBe('Error de emisión');
    expect(recibo.source).toBe('orden-uu');
  });
});

describe('comprobantesApi', () => {
  it('lista con los filtros del día y el tipo', async () => {
    cliente.get.mockResolvedValue({ items: [apiComprobante], total: 1, page: 1, limit: 20 });
    const items = await comprobantesApi.listar({
      fecha: '2026-11-20',
      tipo: 'BOLETA',
      estado: 'PAGADA',
      limit: 20,
    });
    expect(cliente.get).toHaveBeenCalledWith(
      '/receipts?fecha=2026-11-20&tipo=BOLETA&estado=PAGADA&limit=20',
      { signal: undefined },
    );
    expect(items).toHaveLength(1);
  });

  it('lista sin filtros y tolera una respuesta sin items', async () => {
    cliente.get.mockResolvedValue({});
    await expect(comprobantesApi.listar()).resolves.toEqual([]);
    expect(cliente.get).toHaveBeenCalledWith('/receipts', { signal: undefined });
  });

  it('emite con cliente opcional', async () => {
    cliente.post.mockResolvedValue({
      comprobante: { ...apiComprobante, tipo: 'FACTURA' },
      desglose: { base: 50, igv: 9, total: 59, tasa: 18 },
    });
    const { comprobante, desglose } = await comprobantesApi.emitir({
      ordenId: 'orden-uuid-123456',
      tipo: 'FACTURA',
      clienteRef: '20123456786',
    });
    expect(cliente.post).toHaveBeenCalledWith('/receipts', {
      ordenId: 'orden-uuid-123456',
      tipo: 'FACTURA',
      clienteRef: '20123456786',
    });
    expect(comprobante.tipo).toBe('FACTURA');
    expect(desglose.igv).toBe(9);
  });

  it('emite sin clienteRef cuando el cajero no lo escribió', async () => {
    cliente.post.mockResolvedValue({
      comprobante: apiComprobante,
      desglose: { base: 50, igv: 9, total: 59, tasa: 18 },
    });
    await comprobantesApi.emitir({ ordenId: 'orden-uuid-123456', tipo: 'BOLETA' });
    expect(cliente.post).toHaveBeenCalledWith('/receipts', {
      ordenId: 'orden-uuid-123456',
      tipo: 'BOLETA',
    });
  });

  it('anula con el motivo y devuelve el comprobante actualizado', async () => {
    cliente.post.mockResolvedValue({
      comprobante: { ...apiComprobante, estado: 'ANULADA', motivo_anulacion: 'Duplicado' },
      desglose: { base: 50, igv: 9, total: 59, tasa: 18 },
    });
    const { comprobante } = await comprobantesApi.anular('c-1', 'Duplicado');
    expect(cliente.post).toHaveBeenCalledWith('/receipts/c-1/void', { motivo: 'Duplicado' });
    expect(comprobante.estado).toBe('ANULADA');
    expect(comprobante.motivoAnulacion).toBe('Duplicado');
  });
});
