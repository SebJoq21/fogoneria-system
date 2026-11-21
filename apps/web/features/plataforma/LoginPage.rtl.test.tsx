// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const sesion = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => sesion }));

import { LoginPage } from './LoginPage';

beforeEach(() => {
  sesion.login.mockReset();
  router.push.mockReset();
});

afterEach(cleanup);

describe('LoginPage', () => {
  it('exige correo y contraseña', () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByText('Ingresa tu correo y contraseña.')).toBeTruthy();
    expect(sesion.login).not.toHaveBeenCalled();
  });

  it('entra y redirige al home del rol', async () => {
    sesion.login.mockResolvedValue({ role: 'cajero' });
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText('tucorreo@ejemplo.com'), {
      target: { value: 'caja@mirestaurante.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'Fogoneria123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() =>
      expect(sesion.login).toHaveBeenCalledWith('caja@mirestaurante.com', 'Fogoneria123!'),
    );
    expect(router.push).toHaveBeenCalledWith('/app/caja');
  });

  it('muestra el error del login', async () => {
    sesion.login.mockRejectedValue(new Error('Credenciales inválidas'));
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText('tucorreo@ejemplo.com'), {
      target: { value: 'x@y.pe' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'mala' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(screen.getByText('Credenciales inválidas')).toBeTruthy());
    expect(router.push).not.toHaveBeenCalled();
  });

  it('enlaza la recuperación y los términos', () => {
    render(<LoginPage />);
    expect(screen.getByText('¿Olvidaste tu contraseña?').closest('a')?.getAttribute('href')).toBe(
      '/recuperar',
    );
    expect(screen.getByText('Términos y Condiciones').closest('a')?.getAttribute('href')).toBe(
      '/terminos',
    );
  });
});
