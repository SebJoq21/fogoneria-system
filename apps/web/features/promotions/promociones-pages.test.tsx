import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  combos: [
    { id: 1, name: 'Dúo Criollo', description: 'Ceviche + chicha', productIds: ['p-1'], price: 17, status: 'Activo' },
  ],
  setCombos: () => {},
  products: [{ id: 'p-1', name: 'Ceviche', sku: 'CEV', categoryId: 'c-1', price: 12 }],
  notify: () => {},
  coupons: [
    { id: 1, code: 'VERANO20', kind: 'percent', value: 10, used: 2, limit: 10, active: true, expires: '2026-12-31' },
  ],
  setCoupons: () => {},
  tables: [],
  reservations: [],
  accounts: [],
  currentUser: { id: 'u-1', role: 'admin' },
  hasSession: false,
  refreshTables: () => {},
  refreshReservations: () => {},
  tablesLoading: false,
  tablesError: null,
  reservationsLoading: false,
  reservationsError: null,
  openAccount: () => {},
  isGeneral: false,
  branches: [],
  branchOf: () => null,
  activeBranchId: 's-1',
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

import { CombosPage } from './CombosPage';
import { PromocionesPage } from './PromocionesPage';

describe('CombosPage', () => {
  it('pinta los combos con su resumen', () => {
    const markup = renderToStaticMarkup(<CombosPage />);
    expect(markup).toContain('Dúo Criollo');
    expect(markup).toContain('Resumen de combos');
  });
});

describe('PromocionesPage', () => {
  it('pinta los cupones con su uso', () => {
    const markup = renderToStaticMarkup(<PromocionesPage />);
    expect(markup).toContain('VERANO20');
    expect(markup).toContain('Cupones');
  });
});
