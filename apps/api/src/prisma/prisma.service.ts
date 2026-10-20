import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { TenantContextService } from '../common/context/tenant-context.service.js';
import { withTenantScope, type TenantPrismaClient } from './tenant.extension.js';

/**
 * Cliente Prisma 7 (adapter pg).
 * - `scoped`: queries de negocio con filtro automático de tenant.
 * - `raw`: cliente sin extensión para auth y consola SaaS (superadmin).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  readonly scoped: TenantPrismaClient;

  constructor(config: ConfigService, tenantContext: TenantContextService) {
    const connectionString = config.get<string>('DATABASE_URL');
    if (!connectionString) throw new Error('DATABASE_URL no está definida');

    super({
      adapter: new PrismaPg(connectionString, {
        schema: config.get<string>('DATABASE_SCHEMA') ?? 'fogoneria',
      }),
    });

    this.scoped = withTenantScope(this, tenantContext);
  }

  get raw(): PrismaClient {
    return this;
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect().catch((error: unknown) => {
      this.logger.warn(`No se pudo desconectar Prisma: ${String(error)}`);
    });
  }
}
