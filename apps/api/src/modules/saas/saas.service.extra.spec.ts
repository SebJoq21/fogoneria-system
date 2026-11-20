import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SaasService } from './saas.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuditService } from '../audit/index.js';

const EMPRESA = '11111111-1111-4111-8111-111111111111';
const actor = { sub: 'u-1', email: 'super@fogoneria.com', rol: 'SUPERADMIN' } as never;

function buildPrisma() {
  return {
    raw: {
      empresas: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          empresas: { update: vi.fn().mockResolvedValue({ id: EMPRESA }) },
          suscripciones_eventos: { create: vi.fn().mockResolvedValue({}) },
          auditoria: { create: vi.fn().mockResolvedValue({}) },
        }),
      ),
      auditoria: { findMany: vi.fn().mockResolvedValue([]) },
    },
    scoped: {},
  };
}

describe('SaasService (ramas restantes)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let service: SaasService;

  beforeEach(() => {
    prisma = buildPrisma();
    service = new SaasService(
      prisma as unknown as PrismaService,
      { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService,
      { get: () => undefined } as never,
    );
  });

  it('lista empresas con búsqueda, plan y estado', async () => {
    prisma.raw.empresas.findMany.mockResolvedValue([{ id: EMPRESA }]);
    prisma.raw.empresas.count.mockResolvedValue(1);
    const lista = await service.list({
      estado: 'TRIAL',
      plan: 'BASICO',
      search: 'fuego',
      page: 2,
      limit: 10,
    } as never);
    expect(lista).toMatchObject({ total: 1, page: 2, limit: 10 });
    expect(prisma.raw.empresas.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deleted_at: null,
          estado: 'TRIAL',
          plan_actual: 'BASICO',
          OR: expect.any(Array),
        }),
        skip: 10,
        take: 10,
      }),
    );
  });

  it('lista sin filtros de la consola', async () => {
    await service.list({ page: 1, limit: 20 } as never);
    expect(prisma.raw.empresas.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deleted_at: null } }),
    );
  });

  it('getTenant 404 si la empresa no existe', async () => {
    prisma.raw.empresas.findFirst.mockResolvedValue(null);
    await expect(service.getTenant(EMPRESA)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getTenant devuelve la empresa con sus relaciones', async () => {
    prisma.raw.empresas.findFirst.mockResolvedValue({ id: EMPRESA });
    await expect(service.getTenant(EMPRESA)).resolves.toMatchObject({ id: EMPRESA });
    expect(prisma.raw.empresas.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: EMPRESA, deleted_at: null },
        include: expect.objectContaining({
          sucursales: expect.any(Object),
          suscripciones_eventos: expect.any(Object),
          _count: expect.any(Object),
        }),
      }),
    );
  });

  it('changePlan 404 si la empresa no existe', async () => {
    prisma.raw.empresas.findFirst.mockResolvedValue(null);
    await expect(
      service.changePlan(EMPRESA, { plan: 'PROFESIONAL', mrrMonto: 249.9 } as never, actor),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('changePlan actualiza plan y registra evento + auditoría en la transacción', async () => {
    prisma.raw.empresas.findFirst.mockResolvedValue({
      id: EMPRESA,
      estado: 'ACTIVE',
      plan_actual: 'BASICO',
      mrr_monto: '149.90',
    });

    const actualizada = await service.changePlan(
      EMPRESA,
      { plan: 'PROFESIONAL', mrrMonto: 249.9 } as never,
      actor,
    );

    expect(actualizada).toMatchObject({ id: EMPRESA });
    expect(prisma.raw.$transaction).toHaveBeenCalled();
  });

  it('history pagina la auditoría de la empresa', async () => {
    prisma.raw.auditoria.findMany.mockResolvedValue([{ id: 'a-1' }]);
    await expect(service.history(EMPRESA, { page: 2, limit: 5 } as never)).resolves.toHaveLength(1);
    expect(prisma.raw.auditoria.findMany).toHaveBeenCalledWith({
      where: { empresa_id: EMPRESA },
      skip: 5,
      take: 5,
      orderBy: { created_at: 'desc' },
    });
  });
});
