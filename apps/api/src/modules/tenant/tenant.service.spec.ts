import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { TenantService } from './tenant.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantContextService } from '../../common/context/tenant-context.service.js';

function build() {
  const prisma = {
    scoped: {
      empresas: { findFirst: vi.fn() },
      sucursales: { count: vi.fn(), findMany: vi.fn() },
      usuarios: { count: vi.fn() },
    },
  };
  const tenantContext = { get: vi.fn() };
  return {
    service: new TenantService(
      prisma as unknown as PrismaService,
      tenantContext as unknown as TenantContextService,
    ),
    prisma,
    tenantContext,
  };
}

const user = {
  sub: 'u-1',
  email: 'a@b.com',
  rol: 'ADMIN_GLOBAL',
  empresaId: 'e-1',
  sucursalId: null,
} as never;

describe('TenantService', () => {
  it('devuelve el contexto del token con el bypass de RLS', () => {
    const { service, tenantContext } = build();
    tenantContext.get.mockReturnValue({ bypass: true });
    expect(service.context(user)).toEqual({
      userId: 'u-1',
      email: 'a@b.com',
      rol: 'ADMIN_GLOBAL',
      empresaId: 'e-1',
      sucursalId: null,
      bypassTenantFilter: true,
    });
  });

  it('sin contexto, SUPERADMIN también opera con bypass', () => {
    const { service, tenantContext } = build();
    tenantContext.get.mockReturnValue(undefined);
    const contexto = service.context({ ...(user as object), rol: 'SUPERADMIN' } as never);
    expect(contexto.bypassTenantFilter).toBe(true);
  });

  it('un rol operativo sin bypass no filtra por tenant', () => {
    const { service, tenantContext } = build();
    tenantContext.get.mockReturnValue(undefined);
    const contexto = service.context({ ...(user as object), rol: 'MESERO' } as never);
    expect(contexto.bypassTenantFilter).toBe(false);
  });

  it('exige empresa en el token', async () => {
    const { service } = build();
    await expect(
      service.currentTenant({ ...(user as object), empresaId: null } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('devuelve la empresa con los conteos de sucursales y usuarios', async () => {
    const { service, prisma } = build();
    prisma.scoped.empresas.findFirst.mockResolvedValue({
      id: 'e-1',
      nombre_legal: 'El Fuego',
    });
    prisma.scoped.sucursales.count.mockResolvedValue(3);
    prisma.scoped.usuarios.count.mockResolvedValue(7);

    const empresa = await service.currentTenant(user);

    expect(empresa).toEqual({
      id: 'e-1',
      nombre_legal: 'El Fuego',
      totalSucursales: 3,
      totalUsuarios: 7,
    });
    expect(prisma.scoped.empresas.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'e-1', deleted_at: null } }),
    );
  });

  it('404 si la empresa no existe', async () => {
    const { service, prisma } = build();
    prisma.scoped.empresas.findFirst.mockResolvedValue(null);
    await expect(service.currentTenant(user)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lista las sucursales activas ordenadas por nombre', async () => {
    const { service, prisma } = build();
    prisma.scoped.sucursales.findMany.mockResolvedValue([{ id: 's-1' }]);
    await expect(service.listBranches()).resolves.toEqual([{ id: 's-1' }]);
    expect(prisma.scoped.sucursales.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deleted_at: null },
        orderBy: { nombre: 'asc' },
      }),
    );
  });
});
