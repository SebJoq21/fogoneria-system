import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

type Hit = { count: number; resetAt: number };

/** Máximo de claves vigiladas a la vez (podado al superarlo). */
const MAX_KEYS = 5_000;

export type RateLimitOptions = {
  /** Solicitudes permitidas por ventana. */
  limit: number;
  /** Largo de la ventana en milisegundos. */
  windowMs: number;
  /** Prefijo para separar contadores por endpoint. */
  keyPrefix?: string;
};

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/**
 * Limitador en memoria por IP (ventana fija). Suficiente para endpoints
 * públicos como el onboarding; en un despliegue multi-instancia conviene un
 * almacén compartido (Redis).
 *
 * Sin dependencias inyectadas a propósito: así los tests de módulo y e2e no
 * necesitan registrar el guard. La configuración sale de `ONBOARDING_RATE_*`.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, Hit>();
  private options: RateLimitOptions = {
    limit: positiveInt(process.env.ONBOARDING_RATE_LIMIT, 5),
    windowMs: positiveInt(process.env.ONBOARDING_RATE_WINDOW_MS, 600_000),
    keyPrefix: 'onboarding',
  };

  /** Ajusta la ventana (pruebas unitarias). */
  configure(options: Partial<RateLimitOptions>): this {
    this.options = { ...this.options, ...options };
    return this;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = `${this.options.keyPrefix ?? 'default'}:${request.ip ?? 'desconocida'}`;
    const now = Date.now();

    if (this.hits.size > MAX_KEYS) this.prune(now);

    const hit = this.hits.get(key);
    if (!hit || hit.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.options.windowMs });
      return true;
    }
    if (hit.count >= this.options.limit) {
      const retry = Math.max(1, Math.ceil((hit.resetAt - now) / 1000));
      throw new HttpException(
        `Demasiadas solicitudes. Vuelve a intentarlo en ${retry}s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    hit.count += 1;
    return true;
  }

  /** Descarta contadores vencidos para no crecer sin límite. */
  private prune(now: number): void {
    for (const [key, hit] of this.hits) {
      if (hit.resetAt <= now) this.hits.delete(key);
    }
  }
}
