// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sesion = vi.hoisted(() => ({
  currentUser: null,
  hasSession: false,
  ready: true,
  login: vi.fn(),
  logout: vi.fn(),
}));

const avisos = vi.hoisted(() => ({
  notifications: [],
  hasUnread: false,
  notify: vi.fn(),
  clearUnread: vi.fn(),
}));

const tenant = vi.hoisted(() => ({
  tenant: null,
  company: { legalName: 'Demo', ruc: '20123456786' },
  branches: [],
  realBranches: [],
  branchIds: [],
  activeBranch: { id: 'todas', name: 'Todas', short: 'Todas', isMain: false, status: 'Abierta' },
  activeBranchId: 'todas',
  isGeneral: true,
  writeBranchId: 'todas',
  setActiveBranch: vi.fn(),
  loading: false,
  error: null,
  refreshTenant: vi.fn(),
}));

const catalogo = vi.hoisted(() => ({
  products: [],
  categories: [],
  modifierGroups: [],
  priceLists: [],
  catalogLoading: false,
  catalogError: null,
  catalogVersion: 0,
  refreshCatalog: vi.fn().mockResolvedValue(undefined),
  saveProduct: vi.fn(),
  setProductActive: vi.fn(),
  saveCategory: vi.fn(),
  deleteCategory: vi.fn(),
  createModifierGroup: vi.fn(),
  updateModifierGroup: vi.fn(),
  deleteModifierGroup: vi.fn(),
  createPriceList: vi.fn(),
  activatePriceList: vi.fn(),
  setPrice: vi.fn(),
  priceOf: vi.fn(() => 0),
  categoryNameOf: vi.fn(() => '—'),
}));

vi.mock('@/components/dashboard/providers/session', () => ({ useSession: () => sesion }));
vi.mock('@/components/dashboard/providers/notifications', () => ({
  useNotifications: () => avisos,
}));
vi.mock('@/features/tenant/provider', () => ({ useTenant: () => tenant }));
vi.mock('@/components/dashboard/providers/catalog', () => ({
  useCatalogoState: () => catalogo,
}));
vi.mock('@/lib/realtime', () => ({ connectOrdersRealtime: () => () => {} }));

import { CrmProvider } from '@/features/crm/provider';
import { ModulesProvider } from './ModulesProvider';

const legacyCustomer = {
  id: 99,
  name: 'Cliente legacy',
  phone: '999999999',
  points: 7,
  visits: 2,
  segment: 'Nuevo',
  lastVisit: 'Ayer',
};

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('migración CRM en el arranque del shell', () => {
  it('migra antes del primer save, purga el legacy y no duplica al remontar', async () => {
    localStorage.setItem(
      'fogoneria:erp:v2:anon',
      JSON.stringify({
        version: 2,
        roles: [],
        reservations: [],
        ingredients: [],
        movements: [],
        customers: [legacyCustomer],
        coupons: [],
        receipts: [],
        expenses: [],
        combos: [],
        tickets: [],
        scopes: {},
        accounts: [],
        cashShifts: [],
        sunatContingencia: false,
      }),
    );

    const { unmount } = render(
      <CrmProvider>
        <ModulesProvider initialPayments={[]}>
          <div />
        </ModulesProvider>
      </CrmProvider>,
    );

    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('fogoneria:crm:v1:anon') ?? '[]')).toHaveLength(1),
    );
    const legacy = JSON.parse(localStorage.getItem('fogoneria:erp:v2:anon') ?? '{}');
    expect(legacy.customers).toBeUndefined();

    unmount();
    render(
      <CrmProvider>
        <ModulesProvider initialPayments={[]}>
          <div />
        </ModulesProvider>
      </CrmProvider>,
    );
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('fogoneria:crm:v1:anon') ?? '[]')).toHaveLength(1),
    );
  });
});
