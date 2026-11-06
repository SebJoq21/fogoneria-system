import { BadRequestException, ConflictException } from '@nestjs/common';
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
      usuarios: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    },
    tx,
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>, trialDays = '14') {
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const config = { get: vi.fn(() => trialDays) };
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

  it('siempre entra como TRIAL aunque el payload pida un plan pagado', async () => {
    const prisma = buildPrisma();
    const { service } = buildService(prisma);

    await service.submit(
      { ...dto, plan: 'PROFESIONAL', mrr_monto: 199 } as unknown as typeof dto,
      '127.0.0.1',
    );

    const [[arg]] = prisma.tx.empresas.create.mock.calls;
    expect(arg.data.plan_actual).toBe('TRIAL');
    expect(arg.data.mrr_monto).toBe(0);
  });

  it('rechaza RUC con dígito verificador inválido con 400', async () => {
    const prisma = buildPrisma();
    const { service } = buildService(prisma);

    await expect(service.submit({ ...dto, ruc: '20123456780' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.raw.empresas.findFirst).not.toHaveBeenCalled();
  });

  it('acepta el dígito verificador cuando el resto es 0 y 1', async () => {
    const prisma = buildPrisma();
    const { service } = buildService(prisma);

    await expect(service.submit({ ...dto, ruc: '20100000301' })).resolves.toBeDefined();
    await expect(service.submit({ ...dto, ruc: '20100000050' })).resolves.toBeDefined();
    await expect(service.submit({ ...dto, ruc: '20100000300' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.submit({ ...dto, ruc: '20100000051' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rechaza RUC ya registrado, incluso si la empresa está dada de baja', async () => {
    const prisma = buildPrisma();
    prisma.raw.empresas.findFirst.mockResolvedValue({ id: 'existente', deleted_at: new Date() });
    const { service } = buildService(prisma);

    await expect(service.submit({ ...dto })).rejects.toBeInstanceOf(ConflictException);
    // El filtro no debe excluir empresas con `deleted_at`.
    const [[arg]] = prisma.raw.empresas.findFirst.mock.calls;
    expect(arg.where).toEqual({ ruc: RUC_VALIDO });
  });

  it('rechaza un correo ya usado por otra empresa', async () => {
    const prisma = buildPrisma();
    prisma.raw.usuarios.findFirst.mockResolvedValue({ id: 'u-existente' });
    const { service } = buildService(prisma);

    await expect(service.submit({ ...dto })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.raw.$transaction).not.toHaveBeenCalled();
  });

  it('traduce la violación P2002 de una alta simultánea a 409', async () => {
    const prisma = buildPrisma();
    prisma.raw.$transaction.mockRejectedValueOnce(
      Object.assign(new Error('Unique constraint'), { code: 'P2002' }),
    );
    const { service } = buildService(prisma);

    await expect(service.submit({ ...dto })).rejects.toBeInstanceOf(ConflictException);
  });

  it('ignora TRIAL_DAYS inválido y usa el valor por defecto', async () => {
    const prisma = buildPrisma();
    const { service } = buildService(prisma, 'cero');

    const result = await service.submit({ ...dto }, '127.0.0.1');
    const [[arg]] = prisma.tx.empresas.create.mock.calls;
    const dias = Math.round(
      (arg.data.trial_fin.getTime() - arg.data.trial_inicio.getTime()) / 86_400_000,
    );
    expect(dias).toBe(14);
    expect(result.trialFin).toBeInstanceOf(Date);
  });

  it('no falla si la auditoría revienta', async () => {
    const prisma = buildPrisma();
    const { service, audit } = buildService(prisma);
    audit.record.mockRejectedValue(new Error('audit caído'));

    await expect(service.submit({ ...dto })).resolves.toMatchObject({ ruc: RUC_VALIDO });
  });
});
