import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { TenantContextService } from '../common/context/tenant-context.service.js';
import { withTenantScope, type TenantPrismaClient } from './tenant.extension.js';

/**
 * Cliente Prisma 7 (adapter pg).
 * - `raw`: cliente sin extensión para auth y consola SaaS (superadmin).
 * - `scoped`: queries de negocio con filtro automático de tenant.
 *
 * No heredar de `PrismaClient`: en Prisma 7 el constructor devuelve un proxy y
 * `this` dentro de una subclase no expone los modelos (`raw.usuarios` sería
 * `undefined`). La composición mantiene ambos clientes intactos.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  readonly raw: PrismaClient;
  readonly scoped: TenantPrismaClient;

  constructor(config: ConfigService, tenantContext: TenantContextService) {
    const connectionString = config.get<string>('DATABASE_URL');
    if (!connectionString) throw new Error('DATABASE_URL no está definida');

    this.raw = new PrismaClient({
      adapter: new PrismaPg(connectionString, {
        schema: config.get<string>('DATABASE_SCHEMA') ?? 'fogoneria',
      }),
    });
    this.scoped = withTenantScope(this.raw, tenantContext);
  }

  async onModuleDestroy(): Promise<void> {
    await this.raw.$disconnect().catch((error: unknown) => {
      this.logger.warn(`No se pudo desconectar Prisma: ${String(error)}`);
    });
  }
}
