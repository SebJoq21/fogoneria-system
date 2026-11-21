import { HttpException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { RateLimitGuard } from './rate-limit.guard.js';

function contextFor(ip: string | undefined) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ ip }) }),
  } as unknown as Parameters<RateLimitGuard['canActivate']>[0];
}

describe('RateLimitGuard (f4: poda y valores por defecto)', () => {
  it('usa una IP desconocida y un prefijo por defecto', () => {
    const guard = new RateLimitGuard().configure({ limit: 1, windowMs: 60_000, keyPrefix: undefined });
    expect(guard.canActivate(contextFor(undefined))).toBe(true);
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(HttpException);
  });

  it('poda los contadores vencidos al superar el máximo de claves', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-20T10:00:00.000Z'));
      const guard = new RateLimitGuard().configure({ limit: 5, windowMs: 1_000, keyPrefix: 'test' });
      const hits = (guard as unknown as { hits: Map<string, { count: number; resetAt: number }> }).hits;
      for (let index = 0; index < 5_001; index += 1) {
        hits.set(`test:${index}`, { count: 1, resetAt: Date.now() - 1 });
      }

      expect(guard.canActivate(contextFor('10.0.0.9'))).toBe(true);
      expect(hits.has('test:0')).toBe(false);
      expect(hits.has('test:10.0.0.9')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
