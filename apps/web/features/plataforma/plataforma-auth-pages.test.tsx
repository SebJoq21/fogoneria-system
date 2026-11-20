import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
}));

const estado = vi.hoisted(() => ({ login: () => Promise.resolve({ role: 'admin' }) }));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

import { LoginPage } from './LoginPage';
import { RecoverPage } from './RecoverPage';

describe('LoginPage', () => {
  it('pinta el formulario de acceso', () => {
    const markup = renderToStaticMarkup(<LoginPage />);
    expect(markup).toContain('Bienvenido de nuevo');
    expect(markup).toContain('Correo');
    expect(markup).toContain('Contraseña');
    expect(markup).toContain('Entrar');
  });
});

describe('RecoverPage', () => {
  it('pinta la recuperación por soporte con el correo visible', () => {
    const markup = renderToStaticMarkup(<RecoverPage />);
    expect(markup).toContain('Solicitar ayuda');
    expect(markup).toContain('soporte');
  });
});
