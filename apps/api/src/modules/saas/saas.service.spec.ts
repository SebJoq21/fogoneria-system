import { ConflictException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SaasService } from './saas.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';

const actor: AuthenticatedUser = {
  sub: '55555555-5555-5555-5555-555555555555',
  email: 'super@fogoneria.com',
  nombre: 'Super',
  rol: 'SUPERADMIN',
  empresaId: null,
  sucursalId: null,
};

function buildPrisma() {
  const tx = {
    empresas: { create: vi.fn(), update: vi.fn() },
    sucursales: { create: vi.fn() },
    usuarios: { create: vi.fn() },
    suscripciones_eventos: { create: vi.fn() },
    auditoria: { create: vi.fn() },
  };
  return {
    tx,
    raw: {
      empresas: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        aggregate: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    },
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  return new SaasService(
    prisma as unknown as PrismaService,
    { record: vi.fn() } as unknown as AuditService,
    { get: vi.fn(() => '14') } as unknown as ConfigService,
  );
}

describe('SaasService', () => {
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(() => {
    prisma = buildPrisma();
    vi.clearAllMocks();
  });

  it('rechaza un RUC con dígito verificador inválido', async () => {
    const service = buildService(prisma);

    await expect(
      service.createTenant(
        {
          nombreLegal: 'El Fuego S.A.C.',
          ruc: '20123456789',
          emailAdmin: 'admin@fuego.pe',
          nombreAdmin: 'Ana',
          password: 'Fogoneria123!',
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('crea empresa, sucursal matriz, admin y evento en una transacción', async () => {
    prisma.raw.empresas.findFirst.mockResolvedValue(null);
    prisma.tx.empresas.create.mockResolvedValue({
      id: 'e1',
      nombre_legal: 'El Fuego S.A.C.',
      ruc: '20123456786',
      estado: 'TRIAL',
      plan_actual: 'PROFESIONAL',
      trial_fin: new Date('2026-11-02T00:00:00.000Z'),
    });
    prisma.tx.sucursales.create.mockResolvedValue({ id: 's1', nombre: 'Sede principal' });
    prisma.tx.usuarios.create.mockResolvedValue({
      id: 'u1',
      nombre: 'Ana',
      email: 'admin@fuego.pe',
    });
    const service = buildService(prisma);

    const result = await service.createTenant(
      {
        nombreLegal: 'El Fuego S.A.C.',
        ruc: '20123456786',
        emailAdmin: 'admin@fuego.pe',
        nombreAdmin: 'Ana',
        password: 'Fogoneria123!',
        plan: 'PROFESIONAL',
      },
      actor,
    );

    expect(result).toMatchObject({ id: 'e1', estado: 'TRIAL' });
    expect(prisma.tx.usuarios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          empresa_id: 'e1',
          sucursal_id: 's1',
          rol: 'ADMIN_GLOBAL',
        }),
      }),
    );
    const passwordHash = prisma.tx.usuarios.create.mock.calls[0][0].data
      .password_hash as string;
    expect(passwordHash).not.toBe('Fogoneria123!');
    expect(prisma.tx.suscripciones_eventos.create).toHaveBeenCalledOnce();
    expect(prisma.tx.auditoria.create).toHaveBeenCalledOnce();
  });

  it('suspende una empresa y registra el evento', async () => {
    prisma.raw.empresas.findFirst.mockResolvedValue({
      id: 'e1',
      estado: 'ACTIVE',
      plan_actual: 'PROFESIONAL',
      mrr_monto: 249.9,
    });
    prisma.tx.empresas.update.mockResolvedValue({ id: 'e1', estado: 'SUSPENDED' });
    const service = buildService(prisma);

    const result = await service.suspend('e1', 'Factura vencida', actor);

    expect(result).toEqual({ id: 'e1', estado: 'SUSPENDED' });
    expect(prisma.tx.empresas.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { estado: 'SUSPENDED' },
    });
    expect(prisma.tx.suscripciones_eventos.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado_anterior: 'ACTIVE',
          estado_nuevo: 'SUSPENDED',
          motivo: 'Factura vencida',
        }),
      }),
    );
  });

  it('calcula MRR con las empresas activas', async () => {
    prisma.raw.empresas.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    prisma.raw.empresas.aggregate.mockResolvedValue({
      _sum: { mrr_monto: 1499.4 },
    });
    const service = buildService(prisma);

    const result = await service.metrics();

    expect(result).toEqual({
      empresas: { total: 10, trial: 2, active: 6, suspended: 1, expired: 1 },
      mrr: 1499.4,
    });
  });
});
