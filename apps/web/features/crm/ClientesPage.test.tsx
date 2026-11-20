import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  hasSession: false,
  customers: [] as unknown[],
  setCustomers: () => {},
  notify: () => {},
  activeBranchId: 's-1',
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

import { ClientesPage } from './ClientesPage';

describe('ClientesPage', () => {
  it('pinta el maestro demo de clientes', () => {
    const markup = renderToStaticMarkup(<ClientesPage />);
    expect(markup).toContain('Nuevo cliente');
    expect(markup).toContain('Buscar');
    expect(markup).toContain('Segmento');
  });

  it('con clientes pinta la tabla y sus segmentos', () => {
    estado.customers = [
      { id: 1, name: 'Rosa Pérez', phone: '+51 987 654 321', email: '', segment: 'VIP', visits: 21, points: 1240, lastVisit: 'Hoy', birthday: '', notes: '' },
      { id: 2, name: 'Jorge Paredes', phone: '+51 955 128 774', email: '', segment: 'Nuevo', visits: 1, points: 10, lastVisit: 'Ayer', birthday: '', notes: '' },
    ];
    const markup = renderToStaticMarkup(<ClientesPage />);
    expect(markup).toContain('Rosa Pérez');
    expect(markup).toContain('Jorge Paredes');
    estado.customers = [];
  });

  it('con sesión arranca en modo API y deja el buscador disponible', () => {
    estado.hasSession = true;
    const markup = renderToStaticMarkup(<ClientesPage />);
    expect(markup).toContain('Buscar');
    estado.hasSession = false;
  });
});
