import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSessionRateLimit,
  hitSessionRateLimit,
  resetSessionRateLimit,
} from './session-rate-limit';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-20T12:00:00.000Z'));
  resetSessionRateLimit();
});

afterEach(() => {
  vi.useRealTimers();
  resetSessionRateLimit();
});

describe('hitSessionRateLimit', () => {
  it('permite cinco intentos y bloquea el sexto con reintento', () => {
    for (let intento = 1; intento <= 5; intento += 1) {
      expect(hitSessionRateLimit('1.1.1.1')).toEqual({ allowed: true });
    }
    const bloqueado = hitSessionRateLimit('1.1.1.1');
    expect(bloqueado).toEqual({ allowed: false, retryAfter: 600 });
  });

  it('separa los contadores por IP', () => {
    for (let intento = 0; intento < 5; intento += 1) hitSessionRateLimit('1.1.1.1');
    expect(hitSessionRateLimit('1.1.1.1')).toMatchObject({ allowed: false });
    expect(hitSessionRateLimit('2.2.2.2')).toEqual({ allowed: true });
  });

  it('reinicia la ventana al cumplirse los 10 minutos', () => {
    for (let intento = 0; intento < 5; intento += 1) hitSessionRateLimit('1.1.1.1');
    expect(hitSessionRateLimit('1.1.1.1')).toMatchObject({ allowed: false });

    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    expect(hitSessionRateLimit('1.1.1.1')).toEqual({ allowed: true });
  });

  it('un login correcto limpia los fallos de esa IP', () => {
    for (let intento = 0; intento < 5; intento += 1) hitSessionRateLimit('1.1.1.1');
    expect(hitSessionRateLimit('1.1.1.1')).toMatchObject({ allowed: false });

    clearSessionRateLimit('1.1.1.1');
    expect(hitSessionRateLimit('1.1.1.1')).toEqual({ allowed: true });
  });

  it('el reintento se redondea hacia arriba en segundos', () => {
    for (let intento = 0; intento < 6; intento += 1) hitSessionRateLimit('3.3.3.3');
    const bloqueado = hitSessionRateLimit('3.3.3.3');
    expect(bloqueado).toMatchObject({ allowed: false });
    if (!bloqueado.allowed) expect(bloqueado.retryAfter).toBeLessThanOrEqual(600);
  });
});
