import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  currentUser: { role: 'sucursal' as string | undefined },
  tables: [] as unknown[],
  reservations: [] as unknown[],
  products: [] as unknown[],
  categories: [] as unknown[],
  priceLists: [] as unknown[],
  priceOf: vi.fn(() => 24.9),
  categoryNameOf: vi.fn(() => 'Fondos'),
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children?: unknown }) => <div>{children as never}</div>,
  BarChart: ({ children }: { children?: unknown }) => <div>{children as never}</div>,
  Bar: () => null,
  XAxis: () => null,
}));
vi.mock('@/components/dashboard/MenuPreview', () => ({
  MenuPreview: ({ menuItems }: { menuItems: unknown[] }) => <div>menu:{menuItems.length}</div>,
}));
vi.mock('@/components/dashboard/summaries/ModuleSummary', () => ({
  ModuleSummary: ({ chartTitle, children }: { chartTitle: string; children?: unknown }) => (
    <div>
      {chartTitle}:{children as never}
    </div>
  ),
}));
vi.mock('@/components/dashboard/summaries/charts', () => ({ MiniBars: () => null }));

import { BookingsWorkspace } from '@/features/reservations';
import { CartaVirtualView } from '@/features/catalog';
import { StaffWorkspace } from './StaffWorkspace';

describe('BookingsWorkspace', () => {
  it('calcula ocupación con mesas y muestra el maestro solo a sucursal', () => {
    estado.tables = [{ status: 'ocupada' }, { status: 'libre' }];
    estado.reservations = [{ id: 'r-1' }];
    estado.currentUser = { role: 'sucursal' };
    const html = renderToStaticMarkup(<BookingsWorkspace />);
    expect(html).toContain('50%');
    expect(html).toContain('Maestro de mesas');
    expect(html).toContain('Reservas hoy');
  });

  it('no divide por cero y oculta el maestro al admin', () => {
    estado.tables = [];
    estado.reservations = [];
    estado.currentUser = { role: 'admin' };
    const html = renderToStaticMarkup(<BookingsWorkspace />);
    expect(html).toContain('0%');
    expect(html).not.toContain('Maestro de mesas');
  });
});

describe('StaffWorkspace', () => {
  it('pinta KPIs, gráfico y accesos', () => {
    const html = renderToStaticMarkup(<StaffWorkspace />);
    expect(html).toContain('En turno ahora');
    expect(html).toContain('Asistencia semanal');
    expect(html).toContain('Marcar asistencia');
    expect(html).toContain('Roles');
  });
});

describe('CartaVirtualView', () => {
  it('usa la lista activa y solo platos activos', () => {
    estado.products = [
      { id: 'p-1', name: 'Lomo', description: 'rico', status: 'Activo', categoryId: 'c-1', image: '' },
      { id: 'p-2', name: 'Retirado', description: '', status: 'Inactivo', categoryId: 'c-1', image: '' },
    ];
    estado.categories = [{ id: 'c-1', name: 'Fondos' }];
    estado.priceLists = [
      { id: 'l-1', name: 'Carta', active: true },
      { id: 'l-2', name: 'Delivery', active: false },
    ];
    const html = renderToStaticMarkup(<CartaVirtualView />);
    expect(html).toContain('Carta');
    expect(html).toContain('menu:1');
  });

  it('cae a un guion si no hay lista activa', () => {
    estado.products = [];
    estado.priceLists = [];
    const html = renderToStaticMarkup(<CartaVirtualView />);
    expect(html).toContain('menu:0');
    expect(html).toContain('—');
  });
});
