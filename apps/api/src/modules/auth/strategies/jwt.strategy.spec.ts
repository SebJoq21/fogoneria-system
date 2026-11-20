import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { JwtStrategy } from './jwt.strategy.js';
import type { ConfigService } from '@nestjs/config';

function build(secret = 'secreto-de-prueba-suficientemente-largo') {
  const config = { get: () => secret };
  return new JwtStrategy(config as unknown as ConfigService);
}

const payload = {
  sub: 'u-1',
  email: 'a@b.com',
  rol: 'MESERO',
  empresaId: 'e-1',
  sucursalId: 's-1',
} as never;

describe('JwtStrategy', () => {
  it('acepta un access token normal y devuelve el payload', () => {
    expect(build().validate(payload)).toBe(payload);
  });

  it('rechaza un ticket de WebSocket (scope)', () => {
    expect(() => build().validate({ ...(payload as object), scope: 'ws' } as never)).toThrow(
      UnauthorizedException,
    );
  });

  it('se construye con el secreto de desarrollo si falta la config', () => {
    const config = { get: () => undefined };
    expect(() => new JwtStrategy(config as unknown as ConfigService)).not.toThrow();
  });
});
