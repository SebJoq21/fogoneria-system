import { describe, expect, it } from 'vitest';
import { cuentaParaPropinas, diaLima, repartirPropinas } from './staff.rules.js';

describe('reparto de propinas (AYCDS-33)', () => {
  it('reparte exacto entre tres', () => {
    const montos = repartirPropinas(100, 3);
    expect(montos).toEqual([33.34, 33.33, 33.33]);
    expect(montos.reduce((suma, monto) => suma + monto, 0)).toBeCloseTo(100, 2);
  });

  it('no pierde céntimos con importes con decimales', () => {
    const montos = repartirPropinas(45.55, 4);
    const suma = Math.round(montos.reduce((total, monto) => total + monto, 0) * 100) / 100;
    expect(suma).toBe(45.55);
    expect(montos).toHaveLength(4);
  });

  it('da todo a uno cuando hay un solo beneficiario', () => {
    expect(repartirPropinas(87.4, 1)).toEqual([87.4]);
  });

  it('devuelve vacío sin beneficiarios', () => {
    expect(repartirPropinas(100, 0)).toEqual([]);
  });

  it('no reparte importes negativos', () => {
    expect(repartirPropinas(-10, 2)).toEqual([0, 0]);
  });

  it('ignora las faltas al repartir', () => {
    expect(cuentaParaPropinas('PRESENTE')).toBe(true);
    expect(cuentaParaPropinas('TARDANZA')).toBe(true);
    expect(cuentaParaPropinas('FALTA')).toBe(false);
    expect(cuentaParaPropinas('DESCANSO')).toBe(false);
  });

  it('calcula el día de Lima con offset fijo', () => {
    // 2026-11-07 02:00 UTC = 2026-11-06 21:00 en Lima.
    expect(diaLima(new Date('2026-11-07T02:00:00.000Z'))).toBe('2026-11-06');
  });
});
