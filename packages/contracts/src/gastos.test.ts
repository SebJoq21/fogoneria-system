import { describe, expect, it } from 'vitest';
import {
  esCategoriaGasto,
  esEstadoPago,
  etiquetaCategoria,
  etiquetaEstadoPago,
  pagoSaleDeCaja,
  validarGasto,
} from './gastos';

describe('guardas de gastos', () => {
  it('reconoce estados y categorías', () => {
    expect(esEstadoPago('PENDIENTE')).toBe(true);
    expect(esEstadoPago('PAGADO')).toBe(true);
    expect(esEstadoPago('ANULADO')).toBe(false);
    for (const categoria of ['INSUMOS', 'SERVICIOS', 'PERSONAL', 'ALQUILER', 'MARKETING', 'OTROS']) {
      expect(esCategoriaGasto(categoria)).toBe(true);
    }
    expect(esCategoriaGasto('OTRA')).toBe(false);
  });

  it('solo el efectivo sale de la caja', () => {
    expect(pagoSaleDeCaja('EFECTIVO')).toBe(true);
    expect(pagoSaleDeCaja('TARJETA')).toBe(false);
    expect(pagoSaleDeCaja('TRANSFERENCIA')).toBe(false);
    expect(pagoSaleDeCaja('YAPE')).toBe(false);
  });
});

describe('validarGasto', () => {
  it('acepta un gasto completo', () => {
    expect(validarGasto({ concepto: 'Gas', monto: 120, categoria: 'INSUMOS' })).toBeNull();
  });

  it('rechaza concepto vacío o demasiado largo', () => {
    expect(validarGasto({})).toBe('Falta el concepto del gasto');
    expect(validarGasto({ concepto: '   ' })).toBe('Falta el concepto del gasto');
    expect(validarGasto({ concepto: 'x'.repeat(201), monto: 1, categoria: 'OTROS' })).toBe(
      'El concepto admite hasta 200 caracteres',
    );
  });

  it('rechaza montos no positivos y categorías inválidas', () => {
    expect(validarGasto({ concepto: 'Gas' })).toBe('El monto debe ser mayor a cero');
    expect(validarGasto({ concepto: 'Gas', monto: 0 })).toBe('El monto debe ser mayor a cero');
    expect(validarGasto({ concepto: 'Gas', monto: -1 })).toBe('El monto debe ser mayor a cero');
    expect(validarGasto({ concepto: 'Gas', monto: 1 })).toBe('Categoría de gasto inválida');
    expect(validarGasto({ concepto: 'Gas', monto: 1, categoria: 'OTRA' })).toBe(
      'Categoría de gasto inválida',
    );
  });
});

describe('etiquetas de gastos', () => {
  it('traduce todas las categorías', () => {
    expect(etiquetaCategoria('INSUMOS')).toBe('Insumos');
    expect(etiquetaCategoria('SERVICIOS')).toBe('Servicios');
    expect(etiquetaCategoria('PERSONAL')).toBe('Personal');
    expect(etiquetaCategoria('ALQUILER')).toBe('Alquiler');
    expect(etiquetaCategoria('MARKETING')).toBe('Marketing');
    expect(etiquetaCategoria('OTROS')).toBe('Otros');
  });

  it('traduce el estado de pago', () => {
    expect(etiquetaEstadoPago('PAGADO')).toBe('Pagado');
    expect(etiquetaEstadoPago('PENDIENTE')).toBe('Pendiente');
  });
});
