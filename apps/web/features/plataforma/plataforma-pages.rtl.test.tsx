// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const sesion = vi.hoisted(() => ({
  login: vi.fn(),
  logout: vi.fn(),
  notify: vi.fn(),
  currentUser: { id: 'u-1', name: 'Super', email: 'super@fogoneria.pe', role: 'superadmin' },
}));
vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => sesion }));

const api = vi.hoisted(() => ({
  onboarding: vi.fn(),
  empresas: vi.fn(),
  metricas: vi.fn(),
  suspender: vi.fn(),
  reactivar: vi.fn(),
}));
vi.mock('./api', () => ({ plataformaApi: api }));

import { OnboardingPage } from './OnboardingPage';
import { SaasPage } from './SaasPage';

const empresa = {
  id: 'e-1',
  nombreLegal: 'El Fuego',
  nombreComercial: null,
  ruc: '20123456786',
  estado: 'ACTIVE',
  plan: 'PROFESIONAL',
  mrr: 299,
  sucursales: 2,
  usuarios: 5,
};

const metricas = {
  empresas: { total: 1, trial: 0, active: 1, suspended: 0, expired: 0 },
  mrr: 299,
};

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  sesion.login.mockReset().mockResolvedValue({ role: 'admin' });
  sesion.logout.mockReset();
  sesion.notify.mockReset();
  router.push.mockReset();
  api.empresas.mockResolvedValue({ items: [empresa], total: 1, page: 1, limit: 50 });
  api.metricas.mockResolvedValue(metricas);
});

afterEach(cleanup);

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

describe('OnboardingPage', () => {
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
    api.onboarding.mockResolvedValue({ empresaId: 'e-1' });
    render(<OnboardingPage />);
    llenarPasoUno();
    fireEvent.click(screen.getByText('Siguiente'));
    fireEvent.click(screen.getByText('Siguiente'));
    llenarPasoAdmin();
    fireEvent.click(screen.getByText('Finalizar y Enviar'));

    await waitFor(() => expect(api.onboarding).toHaveBeenCalled());
    await waitFor(() =>
      expect(sesion.login).toHaveBeenCalledWith('ana@fuego.pe', 'secreta123'),
    );
    expect(router.push).toHaveBeenCalled();
  });

  it('muestra el error de la API al finalizar', async () => {
    api.onboarding.mockRejectedValue(new Error('RUC ya registrado'));
    render(<OnboardingPage />);
    llenarPasoUno();
    fireEvent.click(screen.getByText('Siguiente'));
    fireEvent.click(screen.getByText('Siguiente'));
    llenarPasoAdmin();
    fireEvent.click(screen.getByText('Finalizar y Enviar'));

    await waitFor(() => expect(api.onboarding).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('RUC ya registrado'));
    expect(sesion.login).not.toHaveBeenCalled();
  });
});

describe('SaasPage', () => {
  it('carga empresas y métricas', async () => {
    render(<SaasPage />);
    await waitFor(() => expect(screen.getByText('El Fuego')).toBeTruthy());
    expect(screen.getAllByText('Empresas').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$299.00').length).toBeGreaterThan(0);
    expect(api.empresas).toHaveBeenCalled();
    expect(api.metricas).toHaveBeenCalled();
  });

  it('suspende y reactiva una empresa', async () => {
    api.suspender.mockResolvedValue({ ...empresa, estado: 'SUSPENDED' });
    api.reactivar.mockResolvedValue(empresa);
    render(<SaasPage />);
    await waitFor(() => expect(screen.getByText('El Fuego')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Suspender' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Suspender' }).at(-1)!);
    await waitFor(() => expect(api.suspender).toHaveBeenCalledWith('e-1', expect.any(String)));
    await waitFor(() => expect(screen.getByText('Reactivar')).toBeTruthy());
    expect(sesion.notify).toHaveBeenCalledWith('Empresa suspendida', 'El Fuego');

    fireEvent.click(screen.getByRole('button', { name: 'Reactivar' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Reactivar' }).at(-1)!);
    await waitFor(() => expect(api.reactivar).toHaveBeenCalledWith('e-1', expect.any(String)));
    expect(sesion.notify).toHaveBeenCalledWith('Empresa reactivada', 'El Fuego');
  });

  it('muestra el vacío y el error de carga', async () => {
    api.empresas.mockResolvedValueOnce({ items: [], total: 0, page: 1, limit: 50 });
    render(<SaasPage />);
    await waitFor(() => expect(screen.getByText(/A.n no hay empresas/)).toBeTruthy());

    cleanup();
    api.empresas.mockRejectedValueOnce(new Error('caído'));
    render(<SaasPage />);
    await waitFor(() => expect(screen.getByText('No se pudo cargar la consola SaaS.')).toBeTruthy());
  });

  it('avisa cuando la suspensión falla', async () => {
    api.suspender.mockRejectedValue(new Error('caído'));
    render(<SaasPage />);
    await waitFor(() => expect(screen.getByText('El Fuego')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Suspender' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Suspender' }).at(-1)!);
    await waitFor(() =>
      expect(sesion.notify).toHaveBeenCalledWith(
        'No se pudo actualizar la empresa',
        'No se pudo cargar la consola SaaS.',
      ),
    );
  });
});
