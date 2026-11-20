import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MockFacturacionAdapter,
  cpeFromReceipt,
  getFacturacionPort,
} from './facturacion';
import type { Receipt } from './erp';

const recibo = (overrides: Partial<Receipt> = {}): Receipt =>
  ({
    id: 'B001-1',
    type: '03',
    at: '2026-11-20T12:00:00.000Z',
    date: '20 Nov 2026',
    customer: 'Ana',
    docType: '',
    docNumber: '',
    subtotal: 50,
    igv: 9,
    total: 59,
    status: 'Emitida',
    source: 'Mesa 4',
    estadoSunat: 'en_cola',
    intentosEnvio: 0,
    ...overrides,
  }) as Receipt;

afterEach(() => {
  vi.useRealTimers();
});

describe('cpeFromReceipt', () => {
  it('arma el payload UBL-ready desde el comprobante', () => {
    expect(cpeFromReceipt(recibo({ refId: 'F001-1', motivoAnulacion: 'Error' }))).toEqual({
      id: 'B001-1',
      type: '03',
      at: '2026-11-20T12:00:00.000Z',
      customer: 'Ana',
      docType: '',
      docNumber: '',
      subtotal: 50,
      igv: 9,
      total: 59,
      refId: 'F001-1',
      motivo: 'Error',
    });
  });
});

describe('MockFacturacionAdapter', () => {
  it('acepta una boleta al consumidor final y emite CDR numerado', async () => {
    vi.useFakeTimers();
    const adapter = new MockFacturacionAdapter();
    const promesa = adapter.enviar(cpeFromReceipt(recibo()));
    await vi.advanceTimersByTimeAsync(300);
    const resultado = await promesa;

    expect(resultado.estado).toBe('aceptado');
    expect(resultado.mensaje).toMatch(/CDR emitido/);
    expect(resultado.cdr?.numero).toBe('0000-0000-0000001');
    expect(resultado.cdr?.codigo).toBe('0');
  });

  it('rechaza una factura sin RUC', async () => {
    vi.useFakeTimers();
    const adapter = new MockFacturacionAdapter();
    const promesa = adapter.enviar(cpeFromReceipt(recibo({ type: '01' })));
    await vi.advanceTimersByTimeAsync(300);
    const resultado = await promesa;
    expect(resultado.estado).toBe('rechazado');
    expect(resultado.mensaje).toMatch(/Factura requiere RUC/);
    expect(resultado.cdr?.codigo).toBe('2800');
  });

  it('rechaza RUC y DNI con dígito inválido', async () => {
    vi.useFakeTimers();
    const adapter = new MockFacturacionAdapter();
    const factura = adapter.enviar(
      cpeFromReceipt(recibo({ type: '01', docType: '6', docNumber: '20123456789' })),
    );
    await vi.advanceTimersByTimeAsync(300);
    expect((await factura).mensaje).toMatch(/RUC inválido/);

    const boleta = adapter.enviar(
      cpeFromReceipt(recibo({ type: '03', docType: '1', docNumber: '123' })),
    );
    await vi.advanceTimersByTimeAsync(300);
    expect((await boleta).mensaje).toMatch(/DNI inválido/);
  });

  it('acepta factura con RUC válido y boleta con DNI válido', async () => {
    vi.useFakeTimers();
    const adapter = new MockFacturacionAdapter();
    const factura = adapter.enviar(
      cpeFromReceipt(recibo({ type: '01', docType: '6', docNumber: '20123456786' })),
    );
    await vi.advanceTimersByTimeAsync(300);
    expect((await factura).estado).toBe('aceptado');

    const boleta = adapter.enviar(
      cpeFromReceipt(recibo({ type: '03', docType: '1', docNumber: '12345678' })),
    );
    await vi.advanceTimersByTimeAsync(300);
    expect((await boleta).estado).toBe('aceptado');
  });

  it('en contingencia deja el comprobante en cola sin CDR', async () => {
    vi.useFakeTimers();
    const adapter = new MockFacturacionAdapter();
    adapter.setContingencia(true);
    expect(adapter.isContingencia()).toBe(true);

    const envio = adapter.enviar(cpeFromReceipt(recibo()));
    await vi.advanceTimersByTimeAsync(300);
    const resultado = await envio;
    expect(resultado.estado).toBe('en_cola');
    expect(resultado.cdr).toBeUndefined();
  });

  it('procesa el resumen diario y lo deja en cola si hay contingencia', async () => {
    vi.useFakeTimers();
    const adapter = new MockFacturacionAdapter();
    const resumen = adapter.enviarBaja(['B001-1', 'B001-2']);
    await vi.advanceTimersByTimeAsync(250);
    const aceptado = await resumen;
    expect(aceptado.estado).toBe('aceptado');
    expect(aceptado.mensaje).toMatch(/2 documento/);

    adapter.setContingencia(true);
    const enCola = adapter.enviarBaja(['B001-3']);
    await vi.advanceTimersByTimeAsync(250);
    expect((await enCola).estado).toBe('en_cola');
  });
});

describe('getFacturacionPort', () => {
  it('devuelve siempre el mismo adaptador (singleton)', () => {
    expect(getFacturacionPort()).toBe(getFacturacionPort());
    expect(getFacturacionPort()).toBeInstanceOf(MockFacturacionAdapter);
  });
});
