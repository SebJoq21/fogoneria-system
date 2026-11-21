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
const EMPRESA = '11111111-1111-4111-8111-111111111111';

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
        count: vi.fn().mockResolvedValue(0),
        aggregate: vi.fn().mockResolvedValue({ _sum: { mrr_monto: null } }),
        update: vi.fn(),
      },
      $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    },
  };
}

describe('SaasService (f4: altas y estados)', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let service: SaasService;

  beforeEach(() => {
    prisma = buildPrisma();
    prisma.tx.empresas.create.mockResolvedValue({
      id: EMPRESA,
      nombre_legal: 'El Fuego S.A.C.',
      ruc: '20123456786',
      estado: 'TRIAL',
      plan_actual: 'TRIAL',
      trial_fin: new Date('2026-12-01T00:00:00.000Z'),
    });
    prisma.tx.sucursales.create.mockResolvedValue({ id: 's1', nombre: 'Sede principal' });
    prisma.tx.usuarios.create.mockResolvedValue({ id: 'u1', nombre: 'Ana', email: 'ana@fuego.pe' });
    service = new SaasService(
      prisma as unknown as PrismaService,
      { record: vi.fn() } as unknown as AuditService,
      { get: vi.fn((key: string) => (key === 'TRIAL_DAYS' ? '14' : undefined)) } as unknown as ConfigService,
    );
  });

  it('crea el tenant con plan, límites y trial explícitos', async () => {
    prisma.raw.empresas.findFirst.mockResolvedValue(null);
    prisma.tx.empresas.create.mockResolvedValue({
      id: EMPRESA,
      nombre_legal: 'El Fuego S.A.C.',
      ruc: '20123456786',
      estado: 'TRIAL',
      plan_actual: 'PROFESIONAL',
      trial_fin: new Date('2026-12-20T00:00:00.000Z'),
    });

    await service.createTenant(
      {
        nombreLegal: ' El Fuego S.A.C. ',
        nombreComercial: ' El Fuego ',
        ruc: '20123456786',
        emailAdmin: 'ana@fuego.pe',
        nombreAdmin: ' Ana ',
        password: 'Fogoneria123!',
        plan: 'PROFESIONAL',
        trialDias: 30,
        limiteSucursales: 5,
        sucursalNombre: '',
      } as never,
      actor,
    );

    expect(prisma.tx.empresas.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nombre_legal: 'El Fuego S.A.C.',
        nombre_comercial: 'El Fuego',
        plan_actual: 'PROFESIONAL',
        limite_sucursales: 5,
      }),
    });
    expect(prisma.tx.suscripciones_eventos.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ plan: 'PROFESIONAL' }),
    });
  });

  it('usa los defaults del trial y de la sucursal matriz', async () => {
    prisma.raw.empresas.findFirst.mockResolvedValue(null);
    await service.createTenant(
      {
        nombreLegal: 'El Fuego S.A.C.',
        ruc: '20123456786',
        emailAdmin: 'ana@fuego.pe',
        nombreAdmin: 'Ana',
        password: 'Fogoneria123!',
      } as never,
      actor,
    );
    expect(prisma.tx.empresas.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        plan_actual: 'TRIAL',
        limite_sucursales: 3,
        nombre_comercial: null,
      }),
    });
    expect(prisma.tx.sucursales.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ nombre: 'Sede principal' }),
    });
  });

  it('reactiva con motivo por defecto y audita según el estado', async () => {
    prisma.raw.empresas.findFirst.mockResolvedValue({
      id: EMPRESA,
      estado: 'SUSPENDED',
      plan_actual: 'BASICO',
      mrr_monto: 99,
    });
    prisma.tx.empresas.update.mockResolvedValue({
      id: EMPRESA,
      estado: 'ACTIVE',
    });

    await service.reactivate(EMPRESA, undefined, actor);
    expect(prisma.tx.suscripciones_eventos.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        motivo: 'Reactivación manual',
        estado_anterior: 'SUSPENDED',
        estado_nuevo: 'ACTIVE',
      }),
    });
    expect(prisma.tx.auditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ accion: 'TENANT_REACTIVADO' }),
    });
  });

  it('no escribe si la empresa ya está en el estado pedido', async () => {
    prisma.raw.empresas.findFirst.mockResolvedValue({
      id: EMPRESA,
      estado: 'ACTIVE',
      plan_actual: 'BASICO',
      mrr_monto: 99,
    });
    const resultado = await service.reactivate(EMPRESA, 'ya activa', actor);
    expect(resultado).toMatchObject({ estado: 'ACTIVE' });
    expect(prisma.raw.$transaction).not.toHaveBeenCalled();
  });

  it('devuelve MRR 0 si no hay suscripciones activas', async () => {
    prisma.raw.empresas.count.mockResolvedValue(0);
    const metricas = await service.metrics();
    expect(metricas.mrr).toBe(0);
  });
});
