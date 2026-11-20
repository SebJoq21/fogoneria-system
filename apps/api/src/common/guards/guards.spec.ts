import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

function context(user?: { rol: string }): ExecutionContext {
  return {
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function reflector(required: unknown): Reflector {
  return { getAllAndOverride: vi.fn().mockReturnValue(required) } as unknown as Reflector;
}

describe('RolesGuard', () => {
  it('deja pasar cuando la ruta no exige roles', () => {
    const guard = new RolesGuard(reflector(undefined));
    expect(guard.canActivate(context())).toBe(true);
    expect(new RolesGuard(reflector([])).canActivate(context())).toBe(true);
  });

  it('rechaza sin usuario autenticado', () => {
    const guard = new RolesGuard(reflector(['ADMIN_GLOBAL']));
    expect(guard.canActivate(context())).toBe(false);
  });

  it('acepta y rechaza según el rol del usuario', () => {
    const guard = new RolesGuard(reflector(['ADMIN_GLOBAL', 'GERENTE_SUCURSAL']));
    expect(guard.canActivate(context({ rol: 'GERENTE_SUCURSAL' }))).toBe(true);
    expect(guard.canActivate(context({ rol: 'MESERO' }))).toBe(false);
  });
});

describe('JwtAuthGuard', () => {
  it('no valida el JWT en rutas públicas', () => {
    const guard = new JwtAuthGuard(reflector(true));
    expect(guard.canActivate(context())).toBe(true);
  });
});
