import { ConflictException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingService } from './onboarding.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';

const RUC_VALIDO = '20123456786';

function buildPrisma() {
  const tx = {
    empresas: {
      create: vi.fn().mockResolvedValue({
        id: 'e1',
        nombre_legal: 'Parrilla El Fuego S.A.C.',
        nombre_comercial: null,
        ruc: RUC_VALIDO,
        logo_url: 'https://cdn.fuego.pe/logo.png',
        estado: 'TRIAL',
        plan_actual: 'TRIAL',
        trial_fin: new Date('2026-01-01T00:00:00.000Z'),
      }),
    },
    sucursales: { create: vi.fn().mockResolvedValue({ id: 's1', nombre: 'Sede principal' }) },
    usuarios: { create: vi.fn().mockResolvedValue({ id: 'u1', nombre: 'María Torres', email: 'admin@fuego.pe' }) },
    listas_precios: { create: vi.fn().mockResolvedValue({}) },
    leads_cotizaciones: { create: vi.fn().mockResolvedValue({ id: 'l1' }) },
    suscripciones_eventos: { create: vi.fn().mockResolvedValue({}) },
  };
  return {
    raw: {
      empresas: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    },
    tx,
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const config = { get: vi.fn(() => '14') };
  const service = new OnboardingService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    config as unknown as ConfigService,
  );
  return { service, audit };
}

const dto = {
  nombreLegal: 'Parrilla El Fuego S.A.C.',
  ruc: RUC_VALIDO,
  logoUrl: 'https://cdn.fuego.pe/logo.png',
  nombreAdmin: 'María Torres',
  emailAdmin: 'admin@fuego.pe',
  password: 'Fogoneria123!',
} as const;

describe('OnboardingService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('crea empresa en TRIAL, admin y lead', async () => {
    const prisma = buildPrisma();
    const { service, audit } = buildService(prisma);

    const result = await service.submit({ ...dto }, '127.0.0.1');

    expect(result).toMatchObject({ ruc: RUC_VALIDO, estado: 'TRIAL', logoUrl: dto.logoUrl });
    expect(prisma.tx.leads_cotizaciones.create).toHaveBeenCalledOnce();
    expect(prisma.tx.usuarios.create).toHaveBeenCalledOnce();
    expect(audit.record).toHaveBeenCalledOnce();
  });

  it('rechaza RUC con dígito verificador inválido', async () => {
    const prisma = buildPrisma();
    const { service } = buildService(prisma);

    await expect(service.submit({ ...dto, ruc: '20123456780' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rechaza RUC ya registrado', async () => {
    const prisma = buildPrisma();
    prisma.raw.empresas.findFirst.mockResolvedValue({ id: 'existente' });
    const { service } = buildService(prisma);

    await expect(service.submit({ ...dto })).rejects.toBeInstanceOf(ConflictException);
  });
});
