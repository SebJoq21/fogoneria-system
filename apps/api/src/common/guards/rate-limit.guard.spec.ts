import { HttpException, HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { RateLimitGuard } from './rate-limit.guard.js';

function contextFor(ip: string) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ ip }) }),
  } as unknown as Parameters<RateLimitGuard['canActivate']>[0];
}

describe('RateLimitGuard', () => {
  it('permite hasta el límite y luego responde 429', () => {
    const guard = new RateLimitGuard().configure({ limit: 2, windowMs: 60_000, keyPrefix: 'onboarding' });
    const ctx = contextFor('10.0.0.1');

    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(() => guard.canActivate(ctx)).toThrow(HttpException);

    try {
      guard.canActivate(ctx);
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('cuenta por IP', () => {
    const guard = new RateLimitGuard().configure({ limit: 1, windowMs: 60_000, keyPrefix: 'test' });
    expect(guard.canActivate(contextFor('10.0.0.2'))).toBe(true);
    expect(guard.canActivate(contextFor('10.0.0.3'))).toBe(true);
    expect(() => guard.canActivate(contextFor('10.0.0.2'))).toThrow(HttpException);
  });

  it('libera la ventana al expirar', () => {
    vi.useFakeTimers();
    try {
      const guard = new RateLimitGuard().configure({ limit: 1, windowMs: 1_000, keyPrefix: 'test' });
      const ctx = contextFor('10.0.0.4');
      expect(guard.canActivate(ctx)).toBe(true);
      expect(() => guard.canActivate(ctx)).toThrow(HttpException);
      vi.advanceTimersByTime(1_001);
      expect(guard.canActivate(ctx)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
