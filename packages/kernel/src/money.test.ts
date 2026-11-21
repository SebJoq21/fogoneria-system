import { describe, expect, it } from 'vitest';
import { fmtMoney, round2, round3 } from './money';

describe('money', () => {
  it('redondea a 2 decimales sin arrastrar coma flotante', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(-1.235)).toBe(-1.23);
    expect(round2(10)).toBe(10);
  });

  it('redondea cantidades a 3 decimales', () => {
    expect(round3(1.0005)).toBe(1.001);
    expect(round3(0.1 + 0.2)).toBe(0.3);
    expect(round3(-1.2345)).toBe(-1.234);
  });

  it('formatea moneda con dos decimales y tolera nulos', () => {
    expect(fmtMoney(12.5)).toBe('S/ 12.50');
    expect(fmtMoney(0)).toBe('S/ 0.00');
    expect(fmtMoney(null as never)).toBe('S/ 0.00');
    expect(fmtMoney(undefined as never)).toBe('S/ 0.00');
  });
});
