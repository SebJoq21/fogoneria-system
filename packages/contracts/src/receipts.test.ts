import { describe, expect, it } from 'vitest';
import {
  desgloseIgv,
  esEmisible,
  esEstadoComprobante,
  esTipoComprobante,
  etiquetaEstadoComprobante,
  etiquetaTipoComprobante,
  serieDeTipo,
  validarEmision,
} from './receipts';

describe('guardas de comprobantes', () => {
  it('reconoce tipos y estados', () => {
    expect(esTipoComprobante('BOLETA')).toBe(true);
    expect(esTipoComprobante('NOTA_CREDITO')).toBe(true);
    expect(esTipoComprobante('boleta')).toBe(false);
    expect(esEstadoComprobante('PAGADA')).toBe(true);
    expect(esEstadoComprobante('ANULADA')).toBe(true);
    expect(esEstadoComprobante('EMITIDA')).toBe(false);
  });

  it('solo boleta, factura y ticket son emisibles de cero', () => {
    expect(esEmisible('BOLETA')).toBe(true);
    expect(esEmisible('FACTURA')).toBe(true);
    expect(esEmisible('TICKET')).toBe(true);
    expect(esEmisible('NOTA_CREDITO')).toBe(false);
  });
});

describe('desgloseIgv', () => {
  it('separa base e IGV de un total que ya incluye impuesto', () => {
    expect(desgloseIgv(118)).toEqual({ base: 100, igv: 18, total: 118, tasa: 18 });
    expect(desgloseIgv(59)).toEqual({ base: 50, igv: 9, total: 59, tasa: 18 });
  });

  it('admite otra tasa y redondea a dos decimales', () => {
    expect(desgloseIgv(110, 10)).toEqual({ base: 100, igv: 10, total: 110, tasa: 10 });
    expect(desgloseIgv(10, 18).base).toBe(8.47);
  });

  it('trata importes no finitos como cero', () => {
    expect(desgloseIgv(Number.NaN)).toEqual({ base: 0, igv: 0, total: 0, tasa: 18 });
  });
});

describe('validarEmision', () => {
  it('exige la comanda cobrada', () => {
    expect(validarEmision({})).toBe('Falta la comanda cobrada');
    expect(validarEmision({ ordenId: ' ' })).toBe('Falta la comanda cobrada');
  });

  it('rechaza tipos desconocidos o no emisibles', () => {
    expect(validarEmision({ ordenId: 'o-1' })).toBe('Tipo de comprobante inválido');
    expect(validarEmision({ ordenId: 'o-1', tipo: 'OTRO' })).toBe('Tipo de comprobante inválido');
    expect(validarEmision({ ordenId: 'o-1', tipo: 'NOTA_CREDITO' })).toBe(
      'Tipo de comprobante inválido',
    );
  });

  it('la factura exige RUC de 11 dígitos', () => {
    expect(validarEmision({ ordenId: 'o-1', tipo: 'FACTURA' })).toBe(
      'La factura requiere el RUC del cliente',
    );
    expect(validarEmision({ ordenId: 'o-1', tipo: 'FACTURA', clienteRef: '123' })).toBe(
      'El RUC debe tener 11 dígitos',
    );
    expect(
      validarEmision({ ordenId: 'o-1', tipo: 'FACTURA', clienteRef: '20123456789' }),
    ).toBeNull();
  });

  it('la boleta acepta DNI de 8 dígitos o vacío', () => {
    expect(validarEmision({ ordenId: 'o-1', tipo: 'BOLETA' })).toBeNull();
    expect(validarEmision({ ordenId: 'o-1', tipo: 'BOLETA', clienteRef: '' })).toBeNull();
    expect(validarEmision({ ordenId: 'o-1', tipo: 'BOLETA', clienteRef: '12345678' })).toBeNull();
    expect(validarEmision({ ordenId: 'o-1', tipo: 'BOLETA', clienteRef: '123' })).toBe(
      'El DNI de la boleta debe tener 8 dígitos',
    );
  });
});

describe('series y etiquetas', () => {
  it('asigna una serie por tipo', () => {
    expect(serieDeTipo('BOLETA')).toBe('B001');
    expect(serieDeTipo('FACTURA')).toBe('F001');
    expect(serieDeTipo('TICKET')).toBe('T001');
    expect(serieDeTipo('NOTA_CREDITO')).toBe('FC01');
  });

  it('etiqueta tipos y estados', () => {
    expect(etiquetaTipoComprobante('BOLETA')).toBe('Boleta');
    expect(etiquetaTipoComprobante('FACTURA')).toBe('Factura');
    expect(etiquetaTipoComprobante('TICKET')).toBe('Ticket');
    expect(etiquetaTipoComprobante('NOTA_CREDITO')).toBe('Nota de crédito');
    expect(etiquetaEstadoComprobante('PAGADA')).toBe('Pagada');
    expect(etiquetaEstadoComprobante('ANULADA')).toBe('Anulada');
  });
});
