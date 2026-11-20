import { describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => {
  const tx = { $queryRawUnsafe: vi.fn().mockResolvedValue([]) };
  const client = {
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(tx)),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $extends: vi.fn(() => ({ scoped: true })),
  };
  return { tx, client };
});

const adapter = vi.hoisted(() => ({ PrismaPg: vi.fn(function () { return {}; }) }));

vi.mock('../generated/prisma/client.js', () => ({
  PrismaClient: vi.fn(function () {
    return prisma.client;
  }),
}));
vi.mock('@prisma/adapter-pg', () => ({ PrismaPg: adapter.PrismaPg }));

import type { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service.js';
import { TenantContextService } from '../common/context/tenant-context.service.js';

function config(values: Record<string, unknown>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('PrismaService', () => {
  it('exige DATABASE_URL', () => {
    expect(
      () => new PrismaService(config({}), new TenantContextService()),
    ).toThrow('DATABASE_URL no está definida');
  });

  it('crea los clientes raw/rls con sus pools y schema', () => {
    const service = new PrismaService(
      config({
        DATABASE_URL: 'postgresql://base',
        DATABASE_URL_SAAS: 'postgresql://saas',
        DATABASE_URL_RLS: 'postgresql://rls',
        DATABASE_SCHEMA: 'fogoneria',
        DATABASE_POOL_MAX: 20,
      }),
      new TenantContextService(),
    );
    expect(adapter.PrismaPg).toHaveBeenCalledWith(
      { connectionString: 'postgresql://saas', max: 20 },
      { schema: 'fogoneria' },
    );
    expect(adapter.PrismaPg).toHaveBeenCalledWith(
      { connectionString: 'postgresql://rls', max: 20 },
      { schema: 'fogoneria' },
    );
    expect(service.raw).toBe(prisma.client);
    expect(service.scoped).toEqual({ scoped: true });
  });

  it('usa los defaults de schema y pool cuando faltan', () => {
    new PrismaService(
      config({ DATABASE_URL: 'postgresql://base' }),
      new TenantContextService(),
    );
    expect(adapter.PrismaPg).toHaveBeenCalledWith(
      { connectionString: 'postgresql://base', max: 10 },
      { schema: 'fogoneria' },
    );
  });

  it('sin empresa ni bypass corre el callback sin abrir transacción', async () => {
    const service = new PrismaService(
      config({ DATABASE_URL: 'postgresql://base' }),
      new TenantContextService(),
    );
    const callback = vi.fn().mockResolvedValue('ok');
    await expect(service.runWithTenant({ userId: 'u-1' }, callback)).resolves.toBe('ok');
    expect(prisma.client.$transaction).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalled();
  });

  it('con empresa fija app.* y comparte la transacción con el contexto', async () => {
    const tenantContext = new TenantContextService();
    const service = new PrismaService(
      config({ DATABASE_URL: 'postgresql://base' }),
      tenantContext,
    );
    const setTransaction = vi.spyOn(tenantContext, 'setTransaction');

    const result = await service.runWithTenant(
      { empresaId: 'e-1', sucursalId: 's-1', userId: 'u-1', bypass: false },
      async () => 'comanda',
    );

    expect(result).toBe('comanda');
    expect(prisma.client.$transaction).toHaveBeenCalled();
    expect(prisma.tx.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("set_config('app.empresa_id'"),
      'e-1',
      's-1',
      'u-1',
      'off',
    );
    expect(setTransaction).toHaveBeenCalledWith(prisma.tx);
  });

  it('SUPERADMIN abre transacción con bypass on aunque no tenga empresa', async () => {
    const service = new PrismaService(
      config({ DATABASE_URL: 'postgresql://base' }),
      new TenantContextService(),
    );
    await service.runWithTenant({ bypass: true }, async () => 'ok');
    expect(prisma.tx.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.any(String),
      '',
      '',
      '',
      'on',
    );
  });

  it('al destruir desconecta ambos clientes y tolera fallos', async () => {
    const service = new PrismaService(
      config({ DATABASE_URL: 'postgresql://base' }),
      new TenantContextService(),
    );
    prisma.client.$disconnect.mockResolvedValue(undefined);
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    expect(prisma.client.$disconnect).toHaveBeenCalled();

    prisma.client.$disconnect.mockRejectedValue(new Error('pool caído'));
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });
});
