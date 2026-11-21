// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pathname = vi.hoisted(() => ({ value: '/app/caja' }));

vi.mock('next/navigation', () => ({ usePathname: () => pathname.value }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock('./AppSidebar', () => ({ AppSidebar: () => <aside>Sidebar</aside> }));
vi.mock('./AppTopBar', () => ({ AppTopBar: () => <header>TopBar</header> }));
vi.mock('@/components/ui/Toast', () => ({ Toasts: () => <span>Toasts</span> }));

const estado = vi.hoisted(() => ({
  currentUser: { role: 'admin' as string | null },
  branches: [
    { id: 's-1', name: 'Miraflores' },
    { id: 's-2', name: 'Surco' },
  ],
  activeBranch: { id: 's-1', name: 'Miraflores' },
  setActiveBranch: vi.fn(),
}));

vi.mock('./ModulesProvider', () => ({ useModules: () => estado }));

import { DashboardShell } from './DashboardShell';

describe('DashboardShell', () => {
  beforeEach(() => {
    pathname.value = '/app/caja';
    estado.currentUser.role = 'admin';
    estado.setActiveBranch.mockReset();
  });

  afterEach(cleanup);

  it('pinta sidebar, topbar, contenido y la navegación móvil del rol', () => {
    const { container } = render(<DashboardShell><p>Contenido</p></DashboardShell>);
    expect(screen.getByText('Sidebar')).toBeTruthy();
    expect(screen.getByText('TopBar')).toBeTruthy();
    expect(screen.getByText('Contenido')).toBeTruthy();
    expect(screen.getByText('Inicio')).toBeTruthy();
    expect(screen.getByText('Platos')).toBeTruthy();
    expect(container.querySelector('a[href="/app"]')).toBeTruthy();
  });

  it('el cajero solo ve su enlace de caja', () => {
    estado.currentUser.role = 'cajero';
    render(<DashboardShell><p>Contenido</p></DashboardShell>);
    expect(screen.getByText('Caja')).toBeTruthy();
    expect(screen.queryByText('Platos')).toBeNull();
  });

  it('sin usuario pinta todos los enlaces', () => {
    estado.currentUser.role = null;
    render(<DashboardShell><p>Contenido</p></DashboardShell>);
    expect(screen.getByText('Cocina')).toBeTruthy();
    expect(screen.getByText('Mis órdenes')).toBeTruthy();
  });

  it('la sucursal móvil cambia con el selector del dueño', () => {
    render(<DashboardShell><p>Contenido</p></DashboardShell>);
    fireEvent.change(screen.getByLabelText('Sucursal activa'), { target: { value: 's-2' } });
    expect(estado.setActiveBranch).toHaveBeenCalledWith('s-2');
  });

  it('la sucursal móvil es texto fijo para roles operativos', () => {
    estado.currentUser.role = 'cajero';
    render(<DashboardShell><p>Contenido</p></DashboardShell>);
    expect(screen.getByText('Miraflores')).toBeTruthy();
    expect(screen.queryByLabelText('Sucursal activa')).toBeNull();
  });

  it('cocina y mozo son vista tablet sin sidebar ni nav', () => {
    pathname.value = '/app/cocina';
    estado.currentUser.role = 'cocina';
    render(<DashboardShell><p>Contenido</p></DashboardShell>);
    expect(screen.queryByText('Sidebar')).toBeNull();
    expect(screen.queryByText('Cocina')).toBeNull();
    expect(screen.getByText('Contenido')).toBeTruthy();
  });
});
