import { defer, type Observable } from 'rxjs';
import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { TenantContextService } from './tenant-context.service.js';
import type { AuthenticatedUser } from '../types/authenticated-user.js';

/**
 * Publica el tenant del JWT en AsyncLocalStorage para todo el request.
 * `defer` asegura que la suscripción (y por tanto las queries) corra dentro del contexto.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextService) {}

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

    return defer(() => this.tenantContext.run(tenant, () => next.handle()));
  }
}
