import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({ push: () => {}, replace: () => {}, refresh: () => {} }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));

const estado = vi.hoisted(() => ({ login: () => Promise.resolve({ role: 'admin' }) }));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

import { OnboardingPage } from './OnboardingPage';
import { SaasPage } from './SaasPage';

describe('OnboardingPage', () => {
  it('arranca en el primer paso del wizard', () => {
    const markup = renderToStaticMarkup(<OnboardingPage />);
    expect(markup).toContain('Conozcamos tu restaurante');
    expect(markup).toContain('Razón social');
    expect(markup).toContain('Identidad y Local');
  });
});

describe('SaasPage', () => {
  it('pinta la consola SaaS con su cabecera', () => {
    const markup = renderToStaticMarkup(<SaasPage />);
    expect(markup).toContain('Fogonería');
    expect(markup).toContain('Empresas');
  });
});
