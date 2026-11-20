import { describe, expect, it } from 'vitest';
import { DIAS_VISTA_BI, calcularMargen, etiquetaMetodoPago } from './bi';

describe('calcularMargen', () => {
  it('resta gastos de ventas con dos decimales', () => {
    expect(calcularMargen(288, 600)).toBe(-312);
    expect(calcularMargen(100.1, 0.2)).toBe(99.9);
  });

  it('no arrastra errores de coma flotante', () => {
    expect(calcularMargen(0.3, 0.1)).toBe(0.2);
    expect(calcularMargen(1.005, 0)).toBe(1.01);
  });
});

describe('etiquetaMetodoPago', () => {
  it('traduce los métodos conocidos sin importar mayúsculas ni espacios', () => {
    expect(etiquetaMetodoPago(' EFECTIVO ')).toBe('Efectivo');
    expect(etiquetaMetodoPago('tarjeta')).toBe('Tarjeta');
    expect(etiquetaMetodoPago('Transferencia')).toBe('Transferencia');
    expect(etiquetaMetodoPago('yape')).toBe('Yape');
    expect(etiquetaMetodoPago('plin')).toBe('Plin');
  });

  it('devuelve el valor original para métodos desconocidos y vacío para cadenas vacías', () => {
    expect(etiquetaMetodoPago('Bitcoin')).toBe('Bitcoin');
    expect(etiquetaMetodoPago('   ')).toBe('Sin método');
  });
});

describe('DIAS_VISTA_BI', () => {
  it('la vista por defecto es de una semana', () => {
    expect(DIAS_VISTA_BI).toBe(7);
  });
});
