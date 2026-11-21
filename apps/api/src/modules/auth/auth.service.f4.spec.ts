import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

const PASSWORD = 'Fogoneria123!';
const passwordHash = bcrypt.hashSync(PASSWORD, 4);

function buildPrisma() {
  return {
    raw: {
      usuarios: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
    },
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>, expiresIn?: string) {
  const jwt = { signAsync: vi.fn().mockResolvedValue('jwt-token') };
  const config = {
    get: vi.fn((key: string) => (key === 'JWT_EXPIRES_IN' ? expiresIn : undefined)),
  };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwt as unknown as JwtService,
    config as unknown as ConfigService,
  );
  return { service, jwt };
}

const usuario = (overrides: Record<string, unknown> = {}) => ({
  id: 'u1',
  empresa_id: null,
  sucursal_id: null,
  nombre: 'Super',
  email: 'super@fogoneria.com',
  password_hash: passwordHash,
  rol: 'SUPERADMIN' as const,
  estado: 'ACTIVO' as const,
  deleted_at: null,
  empresas: null,
  sucursales: null,
  ...overrides,
});

describe('AuthService (f4: empresa y sesión)', () => {
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(() => {
    prisma = buildPrisma();
  });

  it('login de superadmin sin empresa usa expiresIn por defecto', async () => {
    prisma.raw.usuarios.findMany.mockResolvedValue([usuario()]);
    const { service } = buildService(prisma);

    const result = await service.login({ email: 'super@fogoneria.com', password: PASSWORD });

    expect(result.tenant).toBeNull();
    expect(result.expiresIn).toBe('8h');
    expect(result.user).toMatchObject({ id: 'u1', empresaId: null });
  });

  it('login con empresa dada de baja o sin nombre comercial', async () => {
    prisma.raw.usuarios.findMany.mockResolvedValue([
      usuario({
        empresas: {
          id: 'e1',
          nombre_legal: 'El Fuego S.A.C.',
          nombre_comercial: null,
          estado: 'ACTIVE',
          plan_actual: 'BASICO',
          trial_fin: null,
          deleted_at: null,
        },
      }),
    ]);
    const { service } = buildService(prisma, '2h');
    const result = await service.login({ email: 'ana@fuego.pe', password: PASSWORD });
    expect(result.tenant).toMatchObject({ nombre: 'El Fuego S.A.C.' });
    expect(result.expiresIn).toBe('2h');

    prisma.raw.usuarios.findMany.mockResolvedValue([
      usuario({
        empresas: {
          id: 'e1',
          nombre_legal: 'El Fuego S.A.C.',
          nombre_comercial: 'El Fuego',
          estado: 'ACTIVE',
          plan_actual: 'BASICO',
          trial_fin: null,
          deleted_at: new Date(),
        },
      }),
    ]);
    await expect(
      service.login({ email: 'ana@fuego.pe', password: PASSWORD }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('me rechaza usuario inexistente o inactivo y resuelve el tenant', async () => {
    const { service } = buildService(prisma);
    prisma.raw.usuarios.findFirst.mockResolvedValue(null);
    await expect(service.me({ sub: 'u1' } as never)).rejects.toBeInstanceOf(UnauthorizedException);

    prisma.raw.usuarios.findFirst.mockResolvedValue(usuario({ estado: 'INACTIVO' }));
    await expect(service.me({ sub: 'u1' } as never)).rejects.toBeInstanceOf(UnauthorizedException);

    prisma.raw.usuarios.findFirst.mockResolvedValue(
      usuario({
        empresas: {
          id: 'e1',
          nombre_legal: 'El Fuego S.A.C.',
          nombre_comercial: null,
          estado: 'ACTIVE',
          plan_actual: 'BASICO',
          trial_fin: null,
          deleted_at: null,
        },
      }),
    );
    const me = await service.me({ sub: 'u1' } as never);
    expect(me.tenant).toMatchObject({ id: 'e1', nombre: 'El Fuego S.A.C.' });
  });
});
