import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TenantContextService } from '../../common/context/tenant-context.service.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  context(user: AuthenticatedUser) {
    const context = this.tenantContext.get();
    return {
      userId: user.sub,
      email: user.email,
      rol: user.rol,
      empresaId: user.empresaId,
      sucursalId: user.sucursalId,
      bypassTenantFilter: context?.bypass ?? user.rol === 'SUPERADMIN',
    };
  }

  async currentTenant(user: AuthenticatedUser) {
    if (!user.empresaId) {
      throw new NotFoundException('El usuario no pertenece a una empresa');
    }
    const empresa = await this.prisma.scoped.empresas.findFirst({
      where: { id: user.empresaId, deleted_at: null },
      select: {
        id: true,
        nombre_legal: true,
        nombre_comercial: true,
        ruc: true,
        estado: true,
        plan_actual: true,
        limite_sucursales: true,
        trial_fin: true,
        mrr_monto: true,
        created_at: true,
      },
    });
    if (!empresa) throw new NotFoundException('Empresa no encontrada');

    const [sucursales, usuarios] = await Promise.all([
      this.prisma.scoped.sucursales.count({
        where: { empresa_id: empresa.id, deleted_at: null },
      }),
      this.prisma.scoped.usuarios.count({
        where: { empresa_id: empresa.id, deleted_at: null },
      }),
    ]);

    return { ...empresa, totalSucursales: sucursales, totalUsuarios: usuarios };
  }

  listBranches() {
    return this.prisma.scoped.sucursales.findMany({
      where: { deleted_at: null },
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        nombre_corto: true,
        direccion: true,
        telefono: true,
        aforo: true,
        es_matriz: true,
        estado: true,
      },
    });
  }
}
