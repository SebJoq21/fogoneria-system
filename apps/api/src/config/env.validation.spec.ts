import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.validation.js';

describe('validateEnv', () => {
  it('en desarrollo completa defaults y marca el secreto débil', () => {
    const env = validateEnv({});

    expect(env.DATABASE_URL).toMatch(/^postgresql:\/\//);
    expect(env.JWT_SECRET).toBe('dev-only-jwt-secret-change-me');
    expect(env.JWT_SECRET_IS_DEV_DEFAULT).toBe('true');
    expect(env.JWT_EXPIRES_IN).toBe('8h');
    expect(env.PORT).toBe(3001);
    expect(env.CORS_ORIGIN).toBe('http://localhost:3000');
    expect(env.DATABASE_SCHEMA).toBe('fogoneria');
    expect(env.DATABASE_POOL_MAX).toBe(10);
    expect(env.TRIAL_DAYS).toBe(14);
    expect(env.ONBOARDING_RATE_LIMIT).toBe(5);
    expect(env.ONBOARDING_RATE_WINDOW_MS).toBe(600_000);
    expect(env.STOCK_WEBHOOK_URL).toBe('');
    expect(env.STOCK_WEBHOOK_SECRET).toBe('');
  });

  it('respeta los valores entregados', () => {
    const env = validateEnv({
      DATABASE_URL: 'postgresql://x',
      JWT_SECRET: 'x'.repeat(40),
      JWT_EXPIRES_IN: '1h',
      PORT: '4000',
      CORS_ORIGIN: 'https://app.pe',
      DATABASE_SCHEMA: 'otro',
      DATABASE_POOL_MAX: '20',
      TRIAL_DAYS: '7',
      ONBOARDING_RATE_LIMIT: '3',
      ONBOARDING_RATE_WINDOW_MS: '1000',
      STOCK_WEBHOOK_URL: 'https://n8n.pe/hook',
      STOCK_WEBHOOK_SECRET: 'secreto',
    });
    expect(env).toMatchObject({
      JWT_EXPIRES_IN: '1h',
      PORT: 4000,
      CORS_ORIGIN: 'https://app.pe',
      DATABASE_SCHEMA: 'otro',
      DATABASE_POOL_MAX: 20,
      TRIAL_DAYS: 7,
      ONBOARDING_RATE_LIMIT: 3,
      ONBOARDING_RATE_WINDOW_MS: 1000,
      STOCK_WEBHOOK_URL: 'https://n8n.pe/hook',
      STOCK_WEBHOOK_SECRET: 'secreto',
    });
    expect(env.JWT_SECRET_IS_DEV_DEFAULT).toBeUndefined();
  });

  it('usa el fallback cuando el entero no es positivo', () => {
    const env = validateEnv({
      DATABASE_POOL_MAX: '0',
      TRIAL_DAYS: '-1',
      ONBOARDING_RATE_LIMIT: 'abc',
      ONBOARDING_RATE_WINDOW_MS: 'NaN',
    });
    expect(env.DATABASE_POOL_MAX).toBe(10);
    expect(env.TRIAL_DAYS).toBe(14);
    expect(env.ONBOARDING_RATE_LIMIT).toBe(5);
    expect(env.ONBOARDING_RATE_WINDOW_MS).toBe(600_000);
  });

  it('redondea los enteros con decimales', () => {
    const env = validateEnv({ DATABASE_POOL_MAX: '10.9' });
    expect(env.DATABASE_POOL_MAX).toBe(10);
  });

  it('en producción exige DATABASE_URL, JWT_SECRET y un secreto largo', () => {
    expect(() => validateEnv({ NODE_ENV: 'production' })).toThrow(
      'DATABASE_URL es obligatoria en producción',
    );
    expect(() =>
      validateEnv({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://x' }),
    ).toThrow('JWT_SECRET es obligatoria en producción');
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://x',
        JWT_SECRET: 'corto',
      }),
    ).toThrow('JWT_SECRET debe tener al menos 32 caracteres en producción');
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://x',
        JWT_SECRET: 'x'.repeat(32),
      }),
    ).not.toThrow();
  });
});
