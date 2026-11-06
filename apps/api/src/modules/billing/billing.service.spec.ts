import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingService } from './billing.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';

const empresa = {
  id: 'e1',
  plan_actual: 'TRIAL',
  mrr_monto: 0,
  trial_fin: new Date('2026-01-01T00:00:00.000Z'),
};

function buildPrisma() {
  const tx = {
    empresas: { update: vi.fn().mockResolvedValue({}) },
    suscripciones_eventos: { create: vi.fn().mockResolvedValue({}) },
  };
  return {
    tx,
    raw: {
      empresas: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    },
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  const audit = { record: vi.fn() };
  const config = {
    get: vi.fn((key: string) =>
      key === 'BILLING_GRACE_DAYS' ? '5' : undefined,
    ),
  };
  return {
    service: new BillingService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      config as unknown as ConfigService,
    ),
    audit,
  };
}

describe('BillingService', () => {
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(() => {
    prisma = buildPrisma();
    vi.clearAllMocks();
  });

  it('expira trials vencidos', async () => {
    prisma.raw.empresas.findMany.mockResolvedValue([empresa]);
    const { service, audit } = buildService(prisma);

    const ids = await service.expireTrials(new Date('2026-10-19T00:00:00.000Z'));

    expect(ids).toEqual(['e1']);
    expect(prisma.tx.empresas.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { estado: 'EXPIRED' },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'TRIAL_EXPIRADO' }),
    );
  });

  it('suspende expirados después de la gracia', async () => {
    prisma.raw.empresas.findMany.mockResolvedValue([empresa]);
    const { service } = buildService(prisma);

    const ids = await service.suspendExpired(
      new Date('2026-10-19T00:00:00.000Z'),
    );

    expect(ids).toEqual(['e1']);
    expect(prisma.raw.empresas.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          estado: 'EXPIRED',
          trial_fin: { lt: expect.any(Date) },
        }),
      }),
    );
    expect(prisma.tx.empresas.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { estado: 'SUSPENDED' },
    });
  });
});
