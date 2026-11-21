// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/app/caja',
  useRouter: () => router,
}));

const tema = vi.hoisted(() => ({ theme: 'light' as 'light' | 'dark', toggle: vi.fn() }));
vi.mock('@/components/theme', () => ({ useTheme: () => tema }));

const estado = vi.hoisted(() => ({
  currentUser: {
    id: 'u-1',
    name: 'Ana',
    email: 'ana@fogoneria.pe',
    role: 'admin',
    empresaId: 'e-1',
    branchId: null,
    initials: 'AN',
  },
  logout: vi.fn(),
  resetDemoData: vi.fn(),
  notify: vi.fn(),
  company: { legalName: 'Mi Restaurante S.A.C.', ruc: '20123456786' },
  branches: [
    { id: 's-1', name: 'Miraflores', short: 'Miraflores', isMain: true, status: 'Abierta' },
    { id: 's-2', name: 'Surco', short: 'Surco', isMain: false, status: 'Cerrada' },
  ],
  activeBranch: { id: 's-1', name: 'Miraflores', short: 'Miraflores', isMain: true, status: 'Abierta' },
  setActiveBranch: vi.fn(),
}));

const avisos = vi.hoisted(() => ({ notifications: [] as unknown[] }));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));
vi.mock('@/components/dashboard/providers/notifications', () => ({ useNotifications: () => avisos }));

import { AppTopBar } from './AppTopBar';
import { BranchSwitcher } from './BranchSwitcher';
import { MenuPreview } from './MenuPreview';
import { MetricsCharts } from './MetricsCharts';
import { Toasts } from '@/components/ui/Toast';

afterEach(cleanup);

const menu = [
  { id: 'm-1', name: 'Lomo saltado', description: 'Con papas', price: '$24.90', category: 'Fondos', image: '/lomo.jpg', status: 'Activo' },
  { id: 'm-2', name: 'Chicha', description: 'Jarra', price: '$8.00', category: 'Bebidas', image: '/chicha.jpg', status: 'Activo' },
];

describe('MenuPreview', () => {
  it('filtra por categoría y vuelve a todos', () => {
    render(<MenuPreview menuItems={menu} />);
    expect(screen.getByText('Lomo saltado')).toBeTruthy();
    expect(screen.getByText('Chicha')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Bebidas' }));
    expect(screen.queryByText('Lomo saltado')).toBeNull();
    expect(screen.getByText('Chicha')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    expect(screen.getByText('Lomo saltado')).toBeTruthy();
  });
});

describe('MetricsCharts', () => {
  it('pinta las tarjetas de visitas y reservas', () => {
    render(<MetricsCharts />);
    expect(screen.getByText('Visitas Totales')).toBeTruthy();
    expect(screen.getByText('Clics en Reservar')).toBeTruthy();
  });
});

describe('AppTopBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tema.theme = 'light';
    estado.currentUser.role = 'admin';
  });

  it('cambia el tema y muestra el título de la ruta', () => {
    render(<AppTopBar />);
    expect(screen.getByRole('heading', { name: 'Caja' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Cambiar a modo oscuro'));
    expect(tema.toggle).toHaveBeenCalled();
  });

  it('abre el perfil y navega a configuración', () => {
    render(<AppTopBar />);
    fireEvent.click(screen.getByLabelText('Perfil de usuario'));
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('ana@fogoneria.pe')).toBeTruthy();
    fireEvent.click(screen.getByText('Configuración'));
    expect(router.push).toHaveBeenCalledWith('/app/configuracion');
  });

  it('reinicia la demo solo al confirmar', () => {
    render(<AppTopBar />);
    fireEvent.click(screen.getByLabelText('Perfil de usuario'));
    fireEvent.click(screen.getByText('Reiniciar datos demo'));
    expect(screen.getByText('¿Volver al estado inicial? Se perderán cuentas, ventas y cambios guardados en este navegador.')).toBeTruthy();
    fireEvent.click(screen.getByText('Reiniciar'));
    expect(estado.resetDemoData).toHaveBeenCalled();
    expect(estado.notify).toHaveBeenCalledWith('Datos reiniciados', expect.any(String));
  });

  it('cancelar el reinicio no borra nada', () => {
    render(<AppTopBar />);
    fireEvent.click(screen.getByLabelText('Perfil de usuario'));
    fireEvent.click(screen.getByText('Reiniciar datos demo'));
    fireEvent.click(screen.getByText('Cancelar'));
    expect(estado.resetDemoData).not.toHaveBeenCalled();
  });

  it('cierra sesión desde el perfil', () => {
    render(<AppTopBar />);
    fireEvent.click(screen.getByLabelText('Perfil de usuario'));
    fireEvent.click(screen.getByText('Cerrar sesión'));
    expect(estado.logout).toHaveBeenCalled();
  });
});

describe('BranchSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    estado.currentUser.role = 'admin';
  });

  it('cambia de sucursal desde el selector del dueño', () => {
    render(<BranchSwitcher />);
    fireEvent.click(screen.getByLabelText('Cambiar de sucursal'));
    expect(screen.getByText('Surco')).toBeTruthy();
    fireEvent.click(screen.getByText('Surco'));
    expect(estado.setActiveBranch).toHaveBeenCalledWith('s-2');
    expect(estado.notify).toHaveBeenCalledWith('Sucursal cambiada', expect.stringContaining('Surco'));
  });

  it('la sucursal activa no dispara cambio', () => {
    render(<BranchSwitcher />);
    fireEvent.click(screen.getByLabelText('Cambiar de sucursal'));
    fireEvent.click(screen.getAllByText('Miraflores').at(-1)!);
    expect(estado.setActiveBranch).not.toHaveBeenCalled();
  });

  it('un rol operativo ve la sucursal fija sin selector', () => {
    estado.currentUser.role = 'cajero';
    render(<BranchSwitcher />);
    expect(screen.queryByLabelText('Cambiar de sucursal')).toBeNull();
    expect(screen.getByText('Miraflores')).toBeTruthy();
  });
});

describe('Toasts', () => {
  afterEach(() => {
    vi.useRealTimers();
    avisos.notifications = [];
  });

  it('sin avisos no pinta nada', () => {
    const { container } = render(<Toasts />);
    expect(container.firstChild).toBeNull();
  });

  it('pinta el último aviso y lo retira a los 4 s', () => {
    vi.useFakeTimers();
    avisos.notifications = [{ id: 1, title: 'Comanda lista', message: 'Mesa 4', timestamp: Date.now() }];
    const { container } = render(<Toasts />);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('Comanda lista')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(container.firstChild).toBeNull();
  });
});
