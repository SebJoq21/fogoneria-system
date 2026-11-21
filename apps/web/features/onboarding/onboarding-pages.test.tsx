// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const estado = vi.hoisted(() => ({ login: vi.fn(), notify: vi.fn() }));
vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

const api = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock('./api', () => ({ onboardingApi: api }));

import { OnboardingPage } from './OnboardingPage';

function llenarPasoUno() {
  fireEvent.change(screen.getByPlaceholderText('Ej. Parrilla El Fuego S.A.C.'), {
    target: { value: 'El Fuego SAC' },
  });
  fireEvent.change(screen.getByPlaceholderText('20123456786'), {
    target: { value: '20123456786' },
  });
}

function llenarPasoAdmin() {
  fireEvent.change(screen.getByPlaceholderText(/Mar.a Torres/), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByPlaceholderText('admin@turestaurante.pe'), {
    target: { value: 'ana@fuego.pe' },
  });
  fireEvent.change(screen.getByPlaceholderText(/nimo 8 caracteres/), {
    target: { value: 'secreta123' },
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('OnboardingPage', () => {
  it('arranca en el primer paso del wizard', () => {
    const markup = renderToStaticMarkup(<OnboardingPage />);
    expect(markup).toContain('Conozcamos tu restaurante');
    expect(markup).toContain('Razón social');
    expect(markup).toContain('Identidad y Local');
  });

  it('valida el paso 1 y navega adelante y atrás', () => {
    render(<OnboardingPage />);

    fireEvent.click(screen.getByText('Siguiente'));
    expect(screen.getByRole('alert').textContent).toMatch(/Ingresa la raz/);

    llenarPasoUno();
    fireEvent.click(screen.getByText('Siguiente'));
    expect(screen.getByText('La Carta')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Atr/ }));
    expect(screen.getByText('Identidad y Local')).toBeTruthy();
  });

  it('crea la cuenta y entra con el rol nuevo', async () => {
    estado.login.mockResolvedValue({ role: 'admin' });
    api.submit.mockResolvedValue({ empresaId: 'e-1' });
    render(<OnboardingPage />);
    llenarPasoUno();
    fireEvent.click(screen.getByText('Siguiente'));
    fireEvent.click(screen.getByText('Siguiente'));
    llenarPasoAdmin();
    fireEvent.click(screen.getByText('Finalizar y Enviar'));

    await waitFor(() => expect(api.submit).toHaveBeenCalled());
    await waitFor(() =>
      expect(estado.login).toHaveBeenCalledWith('ana@fuego.pe', 'secreta123'),
    );
    expect(router.push).toHaveBeenCalled();
  });

  it('muestra el error de la API al finalizar', async () => {
    api.submit.mockRejectedValue(new Error('RUC ya registrado'));
    render(<OnboardingPage />);
    llenarPasoUno();
    fireEvent.click(screen.getByText('Siguiente'));
    fireEvent.click(screen.getByText('Siguiente'));
    llenarPasoAdmin();
    fireEvent.click(screen.getByText('Finalizar y Enviar'));

    await waitFor(() => expect(api.submit).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('RUC ya registrado'));
    expect(estado.login).not.toHaveBeenCalled();
  });
});
