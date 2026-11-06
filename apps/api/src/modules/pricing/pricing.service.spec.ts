import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PricingService } from './pricing.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';

function buildPrisma() {
  return {
    scoped: {
      listas_precios: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      platos: { count: vi.fn() },
      precios_platos: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        upsert: vi.fn(),
      },
      $transaction: vi.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    },
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  return new PricingService(
    prisma as unknown as PrismaService,
    {
      get: () => ({
        userId: 'u1',
        empresaId: 'e1',
        sucursalId: 's1',
        rol: 'ADMIN_GLOBAL',
        bypass: false,
      }),
    } as unknown as TenantContextService,
  );
}

describe('PricingService', () => {
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(() => {
    prisma = buildPrisma();
    vi.clearAllMocks();
  });

  it('crea listas de precios con el empresa_id del contexto', async () => {
    prisma.scoped.listas_precios.create.mockResolvedValue({ id: 'l1' });
    const service = buildService(prisma);

    await service.create({ nombre: 'Carta salón' });

    expect(prisma.scoped.listas_precios.create).toHaveBeenCalledWith({
      data: {
        empresa_id: 'e1',
        nombre: 'Carta salón',
        activa: false,
        vigencia_desde: null,
        vigencia_hasta: null,
      },
    });
  });

  it('hace upsert masivo con la clave compuesta lista+plato', async () => {
    prisma.scoped.listas_precios.findFirst.mockResolvedValue({ id: 'l1' });
    prisma.scoped.platos.count.mockResolvedValue(1);
    prisma.scoped.precios_platos.upsert.mockResolvedValue({});
    const service = buildService(prisma);

    await service.setPrices('l1', [
      { platoId: '00000000-0000-0000-0000-000000000001', precio: 24.9 },
    ]);

    expect(prisma.scoped.precios_platos.upsert).toHaveBeenCalledWith({
      where: {
        lista_id_plato_id: {
          lista_id: 'l1',
          plato_id: '00000000-0000-0000-0000-000000000001',
        },
      },
      create: {
        lista_id: 'l1',
        plato_id: '00000000-0000-0000-0000-000000000001',
        precio: 24.9,
      },
      update: { precio: 24.9 },
    });
  });

  it('rechaza precios de platos que no existen', async () => {
    prisma.scoped.listas_precios.findFirst.mockResolvedValue({ id: 'l1' });
    prisma.scoped.platos.count.mockResolvedValue(0);
    const service = buildService(prisma);

    await expect(
      service.setPrices('l1', [
        { platoId: '00000000-0000-0000-0000-000000000001', precio: 10 },
      ]),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resuelve el precio desde la lista activa', async () => {
    prisma.scoped.listas_precios.findFirst.mockResolvedValue({ id: 'l1' });
    prisma.scoped.precios_platos.findFirst.mockResolvedValue({ precio: 24.9 });
    const service = buildService(prisma);

    const result = await service.resolvePrice(
      '00000000-0000-0000-0000-000000000001',
    );

    expect(result).toEqual({
      platoId: '00000000-0000-0000-0000-000000000001',
      listaId: 'l1',
      precio: 24.9,
    });
  });
});
