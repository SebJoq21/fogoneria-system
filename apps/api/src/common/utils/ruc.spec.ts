import { describe, expect, it } from 'vitest';
import { isValidRuc } from './ruc.js';

describe('isValidRuc', () => {
  it('acepta RUC válidos', () => {
    expect(isValidRuc('20123456786')).toBe(true);
    expect(isValidRuc('10456789019')).toBe(true);
  });

  it('acepta el dígito verificador correcto cuando el resto es 0 (20100000301)', () => {
    // 2010000030 → suma 22 → resto 0 → dígito (11 - 0) % 10 = 1
    expect(isValidRuc('20100000301')).toBe(true);
  });

  it('rechaza el dígito verificador incorrecto cuando el resto es 0 (20100000300)', () => {
    expect(isValidRuc('20100000300')).toBe(false);
  });

  it('acepta el dígito verificador correcto cuando el resto es 1 (20100000050)', () => {
    // 2010000005 → suma 23 → resto 1 → dígito (11 - 1) % 10 = 0
    expect(isValidRuc('20100000050')).toBe(true);
  });

  it('rechaza el dígito verificador incorrecto cuando el resto es 1 (20100000051)', () => {
    expect(isValidRuc('20100000051')).toBe(false);
  });

  it('rechaza dígitos verificadores que no corresponden', () => {
    expect(isValidRuc('20123456780')).toBe(false);
  });

  it('rechaza formatos inválidos y tolera espacios', () => {
    expect(isValidRuc('2012345678')).toBe(false);
    expect(isValidRuc('2012345678a')).toBe(false);
    expect(isValidRuc('')).toBe(false);
    expect(isValidRuc('  20123456786  ')).toBe(true);
  });
});
