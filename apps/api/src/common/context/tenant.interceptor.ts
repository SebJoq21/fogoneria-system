import { defer, from, lastValueFrom, type Observable } from 'rxjs';
import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { TenantContextService } from './tenant-context.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../types/authenticated-user.js';

/**
 * Publica el tenant del JWT en AsyncLocalStorage para todo el request.
 * En requests autenticados abre además la transacción RLS y fija `app.*`
 * antes de ejecutar el handler; las queries de `prisma.scoped` se enrutan a
 * esa transacción.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    const tenant = user
      ? {
          userId: user.sub,
          empresaId: user.empresaId,
          sucursalId: user.sucursalId,
          rol: user.rol,
          bypass: user.rol === 'SUPERADMIN',
        }
      : {};

    if (!user) {
      return defer(() => this.tenantContext.run(tenant, () => next.handle()));
    }

    return defer(() =>
      from(
        this.prisma.runWithTenant(tenant, () => lastValueFrom(next.handle())),
      ),
    );
  }
}
