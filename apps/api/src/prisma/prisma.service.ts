import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import {
  TenantContextService,
  type TenantContext,
} from '../common/context/tenant-context.service.js';
import { withTenantScope, type TenantPrismaClient } from './tenant.extension.js';

/**
 * Cliente Prisma 7 (adapter pg).
 * - `raw`: rol de plataforma (auth, onboarding, SaaS, auditoria). Debe usar
 *   `DATABASE_URL_SAAS` con BYPASSRLS cuando RLS esté en FORCE.
 * - `scoped`: rol de negocio `DATABASE_URL_RLS`, sujeto a RLS.
 *
 * Las queries del request autenticado se ejecutan dentro de una transacción
 * que fija `app.empresa_id`, `app.sucursal_id`, `app.usuario_id` y `app.bypass`
 * con `set_config(..., true)`. La extensión redirige las queries a esa misma
 * transacción para que el contexto no se pierda en el pool.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  /** Cliente de plataforma: sin filtro de tenant, con BYPASSRLS. */
  readonly raw: PrismaClient;
  /** Cliente de negocio: RLS activo y filtro de tenant por extensión. */
  readonly rls: PrismaClient;
  /** Extensión sobre el cliente de negocio. */
  readonly scoped: TenantPrismaClient;

  constructor(
    config: ConfigService,
    private readonly tenantContext: TenantContextService,
  ) {
    const connectionString = config.get<string>('DATABASE_URL');
    if (!connectionString) throw new Error('DATABASE_URL no está definida');

    const schema = config.get<string>('DATABASE_SCHEMA') ?? 'fogoneria';
    const rawConnection = config.get<string>('DATABASE_URL_SAAS') ?? connectionString;
    const rlsConnection = config.get<string>('DATABASE_URL_RLS') ?? connectionString;

    this.raw = new PrismaClient({
      adapter: new PrismaPg(rawConnection, { schema }),
    });
    this.rls = new PrismaClient({
      adapter: new PrismaPg(rlsConnection, { schema }),
    });
    this.scoped = withTenantScope(this.rls, tenantContext);
  }

  /**
   * Abre la transacción del request y fija el contexto de sesión de Postgres.
   * Sin empresa y sin bypass no se abre transacción (rutas públicas).
   */
  async runWithTenant<T>(
    context: Partial<TenantContext>,
    callback: () => Promise<T>,
  ): Promise<T> {
    return this.tenantContext.run(context, async () => {
      if (!context.empresaId && !context.bypass) return callback();

      return this.rls.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.empresa_id', $1, true)",
          context.empresaId ?? '',
        );
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.sucursal_id', $1, true)",
          context.sucursalId ?? '',
        );
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.usuario_id', $1, true)",
          context.userId ?? '',
        );
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.bypass', $1, true)",
          context.bypass ? 'on' : 'off',
        );

        this.tenantContext.setTransaction(tx);
        return callback();
      });
    });
  }

  async onModuleDestroy(): Promise<void> {
    const results = await Promise.allSettled([this.raw.$disconnect(), this.rls.$disconnect()]);
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.warn(`No se pudo desconectar Prisma: ${String(result.reason)}`);
      }
    }
  }
}
