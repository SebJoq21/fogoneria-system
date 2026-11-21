// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ pathname: '/app' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

const sesion = vi.hoisted(() => ({
  currentUser: null as null | { role: string; name: string },
}));
vi.mock('./ModulesProvider', () => ({ useModules: () => sesion }));
vi.mock('@/features/tenant', () => ({ BranchSwitcher: () => <div>sucursal</div> }));

import { AppSidebar } from './AppSidebar';

beforeEach(() => {
  nav.pathname = '/app';
  sesion.currentUser = null;
});

afterEach(cleanup);

describe('AppSidebar', () => {
  it('muestra el menú del admin y filtra las vistas de rol único', () => {
    sesion.currentUser = { role: 'admin', name: 'Dueño' };
    render(<AppSidebar />);
    expect(screen.getByText('Inicio')).toBeTruthy();
    expect(screen.getByText('Mesas')).toBeTruthy();
    expect(screen.getByText('Caja')).toBeTruthy();
    expect(screen.queryByText('Cocina')).toBeNull();
    expect(screen.queryByText('Mis órdenes')).toBeNull();
  });

  it('muestra solo Cocina al rol cocina y solo Mis órdenes al mesero', () => {
    sesion.currentUser = { role: 'cocina', name: 'Chef' };
    const { unmount } = render(<AppSidebar />);
    expect(screen.getByText('Cocina')).toBeTruthy();
    expect(screen.queryByText('Inicio')).toBeNull();
    unmount();

    sesion.currentUser = { role: 'mesero', name: 'Luis' };
    render(<AppSidebar />);
    expect(screen.getByText('Mis órdenes')).toBeTruthy();
    expect(screen.queryByText('Mesas')).toBeNull();
  });

  it('sin usuario no filtra el menú', () => {
    render(<AppSidebar />);
    expect(screen.getByText('Cocina')).toBeTruthy();
    expect(screen.getByText('Mis órdenes')).toBeTruthy();
    expect(screen.getByText('Inicio')).toBeTruthy();
  });

  it('Auditoría solo aparece para admin', () => {
    sesion.currentUser = { role: 'admin', name: 'Dueño' };
    render(<AppSidebar />);
    expect(screen.getByText('Auditoría')).toBeTruthy();
    cleanup();

    sesion.currentUser = { role: 'sucursal', name: 'Sucursal' };
    render(<AppSidebar />);
    expect(screen.queryByText('Auditoría')).toBeNull();
  });

  it('marca el enlace activo por ruta exacta o prefijo', () => {
    nav.pathname = '/app';
    const { unmount } = render(<AppSidebar />);
    expect(screen.getByText('Inicio').closest('a')?.className).toContain('bg-primary');
    unmount();

    nav.pathname = '/app/mesas/maestro';
    render(<AppSidebar />);
    expect(screen.getByText('Mesas').closest('a')?.className).toContain('bg-primary');
  });
});
