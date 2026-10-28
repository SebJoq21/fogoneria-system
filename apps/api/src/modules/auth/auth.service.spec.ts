import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
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
        update: vi.fn().mockResolvedValue({}),
      },
    },
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  const jwt = { signAsync: vi.fn().mockResolvedValue('jwt-token') };
  const config = {
    get: vi.fn((key: string) => (key === 'JWT_EXPIRES_IN' ? '8h' : undefined)),
  };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwt as unknown as JwtService,
    config as unknown as ConfigService,
  );
  return { service, jwt };
}

const usuarioBase = {
  id: 'u1',
  empresa_id: 'e1',
  sucursal_id: 's1',
  nombre: 'Ana',
  email: 'ana@fuego.pe',
  password_hash: passwordHash,
  rol: 'ADMIN_GLOBAL' as const,
  estado: 'ACTIVO' as const,
  deleted_at: null,
  empresas: {
    id: 'e1',
    nombre_legal: 'El Fuego S.A.C.',
    nombre_comercial: 'El Fuego',
    estado: 'ACTIVE' as const,
    plan_actual: 'PROFESIONAL' as const,
    trial_fin: null,
    deleted_at: null,
  },
  sucursales: null,
};

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve token y tenant con credenciales válidas', async () => {
    const prisma = buildPrisma();
    prisma.raw.usuarios.findMany.mockResolvedValue([usuarioBase]);
    const { service } = buildService(prisma);

    const result = await service.login({
      email: 'ana@fuego.pe',
      password: PASSWORD,
    });

    expect(result.accessToken).toBe('jwt-token');
    expect(result.user).toMatchObject({ id: 'u1', rol: 'ADMIN_GLOBAL' });
    expect(result.tenant).toMatchObject({ id: 'e1', estado: 'ACTIVE' });
    expect(prisma.raw.usuarios.update).toHaveBeenCalledOnce();
  });

  it('rechaza contraseña incorrecta', async () => {
    const prisma = buildPrisma();
    prisma.raw.usuarios.findMany.mockResolvedValue([usuarioBase]);
    const { service } = buildService(prisma);

    await expect(
      service.login({ email: 'ana@fuego.pe', password: 'incorrecta' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza usuario inexistente', async () => {
    const prisma = buildPrisma();
    const { service } = buildService(prisma);

    await expect(
      service.login({ email: 'nadie@fuego.pe', password: PASSWORD }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza tenant suspendido', async () => {
    const prisma = buildPrisma();
    prisma.raw.usuarios.findMany.mockResolvedValue([
      { ...usuarioBase, empresas: { ...usuarioBase.empresas, estado: 'SUSPENDED' } },
    ]);
    const { service } = buildService(prisma);

    await expect(
      service.login({ email: 'ana@fuego.pe', password: PASSWORD }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza trial vencido', async () => {
    const prisma = buildPrisma();
    prisma.raw.usuarios.findMany.mockResolvedValue([
      {
        ...usuarioBase,
        empresas: {
          ...usuarioBase.empresas,
          estado: 'TRIAL',
          trial_fin: new Date('2020-01-01T00:00:00.000Z'),
        },
      },
    ]);
    const { service } = buildService(prisma);

    await expect(
      service.login({ email: 'ana@fuego.pe', password: PASSWORD }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza usuario no activo', async () => {
    const prisma = buildPrisma();
    prisma.raw.usuarios.findMany.mockResolvedValue([
      { ...usuarioBase, estado: 'SUSPENDIDO' },
    ]);
    const { service } = buildService(prisma);

    await expect(
      service.login({ email: 'ana@fuego.pe', password: PASSWORD }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza el login cuando el correo existe en dos empresas', async () => {
    const prisma = buildPrisma();
    prisma.raw.usuarios.findMany.mockResolvedValue([
      usuarioBase,
      { ...usuarioBase, id: 'u2', empresa_id: 'e2' },
    ]);
    const { service } = buildService(prisma);

    await expect(
      service.login({ email: 'ana@fuego.pe', password: PASSWORD }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('entra a la empresa cuya contraseña coincide cuando el correo se repite', async () => {
    const prisma = buildPrisma();
    prisma.raw.usuarios.findMany.mockResolvedValue([
      { ...usuarioBase, id: 'u2', empresa_id: 'e2', password_hash: bcrypt.hashSync('otra-clave', 4) },
      usuarioBase,
    ]);
    const { service } = buildService(prisma);

    const result = await service.login({ email: 'ana@fuego.pe', password: PASSWORD });
    expect(result.user.id).toBe('u1');
  });

  describe('ws-ticket (AYCDS-14)', () => {
    const payload = {
      sub: 'u1',
      email: 'ana@fuego.pe',
      nombre: 'Ana',
      rol: 'MESERO' as const,
      empresaId: 'e1',
      sucursalId: 's1',
    };

    it('emite un ticket de 60 s con scope ws y sin datos de sesión HTTP', async () => {
      const prisma = buildPrisma();
      const { service, jwt } = buildService(prisma);

      const result = await service.issueWsTicket(payload);

      expect(result).toEqual({ ticket: 'jwt-token', expiresIn: 60 });
      expect(jwt.signAsync).toHaveBeenCalledWith(
        {
          sub: 'u1',
          empresaId: 'e1',
          sucursalId: 's1',
          rol: 'MESERO',
          scope: 'ws',
        },
        { expiresIn: 60 },
      );
    });

    it('rechaza el ticket si la sesión no tiene empresa (superadmin)', async () => {
      const prisma = buildPrisma();
      const { service, jwt } = buildService(prisma);

      await expect(
        service.issueWsTicket({ ...payload, empresaId: null }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });
  });
});
