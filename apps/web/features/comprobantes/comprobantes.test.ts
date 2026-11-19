import { describe, expect, it } from 'vitest';
import {
  desgloseIgv,
  etiquetaEstadoComprobante,
  etiquetaTipoComprobante,
  serieDeTipo,
  validarEmision,
} from '@fogoneria/contracts/comprobantes';
import { comprobanteARecibo, toComprobante, type ApiComprobante } from './api';

const comprobanteApi: ApiComprobante = {
  id: 'c-1',
  sucursal_id: 's-1',
  tipo: 'FACTURA',
  serie_numero: 'F001-00000042',
  orden_id: 'o-1',
  cliente_ref: '20123456789',
  total: '118.00',
  estado: 'ANULADA',
  emitido_por: 'u-1',
  anulado_por: 'u-2',
  anulado_at: '2026-11-19T12:00:00.000Z',
  motivo_anulacion: 'Error de captura',
  created_at: '2026-11-19T11:00:00.000Z',
  ordenes: { id: 'o-1', numero_orden: 'ORD-000123', total: '118.00' },
};

describe('IGV de comprobantes', () => {
  it('desglosa un total que ya incluye 18 %', () => {
    expect(desgloseIgv(118)).toEqual({ base: 100, igv: 18, total: 118, tasa: 18 });
  });

  it('cierra al céntimo con totales quebrados', () => {
    const { base, igv, total } = desgloseIgv(36);
    expect(base).toBe(30.51);
    expect(igv).toBe(5.49);
    expect(Math.round((base + igv) * 100) / 100).toBe(total);
    expect(desgloseIgv(Number.NaN).total).toBe(0);
  });
});

describe('mapeo API → contrato (comprobantes)', () => {
  it('normaliza serie, comanda y estado', () => {
    expect(toComprobante(comprobanteApi)).toMatchObject({
      id: 'c-1',
      tipo: 'FACTURA',
      serieNumero: 'F001-00000042',
      ordenNumero: 'ORD-000123',
      clienteRef: '20123456789',
      total: 118,
      estado: 'ANULADA',
      motivoAnulacion: 'Error de captura',
    });
  });

  it('cae a BOLETA/PAGADA ante valores desconocidos', () => {
    const comprobante = toComprobante({ ...comprobanteApi, tipo: 'RARO', estado: 'RARO' });
    expect(comprobante.tipo).toBe('BOLETA');
    expect(comprobante.estado).toBe('PAGADA');
  });

  it('pinta la fila del ERP con SUNAT pendiente de OSE, sin CDR inventado', () => {
    const recibo = comprobanteARecibo(toComprobante(comprobanteApi));
    expect(recibo).toMatchObject({
      id: 'F001-00000042',
      type: '01',
      customer: '20123456789',
      total: 118,
      status: 'Anulada',
      source: 'ORD-000123',
      estadoSunat: 'en_cola',
      mensajeSunat: 'Pendiente de OSE',
    });
    expect(recibo.cdr).toBeUndefined();
  });
});

describe('validación y etiquetas', () => {
  it('exige RUC válido en la factura y DNI de 8 en la boleta', () => {
    expect(validarEmision({ ordenId: 'o-1', tipo: 'FACTURA' })).toMatch(/RUC/i);
    expect(
      validarEmision({ ordenId: 'o-1', tipo: 'FACTURA', clienteRef: '2012345678' }),
    ).toMatch(/11/);
    expect(
      validarEmision({ ordenId: 'o-1', tipo: 'FACTURA', clienteRef: '20123456789' }),
    ).toBeNull();
    expect(
      validarEmision({ ordenId: 'o-1', tipo: 'BOLETA', clienteRef: '4567890' }),
    ).toMatch(/8/);
    expect(validarEmision({ tipo: 'BOLETA' })).toMatch(/comanda/i);
  });

  it('etiqueta tipos y estados, y conoce la serie de cada tipo', () => {
    expect(etiquetaTipoComprobante('FACTURA')).toBe('Factura');
    expect(etiquetaTipoComprobante('NOTA_CREDITO')).toBe('Nota de crédito');
    expect(etiquetaEstadoComprobante('ANULADA')).toBe('Anulada');
    expect(etiquetaEstadoComprobante('PAGADA')).toBe('Pagada');
    expect(serieDeTipo('BOLETA')).toBe('B001');
    expect(serieDeTipo('FACTURA')).toBe('F001');
    expect(serieDeTipo('TICKET')).toBe('T001');
  });
});
