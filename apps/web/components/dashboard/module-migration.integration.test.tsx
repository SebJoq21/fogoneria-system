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
import { ExpensesProvider } from '@/features/expenses/provider';
import { InventoryProvider } from '@/features/inventory/provider';
import { AccountsProvider } from '@/features/orders/provider';
import { StaffProvider } from '@/features/staff/provider';
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

const legacyAccount = {
  id: 'CT-99',
  branchId: 'miraflores',
  tableId: 2,
  tableApiId: null,
  label: 'Mesa 2',
  customer: 'Ana',
  waiter: 'Luis',
  openedAt: '2026-11-20T12:00:00.000Z',
  closedAt: null,
  status: 'abierta',
  items: [],
  payments: [],
  tip: 0,
  discount: 0,
  discountConcept: '',
  couponCode: null,
  customerId: null,
  motivoAnulacion: null,
};

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('migración de slices en el arranque del shell', () => {
  it('migra antes del primer save, purga el legacy y no duplica al remontar', async () => {
    localStorage.setItem(
      'fogoneria:erp:v2:anon',
      JSON.stringify({
        version: 2,
        reservations: [],
        customers: [legacyCustomer],
        expenses: [{ id: 8, date: 'Hoy', category: 'Insumos', supplier: 'Proveedor', amount: '$10.00', status: 'Pagado' }],
        ingredients: [{ id: 8, name: 'Sal', category: 'Insumos', stock: 1, min: 1, unit: 'kg', state: 'Óptimo' }],
        movements: [{ id: 8, datetime: 'Hoy', type: 'Entrada', ingredient: 'Sal', qty: '+1 kg', reason: 'Compra' }],
        roles: [{ id: 8, name: 'Rol legacy', description: 'Demo' }],
        coupons: [],
        receipts: [],
        combos: [],
        tickets: [],
        scopes: {},
        accounts: [legacyAccount],
        cashShifts: [],
        sunatContingencia: false,
      }),
    );

    const shell = (
      <CrmProvider>
        <ExpensesProvider>
          <InventoryProvider>
            <AccountsProvider>
              <StaffProvider>
                <ModulesProvider initialPayments={[]}>
                  <div />
                </ModulesProvider>
              </StaffProvider>
            </AccountsProvider>
          </InventoryProvider>
        </ExpensesProvider>
      </CrmProvider>
    );
    const { unmount } = render(shell);

    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('fogoneria:crm:v1:anon') ?? '[]')).toHaveLength(1),
    );
    expect(JSON.parse(localStorage.getItem('fogoneria:expenses:v1:anon') ?? '[]')).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('fogoneria:inventory:v1:anon') ?? '{}')).toMatchObject({
      ingredients: [{ id: 8 }],
      movements: [{ id: 8 }],
    });
    expect(JSON.parse(localStorage.getItem('fogoneria:staff:v1:anon') ?? '[]')).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('fogoneria:orders:v1:anon') ?? '[]')).toHaveLength(1);
    const legacy = JSON.parse(localStorage.getItem('fogoneria:erp:v2:anon') ?? '{}');
    expect(legacy.customers).toBeUndefined();
    expect(legacy.expenses).toBeUndefined();
    expect(legacy.ingredients).toBeUndefined();
    expect(legacy.movements).toBeUndefined();
    expect(legacy.roles).toBeUndefined();
    expect(legacy.accounts).toBeUndefined();

    unmount();
    render(shell);
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('fogoneria:crm:v1:anon') ?? '[]')).toHaveLength(1),
    );
    expect(JSON.parse(localStorage.getItem('fogoneria:expenses:v1:anon') ?? '[]')).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('fogoneria:staff:v1:anon') ?? '[]')).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('fogoneria:orders:v1:anon') ?? '[]')).toHaveLength(1);
  });
});
