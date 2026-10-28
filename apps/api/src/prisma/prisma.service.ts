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
    const poolMax = Number(config.get('DATABASE_POOL_MAX') ?? 10);

    // Cada cliente tiene su propio pool: el de negocio (RLS) y el de plataforma
    // (auth/SaaS/folios). Se dimensionan juntos para no superar `max_connections`.
    this.raw = new PrismaClient({
      adapter: new PrismaPg({ connectionString: rawConnection, max: poolMax }, { schema }),
    });
    this.rls = new PrismaClient({
      adapter: new PrismaPg({ connectionString: rlsConnection, max: poolMax }, { schema }),
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
        // Una sola sentencia: cuatro `set_config` separados eran cuatro
        // round-trips por request y pesaban en el pico de comandas (AYCDS-22).
        await tx.$queryRawUnsafe(
          `SELECT set_config('app.empresa_id', $1, true),
                  set_config('app.sucursal_id', $2, true),
                  set_config('app.usuario_id', $3, true),
                  set_config('app.bypass', $4, true)`,
          context.empresaId ?? '',
          context.sucursalId ?? '',
          context.userId ?? '',
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
