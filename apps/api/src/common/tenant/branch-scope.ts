import { BadRequestException, NotFoundException } from '@nestjs/common';
import type {
  TenantContext,
  TenantContextService,
} from '../context/tenant-context.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantPrismaClient } from '../../prisma/tenant.extension.js';

export interface TenantIdentity {
  empresaId: string;
  userId: string | null;
}

/**
 * Sucursal que trae el token. Si el rol está atado a una sucursal y pide otra,
 * la operación se rechaza con 400: el filtro del servidor manda.
 */
export function sucursalDelContexto(
  contexto: TenantContext | undefined,
  solicitada?: string,
): string | null {
  const delToken = contexto?.sucursalId ?? null;
  if (!delToken) return null;
  if (solicitada && solicitada !== delToken) {
    throw new BadRequestException(
      'El token está atado a otra sucursal: no se puede indicar sucursalId',
    );
  }
  return delToken;
}

/** Filtro de lectura: la sucursal del token manda; sin ella, la pedida o todas. */
export function resolverSucursalFiltro(
  contexto: TenantContext | undefined,
  solicitada?: string,
): string | null {
  return sucursalDelContexto(contexto, solicitada) ?? solicitada ?? null;
}

/** Valida que la sucursal exista en la empresa y devuelve su id. */
export async function buscarSucursal(
  sucursales: TenantPrismaClient['sucursales'],
  id: string,
): Promise<string> {
  const sucursal = await sucursales.findFirst({
    where: { id, deleted_at: null },
    select: { id: true },
  });
  if (!sucursal) throw new NotFoundException('Sucursal no encontrada');
  return sucursal.id;
}

/**
 * Base de los servicios que operan por sucursal: empresa y usuario del request,
 * sucursal de escritura (token o `sucursalId` del `ADMIN_GLOBAL`) y filtro de
 * lectura. Las reglas viven en un solo lugar en vez de repetirse en cada
 * servicio; el comportamiento y los mensajes de error no cambian.
 */
export abstract class TenantScopedService {
  protected abstract readonly prisma: PrismaService;
  protected abstract readonly tenantContext: TenantContextService;

  /** Empresa obligatoria del token, con el usuario que ejecuta la acción. */
  protected tenant(): TenantIdentity {
    const context = this.tenantContext.get();
    if (!context?.empresaId) {
      throw new BadRequestException('La operación requiere empresa en el token');
    }
    return { empresaId: context.empresaId, userId: context.userId ?? null };
  }

  protected sucursalDelToken(solicitada?: string): string | null {
    return sucursalDelContexto(this.tenantContext.get(), solicitada);
  }

  protected resolveSucursalFiltro(solicitada?: string): string | null {
    return resolverSucursalFiltro(this.tenantContext.get(), solicitada);
  }

  /**
   * Sucursal de escritura: la del token o, para `ADMIN_GLOBAL` (que no la
   * lleva), la indicada y validada contra su empresa.
   */
  protected async resolveSucursal(solicitada?: string): Promise<string> {
    const delToken = this.sucursalDelToken(solicitada);
    if (delToken) return delToken;
    if (!solicitada) {
      throw new BadRequestException(
        'Indica sucursalId: tu usuario no está atado a una sucursal',
      );
    }
    return buscarSucursal(this.prisma.scoped.sucursales, solicitada);
  }
}
