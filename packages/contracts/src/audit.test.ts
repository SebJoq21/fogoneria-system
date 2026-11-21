import { describe, expect, it } from 'vitest';
import { AUDIT_LIMIT_DEFAULT, AUDIT_LIMIT_MAX } from './audit';

describe('contrato de auditoría', () => {
  it('fija los topes de lectura', () => {
    expect(AUDIT_LIMIT_DEFAULT).toBe(50);
    expect(AUDIT_LIMIT_MAX).toBe(200);
  });
});
