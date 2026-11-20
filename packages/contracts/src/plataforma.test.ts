import { describe, expect, it } from 'vitest';
import { isValidEmail } from './plataforma';

describe('isValidEmail', () => {
  it('acepta correos razonables', () => {
    expect(isValidEmail('admin@mirestaurante.com')).toBe(true);
    expect(isValidEmail('a+b@sub.dominio.pe')).toBe(true);
  });

  it('rechaza correos inválidos', () => {
    for (const value of [
      '',
      'a',
      'a@b',
      '@b.com',
      'a@@b.com',
      'a b@c.com',
      'a@b..com',
      'a@.com',
      'a@b.',
    ]) {
      expect(isValidEmail(value)).toBe(false);
    }
  });
});
