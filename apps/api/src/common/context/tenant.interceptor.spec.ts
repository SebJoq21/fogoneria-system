import { describe, expect, it, vi } from 'vitest';
import { lastValueFrom, of } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { TenantContextInterceptor } from './tenant.interceptor.js';
import type { TenantContextService } from './tenant-context.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

function context(user?: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function handler(): CallHandler {
  return { handle: () => of({ ok: true }) };
}

function build() {
  const tenantContext = {
    run: vi.fn((_tenant: unknown, cb: () => unknown) => cb()),
  };
  const prisma = {
    runWithTenant: vi.fn((_tenant: unknown, cb: () => unknown) => cb()),
  };
  return {
    interceptor: new TenantContextInterceptor(
      tenantContext as unknown as TenantContextService,
      prisma as unknown as PrismaService,
    ),
    tenantContext,
    prisma,
  };
}

describe('TenantContextInterceptor', () => {
  it('sin usuario corre el handler con el contexto vacío', async () => {
    const { interceptor, tenantContext, prisma } = build();
    await expect(lastValueFrom(interceptor.intercept(context(), handler()))).resolves.toEqual({
      ok: true,
    });
    expect(tenantContext.run).toHaveBeenCalledWith({}, expect.any(Function));
    expect(prisma.runWithTenant).not.toHaveBeenCalled();
  });

  it('con usuario abre la transacción RLS con el tenant del JWT', async () => {
    const { interceptor, prisma } = build();
    const user = {
      sub: 'u-1',
      empresaId: 'e-1',
      sucursalId: 's-1',
      rol: 'MESERO',
    };
    await expect(
      lastValueFrom(interceptor.intercept(context(user), handler())),
    ).resolves.toEqual({ ok: true });
    expect(prisma.runWithTenant).toHaveBeenCalledWith(
      { userId: 'u-1', empresaId: 'e-1', sucursalId: 's-1', rol: 'MESERO', bypass: false },
      expect.any(Function),
    );
  });

  it('SUPERADMIN opera con bypass de tenant', async () => {
    const { interceptor, prisma } = build();
    await lastValueFrom(
      interceptor.intercept(
        context({ sub: 'u-1', empresaId: null, sucursalId: null, rol: 'SUPERADMIN' }),
        handler(),
      ),
    );
    expect(prisma.runWithTenant).toHaveBeenCalledWith(
      expect.objectContaining({ bypass: true }),
      expect.any(Function),
    );
  });
});
