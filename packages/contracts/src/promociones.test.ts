import { describe, expect, it } from 'vitest';
import { ahorroCombo, esTipoDescuentoCupon, estadoCupon, etiquetaDescuento } from './promociones';

describe('esTipoDescuentoCupon', () => {
  it('reconoce solo porcentaje y monto', () => {
    expect(esTipoDescuentoCupon('PORCENTAJE')).toBe(true);
    expect(esTipoDescuentoCupon('MONTO')).toBe(true);
    expect(esTipoDescuentoCupon('GRATIS')).toBe(false);
  });
});

describe('etiquetaDescuento', () => {
  it('formatea porcentajes sin ceros de más', () => {
    expect(etiquetaDescuento('PORCENTAJE', 10)).toBe('10% OFF');
    expect(etiquetaDescuento('PORCENTAJE', 12.5)).toBe('12.5% OFF');
  });

  it('formatea montos en soles con dos decimales', () => {
    expect(etiquetaDescuento('MONTO', 5)).toBe('$5.00 de descuento');
    expect(etiquetaDescuento('MONTO', 4.4)).toBe('$4.40 de descuento');
  });
});

describe('estadoCupon', () => {
  const base = { activo: true, usosActuales: 0, limiteUsos: 10, vencimiento: '2026-11-30' };
  const ahora = new Date('2026-11-20T12:00:00-05:00');

  it('deriva inactivo, agotado, vencido o vigente', () => {
    expect(estadoCupon({ ...base, activo: false }, ahora)).toBe('INACTIVO');
    expect(estadoCupon({ ...base, usosActuales: 10 }, ahora)).toBe('AGOTADO');
    expect(estadoCupon({ ...base, usosActuales: 11 }, ahora)).toBe('AGOTADO');
    expect(estadoCupon({ ...base, vencimiento: '2026-11-19' }, ahora)).toBe('VENCIDO');
    expect(estadoCupon(base, ahora)).toBe('VIGENTE');
  });

  it('considera vigente todo el día de Lima del vencimiento', () => {
    expect(estadoCupon({ ...base, vencimiento: '2026-11-20' }, new Date('2026-11-20T23:00:00-05:00')))
      .toBe('VIGENTE');
    expect(estadoCupon({ ...base, vencimiento: '2026-11-20' }, new Date('2026-11-21T00:30:00-05:00')))
      .toBe('VENCIDO');
  });

  it('ignora un vencimiento ilegible', () => {
    expect(estadoCupon({ ...base, vencimiento: 'no-es-fecha' }, ahora)).toBe('VIGENTE');
  });
});

describe('ahorroCombo', () => {
  it('calcula el ahorro con dos decimales', () => {
    expect(ahorroCombo(50, 39.6)).toBe(10.4);
    expect(ahorroCombo(50, 50)).toBe(0);
  });

  it('devuelve null si no hay referencia válida', () => {
    expect(ahorroCombo(null, 30)).toBeNull();
    expect(ahorroCombo(Number.NaN, 30)).toBeNull();
    expect(ahorroCombo(Number.POSITIVE_INFINITY, 30)).toBeNull();
  });
});
