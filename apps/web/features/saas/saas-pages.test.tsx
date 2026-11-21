// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sesion = vi.hoisted(() => ({
  logout: vi.fn(),
  notify: vi.fn(),
  currentUser: { id: 'u-1', name: 'Super', email: 'super@fogoneria.pe', role: 'superadmin' },
}));
vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => sesion }));

const api = vi.hoisted(() => ({
  empresas: vi.fn(),
  metricas: vi.fn(),
  suspender: vi.fn(),
  reactivar: vi.fn(),
}));
vi.mock('./api', () => ({ saasApi: api }));

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
  sesion.logout.mockReset();
  sesion.notify.mockReset();
  api.empresas.mockResolvedValue({ items: [empresa], total: 1, page: 1, limit: 50 });
  api.metricas.mockResolvedValue(metricas);
});

afterEach(cleanup);

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

  it('compone la sección de facturación', async () => {
    render(
      <SaasPage billing={<div>Facturación embebida</div>} />,
    );
    await waitFor(() => expect(screen.getByText('El Fuego')).toBeTruthy());
    expect(screen.getByText('Facturación embebida')).toBeTruthy();
  });
});
