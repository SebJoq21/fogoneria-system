import { describe, expect, it } from 'vitest';

import { AUTH_LOGOUT_PATH, AUTH_SESSION_PATH } from './auth/api';
import { billingApi } from './billing/api';
import { onboardingApi } from './onboarding/api';
import { saasApi } from './saas/api';
import { tenantApi } from './tenant/api';
import { featureModules } from './registry';
import * as realtime from './realtime';

/**
 * F4/F5: fija las superficies públicas de las features de plataforma y el
 * transporte realtime sin tocar la red ni la sesión (BFF/`proxy.ts`).
 */
describe('superficies de plataforma', () => {
  it('expone las rutas de sesión del BFF', () => {
    expect(AUTH_SESSION_PATH).toBe('/api/session');
    expect(AUTH_LOGOUT_PATH).toBe('/api/session/logout');
  });

  it('expone las APIs delgadas de tenant, onboarding, saas y billing', () => {
    expect(typeof tenantApi.empresa).toBe('function');
    expect(typeof tenantApi.sucursales).toBe('function');
    expect(typeof onboardingApi.submit).toBe('function');
    expect(typeof saasApi.empresas).toBe('function');
    expect(typeof saasApi.suspender).toBe('function');
    expect(typeof billingApi.resumen).toBe('function');
  });

  it('reexporta el transporte realtime', () => {
    expect(typeof realtime.connectOrdersRealtime).toBe('function');
  });

  it('registra las 20 features sin pendientes', () => {
    expect(featureModules).toHaveLength(20);
  });
});
