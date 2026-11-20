import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  tables: [
    { id: 1, label: 'Mesa 1', seats: 4, shape: 'round', status: 'libre', zone: 'Salón' },
  ],
  setTables: () => {},
  reservations: [],
  accounts: [],
  currentUser: { id: 'u-1', role: 'sucursal' },
  hasSession: false,
  notify: () => {},
  refreshTables: () => {},
  tablesLoading: false,
  tablesError: null,
  isGeneral: false,
  branches: [],
  branchOf: () => null,
  activeBranchId: 's-1',
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

import { SalonTablesView } from './SalonTablesView';

describe('SalonTablesView', () => {
  it('pinta el maestro de mesas con sus acciones', () => {
    const markup = renderToStaticMarkup(<SalonTablesView />);
    expect(markup).toContain('Mesa 1');
    expect(markup).toContain('Nueva mesa');
    expect(markup).toContain('Salón');
  });
});
